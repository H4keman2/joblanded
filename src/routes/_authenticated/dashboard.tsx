import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { listJobs, setJobArchived } from "@/lib/jobs.functions";
import {
  listApplications,
  setJobStatus,
  STATUS_LABELS,
  updateApplicationFollowUp,
  type ApplicationStatus,
} from "@/lib/applications.functions";
import { formatDate, todayStr } from "@/lib/dates";
import { getLatestResume } from "@/lib/resume.functions";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Hint } from "@/components/ui/hint";
import { RejectArchiveDialog } from "@/components/jobs/RejectArchiveDialog";
import {
  AlertCircle,
  BellRing,
  Bookmark,
  Briefcase,
  CheckCircle2,
  Loader2,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — JobLanded" },
      {
        name: "description",
        content: "A quick overview of your job hunt: stats and follow-ups that need you today.",
      },
      { property: "og:title", content: "Dashboard — JobLanded" },
      {
        property: "og:description",
        content: "Follow-ups due and your application stats at a glance.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: DashboardPage,
});

type JobInfo = { title: string; company: string | null } | null;

function jobOf(app: { jobs: unknown }): JobInfo {
  const j = app.jobs as JobInfo | JobInfo[] | null;
  return Array.isArray(j) ? (j[0] ?? null) : j;
}

function ListSkeleton() {
  return (
    <div className="space-y-4">
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex items-center justify-between gap-4">
          <div className="space-y-2">
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-3 w-32" />
          </div>
          <Skeleton className="h-8 w-32" />
        </div>
      ))}
    </div>
  );
}

function LoadFailed({ what, onRetry }: { what: string; onRetry: () => void }) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <p className="text-sm text-muted-foreground">
        We couldn&apos;t load your {what}. Your connection may have dropped.
      </p>
      <Button size="sm" variant="secondary" onClick={onRetry}>
        Try again
      </Button>
    </div>
  );
}

function StatCard({
  value,
  label,
  to,
  hash,
  icon: Icon,
  gradient,
  glow,
  alert,
}: {
  value: string;
  label: string;
  to: string;
  hash?: string;
  icon: LucideIcon;
  gradient: string;
  glow: string;
  alert?: boolean;
}) {
  return (
    <Link
      to={to}
      {...(hash ? { hash } : {})}
      className={`group block rounded-2xl border bg-card p-5 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:shadow-xl ${glow} ${
        alert ? "border-rose-500/60" : "border-border"
      }`}
    >
      <div className="flex items-center justify-between">
        <p
          className={`bg-gradient-to-r ${gradient} bg-clip-text text-4xl font-extrabold tracking-tight text-transparent`}
        >
          {value}
        </p>
        <span className={`rounded-xl bg-gradient-to-br ${gradient} p-2 text-white shadow-md`}>
          <Icon aria-hidden="true" className="h-5 w-5" />
        </span>
      </div>
      <p className="mt-2 text-sm font-medium text-muted-foreground">
        {label}{" "}
        <span
          aria-hidden="true"
          className="inline-block transition-transform duration-200 group-hover:translate-x-1"
        >
          &rarr;
        </span>
      </p>
    </Link>
  );
}

