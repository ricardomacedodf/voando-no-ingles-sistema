import { Link } from "react-router-dom";
import { ArrowRight, BookOpen, CircleHelp, Puzzle } from "lucide-react";

const activities = [
  {
    label: "Flashcards",
    desc: "Revise e memorize vocabulário com cartões interativos.",
    path: "/flashcards",
    icon: BookOpen,
    color: "bg-blue-500",
  },
  {
    label: "Quiz",
    desc: "Teste seu conhecimento com perguntas rápidas e objetivas.",
    path: "/quiz",
    icon: CircleHelp,
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
      <h3 className="mb-4 text-xl font-bold text-foreground">Atividades</h3>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {activities.map((item) => {
          const Icon = item.icon;
          return (
            <Link key={item.path} to={item.path} className="group block">
              <div className="flex h-full flex-col rounded-xl border border-border bg-white p-6 shadow-sm transition-all duration-200 hover:border-primary hover:shadow-md">
                <div
                  className={`mb-4 flex h-12 w-12 items-center justify-center rounded-xl ${item.color} text-white transition-transform duration-200 group-hover:scale-110`}
                >
                  <Icon className="h-6 w-6" />
                </div>

                <h4 className="mb-2 text-lg font-bold text-foreground">{item.label}</h4>
                <p className="mb-4 flex-1 text-sm text-muted-foreground">{item.desc}</p>

                <div className="mt-auto flex items-center gap-1 text-sm font-medium text-primary transition-all duration-200 group-hover:gap-2">
                  <span>Começar</span>
                  <ArrowRight className="h-4 w-4" />
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
