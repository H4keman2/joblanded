import { useMemo } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Sparkles } from "lucide-react";
import { listJobs, rankRoles } from "@/lib/jobs.functions";
import { listApplications } from "@/lib/applications.functions";
import { usePro } from "@/lib/pro-store";
import { Button } from "@/components/ui/button";
import { Hint } from "@/components/ui/hint";

// Same display rule as the Jobs list: legacy rows can hold pay_min > pay_max,
// so sort the pair instead of printing "$150,000–$120,000".
function paySuffix(job: { pay_min?: number | null; pay_max?: number | null }) {
  const values = [job.pay_min, job.pay_max].filter((v): v is number => Boolean(v));
  if (!values.length) return "";
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  return ` · $${lo.toLocaleString()}${values.length > 1 && lo !== hi ? `–$${hi.toLocaleString()}` : ""}`;
}

const MAX_PICKS = 5;

// Clera-style shortlist for the Dashboard: the saved postings the user hasn't
// applied to yet, ranked by how well the parsed resume fits each one. Kept
// separate from the tracker and the Jobs list — this is the "start here"
// answer to "which of my saved roles is actually worth my time?". Fit scores
// are a Pro feature (rankRoles re-verifies the license server-side), so the
// rail simply doesn't render for non-Pro users or before a resume is parsed
// (every fit null) instead of showing an unranked list under a ranked label.
export function WorthApplyingTo() {
  const fetchJobs = useServerFn(listJobs);
  const fetchApplications = useServerFn(listApplications);
  const fetchFits = useServerFn(rankRoles);
  const pro = usePro();

  const jobs = useQuery({ queryKey: ["jobs"], queryFn: () => fetchJobs() });
  const applications = useQuery({
    queryKey: ["applications"],
    queryFn: () => fetchApplications(),
  });
  const fits = useQuery({
    queryKey: ["role-fit", pro.key],
    queryFn: () => fetchFits({ data: { licenseKey: pro.key ?? "" } }),
    enabled: pro.isPro,
  });

  const picks = useMemo(() => {
    if (!pro.isPro || !fits.data) return [];
    const fitById = new Map(fits.data.map((f) => [f.id, f]));
    const savedIds = new Set(
      ((applications.data ?? []) as unknown as { job_id: string; status: string }[])
        .filter((a) => a.status === "saved")
        .map((a) => a.job_id),
    );
    return (jobs.data ?? [])
      .filter((j) => !j.archived_at && savedIds.has(j.id))
      .map((j) => ({
        job: j,
        fit: fitById.get(j.id)?.fit ?? null,
        matched: fitById.get(j.id)?.matched ?? [],
      }))
      .filter((p) => p.fit != null)
      .sort((a, b) => (b.fit ?? -1) - (a.fit ?? -1))
      .slice(0, MAX_PICKS);
  }, [pro.isPro, fits.data, applications.data, jobs.data]);

  if (picks.length === 0) return null;

  return (
    <section className="panel p-6 sm:p-8" aria-labelledby="worth-applying-heading">
      <div className="flex flex-wrap items-center gap-2">
        <Sparkles aria-hidden="true" className="h-5 w-5 text-primary" />
        <h2 id="worth-applying-heading" className="font-display text-xl font-bold tracking-tight">
          Worth applying to
        </h2>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        Your strongest saved matches you haven&apos;t applied to yet — ranked by resume fit.
      </p>
      <ul className="mt-4 divide-y divide-border">
        {picks.map(({ job, fit, matched }, i) => (
          <li
            key={job.id}
            className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
          >
            <div className="min-w-0">
              <p className="flex flex-wrap items-center gap-2 font-medium">
                <Link to="/jobs/$jobId" params={{ jobId: job.id }} className="hover:text-primary">
                  {job.title}
                </Link>
                <span className="rounded-full bg-secondary px-2 py-0.5 text-[11px] font-medium text-secondary-foreground">
                  {fit}% fit
                </span>
                {i === 0 && (
                  <span className="rounded-full bg-primary px-2 py-0.5 text-[11px] font-medium text-primary-foreground">
                    Best match
                  </span>
                )}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {[job.company, job.location].filter(Boolean).join(" · ") || "No company listed"}
                {paySuffix(job)}
              </p>
              {matched.length > 0 && (
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Overlaps on {matched.slice(0, 3).join(", ")}
                </p>
              )}
            </div>
            <Hint tip="Open this posting to tailor your resume against it, then mark it applied from the tracker.">
              <Button asChild size="sm" variant="secondary">
                <Link
                  to="/jobs/$jobId"
                  params={{ jobId: job.id }}
                  aria-label={`Tailor and apply for ${job.title}`}
                >
                  Tailor &amp; apply
                </Link>
              </Button>
            </Hint>
          </li>
        ))}
      </ul>
    </section>
  );
}
