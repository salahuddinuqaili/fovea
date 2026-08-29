import { applyDurableSlice, durableSlice } from "@/kernel/durable";
import { getStore, isHydrated, markHydrated } from "@/kernel/store";
import { verifyRelease } from "@/kernel/release";

const SNAPSHOT_ID = "singleton";

async function getClient() {
  const { getSql, dbSource } = await import("@/lib/db");
  return { sql: await getSql(), dbSource };
}

export async function hydrateControlStore(): Promise<void> {
  if (isHydrated()) return;
  const store = getStore();
  try {
    const { sql, dbSource } = await getClient();
    const rows = await sql.query<{ payload: string }>(
      "select payload from fovea_control_snapshot where id = $1",
      [SNAPSHOT_ID],
    );
    const raw = rows[0]?.payload;
    if (raw) {
      const parsed = JSON.parse(raw) as ReturnType<typeof durableSlice>;
      if (parsed && parsed.version === 1) {
        if (parsed.loadedRelease && !verifyRelease(parsed.loadedRelease).ok) {
          parsed.loadedRelease = store.state.loadedRelease;
        }
        store.state = applyDurableSlice(store.state, parsed);
      }
    }
    store.emit({
      taskId: null,
      sessionId: null,
      principalId: "system",
      eventType: "control.hydrated",
      resourceIds: [dbSource],
      correlationId: "control-store",
      summary: `Control metadata hydrated (${dbSource}). Personal memory was not loaded from the snapshot.`,
    });
  } catch (err) {
    console.error("[fovea] control hydrate failed", err);
  } finally {
    markHydrated(true);
  }
}

export async function persistControlStore(): Promise<void> {
  if (!isHydrated()) return;
  try {
    const { sql } = await getClient();
    const payload = JSON.stringify(durableSlice(getStore().state));
    await sql.query(
      `insert into fovea_control_snapshot (id, payload, updated_at)
       values ($1, $2, now())
       on conflict (id) do update set payload = excluded.payload, updated_at = now()`,
      [SNAPSHOT_ID, payload],
    );
  } catch (err) {
    console.error("[fovea] control persist failed", err);
  }
}

export async function withControlPlane<T>(fn: () => T | Promise<T>): Promise<T> {
  await hydrateControlStore();
  try {
    return await fn();
  } finally {
    await persistControlStore();
  }
}

export async function controlMeta() {
  await hydrateControlStore();
  const { dbSource } = await getClient();
  return { durable: true as const, backend: dbSource };
}
