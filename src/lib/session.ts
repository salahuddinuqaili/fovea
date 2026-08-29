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
  consumedQs: string[];
  pushResult: (principalId: string, result: WorkResult) => void;
  selectResult: (principalId: string, taskId: string) => void;
  markConsumedQ: (q: string) => void;
  hasConsumedQ: (q: string) => boolean;
}

export const useWorkSession = create<WorkSessionState>()(
  persist(
    (set, get) => ({
      threads: {},
      selectedId: {},
      consumedQs: [],
      pushResult: (principalId, result) =>
        set((s) => ({
          threads: { ...s.threads, [principalId]: [...(s.threads[principalId] ?? []), result] },
          selectedId: { ...s.selectedId, [principalId]: result.taskId },
        })),
      selectResult: (principalId, taskId) =>
        set((s) => ({ selectedId: { ...s.selectedId, [principalId]: taskId } })),
      markConsumedQ: (q) =>
        set((s) => ({ consumedQs: s.consumedQs.includes(q) ? s.consumedQs : [...s.consumedQs.slice(-24), q] })),
      hasConsumedQ: (q) => get().consumedQs.includes(q),
    }),
    {
      name: WORK_KEY,
      storage: createJSONStorage(() => sessionStorage),
    },
  ),
);
