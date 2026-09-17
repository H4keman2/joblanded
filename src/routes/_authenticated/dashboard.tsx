import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listJobs } from "@/lib/jobs.functions";
import { listApplications } from "@/lib/applications.functions";
import { getLatestResume } from "@/lib/resume.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AlertCircle, CheckCircle2, Search, Sparkles } from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — JobLanded" },
      {
        name: "description",
        content:
          "What needs your attention today, plus every saved posting ready to match against your resume.",
      },
      { property: "og:title", content: "Dashboard — JobLanded" },
      {
        property: "og:description",
        content: "Follow-ups due and saved job postings ready for resume matching.",
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

const todayStr = () => new Date().toISOString().slice(0, 10);

function formatDate(value: string) {
  const d = new Date(`${value}T00:00:00`);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
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
        We couldn't load your {what}. Your connection may have dropped.
      </p>
      <Button size="sm" variant="secondary" onClick={onRetry}>
        Try again
      </Button>
    </div>
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
  const resume = useQuery({ queryKey: ["resume", "latest"], queryFn: () => fetchResume() });

  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<"recent" | "title" | "company">("recent");

  const today = todayStr();

  // Anything past "saved" and not yet rejected, whose follow-up date has
  // arrived and that hasn't been followed up on yet — soonest first.
  const dueFollowUps = useMemo(() => {
    const rows = applications.data ?? [];
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

  const visibleJobs = useMemo(() => {
    const term = search.trim().toLowerCase();
    const rows = activeJobs.filter((job) =>
      term
        ? [job.title, job.company, job.location]
            .filter(Boolean)
            .some((v) => v!.toLowerCase().includes(term))
        : true,
    );
    const sorted = [...rows];
    if (sort === "title") sorted.sort((a, b) => a.title.localeCompare(b.title));
    if (sort === "company")
      sorted.sort((a, b) => (a.company ?? "").localeCompare(b.company ?? ""));
    return sorted;
  }, [activeJobs, search, sort]);

  const hasResume = Boolean(resume.data);
  const hasJobs = activeJobs.length > 0;
  const hasApplications = (applications.data?.length ?? 0) > 0;
  const setupDone = hasResume && hasJobs && hasApplications;
  const setupLoaded = !resume.isLoading && !jobs.isLoading && !applications.isLoading;

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
      <div className="panel p-6 sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold">Dashboard</h1>
            <p className="mt-2 max-w-xl text-sm text-muted-foreground">
              What needs you today, and every posting you've saved — added on your phone, waiting
              on your laptop.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="secondary">
              <Link to="/posting-search">Compare several postings</Link>
            </Button>
            <Button asChild>
              <Link to="/save">Quick save a posting</Link>
            </Button>
          </div>
        </div>
      </div>

      {/* Needs attention — follow-ups whose date has arrived. */}
      <section className="panel p-6 sm:p-8" aria-labelledby="attention-heading">
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
            <CheckCircle2 className="h-4 w-4 text-primary" />
            Nothing due right now — no follow-ups are waiting on you.
          </p>
        ) : (
          <ul className="mt-4 divide-y divide-border">
            {dueFollowUps.map((app) => {
              const job = jobOf(app);
              const overdue = app.follow_up_date! < today;
              return (
                <li
                  key={app.id}
                  className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
                >
                  <div className="flex items-start gap-2">
                    <AlertCircle
                      className={`mt-0.5 h-4 w-4 ${overdue ? "text-destructive" : "text-primary"}`}
                    />
                    <div>
                      <p className="font-medium">{job?.title ?? "Saved role"}</p>
                      <p className="text-xs text-muted-foreground">
                        {job?.company ? `${job.company} · ` : ""}
                        {overdue ? "Follow-up overdue since " : "Follow up today — due "}
                        {formatDate(app.follow_up_date!)}
                      </p>
                    </div>
                  </div>
                  <Button asChild size="sm" variant="secondary">
                    <Link to="/applications">Follow up</Link>
                  </Button>
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
          <p className="mt-1 text-sm text-muted-foreground">
            Three steps and JobLanded can start matching and tailoring for you.
          </p>
          <ol className="mt-4 space-y-3">
            {steps.map((step, i) => (
              <li key={step.label} className="flex flex-wrap items-center justify-between gap-3">
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
                      <span className="sr-only">{step.done ? " (done)" : " (not done yet)"}</span>
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
        </section>
      )}

      <section className="panel p-6 sm:p-8" aria-labelledby="postings-heading">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="postings-heading" className="font-display text-lg font-semibold">
            Saved postings
          </h2>
          {hasJobs && (
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search
                  className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                  aria-hidden="true"
                />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search title, company, location"
                  aria-label="Search saved postings"
                  className="h-9 w-64 pl-8"
                />
              </div>
              <Select value={sort} onValueChange={(v) => setSort(v as typeof sort)}>
                <SelectTrigger className="h-9 w-40" aria-label="Sort saved postings">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="recent">Most recent</SelectItem>
                  <SelectItem value="title">Role title A–Z</SelectItem>
                  <SelectItem value="company">Company A–Z</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        <div className="mt-5">
          {jobs.isLoading ? (
            <ListSkeleton />
          ) : jobs.isError ? (
            <LoadFailed what="saved postings" onRetry={() => void jobs.refetch()} />
          ) : !hasJobs ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                No postings saved yet. Add one and it will show up here, ready for matching.
              </p>
              <Button asChild variant="secondary" size="sm">
                <Link to="/jobs">Add a job posting</Link>
              </Button>
            </div>
          ) : visibleJobs.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No postings match “{search}”. Try a different word.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {visibleJobs.map((job) => (
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
                      <Sparkles className="mr-1.5 h-4 w-4" aria-hidden="true" /> Match my resume
                    </Link>
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}
