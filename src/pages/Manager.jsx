import { useState, useEffect } from "react";
import {
  Plus,
  Search,
  Trash2,
  FileJson,
  AlertTriangle,
  Menu,
} from "lucide-react";
import { supabase } from "@/api/supabaseClient";
import { useAuth } from "../contexts/AuthContext";
import ManagerForm from "../components/ManagerForm";
import ManagerImport from "../components/ManagerImport";
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

  if (!cleanVideoUrl) return;

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

function mapVocabularyRow(row) {
  return {
    id: row.id,
    user_id: row.user_id,
    term: row.term || "",
    pronunciation: row.pronunciation || "",
    video: normalizeWordVideo(row),
    thumbnail: normalizeWordThumbnail(row),
    meanings: Array.isArray(row.meanings) ? row.meanings : [],
    stats: row.stats || {
      correct: 0,
      incorrect: 0,
      total_reviews: 0,
      avg_response_time: 0,
      status: "nova",
    },
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null,
  };
}

export default function Manager() {
  const { user } = useAuth();

  const [vocab, setVocab] = useState([]);
  const [search, setSearch] = useState("");
  const [view, setView] = useState("list");
  const [editItem, setEditItem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showDeleteAll, setShowDeleteAll] = useState(false);
  const [deletingItemId, setDeletingItemId] = useState(null);
  const [deletingAll, setDeletingAll] = useState(false);

  const loadVocab = async () => {
    if (!user?.id) {
      setVocab([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      const { data, error } = await supabase
        .from("vocabulary")
        .select("*")
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false });

      if (error) {
        throw error;
      }

      setVocab(Array.isArray(data) ? data.map(mapVocabularyRow) : []);
    } catch (error) {
      console.error("Erro ao carregar vocabulário no Supabase:", error);
      setVocab([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
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

      loadVocab();
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

  const handleSaved = () => {
    setView("list");
    setEditItem(null);
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
    <div>
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-[25px] font-bold leading-[30px] text-foreground">
            Gerenciador
          </h1>

          <p className="text-sm text-muted-foreground">
            {vocab.length} palavras/frases cadastradas
          </p>
        </div>

        <div className={actionButtonsClass}>
          <button
            onClick={handleNew}
            className="flex min-w-0 items-center justify-center gap-1 rounded-lg bg-primary px-2 py-2 text-[11px] font-semibold text-primary-foreground transition-colors hover:bg-primary/90 sm:gap-1.5 sm:px-3 sm:text-xs"
          >
            <Plus className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">Nova Palavra</span>
          </button>

          <button
            onClick={() => setView("import")}
            className="flex min-w-0 items-center justify-center gap-1 rounded-lg border border-border bg-card px-2 py-2 text-[11px] font-semibold text-foreground transition-colors hover:bg-muted sm:gap-1.5 sm:px-3 sm:text-xs"
          >
            <FileJson className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">Importar JSON</span>
          </button>

          {vocab.length > 0 ? (
            <button
              onClick={() => setShowDeleteAll(true)}
              disabled={deletingAll}
              className="flex min-w-0 items-center justify-center gap-1 rounded-lg border border-destructive/30 bg-card px-2 py-2 text-[11px] font-semibold text-destructive transition-colors hover:bg-destructive hover:text-white disabled:opacity-50 sm:gap-1.5 sm:px-3 sm:text-xs"
            >
              <Trash2 className="h-3.5 w-3.5 shrink-0" />

              <span className="truncate">
                {deletingAll ? "Apagando..." : "Apagar tudo"}
              </span>
            </button>
          ) : null}
        </div>
      </div>

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />

        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar palavras ou frases..."
          className="w-full rounded-xl border border-border bg-card py-2.5 pl-9 pr-4 text-sm transition-all placeholder:text-muted-foreground focus:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/20"
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="h-7 w-7 animate-spin rounded-full border-3 border-border border-t-primary" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-16 text-center">
          <p className="text-sm text-muted-foreground">
            {search
              ? "Nenhum resultado encontrado."
              : "Nenhuma palavra cadastrada ainda."}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
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
                className="group flex cursor-pointer items-center gap-3 rounded-xl border border-border/60 bg-card px-4 py-3 shadow-[0_6px_18px_rgba(15,23,42,0.06)] transition-all hover:border-primary hover:shadow-[0_8px_23px_rgba(15,23,42,0.09)] focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                aria-label={`Editar ${item.term}`}
              >
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-muted-foreground/50">
                  <Menu className="h-3.5 w-3.5" strokeWidth={1.4} />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex min-w-0 items-center gap-2">
                    <p className="truncate text-sm font-semibold text-foreground">
                      {item.term}
                    </p>

                    {hasAnyVideo ? (
                      <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.08em] text-primary">
                        VÍDEO
                      </span>
                    ) : null}
                  </div>

                  <p className="truncate text-xs text-muted-foreground">
                    {item.meanings?.slice(0, 3).map((m) => m.meaning).join(", ")}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    handleDelete(item.id);
                  }}
                  disabled={deletingItemId === item.id || deletingAll}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors hover:bg-red-50 disabled:opacity-50"
                  aria-label={`Apagar ${item.term}`}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </button>
              </div>
            );
          })}
        </div>
      )}

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
  );
}
