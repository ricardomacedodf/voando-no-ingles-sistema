import { supabase } from "@/api/supabaseClient";

const VIDEO_REF_PREFIX = "supabase-storage://";
const DEFAULT_VIDEO_PATH_PREFIX = "private";
const SIGNED_URL_EXPIRES_IN_SECONDS = 60 * 60 * 6;

const DIRECT_VIDEO_EXTENSIONS = new Set([
  "mp4",
  "webm",
  "mov",
  "m4v",
  "ogv",
  "ogg",
  "m3u8",
]);

const VIDEO_CONTENT_TYPES = {
  m4v: "video/mp4",
  mov: "video/quicktime",
  mp4: "video/mp4",
  ogg: "video/ogg",
  ogv: "video/ogg",
  webm: "video/webm",
};

export const EXAMPLE_VIDEO_BUCKET = "ASSETS";

const sanitizePathPart = (value) =>
  String(value || "")
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

const sanitizeFileExtension = (value) => {
  const normalized = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

  if (!normalized || normalized.length > 6) return "";
  return normalized;
};

const getFileExtension = (file) => {
  const byName = sanitizeFileExtension(file?.name?.split(".").pop());
  if (byName) return byName;

  const mime = String(file?.type || "").toLowerCase();
  if (mime.includes("webm")) return "webm";
  if (mime.includes("ogg")) return "ogg";
  if (mime.includes("quicktime")) return "mov";
  return "mp4";
};

export const getExampleVideoContentType = (file) => {
  const explicitType = String(file?.type || "").trim();
  if (explicitType) return explicitType;

  return VIDEO_CONTENT_TYPES[getFileExtension(file)] || "video/mp4";
};

export const getExampleVideoUploadPath = (userId, file) => {
  const safeUserId = sanitizePathPart(userId) || "user";
  const ext = getFileExtension(file);
  const randomPart =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

  return `${DEFAULT_VIDEO_PATH_PREFIX}/${safeUserId}/examples/${randomPart}.${ext}`;
};

export const createExampleVideoStorageRef = (
  bucket = EXAMPLE_VIDEO_BUCKET,
  path = ""
) => {
  const normalizedBucket = String(bucket || EXAMPLE_VIDEO_BUCKET).trim();
  const normalizedPath = String(path || "").replace(/^\/+/, "");

  if (!normalizedBucket || !normalizedPath) return "";
  return `${VIDEO_REF_PREFIX}${normalizedBucket}/${normalizedPath}`;
};

export const parseExampleVideoStorageRef = (value) => {
  const rawValue = typeof value === "string" ? value.trim() : "";
  if (!rawValue.startsWith(VIDEO_REF_PREFIX)) return null;

  const withoutPrefix = rawValue.slice(VIDEO_REF_PREFIX.length);
  const slashIndex = withoutPrefix.indexOf("/");
  if (slashIndex <= 0) return null;

  const bucket = withoutPrefix.slice(0, slashIndex);
  const path = withoutPrefix.slice(slashIndex + 1).replace(/^\/+/, "");

  if (!bucket || !path) return null;
  return { bucket, path };
};

export const isExampleVideoStorageRef = (value) =>
  Boolean(parseExampleVideoStorageRef(value));

export const resolveExampleVideoSource = async (value) => {
  const rawValue = typeof value === "string" ? value.trim() : "";
  if (!rawValue) return "";

  const storageRef = parseExampleVideoStorageRef(rawValue);
  if (!storageRef) return rawValue;

  const { data, error } = await supabase.storage
    .from(storageRef.bucket)
    .createSignedUrl(storageRef.path, SIGNED_URL_EXPIRES_IN_SECONDS);

  if (error || !data?.signedUrl) {
    throw error || new Error("Nao foi possivel gerar a URL assinada do video.");
  }

  return data.signedUrl;
};

const decodeHtmlEntities = (value) =>
  String(value || "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");

