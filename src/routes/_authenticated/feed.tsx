import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { CheckCircle2, Heart, Layers, Loader2, X } from "lucide-react";
import { getJob, listJobs, rankRoles, setFeedDecision } from "@/lib/jobs.functions";
import { listApplications } from "@/lib/applications.functions";
import { getProfile } from "@/lib/account.functions";
import { ProFeatureSection } from "@/components/ProFeatureSection";
import { Button } from "@/components/ui/button";
import { Hint } from "@/components/ui/hint";
import { usePro } from "@/lib/pro-store";

export const Route = createFileRoute("/_authenticated/feed")({
  head: () => ({
    meta: [
      { title: "Match feed — JobLanded" },
      {
        name: "description",
        content:
          "Review your saved postings one at a time, ranked by resume fit — like the keepers, pass the rest.",
      },
      { property: "og:title", content: "Match feed — JobLanded" },
      {
        property: "og:description",
        content: "Saved postings as fit-scored cards: like or pass, one at a time.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: FeedPage,
});

// Same display rule as the Jobs list paySuffix: legacy rows can hold
// pay_min > pay_max, so sort the pair instead of printing "$150,000–$120,000".
function payLine(job: { pay_min?: number | null; pay_max?: number | null }) {
  const values = [job.pay_min, job.pay_max].filter((v): v is number => Boolean(v));
  if (!values.length) return "";
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  return `$${lo.toLocaleString()}${values.length > 1 && lo !== hi ? `–$${hi.toLocaleString()}` : ""}`;
}

function FeedPage() {
  const qc = useQueryClient();
  const fetchJobs = useServerFn(listJobs);
  const fetchApplications = useServerFn(listApplications);
  const fetchFits = useServerFn(rankRoles);
  const fetchJob = useServerFn(getJob);
  const fetchProfile = useServerFn(getProfile);
  const decide = useServerFn(setFeedDecision);
  const pro = usePro();

  const profile = useQuery({ queryKey: ["profile"], queryFn: () => fetchProfile() });

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

  const statusByJob = useMemo(() => {
    const map = new Map<string, string>();
    for (const a of (applications.data ?? []) as unknown as { job_id: string; status: string }[]) {
      map.set(a.job_id, a.status);
    }
    return map;
  }, [applications.data]);

  const fitById = useMemo(() => {
    const map = new Map<string, { fit: number | null; matched: string[] }>();
    for (const f of fits.data ?? []) map.set(f.id, { fit: f.fit, matched: f.matched });
    return map;
  }, [fits.data]);

  // Account-page preferences steer the queue: a posting whose stated pay
  // tops out below the pay floor never enters the feed (postings with no
  // stated pay are never hidden — unknown isn't below-floor).
  const payFloor = profile.data?.pay_floor ?? null;

  const undecided = useMemo(() => {
    return (jobs.data ?? [])
      .filter((j) => !j.archived_at && !j.feed_decision && statusByJob.get(j.id) === "saved")
      .map((j) => ({ job: j, ...(fitById.get(j.id) ?? { fit: null, matched: [] }) }));
  }, [jobs.data, statusByJob, fitById]);

  const hiddenBelowFloor = useMemo(() => {
    if (payFloor == null) return 0;
    return undecided.filter((e) => e.job.pay_max != null && e.job.pay_max < payFloor).length;
  }, [undecided, payFloor]);

  // The queue: undecided postings minus the below-floor ones, strongest
  // resume fit first (unscored postings go last, not hidden).
  const queue = useMemo(() => {
    return undecided
      .filter((e) => !(payFloor != null && e.job.pay_max != null && e.job.pay_max < payFloor))
      .sort((a, b) => (b.fit ?? -1) - (a.fit ?? -1));
  }, [undecided, payFloor]);

  // Preference flags for the current card: soft signals only — the card is
  // still decidable, the badge just says "check this before you like it".
  const prefFlags = (job: { location: string | null }): string[] => {
    const prefs = profile.data;
    if (!prefs || !job.location) return [];
    const flags: string[] = [];
    const loc = job.location.toLowerCase();
    const style = prefs.work_style;
    if (style === "remote" && !loc.includes("remote")) flags.push("Not flagged remote");
    if (style === "onsite" && loc.includes("remote")) flags.push("Listed as remote");
    if (style === "hybrid" && !loc.includes("hybrid") && !loc.includes("remote"))
      flags.push("Not flagged hybrid");
    const prefLoc = prefs.preferred_location?.trim().toLowerCase();
    if (prefLoc && !prefs.willing_to_relocate && !loc.includes(prefLoc) && !prefLoc.includes(loc))
      flags.push("Outside your preferred location");
    return flags;
  };

  const likedCount = useMemo(
    () => (jobs.data ?? []).filter((j) => j.feed_decision === "liked").length,
    [jobs.data],
  );
  const passedCount = useMemo(
    () => (jobs.data ?? []).filter((j) => j.feed_decision === "passed").length,
    [jobs.data],
  );
  const hasSavedPostings = useMemo(
    () => (jobs.data ?? []).some((j) => !j.archived_at && statusByJob.get(j.id) === "saved"),
    [jobs.data, statusByJob],
  );

  const current = queue[0];
  const detail = useQuery({
    queryKey: ["job", current?.job.id],
    queryFn: () => fetchJob({ data: { id: current!.job.id } }),
    enabled: Boolean(current),
  });

  const decideMutation = useMutation({
    mutationFn: (input: { id: string; decision: "liked" | "passed" }) => decide({ data: input }),
    onSuccess: (_r, v) => {
      toast.success(
        v.decision === "liked" ? "Liked — it stays in your Jobs list" : "Passed — out of the feed",
      );
      void qc.invalidateQueries({ queryKey: ["jobs"] });
    },
    onError: (e: Error) => toast.error(e.message || "Couldn't save that decision — try again."),
  });

  if (!pro.loaded) {
    return (
      <section className="panel p-6" role="status">
        <p className="text-sm text-muted-foreground">Checking your Pro status…</p>
      </section>
    );
  }

  if (!pro.isPro) {
    return (
      <ProFeatureSection
        icon={<Layers className="h-5 w-5" />}
        title="Match feed"
        description="Your saved postings as one-at-a-time cards, ranked by how well your resume fits each one. Like the keepers, pass the rest."
        benefits={[
          {
            title: "Fit scores up front",
            body: "Every card shows the resume-fit percentage and the skills that overlap, so the call takes seconds.",
          },
          {
            title: "Decisions stick",
            body: "Liked postings stay in your Jobs list ready to tailor; passed ones leave the feed for good.",
          },
          {
            title: "Nothing else changes",
            body: "The feed is triage only — tracker statuses and follow-ups are untouched.",
          },
        ]}
        feature="Match feed"
        preview={
          <>
            <p className="text-sm font-medium">Senior Product Manager · 84% fit</p>
            <p className="text-sm text-muted-foreground">
              Overlaps on product strategy, roadmapping, SQL…
            </p>
            <p className="text-xs text-muted-foreground">Like · Pass</p>
          </>
        }
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="panel p-5 sm:p-8">
        <h1 className="text-2xl font-semibold">Match feed</h1>
        <p className="mt-2 max-w-xl text-sm text-muted-foreground">
          Your saved postings, strongest resume fit first. Like a posting to keep it in play, or
          pass to take it out of the feed — either way the decision is saved.
        </p>
        <p className="mt-3 text-xs text-muted-foreground" aria-live="polite">
          {queue.length} to review · {likedCount} liked · {passedCount} passed
        </p>
        {hiddenBelowFloor > 0 && payFloor != null && (
          <p className="mt-1 text-xs text-muted-foreground">
            {hiddenBelowFloor} {hiddenBelowFloor === 1 ? "posting" : "postings"} hidden — below your
            ${payFloor.toLocaleString()} pay floor.{" "}
            <Link to="/account" className="text-primary underline">
              Update preferences
            </Link>
          </p>
        )}
      </div>

      {jobs.isLoading || applications.isLoading || fits.isLoading ? (
        <section className="panel p-6" role="status">
          <p className="text-sm text-muted-foreground">Loading your feed…</p>
        </section>
      ) : jobs.isError || applications.isError || fits.isError ? (
        <section className="panel p-6">
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-sm text-muted-foreground">
              We couldn&apos;t load your feed right now — your connection may have dropped.
            </p>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                void jobs.refetch();
                void applications.refetch();
                void fits.refetch();
              }}
            >
              Try again
            </Button>
          </div>
        </section>
      ) : !current ? (
        <section className="panel p-6 sm:p-8">
          <p className="flex items-center gap-2 text-sm font-medium">
            <CheckCircle2 aria-hidden="true" className="h-5 w-5 text-primary" />
            You&apos;re all caught up
          </p>
          <p className="mt-2 max-w-xl text-sm text-muted-foreground">
            {hasSavedPostings
              ? `You've reviewed every saved posting in the feed. Liked postings are waiting in your Jobs list, ready to tailor.${
                  hiddenBelowFloor > 0
                    ? " The only postings left are hidden by your pay floor."
                    : ""
                }`
              : "Nothing to review right now — postings you save will show up here for a quick yes or no."}
          </p>
          <div className="mt-4">
            <Button asChild size="sm">
              <Link to="/jobs">Go to Jobs</Link>
            </Button>
          </div>
        </section>
      ) : (
        <section
          className="panel p-5 sm:p-8"
          aria-label={`Posting to review: ${current.job.title}`}
        >
          <div className="flex flex-wrap items-center gap-2">
            {current.fit != null && (
              <span className="rounded-full bg-primary px-2.5 py-0.5 text-xs font-semibold text-primary-foreground">
                {current.fit}% fit
              </span>
            )}
            {current.fit != null && queue.length > 1 && (
              <span className="text-xs text-muted-foreground">Strongest remaining match</span>
            )}
            {prefFlags(current.job).map((flag) => (
              <span
                key={flag}
                className="rounded-full bg-amber-500/10 px-2.5 py-0.5 text-xs font-medium text-amber-600"
              >
                {flag}
              </span>
            ))}
          </div>
          <h2 className="mt-3 text-xl font-semibold">
            <Link
              to="/jobs/$jobId"
              params={{ jobId: current.job.id }}
              className="hover:text-primary"
            >
              {current.job.title}
            </Link>
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {[current.job.company, current.job.location].filter(Boolean).join(" · ") ||
              "No company listed"}
            {payLine(current.job) && ` · ${payLine(current.job)}`}
          </p>
          {current.matched.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {current.matched.map((m) => (
                <span
                  key={m}
                  className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary"
                >
                  {m}
                </span>
              ))}
            </div>
          )}
          {detail.data?.description && (
            <p className="mt-4 max-w-2xl whitespace-pre-wrap text-sm text-muted-foreground">
              {detail.data.description.slice(0, 400)}
              {detail.data.description.length > 400 ? "…" : ""}
            </p>
          )}
          {current.job.source_url && (
            <a
              href={current.job.source_url}
              target="_blank"
              rel="noreferrer"
              aria-label="View original posting (opens in new tab)"
              className="mt-3 inline-block text-xs text-primary underline"
            >
              View original posting
            </a>
          )}
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Hint tip="Not for you — removes this posting from the feed. It stays in your Jobs list, still saved.">
              <Button
                variant="outline"
                disabled={decideMutation.isPending}
                onClick={() => decideMutation.mutate({ id: current.job.id, decision: "passed" })}
              >
                {decideMutation.isPending && decideMutation.variables?.decision === "passed" ? (
                  <Loader2 aria-hidden="true" className="mr-1.5 h-4 w-4 animate-spin" />
                ) : (
                  <X aria-hidden="true" className="mr-1.5 h-4 w-4" />
                )}
                Pass
              </Button>
            </Hint>
            <Hint tip="Keep this one — it stays saved in your Jobs list, ready to tailor and apply.">
              <Button
                disabled={decideMutation.isPending}
                onClick={() => decideMutation.mutate({ id: current.job.id, decision: "liked" })}
              >
                {decideMutation.isPending && decideMutation.variables?.decision === "liked" ? (
                  <Loader2 aria-hidden="true" className="mr-1.5 h-4 w-4 animate-spin" />
                ) : (
                  <Heart aria-hidden="true" className="mr-1.5 h-4 w-4" />
                )}
                Like
              </Button>
            </Hint>
            <span className="text-xs text-muted-foreground">
              {queue.length} {queue.length === 1 ? "posting" : "postings"} left in the feed
            </span>
          </div>
        </section>
      )}
    </div>
  );
}
