import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { listSkillsFn, putSkillFn } from "@/lib/api";
import { useFoveaSession } from "@/lib/session";

export const Route = createFileRoute("/_portal/skills")({ component: SkillsPage });

function SkillsPage() {
  const actorId = useFoveaSession((s) => s.principalId);
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["skills", actorId], queryFn: () => listSkillsFn({ data: { actorId } }) });
  const [id, setId] = useState("personal.notes");
  const [instructions, setInstructions] = useState("Prefer ISO weeks. Never request warehouse writes.");
  const [tools, setTools] = useState("warehouse.query");
  const mut = useMutation({
    mutationFn: () =>
      putSkillFn({
        data: {
          actorId,
          skill: {
            id,
            version: "1.0.0",
            scope: "personal",
            owner: actorId,
            description: "Personal skill",
            allowedTools: tools.split(",").map((s) => s.trim()).filter(Boolean),
            requestedPermissions: ["read"],
            dataClasses: ["internal"],
            instructions,
          },
        },
      }),
    onSuccess: () => {
      toast.success("Personal skill saved. Permissions were intersected with yours.");
      void qc.invalidateQueries({ queryKey: ["skills"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div>
      <PageHeader
        kicker="Knowledge"
        title="Skills"
        description="Enterprise skills are signed. Personal skills cannot declare permissions above the user or bypass tool policy."
      />
      <div className="grid gap-6 p-4 md:grid-cols-2 md:p-8">
        <div className="space-y-3">
          {(q.data ?? []).map((s) => (
            <article key={`${s.scope}:${s.id}`} className="rounded-[var(--radius-lg)] border border-border bg-surface p-4">
              <div className="flex items-center justify-between">
                <div className="font-medium">{s.id}</div>
                <Badge>{s.scope}</Badge>
              </div>
              <p className="mt-2 text-sm text-muted">{s.description}</p>
              <p className="mt-2 font-mono text-[11px] text-subtle">{s.allowedTools.join(", ") || "no tools"}</p>
            </article>
          ))}
        </div>
        <form
          className="rounded-[var(--radius-lg)] border border-border bg-surface p-5"
          onSubmit={(e) => {
            e.preventDefault();
            mut.mutate();
          }}
        >
          <h2 className="text-sm font-medium">New personal skill</h2>
          <label className="mt-4 block text-xs text-muted">
            Id
            <Input className="mt-1" value={id} onChange={(e) => setId(e.target.value)} />
          </label>
          <label className="mt-3 block text-xs text-muted">
            Allowed tools (comma)
            <Input className="mt-1" value={tools} onChange={(e) => setTools(e.target.value)} />
          </label>
          <label className="mt-3 block text-xs text-muted">
            Instructions
            <Textarea className="mt-1" value={instructions} onChange={(e) => setInstructions(e.target.value)} />
          </label>
          <p className="mt-2 text-xs text-subtle">Try adding a write tool you don’t have — it will be rejected.</p>
          <Button className="mt-4" type="submit" disabled={mut.isPending}>
            Save skill
          </Button>
        </form>
      </div>
    </div>
  );
}
