import { useState, useEffect } from "react";
import WelcomeCard from "../components/WelcomeCard";
import StatsGrid from "../components/StatsGrid";
import ActivityCards from "../components/ActivityCards";
import { updateStreak, checkStreakMedals } from "../lib/gameState";

const STORAGE_KEY = "vocabulary_items";

function getStoredVocabulary() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.error("Erro ao ler vocabulary do localStorage:", error);
    return [];
  }
}

export default function Home() {
  const [stats, setStats] = useState({
    streak: 0,
    totalCards: 0,
    dominated: 0,
    level: 1
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    function load() {
      const game = updateStreak();
      checkStreakMedals();

      const vocab = getStoredVocabulary();
      const totalCards = vocab.length;
      const dominated = vocab.filter((v) => v.stats?.status === "dominada").length;

      setStats({
        streak: game.streak,
        totalCards,
        dominated,
        level: game.level
      });

      setLoading(false);
    }

    load();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-7 h-7 border-3 border-border border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <WelcomeCard />
      <StatsGrid stats={stats} />
      <ActivityCards />
    </div>
  );
}