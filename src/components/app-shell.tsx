import { Link, useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";
import { SignedIn, SignedOut, UserButton } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { useHorizon } from "@/lib/store";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/", label: "Dashboard" },
  { to: "/ingest", label: "Import" },
  { to: "/predict", label: "Predict" },
  { to: "/sheaf", label: "Quality" },
  { to: "/locks", label: "Gates" },
  { to: "/transfer", label: "Transfer" },
  { to: "/steer", label: "Steer" },
  { to: "/train", label: "Train" },
  { to: "/fence", label: "Fence" },
  { to: "/compare", label: "Compare" },
  { to: "/rogue", label: "Drilling" },
  { to: "/studio", label: "Audit" },
  { to: "/ledger", label: "History" },
  { to: "/guide", label: "Help" },
] as const;

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { isPending } = useCurrentUserState();
  const rehydrate = useHorizon((s) => s.rehydrate);

  useEffect(() => {
    rehydrate();
  }, [rehydrate]);

  return (
    <div className="min-h-dvh bg-bg text-fg">
      <header className="sticky top-0 z-30 border-b border-border bg-bg/90 backdrop-blur-sm">
        <div className="mx-auto flex max-w-[1440px] items-center gap-6 px-4 py-3 md:px-6">
          <Link to="/" className="flex items-baseline gap-2 no-underline">
            <span className="font-display text-xl tracking-tight text-fg">Horizon</span>
            <span className="hidden text-[11px] uppercase tracking-[0.16em] text-subtle sm:inline">
              geosteering
            </span>
          </Link>
          <nav className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto">
            {NAV.map((item) => {
              const active =
                item.to === "/"
                  ? pathname === "/"
                  : pathname === item.to || pathname.startsWith(`${item.to}/`);
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={cn(
                    "rounded-sm px-2.5 py-2 text-sm no-underline transition-colors duration-150",
                    active ? "bg-elevated text-fg" : "text-muted hover:text-fg",
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <div className="shrink-0">
            {isPending ? (
              <div className="h-8 w-24 animate-pulse rounded-sm bg-elevated" />
            ) : (
              <>
                <SignedIn>
                  <UserButton />
                </SignedIn>
                <SignedOut>
                  <Link
                    to="/login"
                    className="text-sm text-muted no-underline hover:text-fg"
                  >
                    Sign in
                  </Link>
                </SignedOut>
              </>
            )}
          </div>
        </div>
      </header>
      <div className="mx-auto max-w-[1440px] px-4 py-6 md:px-6 md:py-8">{children}</div>
    </div>
  );
}
