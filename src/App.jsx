import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from "@tanstack/react-query"
import { queryClientInstance } from "@/lib/query-client"
import { BrowserRouter as Router, Route, Routes } from "react-router-dom"
import PageNotFound from "./pages/PageNotFound"
import { AuthProvider, useAuth } from "./contexts/AuthContext"
import UserNotRegisteredError from "./components/UserNotRegisteredError"
import AppLayout from "./layouts/AppLayout"
import Home from "./pages/Home"
import Flashcards from "./pages/Flashcards"
import Quiz from "./pages/Quiz"
import Combinations from "./pages/Combinations"
import Manager from "./pages/Manager"
import Progress from "./pages/Progress"
import Customize from "./pages/Customize"

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth()

  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    )
  }

  if (authError) {
    if (authError.type === "user_not_registered") {
      return <UserNotRegisteredError />
    } else if (authError.type === "auth_required") {
      navigateToLogin()
      return null
    }
  }

  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/" element={<Home />} />
        <Route path="/flashcards" element={<Flashcards />} />
        <Route path="/quiz" element={<Quiz />} />
        <Route path="/combinacoes" element={<Combinations />} />
        <Route path="/gerenciador" element={<Manager />} />
        <Route path="/progresso" element={<Progress />} />
        <Route path="/personalizar" element={<Customize />} />
        <Route path="*" element={<PageNotFound />} />
      </Route>
    </Routes>
  )
}

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
  )
}

export default App