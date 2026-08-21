import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getLatestResume } from "@/lib/resume.functions";
import { getActiveApplications } from "@/lib/account.functions";
import { Button } from "@/components/ui/button";
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
  applied: "Applied",
  interviewing: "Interviewing",
  offer: "Offer",
};

function formatDate(value: string | null) {
  if (!value) return null;
  const d = new Date(`${value}T00:00:00`);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function Dashboard() {
  const fetchResume = useServerFn(getLatestResume);
  const fetchActive = useServerFn(getActiveApplications);

  const { data: resume, isLoading } = useQuery({
    queryKey: ["latest-resume"],
    queryFn: () => fetchResume(),
  });

  const { data: applications, isLoading: loadingApps } = useQuery({
    queryKey: ["active-applications"],
    queryFn: () => fetchActive(),
  });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-semibold">Dashboard</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Start with your resume — everything else builds on it.
        </p>
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

      <section className="space-y-3">
        <div className="flex items-baseline justify-between">
          <h2 className="text-xl font-semibold">Active applications</h2>
          <Link to="/applications" className="text-sm text-primary hover:underline">
            View all
          </Link>
        </div>

        {loadingApps ? (
          <div className="panel p-6 text-sm text-muted-foreground">Loading…</div>
        ) : applications && applications.length > 0 ? (
          <ul className="space-y-3">
            {applications.map((app) => {
              const job = app.jobs as { title: string; company: string | null } | null;
              const followUp = formatDate(app.follow_up_date);
              return (
                <li
                  key={app.id}
                  className="panel flex flex-col gap-2 p-5 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="font-medium">{job?.title ?? "Untitled role"}</p>
                    <p className="text-sm text-muted-foreground">{job?.company ?? "—"}</p>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <span className="rounded-full bg-secondary px-3 py-1 text-secondary-foreground">
                      {statusLabels[app.status] ?? app.status}
                    </span>
                    <span className="text-muted-foreground">
                      {followUp ? `Follow up ${followUp}` : "No follow-up set"}
                    </span>
                  </div>
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

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          icon={FileText}
          label="Resume"
          value={isLoading ? "…" : resume ? "Parsed" : "Not added"}
          to="/resume"
        />
        <StatCard icon={Briefcase} label="Jobs" value="Coming next" to="/jobs" />
        <StatCard
          icon={ClipboardList}
          label="Applications"
          value={loadingApps ? "…" : `${applications?.length ?? 0} active`}
          to="/applications"
        />
      </div>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  to,
}: {
  icon: typeof FileText;
  label: string;
  value: string;
  to: string;
}) {
  return (
    <Link to={to} className="panel block p-5 transition-colors hover:border-primary/40">
      <Icon className="size-5 text-primary" />
      <p className="mt-3 text-sm text-muted-foreground">{label}</p>
      <p className="text-lg font-semibold">{value}</p>
    </Link>
  );
}
