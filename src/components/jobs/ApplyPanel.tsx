import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { listApplications, setJobStatus } from "@/lib/applications.functions";

const LABELS: Record<string, string> = {
  saved: "Saved",
  applied: "Applied",
  interviewing: "Interviewing",
  offer: "Offer",
  rejected: "Rejected",
};

// Lets the user close the loop from the tailoring workspace: once they've sent
// the tailored resume, mark the posting applied and keep the link to where
// they applied so the tracker can open it later.
export function ApplyPanel({ jobId, sourceUrl }: { jobId: string; sourceUrl: string | null }) {
  const qc = useQueryClient();
  const fetchApps = useServerFn(listApplications);
  const apply = useServerFn(setJobStatus);
  const apps = useQuery({ queryKey: ["applications"], queryFn: () => fetchApps() });
  const app = apps.data?.find((a) => a.job_id === jobId);
  const [url, setUrl] = useState("");

  const mutation = useMutation({
    mutationFn: (applicationUrl?: string) =>
      apply({ data: { jobId, status: "applied", ...(applicationUrl ? { applicationUrl } : {}) } }),
    onSuccess: async () => {
      toast.success("Marked as applied — it's now in your tracker");
      setUrl("");
      await Promise.all(
        ["applications", "jobs", "application-stats"].map((k) =>
          qc.invalidateQueries({ queryKey: [k] }),
        ),
      );
    },
    onError: (e: Error) => toast.error(e.message.includes("url") ? "Enter a valid link starting with https://" : e.message),
  });

  const status = app?.status ?? "saved";
  const applied = status !== "saved";
  const link = app?.application_url ?? null;

  return (
    <div className="mt-5 rounded-lg border border-border bg-secondary/30 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium">
          Status: <span className="text-primary">{LABELS[status] ?? status}</span>
          {app?.date_applied && (
            <span className="ml-2 text-xs font-normal text-muted-foreground">
              applied {app.date_applied}
            </span>
          )}
        </p>
        {applied && (
          <Link to="/applications" className="text-xs text-primary underline">
            Open in tracker
          </Link>
        )}
      </div>
      {link && (
        <a href={link} target="_blank" rel="noreferrer" className="mt-1 block truncate text-xs text-primary underline">
          {link}
        </a>
      )}
      {(!applied || !link) && (
        <form
          className="mt-3 flex flex-col gap-2 sm:flex-row"
          onSubmit={(e) => {
            e.preventDefault();
            mutation.mutate(url.trim() || undefined);
          }}
        >
          <Input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder={sourceUrl ? `Application link (e.g. ${sourceUrl})` : "Application link (optional)"}
            aria-label="Application link"
            className="h-9 text-sm"
          />
          <Button type="submit" size="sm" disabled={mutation.isPending || (applied && !url.trim())}>
            {applied ? "Save link" : "I applied"}
          </Button>
        </form>
      )}
    </div>
  );
}
