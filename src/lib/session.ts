import { create } from "zustand";
import { persist } from "zustand/middleware";

const KEY = "fovea.principal";

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
