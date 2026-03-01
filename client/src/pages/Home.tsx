import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Compass, ChevronDown, Plus } from "lucide-react";
import { Glass } from "@/components/ui/glass";
import { Skeleton, FeedPostSkeleton } from "@/components/ui/skeleton";
import DailyBook from "@/components/DailyBook";
import RightPanel from "@/components/RightPanel";
import Footer from "@/components/Footer";
import FeedPostCard, { FeedPostCardRow, FeedPostComment } from "@/components/feed/FeedPostCard";
import FeedTextPostCard from "@/components/feed/FeedTextPostCard";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { Virtuoso } from "react-virtuoso";
import { useFeedPostRealtime } from "@/hooks/useFeedPostRealtime";
import { setPostRouteSnapshot } from "@/lib/postRouteCache";
import {
  prefetchProfileRouteSnapshot,
  updateProfileRouteSnapshot,
  updateProfileRouteSnapshotByUserId,
} from "@/lib/profileRouteCache";

interface FeedCursor {
  createdAt: string;
  id: string;
}
interface HomeFeedCache {
  userId: string;
  feed: FeedPostCardRow[];
  hasMore: boolean;
  nextCursor: FeedCursor | null;
  savedPostIds: string[];
  followingAuthorIds: string[];
  pendingAuthorIds: string[];
  favoriteAuthorIds: string[];
}

const FEED_PAGE_SIZE = 10;
const CURSOR_RECOVERY_MAX_HOPS = 2;
let homeFeedCache: HomeFeedCache | null = null;

const cursorToKey = (cursor: FeedCursor | null) =>
  cursor ? `${cursor.createdAt}::${cursor.id}` : "__ROOT__";

