import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useRoute, useParams } from "wouter";
import { useAuth } from "@/lib/AuthContext";
import { supabase } from "@/lib/supabase";
import { useProfileCommentLikesActions } from "@/hooks/useProfileCommentLikesActions";
import { useProfileAvatarActions } from "@/hooks/useProfileAvatarActions";
import { useProfileConnections, type ProfileConnectionUser } from "@/hooks/useProfileConnections";
import { useProfileDataBootstrap } from "@/hooks/useProfileDataBootstrap";
import { useProfileFollowActions } from "@/hooks/useProfileFollowActions";
import { useProfileRealtimeBridge } from "@/hooks/useProfileRealtimeBridge";
import { useProfileRealtimeHelpers } from "@/hooks/useProfileRealtimeHelpers";
import { useProfilePostModalLifecycle } from "@/hooks/useProfilePostModalLifecycle";
import { useProfileModalCommentsData } from "@/hooks/useProfileModalCommentsData";
import { useProfilePostRouteBootstrap } from "@/hooks/useProfilePostRouteBootstrap";
import { useProfileTabsData } from "@/hooks/useProfileTabsData";
import { useToast } from "@/hooks/use-toast";
import { useProfilePostModalActions } from "@/hooks/useProfilePostModalActions";
import { useProfilePostModalState } from "@/hooks/useProfilePostModalState";
import { useProfilePageActions } from "@/hooks/useProfilePageActions";
import { useProfilePageLifecycle } from "@/hooks/useProfilePageLifecycle";
import { useProfileSecondaryModals } from "@/hooks/useProfileSecondaryModals";
import {
  useProfileTabsState,
  type ProfileTab,
} from "@/hooks/useProfileTabsState";
import { setPostRouteSnapshot } from "@/lib/postRouteCache";
import {
  formatCompact,
  getOptimizedImageUrl,
  isVideoUrl,
  createClientCommentId,
  formatRelativeTime,
  parseMediaList,
  stripLeadingMention
} from "@/lib/profileUtils";
import ProfileHeaderSection from "@/components/profile/ProfileHeaderSection";
import ProfilePageState from "@/components/profile/ProfilePageState";
import ProfileTabs from "@/components/profile/ProfileTabs";
import ProfilePostsGrid from "@/components/profile/ProfilePostsGrid";
import ReportCommentModal from "@/components/profile/ReportCommentModal";
import CommentLikesModal from "@/components/profile/CommentLikesModal";
import ProfileConnectionsModal from "@/components/profile/ProfileConnectionsModal";
import ProfileAvatarOptionsModal from "@/components/profile/ProfileAvatarOptionsModal";
import ProfilePostModal from "@/components/profile/ProfilePostModal";

interface ProfileRow {
  id: string;
  username: string;
  full_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  is_private?: boolean | null;
}