function DashboardPage() {
  const fetchJobs = useServerFn(listJobs);
  const fetchApplications = useServerFn(listApplications);
  const fetchResume = useServerFn(getLatestResume);

  const jobs = useQuery({ queryKey: ["jobs"], queryFn: () => fetchJobs() });
  const applications = useQuery({
    queryKey: ["applications"],
    queryFn: () => fetchApplications(),
  });
  const resume = useQuery({
    queryKey: ["resume", "latest"],
    queryFn: () => fetchResume(),
  });

  const today = todayStr();

  // Anything past "saved" and not yet rejected, whose follow-up date has
  // arrived and that hasn't been followed up on yet — soonest first.
  const dueFollowUps = useMemo(() => {
    const rows = (applications.data ?? []) as unknown as {
      id: string;
      job_id: string;
      status: string;
      follow_up_sent: boolean;
      follow_up_date: string | null;
      jobs: unknown;
    }[];
    return rows
      .filter(
        (a) =>
          a.status !== "saved" &&
          a.status !== "rejected" &&
          !a.follow_up_sent &&
          a.follow_up_date &&
          a.follow_up_date <= today,
      )
      .sort((a, b) => (a.follow_up_date! < b.follow_up_date! ? -1 : 1));
  }, [applications.data, today]);

  const activeJobs = useMemo(
    () => (jobs.data ?? []).filter((job) => !job.archived_at),
    [jobs.data],
  );

  const stats = useMemo(() => {
    const rows = (applications.data ?? []) as { status: string }[];
    return {
      followUpsDue: dueFollowUps.length,
      activeApplications: rows.filter((a) =>
        ["applied", "interviewing", "offer"].includes(a.status),
      ).length,
      interviews: rows.filter((a) => a.status === "interviewing").length,
      savedPostings: activeJobs.length,
    };
  }, [applications.data, dueFollowUps, activeJobs]);

  const qc = useQueryClient();
  const changeStatus = useServerFn(setJobStatus);
  const statusMutation = useMutation({
    mutationFn: (input: { jobId: string; status: ApplicationStatus }) =>
      changeStatus({ data: input }),
    onSuccess: (_r, v) => {
      toast.success(`Marked ${STATUS_LABELS[v.status].toLowerCase()}`);
      void qc.invalidateQueries({ queryKey: ["applications"] });
      void qc.invalidateQueries({ queryKey: ["application-stats"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const archiveJob = useServerFn(setJobArchived);
  const archiveMutation = useMutation({
    mutationFn: (input: { id: string; archived: boolean }) => archiveJob({ data: input }),
    onSuccess: (_r, v) => {
      if (v.archived) toast.success("Posting archived");
      void qc.invalidateQueries({ queryKey: ["jobs"] });
      void qc.invalidateQueries({ queryKey: ["applications"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Mark-sent updates the list the instant it's tapped (optimistic), so the
  // row clears even on a slow connection; a failure rolls back with an error.
  const markFollowUpSent = useServerFn(updateApplicationFollowUp);
  const followUpMutation = useMutation({
    mutationFn: (id: string) => markFollowUpSent({ data: { id, follow_up_sent: true } }),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: ["applications"] });
      const prev = qc.getQueryData(["applications"]);
      qc.setQueryData(["applications"], (old: unknown) =>
        Array.isArray(old)
          ? old.map((a: { id: string }) => (a.id === id ? { ...a, follow_up_sent: true } : a))
          : old,
      );
      return { prev };
    },
    onError: (e: Error, _id, ctx) => {
      if (ctx?.prev) qc.setQueryData(["applications"], ctx.prev);
      toast.error(e.message || "Couldn't mark it sent — try again.");
    },
    onSuccess: () => {
      toast.success("Follow-up marked sent");
      void qc.invalidateQueries({ queryKey: ["applications"] });
      void qc.invalidateQueries({ queryKey: ["application-stats"] });
    },
  });

  const [rejectTarget, setRejectTarget] = useState<{ jobId: string; title: string } | null>(null);
  function handleRejectDecide(archiveIt: boolean) {
    if (!rejectTarget) return;
    statusMutation.mutate({ jobId: rejectTarget.jobId, status: "rejected" });
    if (archiveIt) archiveMutation.mutate({ id: rejectTarget.jobId, archived: true });
    setRejectTarget(null);
  }

  const hasResume = Boolean(resume.data);
  const hasJobs = activeJobs.length > 0;
  const hasApplications = ((applications.data ?? []) as unknown[]).length > 0;
  const setupDone = hasResume && hasJobs && hasApplications;
  const setupLoaded = !resume.isLoading && !jobs.isLoading && !applications.isLoading;
  // A failed fetch must not read as "you haven't done this yet" — the checklist
  // would nag people who already have a resume, saved postings and applications.
  const setupFailed = resume.isError || jobs.isError || applications.isError;

  const steps = [
    {
      done: hasResume,
      label: "Add your resume",
      hint: "We pull out your titles and skills so matching has something to work with.",
      to: "/resume" as const,
      cta: "Add resume",
    },
    {
      done: hasJobs,
      label: "Save a job posting",
      hint: "Paste a posting or its link — from your laptop or your phone.",
      to: "/jobs" as const,
      cta: "Save a posting",
    },
    {
      done: hasApplications,
      label: "Track your first application",
      hint: "Mark a role as applied and we'll set a follow-up date for you.",
      to: "/applications" as const,
      cta: "Open tracker",
    },
  ];

  return (
    <div className="space-y-6">
      <div className="overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-600 via-violet-600 to-fuchsia-500 p-6 text-white shadow-xl shadow-violet-500/25 sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight">Dashboard</h1>
            <p className="mt-2 max-w-xl text-sm text-white/85">
              Your job hunt at a glance — tap any number to dig into the details.
            </p>
          </div>
          <div className="hidden items-center gap-2 sm:flex" aria-hidden="true">
            <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-emerald-300" />
            <span className="text-xs font-medium uppercase tracking-widest text-white/70">
              Live
            </span>
          </div>
        </div>
      </div>

      {/* Overview — quick numbers, each linking to its full page. */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Overview">
        <StatCard
          value={String(stats.followUpsDue)}
          label="Follow-ups due"
          to="/dashboard"
          hash="attention"
          icon={BellRing}
          gradient="from-rose-500 to-orange-400"
          glow="hover:shadow-rose-500/25"
          alert={stats.followUpsDue > 0}
        />
        <StatCard
          value={String(stats.activeApplications)}
          label="Active applications"
          to="/applications"
          icon={Briefcase}
          gradient="from-cyan-500 to-blue-500"
          glow="hover:shadow-cyan-500/25"
        />
        <StatCard
          value={String(stats.interviews)}
          label="Interviews"
          to="/applications"
          icon={Users}
          gradient="from-amber-500 to-yellow-400"
          glow="hover:shadow-amber-500/25"
        />
        <StatCard
          value={String(stats.savedPostings)}
          label="Saved postings"
          to="/jobs"
          icon={Bookmark}
          gradient="from-violet-500 to-fuchsia-500"
          glow="hover:shadow-violet-500/25"
        />
      </div>

      {/* Needs attention — follow-ups whose date has arrived. */}
      <section
        id="attention"
        className="panel scroll-mt-6 p-6 sm:p-8"
        aria-labelledby="attention-heading"
      >
        <h2 id="attention-heading" className="font-display text-lg font-semibold">
          Needs attention
        </h2>
        {applications.isLoading ? (
          <div className="mt-4">
            <ListSkeleton />
          </div>
        ) : applications.isError ? (
          <div className="mt-4">
            <LoadFailed what="applications" onRetry={() => void applications.refetch()} />
          </div>
        ) : dueFollowUps.length === 0 ? (
          <p className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
            <CheckCircle2 aria-hidden="true" className="h-4 w-4 text-primary" />
            Nothing due right now — no follow-ups are waiting on you.
          </p>
        ) : (
          <ul className="mt-4 divide-y divide-border">
            {dueFollowUps.map((app) => {
              const job = jobOf(app);
              const overdue = app.follow_up_date! < today;
              const marking = followUpMutation.isPending && followUpMutation.variables === app.id;
              return (
                <li
                  key={app.id}
                  className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
                >
                  <div className="flex items-start gap-2">
                    <Hint
                      tip={
                        overdue
                          ? `Follow-up overdue — you planned to follow up on ${formatDate(app.follow_up_date!)}.`
                          : "Follow-up due today."
                      }
                    >
                      <AlertCircle
                        aria-hidden="true"
                        className={`mt-0.5 h-4 w-4 ${overdue ? "text-destructive" : "text-primary"}`}
                      />
                    </Hint>
                    <div>
                      <p className="font-medium">{job?.title ?? "Saved role"}</p>
                      <p className="text-xs text-muted-foreground">
                        {job?.company ? `${job.company} · ` : ""}
                        {overdue ? "Follow-up overdue since " : "Follow up today — due "}
                        {formatDate(app.follow_up_date!)}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Hint tip="Marks the follow-up as sent and clears it from this list.">
                      <Button
                        size="sm"
                        variant="secondary"
                        aria-label={`Mark follow-up sent for ${job?.title ?? "Saved role"}`}
                        disabled={marking}
                        onClick={() => followUpMutation.mutate(app.id)}
                      >
                        {marking && (
                          <Loader2 aria-hidden="true" className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                        )}
                        Mark sent
                      </Button>
                    </Hint>
                    <Hint tip="Open the tracker to follow up on this application.">
                      <Button asChild size="sm" variant="secondary">
                        <Link
                          to="/applications"
                          aria-label={`Follow up on ${job?.title ?? "Saved role"}`}
                        >
                          Follow up
                        </Link>
                      </Button>
                    </Hint>
                    <Hint tip="Mark this application as rejected — you can archive the posting too.">
                      <Button
                        size="sm"
                        variant="ghost"
                        aria-label={`Mark ${job?.title ?? "Saved role"} as rejected`}
                        onClick={() =>
                          setRejectTarget({ jobId: app.job_id, title: job?.title ?? "Saved role" })
                        }
                      >
                        Didn&apos;t get it
                      </Button>
                    </Hint>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* First-run checklist — disappears once the basics are in place. */}
      {setupLoaded && !setupDone && (
        <section className="panel p-6 sm:p-8" aria-labelledby="setup-heading">
          <h2 id="setup-heading" className="font-display text-lg font-semibold">
            Get set up
          </h2>
          {setupFailed ? (
            <div className="mt-3">
              <LoadFailed
                what="setup details"
                onRetry={() => {
                  void resume.refetch();
                  void jobs.refetch();
                  void applications.refetch();
                }}
              />
            </div>
          ) : (
            <>
              <p className="mt-1 text-sm text-muted-foreground">
                Three steps and JobLanded can start matching and tailoring for you.
              </p>
              <ol className="mt-4 space-y-3">
                {steps.map((step, i) => (
                  <li
                    key={step.label}
                    className="flex flex-wrap items-center justify-between gap-3"
                  >
                    <div className="flex items-start gap-3">
                      <span
                        className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                          step.done
                            ? "bg-primary text-primary-foreground"
                            : "bg-secondary text-secondary-foreground"
                        }`}
                        aria-hidden="true"
                      >
                        {step.done ? "✓" : i + 1}
                      </span>
                      <div>
                        <p className={`font-medium ${step.done ? "text-muted-foreground" : ""}`}>
                          {step.label}
                          <span className="sr-only">
                            {step.done ? " (done)" : " (not done yet)"}
                          </span>
                        </p>
                        <p className="text-xs text-muted-foreground">{step.hint}</p>
                      </div>
                    </div>
                    {!step.done && (
                      <Button asChild size="sm" variant="secondary">
                        <Link to={step.to}>{step.cta}</Link>
                      </Button>
                    )}
                  </li>
                ))}
              </ol>
            </>
          )}
        </section>
      )}

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
