import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { Link, useLocation } from "wouter";
import { Shield, LogOut, User } from "lucide-react";

export default function Header() {
  const { user, isAuthenticated, loading, logout } = useAuth();
  const [location] = useLocation();

  return (
    <header className="border-b-4 border-black bg-white">
      <div className="container flex items-center justify-between py-4">
        <Link href="/" className="flex items-center gap-3 no-underline">
          <div className="bg-black text-white px-3 py-1">
            <span className="font-mono text-lg font-bold tracking-tight">AI</span>
          </div>
          <span className="text-lg font-black uppercase tracking-widest hidden sm:inline">
            TO PRODUCTION
          </span>
        </Link>

        <nav className="flex items-center gap-2 sm:gap-4">
          {loading ? (
            <div className="h-10 w-24 border-2 border-black animate-pulse bg-muted" />
          ) : isAuthenticated ? (
            <>
              {user?.role === "admin" && (
                <Link
                  href="/admin"
                  className={`flex items-center gap-2 px-4 py-2 border-2 border-black font-bold uppercase tracking-wider text-xs transition-colors no-underline ${
                    location === "/admin"
                      ? "bg-black text-white"
                      : "bg-white text-black hover:bg-black hover:text-white"
                  }`}
                >
                  <Shield className="size-4" />
                  <span className="hidden sm:inline">ADMIN</span>
                </Link>
              )}
              <div className="flex items-center gap-2 px-3 py-2 border-2 border-black bg-white">
                <User className="size-4" />
                <span className="font-mono text-xs font-medium hidden sm:inline truncate max-w-[120px]">
                  {user?.name || user?.email || "User"}
                </span>
              </div>
              <button
                onClick={logout}
                className="flex items-center gap-2 px-4 py-2 border-2 border-black bg-black text-white font-bold uppercase tracking-wider text-xs hover:bg-white hover:text-black transition-colors"
              >
                <LogOut className="size-4" />
                <span className="hidden sm:inline">LOGOUT</span>
              </button>
            </>
          ) : (
            <a
              href={getLoginUrl()}
              className="btn-brutal text-xs no-underline"
            >
              LOG IN
            </a>
          )}
        </nav>
      </div>
    </header>
  );
}
