import { useEffect } from "react";
import type { Dispatch, SetStateAction } from "react";
import type { FeedPostCardRow } from "@/components/feed/feedPostTypes";
import type { RealtimePostgresChangesPayload, SupabaseClient } from "@supabase/supabase-js";

type FeedSetter = Dispatch<SetStateAction<FeedPostCardRow[]>>;

interface UseFeedPostRealtimeParams {
  supabaseClient: SupabaseClient | null;
  userId: string | null | undefined;
  setFeed: FeedSetter;
}

const mergePostUpdate = (
  current: FeedPostCardRow,
  payload: RealtimePostgresChangesPayload<Record<string, unknown>>,
): FeedPostCardRow => {
  const next = payload.new as Partial<FeedPostCardRow>;
  return {
    ...current,
    likes_count: typeof next.likes_count === "number" ? next.likes_count : current.likes_count,
    comments_count: typeof next.comments_count === "number" ? next.comments_count : current.comments_count,
    hide_like_count: typeof next.hide_like_count === "boolean" ? next.hide_like_count : current.hide_like_count,
    comments_enabled: typeof next.comments_enabled === "boolean" ? next.comments_enabled : current.comments_enabled,
    caption: typeof next.caption === "string" ? next.caption : current.caption,
    media_url: typeof next.media_url === "string" || next.media_url === null ? next.media_url : current.media_url,
    mentions: Array.isArray(next.mentions) ? (next.mentions as string[]) : current.mentions,
  };
};

export const useFeedPostRealtime = ({ supabaseClient, userId, setFeed }: UseFeedPostRealtimeParams) => {
  useEffect(() => {
    if (!supabaseClient) return;

    const channelId = userId ? `feed-posts-${userId}` : `feed-posts-anonymous-${Math.random().toString(36).substring(7)}`;
    const channel = supabaseClient
      .channel(channelId)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "posts" },
        (payload) => {
          const updatedId = (payload.new as { id?: string })?.id;
          if (!updatedId) return;
          setFeed((prev) => prev.map((post) => (post.id === updatedId ? mergePostUpdate(post, payload) : post)));
        },
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "posts" },
        async (payload) => {
          const newPost = payload.new as any;
          if (!newPost?.id) return;

          // Si el autor es el usuario actual, ya tenemos sus datos. 
          // Si no, fetch ligero del perfil para completar FeedPostCardRow.
          let authorData = {
            username: "usuario",
            full_name: null,
            avatar_url: null
          };

          if (userId && newPost.user_id === userId) {
            // Podríamos sacar esto del contexto de auth pero para M12 fetch es más seguro contra staled state
            const { data: profile } = await supabaseClient.from("profiles").select("username, full_name, avatar_url").eq("id", newPost.user_id).single();
            if (profile) authorData = profile;
          } else {
            const { data: profile } = await supabaseClient.from("profiles").select("username, full_name, avatar_url").eq("id", newPost.user_id).single();
            if (profile) authorData = profile;
          }

          const fullPost: FeedPostCardRow = {
            ...newPost,
            username: authorData.username,
            full_name: authorData.full_name,
            avatar_url: authorData.avatar_url,
            likes_count: 0,
            comments_count: 0,
            likedByMe: false
          };

          setFeed((prev) => {
            if (prev.some(p => p.id === fullPost.id)) return prev;
            return [fullPost, ...prev];
          });
        }
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "posts" },
        (payload) => {
          const deletedId = (payload.old as { id?: string })?.id;
          if (!deletedId) return;
          setFeed((prev) => prev.filter((post) => post.id !== deletedId));
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "post_likes" },
        (payload) => {
          const row = (payload.eventType === "DELETE" ? payload.old : payload.new) as Record<string, unknown>;
          const postId = row.post_id as string | undefined;
          const actorId = row.user_id as string | undefined;
          if (!postId) return;
          
          // Ignoramos el evento si lo generó el propio usuario (ya cubierto por Optimistic UI)
          if (actorId && userId && actorId === userId) return;

          if (payload.eventType === "INSERT") {
            setFeed((prev) => prev.map((post) => post.id === postId ? { ...post, likes_count: post.likes_count + 1 } : post));
          } else if (payload.eventType === "DELETE") {
            setFeed((prev) => prev.map((post) => post.id === postId ? { ...post, likes_count: Math.max(0, post.likes_count - 1) } : post));
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "post_comments" },
        (payload) => {
          const row = (payload.eventType === "DELETE" ? payload.old : payload.new) as Record<string, unknown>;
          const postId = row.post_id as string | undefined;
          const actorId = row.user_id as string | undefined;
          if (!postId) return;
          
          if (actorId && userId && actorId === userId) return;

          if (payload.eventType === "INSERT") {
            setFeed((prev) => prev.map((post) => post.id === postId ? { ...post, comments_count: post.comments_count + 1 } : post));
          } else if (payload.eventType === "DELETE") {
            setFeed((prev) => prev.map((post) => post.id === postId ? { ...post, comments_count: Math.max(0, post.comments_count - 1) } : post));
          }
        }
      )
      .subscribe();

    return () => {
      void supabaseClient.removeChannel(channel);
    };
  }, [setFeed, supabaseClient, userId]);
};
