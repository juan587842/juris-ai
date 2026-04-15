"use client";

import { useState } from "react";
import { createBrowserClient } from "@/lib/supabase/client";
import { Scale } from "lucide-react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const supabase = createBrowserClient();

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setError(error.message === "Invalid login credentials"
        ? "E-mail ou senha inválidos."
        : error.message);
      setLoading(false);
      return;
    }

    // Full page reload garante que o middleware leia os cookies de sessão
    window.location.href = "/inbox";
  }

  return (
    <div className="relative min-h-screen flex items-center justify-center bg-radial-gold px-4 overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage:
            "linear-gradient(to right, #c9a96e 1px, transparent 1px), linear-gradient(to bottom, #c9a96e 1px, transparent 1px)",
          backgroundSize: "48px 48px",
        }}
      />

      <div className="relative w-full max-w-sm space-y-8 animate-fade-in">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 ring-1 ring-primary/20 shadow-glow-gold">
            <Scale className="h-7 w-7 text-primary" />
          </div>
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight">Juris AI</h1>
            <p className="text-sm text-muted-foreground">
              Acesse o painel do escritório
            </p>
          </div>
        </div>

        <form
          onSubmit={handleLogin}
          className="glass-card rounded-2xl p-6 space-y-5 shadow-elevated animate-slide-up"
        >
          <div className="space-y-1.5">
            <label htmlFor="email" className="label-caps">
              E-mail
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-border bg-surface-elevated/50 px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/60 transition-colors focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/30"
              placeholder="advogado@escritorio.com.br"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="password" className="label-caps">
              Senha
            </label>
            <input
              id="password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-border bg-surface-elevated/50 px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/60 transition-colors focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/30"
              placeholder="••••••••"
            />
          </div>

          {error && (
            <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="group relative w-full overflow-hidden rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-all duration-200 hover:bg-primary-hover hover:shadow-glow-gold disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "Entrando..." : "Entrar"}
          </button>
        </form>

        <p className="text-center text-xs text-muted-foreground">
          Protegido por <span className="text-primary/80">Supabase Auth</span>
        </p>
      </div>
    </div>
  );
}