const getUrlCandidate = (value) => {
  const rawValue = decodeHtmlEntities(value).trim();
  if (!rawValue) return "";
  if (rawValue.startsWith("//")) return `https:${rawValue}`;
  return rawValue;
};

const parseUrl = (value) => {
  const candidate = getUrlCandidate(value);
  if (!candidate) return null;

  try {
    return new URL(candidate);
  } catch {
    return null;
  }
};

const getSafeHttpUrl = (value) => {
  const candidate = getUrlCandidate(value);
  const parsedUrl = parseUrl(candidate);

  if (!parsedUrl) return "";
  if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
    return "";
  }

  return candidate;
};

const getPathExtension = (value) => {
  const parsedUrl = parseUrl(value);
  const path = parsedUrl
    ? parsedUrl.pathname
    : String(value || "").split(/[?#]/)[0];
  const match = path.match(/\.([a-zA-Z0-9]+)$/);
  return match ? match[1].toLowerCase() : "";
};

const isDirectVideoSource = (value) => {
  const rawValue = typeof value === "string" ? value.trim() : "";
  if (!rawValue) return false;
  if (rawValue.startsWith("blob:")) return true;
  if (rawValue.startsWith("data:video/")) return true;

  return DIRECT_VIDEO_EXTENSIONS.has(getPathExtension(rawValue));
};

const isSupabaseStorageUrl = (url) =>
  Boolean(
    url?.hostname?.includes(".supabase.co") &&
      url?.pathname?.includes("/storage/v1/object/")
  );

const extractIframeSrc = (value) => {
  const rawValue = decodeHtmlEntities(value).trim();
  if (!rawValue) return "";

  const iframeMatch = rawValue.match(
    /<iframe\b[^>]*\bsrc\s*=\s*(?:"([^"]+)"|'([^']+)'|([^\s>]+))/i
  );

  const iframeSrc =
    iframeMatch?.[1] || iframeMatch?.[2] || iframeMatch?.[3] || "";

  return iframeSrc.trim();
};

const extractFirstUrl = (value) => {
  const rawValue = decodeHtmlEntities(value).trim();
  if (!rawValue) return "";

  const match = rawValue.match(/https?:\/\/[^\s"'<>[\]]+/i);
  return match?.[0]?.trim() || "";
};

const extractBBCodeUrl = (value) => {
  const rawValue = decodeHtmlEntities(value).trim();
  if (!rawValue) return "";

  const bbcodeAttributeMatch = rawValue.match(
    /\[(video|media|embed|url)\b[^\]]*=\s*["']?(https?:\/\/[^"'\]\s]+)["']?[^\]]*\][\s\S]*?\[\/\1\]/i
  );

  if (bbcodeAttributeMatch?.[2]) {
    return bbcodeAttributeMatch[2].trim();
  }

  const bbcodeTagMatch = rawValue.match(
    /\[(video|media|embed|url)\b[^\]]*\]([\s\S]*?)\[\/\1\]/i
  );

  if (bbcodeTagMatch?.[2]) {
    const innerValue = bbcodeTagMatch[2].trim();
    const innerUrl = extractFirstUrl(innerValue);

    return innerUrl || innerValue;
  }

  return "";
};

const normalizeExampleVideoInput = (value) => {
  const rawValue = typeof value === "string" ? value.trim() : "";
  if (!rawValue) return "";

  const iframeSrc = extractIframeSrc(rawValue);
  if (iframeSrc) return iframeSrc;

  const bbcodeUrl = extractBBCodeUrl(rawValue);
  if (bbcodeUrl) return bbcodeUrl;

  const looksLikeHtml = /<\/?[a-z][\s\S]*>/i.test(rawValue);
  if (looksLikeHtml) {
    return extractFirstUrl(rawValue);
  }

  return rawValue;
};

