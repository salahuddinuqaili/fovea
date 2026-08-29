import { Command } from "cmdk";
import { useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { playbooksFor } from "@/lib/playbooks";
import { useFoveaSession } from "@/lib/session";

const NAV = [
  { to: "/", label: "Command", hint: "Control plane home" },
  { to: "/work", label: "Work console", hint: "Ask with evidence" },
  { to: "/guide", label: "Operator guide", hint: "Five-minute first run" },
  { to: "/approvals", label: "Approvals", hint: "Exact-hash decisions" },
  { to: "/tasks", label: "Tasks", hint: "Session history" },
  { to: "/evals", label: "Evaluations", hint: "Golden + adversarial gates" },
  { to: "/audit", label: "Audit", hint: "Append-only event stream" },
  { to: "/policies", label: "Policy", hint: "Intersection bundle" },
  { to: "/about", label: "About Fovea", hint: "What this OS is" },
] as const;

const PEOPLE = [
  { id: "prin_maya", name: "Maya Chen", role: "analyst" },
  { id: "prin_jordan", name: "Jordan Hale", role: "approver" },
  { id: "prin_sam", name: "Sam Okonkwo", role: "security owner" },
  { id: "prin_riley", name: "Riley Park", role: "auditor" },
  { id: "prin_alex", name: "Alex Voss", role: "OS owner" },
];

export function CommandPalette({ roles }: { roles: string[] }) {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const setPrincipalId = useFoveaSession((s) => s.setPrincipalId);
  const books = playbooksFor(roles);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const go = (href: string) => {
    setOpen(false);
    const [path, query] = href.split("?");
    const q = new URLSearchParams(query ?? "").get("q") ?? undefined;
    if (path === "/work") {
      void navigate({ to: "/work", search: q ? { q } : {} });
      return;
    }
    void navigate({ to: (path || "/") as "/" });
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="hidden h-9 items-center gap-2 rounded-[var(--radius-sm)] border border-border bg-surface-2 px-3 text-xs text-muted hover:text-fg md:flex"
        aria-label="Open command palette"
      >
        Jump to
        <kbd className="rounded border border-border px-1.5 py-0.5 font-mono text-[10px] text-subtle">⌘K</kbd>
      </button>
      {open ? (
        <div className="fixed inset-0 z-50 flex items-start justify-center px-3 pt-[12vh]">
          <button
            type="button"
            className="absolute inset-0 bg-bg/80 backdrop-blur-sm"
            aria-label="Close command palette"
            onClick={() => setOpen(false)}
          />
          <Command
            label="Command palette"
            loop
            className="relative z-10 w-full max-w-xl overflow-hidden rounded-[var(--radius-lg)] border border-border-strong bg-surface shadow-panel"
          >
            <Command.Input
              autoFocus
              placeholder="Jump, switch principal, or run a playbook…"
              className="h-12 w-full border-b border-border bg-transparent px-4 text-sm text-fg outline-none placeholder:text-subtle"
            />
            <Command.List className="max-h-[min(420px,60vh)] overflow-y-auto p-2">
              <Command.Empty className="px-3 py-6 text-center text-sm text-muted">No matches.</Command.Empty>
              <Command.Group
                heading="Playbooks"
                className="mb-2 [&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-[0.16em] [&_[cmdk-group-heading]]:text-subtle"
              >
                {books.map((p) => (
                  <Command.Item
                    key={p.id}
                    value={`${p.kicker} ${p.q}`}
                    onSelect={() => go(`/work?q=${encodeURIComponent(p.q)}`)}
                    className="flex cursor-pointer flex-col rounded-[var(--radius-sm)] px-3 py-2 data-[selected=true]:bg-surface-2"
                  >
                    <span className="text-sm text-fg">{p.kicker}</span>
                    <span className="text-xs text-muted">{p.q}</span>
                  </Command.Item>
                ))}
              </Command.Group>
              <Command.Group
                heading="Go to"
                className="mb-2 [&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-[0.16em] [&_[cmdk-group-heading]]:text-subtle"
              >
                {NAV.map((n) => (
                  <Command.Item
                    key={n.to}
                    value={n.label}
                    onSelect={() => go(n.to)}
                    className="flex cursor-pointer items-center justify-between rounded-[var(--radius-sm)] px-3 py-2 data-[selected=true]:bg-surface-2"
                  >
                    <span className="text-sm text-fg">{n.label}</span>
                    <span className="text-xs text-muted">{n.hint}</span>
                  </Command.Item>
                ))}
              </Command.Group>
              <Command.Group
                heading="Act as"
                className="[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-[0.16em] [&_[cmdk-group-heading]]:text-subtle"
              >
                {PEOPLE.map((p) => (
                  <Command.Item
                    key={p.id}
                    value={`act as ${p.name} ${p.role}`}
                    onSelect={() => {
                      setPrincipalId(p.id);
                      setOpen(false);
                    }}
                    className="flex cursor-pointer items-center justify-between rounded-[var(--radius-sm)] px-3 py-2 data-[selected=true]:bg-surface-2"
                  >
                    <span className="text-sm text-fg">{p.name}</span>
                    <span className="text-xs text-muted">{p.role}</span>
                  </Command.Item>
                ))}
              </Command.Group>
            </Command.List>
          </Command>
        </div>
      ) : null}
    </>
  );
}
