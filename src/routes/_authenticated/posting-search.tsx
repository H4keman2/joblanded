import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { matchPostings } from "@/lib/postings.functions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Hint } from "@/components/ui/hint";
import { toast } from "sonner";
import { Loader2, Search } from "lucide-react";

export const Route = createFileRoute("/_authenticated/posting-search")({
  head: () => ({
    meta: [
      { title: "Posting search — JobLanded" },
      {
        name: "description",
        content:
          "Paste several job postings at once and see which roles each section of your resume matches best.",
      },
      { property: "og:title", content: "Posting search — JobLanded" },
      {
        property: "og:description",
        content: "Compare several postings against every section of your resume in one pass.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PostingSearchPage,
});

function scoreTone(score: number) {
  if (score >= 75) return "bg-primary/15 text-primary";
  if (score >= 50) return "bg-secondary text-foreground";
  return "bg-muted text-muted-foreground";
}

function PostingSearchPage() {
  const run = useServerFn(matchPostings);
  const [text, setText] = useState("");

  const match = useMutation({
    mutationFn: (value: string) => run({ data: { text: value } }),
    onError: (e: Error) => toast.error(e.message),
  });

  const result = match.data;

  return (
    <div className="space-y-6">
      <div className="panel p-8">
        <h1 className="text-2xl font-semibold">Posting search</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Paste several postings at once, separated by a line with three dashes
          (<code className="rounded bg-secondary px-1">---</code>). You'll get a grid showing which
          role each part of your resume — summary, skills, experience, achievements, education —
          speaks to best.
        </p>

        <form
          className="mt-6 space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            match.mutate(text);
          }}
        >
          <div>
            <Label htmlFor="postings">Job postings</Label>
            <Textarea
              id="postings"
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={14}
              placeholder={"Paste posting one…\n\n---\n\nPaste posting two…"}
              className="mt-1.5"
            />
          </div>
          <Button type="submit" disabled={match.isPending || text.trim().length < 80}>
            {match.isPending ? (
              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
            ) : (
              <Search className="mr-1.5 h-4 w-4" />
            )}
            Compare postings
          </Button>
        </form>
      </div>

      {result && (
        <>
          <div className="panel overflow-x-auto p-8">
            <h2 className="text-lg font-semibold">Section-by-section fit</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {result.postings.length} posting{result.postings.length === 1 ? "" : "s"} compared
              against {result.sections.length} resume sections. The strongest role for each section
              is outlined.
            </p>

            <table className="mt-6 w-full min-w-[640px] border-separate border-spacing-1 text-sm">
              <thead>
                <tr>
                  <th className="text-left font-medium text-muted-foreground">Resume section</th>
                  {result.postings.map((p) => (
                    <th key={p.index} className="text-left font-medium">
                      <div>{p.title}</div>
                      <div className="text-xs font-normal text-muted-foreground">
                        {p.company ?? "Company not stated"} · overall {p.overall}%
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {result.sections.map((section) => {
                  const best = Math.max(
                    ...result.postings.map(
                      (p) => p.sections.find((s) => s.section === section)?.score ?? 0,
                    ),
                  );
                  return (
                    <tr key={section}>
                      <th className="whitespace-nowrap pr-4 text-left align-top font-medium">
                        {section}
                      </th>
                      {result.postings.map((p) => {
                        const cell = p.sections.find((s) => s.section === section);
                        const score = cell?.score ?? 0;
                        const isBest = score === best && best > 0;
                        return (
                          <td key={p.index} className="align-top">
                            <Hint
                              tip={
                                cell?.evidence.length
                                  ? `Matches on: ${cell.evidence.join("; ")}`
                                  : "No clear supporting evidence found in this section."
                              }
                            >
                              <div
                                className={`rounded-md px-3 py-2 ${scoreTone(score)} ${
                                  isBest ? "ring-2 ring-primary" : ""
                                }`}
                              >
                                <div className="font-semibold">{score}%</div>
                                {cell?.gap && (
                                  <div className="mt-1 text-xs opacity-80">Missing: {cell.gap}</div>
                                )}
                              </div>
                            </Hint>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="panel p-8">
            <h2 className="text-lg font-semibold">Where each section lands best</h2>
            <ul className="mt-4 space-y-3">
              {result.sections.map((section) => {
                const ranked = result.postings
                  .map((p) => ({ p, cell: p.sections.find((s) => s.section === section) }))
                  .sort((a, b) => (b.cell?.score ?? 0) - (a.cell?.score ?? 0));
                const top = ranked[0];
                if (!top) return null;
                return (
                  <li key={section} className="border-b border-border pb-3 last:border-0 last:pb-0">
                    <p className="text-sm font-medium">
                      {section} → {top.p.title}
                      <span className="ml-2 text-muted-foreground">{top.cell?.score ?? 0}%</span>
                    </p>
                    {top.cell?.evidence.length ? (
                      <p className="mt-1 text-sm text-muted-foreground">
                        Because of: {top.cell.evidence.join(", ")}
                      </p>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}
