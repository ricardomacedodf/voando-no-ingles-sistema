import { useState, useEffect } from "react";
import { supabase } from "@/api/supabaseClient";
import { useAuth } from "../contexts/AuthContext";
import WelcomeCard from "../components/WelcomeCard";
import StatsGrid from "../components/StatsGrid";
import ActivityCards from "../components/ActivityCards";
import { updateStreak, checkStreakMedals } from "../lib/gameState";

export default function Home() {
  const { user, navigateToLogin } = useAuth();

  const [stats, setStats] = useState({
    streak: 0,
    totalCards: 0,
    dominated: 0,
    level: 1,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const game = updateStreak();
        checkStreakMedals();

        if (!user?.id) {
          setStats({
            streak: game.streak,
            totalCards: 0,
            dominated: 0,
            level: game.level,
          });
          setLoading(false);
          return;
        }

        const { data, error } = await supabase
          .from("vocabulary")
          .select("id, stats")
          .eq("user_id", user.id);

        if (error) {
          throw error;
        }

        const safeVocab = Array.isArray(data) ? data : [];
        const totalCards = safeVocab.length;
        const dominated = safeVocab.filter(
          (v) => v.stats?.status === "dominada"
        ).length;

        setStats({
          streak: game.streak,
          totalCards,
          dominated,
          level: game.level,
        });
      } catch (error) {
        console.error("Erro ao carregar dados da Home:", error);

        const game = updateStreak();
        checkStreakMedals();

        setStats({
          streak: game.streak,
          totalCards: 0,
          dominated: 0,
          level: game.level,
        });
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [user?.id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-7 h-7 border-2 border-border border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="space-y-6">
        <section className="rounded-3xl border border-border bg-card p-6 md:p-10 shadow-sm">
          <div className="max-w-3xl space-y-4">
            <div className="inline-flex items-center rounded-full border border-border px-3 py-1 text-sm text-muted-foreground">
              Plataforma de estudos de inglês
            </div>

            <h1 className="text-3xl md:text-5xl font-bold tracking-tight">
              Voando no Inglês
            </h1>

            <p className="text-base md:text-lg text-muted-foreground leading-7">
              O Voando no Inglês é um aplicativo para estudar inglês de forma
              prática, com flashcards, quiz, combinações, acompanhamento de
              progresso e organização do seu conteúdo de estudos.
            </p>

            <p className="text-sm md:text-base text-muted-foreground leading-7">
              A proposta do app é ajudar o aluno a memorizar palavras, frases e
              estruturas do inglês com rotina diária, prática guiada e revisão
              constante.
            </p>

            <div className="flex flex-wrap gap-3 pt-2">
              <button
                onClick={navigateToLogin}
                className="inline-flex items-center justify-center rounded-xl bg-primary px-5 py-3 text-sm font-medium text-primary-foreground hover:opacity-90 transition"
              >
                Entrar no sistema
              </button>

              <a
                href="/privacy"
                className="inline-flex items-center justify-center rounded-xl border border-border px-5 py-3 text-sm font-medium hover:bg-accent transition"
              >
                Política de Privacidade
              </a>

              <a
                href="/terms"
                className="inline-flex items-center justify-center rounded-xl border border-border px-5 py-3 text-sm font-medium hover:bg-accent transition"
              >
                Termos de Serviço
              </a>
            </div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <h2 className="text-lg font-semibold">Flashcards</h2>
            <p className="mt-2 text-sm text-muted-foreground leading-6">
              Estude palavras e frases com foco em memorização e revisão.
            </p>
          </div>

          <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <h2 className="text-lg font-semibold">Quiz e combinações</h2>
            <p className="mt-2 text-sm text-muted-foreground leading-6">
              Pratique de forma interativa para fixar vocabulário e estrutura.
            </p>
          </div>

          <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <h2 className="text-lg font-semibold">Progresso</h2>
            <p className="mt-2 text-sm text-muted-foreground leading-6">
              Acompanhe sequência de estudos, evolução e cartas dominadas.
            </p>
          </div>
        </section>

        <footer className="rounded-2xl border border-border bg-card p-5 text-sm text-muted-foreground shadow-sm">
          <p>
            <strong className="text-foreground">Contato de suporte:</strong>{" "}
            ricardofranciscomacedodf@gmail.com
          </p>
        </footer>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <WelcomeCard />
      <StatsGrid stats={stats} />
      <ActivityCards />
    </div>
  );
}
