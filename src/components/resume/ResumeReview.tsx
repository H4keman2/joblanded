import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { usePro, toastProError } from "@/lib/pro-store";
import { getResumeReview, getTailoringPreview } from "@/lib/resume-review.functions";
import { listJobs } from "@/lib/jobs.functions";
import { ProFeatureSection } from "@/components/ProFeatureSection";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Hint } from "@/components/ui/hint";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Sparkles, Loader2, Gauge, Lightbulb, Wand2, ArrowRight } from "lucide-react";

type SkillGroup = { label: string; skills: string[] };
type Suggestion = { priority: "high" | "medium" | "low"; area: string; issue: string; fix: string };
type ReviewResult = {
  skillGroups: SkillGroup[];
  metrics: string[];
  senioritySignals: string[];
  atsScore: number;
  atsNotes: string[];
  suggestions: Suggestion[];
  suggestedSummary: string | null;
};
type PreviewExample = { original: string; tailored: string; addedKeywords: string[] };
type PreviewResult = {
  jobTitle: string;
  company: string | null;
  examples: PreviewExample[];
  matchNote: string;
};

const GROUP_STYLES: [string, string][] = [
  ["technical", "bg-blue-100 text-blue-900 dark:bg-blue-950 dark:text-blue-200"],
  ["tools", "bg-violet-100 text-violet-900 dark:bg-violet-950 dark:text-violet-200"],
  ["leadership", "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200"],
  ["domain", "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200"],
];

function groupStyle(label: string) {
  const l = label.toLowerCase();
  for (const [key, style] of GROUP_STYLES) {
    if (l.includes(key)) return style;
  }
  return "bg-secondary text-secondary-foreground";
}

const PRIORITY_CARD: Record<string, string> = {
  high: "border-destructive/40 bg-destructive/[0.04]",
  medium: "border-amber-500/40 bg-amber-500/[0.05]",
  low: "border-border",
};
const PRIORITY_BADGE: Record<string, string> = {
  high: "bg-destructive text-destructive-foreground",
  medium: "bg-amber-500 text-white",
  low: "bg-secondary text-secondary-foreground",
};

function atsColor(score: number) {
  if (score >= 80) return "text-emerald-600 dark:text-emerald-400";
  if (score >= 60) return "text-amber-600 dark:text-amber-400";
  return "text-destructive";
}

