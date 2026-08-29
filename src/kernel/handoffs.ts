import { uuid } from "./crypto.ts";
import type { DeskHandoff } from "./types.ts";

const TTL_MS = 8 * 3600_000;

export function isHandoffOpen(h: DeskHandoff, now = Date.now()): boolean {
  if (h.openedAt) return false;
  if (Date.parse(h.expiresAt) <= now) return false;
  return true;
}

export function incomingHandoffs(list: DeskHandoff[], principalId: string, now = Date.now()): DeskHandoff[] {
  return list.filter((h) => h.toPrincipalId === principalId && isHandoffOpen(h, now));
}

export function makeHandoff(input: {
  fromPrincipalId: string;
  toPrincipalId: string;
  kind: DeskHandoff["kind"];
  label: string;
  href: string;
  hint: string;
  taskId?: string | null;
}): DeskHandoff {
  const now = Date.now();
  return {
    id: `hand_${uuid().slice(0, 10)}`,
    fromPrincipalId: input.fromPrincipalId,
    toPrincipalId: input.toPrincipalId,
    kind: input.kind,
    label: input.label,
    href: input.href.split("?")[0] || "/work",
    hint: input.hint,
    taskId: input.taskId ?? null,
    createdAt: new Date(now).toISOString(),
    expiresAt: new Date(now + TTL_MS).toISOString(),
    openedAt: null,
  };
}

export function pruneHandoffs(list: DeskHandoff[]): DeskHandoff[] {
  const open = list.filter((h) => isHandoffOpen(h));
  const closed = list.filter((h) => !isHandoffOpen(h)).slice(0, 12);
  return [...open, ...closed];
}

export function normalizeHandoff(h: DeskHandoff): DeskHandoff {
  return {
    ...h,
    openedAt: h.openedAt ?? null,
    taskId: h.taskId ?? null,
    kind: h.kind ?? "work",
  };
}
