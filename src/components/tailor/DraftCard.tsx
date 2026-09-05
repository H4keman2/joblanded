import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { downloadResumePdf } from "@/lib/resume-pdf";
import { Copy, Download } from "lucide-react";

export interface TailorDraft {
  angle: string;
  match: { score: number; note: string };
  resume: string;
  summary: string;
  cover: string;
  why: string;
  insights: { strengths: string[]; gaps: string[]; suggestions: string[] };
  ats: { score: number; note: string; flags: string[] };
  keywords: { score: number; note: string; hits: string[]; misses: string[] };
}

export function Hint({ children, tip }: { children: React.ReactNode; tip: string }) {
  return (
    <Tooltip delayDuration={100}>
      <TooltipTrigger asChild>
        <span className="inline-flex">{children}</span>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs text-xs leading-relaxed">{tip}</TooltipContent>
    </Tooltip>
  );
}

export function ScoreBar({ score }: { score: number }) {
  const color = score >= 85 ? "bg-primary" : score >= 75 ? "bg-amber-500" : "bg-destructive";
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-24 overflow-hidden rounded-full bg-border">
        <div
          className={`h-full rounded-full ${color}`}
          style={{ width: `${Math.max(0, Math.min(100, score))}%` }}
        />
      </div>
      <span className="text-xs font-semibold text-foreground">{score}</span>
    </div>
  );
}

export function MatchScore({ score, note }: { score: number; note: string }) {
  const tone =
    score >= 85
      ? "text-primary border-primary/30 bg-primary/10"
      : score >= 65
        ? "text-amber-600 border-amber-500/30 bg-amber-500/10"
        : "text-destructive border-destructive/30 bg-destructive/10";
  return (
    <div className={`flex items-center gap-3 rounded-lg border p-3 ${tone}`}>
      <span className="text-2xl font-bold leading-none">{Math.max(0, Math.min(100, score))}%</span>
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide">Match score</p>
        <p className="text-xs opacity-90">{note}</p>
      </div>
    </div>
  );
}

