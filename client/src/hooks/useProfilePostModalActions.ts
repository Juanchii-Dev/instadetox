import { useCallback } from "react";
import type { Dispatch, MutableRefObject, RefObject, SetStateAction } from "react";
import type { supabase as supabaseClient } from "@/lib/supabase";
import { apiFetch } from "@/lib/api";

interface ModalPost {
  id: string;
  comments_enabled?: boolean;
}

interface ModalComment {
  id: string;
  user_id: string;
  parent_id: string | null;
  content: string;
  created_at: string;
  username: string;
  full_name: string | null;
  avatar_url: string | null;
  likes_count: number;
  liked_by_me: boolean;
}

interface AuthLikeUser {
  id: string;
  username: string;
  full_name: string | null;
  avatar_url: string | null;
}

interface ReplyTarget {
  commentId: string;
  username: string;
}

interface ProfilePostPatchable {
  id: string;
  likes_count: number;
  comments_count: number;
  comments_enabled?: boolean;
}

interface UseProfilePostModalActionsParams<TPost extends ProfilePostPatchable> {
  supabase: NonNullable<typeof supabaseClient> | null;
  user: AuthLikeUser | null;
  modalPost: ModalPost | null;
  modalComments: ModalComment[];
  modalCommentInput: string;
  modalReplyTarget: ReplyTarget | null;
  modalLikeBusy: boolean;
  modalLikedByMe: boolean;
  modalSaveBusy: boolean;
  modalSavedByMe: boolean;
  commentMenuBusyById: Record<string, boolean>;
  reportCommentId: string | null;
  reportCommentSubmittingReason: string | null;
  isOwnProfile: boolean;
  profileUsername: string | null | undefined;
  modalCommentBusy: boolean;
  setModalCommentBusy: Dispatch<SetStateAction<boolean>>;
  setModalLikeBusy: Dispatch<SetStateAction<boolean>>;
  setModalLikedByMe: Dispatch<SetStateAction<boolean>>;
  setModalSaveBusy: Dispatch<SetStateAction<boolean>>;
  setModalSavedByMe: Dispatch<SetStateAction<boolean>>;
  setModalCommentInput: Dispatch<SetStateAction<string>>;
  setModalCommentsByPost: Dispatch<SetStateAction<Record<string, ModalComment[]>>>;
  setForcedVisibleReplyIdsByParent: Dispatch<SetStateAction<Record<string, string[]>>>;
  setModalReplyTarget: Dispatch<SetStateAction<ReplyTarget | null>>;
  setOpenCommentMenuId: Dispatch<SetStateAction<string | null>>;
  setCommentMenuBusyById: Dispatch<SetStateAction<Record<string, boolean>>>;
  setReportCommentModalOpen: Dispatch<SetStateAction<boolean>>;
  setReportCommentId: Dispatch<SetStateAction<string | null>>;
  setReportCommentSubmittingReason: Dispatch<SetStateAction<string | null>>;
  setExpandedRepliesByCommentId: Dispatch<SetStateAction<Record<string, boolean>>>;
  modalCommentInputRef: RefObject<HTMLInputElement | null>;
  patchPostAcrossTabs: (postId: string, updater: (post: TPost) => TPost) => void;
  dedupeAndSortModalComments: (comments: ModalComment[]) => ModalComment[];
  createClientCommentId: () => string;
  stripLeadingMention: (value: string, username: string) => string;
  toast: (opts: { title: string; description: string }) => void;
  invalidateSavedTab: () => void;
}

