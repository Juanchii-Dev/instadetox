export const formatCompact = (value: number) =>
  new Intl.NumberFormat("es-AR", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(Math.max(0, value));

export const isVideoUrl = (mediaUrl: string | null) => {
  if (!mediaUrl) return false;
  return /\.(mp4|webm|mov|m4v|ogg)(\?|$)/i.test(mediaUrl) || mediaUrl.includes(".m3u8");
};

export const parseMediaList = (mediaUrl: string | null): string[] => {
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
      // fallback
    }
  }

  return raw
    .split(/[\n,|]/g)
    .map((item) => item.trim())
    .filter(Boolean);
};

export const parseStoragePathFromPublicUrl = (url: string | null): { bucket: string; path: string } | null => {
  if (!url) return null;
  const match = url.match(/\/storage\/v1\/object\/public\/([^/]+)\/(.+)$/i);
  if (!match) return null;
  const [, bucket, rawPath] = match;
  return { bucket, path: decodeURIComponent(rawPath) };
};

export const sanitizeFileName = (name: string) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

export const formatRelativeTime = (isoDate: string) => {
  const now = Date.now();
  const at = new Date(isoDate).getTime();
  const diffMs = Math.max(0, now - at);
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (diffMs < minute) return "ahora";
  if (diffMs < hour) return `hace ${Math.floor(diffMs / minute)} min`;
  if (diffMs < day) return `hace ${Math.floor(diffMs / hour)} h`;
  return `hace ${Math.floor(diffMs / day)} d`;
};

export const escapeForRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export const stripLeadingMention = (value: string, username: string) => {
  const safeUsername = escapeForRegex(username);
  const pattern = new RegExp(`^@${safeUsername}\\b\\s*`, "i");
  return value.replace(pattern, "");
};

export const generateUUID = () => {
  const c = globalThis.crypto;
  if (c?.randomUUID) return c.randomUUID();
  if (!c?.getRandomValues) {
    throw new Error("No se pudo generar un ID seguro.");
  }
  const bytes = new Uint8Array(16);
  c.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
};

export const createClientCommentId = generateUUID;

export const getOptimizedImageUrl = (url: string | null, width?: number, quality = 80): string => {
  if (!url) return "";
  
  // Si no es un endpoint de supabase storage targeteable, lo devolvemos tal cual.
  // Evitamos procesar videos o recursos externos.
  if (!url.includes("/storage/v1/object/public/") || isVideoUrl(url)) {
    return url;
  }

  // M12: Solo transformamos si explícitamente se pide y detectamos que es Supabase.
  // Si hay problemas con el servicio de transformación (Error 500), 
  // el componente puede decidir usar la URL original.
  try {
    const optimizedUrl = new URL(url.replace("/storage/v1/object/public/", "/storage/v1/render/image/public/"));
    
    if (width) {
      optimizedUrl.searchParams.set("width", width.toString());
    }
    optimizedUrl.searchParams.set("quality", quality.toString());
    optimizedUrl.searchParams.set("format", "auto"); 
    optimizedUrl.searchParams.set("resize", "contain");
    
    return optimizedUrl.toString();
  } catch (e) {
    return url;
  }
};
