import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getLatestResume, parseResume, saveParsedResume } from "@/lib/resume.functions";
import { extractPdfText } from "@/lib/pdf-text";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Upload, Sparkles, Loader2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/resume")({
  head: () => ({
    meta: [
      { title: "Your Resume — JobLanded" },
      {
        name: "description",
        content:
          "Upload a PDF or paste your resume text, then review and edit the skills, titles and experience we extracted.",
      },
      { property: "og:title", content: "Your Resume — JobLanded" },
      {
        property: "og:description",
        content: "Upload, parse and review your structured resume profile.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ResumePage,
});

type Education = { school?: string; degree?: string; year?: string | null };
type Parsed = {
  full_name?: string | null;
  email?: string | null;
  phone?: string | null;
  location?: string | null;
  skills?: string[];
  titles?: string[];
  years_experience?: number | null;
  education?: Education[];
  achievements?: string[];
  keywords?: string[];
  summary?: string;
};

function ResumePage() {
  const queryClient = useQueryClient();
  const fetchResume = useServerFn(getLatestResume);
  const runParse = useServerFn(parseResume);
  const runSave = useServerFn(saveParsedResume);
  const fileRef = useRef<HTMLInputElement>(null);

  const [rawText, setRawText] = useState("");
  const [extracting, setExtracting] = useState(false);
  const [draft, setDraft] = useState<Parsed | null>(null);
  const [resumeId, setResumeId] = useState<string | null>(null);

  const { data: resume, isLoading } = useQuery({
    queryKey: ["latest-resume"],
    queryFn: () => fetchResume(),
  });

  useEffect(() => {
    if (resume) {
      setResumeId(resume.id);
      setDraft((resume.parsed_json as Parsed | null) ?? {});
      setRawText(resume.raw_text ?? "");
    }
  }, [resume]);

  const parseMutation = useMutation({
    mutationFn: (text: string) => runParse({ data: { rawText: text } }),
    onSuccess: (row) => {
      setResumeId(row.id);
      setDraft((row.parsed_json as Parsed | null) ?? {});
      void queryClient.invalidateQueries({ queryKey: ["latest-resume"] });
      toast.success("Resume parsed — review the details below.");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const saveMutation = useMutation({
    mutationFn: () =>
      runSave({ data: { id: resumeId!, parsed: (draft ?? {}) as Record<string, unknown> } }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["latest-resume"] });
      toast.success("Profile saved.");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setExtracting(true);
    try {
      const isPdf = file.type === "application/pdf";
      const text = isPdf ? await extractPdfText(file) : await file.text();
      if (text.trim().length < 30) throw new Error("Couldn't read enough text from that file.");
      setRawText(text);
      if (isPdf) {
        parseMutation.mutate(text);
      } else {
        toast.success("Text extracted — now parse it.");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not read that file");
    } finally {
      setExtracting(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  function update<K extends keyof Parsed>(key: K, value: Parsed[K]) {
    setDraft((d) => ({ ...(d ?? {}), [key]: value }));
  }

  const listValue = (v?: string[]) => (v ?? []).join(", ");
  const toList = (v: string) =>
    v
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-semibold">Your resume</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Upload a PDF or paste the text. We extract a structured profile you can edit.
        </p>
      </div>

      <section className="panel space-y-4 p-6">
        <div className="flex flex-wrap items-center gap-3">
          <input
            ref={fileRef}
            type="file"
            accept="application/pdf,.txt,.md"
            className="hidden"
            onChange={onFile}
          />
          <Button variant="outline" onClick={() => fileRef.current?.click()} disabled={extracting}>
            {extracting ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Upload className="size-4" />
            )}
            Upload PDF
          </Button>
          <span className="text-sm text-muted-foreground">or paste the text below</span>
        </div>

        {draft ? (
          <details className="rounded-md border border-border/60 p-3">
            <summary className="cursor-pointer text-sm text-muted-foreground">
              View extracted text
            </summary>
            <div className="mt-3 space-y-3">
              <Textarea
                value={rawText}
                onChange={(e) => setRawText(e.target.value)}
                placeholder="Paste your resume text here…"
                className="min-h-56 text-sm leading-relaxed"
              />
              <Button
                onClick={() => parseMutation.mutate(rawText)}
                disabled={parseMutation.isPending || rawText.trim().length < 30}
              >
                {parseMutation.isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Sparkles className="size-4" />
                )}
                {parseMutation.isPending ? "Parsing…" : "Parse resume again"}
              </Button>
            </div>
          </details>
        ) : (
          <>
            <Textarea
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              placeholder="Paste your resume text here…"
              className="min-h-56 text-sm leading-relaxed"
            />

            <Button
              onClick={() => parseMutation.mutate(rawText)}
              disabled={parseMutation.isPending || rawText.trim().length < 30}
            >
              {parseMutation.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Sparkles className="size-4" />
              )}
              {parseMutation.isPending ? "Parsing…" : "Parse resume"}
            </Button>
          </>
        )}
      </section>

      {isLoading && <p className="text-sm text-muted-foreground">Loading your profile…</p>}

      {draft && resumeId && (
        <section className="panel space-y-6 p-6">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-xl font-semibold">Review your profile</h2>
            <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
              {saveMutation.isPending ? "Saving…" : "Save changes"}
            </Button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Full name">
              <Input
                value={draft.full_name ?? ""}
                onChange={(e) => update("full_name", e.target.value)}
              />
            </Field>
            <Field label="Years of experience">
              <Input
                type="number"
                min={0}
                value={draft.years_experience ?? ""}
                onChange={(e) =>
                  update("years_experience", e.target.value === "" ? null : Number(e.target.value))
                }
              />
            </Field>
            <Field label="Email">
              <Input value={draft.email ?? ""} onChange={(e) => update("email", e.target.value)} />
            </Field>
            <Field label="Phone">
              <Input value={draft.phone ?? ""} onChange={(e) => update("phone", e.target.value)} />
            </Field>
            <Field label="Location">
              <Input
                value={draft.location ?? ""}
                onChange={(e) => update("location", e.target.value)}
                placeholder="City, State"
              />
              <p className="mt-1.5 text-xs text-muted-foreground">
                Used to find nearby job recommendations on the Jobs page.
              </p>
            </Field>
          </div>

          <Field label="Summary">
            <Textarea
              value={draft.summary ?? ""}
              onChange={(e) => update("summary", e.target.value)}
              className="min-h-24"
            />
          </Field>

          <Field label="Skills (comma separated)">
            <Textarea
              value={listValue(draft.skills)}
              onChange={(e) => update("skills", toList(e.target.value))}
              className="min-h-20"
            />
            <div className="mt-2 flex flex-wrap gap-1.5">
              {(draft.skills ?? []).slice(0, 24).map((s) => (
                <Badge key={s} variant="secondary">
                  {s}
                </Badge>
              ))}
            </div>
          </Field>

          <Field label="Job titles held (comma separated)">
            <Textarea
              value={listValue(draft.titles)}
              onChange={(e) => update("titles", toList(e.target.value))}
              className="min-h-16"
            />
          </Field>

          <Field label="Key achievements (one per line)">
            <Textarea
              value={(draft.achievements ?? []).join("\n")}
              onChange={(e) =>
                update(
                  "achievements",
                  e.target.value.split("\n").filter((l) => l.trim()),
                )
              }
              className="min-h-28"
            />
          </Field>

          <Field label="Education">
            <div className="space-y-2">
              {(draft.education ?? []).map((ed, i) => (
                <div key={i} className="grid gap-2 sm:grid-cols-3">
                  <Input
                    value={ed.school ?? ""}
                    placeholder="School"
                    onChange={(e) => {
                      const next = [...(draft.education ?? [])];
                      next[i] = { ...next[i], school: e.target.value };
                      update("education", next);
                    }}
                  />
                  <Input
                    value={ed.degree ?? ""}
                    placeholder="Degree"
                    onChange={(e) => {
                      const next = [...(draft.education ?? [])];
                      next[i] = { ...next[i], degree: e.target.value };
                      update("education", next);
                    }}
                  />
                  <Input
                    value={ed.year ?? ""}
                    placeholder="Year"
                    onChange={(e) => {
                      const next = [...(draft.education ?? [])];
                      next[i] = { ...next[i], year: e.target.value };
                      update("education", next);
                    }}
                  />
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => update("education", [...(draft.education ?? []), {}])}
              >
                Add education
              </Button>
            </div>
          </Field>

          <Field label="Keywords (comma separated)">
            <Textarea
              value={listValue(draft.keywords)}
              onChange={(e) => update("keywords", toList(e.target.value))}
              className="min-h-16"
            />
          </Field>
        </section>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
    </div>
  );
}
