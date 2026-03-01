import { useEffect, useMemo, useState } from "react";
import FeedPostHeader from "@/components/feed/FeedPostHeader";
import FeedPostMedia from "@/components/feed/FeedPostMedia";
import FeedPostFooter from "@/components/feed/FeedPostFooter";
import { parseMediaList, shortTimeAgo } from "@/components/feed/feedPostUtils";
import type { FeedPostCardRow, FeedPostComment } from "@/components/feed/feedPostTypes";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { prefetchProfileRouteSnapshot } from "@/lib/profileRouteCache";

export type { FeedPostCardRow, FeedPostComment } from "@/components/feed/feedPostTypes";

interface FeedPostCardProps {
  post: FeedPostCardRow;
  currentUserId?: string;
  contextLabel?: string | null;
  isFollowingAuthor: boolean;
  isFollowPendingAuthor: boolean;
  isFavoriteAuthor: boolean;
  followLoading: boolean;
  isSaved: boolean;
  commentsOpen: boolean;
  comments: FeedPostComment[];
  commentInput: string;
  onToggleFollow: (authorId: string) => Promise<void> | void;
  onToggleLike: () => void;
  onToggleSave: () => void;
  onToggleComments: () => void;
  onShare: () => void;
  onCommentInputChange: (value: string) => void;
  onSubmitComment: () => void;
  onOpenPost: () => void;
  onWarmRoute?: () => void;
  onWarmProfileRoute?: () => void;
  onDeletePost: (postId: string) => Promise<boolean>;
  onReportPost: (postId: string, reportedUserId: string, reason: string) => Promise<boolean>;
  onToggleFavoriteAuthor: (authorId: string) => Promise<boolean>;
  onToggleHideLikeCount: (postId: string, nextValue: boolean) => Promise<boolean>;
  onToggleCommentsEnabled: (postId: string, nextValue: boolean) => Promise<boolean>;
  onEditPostCaption: (postId: string, nextCaption: string) => Promise<boolean>;
}

