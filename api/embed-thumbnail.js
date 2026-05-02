const normalizeText = (value) => (typeof value === "string" ? value.trim() : "");

const ALLOWED_ORIGINS = new Set([
  "http://localhost:5173",
  "http://127.0.0.1:5173",
]);

const setCorsHeaders = (req, res) => {
  const origin = req.headers.origin;

  if (ALLOWED_ORIGINS.has(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  } else {
    res.setHeader("Access-Control-Allow-Origin", "*");
  }

  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, X-Requested-With"
  );
};

const decodeHtmlEntities = (value) =>
  String(value || "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");

const stripTags = (value) => String(value || "").replace(/<[^>]*>/g, "");

const slugify = (value) =>
  decodeHtmlEntities(stripTags(value))
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-+/g, "-");

const extractIframeSrc = (value) => {
  const rawValue = decodeHtmlEntities(value).trim();
  if (!rawValue) return "";

  const match = rawValue.match(
    /<iframe\b[^>]*\bsrc\s*=\s*(?:"([^"]+)"|'([^']+)'|([^\s>]+))/i
  );

  return normalizeText(match?.[1] || match?.[2] || match?.[3] || "");
};

const extractFirstUrl = (value) => {
  const rawValue = decodeHtmlEntities(value).trim();
  if (!rawValue) return "";

  const match = rawValue.match(/https?:\/\/[^\s"'<>[\]]+/i);
  return normalizeText(match?.[0] || "");
};

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
  const parsedUrl = parseUrl(value);
  if (!parsedUrl) return "";
  if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") return "";
  return parsedUrl.toString();
};

const normalizeVideoInput = (value) => {
  const rawValue = normalizeText(value);
  if (!rawValue) return "";

  const iframeSrc = extractIframeSrc(rawValue);
  if (iframeSrc) return iframeSrc;

  const firstUrl = extractFirstUrl(rawValue);
  return firstUrl || rawValue;
};

const getExplicitImageUrl = (value) => {
  const rawValue = decodeHtmlEntities(value).trim();

  const match = rawValue.match(
    /https?:\/\/[^\s"'<>[\]]+\.(?:jpe?g|png|webp)(?:\?[^\s"'<>[\]]*)?/i
  );

  return normalizeText(match?.[0] || "");
};

const getMetaImageFromHtml = (html, baseUrl) => {
  const patterns = [
    /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["'][^>]*>/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["'][^>]*>/i,
    /<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["'][^>]*>/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image["'][^>]*>/i,
    /<meta[^>]+property=["']og:image:secure_url["'][^>]+content=["']([^"']+)["'][^>]*>/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image:secure_url["'][^>]*>/i,
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    const image = normalizeText(match?.[1] || "");

    if (!image) continue;

    try {
      return new URL(decodeHtmlEntities(image), baseUrl).toString();
    } catch {
      return image;
    }
  }

  return "";
};

const getClipCafeImageFromHtml = (html, baseUrl) => {
  const patterns = [
    /["']([^"']*\/img800\/[^"']+\.(?:jpe?g|png|webp)(?:\?[^"']*)?)["']/i,
    /["']([^"']*\/img\/[^"']+\.(?:jpe?g|png|webp)(?:\?[^"']*)?)["']/i,
    /src=["']([^"']*clip\.cafe\/[^"']+\.(?:jpe?g|png|webp)(?:\?[^"']*)?)["']/i,
    /src=["']([^"']+\.(?:jpe?g|png|webp)(?:\?[^"']*)?)["']/i,
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    const image = normalizeText(match?.[1] || "");

    if (!image) continue;

    try {
      return new URL(decodeHtmlEntities(image), baseUrl).toString();
    } catch {
      return image;
    }
  }

  return "";
};

const getClipCafeTitleFromHtml = (html) => {
  const ogTitleMatch =
    html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["'][^>]*>/i) ||
    html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:title["'][^>]*>/i);

  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);

  const rawTitle = normalizeText(ogTitleMatch?.[1] || titleMatch?.[1] || "");

  return decodeHtmlEntities(rawTitle)
    .replace(/\s*-\s*Clip\s*Caf[eé].*$/i, "")
    .replace(/\s*\|\s*Clip\s*Caf[eé].*$/i, "")
    .replace(/^Clip\s*Caf[eé]\s*-\s*/i, "")
    .trim();
};

const getProviderThumbnailCandidate = (videoUrl) => {
  const parsedUrl = parseUrl(videoUrl);
  if (!parsedUrl) return "";

  const host = parsedUrl.hostname.replace(/^www\./, "").toLowerCase();
  const pathParts = parsedUrl.pathname.split("/").filter(Boolean);

  if (host === "youtu.be" || host === "youtube.com" || host === "m.youtube.com") {
    const videoId =
      host === "youtu.be"
        ? pathParts[0]
        : pathParts[0] === "embed" ||
          pathParts[0] === "shorts" ||
          pathParts[0] === "live"
        ? pathParts[1]
        : parsedUrl.searchParams.get("v");

    if (videoId) return `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
  }

  if (host === "vimeo.com" || host === "player.vimeo.com") {
    const videoId =
      host === "player.vimeo.com"
        ? pathParts[pathParts.indexOf("video") + 1]
        : [...pathParts].reverse().find((part) => /^\d+$/.test(part));

    if (videoId) return `https://vumbnail.com/${videoId}.jpg`;
  }

  if (host === "dailymotion.com" || host === "dai.ly") {
    const videoIndex = pathParts.indexOf("video");
    const videoId =
      videoIndex >= 0
        ? pathParts[videoIndex + 1]
        : host === "dai.ly"
        ? pathParts[0]
        : "";

    if (videoId) return `https://www.dailymotion.com/thumbnail/video/${videoId}`;
  }

  if (host === "yarn.co") {
    const clipIndex = pathParts.indexOf("yarn-clip");
    const clipId = clipIndex >= 0 ? pathParts[clipIndex + 1] : "";
    if (clipId) return `https://y.yarn.co/${clipId}_thumb.jpg`;
  }

  return "";
};

const isLikelyImageReachable = async (url) => {
  const safeUrl = getSafeHttpUrl(url);
  if (!safeUrl || typeof fetch !== "function") return false;

  try {
    const response = await fetch(safeUrl, {
      method: "HEAD",
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; EmbedThumbnailBot/1.0)",
      },
    });

    if (response.ok) return true;
  } catch {
    // Alguns sites bloqueiam HEAD.
  }

  try {
    const response = await fetch(safeUrl, {
      method: "GET",
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; EmbedThumbnailBot/1.0)",
        Accept: "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
      },
    });

    return response.ok;
  } catch {
    return false;
  }
};

const getClipCafeThumbnail = async (videoUrl) => {
  const parsedUrl = parseUrl(videoUrl);
  if (!parsedUrl) return "";

  const host = parsedUrl.hostname.replace(/^www\./, "").toLowerCase();
  if (host !== "clip.cafe") return "";

  const response = await fetch(videoUrl, {
    method: "GET",
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; EmbedThumbnailBot/1.0)",
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    },
  });

  if (!response.ok) return "";

  const html = await response.text();

  const metaImage = getMetaImageFromHtml(html, videoUrl);
  if (metaImage) return metaImage;

  const imageFromHtml = getClipCafeImageFromHtml(html, videoUrl);
  if (imageFromHtml) return imageFromHtml;

  const title = getClipCafeTitleFromHtml(html);
  const slug = slugify(title);

  if (!slug) return "";

  const candidates = [
    `https://clip.cafe/img800/${slug}.jpg`,
    `https://clip.cafe/img800/${slug}.jpeg`,
    `https://clip.cafe/img800/${slug}.webp`,
  ];

  for (const candidate of candidates) {
    if (await isLikelyImageReachable(candidate)) {
      return candidate;
    }
  }

  // Se o servidor bloquear HEAD/GET da imagem, devolve o candidato mais provável
  // para o navegador tentar renderizar.
  return candidates[0];
};

const resolveThumbnail = async (video) => {
  const cleanVideo = normalizeText(video);
  const explicitImage = getExplicitImageUrl(cleanVideo);

  if (explicitImage) {
    return explicitImage;
  }

  const videoUrl = getSafeHttpUrl(normalizeVideoInput(cleanVideo));

  if (!videoUrl) {
    return "";
  }

  const clipCafeThumbnail = await getClipCafeThumbnail(videoUrl);

  if (clipCafeThumbnail) {
    return clipCafeThumbnail;
  }

  const providerCandidate = getProviderThumbnailCandidate(videoUrl);

  if (providerCandidate) {
    return providerCandidate;
  }

  try {
    const response = await fetch(videoUrl, {
      method: "GET",
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; EmbedThumbnailBot/1.0)",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
    });

    if (!response.ok) {
      return "";
    }

    const html = await response.text();
    const metaImage = getMetaImageFromHtml(html, videoUrl);

    return metaImage || "";
  } catch {
    return "";
  }
};

export default async function handler(req, res) {
  setCorsHeaders(req, res);

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.method !== "GET" && req.method !== "POST") {
    res.setHeader("Allow", "GET, POST, OPTIONS");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const video =
    req.method === "GET"
      ? normalizeText(req.query?.video || req.query?.url || "")
      : normalizeText(req.body?.video || req.body?.url || "");

  try {
    const thumbnail = await resolveThumbnail(video);
    return res.status(200).json({ thumbnail });
  } catch (error) {
    return res.status(200).json({
      thumbnail: "",
      error: error?.message || "Não foi possível resolver a thumbnail.",
    });
  }
}
