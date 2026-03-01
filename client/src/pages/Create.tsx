import { useEffect, useMemo, useRef, useState } from "react";
import {
  PlusCircle,
  Image,
  Quote,
  Target,
  Calendar,
  Loader2,
  X,
  MessageCircle,
  Edit,
  Trash2,
  Video,
  ChevronLeft,
  ChevronRight,
  Check,
} from "lucide-react";
import { useLocation } from "wouter";
import { Glass } from "@/components/ui/glass";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/AuthContext";
import { supabase } from "@/lib/supabase";
import InstagramMediaPicker from "@/components/create/InstagramMediaPicker";
import { enqueueMutation } from "@/lib/outbox";

type ContentType = "reflection" | "quote" | "goal" | "milestone" | "photo" | "video";

interface UserPost {
  id: string;
  type: ContentType;
  title: string;
  content: string;
  mediaUrls: string[];
  mentions: string[];
  videoCoverUrl: string | null;
  createdAt: string;
}

interface MentionSuggestion {
  id: string;
  username: string;
  full_name: string | null;
  avatar_url: string | null;
}

const POSTS_MEDIA_BUCKET = (import.meta.env.VITE_SUPABASE_POSTS_BUCKET as string | undefined)?.trim() || "post-media";
const MAX_MEDIA_PER_POST = 10;

/**
 * M12: Generador de UUID con fallback para contextos no seguros (HTTP/Red Local).
 * crypto.randomUUID requiere HTTPS. Este helper garantiza paridad funcional.
 */
const safeRandomUUID = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

const parseMediaList = (mediaUrl: string | null): string[] => {
  if (!mediaUrl) return [];
  const raw = mediaUrl.trim();
  if (!raw) return [];

  if (raw.startsWith("[")) {
    try {
      const parsed: unknown = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed
          .map((item) => {
            if (typeof item === "string") return item.trim();
            if (
              item &&
              typeof item === "object" &&
              "url" in item &&
              typeof (item as { url: unknown }).url === "string"
            ) {
              return (item as { url: string }).url.trim();
            }
            return "";
          })
          .filter(Boolean);
      }
    } catch {
      // fallback a parser de texto
    }
  }

  return raw
    .split(/[\n,|]/g)
    .map((item) => item.trim())
    .filter(Boolean);
};

const serializeMediaList = (mediaUrls: string[]): string | null => {
  if (mediaUrls.length === 0) return null;
  if (mediaUrls.length === 1) return mediaUrls[0];
  return JSON.stringify(mediaUrls);
};

const isVideoUrl = (mediaUrl: string) =>
  /\.(mp4|webm|mov|m4v|ogg)(\?|$)/i.test(mediaUrl) || mediaUrl.includes(".m3u8");

const formatSec = (value: number) => {
  const safe = Math.max(0, Math.floor(value));
  const min = Math.floor(safe / 60);
  const sec = safe % 60;
  return `${min}:${sec.toString().padStart(2, "0")}`;
};

const toPost = (row: {
  id: string;
  type: string;
  title: string | null;
  caption: string;
  media_url: string | null;
  mentions?: string[] | null;
  video_cover_url?: string | null;
  created_at: string;
}): UserPost => ({
  id: row.id,
  type: (row.type as ContentType) || "reflection",
  title: row.title || "",
  content: row.caption,
  mediaUrls: parseMediaList(row.media_url),
  mentions: row.mentions ?? [],
  videoCoverUrl: row.video_cover_url ?? null,
  createdAt: row.created_at,
});

