import { Link } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";

export function EmptyPad({
  title = "No wells loaded",
  hint = "Import LAS, CSV, JSON, or data[channel, …] files. Nothing is preloaded.",
}: {
  title?: string;
  hint?: string;
}) {
  return (
    <AppShell>
      <div className="mx-auto max-w-lg py-16 text-center">
        <p className="text-[11px] uppercase tracking-[0.16em] text-muted">Empty project</p>
        <h1 className="mt-2 font-display text-4xl tracking-tight">{title}</h1>
        <p className="mt-3 text-pretty text-sm text-muted">{hint}</p>
        <div className="mt-6 flex justify-center">
          <Button asChild>
            <Link to="/ingest">Import files</Link>
          </Button>
        </div>
      </div>
    </AppShell>
  );
}
