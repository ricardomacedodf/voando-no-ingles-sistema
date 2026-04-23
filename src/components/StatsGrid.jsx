import { BookOpen, Flame, Star, Trophy } from "lucide-react";

export default function StatsGrid({ stats }) {
  const items = [
    {
      label: "Dias seguidos",
      value: stats.streak,
      icon: Flame,
      iconColor: "text-red-500",
      bgColor: "bg-pink-100",
    },
    {
      label: "Cart\u00F5es",
      mobileLabel: "Em aprendizado",
      value: stats.totalCards,
      icon: BookOpen,
      iconColor: "text-green-600",
      bgColor: "bg-green-100",
    },
    {
      label: "Dominados",
      value: stats.dominated,
      icon: Trophy,
      iconColor: "text-orange-500",
      bgColor: "bg-orange-100",
    },
    {
      label: "Nível",
      value: stats.level,
      icon: Star,
      iconColor: "text-purple-500",
      bgColor: "bg-purple-100",
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
      {items.map((item) => {
        const Icon = item.icon;

        return (
          <div
            key={item.label}
            className="flex items-center gap-4 rounded-xl border border-border/50 bg-white p-5 shadow-sm"
          >
            <div
              className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${item.bgColor} ${item.iconColor}`}
            >
              <Icon className="h-6 w-6" />
            </div>

            <div className="min-w-0">
              <p className="text-sm text-muted-foreground">
                {item.mobileLabel ? (
                  <>
                    <span className="md:hidden">{item.mobileLabel}</span>
                    <span className="hidden md:inline">{item.label}</span>
                  </>
                ) : (
                  item.label
                )}
              </p>
              <p className="mt-0.5 text-2xl font-bold leading-none text-foreground">
                {item.value}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