const Home = () => {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const [feed, setFeed] = useState<FeedPostCardRow[]>(() => homeFeedCache?.feed ?? []);
  const [feedMode, setFeedMode] = useState<"ranked" | "recent">("ranked");
  const [loadingFeed, setLoadingFeed] = useState(() => (homeFeedCache ? false : true));
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(() => homeFeedCache?.hasMore ?? true);
  const [nextCursor, setNextCursor] = useState<FeedCursor | null>(() => homeFeedCache?.nextCursor ?? null);
  const [openComments, setOpenComments] = useState<Record<string, boolean>>({});
  const [commentsByPost, setCommentsByPost] = useState<Record<string, FeedPostComment[]>>({});
  const [commentInputs, setCommentInputs] = useState<Record<string, string>>({});
  const [followingAuthorIds, setFollowingAuthorIds] = useState<Set<string>>(
    () => new Set(homeFeedCache?.followingAuthorIds ?? []),
  );
  const [pendingAuthorIds, setPendingAuthorIds] = useState<Set<string>>(
    () => new Set(homeFeedCache?.pendingAuthorIds ?? []),
  );
  const [favoriteAuthorIds, setFavoriteAuthorIds] = useState<Set<string>>(
    () => new Set(homeFeedCache?.favoriteAuthorIds ?? []),
  );
  const [followLoadingByUser, setFollowLoadingByUser] = useState<Record<string, boolean>>({});
  const [savedPostIds, setSavedPostIds] = useState<Set<string>>(() => new Set(homeFeedCache?.savedPostIds ?? []));
  const [showFeedMenu, setShowFeedMenu] = useState(false);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const seenPostIdsRef = useRef<Set<string>>(new Set((homeFeedCache?.feed ?? []).map((post) => post.id)));
  const exhaustedCursorKeysRef = useRef<Set<string>>(new Set());
  const supportsHoverPrefetch = useMemo(
    () => typeof window !== "undefined" && window.matchMedia("(hover: hover) and (pointer: fine)").matches,
    [],
  );

  useFeedPostRealtime({ supabaseClient: supabase, userId: user?.id, setFeed });

  const fetchFeedBatch = useCallback(
    async (cursor: FeedCursor | null, append: boolean) => {
      if (!supabase) {
        setLoadingFeed(false);
        setLoadingMore(false);
        setHasMore(false);
        return;
      }

      if (append) {
        setLoadingMore(true);
      } else {
        setLoadingFeed(true);
      }
      let activeCursor = cursor;
      let recoveryHops = 0;

      if (append && exhaustedCursorKeysRef.current.has(cursorToKey(activeCursor))) {
        setHasMore(false);
        setLoadingMore(false);
        return;
      }

      while (true) {
        const { data: rpcPosts, error: rpcError } = await supabase.rpc("get_feed_posts_with_context", {
          p_limit: FEED_PAGE_SIZE,
          p_cursor_created_at: activeCursor?.createdAt ?? null,
          p_cursor_id: activeCursor?.id ?? null,
        });

        let posts = rpcPosts as FeedPostCardRow[] | null;
        let postsError = rpcError;

        // Backward compatibility: si RPC no existe o falla, usar vista legacy.
        if (postsError) {
          let legacyQuery = supabase
            .from("feed_posts")
            .select("*")
            .order("created_at", { ascending: false })
            .order("id", { ascending: false })
            .limit(FEED_PAGE_SIZE);

          if (activeCursor) {
            const cursorFilter = `created_at.lt.${activeCursor.createdAt},and(created_at.eq.${activeCursor.createdAt},id.lt.${activeCursor.id})`;
            legacyQuery = legacyQuery.or(cursorFilter);
          }

          const { data: legacyPosts, error: legacyError } = await legacyQuery;
          posts = legacyPosts as FeedPostCardRow[] | null;
          postsError = legacyError;
        }

        if (postsError) {
          setLoadingFeed(false);
          setLoadingMore(false);
          toast({ title: "Error", description: "No se pudo cargar el feed." });
          return;
        }

        const mappedPosts = (posts ?? []) as FeedPostCardRow[];
        if (mappedPosts.length === 0) {
          setHasMore(false);
          break;
        }

        if (mappedPosts.length < FEED_PAGE_SIZE) {
          setHasMore(false);
        }

        let likedSet = new Set<string>();
        if (user?.id && mappedPosts.length > 0) {
          const ids = mappedPosts.map((p) => p.id);
          const { data: likes } = await supabase
            .from("post_likes")
            .select("post_id")
            .eq("user_id", user.id)
            .in("post_id", ids);

          likedSet = new Set((likes ?? []).map((l) => l.post_id as string));
        }

        let savedSet = new Set<string>();
        if (user?.id && mappedPosts.length > 0) {
          const postIds = mappedPosts.map((p) => p.id);
          const { data: savedRows } = await supabase
            .from("saved_posts")
            .select("post_id")
            .eq("user_id", user.id)
            .in("post_id", postIds);

          savedSet = new Set((savedRows ?? []).map((row) => row.post_id as string));
        }

        let followingSet = new Set<string>();
        let pendingSet = new Set<string>();
        let favoriteSet = new Set<string>();
        if (user?.id && mappedPosts.length > 0) {
          const authorIds = Array.from(new Set(mappedPosts.map((p) => p.user_id).filter((id) => id && id !== user.id)));
          if (authorIds.length > 0) {
            const [{ data: follows }, { data: pendingRequests }] = await Promise.all([
              supabase
                .from("follows")
                .select("following_id")
                .eq("follower_id", user.id)
                .in("following_id", authorIds),
              supabase
                .from("follow_requests")
                .select("target_id")
                .eq("requester_id", user.id)
                .eq("status", "pending")
                .in("target_id", authorIds),
            ]);

            followingSet = new Set((follows ?? []).map((f) => f.following_id as string));
            pendingSet = new Set((pendingRequests ?? []).map((f) => f.target_id as string));

            const { data: favorites } = await supabase
              .from("account_favorites")
              .select("favorite_user_id")
              .eq("user_id", user.id)
              .in("favorite_user_id", authorIds);
            favoriteSet = new Set((favorites ?? []).map((f) => f.favorite_user_id as string));
          }
        }

        const mapped = mappedPosts.map((p) => ({
          ...p,
          likedByMe: likedSet.has(p.id),
        }));

        let fresh = mapped;
        if (append) {
          fresh = mapped.filter((p) => !seenPostIdsRef.current.has(p.id));
        }

        const lastPost = mappedPosts[mappedPosts.length - 1];
        const nextCursorCandidate: FeedCursor = {
          createdAt: lastPost.created_at,
          id: lastPost.id,
        };
        setNextCursor(nextCursorCandidate);

        if (append && fresh.length === 0) {
          exhaustedCursorKeysRef.current.add(cursorToKey(activeCursor));
          const stuckInSameCursor = cursorToKey(activeCursor) === cursorToKey(nextCursorCandidate);
          if (stuckInSameCursor || recoveryHops >= CURSOR_RECOVERY_MAX_HOPS) {
            setHasMore(false);
            break;
          }
          recoveryHops += 1;
          activeCursor = nextCursorCandidate;
          continue;
        }

        if (append) {
          fresh.forEach((post) => seenPostIdsRef.current.add(post.id));
          setFeed((prev) => [...prev, ...fresh]);
        } else {
          seenPostIdsRef.current = new Set(mapped.map((p) => p.id));
          exhaustedCursorKeysRef.current.clear();
          setFeed(mapped);
        }

        setSavedPostIds((prev) => {
          if (!append) return savedSet;
          const next = new Set(prev);
          savedSet.forEach((id) => next.add(id));
          return next;
        });

        setFollowingAuthorIds((prev) => {
          if (!append) return followingSet;
          const next = new Set(prev);
          followingSet.forEach((id) => next.add(id));
          return next;
        });
        setPendingAuthorIds((prev) => {
          if (!append) return pendingSet;
          const next = new Set(prev);
          pendingSet.forEach((id) => next.add(id));
          return next;
        });

        setFavoriteAuthorIds((prev) => {
          if (!append) return favoriteSet;
          const next = new Set(prev);
          favoriteSet.forEach((id) => next.add(id));
          return next;
        });

        break;
      }

      setLoadingFeed(false);
      setLoadingMore(false);
    },
    [toast, user?.id],
  );

  const loadFeed = useCallback(async () => {
    setHasMore(true);
    setNextCursor(null);
    seenPostIdsRef.current.clear();
    exhaustedCursorKeysRef.current.clear();
    await fetchFeedBatch(null, false);
  }, [fetchFeedBatch]);

  const loadMore = useCallback(async () => {
    if (loadingFeed || loadingMore || !hasMore || !nextCursor) return;
    await fetchFeedBatch(nextCursor, true);
  }, [fetchFeedBatch, hasMore, loadingFeed, loadingMore, nextCursor]);

  const loadComments = async (postId: string) => {
    if (!supabase) return;

    const { data, error } = await supabase
      .from("post_comments")
      .select("id, post_id, user_id, content, created_at")
      .eq("post_id", postId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(20);

    if (error) {
      toast({ title: "Error", description: "No se pudieron cargar los comentarios." });
      return;
    }

    setCommentsByPost((prev) => ({ ...prev, [postId]: (data ?? []) as FeedPostComment[] }));
  };

  useEffect(() => {
    if (!user?.id) return;
    if (homeFeedCache && homeFeedCache.userId === user.id) {
      setFeed(homeFeedCache.feed);
      setHasMore(homeFeedCache.hasMore);
      setNextCursor(homeFeedCache.nextCursor);
      setSavedPostIds(new Set(homeFeedCache.savedPostIds));
      setFollowingAuthorIds(new Set(homeFeedCache.followingAuthorIds));
      setPendingAuthorIds(new Set(homeFeedCache.pendingAuthorIds));
      setFavoriteAuthorIds(new Set(homeFeedCache.favoriteAuthorIds));
      seenPostIdsRef.current = new Set(homeFeedCache.feed.map((post) => post.id));
      setLoadingFeed(false);
      return;
    }
    void loadFeed();
  }, [user?.id, loadFeed]);

  useEffect(() => {
    if (!user?.id || feed.length === 0) return;
    homeFeedCache = {
      userId: user.id,
      feed,
      hasMore,
      nextCursor,
      savedPostIds: Array.from(savedPostIds),
      followingAuthorIds: Array.from(followingAuthorIds),
      pendingAuthorIds: Array.from(pendingAuthorIds),
      favoriteAuthorIds: Array.from(favoriteAuthorIds),
    };
  }, [favoriteAuthorIds, feed, followingAuthorIds, hasMore, nextCursor, pendingAuthorIds, savedPostIds, user?.id]);

  useEffect(() => {
    // [Optimización react-virtuoso]
    // Virtuoso manejará el IntersectionObserver nativamente a través del callback endReached.
    // Mantenemos este effect obsoleto o vacío si algún componente legacy dependiese del ref,
    // pero ya no disparamos observe() aquí para evitar doble fetching.
  }, []);

  useEffect(() => {
    const onAvatarUpdated = (event: Event) => {
      const detail = (event as CustomEvent<{ userId?: string; avatarUrl?: string }>).detail;
      if (!detail?.userId) return;
      setFeed((prev) =>
        prev.map((post) => (post.user_id === detail.userId ? { ...post, avatar_url: detail.avatarUrl ?? null } : post)),
      );
      updateProfileRouteSnapshotByUserId(detail.userId, (snapshot) => ({
        ...snapshot,
        avatar_url: detail.avatarUrl ?? null,
      }));
    };

    window.addEventListener("instadetox:avatar-updated", onAvatarUpdated as EventListener);
    return () => window.removeEventListener("instadetox:avatar-updated", onAvatarUpdated as EventListener);
  }, []);

  useEffect(() => {
    if (!supabase || !user?.id) return;
    const client = supabase;
    const channel = client.channel(`home-follow-realtime:${user.id}:${Date.now()}`);

    channel.on(
      "postgres_changes",
      { event: "*", schema: "public", table: "follows", filter: `follower_id=eq.${user.id}` },
      (payload) => {
        const row = (payload.eventType === "DELETE" ? payload.old : payload.new) as Record<string, unknown>;
        const targetId = row.following_id as string | undefined;
        if (!targetId) return;

        if (payload.eventType === "INSERT") {
          setFollowingAuthorIds((prev) => new Set(prev).add(targetId));
          setPendingAuthorIds((prev) => {
            const next = new Set(prev);
            next.delete(targetId);
            return next;
          });
          updateProfileRouteSnapshotByUserId(targetId, (snapshot) => ({
            ...snapshot,
            isFollowing: true,
            isFollowPending: false,
          }));
          return;
        }

        if (payload.eventType === "DELETE") {
          setFollowingAuthorIds((prev) => {
            const next = new Set(prev);
            next.delete(targetId);
            return next;
          });
          updateProfileRouteSnapshotByUserId(targetId, (snapshot) => ({
            ...snapshot,
            isFollowing: false,
          }));
        }
      },
    );

    channel.on(
      "postgres_changes",
      { event: "*", schema: "public", table: "follow_requests", filter: `requester_id=eq.${user.id}` },
      (payload) => {
        const row = (payload.eventType === "DELETE" ? payload.old : payload.new) as Record<string, unknown>;
        const targetId = row.target_id as string | undefined;
        if (!targetId) return;
        const status = row.status as string | undefined;
        const isPending = payload.eventType !== "DELETE" && status === "pending";

        if (isPending) {
          setPendingAuthorIds((prev) => new Set(prev).add(targetId));
          updateProfileRouteSnapshotByUserId(targetId, (snapshot) => ({
            ...snapshot,
            isFollowPending: true,
            isFollowing: false,
          }));
          return;
        }

        setPendingAuthorIds((prev) => {
          const next = new Set(prev);
          next.delete(targetId);
          return next;
        });
        updateProfileRouteSnapshotByUserId(targetId, (snapshot) => ({
          ...snapshot,
          isFollowPending: false,
        }));
      },
    );

    channel.subscribe();
    return () => {
      void client.removeChannel(channel);
    };
  }, [user?.id]);

  const toggleLike = async (post: FeedPostCardRow) => {
    if (!supabase || !user?.id) {
      toast({ title: "Inicia sesion", description: "Debes iniciar sesion para dar like." });
      return;
    }

    const currentlyLiked = Boolean(post.likedByMe);

    setFeed((prev) =>
      prev.map((p) =>
        p.id === post.id
          ? {
              ...p,
              likedByMe: !currentlyLiked,
              likes_count: currentlyLiked ? Math.max(0, p.likes_count - 1) : p.likes_count + 1,
            }
          : p,
      ),
    );

    if (currentlyLiked) {
      const { error } = await supabase.from("post_likes").delete().eq("post_id", post.id).eq("user_id", user.id);
      if (error) {
        await loadFeed();
        toast({ title: "Error", description: "No se pudo quitar el like." });
      }
      return;
    }

    const { error } = await supabase
      .from("post_likes")
      .upsert({ post_id: post.id, user_id: user.id }, { onConflict: "post_id,user_id", ignoreDuplicates: true });
    if (error) {
      await loadFeed();
      toast({ title: "Error", description: "No se pudo dar like." });
    }
  };

  const toggleFollowAuthor = async (authorId: string) => {
    if (!supabase || !user?.id) {
      toast({ title: "Inicia sesion", description: "Debes iniciar sesion para seguir usuarios." });
      return;
    }
    if (authorId === user.id) return;

    const isFollowing = followingAuthorIds.has(authorId);
    const isPending = pendingAuthorIds.has(authorId);
    const authorUsername = (
      feed.find((post) => post.user_id === authorId)?.username ??
      ""
    )
      .trim()
      .toLowerCase();
    setFollowLoadingByUser((prev) => ({ ...prev, [authorId]: true }));
    setFollowingAuthorIds((prev) => {
      const next = new Set(prev);
      if (isFollowing) {
        next.delete(authorId);
      }
      return next;
    });
    setPendingAuthorIds((prev) => {
      const next = new Set(prev);
      if (isPending) {
        next.delete(authorId);
      }
      return next;
    });
    if (authorUsername) {
      updateProfileRouteSnapshot(authorUsername, (snapshot) => ({
        ...snapshot,
        isFollowing: isFollowing ? false : snapshot.isFollowing,
        isFollowPending: false,
        followers: isFollowing ? Math.max(0, snapshot.followers - 1) : snapshot.followers,
      }));
    }

    if (isFollowing) {
      const { error } = await supabase
        .from("follows")
        .delete()
        .eq("follower_id", user.id)
        .eq("following_id", authorId);

      if (error) {
        setFollowingAuthorIds((prev) => {
          const next = new Set(prev);
          next.add(authorId);
          return next;
        });
        if (authorUsername) {
          updateProfileRouteSnapshot(authorUsername, (snapshot) => ({
            ...snapshot,
            isFollowing: true,
            isFollowPending: false,
            followers: snapshot.followers + 1,
          }));
        }
        toast({ title: "Error", description: "No se pudo dejar de seguir." });
      }
    } else if (isPending) {
      const { error } = await supabase
        .from("follow_requests")
        .update({ status: "canceled", resolved_at: new Date().toISOString() })
        .eq("requester_id", user.id)
        .eq("target_id", authorId)
        .eq("status", "pending");

      if (error) {
        setPendingAuthorIds((prev) => new Set(prev).add(authorId));
        if (authorUsername) {
          updateProfileRouteSnapshot(authorUsername, (snapshot) => ({
            ...snapshot,
            isFollowing: false,
            isFollowPending: true,
          }));
        }
        toast({ title: "Error", description: "No se pudo cancelar la solicitud." });
      }
    } else {
      const { data: targetProfile } = await supabase.from("profiles").select("is_private").eq("id", authorId).maybeSingle();
      const targetIsPrivate = Boolean(targetProfile?.is_private);

      if (targetIsPrivate) {
        setPendingAuthorIds((prev) => new Set(prev).add(authorId));
        if (authorUsername) {
          updateProfileRouteSnapshot(authorUsername, (snapshot) => ({
            ...snapshot,
            isFollowing: false,
            isFollowPending: true,
          }));
        }

        const { error } = await supabase.from("follow_requests").upsert(
          {
            requester_id: user.id,
            target_id: authorId,
            status: "pending",
            resolved_at: null,
          },
          { onConflict: "requester_id,target_id" },
        );

        if (error) {
          setPendingAuthorIds((prev) => {
            const next = new Set(prev);
            next.delete(authorId);
            return next;
          });
          if (authorUsername) {
            updateProfileRouteSnapshot(authorUsername, (snapshot) => ({
              ...snapshot,
              isFollowing: false,
              isFollowPending: false,
            }));
          }
          toast({ title: "Error", description: "No se pudo enviar la solicitud." });
        }
      } else {
        setFollowingAuthorIds((prev) => new Set(prev).add(authorId));
        if (authorUsername) {
          updateProfileRouteSnapshot(authorUsername, (snapshot) => ({
            ...snapshot,
            isFollowing: true,
            isFollowPending: false,
            followers: snapshot.followers + 1,
          }));
        }

        const { error } = await supabase.from("follows").insert({
          follower_id: user.id,
          following_id: authorId,
        });

        if (error) {
          setFollowingAuthorIds((prev) => {
            const next = new Set(prev);
            next.delete(authorId);
            return next;
          });
          if (authorUsername) {
            updateProfileRouteSnapshot(authorUsername, (snapshot) => ({
              ...snapshot,
              isFollowing: false,
              isFollowPending: false,
              followers: Math.max(0, snapshot.followers - 1),
            }));
          }
          toast({ title: "Error", description: "No se pudo seguir al usuario." });
        }
      }
    }

    setFollowLoadingByUser((prev) => ({ ...prev, [authorId]: false }));
  };

  const toggleSavePost = async (postId: string) => {
    if (!supabase || !user?.id) {
      toast({ title: "Inicia sesion", description: "Debes iniciar sesion para guardar publicaciones." });
      return;
    }

    const isSaved = savedPostIds.has(postId);
    setSavedPostIds((prev) => {
      const next = new Set(prev);
      if (isSaved) {
        next.delete(postId);
      } else {
        next.add(postId);
      }
      return next;
    });

    if (isSaved) {
      const { error } = await supabase.from("saved_posts").delete().eq("user_id", user.id).eq("post_id", postId);
      if (error) {
        setSavedPostIds((prev) => new Set(prev).add(postId));
        toast({ title: "Error", description: "No se pudo quitar de guardados." });
      }
      return;
    }

    const { error } = await supabase.from("saved_posts").insert({ user_id: user.id, post_id: postId });
    if (error) {
      setSavedPostIds((prev) => {
        const next = new Set(prev);
        next.delete(postId);
        return next;
      });
      toast({ title: "Error", description: "No se pudo guardar la publicacion." });
    }
  };

  const handleToggleComments = async (postId: string) => {
    const willOpen = !openComments[postId];
    setOpenComments((prev) => ({ ...prev, [postId]: willOpen }));
    if (willOpen) {
      await loadComments(postId);
    }
  };

  const handleCommentSubmit = async (postId: string) => {
    if (!supabase || !user?.id) {
      toast({ title: "Inicia sesion", description: "Debes iniciar sesion para comentar." });
      return;
    }

    const content = (commentInputs[postId] ?? "").trim();
    if (!content) return;

    // Guard anti-stale: revalida estado real del post antes de intentar insertar.
    const { data: statusRow, error: statusError } = await supabase
      .from("posts")
      .select("comments_enabled")
      .eq("id", postId)
      .single();
    if (statusError) {
      toast({ title: "Error", description: "No se pudo validar el estado de comentarios." });
      return;
    }
    if (statusRow?.comments_enabled === false) {
      setFeed((prev) => prev.map((post) => (post.id === postId ? { ...post, comments_enabled: false } : post)));
      toast({ title: "Comentarios desactivados", description: "Esta publicacion no acepta comentarios." });
      return;
    }

    const { error } = await supabase.from("post_comments").insert({
      post_id: postId,
      user_id: user.id,
      content,
    });

    if (error) {
      const message = String(error.message || "").toLowerCase();
      const isCommentsPolicyBlock =
        message.includes("row-level security") || message.includes("comments_insert_self");
      if (isCommentsPolicyBlock) {
        setFeed((prev) => prev.map((post) => (post.id === postId ? { ...post, comments_enabled: false } : post)));
        toast({ title: "Comentarios desactivados", description: "Esta publicacion no acepta comentarios." });
        return;
      }
      toast({ title: "Error", description: "No se pudo publicar el comentario." });
      return;
    }

    setCommentInputs((prev) => ({ ...prev, [postId]: "" }));
    setFeed((prev) => prev.map((p) => (p.id === postId ? { ...p, comments_count: p.comments_count + 1 } : p)));
    await loadComments(postId);
  };

  const handleSharePost = async (postId: string) => {
    const shareUrl = `${window.location.origin}/p/${postId}`;
    const shareTitle = "InstaDetox";
    const shareText = "Mira esta publicacion en InstaDetox";

    try {
      if (navigator.share) {
        await navigator.share({
          title: shareTitle,
          text: shareText,
          url: shareUrl,
        });
        return;
      }

      await navigator.clipboard.writeText(shareUrl);
      toast({ title: "Enlace copiado", description: "Se copio el enlace de la publicacion." });
    } catch {
      toast({ title: "No se pudo compartir", description: "Intenta nuevamente." });
    }
  };

  const handleDeletePost = async (postId: string) => {
    if (!supabase || !user?.id) {
      toast({ title: "Inicia sesión", description: "Debes iniciar sesión para eliminar publicaciones." });
      return false;
    }

    const target = feed.find((post) => post.id === postId);
    if (!target) return false;
    if (target.user_id !== user.id) {
      toast({ title: "Error", description: "No tienes permisos para eliminar esta publicación." });
      return false;
    }

    const { error } = await supabase.from("posts").update({ deleted_at: new Date().toISOString() }).eq("id", postId).eq("user_id", user.id);
    if (error) {
      toast({ title: "Error", description: "No se pudo eliminar la publicación." });
      return false;
    }

    setFeed((prev) => prev.filter((post) => post.id !== postId));
    setCommentsByPost((prev) => {
      const next = { ...prev };
      delete next[postId];
      return next;
    });
    setOpenComments((prev) => {
      const next = { ...prev };
      delete next[postId];
      return next;
    });
    setCommentInputs((prev) => {
      const next = { ...prev };
      delete next[postId];
      return next;
    });
    setSavedPostIds((prev) => {
      const next = new Set(prev);
      next.delete(postId);
      return next;
    });

    toast({ title: "Publicación eliminada", description: "La publicación se eliminó correctamente." });
    return true;
  };

  const handleReportPost = async (postId: string, reportedUserId: string, reason: string) => {
    if (!supabase || !user?.id) {
      toast({ title: "Inicia sesion", description: "Debes iniciar sesion para reportar publicaciones." });
      return false;
    }
    if (reportedUserId === user.id) {
      toast({ title: "Error", description: "No puedes reportar tu propia publicacion." });
      return false;
    }

    const { error } = await supabase.from("post_reports").upsert(
      {
        post_id: postId,
        reporter_id: user.id,
        reported_user_id: reportedUserId,
        reason,
      },
      { onConflict: "post_id,reporter_id" },
    );

    if (error) {
      toast({ title: "Error", description: "No se pudo enviar el reporte." });
      return false;
    }

    toast({ title: "Reporte enviado", description: "Gracias por reportar." });
    return true;
  };

  const handleToggleFavoriteAuthor = async (authorId: string) => {
    if (!supabase || !user?.id) {
      toast({ title: "Inicia sesion", description: "Debes iniciar sesion para usar favoritos." });
      return false;
    }
    if (authorId === user.id) {
      toast({ title: "Info", description: "No puedes marcarte como favorito." });
      return false;
    }

    const currentlyFavorite = favoriteAuthorIds.has(authorId);
    setFavoriteAuthorIds((prev) => {
      const next = new Set(prev);
      if (currentlyFavorite) next.delete(authorId);
      else next.add(authorId);
      return next;
    });

    if (currentlyFavorite) {
      const { error } = await supabase
        .from("account_favorites")
        .delete()
        .eq("user_id", user.id)
        .eq("favorite_user_id", authorId);
      if (error) {
        setFavoriteAuthorIds((prev) => new Set(prev).add(authorId));
        toast({ title: "Error", description: "No se pudo quitar de favoritos." });
        return false;
      }
      toast({ title: "Listo", description: "Cuenta quitada de favoritos." });
      return true;
    }

    const { error } = await supabase
      .from("account_favorites")
      .insert({ user_id: user.id, favorite_user_id: authorId });
    if (error) {
      setFavoriteAuthorIds((prev) => {
        const next = new Set(prev);
        next.delete(authorId);
        return next;
      });
      toast({ title: "Error", description: "No se pudo agregar a favoritos." });
      return false;
    }

    toast({ title: "Listo", description: "Cuenta agregada a favoritos." });
    return true;
  };

  const handleToggleHideLikeCount = async (postId: string, nextValue: boolean) => {
    if (!supabase || !user?.id) {
      toast({ title: "Inicia sesion", description: "Debes iniciar sesion para editar la publicacion." });
      return false;
    }

    const previous = feed.find((post) => post.id === postId)?.hide_like_count ?? false;
    setFeed((prev) => prev.map((post) => (post.id === postId ? { ...post, hide_like_count: nextValue } : post)));

    const { error } = await supabase.from("posts").update({ hide_like_count: nextValue }).eq("id", postId).eq("user_id", user.id);
    if (error) {
      setFeed((prev) => prev.map((post) => (post.id === postId ? { ...post, hide_like_count: previous } : post)));
      toast({ title: "Error", description: "No se pudo actualizar el recuento de me gusta." });
      return false;
    }

    toast({
      title: "Actualizado",
      description: nextValue ? "Se oculto el recuento de me gusta." : "Se mostro el recuento de me gusta.",
    });
    return true;
  };

  const handleToggleCommentsEnabled = async (postId: string, nextValue: boolean) => {
    if (!supabase || !user?.id) {
      toast({ title: "Inicia sesion", description: "Debes iniciar sesion para editar la publicacion." });
      return false;
    }

    const previous = feed.find((post) => post.id === postId)?.comments_enabled ?? true;
    setFeed((prev) => prev.map((post) => (post.id === postId ? { ...post, comments_enabled: nextValue } : post)));

    const { error } = await supabase.from("posts").update({ comments_enabled: nextValue }).eq("id", postId).eq("user_id", user.id);
    if (error) {
      setFeed((prev) => prev.map((post) => (post.id === postId ? { ...post, comments_enabled: previous } : post)));
      toast({ title: "Error", description: "No se pudo actualizar el estado de comentarios." });
      return false;
    }

    toast({
      title: "Actualizado",
      description: nextValue ? "Comentarios activados." : "Comentarios desactivados.",
    });
    return true;
  };

  const handleEditPostCaption = async (postId: string, nextCaption: string) => {
    if (!supabase || !user?.id) {
      toast({ title: "Inicia sesion", description: "Debes iniciar sesion para editar la publicacion." });
      return false;
    }
    const previous = feed.find((post) => post.id === postId)?.caption ?? "";
    setFeed((prev) => prev.map((post) => (post.id === postId ? { ...post, caption: nextCaption } : post)));

    const { error } = await supabase.from("posts").update({ caption: nextCaption }).eq("id", postId).eq("user_id", user.id);
    if (error) {
      setFeed((prev) => prev.map((post) => (post.id === postId ? { ...post, caption: previous } : post)));
      toast({ title: "Error", description: "No se pudo guardar la edicion." });
      return false;
    }

    toast({ title: "Publicacion actualizada", description: "Los cambios se guardaron correctamente." });
    return true;
  };

  const visibleFeed = useMemo(() => {
    return [...feed].sort((a, b) => {
      const timeDiff = new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      if (timeDiff !== 0) return timeDiff;
      return b.id.localeCompare(a.id);
    });
  }, [feed, feedMode]);

  const renderFeedSkeleton = (key: string) => (
    <Glass key={key} className="p-5 space-y-4">
      <div className="flex items-center gap-3">
        <Skeleton className="h-10 w-10 rounded-full" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-3 w-24" />
        </div>
      </div>
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-64 w-full rounded-xl" />
      <div className="flex items-center gap-4">
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-4 w-20" />
      </div>
    </Glass>
  );

  const warmPostRouteSnapshot = useCallback((post: FeedPostCardRow) => {
    setPostRouteSnapshot({
      id: post.id,
      user_id: post.user_id,
      username: post.username ?? "usuario",
      full_name: post.full_name ?? null,
      avatar_url: post.avatar_url ?? null,
      title: post.title ?? null,
      caption: post.caption,
      media_url: post.media_url ?? null,
      mentions: post.mentions ?? null,
      likes_count: post.likes_count,
      comments_count: post.comments_count,
      comments_enabled: post.comments_enabled !== false,
      created_at: post.created_at,
    });
  }, []);

  const warmProfileRouteSnapshot = useCallback(
    (username: string | null | undefined) => {
      const target = (username ?? "").trim().toLowerCase();
      if (!target || target === "inicio") return;
      void prefetchProfileRouteSnapshot(target, user?.id ?? null);
    },
    [user?.id],
  );

  useEffect(() => {
    const warmCandidates = feed.slice(0, 12);
    warmCandidates.forEach((post) => {
      warmPostRouteSnapshot(post);
      warmProfileRouteSnapshot(post.username);
    });
  }, [feed, warmPostRouteSnapshot, warmProfileRouteSnapshot]);

  const openPostRoute = (post: FeedPostCardRow) => {
    warmPostRouteSnapshot(post);
    setLocation(`/p/${post.id}`);
  };

  return (
    <div className="w-full max-w-7xl mx-auto flex flex-col md:flex-row gap-6">
      <div className="w-full md:w-3/4 lg:w-8/12 space-y-6 pb-8 animate-in fade-in duration-500">
        {/* Nuevo Header Detox Minimalista */}
        <div className="flex flex-col items-center mb-4 pt-2">
          <div className="relative group">
            <button 
              onClick={() => setShowFeedMenu(!showFeedMenu)}
              className="flex items-center gap-2 px-4 py-2 hover:bg-white/5 rounded-lg transition-all"
            >
              <h1 className="text-xl font-bold text-white tracking-tight">
                {feedMode === "ranked" ? "Para ti" : "Recientes"}
              </h1>
              <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${showFeedMenu ? 'rotate-180' : ''}`} />
            </button>

            {showFeedMenu && (
              <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1 w-40 bg-[#1a1a1a] border border-white/10 rounded-xl shadow-2xl z-50 overflow-hidden animate-in fade-in zoom-in duration-200">
                <button 
                  onClick={() => { setFeedMode("ranked"); setShowFeedMenu(false); }}
                  className={`w-full px-4 py-3 text-sm text-left hover:bg-white/5 transition-colors ${feedMode === "ranked" ? 'text-white font-bold' : 'text-gray-400'}`}
                >
                  Para ti
                </button>
                <button 
                  onClick={() => { setFeedMode("recent"); setShowFeedMenu(false); }}
                  className={`w-full px-4 py-3 text-sm text-left hover:bg-white/5 transition-colors ${feedMode === "recent" ? 'text-white font-bold' : 'text-gray-400'}`}
                >
                  Recientes
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Barra de Creación Rápida */}
        <Glass className="p-4 mb-6">
          <div className="flex items-center gap-4">
            <div 
              className="w-10 h-10 rounded-full overflow-hidden flex-shrink-0 cursor-pointer hover:opacity-80 transition-opacity"
              onClick={() => setLocation(`/${user?.username || 'perfil'}`)}
            >
              {user?.avatar_url ? (
                <img src={user.avatar_url} alt="Mi perfil" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-primary/20 flex items-center justify-center text-white font-bold">
                  {user?.username?.[0]?.toUpperCase() || 'U'}
                </div>
              )}
            </div>
            
            <div 
              onClick={() => setLocation("/crear")}
              className="flex-1 text-gray-500 text-sm cursor-text hover:text-gray-400 transition-colors py-2"
            >
              ¿Qué novedades tienes?
            </div>

            <button
              onClick={() => setLocation("/crear")}
              className="px-5 py-2 bg-white/10 hover:bg-white/20 text-white text-sm font-bold rounded-xl border border-white/5 transition-all active:scale-95"
            >
              Publicar
            </button>
          </div>
        </Glass>

        {loadingFeed ? (
          <>
            {renderFeedSkeleton("sk-1")}
            {renderFeedSkeleton("sk-2")}
            {renderFeedSkeleton("sk-3")}
          </>
        ) : feed.length === 0 ? (
          <Glass className="p-6">
            <p className="text-gray-300">Aun no hay publicaciones. Crea la primera desde la pestaña Crear.</p>
          </Glass>
        ) : (
          <Virtuoso
            useWindowScroll
            data={visibleFeed}
            overscan={800} // Carga unos 800px arriba/abajo previniendo flashes blancos en scroll rápido
            endReached={() => {
              if (hasMore && !loadingMore && !loadingFeed) {
                void loadMore();
              }
            }}
            itemContent={(_index, post) => {
              const isOwnPost = Boolean(user?.id && user.id === post.user_id);
              const isFollowingAuthor = followingAuthorIds.has(post.user_id);
              const isPendingAuthor = pendingAuthorIds.has(post.user_id);
              const effectiveContext =
                post.feed_context ?? (isOwnPost ? "own" : isFollowingAuthor ? "following" : "suggested");
              const contextLabel = feedMode === "ranked" && effectiveContext === "suggested" ? "Sugerencia para ti" : null;

              const hasMedia = Boolean(post.media_url && post.media_url.trim().length > 0);
              const CardComponent = hasMedia || post.type === "photo" || post.type === "video" ? FeedPostCard : FeedTextPostCard;

              return (
                <div key={post.id} className="pb-6">
                  <CardComponent
                    post={post}
                    currentUserId={user?.id}
                    contextLabel={contextLabel}
                    isFollowingAuthor={isFollowingAuthor}
                    isFollowPendingAuthor={isPendingAuthor}
                    isFavoriteAuthor={favoriteAuthorIds.has(post.user_id)}
                    followLoading={Boolean(followLoadingByUser[post.user_id])}
                    isSaved={savedPostIds.has(post.id)}
                    commentsOpen={Boolean(openComments[post.id])}
                    comments={commentsByPost[post.id] ?? []}
                    commentInput={commentInputs[post.id] ?? ""}
                    onToggleFollow={(authorId) => toggleFollowAuthor(authorId)}
                    onToggleLike={() => void toggleLike(post)}
                    onToggleSave={() => void toggleSavePost(post.id)}
                    onToggleComments={() => void handleToggleComments(post.id)}
                    onShare={() => void handleSharePost(post.id)}
                    onCommentInputChange={(value) =>
                      setCommentInputs((prev) => ({
                        ...prev,
                        [post.id]: value,
                      }))
                    }
                    onSubmitComment={() => void handleCommentSubmit(post.id)}
                    onOpenPost={() => openPostRoute(post)}
                    onWarmRoute={supportsHoverPrefetch ? () => warmPostRouteSnapshot(post) : undefined}
                    onWarmProfileRoute={supportsHoverPrefetch ? () => warmProfileRouteSnapshot(post.username) : undefined}
                    onDeletePost={handleDeletePost}
                    onReportPost={handleReportPost}
                    onToggleFavoriteAuthor={handleToggleFavoriteAuthor}
                    onToggleHideLikeCount={handleToggleHideLikeCount}
                    onToggleCommentsEnabled={handleToggleCommentsEnabled}
                    onEditPostCaption={handleEditPostCaption}
                  />
                </div>
              );
            }}
            components={{
              Footer: () => (
                <div className="py-2 text-center text-sm text-gray-300">
                  {loadingMore ? "Cargando mas publicaciones..." : hasMore ? "Desliza para cargar mas" : "No hay mas contenido"}
                  {loadingMore && renderFeedSkeleton("sk-more")}
                </div>
              )
            }}
          />
        )}
      </div>

      <div className="hidden md:block md:w-1/4 lg:w-4/12">
        <RightPanel />
        <Footer className="mt-6" />
      </div>
    </div>
  );
};

export default Home;
