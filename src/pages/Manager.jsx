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

function mapVocabularyRow(row) {
  return {
    id: row.id,
    user_id: row.user_id,
    term: row.term || "",
    pronunciation: row.pronunciation || "",
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
    try {
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
      alert("Não foi possível apagar este item.");
    }
  };

  const handleDeleteAll = async () => {
    try {
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
      alert("Não foi possível apagar todos os itens.");
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
              className="flex min-w-0 items-center justify-center gap-1 rounded-lg border border-destructive/30 bg-card px-2 py-2 text-[11px] font-semibold text-destructive transition-colors hover:bg-destructive hover:text-white sm:gap-1.5 sm:px-3 sm:text-xs"
            >
              <Trash2 className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">Apagar tudo</span>
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
          {filtered.map((item) => (
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
                <p className="truncate text-sm font-semibold text-foreground">
                  {item.term}
                </p>

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
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors hover:bg-red-50"
                aria-label={`Apagar ${item.term}`}
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </button>
            </div>
          ))}
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
            <AlertDialogCancel>Cancelar</AlertDialogCancel>

            <AlertDialogAction
              onClick={handleDeleteAll}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Apagar tudo
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}