export const useProfilePostModalActions = <TPost extends ProfilePostPatchable>({
  supabase,
  user,
  modalPost,
  modalComments,
  modalCommentInput,
  modalReplyTarget,
  modalLikeBusy,
  modalLikedByMe,
  modalSaveBusy,
  modalSavedByMe,
  commentMenuBusyById,
  reportCommentId,
  reportCommentSubmittingReason,
  isOwnProfile,
  profileUsername,
  modalCommentBusy,
  setModalCommentBusy,
  setModalLikeBusy,
  setModalLikedByMe,
  setModalSaveBusy,
  setModalSavedByMe,
  setModalCommentInput,
  setModalCommentsByPost,
  setForcedVisibleReplyIdsByParent,
  setModalReplyTarget,
  setOpenCommentMenuId,
  setCommentMenuBusyById,
  setReportCommentModalOpen,
  setReportCommentId,
  setReportCommentSubmittingReason,
  setExpandedRepliesByCommentId,
  modalCommentInputRef,
  patchPostAcrossTabs,
  dedupeAndSortModalComments,
  createClientCommentId,
  stripLeadingMention,
  toast,
  invalidateSavedTab,
}: UseProfilePostModalActionsParams<TPost>) => {
  const handleModalToggleLike = useCallback(async () => {
    if (!user?.id || !modalPost || modalLikeBusy) return;
    const currentlyLiked = modalLikedByMe;
    setModalLikeBusy(true);
    setModalLikedByMe(!currentlyLiked);
    patchPostAcrossTabs(modalPost.id, (post) => ({
      ...post,
      likes_count: currentlyLiked ? Math.max(0, post.likes_count - 1) : post.likes_count + 1,
    }));

    if (currentlyLiked) {
      try {
        await apiFetch(`/api/posts/${modalPost.id}/like`, { method: "DELETE" });
      } catch (err) {
        setModalLikedByMe(true);
        patchPostAcrossTabs(modalPost.id, (post) => ({ ...post, likes_count: post.likes_count + 1 }));
        toast({ title: "Error", description: "No se pudo quitar el like." });
      }
      setModalLikeBusy(false);
      return;
    }

    try {
      await apiFetch(`/api/posts/${modalPost.id}/like`, { method: "POST" });
    } catch (err) {
      setModalLikedByMe(false);
      patchPostAcrossTabs(modalPost.id, (post) => ({ ...post, likes_count: Math.max(0, post.likes_count - 1) }));
      toast({ title: "Error", description: "No se pudo dar like." });
    }
    setModalLikeBusy(false);
  }, [modalLikeBusy, modalLikedByMe, modalPost, patchPostAcrossTabs, setModalLikeBusy, setModalLikedByMe, toast, user?.id]);

  const handleModalToggleSave = useCallback(async () => {
    if (!supabase || !user?.id || !modalPost || modalSaveBusy) return;
    const currentlySaved = modalSavedByMe;
    setModalSaveBusy(true);
    setModalSavedByMe(!currentlySaved);

    if (currentlySaved) {
      const { error } = await supabase.from("saved_posts").delete().eq("post_id", modalPost.id).eq("user_id", user.id);
      if (error) {
        setModalSavedByMe(true);
        toast({ title: "Error", description: "No se pudo quitar de guardados." });
      } else if (isOwnProfile) {
        invalidateSavedTab();
      }
      setModalSaveBusy(false);
      return;
    }

    const { error } = await supabase.from("saved_posts").insert({ post_id: modalPost.id, user_id: user.id });
    if (error) {
      setModalSavedByMe(false);
      toast({ title: "Error", description: "No se pudo guardar la publicacion." });
    } else if (isOwnProfile) {
      invalidateSavedTab();
    }
    setModalSaveBusy(false);
  }, [
    invalidateSavedTab,
    isOwnProfile,
    modalPost,
    modalSaveBusy,
    modalSavedByMe,
    setModalSaveBusy,
    setModalSavedByMe,
    supabase,
    toast,
    user?.id,
  ]);

  const handleModalShare = useCallback(async () => {
    if (!modalPost || !profileUsername) return;
    const shareUrl = `${window.location.origin}/p/${modalPost.id}`;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareUrl);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = shareUrl;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
      }
      toast({ title: "Enlace copiado", description: "Listo para compartir." });
    } catch {
      toast({ title: "Error", description: "No se pudo copiar el enlace." });
    }
  }, [modalPost, profileUsername, toast]);

  const focusModalCommentInput = useCallback(() => {
    modalCommentInputRef.current?.focus();
  }, [modalCommentInputRef]);

  const handleModalSubmitComment = useCallback(async () => {
    if (!supabase || !user?.id || !modalPost || modalCommentBusy) return;
    const content = modalCommentInput.trim();
    if (!content) return;
    if (modalPost.comments_enabled === false) {
      toast({ title: "Comentarios desactivados", description: "Esta publicación no acepta comentarios." });
      return;
    }

    const { data: statusRow, error: statusError } = await supabase
      .from("posts")
      .select("comments_enabled")
      .eq("id", modalPost.id)
      .single();
    if (statusError) {
      toast({ title: "Error", description: "No se pudo validar el estado de comentarios." });
      return;
    }
    if (statusRow?.comments_enabled === false) {
      patchPostAcrossTabs(modalPost.id, (post) => ({ ...post, comments_enabled: false }));
      toast({ title: "Comentarios desactivados", description: "Esta publicación no acepta comentarios." });
      return;
    }

    setModalCommentBusy(true);

    let clientCommentId = "";
    try {
      clientCommentId = createClientCommentId();
    } catch {
      toast({ title: "Error", description: "No se pudo generar un ID de comentario." });
      return;
    }
    const activeReplyTarget =
      modalReplyTarget && content.includes(`@${modalReplyTarget.username}`) ? modalReplyTarget : null;
    const optimisticComment: ModalComment = {
      id: clientCommentId,
      user_id: user.id,
      parent_id: activeReplyTarget?.commentId ?? null,
      content,
      created_at: new Date().toISOString(),
      username: user.username,
      full_name: user.full_name,
      avatar_url: user.avatar_url || null,
      likes_count: 0,
      liked_by_me: false,
    };

    setModalCommentInput("");
    setModalCommentsByPost((prev) => ({
      ...prev,
      [modalPost.id]: dedupeAndSortModalComments([...(prev[modalPost.id] ?? []), optimisticComment]),
    }));
    if (activeReplyTarget) {
      setForcedVisibleReplyIdsByParent((prev) => ({
        ...prev,
        [activeReplyTarget.commentId]: [...(prev[activeReplyTarget.commentId] ?? []), clientCommentId],
      }));
    }
    patchPostAcrossTabs(modalPost.id, (post) => ({ ...post, comments_count: post.comments_count + 1 }));

    let commentData: Record<string, unknown> | null = null;
    try {
      const response = await apiFetch(`/api/posts/${modalPost.id}/comment`, {
        method: "POST",
        body: JSON.stringify({
          content,
          parent_id: activeReplyTarget?.commentId ?? null,
          client_id: clientCommentId
        })
      });
      commentData = response?.data;
      if (!commentData) throw new Error("No data returned");
    } catch (err: unknown) {
      setModalCommentsByPost((prev) => ({
        ...prev,
        [modalPost.id]: (prev[modalPost.id] ?? []).filter((comment) => comment.id !== clientCommentId),
      }));
      if (activeReplyTarget) {
        setForcedVisibleReplyIdsByParent((prev) => ({
          ...prev,
          [activeReplyTarget.commentId]: (prev[activeReplyTarget.commentId] ?? []).filter((replyId) => replyId !== clientCommentId),
        }));
      }
      patchPostAcrossTabs(modalPost.id, (post) => ({ ...post, comments_count: Math.max(0, post.comments_count - 1) }));
      const errMessage = err instanceof Error ? err.message : String(err);
      const message = errMessage.toLowerCase();
      const blockedByPolicy = message.includes("row-level security") || message.includes("comments_insert_self") || message.includes("disabled");
      if (blockedByPolicy) {
        patchPostAcrossTabs(modalPost.id, (post) => ({ ...post, comments_enabled: false }));
        toast({ title: "Comentarios desactivados", description: "Esta publicación no acepta comentarios." });
        return;
      }
      toast({ title: "Error", description: "No se pudo publicar el comentario." });
      return;
    }

    setModalCommentsByPost((prev) => ({
      ...prev,
      [modalPost.id]: dedupeAndSortModalComments(
        (prev[modalPost.id] ?? []).map((comment) =>
          comment.id === clientCommentId
            ? {
                ...comment,
                parent_id: (commentData.parent_id as string | null) ?? comment.parent_id,
                created_at: commentData.created_at as string,
              }
            : comment,
        ),
      ),
    }));
    if (activeReplyTarget) {
      setForcedVisibleReplyIdsByParent((prev) => ({
        ...prev,
        [activeReplyTarget.commentId]: prev[activeReplyTarget.commentId] ?? [],
      }));
    }
    setModalReplyTarget(null);
    setModalCommentBusy(false);
  }, [
    createClientCommentId,
    dedupeAndSortModalComments,
    modalCommentBusy,
    modalCommentInput,
    modalPost,
    modalReplyTarget,
    patchPostAcrossTabs,
    setForcedVisibleReplyIdsByParent,
    setModalCommentBusy,
    setModalCommentInput,
    setModalCommentsByPost,
    setModalReplyTarget,
    supabase,
    toast,
    user,
    user?.id,
  ]);

  const handleSetReplyTarget = useCallback(
    (commentId: string, username: string) => {
      const mentionToken = `@${username}`;
      setModalReplyTarget({ commentId, username });
      setModalCommentInput((prev) => {
        const withoutPrevious = modalReplyTarget ? stripLeadingMention(prev, modalReplyTarget.username) : prev;
        const withoutCurrent = stripLeadingMention(withoutPrevious, username).trimStart();
        return `${mentionToken}${withoutCurrent ? ` ${withoutCurrent}` : " "}`;
      });
      requestAnimationFrame(() => {
        const input = modalCommentInputRef.current;
        if (!input) return;
        input.focus();
        const end = input.value.length;
        input.setSelectionRange(end, end);
      });
    },
    [modalCommentInputRef, modalReplyTarget, setModalCommentInput, setModalReplyTarget, stripLeadingMention],
  );

  const handleModalCommentInputChange = useCallback(
    (value: string) => {
      setModalCommentInput(value);
      if (!modalReplyTarget) return;
      const mentionToken = `@${modalReplyTarget.username}`;
      if (!value.includes(mentionToken)) {
        setModalReplyTarget(null);
      }
    },
    [modalReplyTarget, setModalCommentInput, setModalReplyTarget],
  );

  const handleToggleCommentMenu = useCallback(
    (commentId: string) => {
      setOpenCommentMenuId((prev) => (prev === commentId ? null : commentId));
    },
    [setOpenCommentMenuId],
  );

  const handleDeleteComment = useCallback(
    async (commentId: string) => {
      if (!supabase || !user?.id || !modalPost?.id) return;
      const target = modalComments.find((comment) => comment.id === commentId);
      if (!target || target.user_id !== user.id) return;
      if (commentMenuBusyById[commentId]) return;

      setCommentMenuBusyById((prev) => ({ ...prev, [commentId]: true }));
      setOpenCommentMenuId(null);
      const prevComments = modalComments;
      setModalCommentsByPost((prev) => ({
        ...prev,
        [modalPost.id]: (prev[modalPost.id] ?? []).filter((comment) => comment.id !== commentId),
      }));
      patchPostAcrossTabs(modalPost.id, (post) => ({ ...post, comments_count: Math.max(0, post.comments_count - 1) }));

      const { error } = await supabase.from("post_comments").update({ deleted_at: new Date().toISOString() }).eq("id", commentId).eq("user_id", user.id);
      if (error) {
        setModalCommentsByPost((prev) => ({
          ...prev,
          [modalPost.id]: prevComments,
        }));
        patchPostAcrossTabs(modalPost.id, (post) => ({ ...post, comments_count: post.comments_count + 1 }));
        toast({ title: "Error", description: "No se pudo eliminar el comentario." });
      }
      setCommentMenuBusyById((prev) => ({ ...prev, [commentId]: false }));
    },
    [commentMenuBusyById, modalComments, modalPost?.id, patchPostAcrossTabs, setCommentMenuBusyById, setModalCommentsByPost, setOpenCommentMenuId, supabase, toast, user?.id],
  );

  const handleOpenReportCommentModal = useCallback(
    (commentId: string) => {
      if (!user?.id) return;
      const target = modalComments.find((comment) => comment.id === commentId);
      if (!target || target.user_id === user.id) return;
      setOpenCommentMenuId(null);
      setReportCommentId(commentId);
      setReportCommentModalOpen(true);
    },
    [modalComments, setOpenCommentMenuId, setReportCommentId, setReportCommentModalOpen, user?.id],
  );

  const handleReportComment = useCallback(
    async (reason: string) => {
      if (!supabase || !user?.id || !modalPost?.id || !reportCommentId) return;
      if (reportCommentSubmittingReason) return;
      const target = modalComments.find((comment) => comment.id === reportCommentId);
      if (!target || target.user_id === user.id) return;

      setReportCommentSubmittingReason(reason);
      const { error } = await supabase.from("usage_events").insert({
        user_id: user.id,
        event_name: "comment_report",
        event_payload: {
          post_id: modalPost.id,
          comment_id: reportCommentId,
          reported_user_id: target.user_id,
          reason,
          source: "profile_modal",
        },
      });
      if (error) {
        toast({ title: "Error", description: "No se pudo reportar el comentario." });
      } else {
        toast({ title: "Reporte enviado", description: "Gracias por avisar. Revisaremos el comentario." });
        setReportCommentModalOpen(false);
        setReportCommentId(null);
      }
      setReportCommentSubmittingReason(null);
    },
    [
      modalComments,
      modalPost?.id,
      reportCommentId,
      reportCommentSubmittingReason,
      setReportCommentId,
      setReportCommentModalOpen,
      setReportCommentSubmittingReason,
      supabase,
      toast,
      user?.id,
    ],
  );

  const handleToggleRepliesVisibility = useCallback(
    (commentId: string) => {
      setExpandedRepliesByCommentId((prev) => {
        const currentlyExpanded = Boolean(prev[commentId]);
        const nextExpanded = !currentlyExpanded;
        if (!nextExpanded) {
          setForcedVisibleReplyIdsByParent((forcedPrev) => ({
            ...forcedPrev,
            [commentId]: [],
          }));
        }
        return {
          ...prev,
          [commentId]: nextExpanded,
        };
      });
    },
    [setExpandedRepliesByCommentId, setForcedVisibleReplyIdsByParent],
  );

  return {
    handleModalToggleLike,
    handleModalToggleSave,
    handleModalShare,
    focusModalCommentInput,
    handleModalSubmitComment,
    handleSetReplyTarget,
    handleModalCommentInputChange,
    handleToggleCommentMenu,
    handleDeleteComment,
    handleOpenReportCommentModal,
    handleReportComment,
    handleToggleRepliesVisibility,
  };
};
