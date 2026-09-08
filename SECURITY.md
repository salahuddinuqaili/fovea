# Security

Report vulnerabilities **privately**. Do not file a public issue for an exploitable defect in policy, signing, SQL validation, credentials, grants, or memory isolation.

Use [GitHub private vulnerability reporting](https://github.com/salahuddinuqaili/fovea/security/advisories/new) on this repository.

## In scope

- Policy intersection and refusal paths
- Release signing and verification (`src/kernel/crypto.ts`, `src/kernel/kms.ts`, `src/kernel/release.ts`)
- SQL validators (`src/kernel/sql.ts`) — comment strip, stacked statements, sandbox WHERE
- Personal memory isolation and snapshot redaction
- Approval hash binding and separation of duties
- Grant issuance, expiry, and non-promotion

## Out of scope for this tree

- A live warehouse DSN or production execution (both stay gated)
- Demo principals and fixture data in the portal

## Demo material

Demo keys in `src/kernel/crypto.ts` are **not** production signing material. There is no `--skip-signature-check` path. Unsigned or tampered releases cannot load.
