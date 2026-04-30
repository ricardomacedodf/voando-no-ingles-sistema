import { useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

export default function PageNotFound() {
  const location = useLocation();
  const { user, isAuthenticated } = useAuth();

  const pageName = location.pathname.substring(1);

  return (
    <div className="app-mobile-safe-shell flex min-h-screen items-center justify-center bg-slate-50 p-6 dark:bg-background">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-sm">
        <div className="space-y-6 text-center">
          <div className="space-y-2">
            <h1 className="text-7xl font-light text-slate-300 dark:text-slate-500">404</h1>
            <div className="mx-auto h-0.5 w-16 bg-slate-200 dark:bg-border" />
          </div>

          <div className="space-y-3">
            <h2 className="text-2xl font-medium text-slate-800 dark:text-foreground">
              Pagina nao encontrada
            </h2>
            <p className="leading-relaxed text-slate-600 dark:text-muted-foreground">
              A pagina{" "}
              <span className="font-medium text-slate-700 dark:text-foreground">
                "{pageName}"
              </span>{" "}
              nao foi encontrada neste aplicativo.
            </p>
          </div>

          {isAuthenticated && user && (
            <div className="mt-8 rounded-lg border border-slate-200 bg-slate-100 p-4 dark:border-border dark:bg-muted/30">
              <div className="flex items-start space-x-3">
                <div className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-orange-100 dark:bg-orange-500/20">
                  <div className="h-2 w-2 rounded-full bg-orange-400" />
                </div>
                <div className="space-y-1 text-left">
                  <p className="text-sm font-medium text-slate-700 dark:text-foreground">
                    Aviso
                  </p>
                  <p className="text-sm leading-relaxed text-slate-600 dark:text-muted-foreground">
                    Essa rota ainda nao existe ou nao foi implementada.
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="pt-6">
            <button
              onClick={() => {
                window.location.href = "/";
              }}
              className="inline-flex items-center rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors duration-200 hover:bg-slate-50 hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2 dark:border-border dark:bg-card dark:text-foreground dark:hover:bg-muted dark:focus:ring-ring dark:focus:ring-offset-background"
            >
              <svg
                className="mr-2 h-4 w-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
                />
              </svg>
              Ir para o inicio
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
