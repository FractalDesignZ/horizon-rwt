import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { GROK_PROVIDERS, authClient, authEnabled, signIn } from "@/lib/auth/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/login")({ component: Login });

function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"in" | "up">("in");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onEmail(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (mode === "up") {
        const res = await authClient.signUp.email({ email, password, name: email.split("@")[0] ?? "user" });
        if (res.error) throw new Error(res.error.message);
      } else {
        const res = await authClient.signIn.email({ email, password });
        if (res.error) throw new Error(res.error.message);
      }
      window.location.href = "/";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-in failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="grid min-h-dvh place-items-center bg-bg px-4 text-fg">
      <div className="w-full max-w-sm">
        <p className="text-[11px] uppercase tracking-[0.16em] text-muted">Horizon</p>
        <h1 className="mt-2 font-display text-4xl tracking-tight">Sign in</h1>
        <p className="mt-2 text-sm text-muted">
          Save runs to your account. Import your own files — nothing is preloaded.
        </p>

        {authEnabled ? (
          <div className="mt-8 space-y-3">
            {GROK_PROVIDERS.map((p) => (
              <Button
                key={p.providerId}
                variant="secondary"
                className="w-full"
                onClick={() => signIn(p.providerId, { callbackURL: "/" })}
              >
                Continue with {p.label}
              </Button>
            ))}
            <div className="flex items-center gap-3 py-2">
              <span className="h-px flex-1 bg-border" />
              <span className="text-[11px] uppercase tracking-[0.12em] text-subtle">or email</span>
              <span className="h-px flex-1 bg-border" />
            </div>
            <form onSubmit={onEmail} className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete={mode === "up" ? "new-password" : "current-password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  minLength={8}
                  required
                />
              </div>
              {error && <p className="text-sm text-danger">{error}</p>}
              <Button type="submit" className="w-full" disabled={busy}>
                {busy ? "Working…" : mode === "up" ? "Create account" : "Sign in"}
              </Button>
            </form>
            <button
              type="button"
              className="w-full text-center text-sm text-muted hover:text-fg"
              onClick={() => setMode(mode === "up" ? "in" : "up")}
            >
              {mode === "up" ? "Already have an account" : "Create an account"}
            </button>
          </div>
        ) : (
          <p className="mt-6 text-sm text-muted">Sign-in is disabled.</p>
        )}

        <Link to="/" className="mt-8 inline-block text-sm text-muted no-underline hover:text-fg">
          Back to the pad
        </Link>
      </div>
    </main>
  );
}
