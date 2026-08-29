import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { uuid } from "./crypto.ts";
import type { ImprovementEvent, MemoryItem, MemoryScope } from "./types.ts";

const APP_SECRET = "fovea-v0-demo-memory-key-not-for-production";

function keyFor(principalId: string) {
  return createHash("sha256").update(`${APP_SECRET}:${principalId}`).digest();
}

export function encryptPersonal(principalId: string, plaintext: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", keyFor(principalId), iv);
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("base64")}.${tag.toString("base64")}.${enc.toString("base64")}`;
}

export function decryptPersonal(principalId: string, packed: string) {
  const [ivB64, tagB64, dataB64] = packed.split(".");
  const decipher = createDecipheriv("aes-256-gcm", keyFor(principalId), Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  const out = Buffer.concat([
    decipher.update(Buffer.from(dataB64, "base64")),
    decipher.final(),
  ]);
  return out.toString("utf8");
}

export function makeMemory(partial: Omit<MemoryItem, "id" | "createdAt" | "updatedAt"> & { id?: string }): MemoryItem {
  const now = new Date().toISOString();
  return {
    id: partial.id ?? `mem_${uuid().slice(0, 8)}`,
    createdAt: now,
    updatedAt: now,
    ...partial,
  };
}

const EMAIL = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const PRINCIPAL = /prin_[a-z0-9]+/gi;
const NAME_HINTS = /\b(Maya Chen|Jordan Hale|Sam Okonkwo|Riley Park|Alex Voss)\b/g;

export function sanitizeForImprovement(text: string): { text: string; passed: boolean } {
  let t = text.replace(EMAIL, "[redacted-email]");
  t = t.replace(PRINCIPAL, "[redacted-principal]");
  t = t.replace(NAME_HINTS, "[redacted-name]");
  t = t.replace(/session_[a-z0-9-]+/gi, "[redacted-session]");
  const passed = !EMAIL.test(t) && !PRINCIPAL.test(t) && !NAME_HINTS.test(t);
  return { text: t, passed };
}

export function toImprovementEvent(input: {
  category: ImprovementEvent["category"];
  problem: string;
  context: string;
  agentVersion: string;
}): ImprovementEvent {
  const problem = sanitizeForImprovement(input.problem);
  const context = sanitizeForImprovement(input.context);
  return {
    eventId: `imp_${uuid().slice(0, 8)}`,
    category: input.category,
    generalizedProblem: problem.text,
    generalizedContext: context.text,
    frequencyHint: 1,
    agentVersion: input.agentVersion,
    toolVersions: [],
    privacyScanPassed: problem.passed && context.passed,
    sourceUser: null,
    sourceSession: null,
  };
}

export function seedMemory(): MemoryItem[] {
  return [
    makeMemory({
      scope: "org",
      ownerPrincipalId: null,
      teamId: null,
      path: "/org/metrics/northstar_revenue",
      title: "Canonical: North-star revenue",
      body: "GMV of completed non-test orders in USD. Source: analytics.fct_orders. Changes require data-governance review.",
      origin: "signed_policy",
      encrypted: false,
    }),
    makeMemory({
      scope: "org",
      ownerPrincipalId: null,
      teamId: null,
      path: "/org/policy/abstention",
      title: "Abstention is a success state",
      body: "If evidence is insufficient or a metric is ambiguous, say so. Do not guess.",
      origin: "signed_policy",
      encrypted: false,
    }),
    makeMemory({
      scope: "team",
      ownerPrincipalId: null,
      teamId: "team_analytics",
      path: "/team/analytics/conventions",
      title: "Growth analytics conventions",
      body: "Weeks are ISO weeks starting Monday. Exclude is_test = true. Currency converted to USD at order time.",
      origin: "control_plane",
      encrypted: false,
    }),
    makeMemory({
      scope: "personal",
      ownerPrincipalId: "prin_maya",
      teamId: "team_analytics",
      path: "/personal/prin_maya/working-memory/qbr-notes",
      title: "Private QBR notes",
      body: "Maya Chen personal reminder: draft the fill-rate slide; email maya.chen@lumen.test. Do not promote.",
      origin: "memory",
      encrypted: true,
    }),
  ];
}

export function canReadMemory(
  callerId: string,
  item: MemoryItem,
  actionAllowed: boolean,
): { ok: boolean; reason: string } {
  if (!actionAllowed) return { ok: false, reason: "Action not in effective permission set." };
  if (item.scope === "org") return { ok: true, reason: "org" };
  if (item.scope === "team") {
    return { ok: true, reason: "team" };
  }
  if (item.scope === "personal") {
    if (item.ownerPrincipalId !== callerId) {
      return { ok: false, reason: "INV-005 personal memory cannot be accessed by another user." };
    }
    return { ok: true, reason: "owner" };
  }
  return { ok: false, reason: "unknown scope" };
}

export type { MemoryScope };
