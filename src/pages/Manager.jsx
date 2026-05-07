import { useState, useEffect } from "react";
import {
  Plus,
  Search,
  Trash2,
  Download,
  Upload,
  AlertTriangle,
  ChevronRight,
} from "lucide-react";
import { supabase } from "@/api/supabaseClient";
import { useAuth } from "../contexts/AuthContext";
import ManagerForm from "../components/ManagerForm";
import ManagerImport from "../components/ManagerImport";
import { createInitialStats, normalizeVocabularyItem } from "../lib/learningEngine";
import {
  getCachedVocabularyRows,
  setCachedVocabularyRows,
} from "../lib/vocabularyCache";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const getR2DeleteApiUrl = () => {
  const customUrl = import.meta.env.VITE_R2_DELETE_API_URL;

  if (customUrl) return customUrl;

  const isLocalVite =
    typeof window !== "undefined" &&
    window.location.hostname === "localhost" &&
    window.location.port === "5173";

  if (isLocalVite) {
    return "http://localhost:3000/api/delete-video";
  }

  return "/api/delete-video";
};

function normalizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function getWordVideoFromMeanings(item) {
  if (!Array.isArray(item?.meanings)) return "";

  const meaningWithVideo = item.meanings.find((meaning) =>
    normalizeText(meaning?._wordVideo || meaning?._globalVideo)
  );

  return normalizeText(
    meaningWithVideo?._wordVideo || meaningWithVideo?._globalVideo || ""
  );
}

function getWordThumbnailFromMeanings(item) {
  if (!Array.isArray(item?.meanings)) return "";

  const meaningWithThumbnail = item.meanings.find((meaning) =>
    normalizeText(meaning?._wordThumbnail || meaning?._globalThumbnail)
  );

  return normalizeText(
    meaningWithThumbnail?._wordThumbnail ||
      meaningWithThumbnail?._globalThumbnail ||
      ""
  );
}

function normalizeWordVideo(item) {
  const rawVideo =
    item?.video ??
    item?.videoUrl ??
    item?.video_url ??
    item?.wordVideo ??
    item?.word_video ??
    item?.globalVideo ??
    item?.global_video ??
    item?.stats?.video ??
    item?.stats?.videoUrl ??
    item?.stats?.video_url ??
    item?.stats?.wordVideo ??
    item?.stats?.word_video ??
    item?.stats?.globalVideo ??
    item?.stats?.global_video ??
    getWordVideoFromMeanings(item) ??
    "";

  return normalizeText(rawVideo);
}

function normalizeWordThumbnail(item) {
  const rawThumbnail =
    item?.thumbnail ??
    item?.thumbnailUrl ??
    item?.thumbnail_url ??
    item?.wordThumbnail ??
    item?.word_thumbnail ??
    item?.globalThumbnail ??
    item?.global_thumbnail ??
    item?.stats?.thumbnail ??
    item?.stats?.thumbnailUrl ??
    item?.stats?.thumbnail_url ??
    item?.stats?.wordThumbnail ??
    item?.stats?.word_thumbnail ??
    item?.stats?.globalThumbnail ??
    item?.stats?.global_thumbnail ??
    getWordThumbnailFromMeanings(item) ??
    "";

  return normalizeText(rawThumbnail);
}

function normalizeVideoEntry(entry) {
  if (typeof entry === "string") {
    const video = normalizeText(entry);
    return video ? { video } : null;
  }

  if (!entry || typeof entry !== "object") return null;

  const video = normalizeText(
    entry.video ??
      entry.videoUrl ??
      entry.video_url ??
      entry.wordVideo ??
      entry.word_video ??
      entry.globalVideo ??
      entry.global_video ??
      ""
  );

  return video ? { video } : null;
}

function normalizeVideoList(value) {
  if (!value) return [];

  if (Array.isArray(value)) {
    return value.map(normalizeVideoEntry).filter(Boolean);
  }

  const entry = normalizeVideoEntry(value);

  return entry ? [entry] : [];
}

function getWordVideosFromMeanings(item) {
  if (!Array.isArray(item?.meanings)) return [];

  const meaningWithVideos = item.meanings.find((meaning) => {
    const videos = normalizeVideoList(
      meaning?._wordVideos || meaning?._globalVideos
    );

    return videos.length > 0;
  });

  if (meaningWithVideos) {
    return normalizeVideoList(
      meaningWithVideos?._wordVideos || meaningWithVideos?._globalVideos
    );
  }

  return normalizeVideoList(getWordVideoFromMeanings(item));
}

