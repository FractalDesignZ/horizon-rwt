import { Link } from "@tanstack/react-router";

export function About({ id, children }: { id: string; children?: React.ReactNode }) {
  return (
    <Link to="/guide" hash={id} className="text-subtle no-underline hover:text-fg">
      {children ?? "Help"}
    </Link>
  );
}

export function Caption({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <p className="text-pretty text-xs text-muted">
      {children}{" "}
      <About id={id} />
    </p>
  );
}

export function PageLead({
  kicker,
  title,
  id,
  children,
}: {
  kicker: string;
  title: string;
  id: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-[0.16em] text-muted">{kicker}</p>
      <h1 className="mt-1 font-display text-4xl tracking-tight md:text-5xl">{title}</h1>
      <p className="mt-2 max-w-2xl text-pretty text-sm text-muted">{children}</p>
      <p className="mt-2 text-xs">
        <About id={id}>Help</About>
      </p>
    </div>
  );
}
