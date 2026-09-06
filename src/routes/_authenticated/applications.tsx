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
import { getApplicationStats } from "@/lib/account.functions";
import { getLatestResume } from "@/lib/resume.functions";
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
import { Loader2, Plus, FileText, Briefcase, ClipboardList } from "lucide-react";

export const Route = createFileRoute("/_authenticated/applications")({
  head: () => ({
    meta: [
      { title: "Applications — JobLanded" },
      {
        name: "description",
        content:
          "Your job search at a glance: resume status, saved jobs, application status and follow-ups due.",
      },
      { property: "og:title", content: "Applications — JobLanded" },
      {
        property: "og:description",
        content: "Stats, status, notes and follow-ups for every application.",
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

// The application funnel bar — saved → applied → interviewing → offer, in the
// order a role actually progresses. Rejected is shown as a separate count
// instead of a stage, since it's an exit rather than a step forward.
const FUNNEL_STAGES = [
  { key: "saved", label: "Saved", barClass: "bg-secondary-foreground/20" },
  { key: "applied", label: "Applied", barClass: "bg-primary/50" },
  { key: "interviewing", label: "Interviewing", barClass: "bg-amber-500" },
  { key: "offer", label: "Offer", barClass: "bg-primary" },
] as const;

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
  const fetchStats = useServerFn(getApplicationStats);
  const fetchResume = useServerFn(getLatestResume);
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

  const { data: stats, isLoading: loadingStats } = useQuery({
    queryKey: ["application-stats"],
    queryFn: () => fetchStats(),
  });

  const { data: resume, isLoading: loadingResume } = useQuery({
    queryKey: ["latest-resume"],
    queryFn: () => fetchResume(),
  });

  const invalidateAll = () => {
    void qc.invalidateQueries({ queryKey: ["applications"] });
    void qc.invalidateQueries({ queryKey: ["jobs"] });
    void qc.invalidateQueries({ queryKey: ["application-stats"] });
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

  const funnelTotal = stats
    ? FUNNEL_STAGES.reduce((sum, s) => sum + stats.applications[s.key], 0)
    : 0;

  const heroLine = !stats
    ? "Every job you save opens an application automatically — track status and follow-ups here."
    : stats.applications.offer > 0
      ? "You've got an offer on the table — congratulations."
      : stats.applications.interviewing > 0
        ? `${stats.applications.interviewing} interview${stats.applications.interviewing === 1 ? "" : "s"} in motion. Keep the momentum going.`
        : stats.applications.applied > 0
          ? `${stats.applications.applied} application${stats.applications.applied === 1 ? "" : "s"} out there. Add more roles to improve your odds.`
          : stats.jobsCount > 0
            ? "Roles saved and ready — tailor a resume and apply to get moving."
            : "Start with your resume — everything else builds on it.";

  return (
    <div className="space-y-6">
      <div className="panel p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold">Applications</h1>
            <p className="mt-2 max-w-xl text-sm text-muted-foreground">{heroLine}</p>
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

      {!loadingResume && !resume && (
        <div className="panel flex flex-col items-start gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold">Upload your resume</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              We&apos;ll extract your skills, titles and experience so jobs can be matched.
            </p>
          </div>
          <Button asChild>
            <Link to="/resume">Add resume</Link>
          </Button>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          icon={FileText}
          label="Resume"
          value={
            loadingStats
              ? "…"
              : stats && stats.resumesCount > 0
                ? `${stats.resumesCount} uploaded`
                : "Not added"
          }
          sublabel={
            !loadingStats && stats && stats.tailoredVersionsCount > 0
              ? `${stats.tailoredVersionsCount} tailored version${stats.tailoredVersionsCount === 1 ? "" : "s"} created`
              : undefined
          }
          to="/resume"
        />
        <StatCard
          icon={Briefcase}
          label="Jobs"
          value={loadingStats ? "…" : `${stats?.jobsCount ?? 0} saved`}
          sublabel={
            !loadingStats && stats && stats.jobsAddedThisWeek > 0
              ? `+${stats.jobsAddedThisWeek} this week`
              : undefined
          }
          to="/jobs"
        />
        <StatCard
          icon={ClipboardList}
          label="Applications"
          value={loadingStats ? "…" : `${stats?.applications.total ?? 0} total`}
          sublabel={
            !loadingStats && stats && stats.applicationsThisWeek > 0
              ? `+${stats.applicationsThisWeek} this week`
              : undefined
          }
        />
      </div>

      {!loadingStats && stats && stats.applications.total > 0 && (
        <div className="panel space-y-3 p-5">
          <div className="flex items-baseline justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Application funnel
            </h2>
            {stats.applications.rejected > 0 && (
              <span className="text-xs text-muted-foreground">
                {stats.applications.rejected} rejected
              </span>
            )}
          </div>

          {funnelTotal > 0 && (
            <div className="flex h-3 w-full overflow-hidden rounded-full bg-secondary">
              {FUNNEL_STAGES.filter((s) => stats.applications[s.key] > 0).map((s) => (
                <div
                  key={s.key}
                  className={s.barClass}
                  style={{ width: `${(stats.applications[s.key] / funnelTotal) * 100}%` }}
                  title={`${s.label}: ${stats.applications[s.key]}`}
                />
              ))}
            </div>
          )}

          <div className="flex flex-wrap gap-x-5 gap-y-1.5 text-xs">
            {FUNNEL_STAGES.map((s) => (
              <span key={s.key} className="flex items-center gap-1.5 text-muted-foreground">
                <span className={`size-2 rounded-full ${s.barClass}`} />
                {stats.applications[s.key]} {s.label}
              </span>
            ))}
          </div>
        </div>
      )}

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

function StatCard({
  icon: Icon,
  label,
  value,
  sublabel,
  to,
}: {
  icon: typeof FileText;
  label: string;
  value: string;
  sublabel?: string | undefined;
  to?: string | undefined;
}) {
  const body = (
    <>
      <Icon className="size-5 text-primary" />
      <p className="mt-3 text-sm text-muted-foreground">{label}</p>
      <p className="text-lg font-semibold">{value}</p>
      {sublabel && <p className="mt-0.5 text-xs text-muted-foreground">{sublabel}</p>}
    </>
  );

  if (!to) {
    return <div className="panel p-5">{body}</div>;
  }

  return (
    <Link to={to} className="panel block p-5 transition-colors hover:border-primary/40">
      {body}
    </Link>
  );
}
