import { useLocation } from "wouter";
import Header from "@/components/Header";

export default function NotFound() {
  const [, setLocation] = useLocation();

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <Header />
      <main className="flex-1 flex items-center justify-center">
        <div className="border-4 border-black p-12 text-center">
          <h1 className="text-6xl font-black mb-2">404</h1>
          <h2 className="text-xl font-bold uppercase tracking-widest mb-4">PAGE NOT FOUND</h2>
          <p className="font-mono text-sm text-muted-foreground mb-6">
            The page you are looking for does not exist.
          </p>
          <button
            onClick={() => setLocation("/")}
            className="btn-brutal text-xs"
          >
            GO HOME
          </button>
        </div>
      </main>
    </div>
  );
}
