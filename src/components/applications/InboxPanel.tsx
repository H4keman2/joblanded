import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { usePro, toastProError } from "@/lib/pro-store";
import {
  listApplicationEvents,
  parseApplicationEmail,
  recordApplicationEvent,
} from "@/lib/inbox.functions";
import { EVENT_LABELS, type ApplicationEventType, type ParsedEmailEvent } from "@/lib/inbox";
import { STATUS_LABELS, type ApplicationStatus } from "@/lib/applications.functions";
import { ProFeatureSection } from "@/components/ProFeatureSection";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Inbox, Loader2, Mail } from "lucide-react";

export type InboxApplicationOption = {
  id: string;
  title: string;
  company: string | null;
  status: string;
};

type ParseResult = {
  parsed: ParsedEmailEvent;
  matchedApplicationId: string | null;
  suggestedStatus: ApplicationStatus | null;
};

function formatDay(dateStr: string) {
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function optionLabel(app: InboxApplicationOption) {
  return app.company ? `${app.company} — ${app.title}` : app.title;
}

/**
 * The living tracker's front door: paste any email from an application
 * process and JobLanded reads it, attaches it to the right application,
 * and proposes the status move it implies. Nothing is written until the
 * user confirms — the user stays the sender, the tracker just stops
 * depending on their memory.
 */
export function InboxPanel({
  applications,
  suppressUpsell = false,
}: {
  applications: InboxApplicationOption[];
  /** The Applications page already shows a Get Pro card in the section
   * above; don't repeat it here. */
  suppressUpsell?: boolean;
}) {
  const pro = usePro();
  const qc = useQueryClient();
  const runParse = useServerFn(parseApplicationEmail);
  const runRecord = useServerFn(recordApplicationEvent);
  const fetchEvents = useServerFn(listApplicationEvents);

  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [result, setResult] = useState<ParseResult | null>(null);
  const [selectedId, setSelectedId] = useState<string>("");

  const events = useQuery({
    queryKey: ["application-events"],
    queryFn: () => fetchEvents(),
    enabled: pro.isPro,
  });

  const parseMutation = useMutation({
    onMutate: () => setResult(null),
    mutationFn: () =>
      runParse({ data: { subject: subject.trim(), body: body.trim(), licenseKey: pro.key ?? "" } }),
    onSuccess: (data) => {
      const parsed = data as unknown as ParseResult;
      setResult(parsed);
      setSelectedId(parsed.matchedApplicationId ?? "");
    },
    onError: (e: Error) => toastProError(e),
  });

  const recordMutation = useMutation({
    mutationFn: (applyStatus: boolean) =>
      runRecord({
        data: {
          applicationId: selectedId || null,
          eventType: result!.parsed.eventType,
          eventDate: result!.parsed.eventDate,
          subject: subject.trim(),
          summary: result!.parsed.summary,
          applyStatus,
        },
      }),
    onSuccess: (_data, applyStatus) => {
      toast.success(applyStatus ? "Logged — and the status is updated." : "Logged to the tracker.");
      setResult(null);
      setSubject("");
      setBody("");
      void qc.invalidateQueries({ queryKey: ["applications"] });
      void qc.invalidateQueries({ queryKey: ["application-events"] });
      void qc.invalidateQueries({ queryKey: ["application-stats"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!pro.loaded) return null;

  if (!pro.isPro) {
    return (
      <ProFeatureSection
        icon={<Inbox className="h-5 w-5" />}
        title="Application inbox"
        description="Paste any email from an application — a confirmation, a rejection, an interview invite — and JobLanded reads it, files it against the right application, and proposes the status update for you."
        benefits={[
          {
            title: "The tracker keeps itself current",
            body: "Rejections and invites land as events on the application, so statuses stop drifting out of date.",
          },
          {
            title: "You still confirm every move",
            body: "JobLanded proposes; nothing changes until you say so. No autopilot acting in your name.",
          },
        ]}
        feature="Application inbox"
        hideUpsell={suppressUpsell}
      />
    );
  }

  const selectedApp = applications.find((a) => a.id === selectedId) ?? null;
  const canMove =
    result !== null &&
    selectedApp !== null &&
    result.suggestedStatus !== null &&
    result.suggestedStatus !== selectedApp.status;

  return (
    <section className="panel space-y-5 p-6" aria-label="Application inbox">
      <div>
        <h2 className="flex items-center gap-2 text-xl font-semibold">
          <span aria-hidden="true" className="text-primary">
            <Inbox className="h-5 w-5" />
          </span>
          Application inbox
          <Badge variant="secondary" className="text-[11px]">
            Pro
          </Badge>
        </h2>
        <p className="mt-1 max-w-xl text-sm text-muted-foreground">
          Got an email about an application? Paste it here — JobLanded reads it, files it against
          the right role, and proposes the status update. You confirm before anything changes.
        </p>
      </div>

      <div className="space-y-3">
        <div>
          <Label htmlFor="inbox-subject">Email subject</Label>
          <Input
            id="inbox-subject"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="e.g. Update on your application to Stripe"
            maxLength={500}
            className="mt-1.5"
          />
        </div>
        <div>
          <Label htmlFor="inbox-body">Email text</Label>
          <Textarea
            id="inbox-body"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={6}
            placeholder="Paste the full email text here…"
            maxLength={20000}
            className="mt-1.5"
            aria-describedby={body.trim().length < 20 ? "inbox-body-hint" : undefined}
          />
          {body.trim().length < 20 && (
            <p id="inbox-body-hint" className="mt-1.5 text-xs text-muted-foreground">
              {20 - body.trim().length} more characters needed — paste the full email to read it.
            </p>
          )}
        </div>
        <Button
          onClick={() => parseMutation.mutate()}
          disabled={body.trim().length < 20 || parseMutation.isPending}
        >
          {parseMutation.isPending ? (
            <Loader2 aria-hidden="true" className="mr-1.5 h-4 w-4 animate-spin" />
          ) : (
            <Mail aria-hidden="true" className="mr-1.5 h-4 w-4" />
          )}
          Read this email
        </Button>
      </div>

      {result && (
        <div className="space-y-3 rounded-lg border border-border p-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge>{EVENT_LABELS[result.parsed.eventType]}</Badge>
            {result.parsed.eventDate && (
              <span className="text-xs text-muted-foreground">
                {formatDay(result.parsed.eventDate)}
              </span>
            )}
          </div>
          {result.parsed.summary && <p className="text-sm">{result.parsed.summary}</p>}
          {(result.parsed.company || result.parsed.roleTitle) && (
            <p className="text-xs text-muted-foreground">
              {[result.parsed.company, result.parsed.roleTitle].filter(Boolean).join(" — ")}
            </p>
          )}
          <div>
            <Label htmlFor="inbox-application">Belongs to</Label>
            <Select value={selectedId} onValueChange={setSelectedId}>
              <SelectTrigger id="inbox-application" className="mt-1.5">
                <SelectValue placeholder="Pick the application this is about" />
              </SelectTrigger>
              <SelectContent>
                {applications.map((app) => (
                  <SelectItem key={app.id} value={app.id}>
                    {optionLabel(app)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {result.matchedApplicationId && selectedId === result.matchedApplicationId && (
              <p className="mt-1.5 text-xs text-muted-foreground">
                Matched automatically — change it if that&apos;s wrong.
              </p>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {canMove && (
              <Button
                onClick={() => recordMutation.mutate(true)}
                disabled={recordMutation.isPending}
              >
                Log it &amp; move to {STATUS_LABELS[result.suggestedStatus!]}
              </Button>
            )}
            <Button
              variant={canMove ? "outline" : "default"}
              onClick={() => recordMutation.mutate(false)}
              disabled={recordMutation.isPending || !selectedId}
            >
              Just log it
            </Button>
            <Button
              variant="ghost"
              onClick={() => setResult(null)}
              disabled={recordMutation.isPending}
            >
              Discard
            </Button>
          </div>
        </div>
      )}

      {events.isError && (
        <div>
          <h3 className="text-sm font-semibold">Recent updates</h3>
          <p role="status" className="mt-2 text-xs text-muted-foreground">
            We couldn&apos;t load your recent updates. Your connection may have dropped.
          </p>
          <Button
            variant="outline"
            size="sm"
            className="mt-2"
            onClick={() => events.refetch()}
            disabled={events.isFetching}
          >
            Try again
          </Button>
        </div>
      )}

      {(events.data ?? []).length > 0 && (
        <div>
          <h3 className="text-sm font-semibold">Recent updates</h3>
          <ul className="mt-2 space-y-1.5">
            {(events.data ?? []).slice(0, 5).map((event) => {
              const app = applications.find((a) => a.id === event.application_id);
              return (
                <li key={event.id} className="text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">
                    {EVENT_LABELS[event.event_type as ApplicationEventType] ?? "Update"}
                  </span>
                  {app ? ` · ${optionLabel(app)}` : ""}
                  {event.event_date ? ` · ${formatDay(event.event_date)}` : ""}
                  {event.summary ? ` — ${event.summary}` : ""}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </section>
  );
}
