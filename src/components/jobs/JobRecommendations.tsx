import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { addJob, getRecommendedJobs } from "@/lib/jobs.functions";
import { getLatestResume } from "@/lib/resume.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Hint } from "@/components/ui/hint";
import { toast } from "sonner";
import { ExternalLink, Loader2, Plus, Search } from "lucide-react";

type Parsed = { titles?: string[]; location?: string | null };

type RecommendedJob = {
  id: string;
  title: string;
  company: string | null;
  location: string | null;
  salaryMin: number | null;
  salaryMax: number | null;
  snippet: string;
  url: string;
  fit: number | null;
  reason: string;
};

function fitTone(fit: number | null) {
  if (fit == null) return "bg-secondary text-secondary-foreground";
  if (fit >= 70) return "bg-primary/10 text-primary";
  if (fit >= 40) return "bg-amber-500/10 text-amber-600";
  return "bg-muted text-muted-foreground";
}

function payLine(min: number | null, max: number | null) {
  if (!min && !max) return null;
  const fmt = (n: number) => `$${Math.round(n).toLocaleString()}`;
  if (min && max && min !== max) return `${fmt(min)}–${fmt(max)}`;
  return fmt(min ?? max!);
}

export function JobRecommendations() {
  const qc = useQueryClient();
  const fetchResume = useServerFn(getLatestResume);
  const fetchRecommended = useServerFn(getRecommendedJobs);
  const saveJob = useServerFn(addJob);

  const resume = useQuery({ queryKey: ["latest-resume"], queryFn: () => fetchResume() });

  const [keyword, setKeyword] = useState("");
  const [location, setLocation] = useState("");
  const [salaryMin, setSalaryMin] = useState("");
  const [salaryMax, setSalaryMax] = useState("");
  const [results, setResults] = useState<RecommendedJob[] | null>(null);
  const primed = useRef(false);

  const search = useMutation({
    mutationFn: (input: {
      keyword?: string | undefined;
      location?: string | undefined;
      salaryMin?: number | undefined;
      salaryMax?: number | undefined;
    }) => fetchRecommended({ data: input }),
    onSuccess: (rows) => setResults(rows as RecommendedJob[]),
    onError: (e: Error) => {
      setResults([]);
      toast.error(e.message);
    },
  });

  // Prefill the search fields from the resume once (title + location), then
  // run the first search automatically so the row isn't empty on load. Only
  // runs once resume.data has settled (success with a resume, or null).
  useEffect(() => {
    if (primed.current || resume.isLoading) return;
    primed.current = true;
    const parsed = (resume.data?.parsed_json as Parsed | null) ?? {};
    const defaultKeyword = parsed.titles?.[0] ?? "";
    const defaultLocation = parsed.location ?? "";
    setKeyword(defaultKeyword);
    setLocation(defaultLocation);
    search.mutate({
      keyword: defaultKeyword || undefined,
      location: defaultLocation || undefined,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resume.isLoading, resume.data]);

  function runSearch() {
    const min = salaryMin.trim() ? Number(salaryMin) : undefined;
    const max = salaryMax.trim() ? Number(salaryMax) : undefined;
    search.mutate({
      keyword: keyword.trim() || undefined,
      location: location.trim() || undefined,
      salaryMin: min && Number.isFinite(min) ? min : undefined,
      salaryMax: max && Number.isFinite(max) ? max : undefined,
    });
  }

  const add = useMutation({
    mutationFn: (job: RecommendedJob) => saveJob({ data: { description: "", sourceUrl: job.url } }),
    onSuccess: (_row, job) => {
      toast.success("Job saved");
      setResults((rows) => (rows ?? []).filter((r) => r.id !== job.id));
      void qc.invalidateQueries({ queryKey: ["jobs"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="panel space-y-5 p-8">
      <div>
        <h2 className="text-xl font-semibold">Recommended for you</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Pulled from live postings and ranked against your resume. Refine with a keyword, location,
          or salary range — all optional.
        </p>
      </div>

      <form
        className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
        onSubmit={(e) => {
          e.preventDefault();
          runSearch();
        }}
      >
        <div className="lg:col-span-2">
          <Label htmlFor="rec-keyword">Job title or keyword</Label>
          <Input
            id="rec-keyword"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="e.g. Senior Product Manager"
            className="mt-1.5"
          />
        </div>
        <div>
          <Label htmlFor="rec-location">Location (optional)</Label>
          <Input
            id="rec-location"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="City, State"
            className="mt-1.5"
          />
        </div>
        <div className="flex gap-2">
          <div className="flex-1">
            <Label htmlFor="rec-salary-min">Min salary</Label>
            <Input
              id="rec-salary-min"
              type="number"
              min={0}
              value={salaryMin}
              onChange={(e) => setSalaryMin(e.target.value)}
              placeholder="Optional"
              className="mt-1.5"
            />
          </div>
          <div className="flex-1">
            <Label htmlFor="rec-salary-max">Max salary</Label>
            <Input
              id="rec-salary-max"
              type="number"
              min={0}
              value={salaryMax}
              onChange={(e) => setSalaryMax(e.target.value)}
              placeholder="Optional"
              className="mt-1.5"
            />
          </div>
        </div>
        <div className="lg:col-span-4">
          <Button type="submit" disabled={search.isPending}>
            {search.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Search className="size-4" />
            )}
            Search
          </Button>
        </div>
      </form>

      {search.isPending && !results ? (
        <p className="text-sm text-muted-foreground">Finding roles that fit…</p>
      ) : results && results.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No matches found. Try a broader keyword or clearing the location/salary filters.
        </p>
      ) : results && results.length > 0 ? (
        <div className="-mx-2 flex gap-4 overflow-x-auto px-2 pb-2">
          {results.map((job) => (
            <Card key={job.id} className="w-72 shrink-0 space-y-3 p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-medium leading-snug">{job.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {[job.company, job.location].filter(Boolean).join(" · ") ||
                      "Company not listed"}
                  </p>
                </div>
                {job.fit != null && (
                  <Hint tip="How closely this posting matches your resume's skills and job titles.">
                    <span
                      className={`shrink-0 cursor-help rounded-full px-2 py-0.5 text-xs font-semibold ${fitTone(job.fit)}`}
                    >
                      {job.fit}%
                    </span>
                  </Hint>
                )}
              </div>

              {payLine(job.salaryMin, job.salaryMax) && (
                <p className="text-xs font-medium text-foreground">
                  {payLine(job.salaryMin, job.salaryMax)}
                </p>
              )}

              <p className="text-xs text-muted-foreground">{job.reason}</p>

              {job.snippet && (
                <p className="line-clamp-3 text-xs text-muted-foreground">{job.snippet}</p>
              )}

              <div className="flex items-center justify-between gap-2 pt-1">
                <a
                  href={job.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                >
                  View posting <ExternalLink className="size-3" />
                </a>
                <Hint tip="Save this posting to your Jobs list so you can tailor a resume against it.">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => add.mutate(job)}
                    disabled={add.isPending}
                  >
                    <Plus className="size-4" />
                    Add job
                  </Button>
                </Hint>
              </div>
            </Card>
          ))}
        </div>
      ) : null}
    </div>
  );
}
