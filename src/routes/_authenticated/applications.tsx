import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  addApplication,
  listApplications,
  updateApplicationFollowUp,
  updateApplicationStatus,
  type ApplicationStatus,
} from "@/lib/applications.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Hint } from "@/components/ui/hint";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, Plus } from "lucide-react";

export const Route = createFileRoute("/_authenticated/applications")({
  head: () => ({
    meta: [
      { title: "Applications — JobLanded" },
      {
        name: "description",
        content: "Track application status, notes and follow-up dates for every role you pursue.",
      },
      { property: "og:title", content: "Applications — JobLanded" },
      {
        property: "og:description",
        content: "Status, notes and follow-ups for every application.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ApplicationsPage,
});

const statusLabels: Record<ApplicationStatus, string> = {
  saved: "In process",
  applied: "Submitted",
  interviewing: "Interviewing",
  offer: "Offer",
  rejected: "Rejected",
};

type JobInfo = {
  title: string;
  company: string | null;
  location: string | null;
  pay_min: number | null;
  pay_max: number | null;
  source_url: string | null;
};

type ApplicationRow = {
  id: string;
  status: string;
  date_applied: string | null;
  follow_up_date: string | null;
  follow_up_sent: boolean;
  notes: string | null;
  created_at: string;
  job_id: string;
  jobs: JobInfo | JobInfo[] | null;
};

function jobOf(app: ApplicationRow): JobInfo | null {
  return Array.isArray(app.jobs) ? (app.jobs[0] ?? null) : app.jobs;
}

function payLine(job: JobInfo | null) {
  if (!job) return "";
  const parts = [job.company, job.location].filter(Boolean).join(" · ") || "No company listed";
  const pay =
    job.pay_min || job.pay_max
      ? ` · $${(job.pay_min ?? job.pay_max)!.toLocaleString()}${
          job.pay_max && job.pay_min ? `–$${job.pay_max.toLocaleString()}` : ""
        }`
      : "";
  return parts + pay;
}

function formatDate(value: string | null) {
  if (!value) return null;
  const d = new Date(`${value}T00:00:00`);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

const todayStr = () => new Date().toISOString().slice(0, 10);

function ApplicationsPage() {
  const qc = useQueryClient();
  const fetchApplications = useServerFn(listApplications);
  const create = useServerFn(addApplication);
  const setStatus = useServerFn(updateApplicationStatus);
  const setFollowUp = useServerFn(updateApplicationFollowUp);

  const [description, setDescription] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [open, setOpen] = useState(false);

  const applications = useQuery({
    queryKey: ["applications"],
    queryFn: async () => (await fetchApplications()) as unknown as ApplicationRow[],
  });

  const invalidateAll = () => {
    void qc.invalidateQueries({ queryKey: ["applications"] });
    void qc.invalidateQueries({ queryKey: ["jobs"] });
    void qc.invalidateQueries({ queryKey: ["active-applications"] });
  };

  const addMutation = useMutation({
    mutationFn: (input: { description: string; sourceUrl: string }) => create({ data: input }),
    onSuccess: () => {
      toast.success("Application added");
      setDescription("");
      setSourceUrl("");
      setOpen(false);
      invalidateAll();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const statusMutation = useMutation({
    mutationFn: (input: { id: string; status: ApplicationStatus }) => setStatus({ data: input }),
    onSuccess: invalidateAll,
    onError: (e: Error) => toast.error(e.message),
  });

  const followUpMutation = useMutation({
    mutationFn: (input: { id: string; follow_up_date?: string | null; follow_up_sent?: boolean }) =>
      setFollowUp({ data: input }),
    onSuccess: invalidateAll,
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <div className="panel p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold">Applications</h1>
            <p className="mt-2 max-w-xl text-sm text-muted-foreground">
              Every job you save opens an application automatically. Toggle it on once you've
              submitted, and refine the status as things move along.
            </p>
          </div>
          <Button onClick={() => setOpen((o) => !o)} variant={open ? "ghost" : "default"}>
            {open ? (
              "Cancel"
            ) : (
              <>
                <Plus className="mr-1.5 h-4 w-4" /> Add application
              </>
            )}
          </Button>
        </div>

        {open && (
          <form
            className="mt-6 space-y-4 border-t border-border pt-6"
            onSubmit={(e) => {
              e.preventDefault();
              addMutation.mutate({ description, sourceUrl });
            }}
          >
            <div>
              <Label htmlFor="app-description">Job description (optional if you add a URL)</Label>
              <Textarea
                id="app-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={10}
                placeholder="Paste the full posting text here…"
                className="mt-1.5"
              />
            </div>
            <div>
              <Label htmlFor="app-sourceUrl">Posting URL</Label>
              <Input
                id="app-sourceUrl"
                value={sourceUrl}
                onChange={(e) => setSourceUrl(e.target.value)}
                placeholder="https://…"
                className="mt-1.5"
              />
              <p className="mt-1.5 text-xs text-muted-foreground">
                No link handy? Leave this blank and paste the posting text below instead.
              </p>
            </div>
            <Button type="submit" disabled={addMutation.isPending}>
              {addMutation.isPending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
              Save & add application
            </Button>
          </form>
        )}
      </div>

      <div className="panel p-8">
        {applications.isLoading ? (
          <p className="text-sm text-muted-foreground">Loading your applications…</p>
        ) : applications.isError ? (
          <div className="space-y-3">
            <p className="text-sm text-destructive">
              Couldn't load your applications:{" "}
              {applications.error instanceof Error
                ? applications.error.message
                : "something went wrong."}
            </p>
            <Button size="sm" variant="outline" onClick={() => void applications.refetch()}>
              Try again
            </Button>
          </div>
        ) : (applications.data?.length ?? 0) === 0 ? (
          <p className="text-sm text-muted-foreground">
            No applications yet. Save a job on the{" "}
            <Link to="/jobs" className="text-primary underline">
              Jobs
            </Link>{" "}
            page, or add one above, and it'll show up here.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {applications.data!.map((app) => {
              const job = jobOf(app);
              const submitted = app.status !== "saved";
              const overdue =
                !app.follow_up_sent && !!app.follow_up_date && app.follow_up_date < todayStr();
              return (
                <li key={app.id} className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                      <Link
                        to="/jobs/$jobId"
                        params={{ jobId: app.job_id }}
                        className="font-medium hover:text-primary"
                      >
                        {job?.title ?? "Untitled role"}
                      </Link>
                      <p className="text-xs text-muted-foreground">{payLine(job)}</p>
                    </div>

                    <div className="flex items-center gap-3">
                      {submitted && (
                        <Select
                          value={app.status}
                          onValueChange={(value) =>
                            statusMutation.mutate({
                              id: app.id,
                              status: value as ApplicationStatus,
                            })
                          }
                        >
                          <SelectTrigger className="h-8 w-40 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="applied">Applied</SelectItem>
                            <SelectItem value="interviewing">Interviewing</SelectItem>
                            <SelectItem value="offer">Offer</SelectItem>
                            <SelectItem value="rejected">Rejected</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                      <Hint tip="Toggle on once you've actually submitted this application to start tracking its status.">
                        <label className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                          <Switch
                            checked={submitted}
                            disabled={statusMutation.isPending}
                            onCheckedChange={(checked) =>
                              statusMutation.mutate({
                                id: app.id,
                                status: checked ? "applied" : "saved",
                              })
                            }
                          />
                          {statusLabels[app.status as ApplicationStatus] ?? app.status}
                        </label>
                      </Hint>
                    </div>
                  </div>

                  {submitted && (app.date_applied || app.follow_up_date) && (
                    <div className="flex flex-wrap items-center gap-3 rounded-md bg-secondary/40 px-3 py-2 text-xs">
                      {app.date_applied && (
                        <span className="text-muted-foreground">
                          Applied {formatDate(app.date_applied)}
                        </span>
                      )}
                      {app.follow_up_date && (
                        <>
                          <span
                            className={
                              app.follow_up_sent
                                ? "text-muted-foreground"
                                : overdue
                                  ? "font-medium text-destructive"
                                  : "font-medium text-amber-600"
                            }
                          >
                            {app.follow_up_sent
                              ? `Follow-up sent for ${formatDate(app.follow_up_date)} check-in`
                              : overdue
                                ? `Follow-up overdue — was due ${formatDate(app.follow_up_date)}`
                                : `Follow up by ${formatDate(app.follow_up_date)}`}
                          </span>
                          <Hint tip="Recommended 2 business days after you applied. Toggle on once you've actually sent the follow-up email.">
                            <label className="flex items-center gap-1.5 font-medium text-muted-foreground">
                              <Switch
                                checked={app.follow_up_sent}
                                disabled={followUpMutation.isPending}
                                onCheckedChange={(checked) =>
                                  followUpMutation.mutate({ id: app.id, follow_up_sent: checked })
                                }
                              />
                              {app.follow_up_sent ? "Sent" : "Mark sent"}
                            </label>
                          </Hint>
                        </>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