function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Highlights posting keywords inside a tailored line. */
function Highlighted({ text, keywords }: { text: string; keywords: string[] }) {
  const keys = (keywords ?? []).filter((k) => k && k.trim().length > 1);
  if (!keys.length) return <>{text}</>;
  const pattern = new RegExp(`(${keys.map(escapeRegExp).join("|")})`, "gi");
  const lowered = new Set(keys.map((k) => k.toLowerCase()));
  return (
    <>
      {text.split(pattern).map((part, i) =>
        lowered.has(part.toLowerCase()) ? (
          <mark
            key={i}
            className="rounded bg-emerald-200 px-0.5 text-emerald-950 dark:bg-emerald-900 dark:text-emerald-100"
          >
            {part}
          </mark>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </>
  );
}

const PRO_BENEFITS = [
  {
    title: "Deep AI extraction",
    body: "Skills auto-sorted into color-coded categories, plus the metrics and seniority signals buried in your bullets.",
  },
  {
    title: "ATS score with fix notes",
    body: "See exactly how parsing-friendly your resume is and what to change.",
  },
  {
    title: "Prioritized improvements",
    body: "Concrete, ranked suggestions — including a rewritten summary you can apply in one tap.",
  },
  {
    title: "Tailoring previews",
    body: "Watch your own lines rewritten for any saved posting, with the added keywords highlighted.",
  },
];

function ReviewLocked() {
  return (
    <ProFeatureSection
      icon={<Sparkles className="h-5 w-5" />}
      title="AI Resume Review"
      description="A deeper AI pass over your resume: richer extraction, an ATS score, ranked improvements — and a live look at how Pro tailoring rewrites your lines for a real posting."
      benefits={PRO_BENEFITS}
      feature="AI Resume Review"
      preview={
        <>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-medium text-blue-900">
              Technical
            </span>
            <span className="rounded-full bg-violet-100 px-3 py-1 text-xs font-medium text-violet-900">
              Tools & Platforms
            </span>
            <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-900">
              Leadership
            </span>
          </div>
          <p className="mt-3 text-sm">
            <span className="font-semibold text-emerald-700">ATS score: 84</span>
            <span className="text-muted-foreground"> — strong keyword coverage…</span>
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            Suggestion: your summary buries the $1B product launch — lead with it…
          </p>
        </>
      }
    />
  );
}

export function ResumeReview({
  resumeId,
  hasResume,
  onUseSummary,
}: {
  resumeId: string | null;
  hasResume: boolean;
  onUseSummary: (summary: string) => void;
}) {
  const pro = usePro();
  const fetchJobs = useServerFn(listJobs);
  const runReview = useServerFn(getResumeReview);
  const runPreview = useServerFn(getTailoringPreview);

  const [review, setReview] = useState<ReviewResult | null>(null);
  const [previewJobId, setPreviewJobId] = useState("");
  const [preview, setPreview] = useState<PreviewResult | null>(null);

  const jobs = useQuery({
    queryKey: ["jobs"],
    queryFn: () => fetchJobs(),
    enabled: pro.isPro,
  });
  const activeJobs = (jobs.data ?? []).filter((j) => !j.archived_at);

  const reviewMutation = useMutation({
    mutationFn: () => runReview({ data: { resumeId: resumeId!, licenseKey: pro.key ?? "" } }),
    onSuccess: (data) => {
      setReview(data as unknown as ReviewResult);
      toast.success("AI review ready.");
    },
    onError: (e: Error) => {
      setReview(null);
      toastProError(e);
    },
  });

  const previewMutation = useMutation({
    mutationFn: (jobId: string) =>
      runPreview({ data: { resumeId: resumeId!, jobId, licenseKey: pro.key ?? "" } }),
    onSuccess: (data) => {
      setPreview(data as unknown as PreviewResult);
    },
    onError: (e: Error) => {
      setPreview(null);
      toastProError(e);
    },
  });

  return (
    <section className="panel space-y-6 p-6" aria-labelledby="ai-review-heading">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 id="ai-review-heading" className="flex items-center gap-2 text-xl font-semibold">
            <Sparkles aria-hidden="true" className="h-5 w-5 text-primary" />
            AI Resume Review
            <Badge variant="secondary" className="text-[11px]">
              Pro
            </Badge>
          </h2>
          <p className="mt-1 max-w-xl text-sm text-muted-foreground">
            A deeper AI pass over your resume: richer extraction, an ATS score, ranked improvements
            — and a live look at how Pro tailoring rewrites your lines for a real posting.
          </p>
        </div>
        {pro.isPro && hasResume && (
          <Hint tip="Runs the full AI review on your latest parsed resume.">
            <Button onClick={() => reviewMutation.mutate()} disabled={reviewMutation.isPending}>
              {reviewMutation.isPending ? (
                <Loader2 aria-hidden="true" className="mr-1.5 h-4 w-4 animate-spin" />
              ) : (
                <Sparkles aria-hidden="true" className="mr-1.5 h-4 w-4" />
              )}
              {review ? "Re-run review" : "Run AI review"}
            </Button>
          </Hint>
        )}
      </div>

      {!pro.loaded ? (
        <p className="text-sm text-muted-foreground">Checking your Pro status…</p>
      ) : !pro.isPro ? (
        <ReviewLocked />
      ) : !hasResume ? (
        <p className="text-sm text-muted-foreground">
          Upload and parse your resume above first — the AI review needs something to read.
        </p>
      ) : (
        <div className="space-y-8">
          {reviewMutation.isPending && (
            <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
              Reading your resume closely — extraction, ATS check and suggestions…
            </p>
          )}

          {review && (
            <>
              {/* ATS score */}
              <div className="flex flex-wrap items-center gap-4 rounded-lg border border-border p-4">
                <div className="flex items-center gap-2">
                  <Gauge aria-hidden="true" className="h-5 w-5 text-muted-foreground" />
                  <span className="text-sm font-medium">ATS score</span>
                </div>
                <p className={`text-3xl font-bold ${atsColor(review.atsScore ?? 0)}`}>
                  {review.atsScore ?? "–"}
                </p>
                <ul className="w-full space-y-1 text-xs text-muted-foreground sm:w-auto sm:flex-1">
                  {(review.atsNotes ?? []).map((n, i) => (
                    <li key={i}>· {n}</li>
                  ))}
                </ul>
              </div>

              {/* Color-coded extraction */}
              <div>
                <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  What the AI pulled out
                </h3>
                <div className="mt-3 space-y-3">
                  {(review.skillGroups ?? []).map((g) => (
                    <div key={g.label}>
                      <p className="mb-1.5 text-xs font-medium text-muted-foreground">{g.label}</p>
                      <div className="flex flex-wrap gap-1.5">
                        {(g.skills ?? []).map((s) => (
                          <Badge key={s} className={`${groupStyle(g.label)} border-0`}>
                            {s}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
                {(review.metrics ?? []).length > 0 && (
                  <div className="mt-4">
                    <p className="mb-1.5 text-xs font-medium text-muted-foreground">
                      Numbers that sell you
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {review.metrics.map((m, i) => (
                        <Badge key={i} variant="outline" className="border-primary/40">
                          {m}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
                {(review.senioritySignals ?? []).length > 0 && (
                  <ul className="mt-4 space-y-1 text-sm">
                    {review.senioritySignals.map((s, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <ArrowRight
                          aria-hidden="true"
                          className="mt-0.5 h-4 w-4 shrink-0 text-primary"
                        />
                        {s}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Suggestions */}
              <div>
                <h3 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  <Lightbulb aria-hidden="true" className="h-4 w-4" />
                  Suggested improvements
                </h3>
                <ul className="mt-3 space-y-3">
                  {(review.suggestions ?? []).map((s, i) => (
                    <li
                      key={i}
                      className={`rounded-lg border p-4 ${PRIORITY_CARD[s.priority] ?? PRIORITY_CARD["low"]}`}
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge className={PRIORITY_BADGE[s.priority] ?? PRIORITY_BADGE["low"]}>
                          {s.priority}
                        </Badge>
                        <p className="text-sm font-semibold">{s.area}</p>
                      </div>
                      <p className="mt-2 text-sm text-muted-foreground">{s.issue}</p>
                      <p className="mt-1 text-sm">
                        <span className="font-medium">Fix: </span>
                        {s.fix}
                      </p>
                    </li>
                  ))}
                </ul>
                {review.suggestedSummary && (
                  <div className="mt-4 rounded-lg border border-primary/30 bg-primary/[0.04] p-4">
                    <p className="text-sm font-semibold">Suggested summary</p>
                    <p className="mt-1 text-sm text-muted-foreground">{review.suggestedSummary}</p>
                    <Button
                      size="sm"
                      className="mt-3"
                      onClick={() => {
                        onUseSummary(review.suggestedSummary!);
                        toast.success("Summary applied — review it below, then save.");
                      }}
                    >
                      <Wand2 aria-hidden="true" className="mr-1.5 h-4 w-4" />
                      Use this summary
                    </Button>
                  </div>
                )}
              </div>
            </>
          )}

          {/* Tailoring showcase */}
          <div className="border-t border-border pt-6">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              See it in action
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Pick a saved posting — the AI rewrites three of your own lines for it, with the added
              keywords highlighted. This is exactly what Pro tailoring does before you apply.
            </p>
            {jobs.isError ? (
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <p className="text-sm text-muted-foreground">
                  We could not load your postings. Your connection may have dropped.
                </p>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={jobs.isFetching}
                  onClick={() => jobs.refetch()}
                >
                  Try again
                </Button>
              </div>
            ) : jobs.isPending || jobs.isFetching ? (
              <p className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
                Loading postings…
              </p>
            ) : activeJobs.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">
                Save a posting on the Jobs page first, then come back to preview the tailoring.
              </p>
            ) : (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Select value={previewJobId} onValueChange={setPreviewJobId}>
                  <SelectTrigger className="h-9 w-64" aria-label="Choose a posting to preview">
                    <SelectValue placeholder="Choose a posting…" />
                  </SelectTrigger>
                  <SelectContent>
                    {activeJobs.map((j) => (
                      <SelectItem key={j.id} value={j.id}>
                        {j.title}
                        {j.company ? ` · ${j.company}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  size="sm"
                  disabled={!previewJobId || previewMutation.isPending}
                  onClick={() => previewJobId && previewMutation.mutate(previewJobId)}
                >
                  {previewMutation.isPending && (
                    <Loader2 aria-hidden="true" className="mr-1.5 h-4 w-4 animate-spin" />
                  )}
                  Show me
                </Button>
              </div>
            )}

            {preview && (
              <div className="mt-4 space-y-4">
                <p className="text-sm text-muted-foreground">{preview.matchNote}</p>
                {(preview.examples ?? []).map((ex, i) => (
                  <div
                    key={i}
                    className="grid gap-3 rounded-lg border border-border p-4 md:grid-cols-2"
                  >
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        Your resume
                      </p>
                      <p className="mt-1 text-sm">{ex.original}</p>
                    </div>
                    <div className="border-t border-border pt-3 md:border-l md:border-t-0 md:pl-4 md:pt-0">
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        Tailored for {preview.jobTitle}
                      </p>
                      <p className="mt-1 text-sm">
                        <Highlighted text={ex.tailored} keywords={ex.addedKeywords} />
                      </p>
                      {(ex.addedKeywords ?? []).length > 0 && (
                        <p className="mt-2 text-xs text-muted-foreground">
                          Keywords added: {ex.addedKeywords.join(", ")}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
