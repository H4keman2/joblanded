import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { ArrowLeft, Loader2, Layers, Sparkles, Wand2 } from "lucide-react";
import { generateDraft, getJob, listDrafts, listJobs, rankRoles } from "@/lib/jobs.functions";
import { DraftCard, Hint, type TailorDraft } from "@/components/tailor/DraftCard";



export const Route = createFileRoute("/_authenticated/jobs/$jobId")({
  head: () => ({
    meta: [
      { title: "Tailor & compare — JobLanded" },
      {
        name: "description",
        content:
          "Run your resume against a saved job posting, generate tailored versions, and compare them with inline diff highlighting.",
      },
      { property: "og:title", content: "Tailor & compare — JobLanded" },
      {
        property: "og:description",
        content: "Generate and compare tailored resume versions for a real job posting.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: JobDetailPage,
});

type StoredDraft = { id: string; created_at: string; content: string };

function normalize(content: string): TailorDraft {
  let raw: Record<string, unknown> = {};
  try {
    raw = JSON.parse(content) as Record<string, unknown>;
  } catch {
    raw = {};
  }
  const s = (v: unknown, fallback = "") => (typeof v === "string" ? v : fallback);
  const n = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? Math.round(v) : 0);
  const arr = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);
  const ats = (raw["ats"] ?? {}) as Record<string, unknown>;
  const kw = (raw["keywords"] ?? {}) as Record<string, unknown>;
  return {
    angle: s(raw["angle"], "Tailored draft"),
    summary: s(raw["summary"]),
    cover: s(raw["cover"]),
    why: s(raw["why"]),
    ats: { score: n(ats["score"]), note: s(ats["note"]), flags: arr(ats["flags"]) },
    keywords: {
      score: n(kw["score"]),
      note: s(kw["note"]),
      hits: arr(kw["hits"]),
      misses: arr(kw["misses"]),
    },
  };
}

function JobDetailPage() {
  const { jobId } = Route.useParams();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const fetchJob = useServerFn(getJob);
  const fetchJobs = useServerFn(listJobs);
  const fetchDrafts = useServerFn(listDrafts);
  const generate = useServerFn(generateDraft);

  const [selected, setSelected] = useState(0);
  const [compare, setCompare] = useState<number | null>(null);
  const [showDiff, setShowDiff] = useState(true);

  const job = useQuery({ queryKey: ["job", jobId], queryFn: () => fetchJob({ data: { id: jobId } }) });
  const roles = useQuery({ queryKey: ["jobs"], queryFn: () => fetchJobs() });
  const drafts = useQuery({
    queryKey: ["drafts", jobId],
    queryFn: () => fetchDrafts({ data: { jobId } }) as Promise<StoredDraft[]>,
  });

  const versions = drafts.data ?? [];
  const roleOptions = roles.data ?? [];

  const genAll = useMutation({
    mutationFn: async () => {
      const targets = roleOptions.filter((r) => r.id !== jobId);
      for (const r of targets) {
        await generate({ data: { jobId: r.id } });
        await qc.invalidateQueries({ queryKey: ["drafts", r.id] });
      }
      return targets.length;
    },
    onSuccess: (count) =>
      count === 0
        ? toast.info("Add more roles on the Jobs page to tailor several at once.")
        : toast.success(`Tailored a new version for ${count} other role${count === 1 ? "" : "s"}`),
    onError: (e: Error) => toast.error(e.message),
  });


  const gen = useMutation({
    mutationFn: (input: { optimizeFromId?: string }) =>
      generate({ data: { jobId, ...(input.optimizeFromId ? { optimizeFromId: input.optimizeFromId } : {}) } }),
    onSuccess: async (_res, input) => {
      const fresh = (await qc.fetchQuery({
        queryKey: ["drafts", jobId],
        queryFn: () => fetchDrafts({ data: { jobId } }) as Promise<StoredDraft[]>,
      })) as StoredDraft[];
      setSelected(input.optimizeFromId ? fresh.findIndex((d) => d.id === input.optimizeFromId) : fresh.length - 1);
      setCompare(input.optimizeFromId ? fresh.length - 1 : null);
      toast.success(input.optimizeFromId ? "ATS-optimized version ready" : "New version ready");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const primaryEntry = versions[selected];
  const secondaryEntry = compare === null ? undefined : versions[compare];
  const primary = primaryEntry ? normalize(primaryEntry.content) : null;
  const secondary = secondaryEntry ? normalize(secondaryEntry.content) : null;
  const label = (i: number) => `v${i + 1}`;

  return (
    <TooltipProvider>
      <div className="space-y-6">
        <div className="panel p-8">
          <Link to="/jobs" className="inline-flex items-center text-xs text-muted-foreground hover:text-foreground">
            <ArrowLeft className="mr-1 h-3.5 w-3.5" /> All jobs
          </Link>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold">{job.data?.title ?? "Loading…"}</h1>
            {roleOptions.length > 1 && (
              <Hint tip="Switch the role you're tailoring against. Each role keeps its own saved versions.">
                <div className="min-w-56">
                  <Select
                    value={jobId}
                    onValueChange={(id) => {
                      if (id === jobId) return;
                      setSelected(0);
                      setCompare(null);
                      void navigate({ to: "/jobs/$jobId", params: { jobId: id } });
                    }}
                  >
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue placeholder="Choose a role" />
                    </SelectTrigger>
                    <SelectContent>
                      {roleOptions.map((r) => (
                        <SelectItem key={r.id} value={r.id}>
                          {r.title}
                          {r.company ? ` · ${r.company}` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </Hint>
            )}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {[job.data?.company, job.data?.location].filter(Boolean).join(" · ")}
          </p>

          {job.data?.source_url && (
            <a
              href={job.data.source_url}
              target="_blank"
              rel="noreferrer"
              className="mt-2 inline-block text-xs text-primary underline"
            >
              View original posting
            </a>
          )}
          {job.data?.description && (
            <details className="mt-4">
              <summary className="cursor-pointer text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Job description
              </summary>
              <p className="mt-3 whitespace-pre-wrap text-sm text-muted-foreground">
                {job.data.description}
              </p>
            </details>
          )}
        </div>

        <div className="panel p-8">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Version history
            </span>
            {versions.map((v, i) => (
              <Hint key={v.id} tip={`Angle: ${normalize(v.content).angle}. Same resume and posting — only the framing changes.`}>
                <button
                  onClick={() => setSelected(i)}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                    i === selected
                      ? "bg-primary text-primary-foreground"
                      : i === compare
                        ? "bg-secondary text-secondary-foreground ring-1 ring-primary"
                        : "bg-background text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {label(i)}
                </button>
              </Hint>
            ))}

            <Hint tip="Runs your latest parsed resume against this posting and writes a new tailored version with a different framing angle.">
              <Button size="sm" onClick={() => gen.mutate({})} disabled={gen.isPending || genAll.isPending}>
                {gen.isPending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Sparkles className="mr-1.5 h-4 w-4" />}
                {versions.length === 0 ? "Generate first version" : "Regenerate"}
              </Button>
            </Hint>

            {roleOptions.length > 1 && (
              <Hint tip="Tailors your resume for every other saved role too. Each role's version is saved under that role.">
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={gen.isPending || genAll.isPending}
                  onClick={() => genAll.mutate()}
                >
                  {genAll.isPending ? (
                    <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                  ) : (
                    <Layers className="mr-1.5 h-4 w-4" />
                  )}
                  Tailor all roles
                </Button>
              </Hint>
            )}


            {primaryEntry && (
              <Hint tip="Rewrites the selected version to fix its weakest readability flags and work its missing keywords back in, then opens both side by side.">
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={gen.isPending}
                  onClick={() => gen.mutate({ optimizeFromId: primaryEntry.id })}
                >
                  <Wand2 className="mr-1.5 h-4 w-4" />
                  ATS-optimize this draft
                </Button>
              </Hint>
            )}

            {versions.length > 1 && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() =>
                  setCompare((c) =>
                    c === null ? versions.map((_, i) => i).find((i) => i !== selected) ?? null : null,
                  )
                }
              >
                {compare === null ? "Compare" : "Exit compare"}
              </Button>
            )}

            {compare !== null && (
              <Hint tip="Word-level diff between the two versions: text only in the other version is struck through, text unique to this one is highlighted.">
                <Button size="sm" variant={showDiff ? "secondary" : "ghost"} onClick={() => setShowDiff((d) => !d)}>
                  {showDiff ? "Hide changes" : "Highlight changes"}
                </Button>
              </Hint>
            )}
          </div>

          {drafts.isLoading ? (
            <p className="mt-6 text-sm text-muted-foreground">Loading versions…</p>
          ) : !primary ? (
            <p className="mt-6 max-w-xl text-sm text-muted-foreground">
              No tailored versions yet. Generate one to run your parsed resume against this posting —
              you'll get a rewritten summary, cover opener, ATS readability score and keyword coverage.
              Make sure your <Link to="/resume" className="text-primary underline">resume</Link> is
              uploaded and parsed first.
            </p>
          ) : (
            <div className={`mt-5 grid gap-6 ${secondary ? "md:grid-cols-2" : ""}`}>
              <DraftCard
                label={label(selected)}
                draft={primary}
                diffAgainst={secondary && showDiff ? secondary : undefined}
              />
              {secondary && compare !== null && (
                <div className="border-t border-border pt-6 md:border-l md:border-t-0 md:pt-0 md:pl-6">
                  <div className="mb-3 flex flex-wrap gap-2">
                    {versions.map((v, i) =>
                      i === selected ? null : (
                        <button
                          key={v.id}
                          onClick={() => setCompare(i)}
                          className={`rounded-full px-3 py-1 text-xs font-medium ${
                            i === compare
                              ? "bg-secondary text-secondary-foreground ring-1 ring-primary"
                              : "bg-background text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          {label(i)}
                        </button>
                      ),
                    )}
                  </div>
                  <DraftCard
                    label={label(compare)}
                    draft={secondary}
                    diffAgainst={showDiff ? primary : undefined}
                  />
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </TooltipProvider>
  );
}
