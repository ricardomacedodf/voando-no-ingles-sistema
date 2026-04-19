import { useState } from "react";
import { Outlet } from "react-router-dom";
import { Menu, X } from "lucide-react";
import Sidebar from "../components/Sidebar";
import Logo from "../components/Logo";

export default function AppLayout() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      <aside className="fixed inset-y-0 left-0 z-50 hidden w-64 md:flex">
        <Sidebar />
      </aside>

      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 transform bg-white transition-transform duration-300 ease-out md:hidden ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="absolute right-3 top-4 z-10">
          <button
            onClick={() => setMobileOpen(false)}
            className="inline-flex h-9 w-9 items-center justify-center rounded-md transition-colors hover:bg-muted"
            aria-label="Fechar menu"
          >
            <X className="h-5 w-5 text-muted-foreground" />
          </button>
        </div>
        <Sidebar onClose={() => setMobileOpen(false)} />
      </aside>

      <header className="fixed left-0 right-0 top-0 z-40 flex h-16 items-center border-b border-border bg-white px-4 md:hidden">
        <button
          onClick={() => setMobileOpen(true)}
          className="mr-2 inline-flex h-9 w-9 items-center justify-center rounded-md text-sm font-medium transition-colors hover:bg-muted"
          aria-label="Abrir menu"
        >
          <Menu className="h-6 w-6" />
        </button>
        <Logo variant="mobile" />
      </header>

      <div className="md:ml-64">
        <main className="min-h-screen p-4 pt-20 md:p-6 md:pt-6 lg:p-8">
          <div className="mx-auto max-w-6xl">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