function normalizeMeaningVideo(meaning) {
  const rawVideo =
    meaning?.video ??
    meaning?.videoUrl ??
    meaning?.video_url ??
    meaning?.meaningVideo ??
    meaning?.meaning_video ??
    "";

  return normalizeText(rawVideo);
}

function normalizeExampleVideo(example) {
  const rawVideo =
    example?.video ?? example?.videoUrl ?? example?.video_url ?? "";

  return normalizeText(rawVideo);
}

function isThirdPartyEmbeddedVideo(value) {
  const cleanValue = normalizeText(value);

  if (!cleanValue) return false;

  return (
    /<iframe/i.test(cleanValue) ||
    /\[iframe/i.test(cleanValue) ||
    /youtube\.com|youtu\.be|vimeo\.com|dailymotion\.com|dai\.ly|tiktok\.com|instagram\.com|facebook\.com\/plugins\/video|player\.twitch\.tv|clip\.cafe|playphrase\.me|yarn\.co|y\.yarn\.co/i.test(
      cleanValue
    )
  );
}

function shouldDeleteVideoFromR2(videoUrl) {
  const cleanVideoUrl = normalizeText(videoUrl);

  return Boolean(cleanVideoUrl) && !isThirdPartyEmbeddedVideo(cleanVideoUrl);
}

function collectVocabularyVideoUrls(item) {
  if (!item) return [];

  const wordVideos = [
    ...normalizeVideoList(item?.wordVideos),
    ...normalizeVideoList(item?.word_videos),
    ...normalizeVideoList(item?.globalVideos),
    ...normalizeVideoList(item?.global_videos),
    ...normalizeVideoList(item?.stats?.wordVideos),
    ...normalizeVideoList(item?.stats?.word_videos),
    ...normalizeVideoList(item?.stats?.globalVideos),
    ...normalizeVideoList(item?.stats?.global_videos),
    ...getWordVideosFromMeanings(item),
    ...normalizeVideoList(normalizeWordVideo(item)),
  ].map((entry) => normalizeText(entry?.video));

  const meaningAndExampleVideos = Array.isArray(item?.meanings)
    ? item.meanings.flatMap((meaning) => {
        const meaningVideo = normalizeMeaningVideo(meaning);

        const exampleVideos = Array.isArray(meaning?.examples)
          ? meaning.examples.map((example) => normalizeExampleVideo(example))
          : [];

        return [meaningVideo, ...exampleVideos];
      })
    : [];

  return Array.from(
    new Set([...wordVideos, ...meaningAndExampleVideos].filter(Boolean))
  );
}

async function deleteVideoFromR2(videoUrl) {
  const cleanVideoUrl = normalizeText(videoUrl);

  if (!shouldDeleteVideoFromR2(cleanVideoUrl)) return;

  const response = await fetch(getR2DeleteApiUrl(), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      videoUrl: cleanVideoUrl,
    }),
  });

  let data = null;

  try {
    data = await response.json();
  } catch {
    data = null;
  }

  if (!response.ok) {
    throw new Error(
      data?.error || "Não foi possível apagar o vídeo do Cloudflare R2."
    );
  }
}

async function deleteVideosFromR2(videoUrls) {
  const uniqueVideoUrls = Array.from(
    new Set((Array.isArray(videoUrls) ? videoUrls : []).map(normalizeText))
  ).filter(Boolean);

  for (const videoUrl of uniqueVideoUrls) {
    await deleteVideoFromR2(videoUrl);
  }
}

function normalizeExportVideoEntry(entry, fallbackThumbnail = "") {
  if (typeof entry === "string") {
    const video = normalizeText(entry);
    return video
      ? {
          video,
          thumbnail: normalizeText(fallbackThumbnail),
        }
      : null;
  }

  if (!entry || typeof entry !== "object") return null;

  const video = normalizeText(
    entry.video ??
      entry.videoUrl ??
      entry.video_url ??
      entry.wordVideo ??
      entry.word_video ??
      entry.globalVideo ??
      entry.global_video ??
      ""
  );

  if (!video) return null;

  return {
    video,
    thumbnail: normalizeText(
      entry.thumbnail ??
        entry.thumbnailUrl ??
        entry.thumbnail_url ??
        entry.wordThumbnail ??
        entry.word_thumbnail ??
        entry.globalThumbnail ??
        entry.global_thumbnail ??
        fallbackThumbnail
    ),
  };
}

