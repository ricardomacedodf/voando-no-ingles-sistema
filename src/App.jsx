import { useState } from "react";
import { Toaster } from "@/components/ui/toaster";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClientInstance } from "@/lib/query-client";
import {
  BrowserRouter as Router,
  Route,
  Routes,
  useLocation,
} from "react-router-dom";
import PageNotFound from "./pages/PageNotFound";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import UserNotRegisteredError from "./components/UserNotRegisteredError";
import AppLayout from "./layouts/AppLayout";
import Home from "./pages/Home";
import Flashcards from "./pages/Flashcards";
import Quiz from "./pages/Quiz";
import Combinations from "./pages/Combinations";
import Manager from "./pages/Manager";
import Progress from "./pages/Progress";

const PUBLIC_HOME_PATH = "/site";

const LoginRequiredScreen = () => {
  const {
    navigateToLogin,
    loginWithEmail,
    signUpWithEmail,
    requestPasswordReset,
  } = useAuth();

  const [mode, setMode] = useState("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState({
    type: "",
    message: "",
  });

  const systemName = "Voando no Inglês";
  const logoSrc = "/icon-192.png";

  const clearFeedback = () => {
    setFeedback({
      type: "",
      message: "",
    });
  };

  const handleEmailSubmit = async (event) => {
    event.preventDefault();
    clearFeedback();

    if (!email.trim() || !password.trim()) {
      setFeedback({
        type: "error",
        message: "Preencha e-mail e senha para continuar.",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const result =
        mode === "signin"
          ? await loginWithEmail({ email, password })
          : await signUpWithEmail({ email, password });

      if (!result?.success) {
        setFeedback({
          type: "error",
          message: result?.message || "Não foi possível continuar.",
        });
        return;
      }

      if (result?.message) {
        setFeedback({
          type: "success",
          message: result.message,
        });
      } else if (mode === "signup") {
        setFeedback({
          type: "success",
          message: "Conta criada com sucesso.",
        });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleForgotPassword = async () => {
    clearFeedback();

    if (!email.trim()) {
      setFeedback({
        type: "error",
        message: "Digite seu e-mail antes de recuperar a senha.",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const result = await requestPasswordReset(email);

      setFeedback({
        type: result?.success ? "success" : "error",
        message:
          result?.message || "Não foi possível enviar o e-mail de recuperação.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleMode = () => {
    setMode((currentMode) => (currentMode === "signin" ? "signup" : "signin"));
    clearFeedback();
  };

  const titleText =
    mode === "signin" ? systemName : "Criar conta no Voando no Inglês";

  const subtitleText =
    mode === "signin"
      ? "Faça login para continuar"
      : "Cadastre-se para continuar";

  const submitButtonText = isSubmitting
    ? mode === "signin"
      ? "Entrando..."
      : "Cadastrando..."
    : mode === "signin"
    ? "Entrar"
    : "Cadastrar";

  return (
    <div className="app-mobile-safe-shell min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 p-4">
      <div className="w-full max-w-md">
        <div className="text-card-foreground relative overflow-hidden border-0 shadow-2xl bg-white/95 backdrop-blur-sm rounded-2xl">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-slate-200 via-slate-300 to-slate-200"></div>

          <div className="p-8 sm:p-10 md:pt-12 md:pb-10 md:px-10">
            <div className="flex flex-col items-center text-center space-y-6 sm:space-y-8">
              <div className="relative group">
                <div className="absolute inset-0 bg-gradient-to-br from-slate-200 to-slate-300 rounded-full blur-xl opacity-30 transition-opacity duration-300"></div>

                <span className="flex shrink-0 overflow-hidden rounded-full relative h-20 w-20 sm:h-24 sm:w-24 shadow-lg ring-4 ring-white/50 bg-[#176f57]">
                  <img
                    className="aspect-square h-full w-full object-cover"
                    alt={`${systemName} logo`}
                    src={logoSrc}
                  />
                </span>
              </div>

              <div className="space-y-2 sm:space-y-3">
                <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
                  {titleText}
                </h1>
                <p className="text-slate-500 text-sm sm:text-base font-medium">
                  {subtitleText}
                </p>
              </div>

              <div className="w-full">
                {mode === "signin" ? (
                  <>
                    <div className="space-y-3">
                      <button
                        type="button"
                        onClick={navigateToLogin}
                        className="w-full flex items-center justify-center gap-3 bg-white text-slate-700 px-5 py-3.5 rounded-xl border border-slate-200 hover:bg-slate-50 hover:border-slate-300 hover:shadow-sm transition-all duration-200 font-medium text-[16px]"
                      >
                        <svg
                          className="h-5 w-5"
                          viewBox="0 0 24 24"
                          aria-hidden="true"
                        >
                          <path
                            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                            fill="#4285F4"
                          />
                          <path
                            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                            fill="#34A853"
                          />
                          <path
                            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                            fill="#FBBC05"
                          />
                          <path
                            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                            fill="#EA4335"
                          />
                        </svg>
                        <span>Continuar com o Google</span>
                      </button>
                    </div>

                    <div className="relative my-6">
                      <div className="absolute inset-0 flex items-center">
                        <div className="shrink-0 h-[1px] w-full bg-slate-200"></div>
                      </div>
                      <div className="relative flex justify-center text-xs uppercase">
                        <span className="bg-white px-3 text-slate-400 font-medium tracking-wider">
                          ou
                        </span>
                      </div>
                    </div>
                  </>
                ) : null}

                <form onSubmit={handleEmailSubmit} className="space-y-4 sm:space-y-5">
                  <div className="space-y-3 sm:space-y-4">
                    <div className="space-y-1.5">
                      <label
                        className="text-sm font-medium text-slate-700"
                        htmlFor="email"
                      >
                        E-mail
                      </label>

                      <div className="relative">
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                          aria-hidden="true"
                        >
                          <rect width="20" height="16" x="2" y="4" rx="2"></rect>
                          <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"></path>
                        </svg>

                        <input
                          id="email"
                          type="email"
                          value={email}
                          onChange={(event) => setEmail(event.target.value)}
                          placeholder="voce@exemplo.com"
                          autoComplete="email"
                          className="flex w-full border px-3 py-2 text-base md:text-sm pl-10 h-11 sm:h-12 bg-slate-50/50 border-slate-200 focus:border-slate-400 focus:ring-2 focus:ring-slate-400 focus:outline-none rounded-xl placeholder:text-slate-400"
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label
                        className="text-sm font-medium text-slate-700"
                        htmlFor="password"
                      >
                        Senha
                      </label>

                      <div className="relative">
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                          aria-hidden="true"
                        >
                          <rect
                            width="18"
                            height="11"
                            x="3"
                            y="11"
                            rx="2"
                            ry="2"
                          ></rect>
                          <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                        </svg>

                        <input
                          id="password"
                          type="password"
                          value={password}
                          onChange={(event) => setPassword(event.target.value)}
                          placeholder="••••••••"
                          autoComplete={
                            mode === "signin" ? "current-password" : "new-password"
                          }
                          className="flex w-full border px-3 py-2 text-base md:text-sm pl-10 h-11 sm:h-12 bg-slate-50/50 border-slate-200 focus:border-slate-400 focus:ring-2 focus:ring-slate-400 focus:outline-none rounded-xl placeholder:text-slate-400"
                        />
                      </div>
                    </div>
                  </div>

                  {feedback.message ? (
                    <div
                      className={`rounded-xl border px-4 py-3 text-sm ${
                        feedback.type === "success"
                          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                          : "border-red-200 bg-red-50 text-red-700"
                      }`}
                    >
                      {feedback.message}
                    </div>
                  ) : null}

                  <div className="space-y-3">
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="inline-flex items-center justify-center whitespace-nowrap w-full h-11 sm:h-12 bg-slate-900 hover:bg-slate-800 text-white font-medium shadow-sm rounded-xl transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      {submitButtonText}
                    </button>

                    <div className="flex flex-col sm:flex-row items-center justify-between gap-2 sm:gap-0">
                      {mode === "signin" ? (
                        <>
                          <button
                            type="button"
                            onClick={handleForgotPassword}
                            className="text-xs sm:text-sm text-slate-500 hover:text-slate-700 font-medium transition-colors"
                          >
                            Esqueceu sua senha?
                          </button>

                          <button
                            type="button"
                            onClick={toggleMode}
                            className="text-xs sm:text-sm text-slate-500 hover:text-slate-700 font-medium transition-colors"
                          >
                            Cadastre-se
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          onClick={toggleMode}
                          className="w-full inline-flex items-center justify-center gap-2 text-xs sm:text-sm text-slate-500 hover:text-slate-700 transition-colors text-center"
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className="h-4 w-4"
                            aria-hidden="true"
                          >
                            <path d="m15 18-6-6 6-6"></path>
                          </svg>
                          <span>
                            Já tem uma conta?{" "}
                            <span className="font-medium text-slate-700">Entrar</span>
                          </span>
                        </button>
                      )}
                    </div>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-8 text-center text-xs text-slate-400 sm:hidden">
          <p>&nbsp;</p>
        </div>
      </div>
    </div>
  );
};

const PrivacyPage = () => {
  return (
    <div className="app-mobile-safe-shell min-h-screen bg-background px-4 py-10">
      <div className="mx-auto max-w-4xl rounded-3xl border border-border bg-card p-6 md:p-10 shadow-sm space-y-6">
        <div className="space-y-3">
          <div className="inline-flex items-center rounded-full border border-border px-3 py-1 text-sm text-muted-foreground">
            Política de Privacidade
          </div>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
            Política de Privacidade do Voando no Inglês
          </h1>
          <p className="text-muted-foreground leading-7">
            Esta política explica como o aplicativo Voando no Inglês coleta,
            utiliza e protege informações dos usuários durante o uso da
            plataforma.
          </p>
        </div>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">1. Informações coletadas</h2>
          <p className="text-muted-foreground leading-7">
            O aplicativo pode utilizar dados básicos de autenticação, como nome,
            e-mail e foto de perfil da conta Google, além de informações de uso
            relacionadas ao progresso do usuário dentro da plataforma.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">2. Como usamos os dados</h2>
          <p className="text-muted-foreground leading-7">
            Os dados são usados para autenticar o acesso do usuário, personalizar
            a experiência, salvar progresso, organizar conteúdos de estudo e
            melhorar o funcionamento do aplicativo.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">3. Compartilhamento</h2>
          <p className="text-muted-foreground leading-7">
            O Voando no Inglês não vende informações pessoais dos usuários. Os
            dados são usados apenas para operação da plataforma e serviços
            diretamente ligados ao funcionamento do sistema.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">4. Segurança</h2>
          <p className="text-muted-foreground leading-7">
            Adotamos medidas razoáveis para proteger as informações dos usuários
            contra acesso não autorizado, alteração indevida ou uso incorreto.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">5. Contato</h2>
          <p className="text-muted-foreground leading-7">
            Para dúvidas sobre esta política ou sobre o uso dos seus dados,
            utilize o canal de suporte informado no aplicativo.
          </p>
        </section>

        <div className="flex flex-wrap gap-3 pt-2">
          <a
            href={PUBLIC_HOME_PATH}
            className="inline-flex items-center justify-center rounded-xl border border-border px-5 py-3 text-sm font-medium hover:bg-accent transition"
          >
            Voltar para o site
          </a>
          <a
            href="/terms"
            className="inline-flex items-center justify-center rounded-xl border border-border px-5 py-3 text-sm font-medium hover:bg-accent transition"
          >
            Ver Termos de Serviço
          </a>
        </div>
      </div>
    </div>
  );
};

const TermsPage = () => {
  return (
    <div className="app-mobile-safe-shell min-h-screen bg-background px-4 py-10">
      <div className="mx-auto max-w-4xl rounded-3xl border border-border bg-card p-6 md:p-10 shadow-sm space-y-6">
        <div className="space-y-3">
          <div className="inline-flex items-center rounded-full border border-border px-3 py-1 text-sm text-muted-foreground">
            Termos de Serviço
          </div>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
            Termos de Serviço do Voando no Inglês
          </h1>
          <p className="text-muted-foreground leading-7">
            Estes termos definem as regras de uso da plataforma Voando no Inglês.
            Ao utilizar o sistema, o usuário concorda com estas condições.
          </p>
        </div>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">1. Uso da plataforma</h2>
          <p className="text-muted-foreground leading-7">
            O usuário deve utilizar a plataforma de forma lícita, respeitando a
            finalidade educacional do sistema e as regras aplicáveis ao uso da
            conta.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">2. Conta do usuário</h2>
          <p className="text-muted-foreground leading-7">
            O acesso ao sistema pode depender de autenticação com conta Google.
            O usuário é responsável pelas informações vincululadas à sua conta e
            pelo uso adequado do acesso.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">3. Disponibilidade</h2>
          <p className="text-muted-foreground leading-7">
            O sistema pode passar por atualizações, ajustes técnicos e melhorias,
            podendo sofrer interrupções temporárias quando necessário.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">4. Alterações</h2>
          <p className="text-muted-foreground leading-7">
            Estes termos podem ser atualizados a qualquer momento para refletir
            melhorias no serviço ou adequações legais e operacionais.
          </p>
        </section>

        <div className="flex flex-wrap gap-3 pt-2">
          <a
            href={PUBLIC_HOME_PATH}
            className="inline-flex items-center justify-center rounded-xl border border-border px-5 py-3 text-sm font-medium hover:bg-accent transition"
          >
            Voltar para o site
          </a>
          <a
            href="/privacy"
            className="inline-flex items-center justify-center rounded-xl border border-border px-5 py-3 text-sm font-medium hover:bg-accent transition"
          >
            Ver Política de Privacidade
          </a>
        </div>
      </div>
    </div>
  );
};

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError } = useAuth();
  const location = useLocation();

  const isPublicPath = [PUBLIC_HOME_PATH, "/privacy", "/terms"].includes(
    location.pathname
  );

  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  if (authError && !isPublicPath) {
    if (authError.type === "user_not_registered") {
      return <UserNotRegisteredError />;
    }

    if (authError.type === "auth_required") {
      return <LoginRequiredScreen />;
    }
  }

  return (
    <Routes>
      <Route path={PUBLIC_HOME_PATH} element={<Home />} />
      <Route path="/privacy" element={<PrivacyPage />} />
      <Route path="/terms" element={<TermsPage />} />

      <Route element={<AppLayout />}>
        <Route path="/" element={<Home />} />
        <Route path="/flashcards" element={<Flashcards />} />
        <Route path="/quiz" element={<Quiz />} />
        <Route path="/combinacoes" element={<Combinations />} />
        <Route path="/gerenciador" element={<Manager />} />
        <Route path="/progresso" element={<Progress />} />
        <Route path="*" element={<PageNotFound />} />
      </Route>
    </Routes>
  );
};

function App() {
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <AuthenticatedApp />
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  );
}

export default App;
