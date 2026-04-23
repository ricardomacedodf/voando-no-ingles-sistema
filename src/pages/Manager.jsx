import { useState, useEffect } from "react";
import { Plus, Search, Pencil, Trash2, FileJson, AlertTriangle } from "lucide-react";
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
    if (v.meanings?.some((m) => m.meaning?.toLowerCase().includes(q))) return true;
    return false;
  });

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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
        <div>
          <h1 className="text-xl font-bold text-foreground">Gerenciador</h1>
          <p className="text-sm text-muted-foreground">
            {vocab.length} palavras/frases cadastradas
          </p>
        </div>

        <div className="flex gap-2 flex-wrap">
          <button
            onClick={handleNew}
            className="flex items-center gap-1.5 px-3 py-2 bg-primary text-primary-foreground rounded-lg text-xs font-semibold hover:bg-primary/90 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" /> Nova Palavra
          </button>

          <button
            onClick={() => setView("import")}
            className="flex items-center gap-1.5 px-3 py-2 bg-card text-foreground border border-border rounded-lg text-xs font-semibold hover:bg-muted transition-colors"
          >
            <FileJson className="w-3.5 h-3.5" /> Importar JSON
          </button>

          {vocab.length > 0 && (
            <button
              onClick={() => setShowDeleteAll(true)}
              className="flex items-center gap-1.5 px-3 py-2 bg-card text-destructive border border-destructive/30 rounded-lg text-xs font-semibold hover:bg-destructive hover:text-white transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" /> Apagar tudo
            </button>
          )}
        </div>
      </div>

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar palavras ou frases..."
          className="w-full pl-9 pr-4 py-2.5 bg-card border border-border rounded-xl text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-all"
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-7 h-7 border-3 border-border border-t-primary rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-muted-foreground text-sm">
            {search ? "Nenhum resultado encontrado." : "Nenhuma palavra cadastrada ainda."}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((item) => (
            <div
              key={item.id}
              className="flex items-center gap-3 bg-card border border-border/60 rounded-xl px-4 py-3 group"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground truncate">{item.term}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {item.meanings?.slice(0, 3).map((m) => m.meaning).join(", ")}
                </p>
              </div>

              <div className="flex items-center gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => handleEdit(item)}
                  className="p-2 rounded-lg hover:bg-muted transition-colors"
                >
                  <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
                </button>

                <button
                  onClick={() => handleDelete(item.id)}
                  className="p-2 rounded-lg hover:bg-red-50 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5 text-destructive" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <AlertDialog open={showDeleteAll} onOpenChange={setShowDeleteAll}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-destructive" /> Apagar tudo
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
