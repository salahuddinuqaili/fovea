import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

/** Grok preview fixtures that are gitignored in the public clone. */
export const HAS_OG_SKILL = existsSync(join(ROOT, ".grok/skills/og/SKILL.md"));
export const HAS_GROK_PUBLIC = existsSync(join(ROOT, "public/__grok/icon-180.png"));
export const HAS_APP_ENV = existsSync(join(ROOT, ".grok/app-env.json"));
