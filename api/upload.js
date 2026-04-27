import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const MAX_VIDEO_UPLOAD_BYTES = 200 * 1024 * 1024;

const ALLOWED_VIDEO_TYPES = new Set([
  "video/mp4",
  "video/webm",
  "video/quicktime",
  "video/ogg",
  "video/x-m4v",
]);

const ALLOWED_ORIGINS = new Set([
  "http://localhost:5173",
  "http://localhost:3000",
  "http://localhost:3001",
]);

function loadLocalEnvFile(fileName) {
  try {
    const filePath = path.join(process.cwd(), fileName);

    if (!fs.existsSync(filePath)) return;

    const content = fs.readFileSync(filePath, "utf8");

    content.split(/\r?\n/).forEach((line) => {
      const trimmedLine = line.trim();

      if (!trimmedLine || trimmedLine.startsWith("#")) return;

      const equalIndex = trimmedLine.indexOf("=");

      if (equalIndex === -1) return;

      const key = trimmedLine.slice(0, equalIndex).trim();
      const value = trimmedLine.slice(equalIndex + 1).trim();

      if (!key || process.env[key]) return;

      process.env[key] = value;
    });
  } catch (error) {
    console.error(`Erro ao carregar ${fileName}:`, error);
  }
}

loadLocalEnvFile(".env.local");
loadLocalEnvFile(".env");

function setCorsHeaders(req, res) {
  const origin = req.headers.origin;

  if (origin && ALLOWED_ORIGINS.has(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  }

  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

function getEnvValue(name) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Variável de ambiente ausente: ${name}`);
  }

  return value;
}

function sanitizeFileName(value) {
  const cleanValue = String(value || "video")
    .trim()
    .toLowerCase()
    .replace(/\.[^/.]+$/, "")
    .replace(/[^a-z0-9_-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);

  return cleanValue || "video";
}

function getFileExtension(fileName, contentType) {
  const extensionFromName = String(fileName || "")
    .split(".")
    .pop()
    ?.toLowerCase()
    ?.replace(/[^a-z0-9]/g, "");

  if (extensionFromName) return extensionFromName;

  if (contentType === "video/webm") return "webm";
  if (contentType === "video/quicktime") return "mov";
  if (contentType === "video/ogg") return "ogg";
  if (contentType === "video/x-m4v") return "m4v";

  return "mp4";
}

function getUploadFolder(scope) {
  const cleanScope = String(scope || "example").trim().toLowerCase();

  if (
    cleanScope === "word" ||
    cleanScope === "word-video" ||
    cleanScope === "global" ||
    cleanScope === "global-video" ||
    cleanScope === "palavra" ||
    cleanScope === "termo"
  ) {
    return "words";
  }

  if (
    cleanScope === "meaning" ||
    cleanScope === "meaning-video" ||
    cleanScope === "significado"
  ) {
    return "meanings";
  }

  return "examples";
}

function createR2Client() {
  return new S3Client({
    region: "auto",
    endpoint: getEnvValue("R2_ENDPOINT"),
    credentials: {
      accessKeyId: getEnvValue("R2_ACCESS_KEY_ID"),
      secretAccessKey: getEnvValue("R2_SECRET_ACCESS_KEY"),
    },
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
  });
}

export default async function handler(req, res) {
  setCorsHeaders(req, res);

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Método não permitido.",
    });
  }

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;

    const fileName = String(body?.fileName || "");
    const contentType = String(body?.contentType || "");
    const size = Number(body?.size || 0);
    const uploadFolder = getUploadFolder(body?.scope ?? body?.folder);

    if (!fileName) {
      return res.status(400).json({
        error: "Nome do arquivo não informado.",
      });
    }

    if (!ALLOWED_VIDEO_TYPES.has(contentType)) {
      return res.status(400).json({
        error: "Formato de vídeo não permitido.",
      });
    }

    if (!size || size > MAX_VIDEO_UPLOAD_BYTES) {
      return res.status(400).json({
        error: "Vídeo muito grande. O limite configurado é 200 MB.",
      });
    }

    const bucketName = getEnvValue("R2_BUCKET_NAME");
    const publicUrl = getEnvValue("R2_PUBLIC_URL").replace(/\/+$/, "");

    const cleanName = sanitizeFileName(fileName);
    const extension = getFileExtension(fileName, contentType);

    const key = `${uploadFolder}/${new Date()
      .toISOString()
      .slice(0, 10)}/${randomUUID()}-${cleanName}.${extension}`;

    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: key,
      ContentType: contentType,
      CacheControl: "public, max-age=31536000, immutable",
    });

    const uploadUrl = await getSignedUrl(createR2Client(), command, {
      expiresIn: 60 * 5,
    });

    return res.status(200).json({
      uploadUrl,
      publicUrl: `${publicUrl}/${key}`,
      key,
      folder: uploadFolder,
    });
  } catch (error) {
    console.error("Erro ao criar URL de upload R2:", error);

    return res.status(500).json({
      error: error?.message || "Não foi possível preparar o upload para o R2.",
    });
  }
}