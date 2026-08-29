import { Link, useRouterState } from "@tanstack/react-router";
import {
  Activity,
  ClipboardCheck,
  Cpu,
  FileSearch,
  GitBranch,
  LayoutDashboard,
  MemoryStick,
  Menu,
  Scale,
  ShieldAlert,
  Sparkles,
  SquareTerminal,
  Wallet,
  Wrench,
} from "lucide-react";
import { useState } from "react";
import { CommandPalette } from "@/components/command-palette";
import { FoveaMark } from "@/components/fovea-mark";
import { Badge } from "@/components/ui/badge";
import { bootstrapFn } from "@/lib/api";
import { useFoveaSession } from "@/lib/session";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";

const NAV = [
  {
    label: "Operate",
    items: [
      { to: "/", label: "Command", icon: LayoutDashboard },
      { to: "/work", label: "Work", icon: SquareTerminal },
      { to: "/tasks", label: "Tasks", icon: FileSearch },
      { to: "/approvals", label: "Approvals", icon: ClipboardCheck },
      { to: "/backfills", label: "Backfills", icon: GitBranch },
    ],
  },
  {
    label: "Knowledge",
    items: [
      { to: "/memory", label: "Memory", icon: MemoryStick },
      { to: "/skills", label: "Skills", icon: Sparkles },
    ],
  },
  {
    label: "Govern",
    items: [
      { to: "/evals", label: "Evals", icon: Scale },
      { to: "/audit", label: "Audit", icon: FileSearch },
      { to: "/policies", label: "Policy", icon: ShieldAlert },
      { to: "/releases", label: "Releases", icon: ShieldAlert },
      { to: "/health", label: "Health", icon: Activity },
    ],
  },
  {
    label: "Platform",
    items: [
      { to: "/tools", label: "Tools", icon: Wrench },
      { to: "/models", label: "Models", icon: Cpu },
      { to: "/cost", label: "Cost", icon: Wallet },
    ],
  },
];

function distinctiveRole(roles: string[]) {
  const order = ["os_owner", "security_owner", "auditor", "approver", "eval_owner", "team_maintainer", "analyst"];
  return order.find((r) => roles.includes(r)) ?? roles[0] ?? "principal";
}