const parseYouTubeStart = (value) => {
  const rawValue = String(value || "").trim();
  if (!rawValue) return null;
  if (/^\d+$/.test(rawValue)) return Number(rawValue);

  const match = rawValue.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/i);
  if (!match) return null;

  const hours = Number(match[1] || 0);
  const minutes = Number(match[2] || 0);
  const seconds = Number(match[3] || 0);
  const totalSeconds = hours * 3600 + minutes * 60 + seconds;

  return totalSeconds > 0 ? totalSeconds : null;
};

const getYouTubeEmbedUrl = (url) => {
  const host = url.hostname.replace(/^www\./, "").toLowerCase();
  const pathParts = url.pathname.split("/").filter(Boolean);
  let videoId = "";

  if (host === "youtu.be") {
    videoId = pathParts[0] || "";
  } else if (host === "youtube.com" || host === "m.youtube.com") {
    if (pathParts[0] === "embed") videoId = pathParts[1] || "";
    else if (pathParts[0] === "shorts") videoId = pathParts[1] || "";
    else if (pathParts[0] === "live") videoId = pathParts[1] || "";
    else videoId = url.searchParams.get("v") || "";
  }

  if (!/^[a-zA-Z0-9_-]{6,}$/.test(videoId)) return "";

  const embedUrl = new URL(`https://www.youtube.com/embed/${videoId}`);
  const start = parseYouTubeStart(
    url.searchParams.get("start") || url.searchParams.get("t")
  );

  if (start) embedUrl.searchParams.set("start", String(start));

  return embedUrl.toString();
};

const getVimeoEmbedUrl = (url) => {
  const host = url.hostname.replace(/^www\./, "").toLowerCase();
  if (host !== "vimeo.com" && host !== "player.vimeo.com") return "";

  const pathParts = url.pathname.split("/").filter(Boolean);
  const videoId =
    host === "player.vimeo.com"
      ? pathParts[pathParts.indexOf("video") + 1]
      : [...pathParts].reverse().find((part) => /^\d+$/.test(part));

  if (!videoId) return "";

  const embedUrl = new URL(`https://player.vimeo.com/video/${videoId}`);

  url.searchParams.forEach((paramValue, paramKey) => {
    embedUrl.searchParams.set(paramKey, paramValue);
  });

  return embedUrl.toString();
};

const getGoogleDriveEmbedUrl = (url) => {
  const host = url.hostname.replace(/^www\./, "").toLowerCase();
  if (host !== "drive.google.com" && host !== "docs.google.com") return "";

  const byPath = url.pathname.match(/\/file\/d\/([^/]+)/);
  const fileId = byPath?.[1] || url.searchParams.get("id") || "";
  if (!fileId) return "";

  return `https://drive.google.com/file/d/${encodeURIComponent(fileId)}/preview`;
};

const getYarnEmbedUrl = (url) => {
  const host = url.hostname.replace(/^www\./, "").toLowerCase();
  if (host !== "yarn.co") return "";

  const pathParts = url.pathname.split("/").filter(Boolean);

  if (pathParts.includes("embed")) {
    return url.toString();
  }

  if (pathParts[0] === "yarn-clip" && pathParts[1]) {
    const embedUrl = new URL(
      `https://yarn.co/yarn-clip/${encodeURIComponent(pathParts[1])}/embed`
    );

    url.searchParams.forEach((paramValue, paramKey) => {
      embedUrl.searchParams.set(paramKey, paramValue);
    });

    if (!embedUrl.searchParams.has("autoplay")) {
      embedUrl.searchParams.set("autoplay", "false");
    }

    if (!embedUrl.searchParams.has("responsive")) {
      embedUrl.searchParams.set("responsive", "true");
    }

    return embedUrl.toString();
  }

  return "";
};

const getClipCafeEmbedUrl = (url) => {
  const host = url.hostname.replace(/^www\./, "").toLowerCase();
  if (host !== "clip.cafe") return "";

  const pathParts = url.pathname.split("/").filter(Boolean);

  if (pathParts[0] === "e" && pathParts[1]) {
    return url.toString();
  }

  return url.toString();
};

