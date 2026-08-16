import { Badge } from "@/components/ui/badge";
import type { ModeStatus } from "@/lib/rwt/types";

export function ModeRail({ modes }: { modes: ModeStatus[] }) {
  return (
    <ol className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
      {modes.map((m) => (
        <li
          key={m.id}
          className="rounded-lg border border-border bg-surface p-3"
        >
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="font-mono text-[11px] text-subtle">{m.id}</span>
            <Badge variant={m.status === "ok" ? "ok" : "warn"}>{m.status}</Badge>
          </div>
          <p className="font-display text-base text-fg">{m.name}</p>
          <p className="mt-1 text-xs text-muted">{m.role}</p>
          <p className="mt-2 font-mono text-[11px] text-accent">{m.note}</p>
        </li>
      ))}
    </ol>
  );
}
