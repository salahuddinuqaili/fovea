import { digestObject, sha256 } from "./crypto.ts";
import { kmsSign, kmsVerify, RELEASE_KEY_ID, runtimeVerify } from "./kms.ts";
import type { ReleaseArtifact } from "./types.ts";
import { POLICY_VERSION } from "./types.ts";

export function buildRelease(input: {
  version: string;
  sourceCommit: string;
  tree: unknown;
  revoked?: boolean;
}): ReleaseArtifact {
  const treeHash = digestObject(input.tree);
  const policyHash = sha256(POLICY_VERSION);
  const evalSuiteHash = sha256("evals:v1.0.0");
  const artifactDigest = sha256(`${input.version}|${input.sourceCommit}|${treeHash}|${policyHash}|${evalSuiteHash}`);
  const signed = kmsSign(artifactDigest, RELEASE_KEY_ID);
  if (!signed.ok) throw new Error(signed.reason);
  return {
    version: input.version,
    sourceCommit: input.sourceCommit,
    treeHash,
    buildId: `build_${input.version.replace(/\./g, "")}`,
    builtAt: "2026-08-29T12:00:00Z",
    policyHash,
    evalSuiteHash,
    artifactDigest,
    signature: signed.signature,
    signer: RELEASE_KEY_ID,
    keyId: RELEASE_KEY_ID,
    algorithm: "Ed25519",
    revoked: Boolean(input.revoked),
  };
}

export function verifyRelease(
  release: ReleaseArtifact,
  opts?: { skipSignature?: boolean; trustedPublicPem?: string },
): { ok: boolean; reasons: string[] } {
  const reasons: string[] = [];
  if (opts?.skipSignature) {
    return { ok: false, reasons: ["--skip-signature-check is not available in production."] };
  }
  if (opts?.trustedPublicPem) {
    reasons.push("Raw public PEMs are not accepted. Verify through the KMS key id.");
  }
  if (release.revoked) reasons.push("Release is revoked.");
  const keyId = release.keyId || release.signer || RELEASE_KEY_ID;
  const runtime = runtimeVerify(keyId);
  if (!runtime.ok) reasons.push(...runtime.reasons);
  const expected = sha256(
    `${release.version}|${release.sourceCommit}|${release.treeHash}|${release.policyHash}|${release.evalSuiteHash}`,
  );
  if (expected !== release.artifactDigest) reasons.push("Artifact digest does not match contents.");
  if (!kmsVerify(release.artifactDigest, release.signature, keyId)) reasons.push("KMS signature verification failed.");
  return { ok: reasons.length === 0, reasons };
}

export function tamper(release: ReleaseArtifact): ReleaseArtifact {
  return {
    ...release,
    treeHash: sha256("tampered-tree"),
    artifactDigest: sha256("tampered-digest"),
  };
}

export function unsigned(release: ReleaseArtifact): ReleaseArtifact {
  return { ...release, signature: "not-a-signature" };
}

export const SEED_TREE = {
  kernel: "fovea-10.0.0",
  policies: POLICY_VERSION,
  evals: "v1.0.0",
};
