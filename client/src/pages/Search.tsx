import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { Search as SearchIcon, Users, Image as ImageIcon } from "lucide-react";
import { Glass } from "@/components/ui/glass";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/AuthContext";
import { useToast } from "@/hooks/use-toast";

interface SearchUser {
  id: string;
  username: string;
  full_name: string | null;
  avatar_url: string | null;
  bio: string | null;
}

interface SearchPost {
  id: string;
  user_id: string;
  title: string | null;
  caption: string;
  media_url: string | null;
  created_at: string;
  username: string | null;
  full_name: string | null;
  avatar_url: string | null;
}

const Search = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [query, setQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"users" | "posts">("users");
  const [loading, setLoading] = useState(false);
  const [userResults, setUserResults] = useState<SearchUser[]>([]);
  const [postResults, setPostResults] = useState<SearchPost[]>([]);
  const [recommendedUsers, setRecommendedUsers] = useState<SearchUser[]>([]);
  const [followedIds, setFollowedIds] = useState<Set<string>>(new Set());
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());
  const [followLoadingById, setFollowLoadingById] = useState<Record<string, boolean>>({});

  const normalizedQuery = useMemo(() => query.trim(), [query]);
  const hasSearch = normalizedQuery.length >= 2;

  const syncFollowState = async (userIds: string[]) => {
    if (!supabase || !user?.id || userIds.length === 0) {
      setFollowedIds(new Set());
      setPendingIds(new Set());
      return;
    }

    const deduped = Array.from(new Set(userIds.filter((id) => id !== user.id)));
    if (deduped.length === 0) {
      setFollowedIds(new Set());
      setPendingIds(new Set());
      return;
    }

    const [{ data: followsData }, { data: pendingData }] = await Promise.all([
      supabase
        .from("follows")
        .select("following_id")
        .eq("follower_id", user.id)
        .in("following_id", deduped),
      supabase
        .from("follow_requests")
        .select("target_id")
        .eq("requester_id", user.id)
        .eq("status", "pending")
        .in("target_id", deduped),
    ]);

    setFollowedIds(new Set((followsData ?? []).map((item) => item.following_id as string)));
    setPendingIds(new Set((pendingData ?? []).map((item) => item.target_id as string)));
  };

  const loadRecommendedUsers = async () => {
    if (!supabase || !user?.id) {
      setRecommendedUsers([]);
      return;
    }

    const { data } = await supabase
      .from("profiles")
      .select("id, username, full_name, avatar_url, bio")
      .neq("id", user.id)
      .order("created_at", { ascending: false })
      .limit(12);

    const list = (data ?? []) as SearchUser[];
    setRecommendedUsers(list);
    await syncFollowState(list.map((u) => u.id));
  };

  const runSearch = async (value: string) => {
    if (!supabase || !user?.id) {
      setUserResults([]);
      setPostResults([]);
      return;
    }

    if (value.length < 2) {
      setUserResults([]);
      setPostResults([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    // Sanitización M12: Eliminar modificadores de LIKE y escapar caracteres especiales de FTS
    const safeQuery = value
      .replace(/[%_]/g, "") // Eliminar comodines de LIKE
      .replace(/[&|!():*<>]/g, ""); // Escapar caracteres especiales de websearch_to_tsquery o tsquery

    try {
      // 1. Intentar Búsqueda Enterprise FTS (Garantía de relevancia)
      const ftsQuery = safeQuery.split(/\s+/).filter(Boolean).join(" & ");
      
      const usersPromise = supabase
        .from("profiles")
        .select("id, username, full_name, avatar_url, bio")
        .neq("id", user.id)
        .textSearch("search_vector", ftsQuery, { config: "simple" })
        .limit(20);

      const postsPromise = supabase
        .from("feed_posts")
        .select("id, user_id, title, caption, media_url, created_at, username, full_name, avatar_url")
        .textSearch("search_vector", ftsQuery, { config: "simple" })
        .limit(30);

      const [usersRes, postsRes] = await Promise.all([usersPromise, postsPromise]);

      if (!usersRes.error && !postsRes.error) {
        const users = (usersRes.data ?? []) as SearchUser[];
        const posts = (postsRes.data ?? []) as SearchPost[];
        setUserResults(users);
        setPostResults(posts);
        const allUserIds = [
          ...users.map(u => u.id),
          ...posts.map(p => p.user_id)
        ];
        await syncFollowState(allUserIds);
        setLoading(false);
        return;
      }

      // 2. Fallback a ILIKE (Resiliencia M12) si FTS falla
      console.warn("M12: Search FTS failed, falling back to ILIKE.");
      const usersFallback = await supabase
        .from("profiles")
        .select("id, username, full_name, avatar_url, bio")
        .neq("id", user.id)
        .or(`username.ilike.%${safeQuery}%,full_name.ilike.%${safeQuery}%,bio.ilike.%${safeQuery}%`)
        .limit(20);

      const postsFallback = await supabase
        .from("feed_posts")
        .select("id, user_id, title, caption, media_url, created_at, username, full_name, avatar_url")
        .or(`caption.ilike.%${safeQuery}%,title.ilike.%${safeQuery}%`)
        .limit(30);

      const fUsers = (usersFallback.data ?? []) as SearchUser[];
      const fPosts = (postsFallback.data ?? []) as SearchPost[];
      setUserResults(fUsers);
      setPostResults(fPosts);
      const fallbackUserIds = [
        ...fUsers.map(u => u.id),
        ...fPosts.map(p => p.user_id)
      ];
      await syncFollowState(fallbackUserIds);
    } catch (err) {
      console.error("M12: Search critical failure:", err);
      toast({ title: "Error", description: "No se pudo completar la busqueda." });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadRecommendedUsers();
  }, [user?.id]);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      void runSearch(normalizedQuery);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [normalizedQuery, user?.id]);

  useEffect(() => {
    const onAvatarUpdated = (event: Event) => {
      const detail = (event as CustomEvent<{ userId?: string; avatarUrl?: string }>).detail;
      if (!detail?.userId) return;

      setUserResults((prev) => prev.map((row) => (row.id === detail.userId ? { ...row, avatar_url: detail.avatarUrl ?? null } : row)));
      setRecommendedUsers((prev) =>
        prev.map((row) => (row.id === detail.userId ? { ...row, avatar_url: detail.avatarUrl ?? null } : row)),
      );
      setPostResults((prev) =>
        prev.map((row) => (row.user_id === detail.userId ? { ...row, avatar_url: detail.avatarUrl ?? null } : row)),
      );
    };

    window.addEventListener("instadetox:avatar-updated", onAvatarUpdated as EventListener);
    return () => window.removeEventListener("instadetox:avatar-updated", onAvatarUpdated as EventListener);
  }, []);

  useEffect(() => {
    if (!supabase || !user?.id) return;
    const client = supabase;
    const channel = client.channel(`search-follow-realtime:${user.id}:${Date.now()}`);

    channel.on(
      "postgres_changes",
      { event: "*", schema: "public", table: "follows", filter: `follower_id=eq.${user.id}` },
      (payload) => {
        const row = (payload.eventType === "DELETE" ? payload.old : payload.new) as Record<string, unknown>;
        const targetId = row.following_id as string | undefined;
        if (!targetId) return;

        if (payload.eventType === "INSERT") {
          setFollowedIds((prev) => new Set(prev).add(targetId));
          setPendingIds((prev) => {
            const next = new Set(prev);
            next.delete(targetId);
            return next;
          });
          return;
        }

        if (payload.eventType === "DELETE") {
          setFollowedIds((prev) => {
            const next = new Set(prev);
            next.delete(targetId);
            return next;
          });
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
          setPendingIds((prev) => new Set(prev).add(targetId));
          return;
        }

        setPendingIds((prev) => {
          const next = new Set(prev);
          next.delete(targetId);
          return next;
        });
      },
    );

    channel.subscribe();
    return () => {
      void client.removeChannel(channel);
    };
  }, [user?.id]);

  const toggleFollow = async (targetUserId: string) => {
    if (!supabase || !user?.id || targetUserId === user.id) return;

    const currentlyFollowing = followedIds.has(targetUserId);
    const currentlyPending = pendingIds.has(targetUserId);
    setFollowLoadingById((prev) => ({ ...prev, [targetUserId]: true }));
    if (currentlyFollowing) {
      setFollowedIds((prev) => {
        const next = new Set(prev);
        next.delete(targetUserId);
        return next;
      });
    }
    if (currentlyPending) {
      setPendingIds((prev) => {
        const next = new Set(prev);
        next.delete(targetUserId);
        return next;
      });
    }

    if (currentlyFollowing) {
      const { error } = await supabase
        .from("follows")
        .delete()
        .eq("follower_id", user.id)
        .eq("following_id", targetUserId);

      if (error) {
        setFollowedIds((prev) => new Set(prev).add(targetUserId));
        toast({ title: "Error", description: "No se pudo dejar de seguir." });
      }
    } else if (currentlyPending) {
      const { error } = await supabase
        .from("follow_requests")
        .update({ status: "canceled", resolved_at: new Date().toISOString() })
        .eq("requester_id", user.id)
        .eq("target_id", targetUserId)
        .eq("status", "pending");

      if (error) {
        setPendingIds((prev) => new Set(prev).add(targetUserId));
        toast({ title: "Error", description: "No se pudo cancelar la solicitud." });
      }
    } else {
      const { data: targetProfile } = await supabase.from("profiles").select("is_private").eq("id", targetUserId).maybeSingle();
      const targetIsPrivate = Boolean(targetProfile?.is_private);

      if (targetIsPrivate) {
        setPendingIds((prev) => new Set(prev).add(targetUserId));
        const { error } = await supabase.from("follow_requests").upsert(
          {
            requester_id: user.id,
            target_id: targetUserId,
            status: "pending",
            resolved_at: null,
          },
          { onConflict: "requester_id,target_id" },
        );

        if (error) {
          setPendingIds((prev) => {
            const next = new Set(prev);
            next.delete(targetUserId);
            return next;
          });
          toast({ title: "Error", description: "No se pudo enviar la solicitud." });
        }
      } else {
        setFollowedIds((prev) => new Set(prev).add(targetUserId));
        const { error } = await supabase.from("follows").insert({
          follower_id: user.id,
          following_id: targetUserId,
        });

        if (error) {
          setFollowedIds((prev) => {
            const next = new Set(prev);
            next.delete(targetUserId);
            return next;
          });
          toast({ title: "Error", description: "No se pudo seguir al usuario." });
        }
      }
    }

    setFollowLoadingById((prev) => ({ ...prev, [targetUserId]: false }));
  };

  const profileHref = (username: string | null | undefined) => (username ? `/${username}` : "/inicio");

  const renderUserRow = (item: SearchUser) => (
    <div key={item.id} className="frosted rounded-xl p-3 flex items-center gap-3">
      <div className="w-12 h-12 rounded-full bg-primary/20 overflow-hidden flex items-center justify-center">
        {item.avatar_url ? (
          <img src={item.avatar_url} alt={item.username} className="w-full h-full object-cover" />
        ) : (
          <span className="text-sm text-gray-200">{item.username.slice(0, 1).toUpperCase()}</span>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <Link href={profileHref(item.username)} className="font-medium text-white hover:text-cyan-200 transition-colors">
          {item.full_name || item.username}
        </Link>
        <p className="text-xs text-gray-300">@{item.username}</p>
        {item.bio ? <p className="text-xs text-gray-400 truncate">{item.bio}</p> : null}
      </div>
      <button
        onClick={() => void toggleFollow(item.id)}
        disabled={Boolean(followLoadingById[item.id])}
        className={`text-xs px-3 py-1 rounded-full border transition ${
          followedIds.has(item.id)
            ? "border-white/30 text-gray-200 hover:border-white/50"
            : pendingIds.has(item.id)
            ? "border-white/30 text-gray-200 hover:border-white/50"
            : "border-primary/60 text-primary hover:bg-primary/20"
        } disabled:opacity-60`}
      >
        {followLoadingById[item.id]
          ? "..."
          : followedIds.has(item.id)
            ? "Siguiendo"
            : pendingIds.has(item.id)
              ? "Pendiente"
              : "Seguir"}
      </button>
    </div>
  );

  return (
    <div className="w-full max-w-5xl mx-auto space-y-6 pb-8 animate-in fade-in duration-500">
        <Glass className="p-6">
          <h2 className="text-xl font-semibold mb-4 flex items-center">
            <SearchIcon className="w-5 h-5 mr-2 text-primary" />
            Buscar y explorar
          </h2>
          <p className="text-gray-300 mb-4">Descubre perfiles y publicaciones con enfoque de bienestar digital.</p>
          <div className="relative">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar usuarios o publicaciones..."
              className="w-full bg-black/30 border border-gray-700 rounded-lg px-4 py-2 pl-10 text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <SearchIcon className="absolute left-3 top-2.5 w-5 h-5 text-gray-500" />
          </div>
          <div className="mt-4 flex gap-2">
            <button
              onClick={() => setActiveTab("users")}
              className={`px-3 py-1.5 rounded-lg text-sm inline-flex items-center gap-2 ${
                activeTab === "users" ? "bg-primary/20 text-primary" : "frosted text-gray-300"
              }`}
            >
              <Users className="w-4 h-4" />
              Usuarios
            </button>
            <button
              onClick={() => setActiveTab("posts")}
              className={`px-3 py-1.5 rounded-lg text-sm inline-flex items-center gap-2 ${
                activeTab === "posts" ? "bg-primary/20 text-primary" : "frosted text-gray-300"
              }`}
            >
              <ImageIcon className="w-4 h-4" />
              Publicaciones
            </button>
          </div>
        </Glass>

        {!hasSearch ? (
          <Glass className="p-6">
            <h3 className="text-lg font-medium text-white mb-4">Sugerencias para ti</h3>
            {recommendedUsers.length === 0 ? (
              <p className="text-gray-300">No hay sugerencias disponibles por ahora.</p>
            ) : (
              <div className="space-y-3">{recommendedUsers.map(renderUserRow)}</div>
            )}
          </Glass>
        ) : loading ? (
          <Glass className="p-6">
            <p className="text-gray-300">Buscando resultados...</p>
          </Glass>
        ) : activeTab === "users" ? (
          <Glass className="p-6">
            <h3 className="text-lg font-medium text-white mb-4">Usuarios</h3>
            {userResults.length === 0 ? (
              <p className="text-gray-300">No se encontraron usuarios para "{normalizedQuery}".</p>
            ) : (
              <div className="space-y-3">{userResults.map(renderUserRow)}</div>
            )}
          </Glass>
        ) : (
          <Glass className="p-6">
            <h3 className="text-lg font-medium text-white mb-4">Publicaciones</h3>
            {postResults.length === 0 ? (
              <p className="text-gray-300">No se encontraron publicaciones para "{normalizedQuery}".</p>
            ) : (
              <div className="space-y-4">
                {postResults.map((post) => (
                  <div key={post.id} className="frosted rounded-xl p-4">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 rounded-full bg-primary/20 overflow-hidden">
                        {post.avatar_url ? (
                          <img src={post.avatar_url} alt={post.username ?? "avatar"} className="w-full h-full object-cover" />
                        ) : null}
                      </div>
                      <div className="flex-1">
                        <Link
                          href={profileHref(post.username)}
                          className="text-sm font-semibold text-white hover:text-cyan-200 transition-colors"
                        >
                          {post.full_name || post.username || "usuario"}
                        </Link>
                        <p className="text-xs text-gray-300">@{post.username || "usuario"}</p>
                      </div>
                      {post.user_id !== user?.id ? (
                        <button
                          onClick={() => void toggleFollow(post.user_id)}
                          disabled={Boolean(followLoadingById[post.user_id])}
                          className={`text-xs px-3 py-1 rounded-full border transition ${
                            followedIds.has(post.user_id)
                              ? "border-white/30 text-gray-200 hover:border-white/50"
                              : pendingIds.has(post.user_id)
                              ? "border-white/30 text-gray-200 hover:border-white/50"
                              : "border-primary/60 text-primary hover:bg-primary/20"
                          } disabled:opacity-60`}
                        >
                          {followLoadingById[post.user_id]
                            ? "..."
                            : followedIds.has(post.user_id)
                              ? "Siguiendo"
                              : pendingIds.has(post.user_id)
                                ? "Pendiente"
                                : "Seguir"}
                        </button>
                      ) : null}
                    </div>
                    {post.title ? <h4 className="text-white font-medium mb-2">{post.title}</h4> : null}
                    <p className="text-sm text-gray-200 whitespace-pre-line">{post.caption}</p>
                    {post.media_url ? (
                      <div className="mt-3 overflow-hidden rounded-lg border border-white/15">
                        <img src={post.media_url} alt={post.title ?? "post"} className="w-full h-56 object-cover" />
                      </div>
                    ) : null}
                    <p className="text-xs text-gray-400 mt-2">{new Date(post.created_at).toLocaleString()}</p>
                  </div>
                ))}
              </div>
            )}
          </Glass>
        )}
    </div>
  );
};

export default Search;
