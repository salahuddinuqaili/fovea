import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 8_000, retry: 0, refetchOnWindowFocus: false },
  },
});

export function AuthProvider({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <Toaster
        theme="dark"
        position="bottom-right"
        toastOptions={{
          style: {
            background: "var(--color-surface-2)",
            color: "var(--color-fg)",
            border: "1px solid var(--color-border)",
          },
        }}
      />
    </QueryClientProvider>
  );
}
