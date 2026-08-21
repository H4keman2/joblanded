import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getLatestResume } from "@/lib/resume.functions";
import { Button } from "@/components/ui/button";
import { FileText, Briefcase, ClipboardList } from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — JobMatch" },
      {
        name: "description",
        content: "Your job search at a glance: resume status, saved jobs and follow-ups due.",
      },
      { property: "og:title", content: "Dashboard — JobMatch" },
      { property: "og:description", content: "Resume status, saved jobs and follow-ups due." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const fetchResume = useServerFn(getLatestResume);
  const { data: resume, isLoading } = useQuery({
    queryKey: ["latest-resume"],
    queryFn: () => fetchResume(),
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

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          icon={FileText}
          label="Resume"
          value={isLoading ? "…" : resume ? "Parsed" : "Not added"}
          to="/resume"
        />
        <StatCard icon={Briefcase} label="Jobs" value="Coming next" to="/jobs" />
        <StatCard icon={ClipboardList} label="Applications" value="Coming next" to="/applications" />
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
