import { createFileRoute, useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";
import { AppShell } from "@/components/app-shell";
import { GUIDE } from "@/lib/guide";

export const Route = createFileRoute("/guide")({ component: GuidePage });

function GuidePage() {
  const hash = useRouterState({ select: (s) => s.location.hash });

  useEffect(() => {
    const id = hash.replace(/^#/, "");
    if (!id) return;
    document.getElementById(id)?.scrollIntoView({ block: "start" });
  }, [hash]);

  return (
    <AppShell>
      <div className="flex flex-col gap-8">
        <div>
          <p className="text-[11px] uppercase tracking-[0.16em] text-muted">Reference</p>
          <h1 className="mt-1 font-display text-4xl tracking-tight md:text-5xl">Help</h1>
          <p className="mt-2 max-w-2xl text-pretty text-sm text-muted">
            What each screen does, in the same words the UI uses. Formal names sit at the
            bottom of each note.
          </p>
        </div>

        <ol className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {GUIDE.map((a) => (
            <li key={a.id}>
              <a href={`#${a.id}`} className="block rounded-lg border border-border bg-surface p-3 no-underline">
                <p className="font-display text-lg text-fg">{a.title}</p>
                <p className="mt-1 text-xs text-muted">{a.blurb}</p>
              </a>
            </li>
          ))}
        </ol>

        <div className="flex flex-col gap-10">
          {GUIDE.map((a) => (
            <article key={a.id} id={a.id} className="scroll-mt-24">
              <h2 className="font-display text-2xl tracking-tight">{a.title}</h2>
              <p className="mt-1 text-sm text-muted">{a.blurb}</p>
              {a.body.map((p) => (
                <p key={p} className="mt-3 max-w-2xl text-pretty text-sm">
                  {p}
                </p>
              ))}
              {a.also && <p className="mt-3 text-xs text-subtle">Also called: {a.also}</p>}
            </article>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
