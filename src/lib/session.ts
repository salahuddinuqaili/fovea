import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { WorkResult } from "@/kernel/types";

const KEY = "fovea.principal";
const WORK_KEY = "fovea.work-session";

interface SessionState {
  principalId: string;
  setPrincipalId: (id: string) => void;
}

export const useFoveaSession = create<SessionState>()(
  persist(
    (set) => ({
      principalId: "prin_maya",
      setPrincipalId: (principalId) => set({ principalId }),
    }),
    { name: KEY },
  ),
);

interface WorkSessionState {
  threads: Record<string, WorkResult[]>;
  selectedId: Record<string, string | null>;
  pushResult: (principalId: string, result: WorkResult) => void;
  selectResult: (principalId: string, taskId: string) => void;
  hydrateThread: (principalId: string, tasks: WorkResult[]) => void;
}

export const useWorkSession = create<WorkSessionState>()(
  persist(
    (set) => ({
      threads: {},
      selectedId: {},
      pushResult: (principalId, result) =>
        set((s) => ({
          threads: { ...s.threads, [principalId]: [...(s.threads[principalId] ?? []), result] },
          selectedId: { ...s.selectedId, [principalId]: result.taskId },
        })),
      selectResult: (principalId, taskId) =>
        set((s) => ({ selectedId: { ...s.selectedId, [principalId]: taskId } })),
      hydrateThread: (principalId, tasks) =>
        set((s) => {
          const current = s.threads[principalId] ?? [];
          if (!current.length) return s;
          const byId = new Map(tasks.map((t) => [t.taskId, t]));
          let changed = false;
          const next = current.map((item) => {
            const fresh = byId.get(item.taskId);
            if (!fresh) return item;
            if (
              fresh.status === item.status &&
              fresh.approvals[0]?.decision === item.approvals[0]?.decision &&
              fresh.approvals[0]?.executionStatus === item.approvals[0]?.executionStatus
            ) {
              return item;
            }
            changed = true;
            return fresh;
          });
          if (!changed) return s;
          return { threads: { ...s.threads, [principalId]: next } };
        }),
    }),
    {
      name: WORK_KEY,
      storage: createJSONStorage(() => sessionStorage),
    },
  ),
);
