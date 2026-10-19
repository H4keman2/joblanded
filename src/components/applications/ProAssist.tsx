import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { usePro, toastProError } from "@/lib/pro-store";
import { getInterviewPrep, getOfferCheck } from "@/lib/application-assist.functions";
import { listJobs } from "@/lib/jobs.functions";
import { ProFeatureSection } from "@/components/ProFeatureSection";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Hint } from "@/components/ui/hint";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Sparkles, Loader2, MessagesSquare, BadgeDollarSign, ChevronDown } from "lucide-react";

type PrepQuestion = { question: string; why: string; angle: string };
type PrepResult = {
  jobTitle: string;
  company: string | null;
  questions: PrepQuestion[];
  tips: string[];
};
type OfferResult = {
  jobTitle: string;
  company: string | null;
  payMin: number | null;
  payMax: number | null;
  offerBase: number;
  verdict: "below" | "inline" | "above";
  verdictSummary: string;
  rangeComparison: string;
  negotiate: boolean;
  negotiateWhy: string;
  counterAsk: number | null;
  script: string;
  watchouts: string[];
};

const VERDICT_STYLE: Record<OfferResult["verdict"], { badge: string; label: string }> = {
  below: { badge: "bg-destructive text-destructive-foreground", label: "Below range" },
  inline: { badge: "bg-emerald-500 text-white", label: "In line" },
  above: { badge: "bg-cyan-600 text-white", label: "Above range" },
};

function money(n: number) {
  return `$${n.toLocaleString()}`;
}

/** Offer marker plotted against the posting's pay range. */
function RangeBar({ min, max, offer }: { min: number; max: number; offer: number }) {
  const lo = Math.min(min, offer) * 0.94;
  const hi = Math.max(max, offer) * 1.06;
  const pct = (v: number) => Math.max(0, Math.min(100, ((v - lo) / (hi - lo)) * 100));
  return (
    <div>
      <div className="relative h-3 rounded-full bg-secondary">
        <div
          className="absolute inset-y-0 rounded-full bg-gradient-to-r from-teal-500 to-cyan-500"
          style={{ left: `${pct(min)}%`, width: `${Math.max(2, pct(max) - pct(min))}%` }}
        />
        <Hint tip={`Your offer: ${money(offer)}`}>
          <div
            className="absolute inset-y-[-5px] w-1.5 cursor-help rounded-full bg-foreground"
            style={{ left: `calc(${pct(offer)}% - 3px)` }}
          />
        </Hint>
      </div>
      <div className="mt-1.5 flex justify-between text-xs text-muted-foreground">
        <span>Posted {money(min)}</span>
        <span>Posted {money(max)}</span>
      </div>
    </div>
  );
}

const PRO_BENEFITS = [
  {
    title: "Interview prep per posting",
    body: "Likely questions for the exact role, what the interviewer is really testing, and how you should answer from your background.",
  },
  {
    title: "Offer check",
    body: "Enter the offer — the AI compares it to the posting's range, tells you whether to negotiate, names a counter number, and gives you the script.",
  },
];

function AssistLocked() {
  return (
    <ProFeatureSection
      icon={<Sparkles className="h-5 w-5" />}
      title="Interview prep & offer check"
      description="When a posting turns into interviews \u2014 or an offer \u2014 Pro helps you walk in ready and negotiate with numbers."
      benefits={PRO_BENEFITS}
      feature="Interview prep & offer check"
      preview={
        <>
          <p className="text-sm font-medium">
            \u201cWalk me through a product you shipped end-to-end.\u201d
          </p>
          <p className="text-xs text-muted-foreground">
            Why they ask: ownership and follow-through\u2026
          </p>
          <p className="text-sm">
            <span className="rounded bg-emerald-200 px-2 py-0.5 text-xs font-medium text-emerald-950">
              In line
            </span>{" "}
            <span className="text-muted-foreground">
              $165K sits mid-range \u2014 negotiating room\u2026
            </span>
          </p>
        </>
      }
    />
  );
}

