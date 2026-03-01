import { useEffect } from "react";
import type { Dispatch, SetStateAction } from "react";
import type { supabase as supabaseClient } from "@/lib/supabase";
import { getPostRouteSnapshot, setPostRouteSnapshot } from "@/lib/postRouteCache";
import type { ProfileTab, TabPageState } from "@/hooks/useProfileTabsState";

interface ProfileRouteRow {
  id: string;
  username: string;
  full_name: string | null;
  avatar_url: string | null;
  bio: string | null;
}

interface ProfileRoutePost {
  id: string;
  title: string | null;
  caption: string;
  media_url: string | null;
  mentions?: string[] | null;
  likes_count: number;
  comments_count: number;
  comments_enabled?: boolean;
  created_at: string;
}

interface UseProfilePostRouteBootstrapParams<TPost extends ProfileRoutePost, TProfile extends ProfileRouteRow> {
  supabase: NonNullable<typeof supabaseClient> | null;
  isPostRouteMatch: boolean;
  routePostId: string | undefined;
  userUsername: string | null | undefined;
  resolvedPostRouteUsername: string | null;
  setResolvedPostRouteUsername: Dispatch<SetStateAction<string | null>>;
  setPostRouteResolutionDone: Dispatch<SetStateAction<boolean>>;
  setProfileData: Dispatch<SetStateAction<TProfile | null>>;
  setActiveTabPosts: () => void;
  setTabState: Dispatch<SetStateAction<Record<ProfileTab, TabPageState<TPost>>>>;
  setModalIndex: Dispatch<SetStateAction<number | null>>;
  setLoading: Dispatch<SetStateAction<boolean>>;
}

const buildEmptyTabsState = <TPost extends ProfileRoutePost>() =>
  ({
    saved: { items: [], page: 0, hasMore: false, loading: false, initialized: true },
    tagged: { items: [], page: 0, hasMore: false, loading: false, initialized: true },
  }) satisfies Pick<Record<ProfileTab, TabPageState<TPost>>, "saved" | "tagged">;

