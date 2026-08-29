// PGLite's wasm/data are loaded from a sibling path of the bundled driver.
// Nitro does not copy them; production `vite preview` without DATABASE_URL
// would otherwise crash on first getSql(). Neon deploys never hit this path.
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const srcDir = join(root, "node_modules/@electric-sql/pglite/dist");
const destDir = join(root, ".vercel/output/functions/__server.func/_libs");

if (!existsSync(destDir)) {
  process.exit(0);
}
mkdirSync(destDir, { recursive: true });
for (const name of ["pglite.data", "pglite.wasm", "initdb.wasm"]) {
  const src = join(srcDir, name);
  if (!existsSync(src)) continue;
  copyFileSync(src, join(destDir, name));
}
