import { DEMO_PRIVATE_PEM, DEMO_PUBLIC_PEM, sha256, signDigest, verifyDigest } from "./crypto.ts";

/** Demo KMS. Private material never leaves this module. There is no skip-signature. */
export const RELEASE_KEY_ID = "kms:fovea-release-demo";

export interface KmsKey {
  keyId: string;
  algorithm: "Ed25519";
  purpose: "release-signing";
  exportable: false;
  status: "active" | "disabled";
}

export interface KmsAttestation {
  keyId: string;
  algorithm: "Ed25519";
  exportable: false;
  skipSignatureAllowed: false;
  runtimeVerified: boolean;
  provider: "demo-kms";
}

const KEYS: Record<string, KmsKey & { privatePem: string; publicPem: string }> = {
  [RELEASE_KEY_ID]: {
    keyId: RELEASE_KEY_ID,
    algorithm: "Ed25519",
    purpose: "release-signing",
    exportable: false,
    status: "active",
    privatePem: DEMO_PRIVATE_PEM,
    publicPem: DEMO_PUBLIC_PEM,
  },
};

export function kmsList(): KmsKey[] {
  return Object.values(KEYS).map(({ privatePem: _p, publicPem: _u, ...key }) => key);
}

export function kmsSign(digestHex: string, keyId = RELEASE_KEY_ID): { ok: true; signature: string; keyId: string } | { ok: false; reason: string } {
  const key = KEYS[keyId];
  if (!key || key.status !== "active") return { ok: false, reason: `Unknown or disabled KMS key ${keyId}.` };
  return { ok: true, signature: signDigest(digestHex, key.privatePem), keyId };
}

export function kmsVerify(digestHex: string, signature: string, keyId = RELEASE_KEY_ID): boolean {
  const key = KEYS[keyId];
  if (!key || key.status !== "active") return false;
  return verifyDigest(digestHex, signature, key.publicPem);
}

export function kmsAttest(keyId = RELEASE_KEY_ID): KmsAttestation | null {
  const key = KEYS[keyId];
  if (!key) return null;
  return {
    keyId: key.keyId,
    algorithm: key.algorithm,
    exportable: false,
    skipSignatureAllowed: false,
    runtimeVerified: true,
    provider: "demo-kms",
  };
}

export function runtimeVerify(keyId = RELEASE_KEY_ID): {
  ok: boolean;
  attestation: KmsAttestation | null;
  reasons: string[];
} {
  const reasons: string[] = [];
  const attestation = kmsAttest(keyId);
  if (!attestation) {
    return { ok: false, attestation: null, reasons: [`KMS key ${keyId} is not registered.`] };
  }
  if (attestation.exportable) reasons.push("Signing key must not be exportable.");
  if (attestation.skipSignatureAllowed) reasons.push("Runtime must not honor --skip-signature-check.");
  const probe = sha256("runtime-verify");
  const signed = kmsSign(probe, keyId);
  if (!signed.ok) reasons.push(signed.reason);
  else if (!kmsVerify(probe, signed.signature, keyId)) reasons.push("KMS sign/verify roundtrip failed.");
  return { ok: reasons.length === 0, attestation, reasons };
}
