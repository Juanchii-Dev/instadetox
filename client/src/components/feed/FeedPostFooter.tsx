import { Bookmark, Heart, MessageCircle, Send } from "lucide-react";
import { Link } from "wouter";
import MentionText from "@/components/ui/mention-text";
import { compactCount } from "@/components/feed/feedPostUtils";
import { motion, AnimatePresence } from "framer-motion";

interface FeedPostFooterProps {
  username: string | null;
  caption: string;
  mentions?: string[] | null;
  likedByMe: boolean;
  isSaved: boolean;
  likesCount: number;
  commentsCount: number;
  hideLikeCount?: boolean;
  onWarmProfileRoute?: () => void;
  onToggleLike: () => void;
  onOpenPost: () => void;
  onShare: () => void;
  onToggleSave: () => void;
}

const FeedPostFooter = ({
  username,
  caption,
  mentions,
  likedByMe,
  isSaved,
  likesCount,
  commentsCount,
  hideLikeCount,
  onWarmProfileRoute,
  onToggleLike,
  onOpenPost,
  onShare,
  onToggleSave,
}: FeedPostFooterProps) => {
  return (
    <div className="ig-post-footer">
      <div className="ig-post-meta-block">
        <section className="ig-post-actions-section">
          <div className="ig-post-actions-row">
            <div className="ig-post-actions-left">
              <button
                className={`ig-post-action-icon ${likedByMe ? "is-liked" : ""}`}
                onClick={onToggleLike}
                aria-label="Me gusta"
                type="button"
              >
                <AnimatePresence mode="popLayout">
                  <motion.div
                    key={likedByMe ? "liked" : "unliked"}
                    initial={{ scale: 0.8 }}
                    animate={{ scale: likedByMe ? [1, 1.4, 1] : 1 }}
                    transition={{ duration: 0.3 }}
                  >
                    <Heart className={`w-6 h-6 ${likedByMe ? "fill-red-400" : ""}`} />
                  </motion.div>
                </AnimatePresence>
              </button>
              {!hideLikeCount ? (
                <button
                  className="ig-post-action-count"
                  onClick={onOpenPost}
                  aria-label="Ver me gusta de la publicación"
                  type="button"
                >
                  {compactCount(likesCount)}
                </button>
              ) : null}

              <button
                className="ig-post-action-icon"
                onClick={onOpenPost}
                aria-label="Comentar"
                type="button"
              >
                <MessageCircle className="w-6 h-6" />
              </button>
              <button
                className="ig-post-action-count"
                onClick={onOpenPost}
                aria-label="Ver comentarios de la publicación"
                type="button"
              >
                {compactCount(commentsCount)}
              </button>

              <button className="ig-post-action-icon" onClick={onShare} aria-label="Compartir" type="button">
                <Send className="w-6 h-6" />
              </button>
            </div>

            <button
              className={`ig-post-action-icon ${isSaved ? "is-saved" : ""}`}
              onClick={onToggleSave}
              aria-label="Guardar"
              type="button"
            >
              <Bookmark className={`w-6 h-6 ${isSaved ? "fill-cyan-300" : ""}`} />
            </button>
          </div>
        </section>

        <div className="ig-post-caption-wrap">
          <p className="ig-post-caption">
            <Link
              href={`/${username || "inicio"}`}
              className="ig-post-caption-author notranslate"
              onMouseEnter={onWarmProfileRoute}
              onFocus={onWarmProfileRoute}
              onTouchStart={onWarmProfileRoute}
            >
              {username || "usuario"}
            </Link>{" "}
            <MentionText text={caption} />
          </p>
        </div>

      </div>
    </div>
  );
};

export default FeedPostFooter;

