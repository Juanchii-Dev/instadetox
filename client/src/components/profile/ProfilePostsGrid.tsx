import { useEffect, useMemo, useRef, useState } from "react";
import { Virtuoso } from "react-virtuoso";
import { getOptimizedImageUrl } from "@/lib/profileUtils";
import { ProfileGridSkeleton } from "@/components/ui/skeleton";

type ProfileTab = "posts" | "saved" | "tagged";

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

interface ProfilePostsGridProps {
  posts: ProfilePost[];
  activeTab: ProfileTab;
  loadingInitial: boolean;
  loadingMore: boolean;
  formatCompact: (value: number) => string;
  parseMediaList: (mediaUrl: string | null) => string[];
  isVideoUrl: (mediaUrl: string | null) => boolean;
  supportsHoverPrefetch: boolean;
  onOpenPost: (index: number) => void;
  onWarmPost: (post: ProfilePost) => void;
}

const ProfilePostsGrid = ({
  posts,
  activeTab,
  loadingInitial,
  loadingMore,
  formatCompact,
  parseMediaList,
  isVideoUrl,
  supportsHoverPrefetch,
  onOpenPost,
  onWarmPost,
}: ProfilePostsGridProps) => {
  const [visiblePostIds, setVisiblePostIds] = useState<Set<string>>(new Set());
  const [touchActivePostId, setTouchActivePostId] = useState<string | null>(null);
  const touchOverlayTimeoutRef = useRef<number | null>(null);
  const postCardRefs = useRef<Map<string, HTMLElement>>(new Map());

  const panelIdByTab: Record<ProfileTab, string> = {
    posts: "panel-posts",
    saved: "panel-saved",
    tagged: "panel-tagged",
  };

  const tabIdByTab: Record<ProfileTab, string> = {
    posts: "tab-posts",
    saved: "tab-saved",
    tagged: "tab-tagged",
  };

  const groupedRows = useMemo(() => {
    const rows: Array<Array<ProfilePost | null>> = [];
    for (let i = 0; i < posts.length; i += 3) {
      const row: Array<ProfilePost | null> = [posts[i] ?? null, posts[i + 1] ?? null, posts[i + 2] ?? null];
      rows.push(row);
    }
    return rows;
  }, [posts]);
  const postsIdsSignature = useMemo(() => posts.map((post) => post.id).join(","), [posts]);

  useEffect(() => {
    const initialVisible = posts.slice(0, 9).map((post) => post.id);
    setVisiblePostIds((prev) => {
      const next = new Set<string>();
      prev.forEach((id) => {
        if (posts.some((post) => post.id === id)) {
          next.add(id);
        }
      });
      initialVisible.forEach((id) => next.add(id));
      if (next.size === prev.size) {
        let changed = false;
        prev.forEach((id) => {
          if (!next.has(id)) changed = true;
        });
        if (!changed) return prev;
      }
      return next;
    });
  }, [activeTab, posts, postsIdsSignature]);

  useEffect(() => {
    // [Optimización react-virtuoso]
    // Eliminamos el guardado de IntersectionObserver de las Cards ya que 
    // Virtuoso gestiona native viewport rendering (solo existen n rows activas en el DOM a la vez)
    // Se mantiene `visiblePostIds` para trigger de media load cuando la mount cycle de react arranca
  }, [postsIdsSignature]);

  useEffect(() => {
    return () => {
      if (touchOverlayTimeoutRef.current !== null) {
        window.clearTimeout(touchOverlayTimeoutRef.current);
      }
    };
  }, []);

  if (loadingInitial) {
    return (
      <div
        className="inst-profile-grid is-loading"
        aria-live="polite"
        role="tabpanel"
        id={panelIdByTab[activeTab]}
        aria-labelledby={tabIdByTab[activeTab]}
      >
        <ProfileGridSkeleton />
      </div>
    );
  }

  if (posts.length === 0) {
    const emptyMessage =
      activeTab === "posts"
        ? "Este perfil aún no tiene publicaciones."
        : activeTab === "saved"
          ? "No hay guardados en este perfil."
          : "No hay publicaciones etiquetadas.";

    return (
      <div className="inst-profile-grid-empty" role="tabpanel" id={panelIdByTab[activeTab]} aria-labelledby={tabIdByTab[activeTab]}>
        <p>{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="inst-profile-posts-grid-container" role="tabpanel" id={panelIdByTab[activeTab]} aria-labelledby={tabIdByTab[activeTab]}>
      <Virtuoso
        useWindowScroll
        data={groupedRows}
        overscan={800} // margen de carga para scroll rápido
        className="inst-profile-posts-grid"
        itemContent={(rowIndex, row) => (
          <div className="inst-profile-grid-row">
            {row.map((post, columnIndex) => {
              if (!post) {
                return <div key={`profile-grid-empty-${rowIndex}-${columnIndex}`} className="inst-profile-post-card empty" />;
              }

              const index = rowIndex * 3 + columnIndex;
              const mediaList = parseMediaList(post.media_url);
              const media = mediaList[0] ?? null;
              const mediaIsVideo = isVideoUrl(media);
              const isVisible = visiblePostIds.has(post.id);
              const showTouchOverlay = touchActivePostId === post.id;

              return (
                <article
                  key={post.id}
                  className={`inst-profile-post-card${showTouchOverlay ? " touch-active" : ""}`}
                  ref={(node) => {
                    if (node) {
                      postCardRefs.current.set(post.id, node);
                    } else {
                      postCardRefs.current.delete(post.id);
                    }
                  }}
                  data-post-id={post.id}
                >
                  <button
                    type="button"
                    className="inst-profile-post-link"
                    onClick={() => onOpenPost(index)}
                    onMouseEnter={supportsHoverPrefetch ? () => onWarmPost(post) : undefined}
                    onFocus={supportsHoverPrefetch ? () => onWarmPost(post) : undefined}
                    onTouchStart={() => {
                      setTouchActivePostId(post.id);
                      if (touchOverlayTimeoutRef.current !== null) {
                        window.clearTimeout(touchOverlayTimeoutRef.current);
                      }
                      touchOverlayTimeoutRef.current = window.setTimeout(() => {
                        setTouchActivePostId((current) => (current === post.id ? null : current));
                      }, 320);
                    }}
                    aria-label={`Abrir publicación ${index + 1}`}
                  >
                    <div className="inst-profile-post-wrapper">
                      <div className="inst-profile-post-image-container">
                        {isVisible && media ? (
                          mediaIsVideo ? (
                            <video src={media} className="inst-profile-post-image" muted playsInline preload="metadata" />
                          ) : (
                            <img
                              src={getOptimizedImageUrl(media, 400, 70)}
                              alt={post.title ?? "publicación"}
                              className="inst-profile-post-image"
                              loading="lazy"
                              decoding="async"
                              onError={(e) => {
                                const target = e.currentTarget;
                                if (target.src !== media) {
                                  target.src = media;
                                }
                              }}
                            />
                          )
                        ) : (
                          <div className="inst-profile-post-fallback" />
                        )}
                      </div>

                      <div className="inst-profile-post-overlay">
                        <div className="inst-profile-overlay-stats">
                          <span className="inst-profile-overlay-stat-item">
                            <svg aria-label="Me gusta" className="inst-profile-overlay-stat-icon" fill="currentColor" height="24" viewBox="0 0 24 24" width="24">
                              <path d="M16.792 3.904A4.989 4.989 0 0 1 21.5 9.122c0 3.072-2.652 4.959-5.197 7.222-2.512 2.243-3.865 3.469-4.303 3.752-.477-.309-2.143-1.823-4.303-3.752C5.141 14.072 2.5 12.167 2.5 9.122a4.989 4.989 0 0 1 4.708-5.218 4.21 4.21 0 0 1 3.675 1.941c.84 1.175.98 1.763 1.12 1.763s.278-.588 1.11-1.766a4.17 4.17 0 0 1 3.679-1.938m0-2a6.04 6.04 0 0 0-4.797 2.127 6.052 6.052 0 0 0-4.787-2.127A6.985 6.985 0 0 0 .5 9.122c0 3.61 2.55 5.827 5.015 7.97.283.246.569.494.853.747l1.027.918a44.998 44.998 0 0 0 3.518 3.018 2 2 0 0 0 2.174 0 45.263 45.263 0 0 0 3.626-3.115l.922-.824c.293-.26.59-.519.885-.774 2.334-2.025 4.98-4.32 4.98-7.94a6.985 6.985 0 0 0-6.708-7.218Z" />
                            </svg>
                            <span className="inst-profile-overlay-stat-count">{formatCompact(post.likes_count)}</span>
                          </span>
                          <span className="inst-profile-overlay-stat-item">
                            <svg aria-label="Comentarios" className="inst-profile-overlay-stat-icon" fill="currentColor" height="24" viewBox="0 0 24 24" width="24">
                              <path d="M20.656 17.008a9.993 9.993 0 1 0-3.59 3.615L22 22Z" fill="none" stroke="currentColor" strokeLinejoin="round" strokeWidth="2" />
                            </svg>
                            <span className="inst-profile-overlay-stat-count">{formatCompact(post.comments_count)}</span>
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="inst-profile-post-spacer" />
                  </button>
                </article>
              );
            })}
          </div>
        )}
        components={{
          Footer: () => loadingMore ? <div className="inst-profile-grid-loading-more pb-6">Cargando más publicaciones...</div> : <div className="pb-6" />
        }}
      />
    </div>
  );
};

export default ProfilePostsGrid;
