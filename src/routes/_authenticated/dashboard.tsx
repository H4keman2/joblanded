import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listJobs } from "@/lib/jobs.functions";
import { Button } from "@/components/ui/button";
import { Sparkles } from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — JobLanded" },
      {
        name: "description",
        content: "Your saved job postings, ready to match against your resume.",
      },
      { property: "og:title", content: "Dashboard — JobLanded" },
      { property: "og:description", content: "Saved job postings ready for resume matching." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: DashboardPage,
});

function DashboardPage() {
  const fetchJobs = useServerFn(listJobs);
  const jobs = useQuery({ queryKey: ["jobs"], queryFn: () => fetchJobs() });

  return (
    <div className="space-y-6">
      <div className="panel p-6 sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold">Dashboard</h1>
            <p className="mt-2 max-w-xl text-sm text-muted-foreground">
              Every posting you've saved, in one place — saved on your phone, waiting on your
              laptop. Pick a role and we'll open its workspace with the best-fit role for your
              resume already suggested.
            </p>
          </div>
          <Button asChild variant="secondary">
            <Link to="/save">Quick save a posting</Link>
          </Button>
        </div>
      </div>

      <div className="panel p-8">
        {jobs.isLoading ? (
          <p className="text-sm text-muted-foreground">Loading your postings…</p>
        ) : (jobs.data?.length ?? 0) === 0 ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              No postings saved yet. Add one and it will show up here, ready for matching.
            </p>
            <Button asChild variant="secondary" size="sm">
              <Link to="/jobs">Add a job posting</Link>
            </Button>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {jobs.data!.map((job) => (
              <li
                key={job.id}
                className="flex flex-wrap items-center justify-between gap-3 py-4 first:pt-0 last:pb-0"
              >
                <div>
                  <p className="font-medium">{job.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {[job.company, job.location].filter(Boolean).join(" · ") ||
                      "No company listed"}
                    {job.pay_min || job.pay_max
                      ? ` · $${(job.pay_min ?? job.pay_max)!.toLocaleString()}${
                          job.pay_max && job.pay_min ? `–$${job.pay_max.toLocaleString()}` : ""
                        }`
                      : ""}
                  </p>
                </div>
                <Button asChild size="sm">
                  <Link to="/jobs/$jobId" params={{ jobId: job.id }}>
                    <Sparkles className="mr-1.5 h-4 w-4" /> Match my resume
                  </Link>
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
