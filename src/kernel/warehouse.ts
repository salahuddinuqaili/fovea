import type { PolicyResponse } from "./types.ts";

export interface WarehouseProfile {
  id: "fixture" | "live";
  label: string;
  mode: "fixture" | "live";
  connected: boolean;
  dsnPresent: boolean;
  policyGated: true;
  writes: "disabled" | "sandbox_only";
  reason: string;
}

export function fixtureWarehouseProfile(): WarehouseProfile {
  return {
    id: "fixture",
    label: "Fixture warehouse",
    mode: "fixture",
    connected: true,
    dsnPresent: false,
    policyGated: true,
    writes: "sandbox_only",
    reason: "Canonical metrics and sandbox writes use the in-process fixture. Production tables stay blocked.",
  };
}

export function liveWarehouseProfile(): WarehouseProfile {
  const dsn = typeof process !== "undefined" ? process.env.FOVEA_WAREHOUSE_DSN : undefined;
  const dsnPresent = Boolean(dsn && dsn.trim());
  return {
    id: "live",
    label: "Live warehouse",
    mode: "live",
    connected: false,
    dsnPresent,
    policyGated: true,
    writes: "disabled",
    reason: dsnPresent
      ? "A live DSN is present. Reads still require a matching policy grant. Writes stay disabled."
      : "No live DSN is configured. The fixture remains the read path. Connect is still policy-gated.",
  };
}

export function listWarehouseProfiles(): WarehouseProfile[] {
  return [fixtureWarehouseProfile(), liveWarehouseProfile()];
}

export function connectLiveWarehouse(policy: PolicyResponse): {
  ok: false;
  connected: false;
  profile: WarehouseProfile;
  reason: string;
} {
  const profile = liveWarehouseProfile();
  if (policy.decision === "deny") {
    return { ok: false, connected: false, profile, reason: policy.reason };
  }
  if (policy.decision === "require_approval") {
    return {
      ok: false,
      connected: false,
      profile,
      reason: "Connecting a live warehouse requires an exact-hash approval. No global autonomy grant applies.",
    };
  }
  if (!profile.dsnPresent) {
    return {
      ok: false,
      connected: false,
      profile,
      reason: "Policy would allow a live read path, but no warehouse DSN is configured. Fixture remains in use. Writes stay disabled.",
    };
  }
  return {
    ok: false,
    connected: false,
    profile,
    reason: "Live warehouse writes are disabled. A DSN does not arm production execution.",
  };
}
