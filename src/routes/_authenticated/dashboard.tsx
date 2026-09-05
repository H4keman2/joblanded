import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getLatestResume } from "@/lib/resume.functions";
import { getActiveApplications, getDashboardStats } from "@/lib/account.functions";
import { updateApplicationFollowUp } from "@/lib/applications.functions";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Hint } from "@/components/ui/hint";
import { toast } from "sonner";
import { FileText, Briefcase, ClipboardList } from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — JobLanded" },
      {
        name: "description",
        content: "Your job search at a glance: resume status, saved jobs and follow-ups due.",
      },
      { property: "og:title", content: "Dashboard — JobLanded" },
      { property: "og:description", content: "Resume status, saved jobs and follow-ups due." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Dashboard,
});

const statusLabels: Record<string, string> = {
  saved: "In process",
  applied: "Applied",
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

function formatDate(value: string | null) {
  if (!value) return null;
  const d = new Date(`${value}T00:00:00`);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

const todayStr = () => new Date().toISOString().slice(0, 10);

function Dashboard() {
  const qc = useQueryClient();
  const fetchResume = useServerFn(getLatestResume);
  const fetchActive = useServerFn(getActiveApplications);
  const fetchStats = useServerFn(getDashboardStats);
  const setFollowUp = useServerFn(updateApplicationFollowUp);

  const { data: resume, isLoading } = useQuery({
    queryKey: ["latest-resume"],
    queryFn: () => fetchResume(),
  });

  const {
    data: applications,
    isLoading: loadingApps,
    isError: applicationsErrored,
    error: applicationsError,
    refetch: refetchApplications,
  } = useQuery({
    queryKey: ["active-applications"],
    queryFn: () => fetchActive(),
  });

  const { data: stats, isLoading: loadingStats } = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: () => fetchStats(),
  });

  const followUpMutation = useMutation({
    mutationFn: (input: { id: string; follow_up_sent: boolean }) => setFollowUp({ data: input }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["active-applications"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const funnelTotal = stats
    ? FUNNEL_STAGES.reduce((sum, s) => sum + stats.applications[s.key], 0)
    : 0;

  const heroLine = !stats
    ? "Your job search at a glance."
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
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-semibold">Dashboard</h1>
        <p className="mt-1 text-sm text-muted-foreground">{heroLine}</p>
      </div>

      {!isLoading && !resume && (
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
          to="/applications"
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

      <section className="space-y-3">
        <div className="flex items-baseline justify-between">
          <h2 className="text-xl font-semibold">Active applications</h2>
          <Link to="/applications" className="text-sm text-primary hover:underline">
            View all
          </Link>
        </div>

        {loadingApps ? (
          <div className="panel p-6 text-sm text-muted-foreground">Loading…</div>
        ) : applicationsErrored ? (
          <div className="panel space-y-3 p-6">
            <p className="text-sm text-destructive">
              Couldn't load your active applications:{" "}
              {applicationsError instanceof Error
                ? applicationsError.message
                : "something went wrong."}
            </p>
            <Button size="sm" variant="outline" onClick={() => void refetchApplications()}>
              Try again
            </Button>
          </div>
        ) : applications && applications.length > 0 ? (
          <ul className="space-y-3">
            {applications.map((app) => {
              const job = app.jobs as { title: string; company: string | null } | null;
              const overdue =
                !app.follow_up_sent && !!app.follow_up_date && app.follow_up_date < todayStr();
              return (
                <li key={app.id} className="panel flex flex-col gap-3 p-5">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="font-medium">{job?.title ?? "Untitled role"}</p>
                      <p className="text-sm text-muted-foreground">{job?.company ?? "—"}</p>
                    </div>
                    <span className="w-fit rounded-full bg-secondary px-3 py-1 text-sm text-secondary-foreground">
                      {statusLabels[app.status] ?? app.status}
                    </span>
                  </div>

                  {app.follow_up_date && (
                    <div className="flex flex-wrap items-center gap-3 rounded-md bg-secondary/40 px-3 py-2 text-xs">
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
                          ? "Follow-up sent"
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
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="panel flex flex-col items-start gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-medium">No active applications yet</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Add a job and mark it applied to start tracking follow-ups.
              </p>
            </div>
            <Button asChild variant="outline">
              <Link to="/jobs">Go to Jobs</Link>
            </Button>
          </div>
        )}
      </section>
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
  to: string;
}) {
  return (
    <Link to={to} className="panel block p-5 transition-colors hover:border-primary/40">
      <Icon className="size-5 text-primary" />
      <p className="mt-3 text-sm text-muted-foreground">{label}</p>
      <p className="text-lg font-semibold">{value}</p>
      {sublabel && <p className="mt-0.5 text-xs text-muted-foreground">{sublabel}</p>}
    </Link>
  );
}
