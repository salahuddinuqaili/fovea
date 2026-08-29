import {
  createHash,
  createPrivateKey,
  createPublicKey,
  randomUUID,
  sign as nodeSign,
  verify as nodeVerify,
} from "node:crypto";

/** Demo signing material. v0 uses an embedded keypair. v1 replaces this with KMS/HSM. */
export const DEMO_PRIVATE_PEM = `-----BEGIN PRIVATE KEY-----
MC4CAQAwBQYDK2VwBCIEIFZ99/KoiHLZtxzDCyQ+2O3UYixlRuSg2T3bN/EzHB21
-----END PRIVATE KEY-----`;

export const DEMO_PUBLIC_PEM = `-----BEGIN PUBLIC KEY-----
MCowBQYDK2VwAyEArqwuEAqjQ0zClhpSGguHorn607O6YIhhtHW+3AIQHTI=
-----END PUBLIC KEY-----`;

export function sha256(input: string | Buffer) {
  return createHash("sha256").update(input).digest("hex");
}

export function uuid() {
  return randomUUID();
}

export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((v) => canonicalJson(v)).join(",")}]`;
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalJson(obj[k])}`).join(",")}}`;
}

export function digestObject(value: unknown) {
  return sha256(canonicalJson(value));
}

export function signDigest(digestHex: string, privatePem = DEMO_PRIVATE_PEM) {
  const key = createPrivateKey(privatePem);
  return nodeSign(null, Buffer.from(digestHex, "hex"), key).toString("base64");
}

export function verifyDigest(
  digestHex: string,
  signatureB64: string,
  publicPem = DEMO_PUBLIC_PEM,
) {
  try {
    const key = createPublicKey(publicPem);
    return nodeVerify(null, Buffer.from(digestHex, "hex"), key, Buffer.from(signatureB64, "base64"));
  } catch {
    return false;
  }
}

export function hashAction(action: Record<string, unknown>) {
  return digestObject(action);
}
