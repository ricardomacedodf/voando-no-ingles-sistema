import { DeleteObjectCommand, S3Client } from "@aws-sdk/client-s3";
import fs from "node:fs";
import path from "node:path";

const ALLOWED_ORIGINS = new Set([
  "http://localhost:5173",
  "http://localhost:3000",
  "http://localhost:3001",
]);

const ALLOWED_R2_PREFIXES = ["words/", "meanings/", "examples/"];

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

function getR2ObjectKeyFromPublicUrl(videoUrl) {
  if (!videoUrl || typeof videoUrl !== "string") return null;

  const publicUrl = getEnvValue("R2_PUBLIC_URL").replace(/\/+$/, "");

  let videoParsed;
  let publicParsed;

  try {
    videoParsed = new URL(videoUrl.trim());
    publicParsed = new URL(publicUrl);
  } catch {
    return null;
  }

  if (videoParsed.origin !== publicParsed.origin) return null;

  const publicPath = publicParsed.pathname.replace(/\/+$/, "");
  const videoPath = videoParsed.pathname;

  if (publicPath && !videoPath.startsWith(`${publicPath}/`)) {
    return null;
  }

  const rawKey = videoPath.slice(publicPath.length).replace(/^\/+/, "");

  if (!rawKey) return null;

  const key = decodeURIComponent(rawKey);

  if (!ALLOWED_R2_PREFIXES.some((prefix) => key.startsWith(prefix))) {
    return null;
  }

  return key;
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

    const videoUrl = String(body?.videoUrl || "").trim();
    const key = getR2ObjectKeyFromPublicUrl(videoUrl);

    if (!key) {
      return res.status(200).json({
        deleted: false,
        skipped: true,
        message:
          "O vídeo não pertence ao Cloudflare R2 deste sistema. Nada foi apagado.",
      });
    }

    const bucketName = getEnvValue("R2_BUCKET_NAME");

    const command = new DeleteObjectCommand({
      Bucket: bucketName,
      Key: key,
    });

    await createR2Client().send(command);

    return res.status(200).json({
      deleted: true,
      key,
    });
  } catch (error) {
    console.error("Erro ao apagar vídeo do R2:", error);

    return res.status(500).json({
      error: error?.message || "Não foi possível apagar o vídeo do R2.",
    });
  }
}