const FeedPostCard = ({
  post,
  currentUserId,
  contextLabel,
  isFollowingAuthor,
  isFollowPendingAuthor,
  isFavoriteAuthor,
  followLoading,
  isSaved,
  commentsOpen,
  comments,
  commentInput,
  onToggleFollow,
  onToggleLike,
  onToggleSave,
  onToggleComments,
  onShare,
  onCommentInputChange,
  onSubmitComment,
  onOpenPost,
  onWarmRoute,
  onWarmProfileRoute,
  onDeletePost,
  onReportPost,
  onToggleFavoriteAuthor,
  onToggleHideLikeCount,
  onToggleCommentsEnabled,
  onEditPostCaption,
}: FeedPostCardProps) => {
  const [activeMediaIndex, setActiveMediaIndex] = useState(0);
  const [isMuted, setIsMuted] = useState(true);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [menuBusy, setMenuBusy] = useState(false);
  const [editingCaption, setEditingCaption] = useState(false);
  const [captionDraft, setCaptionDraft] = useState(post.caption ?? "");
  const mediaItems = useMemo(() => parseMediaList(post.media_url), [post.media_url]);
  const isOwnPost = Boolean(currentUserId && post.user_id === currentUserId);
  const publishedAgo = useMemo(() => shortTimeAgo(post.created_at), [post.created_at]);
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const commentsEnabled = post.comments_enabled !== false;
  const hideLikeCount = Boolean(post.hide_like_count);
  const postUrl = `${window.location.origin}/p/${post.id}`;

  useEffect(() => {
    setCaptionDraft(post.caption ?? "");
  }, [post.caption, post.id]);

  const goPrevMedia = () => {
    if (mediaItems.length <= 1) return;
    setActiveMediaIndex((prev) => (prev - 1 + mediaItems.length) % mediaItems.length);
  };

  const goNextMedia = () => {
    if (mediaItems.length <= 1) return;
    setActiveMediaIndex((prev) => (prev + 1) % mediaItems.length);
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(postUrl);
      toast({ title: "Enlace copiado", description: "Se copio el enlace de la publicacion." });
      setOptionsOpen(false);
    } catch {
      toast({ title: "Error", description: "No se pudo copiar el enlace." });
    }
  };

  const handleCopyEmbed = async () => {
    const embed = `<blockquote class=\"instadetox-embed\" data-post-id=\"${post.id}\"><a href=\"${postUrl}\">Ver publicacion</a></blockquote>`;
    try {
      await navigator.clipboard.writeText(embed);
      toast({ title: "Insertar", description: "Codigo de insercion copiado." });
      setOptionsOpen(false);
    } catch {
      toast({ title: "Error", description: "No se pudo copiar el codigo." });
    }
  };

  const handleToggleFollowFromMenu = async () => {
    if (isOwnPost) return;
    if (!isFollowingAuthor && !isFollowPendingAuthor) {
      toast({ title: "Info", description: "No sigues a esta cuenta." });
      setOptionsOpen(false);
      return;
    }
    setMenuBusy(true);
    try {
      await onToggleFollow(post.user_id);
      setOptionsOpen(false);
    } finally {
      setMenuBusy(false);
    }
  };

  const handleDeletePost = async () => {
    if (!isOwnPost || menuBusy) return;
    setMenuBusy(true);
    try {
      const ok = await onDeletePost(post.id);
      if (ok) setOptionsOpen(false);
    } finally {
      setMenuBusy(false);
    }
  };

  const handleReportPost = async () => {
    if (menuBusy) return;
    setMenuBusy(true);
    try {
      const ok = await onReportPost(post.id, post.user_id, "menu_report");
      if (ok) setOptionsOpen(false);
    } finally {
      setMenuBusy(false);
    }
  };

  const handleToggleFavorite = async () => {
    if (menuBusy) return;
    setMenuBusy(true);
    try {
      await onToggleFavoriteAuthor(post.user_id);
      setOptionsOpen(false);
    } finally {
      setMenuBusy(false);
    }
  };

  const handleToggleHideLikes = async () => {
    if (!isOwnPost || menuBusy) return;
    setMenuBusy(true);
    try {
      const ok = await onToggleHideLikeCount(post.id, !hideLikeCount);
      if (ok) setOptionsOpen(false);
    } finally {
      setMenuBusy(false);
    }
  };

  const handleToggleCommentsAvailability = async () => {
    if (!isOwnPost || menuBusy) return;
    setMenuBusy(true);
    try {
      const ok = await onToggleCommentsEnabled(post.id, !commentsEnabled);
      if (ok) setOptionsOpen(false);
    } finally {
      setMenuBusy(false);
    }
  };

  const handleSaveCaption = async () => {
    const nextCaption = captionDraft.trim();
    if (!nextCaption || nextCaption === post.caption) {
      setEditingCaption(false);
      return;
    }
    setMenuBusy(true);
    try {
      const ok = await onEditPostCaption(post.id, nextCaption);
      if (ok) {
        setEditingCaption(false);
        setOptionsOpen(false);
      }
    } finally {
      setMenuBusy(false);
    }
  };

  return (
    <article className="ig-feed-card" onMouseEnter={() => onWarmRoute?.()} onFocusCapture={() => onWarmRoute?.()}>
      <FeedPostHeader
        username={post.username}
        avatarUrl={post.avatar_url}
        publishedAgo={publishedAgo}
        contextLabel={contextLabel}
        isOwnPost={isOwnPost}
        isFollowingAuthor={isFollowingAuthor}
        isFollowPendingAuthor={isFollowPendingAuthor}
        followLoading={followLoading}
        onWarmProfileRoute={onWarmProfileRoute}
        onToggleFollow={() => onToggleFollow(post.user_id)}
        onOpenOptions={() => setOptionsOpen(true)}
      />

      <FeedPostMedia
        mediaList={mediaItems}
        activeMediaIndex={activeMediaIndex}
        onPrev={goPrevMedia}
        onNext={goNextMedia}
        onSelect={setActiveMediaIndex}
        isMuted={isMuted}
        onToggleMute={() => setIsMuted((prev) => !prev)}
        caption={post.caption}
        onDoubleTap={!post.likedByMe ? onToggleLike : undefined}
        likedByMe={Boolean(post.likedByMe)}
      />

      <FeedPostFooter
        username={post.username}
        caption={post.caption}
        mentions={post.mentions}
        likedByMe={Boolean(post.likedByMe)}
        isSaved={isSaved}
        likesCount={post.likes_count}
        commentsCount={post.comments_count}
        hideLikeCount={hideLikeCount}
        onWarmProfileRoute={onWarmProfileRoute}
        onToggleLike={onToggleLike}
        onOpenPost={onOpenPost}
        onShare={onShare}
        onToggleSave={onToggleSave}
      />

      {commentsOpen ? (
        <div className="ig-post-inline-comments">
          <div className="ig-post-inline-comments-list">
            {comments.length === 0 ? (
              <p className="text-xs text-gray-400">Sin comentarios aun.</p>
            ) : (
              comments.map((comment) => (
                <div key={comment.id} className="frosted rounded-lg px-3 py-2">
                  <p className="text-xs text-gray-400">{comment.user_id.slice(0, 8)}</p>
                  <p className="text-sm text-white whitespace-pre-line">{comment.content}</p>
                </div>
              ))
            )}
          </div>

          {commentsEnabled ? (
            <div className="ig-post-inline-composer">
              <input
                value={commentInput}
                onChange={(e) => onCommentInputChange(e.target.value)}
                placeholder="Agrega un comentario..."
                className="frosted flex-1 rounded-lg px-3 py-2 text-white placeholder:text-gray-400"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    onSubmitComment();
                  }
                }}
              />
              <button onClick={onSubmitComment} className="text-cyan-300 hover:text-cyan-200 px-2 text-sm font-semibold">
                Publicar
              </button>
              <button onClick={onToggleComments} className="text-xs text-gray-400 hover:text-gray-300">
                Ocultar
              </button>
            </div>
          ) : (
            <div className="ig-post-inline-composer">
              <p className="text-xs text-gray-400">Los comentarios estan desactivados para esta publicacion.</p>
              <button onClick={onToggleComments} className="text-xs text-gray-400 hover:text-gray-300 ml-auto">
                Ocultar
              </button>
            </div>
          )}
        </div>
      ) : null}

      {optionsOpen ? (
        <div className="ig-post-options-overlay" onClick={() => (menuBusy ? null : setOptionsOpen(false))}>
          <div className="ig-post-options-modal" onClick={(event) => event.stopPropagation()}>
            {isOwnPost ? (
              <>
                <button type="button" disabled={menuBusy} className="ig-post-options-item is-danger" onClick={() => void handleDeletePost()}>
                  {menuBusy ? "Eliminando..." : "Eliminar"}
                </button>
                <button type="button" className="ig-post-options-item" onClick={() => setEditingCaption(true)}>
                  Editar
                </button>
                <button type="button" disabled={menuBusy} className="ig-post-options-item" onClick={() => void handleToggleHideLikes()}>
                  {hideLikeCount ? "Mostrar recuento de Me gusta" : "Ocultar recuento de Me gusta"}
                </button>
                <button type="button" disabled={menuBusy} className="ig-post-options-item" onClick={() => void handleToggleCommentsAvailability()}>
                  {commentsEnabled ? "Desactivar comentarios" : "Activar comentarios"}
                </button>
                <button type="button" className="ig-post-options-item" onClick={onOpenPost}>
                  Ir a la publicacion
                </button>
                <button type="button" className="ig-post-options-item" onClick={onShare}>
                  Compartir en...
                </button>
                <button type="button" className="ig-post-options-item" onClick={() => void handleCopyLink()}>
                  Copiar enlace
                </button>
                <button type="button" className="ig-post-options-item" onClick={() => void handleCopyEmbed()}>
                  Insertar
                </button>
                <button
                  type="button"
                  className="ig-post-options-item"
                  onClick={() => {
                    const targetUsername = (post.username ?? "").trim().toLowerCase();
                    if (targetUsername) {
                      void prefetchProfileRouteSnapshot(targetUsername, currentUserId ?? null);
                    }
                    setLocation(`/${post.username || "inicio"}`);
                    setOptionsOpen(false);
                  }}
                >
                  Informacion sobre esta cuenta
                </button>
                <button type="button" className="ig-post-options-item" onClick={() => setOptionsOpen(false)}>
                  Cancelar
                </button>
              </>
            ) : (
              <>
                <button type="button" disabled={menuBusy} className="ig-post-options-item is-danger" onClick={() => void handleReportPost()}>
                  {menuBusy ? "Enviando..." : "Reportar"}
                </button>
                <button type="button" disabled={menuBusy} className="ig-post-options-item is-danger" onClick={() => void handleToggleFollowFromMenu()}>
                  {menuBusy ? "Procesando..." : "Deja de seguir"}
                </button>
                <button type="button" disabled={menuBusy} className="ig-post-options-item" onClick={() => void handleToggleFavorite()}>
                  {isFavoriteAuthor ? "Quitar de favoritos" : "Agregar a favoritos"}
                </button>
                <button type="button" className="ig-post-options-item" onClick={onOpenPost}>
                  Ir a la publicacion
                </button>
                <button type="button" className="ig-post-options-item" onClick={onShare}>
                  Compartir en...
                </button>
                <button type="button" className="ig-post-options-item" onClick={() => void handleCopyLink()}>
                  Copiar enlace
                </button>
                <button type="button" className="ig-post-options-item" onClick={() => void handleCopyEmbed()}>
                  Insertar
                </button>
                <button
                  type="button"
                  className="ig-post-options-item"
                  onClick={() => {
                    const targetUsername = (post.username ?? "").trim().toLowerCase();
                    if (targetUsername) {
                      void prefetchProfileRouteSnapshot(targetUsername, currentUserId ?? null);
                    }
                    setLocation(`/${post.username || "inicio"}`);
                    setOptionsOpen(false);
                  }}
                >
                  Informacion sobre esta cuenta
                </button>
                <button type="button" className="ig-post-options-item" onClick={() => setOptionsOpen(false)}>
                  Cancelar
                </button>
              </>
            )}
          </div>
        </div>
      ) : null}

      {editingCaption ? (
        <div className="ig-post-options-overlay" onClick={() => (menuBusy ? null : setEditingCaption(false))}>
          <div className="ig-post-edit-modal" onClick={(event) => event.stopPropagation()}>
            <h3 className="ig-post-edit-title">Editar publicacion</h3>
            <textarea
              value={captionDraft}
              onChange={(event) => setCaptionDraft(event.target.value)}
              className="ig-post-edit-textarea"
              placeholder="Escribe una descripcion..."
              rows={6}
              maxLength={2200}
            />
            <div className="ig-post-edit-actions">
              <button type="button" className="ig-post-edit-btn" onClick={() => setEditingCaption(false)} disabled={menuBusy}>
                Cancelar
              </button>
              <button type="button" className="ig-post-edit-btn is-primary" onClick={() => void handleSaveCaption()} disabled={menuBusy}>
                {menuBusy ? "Guardando..." : "Guardar"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </article>
  );
};

export default FeedPostCard;
