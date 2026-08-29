import { digestObject, sha256, signDigest, verifyDigest } from "./crypto.ts";
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
  const signature = signDigest(artifactDigest);
  return {
    version: input.version,
    sourceCommit: input.sourceCommit,
    treeHash,
    buildId: `build_${input.version.replace(/\./g, "")}`,
    builtAt: "2026-08-28T18:00:00Z",
    policyHash,
    evalSuiteHash,
    artifactDigest,
    signature,
    signer: "kms:fovea-release-demo",
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
  if (release.revoked) reasons.push("Release is revoked.");
  const expected = sha256(
    `${release.version}|${release.sourceCommit}|${release.treeHash}|${release.policyHash}|${release.evalSuiteHash}`,
  );
  if (expected !== release.artifactDigest) reasons.push("Artifact digest does not match contents.");
  const sigOk = verifyDigest(release.artifactDigest, release.signature, opts?.trustedPublicPem);
  if (!sigOk) reasons.push("Signature verification failed.");
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
  kernel: "fovea-1.0.0",
  policies: POLICY_VERSION,
  evals: "v1.0.0",
};
