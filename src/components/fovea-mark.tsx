import { cn } from "@/lib/utils";

export function FoveaMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      className={cn("text-accent", className)}
      aria-hidden="true"
      fill="none"
    >
      <circle cx="16" cy="16" r="13.5" stroke="currentColor" strokeWidth="1" opacity="0.35" />
      <circle cx="16" cy="16" r="8.5" stroke="currentColor" strokeWidth="1.1" opacity="0.7" />
      <circle cx="16" cy="16" r="3.2" fill="currentColor" />
    </svg>
  );
}