const MOBILE_PRIMARY = NAV[0].items.slice(0, 4);

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const principalId = useFoveaSession((s) => s.principalId);
  const setPrincipalId = useFoveaSession((s) => s.setPrincipalId);
  const boot = useQuery({ queryKey: ["bootstrap"], queryFn: () => bootstrapFn() });
  const principal = boot.data?.principals.find((p) => p.id === principalId);
  const [moreOpen, setMoreOpen] = useState(false);
  const principals = boot.data?.principals ?? [
    { id: "prin_maya", displayName: "Maya Chen", roles: ["analyst"] },
  ];

  return (
    <div className="flex min-h-dvh bg-bg">
      <aside className="hidden w-[232px] shrink-0 flex-col border-r border-border bg-surface md:flex">
        <div className="flex items-center gap-2.5 px-5 py-5">
          <FoveaMark className="size-7" />
          <div>
            <div className="font-display text-xl leading-none text-fg">Fovea</div>
            <div className="mt-0.5 text-[10px] uppercase tracking-[0.18em] text-subtle">Agentic OS</div>
          </div>
        </div>
        <nav className="flex-1 overflow-y-auto px-3 pb-6">
          {NAV.map((group) => (
            <div key={group.label} className="mb-5">
              <div className="px-2 pb-1.5 text-[10px] font-medium uppercase tracking-[0.16em] text-subtle">
                {group.label}
              </div>
              <ul className="space-y-0.5">
                {group.items.map((item) => {
                  const active = item.to === "/" ? pathname === "/" : pathname === item.to || pathname.startsWith(`${item.to}/`);
                  const Icon = item.icon;
                  return (
                    <li key={item.to}>
                      <Link
                        to={item.to}
                        className={cn(
                          "flex h-9 items-center gap-2.5 rounded-[var(--radius-sm)] px-2.5 text-sm transition-colors",
                          active ? "bg-surface-2 text-fg" : "text-muted hover:bg-surface-2 hover:text-fg",
                        )}
                      >
                        <Icon className="size-4 opacity-70" />
                        {item.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>
        <div className="border-t border-border p-3">
          <div className="rounded-[var(--radius-md)] border border-border bg-bg px-3 py-2.5">
            <div className="text-[10px] uppercase tracking-[0.14em] text-subtle">Autonomy</div>
            <div className="mt-1 font-mono text-xs text-fg">Stage B · sandbox after approval</div>
          </div>
          <Link to="/about" className="mt-2 block px-1 py-1 text-[11px] text-subtle hover:text-fg">
            About this OS
          </Link>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center gap-3 border-b border-border bg-surface/80 px-4 backdrop-blur md:px-6">
          <div className="flex items-center gap-2 md:hidden">
            <FoveaMark className="size-6" />
            <span className="font-display text-lg">Fovea</span>
          </div>
          <div className="hidden items-center gap-2 md:flex">
            <Badge tone="ok">Demo</Badge>
            <Badge>{boot.data?.verification.ok ? "Release signed" : "Unverified"}</Badge>
            {boot.data?.kill.entireOs ? <Badge tone="danger">OS disabled</Badge> : null}
            {boot.data?.kill.writePlane ? <Badge tone="warn">Writes off</Badge> : null}
          </div>
          <div className="ml-auto flex items-center gap-2">
            <CommandPalette roles={principal?.roles ?? ["analyst"]} />
            <label className="sr-only" htmlFor="principal">
              Acting as
            </label>
            <select
              id="principal"
              value={principalId}
              onChange={(e) => setPrincipalId(e.target.value)}
              className="h-10 max-w-[220px] rounded-[var(--radius-sm)] border border-border bg-surface-2 px-3 text-sm text-fg"
            >
              {principals.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.displayName} · {distinctiveRole(p.roles)}
                </option>
              ))}
            </select>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto pb-20 md:pb-0">{children}</main>
        <nav className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-5 border-t border-border bg-surface pb-[env(safe-area-inset-bottom)] md:hidden">
          {MOBILE_PRIMARY.map((item) => {
            const Icon = item.icon;
            const active = item.to === "/" ? pathname === "/" : pathname.startsWith(item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex h-14 flex-col items-center justify-center gap-0.5 text-[10px]",
                  active ? "text-fg" : "text-muted",
                )}
              >
                <Icon className="size-4" />
                {item.label}
              </Link>
            );
          })}
          <button
            type="button"
            onClick={() => setMoreOpen((o) => !o)}
            className={cn(
              "flex h-14 flex-col items-center justify-center gap-0.5 text-[10px]",
              moreOpen ? "text-fg" : "text-muted",
            )}
          >
            <Menu className="size-4" />
            More
          </button>
        </nav>
        {moreOpen ? (
          <div className="fixed inset-0 z-30 md:hidden">
            <button
              type="button"
              className="absolute inset-0 bg-bg/70"
              aria-label="Close menu"
              onClick={() => setMoreOpen(false)}
            />
            <div className="absolute inset-x-0 bottom-0 max-h-[70dvh] overflow-y-auto rounded-t-[var(--radius-xl)] border border-border bg-surface p-4 pb-24">
              {NAV.slice(1).map((group) => (
                <div key={group.label} className="mb-4">
                  <div className="px-1 pb-2 text-[10px] font-medium uppercase tracking-[0.16em] text-subtle">
                    {group.label}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {group.items.map((item) => {
                      const Icon = item.icon;
                      return (
                        <Link
                          key={item.to}
                          to={item.to}
                          onClick={() => setMoreOpen(false)}
                          className="flex h-12 items-center gap-2 rounded-[var(--radius-md)] border border-border bg-bg px-3 text-sm"
                        >
                          <Icon className="size-4 text-muted" />
                          {item.label}
                        </Link>
                      );
                    })}
                  </div>
                </div>
              ))}
              <Link
                to="/backfills"
                onClick={() => setMoreOpen(false)}
                className="flex h-12 items-center gap-2 rounded-[var(--radius-md)] border border-border bg-bg px-3 text-sm"
              >
                <GitBranch className="size-4 text-muted" />
                Backfills
              </Link>
            </div>
          </div>
        ) : null}
      </div>
      <span className="sr-only">{principal?.title}</span>
    </div>
  );
}
