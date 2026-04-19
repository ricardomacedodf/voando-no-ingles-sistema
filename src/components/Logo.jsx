import { Link } from "react-router-dom";
import { PlaneTakeoff } from "lucide-react";

export default function Logo({ variant = "sidebar", className = "" }) {
  const isMobile = variant === "mobile";

  return (
    <Link
      to="/"
      className={`flex items-center transition-opacity hover:opacity-90 ${isMobile ? "gap-2" : "gap-3"} ${className}`}
    >
      <div
        className={
          isMobile
            ? "flex-shrink-0 rounded-md bg-[#25B15F] p-1.5 text-white"
            : "flex-shrink-0 rounded-lg bg-[#25B15F] p-2 text-white"
        }
      >
        <PlaneTakeoff className={isMobile ? "h-[18px] w-[18px]" : "h-6 w-6"} strokeWidth={2} />
      </div>

      {isMobile ? (
        <span className="font-bold leading-tight text-foreground">Voando no Inglês</span>
      ) : (
        <div className="min-w-0">
          <h1 className="text-lg font-bold leading-tight text-foreground">Voando no Inglês</h1>
          <p className="text-xs text-muted-foreground">Teacher Ricardo</p>
        </div>
      )}
    </Link>
  );
}
