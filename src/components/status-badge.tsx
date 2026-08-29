import { Badge } from "@/components/ui/badge";

export function StatusBadge({ status }: { status: string }) {
  const tone =
    status === "completed" || status === "abstained"
      ? "ok"
      : status === "refused" || status === "failed" || status === "blocked"
        ? "danger"
        : status === "needs_approval"
          ? "warn"
          : "neutral";
  return <Badge tone={tone as "ok"}>{status.replaceAll("_", " ")}</Badge>;
}
