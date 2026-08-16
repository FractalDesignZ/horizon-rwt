import type { ErrorComponentProps } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import { TriangleAlert } from "lucide-react";

export function AppErrorComponent({ error }: ErrorComponentProps) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-3 bg-bg px-6 text-center text-fg">
      <span className="text-danger" aria-hidden="true">
        <TriangleAlert className="size-10" strokeWidth={2} />
      </span>
      <h1 className="font-display text-2xl">Something went wrong</h1>
      <p className="max-w-md text-sm break-words text-muted">
        {error.message || "An unexpected error occurred. Try reloading the page."}
      </p>
    </main>
  );
}

export function AppNotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-bg px-6 text-center text-fg">
      <p className="text-[11px] uppercase tracking-[0.16em] text-muted">404</p>
      <h1 className="font-display text-3xl tracking-tight">No such horizon</h1>
      <p className="max-w-sm text-sm text-muted">That path is not on the pad.</p>
      <Link to="/" className="mt-2 text-sm text-accent no-underline hover:opacity-80">
        Back to wellscape
      </Link>
    </main>
  );
}
