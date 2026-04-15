import { Flame, BookOpen, Trophy, Star } from "lucide-react";

export default function StatsGrid({ stats }) {
  const items = [
    {
      label: "Dias seguidos",
      value: stats.streak,
      icon: Flame,
      iconColor: "text-red-500",
      bgColor: "bg-red-50",
    },
    {
      label: "Cartões",
      value: stats.totalCards,
      icon: BookOpen,
      iconColor: "text-primary",
      bgColor: "bg-emerald-50",
    },
    {
      label: "Dominados",
      value: stats.dominated,
      icon: Trophy,
      iconColor: "text-orange-500",
      bgColor: "bg-orange-50",
    },
    {
      label: "Nível",
      value: stats.level,
      icon: Star,
      iconColor: "text-purple-500",
      bgColor: "bg-purple-50",
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <div
            key={item.label}
            className="bg-card rounded-xl p-4 border border-border/60"
          >
            <div className="flex items-center gap-3">
              <div className={`w-9 h-9 rounded-lg ${item.bgColor} flex items-center justify-center flex-shrink-0`}>
                <Icon className={`w-4 h-4 ${item.iconColor}`} />
              </div>
              <div className="min-w-0">
                <p className="text-lg font-bold text-foreground leading-tight">{item.value}</p>
                <p className="text-xs text-muted-foreground font-medium truncate">{item.label}</p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}