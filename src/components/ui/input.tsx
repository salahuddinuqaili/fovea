import * as React from "react";
import { cn } from "@/lib/utils";

export function Input({ className, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      className={cn(
        "h-10 w-full rounded-[var(--radius-sm)] border border-border bg-surface px-3 text-sm text-fg placeholder:text-subtle outline-none focus-visible:border-border-strong",
        className,
      )}
      {...props}
    />
  );
}

export function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      className={cn(
        "min-h-24 w-full rounded-[var(--radius-md)] border border-border bg-surface px-3 py-2 text-sm text-fg placeholder:text-subtle outline-none focus-visible:border-border-strong",
        className,
      )}
      {...props}
    />
  );
}