export function ProAssist() {
  const pro = usePro();
  const fetchJobs = useServerFn(listJobs);
  const runPrep = useServerFn(getInterviewPrep);
  const runOffer = useServerFn(getOfferCheck);

  const [prepJobId, setPrepJobId] = useState("");
  const [prep, setPrep] = useState<PrepResult | null>(null);
  const [offerJobId, setOfferJobId] = useState("");
  const [base, setBase] = useState("");
  const [bonus, setBonus] = useState("");
  const [equity, setEquity] = useState("");
  const [notes, setNotes] = useState("");
  const [offer, setOffer] = useState<OfferResult | null>(null);

  const jobs = useQuery({
    queryKey: ["jobs"],
    queryFn: () => fetchJobs(),
    enabled: pro.isPro,
  });
  const activeJobs = (jobs.data ?? []).filter((j) => !j.archived_at);

  const prepMutation = useMutation({
    mutationFn: (jobId: string) => runPrep({ data: { jobId, licenseKey: pro.key ?? "" } }),
    onSuccess: (data) => {
      setPrep(data as unknown as PrepResult);
      toast.success("Interview prep ready.");
    },
    onError: (e: Error) => toastProError(e),
  });

  const offerMutation = useMutation({
    mutationFn: () =>
      runOffer({
        data: {
          jobId: offerJobId,
          licenseKey: pro.key ?? "",
          base: Number(base),
          bonus: bonus.trim() || undefined,
          equity: equity.trim() || undefined,
          notes: notes.trim() || undefined,
        },
      }),
    onSuccess: (data) => {
      setOffer(data as unknown as OfferResult);
      toast.success("Offer evaluated.");
    },
    onError: (e: Error) => toastProError(e),
  });

  const baseValid = Number(base) > 0;

  if (!pro.loaded) {
    return (
      <section className="panel p-6" aria-label="Interview prep & offer check">
        <p className="text-sm text-muted-foreground">Checking your Pro status…</p>
      </section>
    );
  }
  if (!pro.isPro) return <AssistLocked />;

  return (
    <section className="panel space-y-6 p-6" aria-labelledby="pro-assist-heading">
      <div>
        <h2 id="pro-assist-heading" className="flex items-center gap-2 text-xl font-semibold">
          <Sparkles aria-hidden="true" className="h-5 w-5 text-primary" />
          Interview prep & offer check
          <Badge variant="secondary" className="text-[11px]">
            Pro
          </Badge>
        </h2>
        <p className="mt-1 max-w-xl text-sm text-muted-foreground">
          When a posting turns into interviews — or an offer — Pro helps you walk in ready and
          negotiate with numbers.
        </p>
      </div>

      {
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Interview prep */}
          <div className="space-y-4 rounded-lg border border-border p-4">
            <h3 className="flex items-center gap-2 font-semibold">
              <MessagesSquare aria-hidden="true" className="h-4 w-4 text-primary" />
              Interview prep
            </h3>
            {activeJobs.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Save a posting on the Jobs page first.
              </p>
            ) : (
              <div className="flex flex-wrap items-center gap-2">
                <Select value={prepJobId} onValueChange={setPrepJobId}>
                  <SelectTrigger className="h-9 w-64" aria-label="Choose a posting to prep for">
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
                <Hint tip="Generates likely questions for this posting, tuned to your resume.">
                  <Button
                    size="sm"
                    disabled={!prepJobId || prepMutation.isPending}
                    onClick={() => prepJobId && prepMutation.mutate(prepJobId)}
                  >
                    {prepMutation.isPending && (
                      <Loader2 aria-hidden="true" className="mr-1.5 h-4 w-4 animate-spin" />
                    )}
                    Prep me
                  </Button>
                </Hint>
                {!prepJobId && !prepMutation.isPending && (
                  <p className="w-full text-xs text-muted-foreground">
                    Choose a posting to prep for.
                  </p>
                )}
              </div>
            )}

            {prep && (
              <div className="space-y-3">
                {(prep.questions ?? []).map((q, i) => (
                  <details
                    key={i}
                    className="group rounded-lg border border-border p-3"
                    open={i === 0}
                  >
                    <summary className="flex cursor-pointer list-none items-start justify-between gap-2 text-sm font-medium">
                      <span>
                        <span className="mr-1.5 text-muted-foreground">{i + 1}.</span>
                        {q.question}
                      </span>
                      <ChevronDown
                        aria-hidden="true"
                        className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180"
                      />
                    </summary>
                    <p className="mt-2 text-xs text-muted-foreground">
                      <span className="font-semibold text-foreground">Why they ask: </span>
                      {q.why}
                    </p>
                    <p className="mt-1 text-xs">
                      <span className="font-semibold">Your angle: </span>
                      {q.angle}
                    </p>
                  </details>
                ))}
                {(prep.tips ?? []).length > 0 && (
                  <ul className="space-y-1 rounded-lg bg-secondary/40 p-3 text-xs text-muted-foreground">
                    {prep.tips.map((t, i) => (
                      <li key={i}>· {t}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>

          {/* Offer check */}
          <div className="space-y-4 rounded-lg border border-border p-4">
            <h3 className="flex items-center gap-2 font-semibold">
              <BadgeDollarSign aria-hidden="true" className="h-4 w-4 text-primary" />
              Offer check
            </h3>
            {activeJobs.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Save a posting on the Jobs page first.
              </p>
            ) : (
              <div className="space-y-3">
                <div>
                  <Label htmlFor="offer-job">Posting</Label>
                  <Select value={offerJobId} onValueChange={setOfferJobId}>
                    <SelectTrigger
                      id="offer-job"
                      className="mt-1.5 h-9"
                      aria-label="Posting with the offer"
                    >
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
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <Label htmlFor="offer-base">Base salary *</Label>
                    <Input
                      id="offer-base"
                      inputMode="numeric"
                      placeholder="165000"
                      value={base}
                      onChange={(e) => setBase(e.target.value.replace(/[^0-9]/g, ""))}
                      className="mt-1.5"
                    />
                  </div>
                  <div>
                    <Label htmlFor="offer-bonus">Bonus</Label>
                    <Input
                      id="offer-bonus"
                      placeholder="10%"
                      value={bonus}
                      onChange={(e) => setBonus(e.target.value)}
                      className="mt-1.5"
                    />
                  </div>
                  <div>
                    <Label htmlFor="offer-equity">Equity</Label>
                    <Input
                      id="offer-equity"
                      placeholder="0.05%"
                      value={equity}
                      onChange={(e) => setEquity(e.target.value)}
                      className="mt-1.5"
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="offer-notes">Notes (optional)</Label>
                  <Textarea
                    id="offer-notes"
                    rows={2}
                    placeholder="Level, competing offers, anything the numbers don't show…"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="mt-1.5"
                  />
                </div>
                <Hint tip="Compares the offer to the posting's range and tells you whether to negotiate — with a counter number and script.">
                  <Button
                    size="sm"
                    disabled={!offerJobId || !baseValid || offerMutation.isPending}
                    onClick={() => offerMutation.mutate()}
                  >
                    {offerMutation.isPending && (
                      <Loader2 aria-hidden="true" className="mr-1.5 h-4 w-4 animate-spin" />
                    )}
                    Evaluate offer
                  </Button>
                </Hint>
                {(!offerJobId || !baseValid) && !offerMutation.isPending && (
                  <p className="w-full text-xs text-muted-foreground">
                    Choose a posting and enter a base salary to evaluate.
                  </p>
                )}
              </div>
            )}

            {offer && (
              <div className="space-y-3 rounded-lg border border-border p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge className={VERDICT_STYLE[offer.verdict]?.badge ?? ""}>
                    {VERDICT_STYLE[offer.verdict]?.label ?? offer.verdict}
                  </Badge>
                  <p className="text-sm font-medium">
                    {offer.jobTitle}
                    {offer.company ? ` · ${offer.company}` : ""}
                  </p>
                </div>
                <p className="text-sm text-muted-foreground">{offer.verdictSummary}</p>
                {offer.payMin != null && offer.payMax != null && (
                  <RangeBar min={offer.payMin} max={offer.payMax} offer={offer.offerBase} />
                )}
                <p className="text-xs text-muted-foreground">{offer.rangeComparison}</p>
                <div
                  className={`rounded-lg border p-3 text-sm ${
                    offer.negotiate ? "border-amber-500/40 bg-amber-500/[0.06]" : "border-border"
                  }`}
                >
                  <p className="font-semibold">
                    {offer.negotiate ? "Yes — negotiate." : "No need to push."}
                    {offer.negotiate && offer.counterAsk != null && (
                      <span className="ml-1 font-normal text-muted-foreground">
                        Counter around {money(offer.counterAsk)} base.
                      </span>
                    )}
                  </p>
                  <p className="mt-1 text-muted-foreground">{offer.negotiateWhy}</p>
                </div>
                <div className="rounded-lg bg-secondary/40 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Say this
                  </p>
                  <p className="mt-1 text-sm italic">“{offer.script}”</p>
                </div>
                {(offer.watchouts ?? []).length > 0 && (
                  <ul className="space-y-1 text-xs text-muted-foreground">
                    {offer.watchouts.map((w, i) => (
                      <li key={i}>· {w}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        </div>
      }
    </section>
  );
}
