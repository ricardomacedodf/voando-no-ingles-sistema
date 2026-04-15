import { Link } from "react-router-dom";
import { Layers, HelpCircle, Puzzle } from "lucide-react";

const activities = [
  {
    label: "Flashcards",
    desc: "Revise e memorize vocabulário com cartões interativos.",
    path: "/flashcards",
    icon: Layers,
    color: "bg-blue-500",
  },
  {
    label: "Quiz",
    desc: "Teste seu conhecimento com perguntas rápidas e objetivas.",
    path: "/quiz",
    icon: HelpCircle,
    color: "bg-orange-500",
  },
  {
    label: "Combinações",
    desc: "Associe termos e significados para reforçar a memorização.",
    path: "/combinacoes",
    icon: Puzzle,
    color: "bg-purple-500",
  },
];

export default function ActivityCards() {
  return (
    <div>
      <h2 className="text-base font-semibold text-foreground mb-3">Atividades</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {activities.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.path}
              to={item.path}
              className="group bg-card rounded-xl p-5 border border-border/60 
                hover:border-primary/20 hover:shadow-sm transition-all duration-200"
            >
              <div className={`w-11 h-11 rounded-xl ${item.color} flex items-center justify-center mb-3.5 shadow-sm`}>
                <Icon className="w-5 h-5 text-white" />
              </div>
              <h3 className="text-sm font-semibold text-foreground mb-1">{item.label}</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">{item.desc}</p>
            </Link>
          );
        })}
      </div>
    </div>
  );
}