export const useProfilePostRouteBootstrap = <TPost extends ProfileRoutePost, TProfile extends ProfileRouteRow>({
  supabase,
  isPostRouteMatch,
  routePostId,
  userUsername,
  resolvedPostRouteUsername,
  setResolvedPostRouteUsername,
  setPostRouteResolutionDone,
  setProfileData,
  setActiveTabPosts,
  setTabState,
  setModalIndex,
  setLoading,
}: UseProfilePostRouteBootstrapParams<TPost, TProfile>) => {
  useEffect(() => {
    if (!supabase || !isPostRouteMatch || !routePostId) return;
    const client = supabase;
    let cancelled = false;

    const bootstrapPostRoute = async () => {
      const cached = getPostRouteSnapshot(routePostId);

      if (cached && !cancelled) {
        const ownerUsername = cached.username.toLowerCase();
        setResolvedPostRouteUsername(ownerUsername);
        setProfileData({
          id: cached.user_id,
          username: ownerUsername,
          full_name: cached.full_name,
          avatar_url: cached.avatar_url,
          bio: null,
        } as TProfile);
        setActiveTabPosts();
        setTabState({
          posts: {
            items: [
              {
                id: cached.id,
                title: cached.title,
                caption: cached.caption,
                media_url: cached.media_url,
                mentions: cached.mentions,
                likes_count: cached.likes_count,
                comments_count: cached.comments_count,
                comments_enabled: cached.comments_enabled,
                created_at: cached.created_at,
              } as TPost,
            ],
            page: 1,
            hasMore: false,
            loading: false,
            initialized: true,
          },
          ...buildEmptyTabsState<TPost>(),
        });
        setModalIndex(0);
        setPostRouteResolutionDone(true);
        setLoading(false);
      } else {
        setLoading(true);
      }

      const { data: postRow } = await client
        .from("feed_posts")
        .select("id, user_id, username, full_name, avatar_url, title, caption, media_url, likes_count, comments_count, created_at")
        .eq("id", routePostId)
        .maybeSingle();

      if (cancelled) return;

      if (!postRow) {
        setProfileData(null);
        setLoading(false);
        setPostRouteResolutionDone(true);
        return;
      }

      const mappedPost: TPost = {
        id: postRow.id as string,
        title: (postRow.title as string | null) ?? null,
        caption: (postRow.caption as string) ?? "",
        media_url: (postRow.media_url as string | null) ?? null,
        mentions: null, // M12: Campo no presente en vista feed_posts
        likes_count: (postRow.likes_count as number) ?? 0,
        comments_count: (postRow.comments_count as number) ?? 0,
        comments_enabled: true, // M12: Default ya que no está en la vista
        created_at: (postRow.created_at as string) ?? new Date().toISOString(),
      } as TPost;
      const ownerId = postRow.user_id as string;
      const ownerUsername = ((postRow.username as string | null) ?? userUsername ?? "usuario").toLowerCase();

      setPostRouteSnapshot({
        id: mappedPost.id,
        user_id: ownerId,
        username: ownerUsername,
        full_name: (postRow.full_name as string | null) ?? null,
        avatar_url: (postRow.avatar_url as string | null) ?? null,
        title: mappedPost.title,
        caption: mappedPost.caption,
        media_url: mappedPost.media_url,
        mentions: mappedPost.mentions ?? null,
        likes_count: mappedPost.likes_count,
        comments_count: mappedPost.comments_count,
        comments_enabled: mappedPost.comments_enabled !== false,
        created_at: mappedPost.created_at,
      });

      setResolvedPostRouteUsername(ownerUsername);
      setProfileData({
        id: ownerId,
        username: ownerUsername,
        full_name: (postRow.full_name as string | null) ?? null,
        avatar_url: (postRow.avatar_url as string | null) ?? null,
        bio: null,
      } as TProfile);
      setActiveTabPosts();
      setTabState({
        posts: { items: [mappedPost], page: 1, hasMore: false, loading: false, initialized: true },
        ...buildEmptyTabsState<TPost>(),
      });
      setModalIndex(0);
      setPostRouteResolutionDone(true);
      setLoading(false);
    };

    void bootstrapPostRoute();
    return () => {
      cancelled = true;
    };
  }, [
    isPostRouteMatch,
    routePostId,
    setActiveTabPosts,
    setLoading,
    setModalIndex,
    setPostRouteResolutionDone,
    setProfileData,
    setResolvedPostRouteUsername,
    setTabState,
    supabase,
    userUsername,
  ]);

  useEffect(() => {
    let cancelled = false;

    const resolvePostRouteUsername = async () => {
      if (!supabase || !isPostRouteMatch || !routePostId) {
        setResolvedPostRouteUsername(null);
        setPostRouteResolutionDone(false);
        return;
      }
      if (resolvedPostRouteUsername) {
        setPostRouteResolutionDone(true);
        return;
      }
      setPostRouteResolutionDone(false);

      const { data: postRow } = await supabase
        .from("posts")
        .select("user_id")
        .eq("id", routePostId)
        .maybeSingle();

      const ownerId = (postRow?.user_id as string | undefined) ?? null;
      if (!ownerId) {
        if (!cancelled) {
          setResolvedPostRouteUsername(null);
          setPostRouteResolutionDone(true);
        }
        return;
      }

      const { data: ownerProfile } = await supabase
        .from("profiles")
        .select("username")
        .eq("id", ownerId)
        .maybeSingle();

      if (!cancelled) {
        setResolvedPostRouteUsername(((ownerProfile?.username as string | undefined) ?? null));
        setPostRouteResolutionDone(true);
      }
    };

    void resolvePostRouteUsername();
    return () => {
      cancelled = true;
    };
  }, [
    isPostRouteMatch,
    resolvedPostRouteUsername,
    routePostId,
    setPostRouteResolutionDone,
    setResolvedPostRouteUsername,
    supabase,
  ]);

  useEffect(() => {
    if (isPostRouteMatch) {
      // En ruta de publicación no debe mostrarse loading de perfil.
      setLoading(false);
    }
  }, [isPostRouteMatch, setLoading]);
};