function InsightList({
  title,
  items,
  tone,
}: {
  title: string;
  items: string[];
  tone: "positive" | "negative" | "neutral";
}) {
  if (!items.length) return null;
  const dot =
    tone === "positive" ? "bg-primary" : tone === "negative" ? "bg-destructive" : "bg-amber-500";
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{title}</p>
      <ul className="mt-2 space-y-1.5">
        {items.map((item, i) => (
          <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
            <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${dot}`} />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

type DiffToken = { text: string; type: "same" | "add" | "del" };

// Word-level LCS diff. Returns tokens for `target` relative to `base`.
export function diffWords(base: string, target: string): DiffToken[] {
  const a = base.match(/\S+\s*/g) ?? [];
  const b = target.match(/\S+\s*/g) ?? [];
  const norm = (s: string) =>
    s
      .trim()
      .toLowerCase()
      .replace(/[.,;:—–-]+$/g, "");
  const n = a.length;
  const m = b.length;
  const table: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      table[i]![j] =
        norm(a[i]!) === norm(b[j]!)
          ? table[i + 1]![j + 1]! + 1
          : Math.max(table[i + 1]![j]!, table[i]![j + 1]!);
    }
  }
  const out: DiffToken[] = [];
  const push = (text: string, type: DiffToken["type"]) => {
    const last = out[out.length - 1];
    if (last && last.type === type) last.text += text;
    else out.push({ text, type });
  };
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (norm(a[i]!) === norm(b[j]!)) {
      push(b[j]!, "same");
      i++;
      j++;
    } else if (table[i + 1]![j]! >= table[i]![j + 1]!) {
      push(a[i]!, "del");
      i++;
    } else {
      push(b[j]!, "add");
      j++;
    }
  }
  while (i < n) push(a[i++]!, "del");
  while (j < m) push(b[j++]!, "add");
  return out;
}

export function DiffText({ base, text }: { base?: string | undefined; text: string }) {
  if (!base || base === text) return <>{text}</>;
  return (
    <>
      {diffWords(base, text).map((t, i) =>
        t.type === "same" ? (
          <span key={i}>{t.text}</span>
        ) : t.type === "add" ? (
          <span key={i} className="rounded-sm bg-primary/15 px-0.5 font-medium text-foreground">
            {t.text}
          </span>
        ) : (
          <span
            key={i}
            className="rounded-sm bg-destructive/10 px-0.5 text-destructive/70 line-through"
          >
            {t.text}
          </span>
        ),
      )}
    </>
  );
}

export function DraftCard({
  label,
  draft,
  diffAgainst,
  fileNameHint,
}: {
  label: string;
  draft: TailorDraft;
  diffAgainst?: TailorDraft | undefined;
  fileNameHint?: string | undefined;
}) {
  return (
    <div>
      <div className="flex items-baseline gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-primary">{label}</span>
        <span className="text-xs text-muted-foreground">{draft.angle}</span>
      </div>

      <div className="mt-4">
        <MatchScore score={draft.match.score} note={draft.match.note} />
      </div>

      <div className="mt-3 grid gap-3 rounded-lg border border-border bg-background p-3 sm:grid-cols-2">
        <div>
          <Hint tip={draft.ats.note}>
            <p className="cursor-help text-xs font-medium uppercase tracking-wide text-muted-foreground underline decoration-dotted underline-offset-2">
              ATS readability
            </p>
          </Hint>
          <div className="mt-1.5">
            <ScoreBar score={draft.ats.score} />
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {draft.ats.flags.map((f) => (
              <span
                key={f}
                className="rounded-full bg-secondary px-2 py-0.5 text-[10px] text-secondary-foreground"
              >
                {f}
              </span>
            ))}
          </div>
        </div>
        <div>
          <Hint tip={draft.keywords.note}>
            <p className="cursor-help text-xs font-medium uppercase tracking-wide text-muted-foreground underline decoration-dotted underline-offset-2">
              Keyword coverage
            </p>
          </Hint>
          <div className="mt-1.5">
            <ScoreBar score={draft.keywords.score} />
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {draft.keywords.hits.map((k) => (
              <Hint key={k} tip={`"${k}" appears in the posting and in this version.`}>
                <span className="cursor-help rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                  {k}
                </span>
              </Hint>
            ))}
            {draft.keywords.misses.map((k) => (
              <Hint key={k} tip={`"${k}" appears in the posting but is missing from this version.`}>
                <span className="cursor-help rounded-full bg-destructive/10 px-2 py-0.5 text-[10px] font-medium text-destructive">
                  {k}
                </span>
              </Hint>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Full tailored resume
          </p>
          {diffAgainst && (
            <span className="flex items-center gap-2 text-[10px] text-muted-foreground">
              <span className="rounded-sm bg-primary/15 px-1 font-medium text-foreground">
                added
              </span>
              <span className="rounded-sm bg-destructive/10 px-1 text-destructive/70 line-through">
                removed
              </span>
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => void navigator.clipboard.writeText(draft.resume)}
          >
            <Copy className="size-4" />
            Copy
          </Button>
          <Button
            type="button"
            variant="default"
            size="sm"
            onClick={() =>
              downloadResumePdf(draft.resume, `${fileNameHint ?? "tailored-resume"}.pdf`)
            }
          >
            <Download className="size-4" />
            Download PDF
          </Button>
        </div>
      </div>
      <div className="mt-2 max-h-96 overflow-y-auto whitespace-pre-wrap rounded-lg border border-border bg-background p-4 text-sm leading-relaxed text-foreground">
        <DiffText base={diffAgainst?.resume} text={draft.resume} />
      </div>

      <div className="mt-5 grid gap-4 rounded-lg border border-border bg-background p-3 sm:grid-cols-3">
        <InsightList title="Strengths" items={draft.insights.strengths} tone="positive" />
        <InsightList title="Gaps" items={draft.insights.gaps} tone="negative" />
        <InsightList title="Suggestions" items={draft.insights.suggestions} tone="neutral" />
      </div>

      <p className="mt-5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Cover letter opener
      </p>
      <blockquote className="mt-2 border-l-2 border-primary pl-4 text-sm text-muted-foreground">
        <DiffText base={diffAgainst?.cover} text={draft.cover} />
      </blockquote>

      <p className="mt-4 rounded-lg border border-border bg-background p-3 text-xs text-muted-foreground">
        <span className="font-semibold text-foreground">Why this version: </span>
        {draft.why}
      </p>
    </div>
  );
}