const getPlayPhraseEmbedUrl = (url) => {
  const host = url.hostname.replace(/^www\./, "").toLowerCase();

  if (
    host !== "playphrase.me" &&
    host !== "www.playphrase.me" &&
    host !== "playphrase.com"
  ) {
    return "";
  }

  return url.toString();
};

const getKnownEmbedUrl = (url) =>
  getYouTubeEmbedUrl(url) ||
  getVimeoEmbedUrl(url) ||
  getGoogleDriveEmbedUrl(url) ||
  getYarnEmbedUrl(url) ||
  getClipCafeEmbedUrl(url) ||
  getPlayPhraseEmbedUrl(url);

const buildPlaybackConfig = (originalValue, resolvedValue) => {
  const rawOriginal = typeof originalValue === "string" ? originalValue.trim() : "";
  const normalizedOriginal = normalizeExampleVideoInput(rawOriginal);
  const normalizedResolved = normalizeExampleVideoInput(resolvedValue);
  const playableValue = getUrlCandidate(normalizedResolved || normalizedOriginal);
  const parsedUrl = parseUrl(playableValue);

  const fallbackOpenUrl =
    getSafeHttpUrl(normalizedOriginal) ||
    getSafeHttpUrl(extractFirstUrl(rawOriginal)) ||
    "";

  if (!playableValue) {
    return {
      type: "fallback",
      originalUrl: rawOriginal,
      openUrl: fallbackOpenUrl,
    };
  }

  if (!parsedUrl) {
    if (isDirectVideoSource(playableValue)) {
      return {
        type: "video",
        src: playableValue,
        originalUrl: rawOriginal,
        openUrl: playableValue,
      };
    }

    return {
      type: "fallback",
      originalUrl: rawOriginal,
      openUrl: fallbackOpenUrl,
    };
  }

  if (isDirectVideoSource(playableValue) || isSupabaseStorageUrl(parsedUrl)) {
    return {
      type: "video",
      src: playableValue,
      originalUrl: rawOriginal,
      openUrl: playableValue,
    };
  }

  if (parsedUrl.protocol === "http:" || parsedUrl.protocol === "https:") {
    const knownEmbedUrl = getKnownEmbedUrl(parsedUrl);
    const iframeSrc = getSafeHttpUrl(knownEmbedUrl || playableValue);

    if (!iframeSrc) {
      return {
        type: "fallback",
        originalUrl: rawOriginal,
        openUrl: fallbackOpenUrl,
      };
    }

    return {
      type: "iframe",
      src: iframeSrc,
      originalUrl: rawOriginal,
      openUrl: getSafeHttpUrl(playableValue) || fallbackOpenUrl,
    };
  }

  return {
    type: "fallback",
    originalUrl: rawOriginal,
    openUrl: fallbackOpenUrl,
  };
};

export const resolveExampleVideoPlayback = async (value) => {
  const rawValue = typeof value === "string" ? value.trim() : "";

  if (!rawValue) {
    return {
      type: "fallback",
      originalUrl: "",
      openUrl: "",
    };
  }

  const normalizedValue = normalizeExampleVideoInput(rawValue);

  try {
    const resolvedSource = await resolveExampleVideoSource(normalizedValue);
    return buildPlaybackConfig(rawValue, resolvedSource);
  } catch (error) {
    console.error("Nao foi possivel resolver o video do exemplo:", error);

    return {
      type: "fallback",
      originalUrl: rawValue,
      openUrl:
        getSafeHttpUrl(normalizedValue) ||
        getSafeHttpUrl(extractFirstUrl(rawValue)) ||
        "",
    };
  }
};

export const getExampleVideoDisplayLabel = (value) => {
  const rawValue = typeof value === "string" ? value.trim() : "";
  const storageRef = parseExampleVideoStorageRef(rawValue);
  if (!storageRef) return rawValue;

  return `${storageRef.bucket}/${storageRef.path}`;
};