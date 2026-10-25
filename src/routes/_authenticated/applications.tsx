import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  addApplication,
  listApplications,
  updateApplicationFollowUp,
  updateApplicationStatus,
  STATUS_LABELS,
  type ApplicationStatus,
} from "@/lib/applications.functions";
import { formatDate, todayStr } from "@/lib/dates";
import { getApplicationStats } from "@/lib/account.functions";
import { getLatestResume } from "@/lib/resume.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Hint } from "@/components/ui/hint";
import { setJobArchived } from "@/lib/jobs.functions";
import { RejectArchiveDialog } from "@/components/jobs/RejectArchiveDialog";
import { ProAssist } from "@/components/applications/ProAssist";
import { toast } from "sonner";
import { Loader2, Plus, FileText, Briefcase, ClipboardList } from "lucide-react";

// The server checks the link too, but a bare "example.com/jobs" is almost always
// a missing https:// rather than a real posting — catch it here with copy a person
// can act on instead of surfacing the validator's raw JSON in a toast.
function isFullUrl(value: string) {
  try {
    const { protocol } = new URL(value);
    return protocol === "http:" || protocol === "https:";
  } catch {
    return false;
  }
}

export const Route = createFileRoute("/_authenticated/applications")({
  head: () => ({
    meta: [
      { title: "Application Tracker — JobLanded" },
      {
        name: "description",
        content:
          "Your job search at a glance: resume status, saved jobs, application status and follow-ups due.",
      },
      { property: "og:title", content: "Application Tracker — JobLanded" },
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

// The application funnel bar — saved → applied → interviewing → offer, in the
// order a role actually progresses. Rejected is an exit rather than a step
// forward, but it gets its own segment so the bar always adds up.
const FUNNEL_STAGES = [
  { key: "saved", label: "Saved", barClass: "bg-secondary-foreground/20" },
  { key: "applied", label: "Applied", barClass: "bg-primary/50" },
  { key: "interviewing", label: "Interviewing", barClass: "bg-amber-500" },
  { key: "offer", label: "Offer", barClass: "bg-primary" },
  { key: "rejected", label: "Rejected", barClass: "bg-destructive/60" },
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
  application_url?: string | null;
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

  const today = todayStr();

  const applications = useQuery({
    queryKey: ["applications"],
    queryFn: async () => (await fetchApplications()) as unknown as ApplicationRow[],
  });

  const {
    data: stats,
    isLoading: loadingStats,
    isError: statsError,
    isFetching: fetchingStats,
    refetch: refetchStats,
  } = useQuery({
    queryKey: ["application-stats"],
    queryFn: () => fetchStats(),
  });

  const {
    data: resume,
    isLoading: loadingResume,
    isError: resumeError,
    isFetching: fetchingResume,
    refetch: refetchResume,
  } = useQuery({
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
    mutationFn: (input: { id: string; status: ApplicationStatus }) =>
      setStatus({ data: { ...input, appliedDate: todayStr() } }),
    // Update the list and the funnel instantly; the server refetch on success
    // is the source of truth and a failure rolls everything back.
    onMutate: async (input) => {
      await qc.cancelQueries({ queryKey: ["applications"] });
      await qc.cancelQueries({ queryKey: ["application-stats"] });
      const prevApps = qc.getQueryData(["applications"]);
      const prevStats = qc.getQueryData(["application-stats"]);
      const prevApp = Array.isArray(prevApps)
        ? (prevApps as { id: string; status: string }[]).find((a) => a.id === input.id)
        : undefined;
      qc.setQueryData(["applications"], (old: unknown) =>
        Array.isArray(old)
          ? old.map((a: { id: string }) => (a.id === input.id ? { ...a, status: input.status } : a))
          : old,
      );
      if (prevApp && prevApp.status !== input.status) {
        qc.setQueryData(["application-stats"], (old: unknown) => {
          if (!old || typeof old !== "object") return old;
          const o = old as { applications: Record<string, number> };
          const applications = { ...o.applications };
          const from = applications[prevApp.status];
          const to = applications[input.status];
          if (typeof from === "number") applications[prevApp.status] = from - 1;
          if (typeof to === "number") applications[input.status] = to + 1;
          return { ...o, applications };
        });
      }
      return { prevApps, prevStats };
    },
    onError: (e: Error, _v, ctx) => {
      if (ctx?.prevApps) qc.setQueryData(["applications"], ctx.prevApps);
      if (ctx?.prevStats) qc.setQueryData(["application-stats"], ctx.prevStats);
      toast.error(e.message || "Couldn't update the status — try again.");
    },
    onSuccess: invalidateAll,
  });

  const followUpMutation = useMutation({
    mutationFn: (input: { id: string; follow_up_date?: string | null; follow_up_sent?: boolean }) =>
      setFollowUp({ data: input }),
    onSuccess: invalidateAll,
    onError: (e: Error) => toast.error(e.message),
  });

  const archiveFn = useServerFn(setJobArchived);
  const archiveMutation = useMutation({
    mutationFn: (input: { id: string; archived: boolean }) => archiveFn({ data: input }),
    onSuccess: (_r, v) => {
      if (v.archived) toast.success("Posting archived");
      invalidateAll();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const [rejectTarget, setRejectTarget] = useState<{
    appId: string;
    jobId: string;
    title: string;
  } | null>(null);

  function handleRejectDecide(archiveIt: boolean) {
    if (!rejectTarget) return;
    if (archiveIt) {
      statusMutation.mutate({ id: rejectTarget.appId, status: "rejected" });
      archiveMutation.mutate({ id: rejectTarget.jobId, archived: true });
    } else {
      // Success toast only after the write resolves — a premature toast plus a
      // failure rollback would show contradictory feedback on a dropped connection.
      statusMutation.mutate(
        { id: rejectTarget.appId, status: "rejected" },
        { onSuccess: () => toast.success("Marked rejected") },
      );
    }
    setRejectTarget(null);
  }

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
      <ProAssist />

      <div className="panel p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold">Application Tracker</h1>
            <p className="mt-2 max-w-xl text-sm text-muted-foreground">{heroLine}</p>
          </div>
          <Button
            onClick={() => setOpen((o) => !o)}
            variant={open ? "ghost" : "default"}
            aria-pressed={open}
          >
            {open ? (
              "Cancel"
            ) : (
              <>
                <Plus aria-hidden="true" className="mr-1.5 h-4 w-4" /> Add application
              </>
            )}
          </Button>
        </div>

        {open && (
          <form
            className="mt-6 space-y-4 border-t border-border pt-6"
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              const link = sourceUrl.trim();
              if (!description.trim() && !link) {
                toast.error("Add a job description or a posting link first.");
                return;
              }
              if (link && !isFullUrl(link)) {
                toast.error("That link needs a full address — paste it starting with https://");
                return;
              }
              if (description.trim().length < 80 && !link) {
                toast.error(
                  "Paste the full posting — at least 80 characters — or add a posting link instead.",
                );
                return;
              }
              addMutation.mutate({ description: description.trim(), sourceUrl: link });
            }}
          >
            <div>
              <Label htmlFor="app-description">Job description (optional if you add a URL)</Label>
              <Textarea
                id="app-description"
                autoFocus
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
                type="url"
                inputMode="url"
                autoComplete="url"
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
              {addMutation.isPending && (
                <Loader2 aria-hidden="true" className="mr-1.5 h-4 w-4 animate-spin" />
              )}
              Save & add application
            </Button>
          </form>
        )}
      </div>

      {resumeError ? (
        <div className="panel flex flex-wrap items-center gap-3 p-5">
          <p className="text-sm text-muted-foreground">
            We couldn&apos;t load your resume status. Your connection may have dropped.
          </p>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => void refetchResume()}
            disabled={fetchingResume}
          >
            Try again
          </Button>
        </div>
      ) : (
        !loadingResume &&
        !resume && (
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
        )
      )}

      {statsError ? (
        <div className="panel flex flex-wrap items-center gap-3 p-5">
          <p className="text-sm text-muted-foreground">
            We could not load your tracker summary. Your connection may have dropped.
          </p>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => void refetchStats()}
            disabled={fetchingStats}
          >
            Try again
          </Button>
        </div>
      ) : (
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
      )}

      {!loadingStats && stats && stats.applications.total > 0 && (
        <div className="panel space-y-3 p-5">
          <div className="flex items-baseline justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Application funnel
            </h2>
          </div>

          {funnelTotal > 0 && (
            <div
              className="flex h-3 w-full overflow-hidden rounded-full bg-secondary"
              role="img"
              aria-label={`Application funnel: ${FUNNEL_STAGES.filter(
                (s) => stats.applications[s.key] > 0,
              )
                .map((s) => `${stats.applications[s.key]} ${s.label}`)
                .join(", ")}`}
            >
              {FUNNEL_STAGES.filter((s) => stats.applications[s.key] > 0).map((s) => (
                <div
                  key={s.key}
                  className={s.barClass}
                  style={{
                    width: `${(stats.applications[s.key] / funnelTotal) * 100}%`,
                  }}
                  title={`${s.label}: ${stats.applications[s.key]}`}
                  aria-hidden="true"
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
          <p className="text-sm text-muted-foreground" role="status">
            Loading your applications…
          </p>
        ) : applications.isError ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              We couldn't load your applications. Your connection may have dropped.
            </p>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => void applications.refetch()}
              disabled={applications.isFetching}
            >
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
          <div className="max-h-[560px] overflow-y-auto pr-1">
            <ul className="divide-y divide-border">
              {applications.data!.map((app) => {
                const job = jobOf(app);
                const submitted = app.status !== "saved";
                const overdue =
                  !app.follow_up_sent && !!app.follow_up_date && app.follow_up_date < today;
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
                        {(app.application_url || job?.source_url) && (
                          <a
                            href={app.application_url ?? job!.source_url!}
                            target="_blank"
                            rel="noreferrer"
                            aria-label={`${app.application_url ? "View application" : "View posting"} (opens in new tab)`}
                            className="text-xs text-primary underline"
                          >
                            {app.application_url ? "View application" : "View posting"}
                          </a>
                        )}
                      </div>

                      <div className="flex items-center gap-3">
                        <Hint tip="Rewrite your resume for this specific posting.">
                          <Button asChild size="sm" variant="outline">
                            <Link
                              to="/jobs/$jobId"
                              params={{ jobId: app.job_id }}
                              aria-label={`Tailor resume for ${job?.title ?? "Untitled role"}`}
                            >
                              Tailor
                            </Link>
                          </Button>
                        </Hint>
                        <div
                          className="flex flex-wrap items-center gap-1"
                          role="group"
                          aria-label={`Status for ${job?.title ?? "Untitled role"}`}
                        >
                          {(
                            [
                              {
                                s: "applied",
                                tip: "You've sent the application — we'll remind you to follow up in 2 business days.",
                              },
                              {
                                s: "interviewing",
                                tip: "You're talking to them — track it here through to a decision.",
                              },
                              {
                                s: "offer",
                                tip: "They made an offer — time to weigh it and reply.",
                              },
                              {
                                s: "rejected",
                                tip: "Didn't get it — marks the application rejected and offers to archive the posting.",
                              },
                            ] as const
                          ).map(({ s, tip }) => (
                            <Hint key={s} tip={tip}>
                              <Button
                                size="sm"
                                variant={app.status === s ? "default" : "outline"}
                                className="h-8 text-xs"
                                disabled={
                                  statusMutation.isPending &&
                                  statusMutation.variables?.id === app.id
                                }
                                aria-pressed={app.status === s}
                                onClick={() =>
                                  s === "rejected"
                                    ? setRejectTarget({
                                        appId: app.id,
                                        jobId: app.job_id,
                                        title: job?.title ?? "Untitled role",
                                      })
                                    : statusMutation.mutate({ id: app.id, status: s })
                                }
                              >
                                {STATUS_LABELS[s]}
                              </Button>
                            </Hint>
                          ))}
                        </div>
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
                                  aria-label={`Mark follow-up sent for ${job?.title ?? "Untitled role"}`}
                                  checked={app.follow_up_sent}
                                  disabled={
                                    followUpMutation.isPending &&
                                    followUpMutation.variables?.id === app.id
                                  }
                                  onCheckedChange={(checked) =>
                                    followUpMutation.mutate({
                                      id: app.id,
                                      follow_up_sent: checked,
                                    })
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
          </div>
        )}
      </div>

      <RejectArchiveDialog
        open={Boolean(rejectTarget)}
        onOpenChange={(o) => !o && setRejectTarget(null)}
        jobTitle={rejectTarget?.title ?? ""}
        pending={statusMutation.isPending || archiveMutation.isPending}
        onDecide={handleRejectDecide}
      />
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
      <Icon aria-hidden="true" className="size-5 text-primary" />
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