function normalizeExportVideoList(value, fallbackThumbnail = "") {
  if (!value) return [];

  if (Array.isArray(value)) {
    return value
      .map((entry) => normalizeExportVideoEntry(entry, fallbackThumbnail))
      .filter(Boolean);
  }

  const entry = normalizeExportVideoEntry(value, fallbackThumbnail);

  return entry ? [entry] : [];
}

function dedupeExportVideoEntries(entries) {
  const seen = new Set();

  return entries.filter((entry) => {
    const video = normalizeText(entry?.video);

    if (!video || seen.has(video)) return false;

    seen.add(video);
    return true;
  });
}

function buildVocabularyExportItem(item) {
  const fallbackWordThumbnail = normalizeWordThumbnail(item);
  const wordVideos = dedupeExportVideoEntries([
    ...normalizeExportVideoList(item?.wordVideos, fallbackWordThumbnail),
    ...normalizeExportVideoList(item?.word_videos, fallbackWordThumbnail),
    ...normalizeExportVideoList(item?.globalVideos, fallbackWordThumbnail),
    ...normalizeExportVideoList(item?.global_videos, fallbackWordThumbnail),
    ...normalizeExportVideoList(item?.stats?.wordVideos, fallbackWordThumbnail),
    ...normalizeExportVideoList(item?.stats?.word_videos, fallbackWordThumbnail),
    ...normalizeExportVideoList(item?.stats?.globalVideos, fallbackWordThumbnail),
    ...normalizeExportVideoList(item?.stats?.global_videos, fallbackWordThumbnail),
    ...normalizeExportVideoList(normalizeWordVideo(item), fallbackWordThumbnail),
  ]);

  return {
    term: item?.term || "",
    pronunciation: item?.pronunciation || "",
    wordVideos,
    video: normalizeWordVideo(item),
    thumbnail: fallbackWordThumbnail,
    meanings: (item?.meanings || []).map((meaning) => {
      const meaningVideo = normalizeMeaningVideo(meaning);

      return {
        meaning: meaning?.meaning || "",
        category: meaning?.category || "",
        tip: meaning?.tip || "",
        video: meaningVideo,
        thumbnail: normalizeText(
          meaning?.thumbnail ?? meaning?.thumbnailUrl ?? meaning?.thumbnail_url ?? ""
        ),
        examples: (meaning?.examples || []).map((example) => {
          const exampleVideo = normalizeExampleVideo(example);

          return {
            sentence: example?.sentence || "",
            translation: example?.translation || "",
            video: exampleVideo,
            thumbnail: normalizeText(
              example?.thumbnail ?? example?.thumbnailUrl ?? example?.thumbnail_url ?? ""
            ),
          };
        }),
      };
    }),
  };
}