const Create = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [, navigate] = useLocation();

  const [contentType, setContentType] = useState<ContentType>("reflection");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [mediaUrls, setMediaUrls] = useState<string[]>([]);
  const [selectedMentions, setSelectedMentions] = useState<string[]>([]);
  const [mentionQuery, setMentionQuery] = useState("");
  const [mentionSuggestions, setMentionSuggestions] = useState<MentionSuggestion[]>([]);
  const [mentionLoading, setMentionLoading] = useState(false);
  const [videoCoverUrl, setVideoCoverUrl] = useState<string | null>(null);
  const [isUploadingMedia, setIsUploadingMedia] = useState(false);
  const [isUploadingCover, setIsUploadingCover] = useState(false);
  const [goalDate, setGoalDate] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingPosts, setIsLoadingPosts] = useState(true);
  const [posts, setPosts] = useState<UserPost[]>([]);
  const [editingPost, setEditingPost] = useState<UserPost | null>(null);
  const [showPosts, setShowPosts] = useState(false);
  const [previewMediaList, setPreviewMediaList] = useState<string[]>([]);
  const [previewMediaIndex, setPreviewMediaIndex] = useState(0);
  const [previewTouchStartX, setPreviewTouchStartX] = useState<number | null>(null);
  const [showPublishSuccess, setShowPublishSuccess] = useState(false);
  const [coverDurationSec, setCoverDurationSec] = useState(0);
  const [coverFrameTimeSec, setCoverFrameTimeSec] = useState(0);
  const coverVideoRef = useRef<HTMLVideoElement | null>(null);

  const isSupabaseReady = Boolean(supabase && user?.id);
  const previewMediaUrl = previewMediaList[previewMediaIndex] ?? null;
  const isPreviewVideo = Boolean(previewMediaUrl && isVideoUrl(previewMediaUrl));
  const hasPreviewCarousel = previewMediaList.length > 1;
  const firstVideoUrl = useMemo(() => mediaUrls.find((url) => isVideoUrl(url)) ?? null, [mediaUrls]);

  const openMediaPreview = (urls: string[], startIndex = 0) => {
    if (urls.length === 0) return;
    const safeStart = Math.min(Math.max(startIndex, 0), urls.length - 1);
    setPreviewMediaList(urls);
    setPreviewMediaIndex(safeStart);
  };

  const closeMediaPreview = () => {
    setPreviewMediaList([]);
    setPreviewMediaIndex(0);
    setPreviewTouchStartX(null);
  };

  const goPrevPreview = () => {
    if (previewMediaList.length <= 1) return;
    setPreviewMediaIndex((prev) => (prev - 1 + previewMediaList.length) % previewMediaList.length);
  };

  const goNextPreview = () => {
    if (previewMediaList.length <= 1) return;
    setPreviewMediaIndex((prev) => (prev + 1) % previewMediaList.length);
  };

  const closePublishSuccessAndGoHome = () => {
    setShowPublishSuccess(false);
    navigate("/inicio");
  };

  const captionPayload = useMemo(() => {
    if (contentType === "goal" && goalDate) {
      return `${content}\n\nObjetivo para: ${goalDate}`;
    }
    return content;
  }, [content, contentType, goalDate]);

  const resetForm = () => {
    setTitle("");
    setContent("");
    setMediaUrls([]);
    setSelectedMentions([]);
    setMentionQuery("");
    setMentionSuggestions([]);
    setVideoCoverUrl(null);
    setGoalDate("");
    setEditingPost(null);
    setContentType("reflection");
  };

  const loadPosts = async () => {
    if (!isSupabaseReady || !supabase || !user) {
      setPosts([]);
      setIsLoadingPosts(false);
      return;
    }

    setIsLoadingPosts(true);
    const { data, error } = await supabase
      .from("posts")
      .select("id, type, title, caption, media_url, mentions, video_cover_url, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      toast({ title: "Error", description: "No se pudieron cargar tus publicaciones." });
      setIsLoadingPosts(false);
      return;
    }

    setPosts((data ?? []).map(toPost));
    setIsLoadingPosts(false);
  };

  useEffect(() => {
    void loadPosts();
  }, [user?.id]);

  useEffect(() => {
    if (!editingPost) return;
    setContentType(editingPost.type);
    setTitle(editingPost.title);
    setContent(editingPost.content);
    setMediaUrls(editingPost.mediaUrls);
    setSelectedMentions(editingPost.mentions);
    setMentionQuery("");
    setMentionSuggestions([]);
    setVideoCoverUrl(editingPost.videoCoverUrl);
  }, [editingPost]);

  useEffect(() => {
    const client = supabase;
    if (!client || !user?.id) return;
    const query = mentionQuery.trim().replace(/^@+/, "");
    if (query.length < 2) {
      setMentionSuggestions([]);
      setMentionLoading(false);
      return;
    }

    const timer = window.setTimeout(async () => {
      setMentionLoading(true);
      const safe = query.replace(/[%_]/g, "");
      const { data, error } = await client
        .from("profiles")
        .select("id, username, full_name, avatar_url")
        .neq("id", user.id)
        .or(`username.ilike.%${safe}%,full_name.ilike.%${safe}%`)
        .limit(8);

      if (error) {
        setMentionSuggestions([]);
        setMentionLoading(false);
        return;
      }

      const list = ((data ?? []) as MentionSuggestion[]).filter((row) => !selectedMentions.includes(row.username));
      setMentionSuggestions(list);
      setMentionLoading(false);
    }, 250);

    return () => window.clearTimeout(timer);
  }, [mentionQuery, selectedMentions, supabase, user?.id]);

  useEffect(() => {
    if (!firstVideoUrl) {
      setCoverDurationSec(0);
      setCoverFrameTimeSec(0);
      return;
    }

    setCoverFrameTimeSec(0);
  }, [firstVideoUrl]);

  useEffect(() => {
    if (!previewMediaUrl) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeMediaPreview();
        return;
      }
      if (event.key === "ArrowLeft") {
        goPrevPreview();
        return;
      }
      if (event.key === "ArrowRight") {
        goNextPreview();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [previewMediaUrl, previewMediaList.length]);

  useEffect(() => {
    if (!previewMediaUrl) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [previewMediaUrl]);

  useEffect(() => {
    if (!showPublishSuccess) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closePublishSuccessAndGoHome();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [showPublishSuccess]);

  const validateForm = () => {
    if (contentType !== "photo" && contentType !== "video" && !title.trim()) {
      toast({ title: "Título requerido", description: "Escribe un título para tu publicación." });
      return false;
    }

    if (!content.trim()) {
      toast({ title: "Contenido requerido", description: "Escribe el contenido de tu publicación." });
      return false;
    }

    if (contentType === "goal" && !goalDate) {
      toast({ title: "Fecha requerida", description: "Define una fecha objetivo para tu meta." });
      return false;
    }

    if ((contentType === "photo" || contentType === "video") && mediaUrls.length === 0) {
      toast({ title: "Media requerida", description: "Agrega al menos una URL de imagen o video." });
      return false;
    }

    if (!isSupabaseReady) {
      toast({ title: "Config pendiente", description: "Configura Supabase y una sesión válida para publicar." });
      return false;
    }

    return true;
  };

  const handleSubmit = async () => {
    if (!validateForm() || !supabase || !user) return;

    const mediaPayload = serializeMediaList(mediaUrls);
    const mentions = selectedMentions;

    setIsSubmitting(true);
    try {
      if (editingPost) {
        const { error } = await supabase
          .from("posts")
          .update({
            type: contentType,
            title: title.trim() || null,
            caption: captionPayload.trim(),
            media_url: mediaPayload,
            mentions,
            video_cover_url: videoCoverUrl,
          })
          .eq("id", editingPost.id)
          .eq("user_id", user.id);

        if (error) throw error;
        toast({ title: "Publicación actualizada", description: "Los cambios fueron guardados." });
        await loadPosts();
      } else {
        const { error } = await supabase.from("posts").insert({
          user_id: user.id,
          type: contentType,
          title: title.trim() || null,
          caption: captionPayload.trim(),
          media_url: mediaPayload,
          mentions,
          video_cover_url: videoCoverUrl,
          is_published: true,
        });

        if (error) throw error;
        setShowPublishSuccess(true);
      }

      resetForm();
    } catch (error: any) {
      console.error("Error al guardar publicación -> Evaluando Outbox:", error);
      
      const isNetworkError = !window.navigator.onLine || 
                            error.message?.includes('fetch') || 
                            error.status === 0;

      if (isNetworkError && user) {
        // M12: Persistir en Outbox para evitar pérdida de contenido
        await enqueueMutation({
          id: safeRandomUUID(),
          userId: user.id,
          type: 'post',
          payload: {
            type: contentType,
            title: title.trim(),
            caption: captionPayload.trim(),
            media_url: serializeMediaList(mediaUrls),
            mentions: selectedMentions,
            video_cover_url: videoCoverUrl,
          },
          createdAt: new Date().toISOString()
        });
        
        toast({ 
          title: "Modo Offline / Error de Red", 
          description: "Tu publicación se ha guardado localmente y se enviará automáticamente al recuperar la conexión.",
          duration: 5000 
        });
        resetForm();
        navigate("/inicio");
      } else {
        const message = error instanceof Error ? error.message : "No se pudo guardar la publicación.";
        toast({ title: "Error", description: message });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeletePost = async (postId: string) => {
    if (!supabase || !user) return;

    const { error } = await supabase.from("posts").delete().eq("id", postId).eq("user_id", user.id);
    if (error) {
      toast({ title: "Error", description: "No se pudo eliminar la publicación." });
      return;
    }

    toast({ title: "Publicación eliminada", description: "Se eliminó correctamente." });
    await loadPosts();
  };

  const uploadMediaFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    if (!supabase || !user?.id) {
      toast({ title: "Sesión requerida", description: "Inicia sesión para subir archivos." });
      return;
    }

    const currentCount = mediaUrls.length;
    if (currentCount >= MAX_MEDIA_PER_POST) {
      toast({
        title: "Limite alcanzado",
        description: `Solo puedes subir hasta ${MAX_MEDIA_PER_POST} archivos por publicación.`,
      });
      return;
    }

    const room = MAX_MEDIA_PER_POST - currentCount;
    const selected = Array.from(files).slice(0, room);
    if (selected.length === 0) return;

    setIsUploadingMedia(true);
    try {
      const uploaded: string[] = [];

      for (let index = 0; index < selected.length; index += 1) {
        const file = selected[index];
        const isImage = file.type.startsWith("image/");
        const isVideo = file.type.startsWith("video/");
        if (!isImage && !isVideo) {
          toast({
            title: "Formato no soportado",
            description: `${file.name}: solo imágenes o videos.`,
          });
          continue;
        }

        const ext = file.name.includes(".") ? file.name.split(".").pop() : undefined;
        const safeExt = ext && /^[a-zA-Z0-9]+$/.test(ext) ? ext.toLowerCase() : isImage ? "jpg" : "mp4";
        const filePath = `${user.id}/${Date.now()}-${index}-${safeRandomUUID()}.${safeExt}`;

        const { error: uploadError } = await supabase.storage.from(POSTS_MEDIA_BUCKET).upload(filePath, file, {
          cacheControl: "3600",
          upsert: false,
          contentType: file.type || undefined,
        });

        if (uploadError) {
          toast({
            title: "Error al subir archivo",
            description: `${file.name}: ${uploadError.message}`,
          });
          continue;
        }

        const { data } = supabase.storage.from(POSTS_MEDIA_BUCKET).getPublicUrl(filePath);
        if (data.publicUrl) {
          uploaded.push(data.publicUrl);
        }
      }

      if (uploaded.length > 0) {
        setMediaUrls((prev) => {
          const next = new Set(prev);
          uploaded.forEach((url) => next.add(url));
          return Array.from(next);
        });
        toast({
          title: "Archivos subidos",
          description: `Se subieron ${uploaded.length} archivo(s).`,
        });
      }
    } finally {
      setIsUploadingMedia(false);
    }
  };

  const removeMediaUrl = (url: string) => {
    setMediaUrls((prev) => prev.filter((item) => item !== url));
  };

  const addMention = (username: string) => {
    const normalized = username.trim().replace(/^@+/, "").toLowerCase();
    if (!normalized) return;
    setSelectedMentions((prev) => (prev.includes(normalized) ? prev : [...prev, normalized]));
    setMentionQuery("");
    setMentionSuggestions([]);
  };

  const removeMention = (username: string) => {
    setSelectedMentions((prev) => prev.filter((item) => item !== username));
  };

  const uploadVideoCoverBlob = async (blob: Blob) => {
    if (!supabase || !user?.id) return null;
    setIsUploadingCover(true);
    try {
      const filePath = `${user.id}/covers/${Date.now()}-${safeRandomUUID()}.jpg`;
      const { error: uploadError } = await supabase.storage.from(POSTS_MEDIA_BUCKET).upload(filePath, blob, {
        cacheControl: "3600",
        upsert: false,
        contentType: "image/jpeg",
      });

      if (uploadError) {
        toast({ title: "Error al subir portada", description: uploadError.message });
        return null;
      }

      const { data } = supabase.storage.from(POSTS_MEDIA_BUCKET).getPublicUrl(filePath);
      const url = data.publicUrl || null;
      setVideoCoverUrl(url);
      toast({ title: "Portada actualizada", description: "Se cargó la portada del video." });
      return url;
    } finally {
      setIsUploadingCover(false);
    }
  };

  const captureCoverFromTimeline = async () => {
    const video = coverVideoRef.current;
    if (!video) return;
    if (!video.videoWidth || !video.videoHeight) {
      toast({ title: "No disponible", description: "El video aún no cargó metadatos." });
      return;
    }

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(
        (generated) => resolve(generated),
        "image/jpeg",
        0.92,
      );
    });

    if (!blob) {
      toast({ title: "Error", description: "No se pudo generar la portada desde el frame." });
      return;
    }

    await uploadVideoCoverBlob(blob);
  };

  const getContentTypeIcon = (type: ContentType) => {
    switch (type) {
      case "reflection":
        return <MessageCircle className="w-4 h-4" />;
      case "quote":
        return <Quote className="w-4 h-4" />;
      case "goal":
        return <Target className="w-4 h-4" />;
      case "milestone":
        return <Calendar className="w-4 h-4" />;
      case "photo":
        return <Image className="w-4 h-4" />;
      case "video":
        return <Video className="w-4 h-4" />;
      default:
        return <MessageCircle className="w-4 h-4" />;
    }
  };

  return (
    <div className="w-full max-w-5xl mx-auto space-y-6 pb-8 animate-in fade-in duration-500">
        <Glass className="p-6">
          <div className="flex justify-between items-center mb-4 gap-2">
            <h2 className="text-xl font-semibold flex items-center">
              <PlusCircle className="w-5 h-5 mr-2 text-primary" />
              {editingPost ? "Editar contenido" : "Crear contenido"}
            </h2>
            <button
              onClick={() => setShowPosts((prev) => !prev)}
              className={`px-3 py-1 rounded text-sm ${showPosts ? "bg-primary/20 text-primary" : "hover:bg-gray-800/50"}`}
            >
              {showPosts ? "Crear nuevo" : "Ver publicaciones"}
            </button>
          </div>

          {showPosts ? (
            isLoadingPosts ? (
              <p className="text-gray-300">Cargando tus publicaciones...</p>
            ) : posts.length === 0 ? (
              <p className="text-gray-300">Aún no creaste publicaciones.</p>
            ) : (
              <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2">
                {posts.map((post) => (
                  <div key={post.id} className="frosted rounded-lg p-4">
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex items-center gap-2">
                        <div className="bg-slate-900/60 p-1.5 rounded-md">{getContentTypeIcon(post.type)}</div>
                        <h3 className="font-medium text-white">{post.title || "Sin título"}</h3>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            setEditingPost(post);
                            setShowPosts(false);
                          }}
                          className="p-1.5 rounded hover:bg-slate-800/70"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => void handleDeletePost(post.id)}
                          className="p-1.5 rounded hover:bg-slate-800/70 text-red-300"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    <p className="text-gray-200 text-sm mb-3 whitespace-pre-line">{post.content}</p>
                    {post.mentions.length > 0 ? (
                      <p className="text-xs text-gray-300 mb-2">{post.mentions.map((m) => `@${m}`).join(" ")}</p>
                    ) : null}
                    {post.mediaUrls.length > 0 ? (
                      <div className="relative cursor-zoom-in" onClick={() => openMediaPreview(post.mediaUrls, 0)}>
                        {isVideoUrl(post.mediaUrls[0]) ? (
                          <video src={post.mediaUrls[0]} className="w-full h-40 object-cover rounded-lg" muted controls preload="metadata" />
                        ) : (
                          <img src={post.mediaUrls[0]} alt={post.title} className="w-full h-40 object-cover rounded-lg" />
                        )}
                        {post.mediaUrls.length > 1 ? (
                          <span className="absolute top-2 right-2 text-xs px-2 py-1 rounded-full bg-black/70 text-white">
                            {post.mediaUrls.length} medias
                          </span>
                        ) : null}
                      </div>
                    ) : null}
                    <p className="text-xs text-gray-400 mt-2">{new Date(post.createdAt).toLocaleString()}</p>
                  </div>
                ))}
              </div>
            )
          ) : (
            <>
              <p className="text-gray-300 mb-4">
                Comparte reflexiones, metas y logros en formato social con foco en bienestar digital.
              </p>

              <div className="flex flex-wrap mb-4 bg-black/20 rounded-lg p-1">
                {([
                  ["reflection", "Reflexión", MessageCircle],
                  ["quote", "Cita", Quote],
                  ["goal", "Meta", Target],
                  ["milestone", "Logro", Calendar],
                  ["photo", "Foto", Image],
                  ["video", "Video", Video],
                ] as const).map(([type, label, Icon]) => (
                  <button
                    key={type}
                    onClick={() => setContentType(type)}
                    className={`flex-1 min-w-[120px] flex items-center justify-center py-2 rounded-md text-sm ${
                      contentType === type ? "bg-primary/20 text-primary" : "hover:bg-gray-800/50"
                    }`}
                  >
                    <Icon className="w-4 h-4 mr-1" />
                    {label}
                  </button>
                ))}
              </div>

              <div className="space-y-4">
                {(contentType === "photo" || contentType === "video") && mediaUrls.length > 0 ? (
                  <div className="ig-create-editor-shell">
                    <div className="ig-create-editor-top">
                      <button
                        type="button"
                        className="ig-create-editor-back"
                        onClick={() => setMediaUrls([])}
                        aria-label="Volver"
                      >
                        <ChevronLeft className="w-5 h-5" />
                      </button>
                      <h3 className="ig-create-editor-title">Crear nueva publicación</h3>
                      <button
                        type="button"
                        onClick={() => void handleSubmit()}
                        disabled={isSubmitting}
                        className="ig-create-editor-share"
                      >
                        {isSubmitting ? "Compartiendo..." : "Compartir"}
                      </button>
                    </div>

                    <div className="ig-create-editor-body">
                      <div className="ig-create-editor-preview">
                        {isVideoUrl(mediaUrls[0]) ? (
                          <video src={mediaUrls[0]} className="ig-create-editor-media" controls preload="metadata" />
                        ) : (
                          <img src={mediaUrls[0]} alt="Vista previa de publicación" className="ig-create-editor-media" />
                        )}
                      </div>

                      <aside className="ig-create-editor-side">
                        <div className="ig-create-editor-user">
                          <div className="ig-create-editor-avatar">
                            {user?.avatar_url ? (
                              <img src={user.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
                            ) : (
                              <span>{user?.username?.slice(0, 1)?.toUpperCase() ?? "U"}</span>
                            )}
                          </div>
                          <span className="ig-create-editor-username">{user?.username ?? "usuario"}</span>
                        </div>

                        <div className="ig-create-editor-caption">
                          <textarea
                            value={content}
                            onChange={(e) => setContent(e.target.value)}
                            placeholder="Escribe una descripción..."
                            className="ig-create-editor-caption-input"
                            maxLength={2200}
                          />
                          <div className="ig-create-editor-count">{content.length}/2200</div>
                        </div>
                        <div className="ig-create-editor-row !h-auto !py-3 !items-start !flex-col !gap-2">
                          <label className="text-xs text-gray-300">Menciones</label>
                          {selectedMentions.length > 0 ? (
                            <div className="flex flex-wrap gap-1.5">
                              {selectedMentions.map((mention) => (
                                <button
                                  key={mention}
                                  type="button"
                                  onClick={() => removeMention(mention)}
                                  className="px-2 py-0.5 rounded-full text-[11px] bg-cyan-500/15 border border-cyan-300/30 text-cyan-200 hover:bg-cyan-500/25"
                                >
                                  @{mention} <span className="opacity-80">x</span>
                                </button>
                              ))}
                            </div>
                          ) : null}
                          <div className="relative w-full">
                            <input
                              type="text"
                              value={mentionQuery}
                              onChange={(e) => setMentionQuery(e.target.value)}
                              placeholder="Buscar usuarios para mencionar..."
                              className="ig-create-editor-input"
                            />
                            {mentionQuery.trim().length >= 2 ? (
                              <div className="absolute z-20 mt-2 w-full rounded-xl border border-white/20 bg-slate-900/95 backdrop-blur-md max-h-56 overflow-auto">
                                {mentionLoading ? (
                                  <p className="px-3 py-2 text-xs text-gray-300">Buscando usuarios...</p>
                                ) : mentionSuggestions.length === 0 ? (
                                  <p className="px-3 py-2 text-xs text-gray-400">Sin resultados.</p>
                                ) : (
                                  mentionSuggestions.map((row) => (
                                    <button
                                      key={row.id}
                                      type="button"
                                      onClick={() => addMention(row.username)}
                                      className="w-full px-3 py-2 flex items-center gap-2 text-left hover:bg-white/5"
                                    >
                                      <div className="w-7 h-7 rounded-full overflow-hidden bg-primary/20 flex items-center justify-center">
                                        {row.avatar_url ? (
                                          <img src={row.avatar_url} alt={row.username} className="w-full h-full object-cover" />
                                        ) : (
                                          <span className="text-xs text-gray-200">{row.username.slice(0, 1).toUpperCase()}</span>
                                        )}
                                      </div>
                                      <div className="min-w-0">
                                        <p className="text-xs text-white truncate">@{row.username}</p>
                                        <p className="text-[11px] text-gray-400 truncate">{row.full_name || "Usuario"}</p>
                                      </div>
                                    </button>
                                  ))
                                )}
                              </div>
                            ) : null}
                          </div>
                        </div>
                      </aside>
                    </div>
                  </div>
                ) : (
                  <>
                    {contentType === "photo" || contentType === "video" ? null : (
                      <input
                        type="text"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder="Título de la publicación"
                        className="frosted w-full rounded-lg p-3 text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary"
                      />
                    )}

                    {contentType === "photo" || contentType === "video" ? null : (
                      <>
                        <textarea
                          value={content}
                          onChange={(e) => setContent(e.target.value)}
                          placeholder="Escribe tu contenido..."
                          className="frosted w-full rounded-lg p-4 text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary resize-none h-32"
                        />

                        <div className="space-y-2">
                          <label className="text-sm text-gray-300">Menciones</label>
                          {selectedMentions.length > 0 ? (
                            <div className="flex flex-wrap gap-2">
                              {selectedMentions.map((mention) => (
                                <button
                                  key={mention}
                                  type="button"
                                  onClick={() => removeMention(mention)}
                                  className="px-2.5 py-1 rounded-full text-xs bg-cyan-500/15 border border-cyan-300/30 text-cyan-200 hover:bg-cyan-500/25"
                                >
                                  @{mention} <span className="opacity-80">x</span>
                                </button>
                              ))}
                            </div>
                          ) : null}

                          <div className="relative">
                            <input
                              type="text"
                              value={mentionQuery}
                              onChange={(e) => setMentionQuery(e.target.value)}
                              placeholder="Buscar usuarios para mencionar..."
                              className="frosted w-full rounded-lg p-3 text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary"
                            />
                            {mentionQuery.trim().length >= 2 ? (
                              <div className="absolute z-20 mt-2 w-full rounded-xl border border-white/20 bg-slate-900/95 backdrop-blur-md max-h-64 overflow-auto">
                                {mentionLoading ? (
                                  <p className="px-3 py-2 text-sm text-gray-300">Buscando usuarios...</p>
                                ) : mentionSuggestions.length === 0 ? (
                                  <p className="px-3 py-2 text-sm text-gray-400">Sin resultados.</p>
                                ) : (
                                  mentionSuggestions.map((row) => (
                                    <button
                                      key={row.id}
                                      type="button"
                                      onClick={() => addMention(row.username)}
                                      className="w-full px-3 py-2 flex items-center gap-3 text-left hover:bg-white/5"
                                    >
                                      <div className="w-8 h-8 rounded-full overflow-hidden bg-primary/20 flex items-center justify-center">
                                        {row.avatar_url ? (
                                          <img src={row.avatar_url} alt={row.username} className="w-full h-full object-cover" />
                                        ) : (
                                          <span className="text-xs text-gray-200">{row.username.slice(0, 1).toUpperCase()}</span>
                                        )}
                                      </div>
                                      <div className="min-w-0">
                                        <p className="text-sm text-white truncate">@{row.username}</p>
                                        <p className="text-xs text-gray-400 truncate">{row.full_name || "Usuario"}</p>
                                      </div>
                                    </button>
                                  ))
                                )}
                              </div>
                            ) : null}
                          </div>
                        </div>
                      </>
                    )}

                    {contentType === "goal" ? (
                      <input
                        type="date"
                        value={goalDate}
                        onChange={(e) => setGoalDate(e.target.value)}
                        min={new Date().toISOString().split("T")[0]}
                        className="frosted w-full rounded-lg p-3 text-white focus:outline-none focus:ring-2 focus:ring-primary"
                      />
                    ) : null}

                    <div>
                      <InstagramMediaPicker
                        mediaUrls={mediaUrls}
                        isUploadingMedia={isUploadingMedia}
                        isVideoUrl={isVideoUrl}
                        onOpenPreview={(index) => openMediaPreview(mediaUrls, index >= 0 ? index : 0)}
                        onRemoveMedia={removeMediaUrl}
                        onUploadFiles={uploadMediaFiles}
                      />

                      {contentType === "video" ? (
                        <div className="mt-4 space-y-2">
                          <p className="text-sm text-gray-300">Editor de portada por frame (timeline)</p>
                          {firstVideoUrl ? (
                            <div className="space-y-3">
                              <video
                                ref={coverVideoRef}
                                src={firstVideoUrl}
                                className="w-full h-44 object-cover rounded-lg border border-white/15"
                                preload="metadata"
                                controls
                                crossOrigin="anonymous"
                                onLoadedMetadata={(e) => {
                                  const duration = Number.isFinite(e.currentTarget.duration) ? e.currentTarget.duration : 0;
                                  setCoverDurationSec(duration);
                                  setCoverFrameTimeSec(0);
                                }}
                                onTimeUpdate={(e) => setCoverFrameTimeSec(e.currentTarget.currentTime || 0)}
                              />
                              <div className="space-y-2">
                                <input
                                  type="range"
                                  min={0}
                                  max={Math.max(coverDurationSec, 0.001)}
                                  step={0.05}
                                  value={Math.min(coverFrameTimeSec, coverDurationSec)}
                                  onChange={(e) => {
                                    const next = Number(e.target.value);
                                    setCoverFrameTimeSec(next);
                                    if (coverVideoRef.current) {
                                      coverVideoRef.current.currentTime = next;
                                    }
                                  }}
                                  className="w-full"
                                />
                                <div className="flex items-center justify-between text-xs text-gray-400">
                                  <span>{formatSec(coverFrameTimeSec)}</span>
                                  <span>{formatSec(coverDurationSec)}</span>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => void captureCoverFromTimeline()}
                                  disabled={isUploadingCover}
                                  className="px-3 py-2 rounded-lg bg-primary/20 text-primary hover:bg-primary/30 text-sm disabled:opacity-60"
                                >
                                  {isUploadingCover ? "Guardando portada..." : "Usar frame actual como portada"}
                                </button>
                              </div>
                            </div>
                          ) : (
                            <p className="text-xs text-gray-400">Sube al menos un video para habilitar el editor de portada.</p>
                          )}

                          {videoCoverUrl ? (
                            <div className="relative w-44 rounded-lg overflow-hidden border border-white/20">
                              <img src={videoCoverUrl} alt="Portada de video" className="w-full h-24 object-cover" />
                              <button
                                type="button"
                                onClick={() => setVideoCoverUrl(null)}
                                className="absolute top-1.5 right-1.5 bg-black/70 p-1 rounded-full hover:bg-black"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          ) : (
                            <p className="text-xs text-gray-400">Sin portada. Se usará el primer frame del video.</p>
                          )}
                        </div>
                      ) : null}
                    </div>
                  </>
                )}
              </div>

              {contentType === "photo" || contentType === "video" ? (
                mediaUrls.length > 0 ? null : (
                  <div className="flex justify-end mt-6 space-x-3">
                    {editingPost ? (
                      <button
                        onClick={resetForm}
                        className="border border-gray-700 hover:border-gray-500 px-4 py-2 rounded-lg inline-flex items-center transition-colors"
                      >
                        <X className="w-4 h-4 mr-2" />
                        Cancelar
                      </button>
                    ) : null}

                    <button
                      onClick={() => void handleSubmit()}
                      disabled={isSubmitting}
                      className="bg-primary hover:bg-primary/80 px-6 py-2 rounded-lg inline-flex items-center transition-colors disabled:bg-primary/50 disabled:cursor-not-allowed"
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          {editingPost ? "Actualizando..." : "Publicando..."}
                        </>
                      ) : (
                        <>
                          <PlusCircle className="w-4 h-4 mr-2" />
                          {editingPost ? "Actualizar" : "Publicar"}
                        </>
                      )}
                    </button>
                  </div>
                )
              ) : (
                <div className="flex justify-end mt-6 space-x-3">
                {editingPost ? (
                  <button
                    onClick={resetForm}
                    className="border border-gray-700 hover:border-gray-500 px-4 py-2 rounded-lg inline-flex items-center transition-colors"
                  >
                    <X className="w-4 h-4 mr-2" />
                    Cancelar
                  </button>
                ) : null}

                <button
                  onClick={() => void handleSubmit()}
                  disabled={isSubmitting}
                  className="bg-primary hover:bg-primary/80 px-6 py-2 rounded-lg inline-flex items-center transition-colors disabled:bg-primary/50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      {editingPost ? "Actualizando..." : "Publicando..."}
                    </>
                  ) : (
                    <>
                      <PlusCircle className="w-4 h-4 mr-2" />
                      {editingPost ? "Actualizar" : "Publicar"}
                    </>
                  )}
                </button>
                </div>
              )}
            </>
          )}
        </Glass>

        {previewMediaUrl ? (
          <div
            className="fixed inset-0 z-50 bg-black/55 backdrop-blur-sm p-3 sm:p-6 flex items-center justify-center"
            onClick={closeMediaPreview}
          >
            <div
              className="relative w-full max-w-3xl max-h-[88vh] rounded-xl overflow-hidden border border-white/20 bg-black/50"
              onClick={(e) => e.stopPropagation()}
              onTouchStart={(e) => setPreviewTouchStartX(e.touches[0]?.clientX ?? null)}
              onTouchEnd={(e) => {
                if (previewTouchStartX === null) return;
                const touchEndX = e.changedTouches[0]?.clientX ?? previewTouchStartX;
                const delta = touchEndX - previewTouchStartX;
                if (Math.abs(delta) >= 40) {
                  if (delta > 0) {
                    goPrevPreview();
                  } else {
                    goNextPreview();
                  }
                }
                setPreviewTouchStartX(null);
              }}
            >
              <button
                type="button"
                onClick={closeMediaPreview}
                className="absolute top-2 right-2 z-10 bg-black/70 hover:bg-black p-1.5 rounded-full"
                aria-label="Cerrar vista previa"
              >
                <X className="w-5 h-5" />
              </button>

              {hasPreviewCarousel ? (
                <>
                  <button
                    type="button"
                    onClick={goPrevPreview}
                    className="absolute left-2 top-1/2 -translate-y-1/2 z-10 bg-black/70 hover:bg-black p-1.5 rounded-full"
                    aria-label="Media anterior"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <button
                    type="button"
                    onClick={goNextPreview}
                    className="absolute right-2 top-1/2 -translate-y-1/2 z-10 bg-black/70 hover:bg-black p-1.5 rounded-full"
                    aria-label="Media siguiente"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                  <div className="absolute top-2 left-2 z-10 text-xs px-2 py-1 rounded-full bg-black/70 text-white">
                    {previewMediaIndex + 1}/{previewMediaList.length}
                  </div>
                </>
              ) : null}

              <div className="w-full h-full flex items-center justify-center">
                {isPreviewVideo ? (
                  <video
                    src={previewMediaUrl}
                    className="w-full max-h-[88vh] object-contain"
                    controls
                    autoPlay
                    playsInline
                  />
                ) : (
                  <img
                    src={previewMediaUrl}
                    alt="Vista previa"
                    className="w-full max-h-[88vh] object-contain"
                  />
                )}
              </div>

              {hasPreviewCarousel ? (
                <div className="absolute bottom-3 left-0 right-0 z-10 flex justify-center gap-1.5">
                  {previewMediaList.map((_, index) => (
                    <button
                      key={`preview-dot-${index}`}
                      type="button"
                      onClick={() => setPreviewMediaIndex(index)}
                      className={`h-1.5 w-1.5 rounded-full ${
                        index === previewMediaIndex ? "bg-cyan-300" : "bg-white/50"
                      }`}
                      aria-label={`Ir a media ${index + 1}`}
                    />
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        ) : null}

        {showPublishSuccess ? (
          <div
            className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm p-3 sm:p-6 flex items-center justify-center"
            onClick={closePublishSuccessAndGoHome}
          >
            <div
              className="relative w-full max-w-lg rounded-2xl border border-white/20 bg-slate-900/90 px-6 py-10 text-center"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                onClick={closePublishSuccessAndGoHome}
                className="absolute top-3 right-3 p-1.5 rounded-full bg-black/70 hover:bg-black"
                aria-label="Cerrar"
              >
                <X className="w-5 h-5" />
              </button>

              <h3 className="text-sm text-white/90 font-semibold mb-7">Publicacion compartida</h3>

              <div className="mx-auto w-16 h-16 rounded-full bg-gradient-to-br from-yellow-400 via-pink-500 to-purple-500 p-[2px] mb-4">
                <div className="w-full h-full rounded-full bg-slate-900 flex items-center justify-center">
                  <Check className="w-8 h-8 text-pink-400" />
                </div>
              </div>

              <p className="text-white text-lg">Se compartió tu publicación.</p>
            </div>
          </div>
        ) : null}
    </div>
  );
};

export default Create;

