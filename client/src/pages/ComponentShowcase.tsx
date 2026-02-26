/**
 * ComponentShowcase is only available in development mode.
 * It is excluded from production builds via dynamic import guard.
 */
import { useLocation } from "wouter";
import { useEffect } from "react";

export default function ComponentShowcase() {
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (import.meta.env.PROD) {
      setLocation("/404");
    }
  }, [setLocation]);

  if (import.meta.env.PROD) {
    return null;
  }

  return (
    <div className="min-h-screen p-8">
      <h1 className="text-3xl font-black uppercase mb-4">COMPONENT SHOWCASE</h1>
      <p className="font-mono text-sm text-muted-foreground">
        Development-only page for testing UI components.
      </p>
    </div>
  );
}
