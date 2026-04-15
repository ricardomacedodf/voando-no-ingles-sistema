import { Link, useLocation } from "react-router-dom";
import { Home, BarChart3, Layers, HelpCircle, Puzzle, Settings2, Palette, Volume2, VolumeX } from "lucide-react";
import Logo from "./Logo";
import { getSoundState, saveSoundState } from "../lib/gameState";
import { useState } from "react";

const navItems = [
  { label: "Início", path: "/", icon: Home },
  { label: "Progresso", path: "/progresso", icon: BarChart3 },
  { label: "Flashcards", path: "/flashcards", icon: Layers },
  { label: "Quiz", path: "/quiz", icon: HelpCircle },
  { label: "Combinações", path: "/combinacoes", icon: Puzzle },
  { label: "Gerenciador", path: "/gerenciador", icon: Settings2 },
  { label: "Personalizar", path: "/personalizar", icon: Palette },
];

export default function Sidebar({ onClose }) {
  const location = useLocation();
  const [soundEnabled, setSoundEnabled] = useState(() => getSoundState().enabled);

  const toggleSound = () => {
    const state = getSoundState();
    state.enabled = !state.enabled;
    saveSoundState(state);
    setSoundEnabled(state.enabled);
  };

  return (
    <div className="h-full flex flex-col bg-card border-r border-border">
      <div className="p-5 pb-3">
        <Logo />
      </div>

      <div className="mx-4 h-px bg-border mb-2" />

      <nav className="flex-1 px-3 py-2 space-y-0.5 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              onClick={onClose}
              className={`
                flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium
                transition-all duration-200 ease-out group
                ${isActive
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-sidebar-foreground hover:text-muted-foreground"
                }
              `}
            >
              <Icon className={`w-[18px] h-[18px] flex-shrink-0 ${isActive ? "" : "opacity-70 group-hover:opacity-50"}`} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="px-3 pb-5 pt-2">
        <div className="mx-1 h-px bg-border mb-3" />
        <button
          onClick={toggleSound}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium w-full
            text-sidebar-foreground hover:text-muted-foreground transition-all duration-200"
        >
          {soundEnabled ? (
            <Volume2 className="w-[18px] h-[18px] opacity-70" />
          ) : (
            <VolumeX className="w-[18px] h-[18px] opacity-70" />
          )}
          <span>Som {soundEnabled ? "ativado" : "desativado"}</span>
        </button>
      </div>
    </div>
  );
}