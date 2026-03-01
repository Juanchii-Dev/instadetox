import { useRef, useState } from "react";

export interface ModalReplyTarget {
  commentId: string;
  username: string;
}

export const useProfilePostModalState = <
  TComment,
  TConnectionUser,
  TModalCommentsCursor,
  TCommentLikesCursor,
>() => {
  const [modalIndex, setModalIndex] = useState<number | null>(null);
  const [modalCommentsByPost, setModalCommentsByPost] = useState<Record<string, TComment[]>>({});
  const [modalCommentsLoading, setModalCommentsLoading] = useState(false);
  const [modalCommentsCursorByPost, setModalCommentsCursorByPost] = useState<Record<string, TModalCommentsCursor | null>>({});
  const [modalCommentsHasMoreByPost, setModalCommentsHasMoreByPost] = useState<Record<string, boolean>>({});
  const [modalCommentsLoadingMoreByPost, setModalCommentsLoadingMoreByPost] = useState<Record<string, boolean>>({});
  const [modalCommentActionBusyById, setModalCommentActionBusyById] = useState<Record<string, boolean>>({});
  const [modalReplyTarget, setModalReplyTarget] = useState<ModalReplyTarget | null>(null);
  const [expandedRepliesByCommentId, setExpandedRepliesByCommentId] = useState<Record<string, boolean>>({});
  const [forcedVisibleReplyIdsByParent, setForcedVisibleReplyIdsByParent] = useState<Record<string, string[]>>({});
  const [commentLikesModalOpen, setCommentLikesModalOpen] = useState(false);
  const [commentLikesModalCommentId, setCommentLikesModalCommentId] = useState<string | null>(null);
  const [commentLikesModalUsers, setCommentLikesModalUsers] = useState<TConnectionUser[]>([]);
  const [commentLikesModalLoading, setCommentLikesModalLoading] = useState(false);
  const [commentLikesModalLoadingMore, setCommentLikesModalLoadingMore] = useState(false);
  const [commentLikesModalHasMore, setCommentLikesModalHasMore] = useState(false);
  const [commentLikesModalCursor, setCommentLikesModalCursor] = useState<TCommentLikesCursor | null>(null);
  const [commentLikesModalActionBusyById, setCommentLikesModalActionBusyById] = useState<Record<string, boolean>>({});
  const [openCommentMenuId, setOpenCommentMenuId] = useState<string | null>(null);
  const [commentMenuBusyById, setCommentMenuBusyById] = useState<Record<string, boolean>>({});
  const [reportCommentModalOpen, setReportCommentModalOpen] = useState(false);
  const [reportCommentId, setReportCommentId] = useState<string | null>(null);
  const [reportCommentSubmittingReason, setReportCommentSubmittingReason] = useState<string | null>(null);
  const [modalCommentInput, setModalCommentInput] = useState("");
  const [modalLikeBusy, setModalLikeBusy] = useState(false);
  const [modalLikedByMe, setModalLikedByMe] = useState(false);
  const [modalSaveBusy, setModalSaveBusy] = useState(false);
  const [modalSavedByMe, setModalSavedByMe] = useState(false);
  const [modalCommentBusy, setModalCommentBusy] = useState(false);

  const modalCommentInputRef = useRef<HTMLInputElement | null>(null);
  const modalCommentsHydratedPostsRef = useRef<Set<string>>(new Set());
  const modalCommentsScrollRef = useRef<HTMLDivElement | null>(null);
  const modalCommentsStickToBottomRef = useRef(true);
  const modalCommentsPrevSizeRef = useRef<{ postId: string; count: number } | null>(null);
  const modalCommentsSuppressAutoScrollRef = useRef(false);
  const commentLikesModalActiveCommentIdRef = useRef<string | null>(null);
  const handledRoutePostKeyRef = useRef<string | null>(null);

  return {
    modalIndex,
    setModalIndex,
    modalCommentsByPost,
    setModalCommentsByPost,
    modalCommentsLoading,
    setModalCommentsLoading,
    modalCommentsCursorByPost,
    setModalCommentsCursorByPost,
    modalCommentsHasMoreByPost,
    setModalCommentsHasMoreByPost,
    modalCommentsLoadingMoreByPost,
    setModalCommentsLoadingMoreByPost,
    modalCommentActionBusyById,
    setModalCommentActionBusyById,
    modalReplyTarget,
    setModalReplyTarget,
    expandedRepliesByCommentId,
    setExpandedRepliesByCommentId,
    forcedVisibleReplyIdsByParent,
    setForcedVisibleReplyIdsByParent,
    commentLikesModalOpen,
    setCommentLikesModalOpen,
    commentLikesModalCommentId,
    setCommentLikesModalCommentId,
    commentLikesModalUsers,
    setCommentLikesModalUsers,
    commentLikesModalLoading,
    setCommentLikesModalLoading,
    commentLikesModalLoadingMore,
    setCommentLikesModalLoadingMore,
    commentLikesModalHasMore,
    setCommentLikesModalHasMore,
    commentLikesModalCursor,
    setCommentLikesModalCursor,
    commentLikesModalActionBusyById,
    setCommentLikesModalActionBusyById,
    openCommentMenuId,
    setOpenCommentMenuId,
    commentMenuBusyById,
    setCommentMenuBusyById,
    reportCommentModalOpen,
    setReportCommentModalOpen,
    reportCommentId,
    setReportCommentId,
    reportCommentSubmittingReason,
    setReportCommentSubmittingReason,
    modalCommentInput,
    setModalCommentInput,
    modalLikeBusy,
    setModalLikeBusy,
    modalLikedByMe,
    setModalLikedByMe,
    modalSaveBusy,
    setModalSaveBusy,
    modalSavedByMe,
    setModalSavedByMe,
    modalCommentBusy,
    setModalCommentBusy,
    modalCommentInputRef,
    modalCommentsHydratedPostsRef,
    modalCommentsScrollRef,
    modalCommentsStickToBottomRef,
    modalCommentsPrevSizeRef,
    modalCommentsSuppressAutoScrollRef,
    commentLikesModalActiveCommentIdRef,
    handledRoutePostKeyRef,
  };
};