interface ProfilePost {
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

interface ModalCommentsCursor {
  oldestCreatedAt: string;
  oldestId: string;
}
interface CommentLikesCursor {
  createdAt: string;
  userId: string;
}

const PAGE_SIZE = 18;
const MODAL_COMMENTS_PAGE_SIZE = 24;
const COMMENT_LIKERS_PAGE_SIZE = 30;
const COMMENT_REPORT_REASONS = [
  "Simplemente no me gusta",
  "Bullying o contacto no deseado",
  "Suicidio, autolesion o trastornos alimentarios",
  "Desnudos o actividad sexual",
  "Lenguaje o simbolos que incitan al odio",
  "Violencia o explotacion",
  "Venta o promocion de articulos restringidos",
  "Estafa, fraude o spam",
  "Informacion falsa",
] as const;

const compareModalCommentsAsc = (a: ModalComment, b: ModalComment) => {
  const byDate = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
  if (byDate !== 0) return byDate;
  return a.id.localeCompare(b.id);
};

const dedupeAndSortModalComments = (comments: ModalComment[]) => {
  const byId = new Map<string, ModalComment>();
  comments.forEach((comment) => {
    byId.set(comment.id, comment);
  });
  return Array.from(byId.values()).sort(compareModalCommentsAsc);
};

const Profile = () => {
  const { user, updateUserProfile } = useAuth();
  const { toast } = useToast();
  const notify = useCallback(
    ({ title, description }: { title: string; description: string }) => {
      toast({ title, description });
    },
    [toast],
  );
  const [, setLocation] = useLocation();
  const [isPublicRouteMatch, params] = useRoute<{ username: string }>("/:username");
  const [isSavedRouteMatch, savedParams] = useRoute<{ username: string }>("/:username/saved");
  const [isPostRouteMatch, postRouteParams] = useRoute<{ postId: string }>("/p/:postId");
  const [resolvedPostRouteUsername, setResolvedPostRouteUsername] = useState<string | null>(null);
  const [postRouteResolutionDone, setPostRouteResolutionDone] = useState(false);
  const [profileData, setProfileData] = useState<ProfileRow | null>(null);
  const {
    tabState,
    setTabState,
    tabStateRef,
    prefetchedPageRef,
    prefetchingRef,
    resetTabsState,
  } = useProfileTabsState<ProfilePost>();
  const [postCount, setPostCount] = useState(0);
  const [followers, setFollowers] = useState(0);
  const [following, setFollowing] = useState(0);
  const [isFollowing, setIsFollowing] = useState(false);
  const [isFollowPending, setIsFollowPending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<ProfileTab>("posts");
  const [detoxDays, setDetoxDays] = useState(0);

  // Efecto para sincronizar el tab activo con la URL
  useEffect(() => {
    if (isSavedRouteMatch) {
      setActiveTab("saved");
    } else if (isPublicRouteMatch && !isSavedRouteMatch) {
      setActiveTab("posts");
    }
  }, [isSavedRouteMatch, isPublicRouteMatch]);
  const {
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
    modalCommentBusy,
    setModalCommentBusy,
    modalLikeBusy,
    setModalLikeBusy,
    modalLikedByMe,
    setModalLikedByMe,
    modalSaveBusy,
    setModalSaveBusy,
    modalSavedByMe,
    setModalSavedByMe,
    modalCommentInputRef,
    modalCommentsHydratedPostsRef,
    modalCommentsScrollRef,
    modalCommentsStickToBottomRef,
    modalCommentsPrevSizeRef,
    modalCommentsSuppressAutoScrollRef,
    commentLikesModalActiveCommentIdRef,
    handledRoutePostKeyRef,
  } = useProfilePostModalState<ModalComment, ProfileConnectionUser, ModalCommentsCursor, CommentLikesCursor>();
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const supportsHoverPrefetch = useMemo(
    () => typeof window !== "undefined" && window.matchMedia("(hover: hover) and (pointer: fine)").matches,
    [],
  );

  const targetUsername = useMemo(() => {
    if (isPostRouteMatch) return resolvedPostRouteUsername;
    if (isPublicRouteMatch && params?.username) return params.username;
    return user?.username ?? null;
  }, [isPostRouteMatch, resolvedPostRouteUsername, isPublicRouteMatch, params?.username, user?.username]);


  const setActiveTabPosts = useCallback(() => {
    setActiveTab("posts");
  }, []);

  const handleTabChange = useCallback((tab: ProfileTab) => {
    const username = profileData?.username ?? targetUsername ?? user?.username;
    if (!username) return;

    if (tab === "saved") {
      setLocation(`/${username}/saved`);
    } else if (tab === "posts") {
      setLocation(`/${username}`);
    } else {
      // Para "tagged" y otros tabs, solo actualizar estado local por ahora
      setActiveTab(tab);
    }
  }, [profileData?.username, targetUsername, user?.username, setLocation]);
  const isOwnProfile = Boolean(profileData?.id && user?.id && profileData.id === user.id);
  const isPrivateProfile = Boolean(profileData?.is_private);
  const canViewPrivateContent = isOwnProfile || isFollowing || !isPrivateProfile;

  const {
    connectionsOpen,
    setConnectionsOpen,
    connectionsType,
    connectionsLoading,
    connectionsQuery,
    setConnectionsQuery,
    connectionActionLoadingById,
    connectionSuggestions,
    filteredConnections,
    openConnectionsModal,
    handleConnectionToggleFollow,
    handleRemoveFollower,
  } = useProfileConnections({
    supabase,
    userId: user?.id,
    profileDataId: profileData?.id,
    isOwnProfile,
    setFollowers,
    setFollowing,
    toast: notify,
  });

  const {
    avatarInputRef,
    avatarBusy,
    isAvatarOptionsOpen,
    handleOpenAvatarOptions,
    handleCloseAvatarOptions,
    handlePickAvatarFile,
    handleAvatarFileChange,
    handleRemoveAvatar,
  } = useProfileAvatarActions<ProfileRow>({
    supabase,
    userId: user?.id,
    profileDataId: profileData?.id,
    profileAvatarUrl: profileData?.avatar_url,
    isOwnProfile,
    setProfileData,
    updateUserProfile,
    toast: notify,
  });

  const { localFollowOpsRef, patchPostAcrossTabs, hasPostLoaded, ensureProfileCache } = useProfileRealtimeHelpers<ProfilePost>({
    supabase,
    setTabState,
    tabStateRef,
  });

  const { followLoading, handleToggleFollow } = useProfileFollowActions({
    supabase,
    userId: user?.id,
    profileDataId: profileData?.id,
    profileUsername: profileData?.username,
    isOwnProfile,
    isPrivateProfile,
    isFollowing,
    isFollowPending,
    setIsFollowing,
    setIsFollowPending,
    setFollowers,
    localFollowOpsRef,
  });

  useProfileDataBootstrap<ProfileRow>({
    supabase,
    userId: user?.id,
    authUsername: user?.username,
    authFullName: user?.full_name,
    authAvatarUrl: user?.avatar_url,
    isPostRouteMatch,
    targetUsername,
    resetTabsState,
    setActiveTabPosts,
    setProfileData,
    setPostCount,
    setFollowers,
    setFollowing,
    setIsFollowing,
    setIsFollowPending,
    setLoading,
  });

  const closePostModal = useCallback(() => {
    setModalIndex(null);
    if (isPostRouteMatch) {
      if (window.history.length > 1) {
        window.history.back();
      } else {
        setLocation("/inicio");
      }
      return;
    }
    const currentUrl = new URL(window.location.href);
    if (currentUrl.searchParams.has("post")) {
      currentUrl.searchParams.delete("post");
      window.history.replaceState({}, "", `${currentUrl.pathname}${currentUrl.search}${currentUrl.hash}`);
    }
  }, [isPostRouteMatch, profileData?.username, setLocation, user?.username]);

  const { loadTabPage, prefetchNextPage } = useProfileTabsData<ProfilePost>({
    supabase,
    profileId: profileData?.id,
    targetUsername,
    pageSize: PAGE_SIZE,
    setTabState,
    tabStateRef,
    prefetchedPageRef,
    prefetchingRef,
  });

  useProfilePostRouteBootstrap<ProfilePost, ProfileRow>({
    supabase,
    isPostRouteMatch,
    routePostId: postRouteParams?.postId,
    userUsername: user?.username,
    resolvedPostRouteUsername,
    setResolvedPostRouteUsername,
    setPostRouteResolutionDone,
    setProfileData,
    setActiveTabPosts,
    setTabState,
    setModalIndex,
    setLoading,
  });

  const activeTabPosts = tabState[activeTab].items;
  const modalPost = modalIndex !== null ? activeTabPosts[modalIndex] ?? null : null;
  const routePostId = isPostRouteMatch ? postRouteParams?.postId ?? null : null;
  const waitingPostRouteModal = Boolean(
    isPostRouteMatch && routePostId && postRouteResolutionDone && resolvedPostRouteUsername && modalIndex === null,
  );
  const modalComments = modalPost ? modalCommentsByPost[modalPost.id] ?? [] : [];
  const modalCommentsHasMore = modalPost ? Boolean(modalCommentsHasMoreByPost[modalPost.id]) : false;
  const modalCommentsLoadingMore = modalPost ? Boolean(modalCommentsLoadingMoreByPost[modalPost.id]) : false;
  const modalTopLevelComments = useMemo(
    () => modalComments.filter((comment) => !comment.parent_id),
    [modalComments],
  );
  const modalRepliesByParentId = useMemo(() => {
    const map = new Map<string, ModalComment[]>();
    modalComments.forEach((comment) => {
      if (!comment.parent_id) return;
      const list = map.get(comment.parent_id) ?? [];
      list.push(comment);
      map.set(comment.parent_id, list);
    });
    return map;
  }, [modalComments]);

  const warmProfilePostRouteSnapshot = useCallback(
    (post: ProfilePost) => {
      if (!profileData) return;
      setPostRouteSnapshot({
        id: post.id,
        user_id: profileData.id,
        username: profileData.username,
        full_name: profileData.full_name,
        avatar_url: profileData.avatar_url,
        title: post.title ?? null,
        caption: post.caption,
        media_url: post.media_url ?? null,
        mentions: post.mentions ?? null,
        likes_count: post.likes_count,
        comments_count: post.comments_count,
        comments_enabled: post.comments_enabled !== false,
        created_at: post.created_at,
      });
    },
    [profileData],
  );

  useProfilePageLifecycle<ProfilePost, ProfileTab>({
    isPostRouteMatch,
    targetUsername,
    profileData,
    postCount,
    followers,
    following,
    isFollowing,
    isFollowPending,
    canViewPosts: canViewPrivateContent,
    activeTab,
    activeTabState: tabState[activeTab],
    activeTabPosts,
    loadTabPage,
    prefetchNextPage,
    tabStateRef,
    loadMoreRef,
    setDetoxDays,
    warmProfilePostRouteSnapshot,
  });

  const { loadModalPostState, loadOlderModalComments } = useProfileModalCommentsData<ModalComment, ModalCommentsCursor>({
    supabase,
    userId: user?.id,
    commentsPageSize: MODAL_COMMENTS_PAGE_SIZE,
    toast: notify,
    dedupeAndSortModalComments,
    modalCommentsHydratedPostsRef,
    modalCommentsScrollRef,
    modalCommentsSuppressAutoScrollRef,
    modalCommentsCursorByPost,
    modalCommentsLoadingMoreByPost,
    setModalCommentsLoading,
    setModalLikedByMe,
    setModalSavedByMe,
    setModalCommentsByPost,
    setModalCommentsCursorByPost,
    setModalCommentsHasMoreByPost,
    setModalCommentsLoadingMoreByPost,
  });

  const invalidateSavedTab = useCallback(() => {
    setTabState((prev) => ({
      ...prev,
      saved: { ...prev.saved, initialized: false, hasMore: true, page: 0, items: [] },
    }));
  }, [setTabState]);

  const {
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
  } = useProfilePostModalActions({
    supabase,
    user: user
      ? {
          id: user.id,
          username: user.username,
          full_name: user.full_name,
          avatar_url: user.avatar_url || null,
        }
      : null,
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
    profileUsername: profileData?.username,
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
  });

  const {
    loadCommentLikesModalPage,
    handleOpenCommentLikesModal,
    handleCommentLikesModalToggleFollow,
    handleToggleCommentLike,
  } = useProfileCommentLikesActions({
    supabase,
    user: user
      ? {
          id: user.id,
          username: user.username,
          full_name: user.full_name,
          avatar_url: user.avatar_url || null,
        }
      : null,
    modalPostId: modalPost?.id,
    modalComments,
    modalCommentActionBusyById,
    commentLikesModalOpen,
    commentLikesModalCommentId,
    commentLikesModalUsers,
    commentLikesModalActionBusyById,
    commentLikesModalActiveCommentIdRef,
    setCommentLikesModalOpen,
    setCommentLikesModalCommentId,
    setCommentLikesModalUsers,
    setCommentLikesModalLoading,
    setCommentLikesModalLoadingMore,
    setCommentLikesModalHasMore,
    setCommentLikesModalCursor,
    setCommentLikesModalActionBusyById,
    setModalCommentActionBusyById,
    setModalCommentsByPost,
    toast,
  });

  const {
    closeCommentLikesModal,
    closeReportCommentModal,
    handleLoadMoreCommentLikesFromModal,
  } = useProfileSecondaryModals<CommentLikesCursor, ProfileConnectionUser>({
    connectionsOpen,
    setConnectionsOpen,
    commentLikesModalCommentId,
    commentLikesModalLoadingMore,
    commentLikesModalCursor,
    commentLikesModalActiveCommentIdRef,
    reportCommentSubmittingReason,
    setCommentLikesModalOpen,
    setCommentLikesModalCommentId,
    setCommentLikesModalUsers,
    setCommentLikesModalLoading,
    setCommentLikesModalLoadingMore,
    setCommentLikesModalHasMore,
    setCommentLikesModalCursor,
    setCommentLikesModalActionBusyById,
    setReportCommentModalOpen,
    setReportCommentId,
    loadCommentLikesModalPage,
  });

  const { handleModalCommentsScroll } = useProfilePostModalLifecycle<ProfilePost>({
    modalIndex,
    setModalIndex,
    closePostModal,
    activeTabPosts,
    closeCommentLikesModal,
    isPostRouteMatch,
    routePostId: postRouteParams?.postId ?? null,
    targetUsername,
    handledRoutePostKeyRef,
    openCommentMenuId,
    setOpenCommentMenuId,
    modalPostId: modalPost?.id ?? null,
    modalCommentsLength: modalComments.length,
    setModalCommentInput,
    setModalReplyTarget,
    setExpandedRepliesByCommentId,
    setForcedVisibleReplyIdsByParent,
    setReportCommentModalOpen,
    setReportCommentId,
    setReportCommentSubmittingReason,
    loadModalPostState,
    modalCommentsHydratedPostsRef,
    modalCommentsScrollRef,
    modalCommentsStickToBottomRef,
    modalCommentsPrevSizeRef,
    modalCommentsSuppressAutoScrollRef,
  });

  useProfileRealtimeBridge({
    supabase,
    profileDataId: profileData?.id,
    modalPostId: modalPost?.id,
    userId: user?.id,
    localFollowOpsRef,
    hasPostLoaded,
    ensureProfileCache,
    patchPostAcrossTabs,
    dedupeAndSortModalComments,
    setProfileData,
    setPostCount,
    setTabState,
    setModalCommentsByPost,
    setFollowers,
    setIsFollowing,
    setIsFollowPending,
    setFollowing,
  });
  const {
    handleHeaderEditProfile,
    handleHeaderOpenSettings,
    handleOpenPostFromGrid,
    handlePrevModalPost,
    handleNextModalPost,
    handleCloseConnectionsModal,
    handleAvatarInputChange,
  } = useProfilePageActions<ProfilePost>({
    activeTabPosts,
    setLocation,
    setModalIndex,
    setConnectionsOpen,
    warmProfilePostRouteSnapshot,
    handleAvatarFileChange,
    notify,
  });

  const waitingPostRouteBootstrap = Boolean(isPostRouteMatch && !postRouteResolutionDone && !profileData);

  if ((!isPostRouteMatch && loading) || waitingPostRouteModal || waitingPostRouteBootstrap) {
    return <ProfilePageState mode="loading" isPostRouteMatch={isPostRouteMatch} />;
  }

  if (!profileData) {
    return <ProfilePageState mode="not-found" />;
  }

  const activeTabMeta = tabState[activeTab];

  return (
    <div className="inst-profile-page animate-in fade-in duration-500">
      <div className="inst-profile-shell">
        <ProfileHeaderSection
          username={profileData.username}
          fullName={profileData.full_name}
          bio={profileData.bio}
          website={isOwnProfile ? user?.website ?? null : null}
          avatarUrl={profileData.avatar_url}
          postCountLabel={formatCompact(postCount)}
          followersLabel={formatCompact(followers)}
          followingLabel={formatCompact(following)}
          detoxDays={detoxDays}
          isOwnProfile={isOwnProfile}
          isFollowing={isFollowing}
          isFollowPending={isFollowPending}
          canOpenConnections={canViewPrivateContent}
          followLoading={followLoading}
          avatarBusy={avatarBusy}
          onAvatarClick={handleOpenAvatarOptions}
          onOpenFollowers={() => {
            if (!canViewPrivateContent) return;
            openConnectionsModal("followers");
          }}
          onOpenFollowing={() => {
            if (!canViewPrivateContent) return;
            openConnectionsModal("following");
          }}
          onToggleFollow={() => void handleToggleFollow()}
          onEditProfile={handleHeaderEditProfile}
          onOpenSettings={handleHeaderOpenSettings}
        />

        {canViewPrivateContent ? (
          <>
            <ProfileTabs activeTab={activeTab} onChangeTab={handleTabChange} />

            <ProfilePostsGrid
              posts={activeTabPosts}
              activeTab={activeTab}
              loadingInitial={!activeTabMeta.initialized && activeTabMeta.loading}
              loadingMore={activeTabMeta.loading && activeTabMeta.initialized}
              formatCompact={formatCompact}
              parseMediaList={parseMediaList}
              isVideoUrl={isVideoUrl}
              supportsHoverPrefetch={supportsHoverPrefetch}
              onWarmPost={warmProfilePostRouteSnapshot}
              onOpenPost={handleOpenPostFromGrid}
            />

            <div ref={loadMoreRef} className="h-10 w-full" />
          </>
        ) : (
          <section className="mt-8 border-t border-white/10 pt-10 pb-12 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full border border-white/35 text-white">
              <svg aria-hidden="true" viewBox="0 0 24 24" className="h-8 w-8" fill="none" stroke="currentColor" strokeWidth="1.8">
                <rect x="5" y="11" width="14" height="10" rx="2" />
                <path d="M8 11V8a4 4 0 1 1 8 0v3" />
              </svg>
            </div>
            <h2 className="text-lg font-semibold text-white">Esta cuenta es privada</h2>
            <p className="mt-1 text-sm text-gray-300">Sigue esta cuenta para ver sus fotos y videos.</p>
          </section>
        )}
      </div>

      <ProfilePostModal
        modalPost={modalPost}
        profileData={profileData}
        activeTabPostsLength={activeTabPosts.length}
        modalCommentsScrollRef={modalCommentsScrollRef}
        modalCommentInputRef={modalCommentInputRef}
        modalCommentsLoading={modalCommentsLoading}
        modalComments={modalComments}
        modalCommentsHasMore={modalCommentsHasMore}
        modalCommentsLoadingMore={modalCommentsLoadingMore}
        modalRepliesByParentId={modalRepliesByParentId}
        modalTopLevelComments={modalTopLevelComments}
        expandedRepliesByCommentId={expandedRepliesByCommentId}
        forcedVisibleReplyIdsByParent={forcedVisibleReplyIdsByParent}
        openCommentMenuId={openCommentMenuId}
        commentMenuBusyById={commentMenuBusyById}
        modalCommentActionBusyById={modalCommentActionBusyById}
        currentUserId={user?.id}
        modalLikeBusy={modalLikeBusy}
        modalLikedByMe={modalLikedByMe}
        modalSaveBusy={modalSaveBusy}
        modalSavedByMe={modalSavedByMe}
        modalCommentInput={modalCommentInput}
        parseMediaList={parseMediaList}
        isVideoUrl={isVideoUrl}
        formatRelativeTime={formatRelativeTime}
        formatCompact={formatCompact}
        onClose={closePostModal}
        onPrev={handlePrevModalPost}
        onNext={handleNextModalPost}
        onCommentsScroll={handleModalCommentsScroll}
        onLoadOlderComments={loadOlderModalComments}
        onOpenCommentLikesModal={handleOpenCommentLikesModal}
        onSetReplyTarget={handleSetReplyTarget}
        onToggleCommentMenu={handleToggleCommentMenu}
        onDeleteComment={handleDeleteComment}
        onOpenReportCommentModal={handleOpenReportCommentModal}
        onToggleRepliesVisibility={handleToggleRepliesVisibility}
        onToggleCommentLike={handleToggleCommentLike}
        onToggleLike={handleModalToggleLike}
        onFocusCommentInput={focusModalCommentInput}
        onShare={handleModalShare}
        onToggleSave={handleModalToggleSave}
        onCommentInputChange={handleModalCommentInputChange}
        onSubmitComment={handleModalSubmitComment}
      />

      <ReportCommentModal
        open={reportCommentModalOpen}
        reportReasons={COMMENT_REPORT_REASONS}
        submittingReason={reportCommentSubmittingReason}
        onClose={closeReportCommentModal}
        onReport={handleReportComment}
      />

      <CommentLikesModal
        open={commentLikesModalOpen}
        users={commentLikesModalUsers}
        loading={commentLikesModalLoading}
        loadingMore={commentLikesModalLoadingMore}
        hasMore={commentLikesModalHasMore}
        hasCursor={Boolean(commentLikesModalCursor)}
        commentId={commentLikesModalCommentId}
        currentUserId={user?.id}
        actionBusyById={commentLikesModalActionBusyById}
        onClose={closeCommentLikesModal}
        onToggleFollow={handleCommentLikesModalToggleFollow}
        onLoadMore={handleLoadMoreCommentLikesFromModal}
      />

      <ProfileConnectionsModal
        open={connectionsOpen}
        type={connectionsType}
        loading={connectionsLoading}
        query={connectionsQuery}
        filteredConnections={filteredConnections}
        suggestions={connectionSuggestions}
        actionLoadingById={connectionActionLoadingById}
        isOwnProfile={isOwnProfile}
        currentUserId={user?.id}
        onClose={handleCloseConnectionsModal}
        onQueryChange={setConnectionsQuery}
        onToggleFollow={handleConnectionToggleFollow}
        onRemoveFollower={handleRemoveFollower}
      />

      <input
        ref={avatarInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleAvatarInputChange}
      />

      <ProfileAvatarOptionsModal
        open={isAvatarOptionsOpen}
        busy={avatarBusy}
        hasAvatar={Boolean(profileData?.avatar_url)}
        onClose={handleCloseAvatarOptions}
        onPickFile={handlePickAvatarFile}
        onRemoveAvatar={handleRemoveAvatar}
      />
    </div>
  );
};

export default Profile;