function downloadVocabularyJson(items, fileName) {
  const blob = new Blob([JSON.stringify(items, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");

  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

function createSafeFileName(value) {
  const cleanValue = normalizeText(value)
    .replace(/[\\/:*?"<>|]+/g, "")
    .replace(/\s+/g, " ")
    .trim();

  return cleanValue || "palavra";
}

function mapVocabularyRow(row) {
  const normalized = normalizeVocabularyItem({
    ...row,
    stats: row.stats || createInitialStats(),
  });

  return {
    ...normalized,
    video: normalizeWordVideo(row),
    thumbnail: normalizeWordThumbnail(row),
  };
}

function VideoAttachmentGlyph({ className = "" }) {
  return (
    <svg
      viewBox="0 0 1024 1024"
      fill="none"
      aria-hidden="true"
      focusable="false"
      className={className}
    >
      <path
        d="M200 760H565M200 760C145 760 110 725 110 670V280C110 225 145 190 200 190H760C815 190 850 225 850 280V475"
        stroke="currentColor"
        strokeWidth="32"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M430 385C430 366 451 355 467 365L620 460C636 470 636 494 620 504L467 599C451 609 430 598 430 579Z"
        stroke="currentColor"
        strokeWidth="32"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M685 790L847 628C892 583 965 615 965 679C965 699 957 718 943 732L777 898C716 959 615 916 615 829C615 798 627 768 649 746L788 607C822 573 880 597 880 645C880 660 874 675 863 686L731 818"
        stroke="currentColor"
        strokeWidth="32"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}


export default function Manager() {
  const { user } = useAuth();

  const [vocab, setVocab] = useState([]);
  const [search, setSearch] = useState("");
  const [view, setView] = useState("list");
  const [editItem, setEditItem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showDeleteAll, setShowDeleteAll] = useState(false);
  const [itemToConfirmDelete, setItemToConfirmDelete] = useState(null);
  const [deletingItemId, setDeletingItemId] = useState(null);
  const [deletingAll, setDeletingAll] = useState(false);

  const loadVocab = async ({ showSpinner = true } = {}) => {
    if (!user?.id) {
      setVocab([]);
      setLoading(false);
      return;
    }

    const hasCachedVocab = Array.isArray(getCachedVocabularyRows(user.id));

    try {
      if (showSpinner || !hasCachedVocab) {
        setLoading(true);
      }

      const { data, error } = await supabase
        .from("vocabulary")
        .select("*")
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false });

      if (error) {
        throw error;
      }

      const rows = Array.isArray(data) ? data : [];
      const normalizedData = rows.map(mapVocabularyRow);
      setVocab(normalizedData);
      setCachedVocabularyRows(user.id, rows);
    } catch (error) {
      console.error("Erro ao carregar vocabulário no Supabase:", error);
      if (!hasCachedVocab) {
        setVocab([]);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!user?.id) {
      setVocab([]);
      setLoading(false);
      return;
    }

    const cachedVocab = getCachedVocabularyRows(user.id);

    if (Array.isArray(cachedVocab)) {
      setVocab(cachedVocab.map(mapVocabularyRow));
      setLoading(false);
      loadVocab({ showSpinner: false });
      return;
    }

    loadVocab();
  }, [user?.id]);

  const handleDelete = async (id) => {
    if (!user?.id || deletingItemId || deletingAll) return;

    const itemToDelete = vocab.find((item) => item.id === id);
    const videoUrlsToDelete = collectVocabularyVideoUrls(itemToDelete);

    try {
      setDeletingItemId(id);

      await deleteVideosFromR2(videoUrlsToDelete);

      const { error } = await supabase
        .from("vocabulary")
        .delete()
        .eq("id", id)
        .eq("user_id", user.id);

      if (error) {
        throw error;
      }

      setVocab((current) => {
        const nextVocab = current.filter((item) => item.id !== id);
        const cachedRows = getCachedVocabularyRows(user.id);
        if (Array.isArray(cachedRows)) {
          setCachedVocabularyRows(
            user.id,
            cachedRows.filter((item) => item?.id !== id)
          );
        }
        return nextVocab;
      });
      setItemToConfirmDelete(null);
    } catch (error) {
      console.error("Erro ao apagar item:", error);
      alert(
        error?.message ||
          "Não foi possível apagar este item e seus vídeos vinculados."
      );
    } finally {
      setDeletingItemId(null);
    }
  };


  const handleExportItem = (item) => {
    if (!item) return;

    downloadVocabularyJson(
      [buildVocabularyExportItem(item)],
      `${createSafeFileName(item.term)}.json`
    );
  };

  const handleConfirmDeleteItem = () => {
    if (!itemToConfirmDelete?.id) return;
    handleDelete(itemToConfirmDelete.id);
  };

  const handleDeleteAll = async () => {
    if (!user?.id || deletingAll) return;

    const videoUrlsToDelete = vocab.flatMap((item) =>
      collectVocabularyVideoUrls(item)
    );

    try {
      setDeletingAll(true);

      await deleteVideosFromR2(videoUrlsToDelete);

      const { error } = await supabase
        .from("vocabulary")
        .delete()
        .eq("user_id", user.id);

      if (error) {
        throw error;
      }

      setCachedVocabularyRows(user.id, []);
      setShowDeleteAll(false);
      loadVocab();
    } catch (error) {
      console.error("Erro ao apagar todos os itens:", error);
      alert(
        error?.message ||
          "Não foi possível apagar todos os itens e seus vídeos vinculados."
      );
    } finally {
      setDeletingAll(false);
    }
  };

  const handleEdit = (item) => {
    setEditItem(item);
    setView("form");
  };

  const handleNew = () => {
    setEditItem(null);
    setView("form");
  };

  const handleSaved = (savedItem) => {
    if (savedItem && typeof savedItem === "object") {
      setEditItem(savedItem);
    }

    loadVocab();
  };

  const handleImportDone = () => {
    setView("list");
    loadVocab();
  };

  const filtered = vocab.filter((v) => {
    const q = search.toLowerCase();

    if (!q) return true;
    if (v.term?.toLowerCase().includes(q)) return true;
    if (v.meanings?.some((m) => m.meaning?.toLowerCase().includes(q))) {
      return true;
    }

    return false;
  });

  const actionButtonsClass =
    vocab.length > 0
      ? "grid w-full grid-cols-3 gap-2 sm:flex sm:w-auto sm:flex-wrap"
      : "grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:flex-wrap";

  if (view === "form") {
    return (
      <ManagerForm
        item={editItem}
        onBack={() => {
          setView("list");
          setEditItem(null);
        }}
        onSaved={handleSaved}
      />
    );
  }

  if (view === "import") {
    return (
      <ManagerImport
        vocab={vocab}
        onBack={() => setView("list")}
        onDone={handleImportDone}
      />
    );
  }

  return (
    <div className="relative min-h-[calc(100vh-4rem)] w-full overflow-visible bg-transparent dark:bg-transparent">
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-y-0 left-0 right-0 z-0 bg-[linear-gradient(to_bottom_right,#FFFFFF,#F8F8F8,#F0F0F0)] dark:hidden md:left-[216px]"
      />

      <div className="relative z-10 mx-auto w-full max-w-[1120px] px-4 pb-8 pt-2 sm:px-6 lg:px-8">
        <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <h1 className="text-[2rem] font-semibold leading-tight tracking-[-0.03em] text-[#1D1D1F] dark:text-[#F5F5F7] sm:text-[2.35rem]">
            Gerenciador
          </h1>

          <p className="mt-1 text-sm leading-relaxed text-[#6E6E73] dark:text-[#A1A1A6]">
            Palavras/frases cadastradas: {vocab.length}
          </p>
        </div>

        <div className={actionButtonsClass}>
          <button
            onClick={handleNew}
            className="inline-flex min-h-10 min-w-0 items-center justify-center gap-2 rounded-full bg-[#0071E3] px-4 py-2 text-xs font-semibold text-white shadow-none transition-colors hover:bg-[#0077ED] active:bg-[#006EDB] dark:bg-[#0A84FF] dark:hover:bg-[#2290FF]"
          >
            <Plus className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">Nova palavra/frase</span>
          </button>

          <button
            onClick={() => setView("import")}
            className="inline-flex min-h-10 min-w-0 items-center justify-center gap-2 rounded-full border border-[#D2D2D7] bg-white px-4 py-2 text-xs font-semibold text-[#1D1D1F] transition-colors hover:bg-[#F5F5F7] active:bg-[#EDEDF0] dark:border-[#3A3A3C] dark:bg-[#2C2C2E] dark:text-[#F5F5F7] dark:hover:bg-[#3A3A3C]"
          >
            <Upload className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate sm:hidden">Importar</span>
            <span className="hidden truncate sm:inline">Importar JSON</span>
          </button>

          {vocab.length > 0 ? (
            <button
              onClick={() => setShowDeleteAll(true)}
              disabled={deletingAll}
              className="inline-flex min-h-10 min-w-0 items-center justify-center gap-2 rounded-full border border-[#F2D7D5] bg-white px-4 py-2 text-xs font-semibold text-[#B42318] transition-colors hover:bg-[#FFF7F6] active:bg-[#FCEDEA] disabled:cursor-not-allowed disabled:opacity-55 dark:border-[#5A2521] dark:bg-[#2C2C2E] dark:text-[#FF9F95] dark:hover:bg-[#2B1513]"
            >
              <Trash2 className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">
                {deletingAll ? "Apagando..." : "Apagar tudo"}
              </span>
            </button>
          ) : null}
        </div>
      </div>

      <div className="relative mb-5">
        <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#86868B] dark:text-[#8E8E93]" />

        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar palavras ou frases..."
          className="min-h-12 w-full rounded-[22px] border border-[#D2D2D7] bg-white px-11 py-3 text-sm font-medium text-[#1D1D1F] shadow-none transition-all placeholder:text-[#86868B] focus:border-[#0071E3] focus:outline-none focus:ring-2 focus:ring-[#0071E3]/15 dark:border-[#3A3A3C] dark:bg-[#111113] dark:text-[#F5F5F7] dark:placeholder:text-[#8E8E93] dark:focus:border-[#0A84FF] dark:focus:ring-[#0A84FF]/20"
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="h-7 w-7 animate-spin rounded-full border-3 border-[#D2D2D7] border-t-[#0071E3] dark:border-[#3A3A3C] dark:border-t-[#0A84FF]" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-[26px] border border-[#E5E5EA] bg-white/92 px-5 py-16 text-center ring-1 ring-black/[0.025] dark:border-[#2C2C2E] dark:bg-[#1C1C1E] dark:ring-white/[0.05]">
          <p className="text-sm font-medium text-[#6E6E73] dark:text-[#A1A1A6]">
            {search
              ? "Nenhum resultado encontrado."
              : "Nenhuma palavra cadastrada ainda."}
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {filtered.map((item) => {
            const hasAnyVideo = collectVocabularyVideoUrls(item).length > 0;

            return (
              <div
                key={item.id}
                role="button"
                tabIndex={0}
                onClick={() => handleEdit(item)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    handleEdit(item);
                  }
                }}
                className="group flex min-h-[64px] cursor-pointer items-center gap-2.5 rounded-[20px] border border-[#E5E5EA] bg-white px-4 py-2 shadow-none ring-1 ring-black/[0.02] transition-colors hover:border-[#D2D2D7] hover:bg-[#F5F5F7] focus:border-[#0071E3]/45 focus:outline-none focus:ring-2 focus:ring-[#0071E3]/15 dark:border-[#2C2C2E] dark:bg-[#1C1C1E] dark:ring-white/[0.04] dark:hover:border-[#3A3A3C] dark:hover:bg-[#202024] dark:focus:border-[#0A84FF]/55 dark:focus:ring-[#0A84FF]/20"
                aria-label={`Editar ${item.term}`}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex min-w-0 items-center gap-2">
                    <p className="truncate text-[15px] font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">
                      {item.term}
                    </p>
                  </div>

                  <p className="mt-0.5 truncate text-xs leading-relaxed text-[#6E6E73] dark:text-[#A1A1A6]">
                    {item.meanings?.slice(0, 3).map((m) => m.meaning).join(", ") ||
                      "Sem significados cadastrados"}
                  </p>
                </div>

                {hasAnyVideo ? (
                  <span
                    className="inline-flex h-8 w-8 shrink-0 items-center justify-center text-[#8E8E93] transition-colors group-hover:text-[#6E6E73] dark:text-[#8E8E93] dark:group-hover:text-[#A1A1A6]"
                    aria-label="Vídeo anexado"
                    title="Vídeo anexado"
                  >
                    <VideoAttachmentGlyph className="h-3.5 w-3.5" />
                  </span>
                ) : null}

                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    handleExportItem(item);
                  }}
                  className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[#6E6E73] transition-colors hover:bg-[#EDEDF0] hover:text-[#1D1D1F] dark:text-[#A1A1A6] dark:hover:bg-[#2C2C2E] dark:hover:text-[#F5F5F7]"
                  aria-label={`Exportar ${item.term}`}
                  title="Exportar palavra"
                >
                  <Download className="h-3.5 w-3.5" />
                </button>

                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    setItemToConfirmDelete(item);
                  }}
                  disabled={deletingItemId === item.id || deletingAll}
                  className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[#B42318] transition-colors hover:bg-[#FFF7F6] active:bg-[#FCEDEA] disabled:cursor-not-allowed disabled:opacity-50 dark:text-[#FF9F95] dark:hover:bg-[#2B1513]"
                  aria-label={`Apagar ${item.term}`}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>

                <ChevronRight className="h-4 w-4 shrink-0 text-[#8E8E93] transition-transform group-hover:translate-x-0.5 group-hover:text-[#0071E3] dark:text-[#8E8E93] dark:group-hover:text-[#0A84FF]" />
              </div>
            );
          })}
        </div>
      )}

      <AlertDialog
        open={Boolean(itemToConfirmDelete)}
        onOpenChange={(open) => {
          if (!open && !deletingItemId) {
            setItemToConfirmDelete(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Apagar palavra ou frase
            </AlertDialogTitle>

            <AlertDialogDescription>
              Tem certeza que deseja apagar "{itemToConfirmDelete?.term}"? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <AlertDialogFooter>
            <AlertDialogCancel disabled={Boolean(deletingItemId)}>
              Cancelar
            </AlertDialogCancel>

            <AlertDialogAction
              onClick={handleConfirmDeleteItem}
              disabled={Boolean(deletingItemId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50"
            >
              {deletingItemId ? "Apagando..." : "Apagar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showDeleteAll} onOpenChange={setShowDeleteAll}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Apagar tudo
            </AlertDialogTitle>

            <AlertDialogDescription>
              Tem certeza que deseja apagar todas as {vocab.length} palavras/frases?
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingAll}>
              Cancelar
            </AlertDialogCancel>

            <AlertDialogAction
              onClick={handleDeleteAll}
              disabled={deletingAll}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50"
            >
              {deletingAll ? "Apagando..." : "Apagar tudo"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      </div>
    </div>
  );
}
