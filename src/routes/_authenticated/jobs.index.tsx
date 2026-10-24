import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { addJob, deleteJob, listJobs, setJobArchived } from "@/lib/jobs.functions";
import { JobRecommendations } from "@/components/jobs/JobRecommendations";
import { EditJobDialog, type EditableJob } from "@/components/jobs/EditJobDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Hint } from "@/components/ui/hint";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { Archive, ArchiveRestore, Loader2, Pencil, Plus, Search, Trash2 } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// Pay-range buckets for the smart filters. Only buckets that actually match
// at least one saved posting are offered, so the filters always fit the list.
const PAY_BUCKETS = [
  { id: "under150", label: "Under $150K", test: (p: number) => p < 150_000 },
  { id: "150to200", label: "$150K – $200K", test: (p: number) => p >= 150_000 && p < 200_000 },
  { id: "200plus", label: "$200K+", test: (p: number) => p >= 200_000 },
] as const;

// The server checks the link too, but a bare "example.com/jobs" is almost always
// a missing https:// rather than a real posting — catch it here with copy a person
// can act on instead of surfacing the validator's raw JSON in a toast.
function isFullUrl(value: string) {
  try {
    const { protocol } = new URL(value);
    return protocol === "http:" || protocol === "https:";
  } catch {
    return false;
  }
}

export const Route = createFileRoute("/_authenticated/jobs/")({
  head: () => ({
    meta: [
      { title: "Jobs — JobLanded" },
      {
        name: "description",
        content: "Save real job postings and tailor your resume against each one.",
      },
      { property: "og:title", content: "Jobs — JobLanded" },
      { property: "og:description", content: "Saved job postings ready for tailoring." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: JobsPage,
});

function JobsPage() {
  const qc = useQueryClient();
  const fetchJobs = useServerFn(listJobs);
  const create = useServerFn(addJob);
  const remove = useServerFn(deleteJob);
  const archive = useServerFn(setJobArchived);

  const [description, setDescription] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [open, setOpen] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [editing, setEditing] = useState<EditableJob | null>(null);
  const [search, setSearch] = useState("");
  const [payFilter, setPayFilter] = useState<string>("any");
  const [companyFilter, setCompanyFilter] = useState<string>("any");
  const [locationFilter, setLocationFilter] = useState<string>("any");

  const jobs = useQuery({ queryKey: ["jobs"], queryFn: () => fetchJobs() });

  const archivedCount = useMemo(
    () => (jobs.data ?? []).filter((j) => j.archived_at).length,
    [jobs.data],
  );
  const baseJobs = useMemo(
    () => (jobs.data ?? []).filter((j) => (showArchived ? j.archived_at : !j.archived_at)),
    [jobs.data, showArchived],
  );

  // Smart filters, generated from the postings actually in the list.
  const companies = useMemo(() => {
    const counts = new Map<string, number>();
    for (const j of baseJobs) {
      if (j.company) counts.set(j.company, (counts.get(j.company) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [baseJobs]);
  const locations = useMemo(() => {
    const counts = new Map<string, number>();
    for (const j of baseJobs) {
      if (j.location) counts.set(j.location, (counts.get(j.location) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [baseJobs]);
  const payOptions = useMemo(() => {
    const buckets = PAY_BUCKETS.filter((b) =>
      baseJobs.some((j) => {
        const p = j.pay_min ?? j.pay_max;
        return p != null && b.test(p);
      }),
    );
    const noPay = baseJobs.some((j) => (j.pay_min ?? j.pay_max) == null);
    return { buckets, noPay };
  }, [baseJobs]);

  const filteredJobs = useMemo(() => {
    const term = search.trim().toLowerCase();
    return baseJobs.filter((job) => {
      if (
        term &&
        ![job.title, job.company, job.location]
          .filter(Boolean)
          .some((v) => v!.toLowerCase().includes(term))
      )
        return false;
      if (companyFilter !== "any" && job.company !== companyFilter) return false;
      if (locationFilter !== "any" && job.location !== locationFilter) return false;
      if (payFilter !== "any") {
        const pay = job.pay_min ?? job.pay_max;
        if (payFilter === "none") {
          if (pay != null) return false;
        } else {
          const bucket = PAY_BUCKETS.find((b) => b.id === payFilter);
          if (pay == null || !bucket || !bucket.test(pay)) return false;
        }
      }
      return true;
    });
  }, [baseJobs, search, companyFilter, locationFilter, payFilter]);

  const filtersActive =
    search.trim() !== "" ||
    payFilter !== "any" ||
    companyFilter !== "any" ||
    locationFilter !== "any";

  function clearFilters() {
    setSearch("");
    setPayFilter("any");
    setCompanyFilter("any");
    setLocationFilter("any");
  }

  const archiveMutation = useMutation({
    mutationFn: (input: { id: string; archived: boolean }) => archive({ data: input }),
    onSuccess: (_r, v) => {
      toast.success(v.archived ? "Posting archived" : "Posting restored");
      void qc.invalidateQueries({ queryKey: ["jobs"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const addMutation = useMutation({
    mutationFn: (input: { description: string; sourceUrl: string }) => create({ data: input }),
    onSuccess: () => {
      toast.success("Job saved");
      setDescription("");
      setSourceUrl("");
      setOpen(false);
      void qc.invalidateQueries({ queryKey: ["jobs"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => remove({ data: { id } }),
    onSuccess: () => {
      toast.success("Job removed");
      void qc.invalidateQueries({ queryKey: ["jobs"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <JobRecommendations />

      <div className="panel p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold">Jobs</h1>
            <p className="mt-2 max-w-xl text-sm text-muted-foreground">
              Paste a real job posting. JobLanded pulls out the role details, then you can run your
              resume against it and compare tailored versions side by side.
            </p>
          </div>
          <Button
            onClick={() => setOpen((o) => !o)}
            variant={open ? "ghost" : "default"}
            aria-pressed={open}
          >
            {open ? (
              "Cancel"
            ) : (
              <>
                <Plus aria-hidden="true" className="mr-1.5 h-4 w-4" /> Add job
              </>
            )}
          </Button>
        </div>

        {open && (
          <form
            className="mt-6 space-y-4 border-t border-border pt-6"
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              const link = sourceUrl.trim();
              if (!description.trim() && !link) {
                toast.error("Add a job description or a posting link first.");
                return;
              }
              if (link && !isFullUrl(link)) {
                toast.error("That link needs a full address — paste it starting with https://");
                return;
              }
              if (description.trim().length < 80 && !link) {
                toast.error(
                  "Paste the full posting — at least 80 characters — or add a posting link instead.",
                );
                return;
              }
              addMutation.mutate({ description: description.trim(), sourceUrl: link });
            }}
          >
            <div>
              <Label htmlFor="description">Job description</Label>
              <Textarea
                id="description"
                autoFocus
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={10}
                placeholder="Paste the full posting text here…"
                className="mt-1.5"
              />
            </div>
            <div>
              <Label htmlFor="sourceUrl">
                Posting URL {description.trim().length < 80 ? "" : "(optional)"}
              </Label>
              <Input
                id="sourceUrl"
                type="url"
                inputMode="url"
                autoComplete="url"
                value={sourceUrl}
                onChange={(e) => setSourceUrl(e.target.value)}
                placeholder="https://…"
                className="mt-1.5"
              />
              <p className="mt-1.5 text-xs text-muted-foreground">
                No text to paste? Leave the description blank and drop the posting link here instead
                — we'll pull the description from the page.
              </p>
            </div>
            <Button type="submit" disabled={addMutation.isPending}>
              {addMutation.isPending && (
                <Loader2 aria-hidden="true" className="mr-1.5 h-4 w-4 animate-spin" />
              )}
              Save job
            </Button>
          </form>
        )}
      </div>

      <div className="panel p-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-lg font-semibold">
            {showArchived ? "Archived postings" : "Saved postings"}
          </h2>
          {archivedCount > 0 && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setShowArchived((v) => !v)}
              aria-pressed={showArchived}
            >
              {showArchived ? "Back to active" : `Archived (${archivedCount})`}
            </Button>
          )}
        </div>

        <div className="mt-5">
          {jobs.isLoading ? (
            <p className="text-sm text-muted-foreground" role="status">
              Loading your jobs…
            </p>
          ) : jobs.isError ? (
            <div className="flex flex-wrap items-center gap-3">
              <p className="text-sm text-muted-foreground">
                We couldn&apos;t load your postings. Your connection may have dropped.
              </p>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => void jobs.refetch()}
                disabled={jobs.isFetching}
              >
                Try again
              </Button>
            </div>
          ) : baseJobs.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {showArchived
                ? "Nothing archived."
                : "No jobs saved yet. Paste your first posting above to start tailoring against it."}
            </p>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative min-w-0 flex-1 basis-48">
                  <Search
                    className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                    aria-hidden="true"
                  />
                  <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search title, company, location"
                    aria-label="Search saved postings"
                    className="h-9 w-full pl-8"
                  />
                </div>
                {payOptions.buckets.length > 0 && (
                  <Select value={payFilter} onValueChange={setPayFilter}>
                    <SelectTrigger className="h-9 w-40" aria-label="Filter by pay range">
                      <SelectValue placeholder="Pay range" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="any">Any pay</SelectItem>
                      {payOptions.buckets.map((b) => (
                        <SelectItem key={b.id} value={b.id}>
                          {b.label}
                        </SelectItem>
                      ))}
                      {payOptions.noPay && <SelectItem value="none">No pay listed</SelectItem>}
                    </SelectContent>
                  </Select>
                )}
                {companies.length > 1 && (
                  <Select value={companyFilter} onValueChange={setCompanyFilter}>
                    <SelectTrigger className="h-9 w-44" aria-label="Filter by company">
                      <SelectValue placeholder="Company" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="any">All companies</SelectItem>
                      {companies.map(([name, count]) => (
                        <SelectItem key={name} value={name}>
                          {name} ({count})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                {locations.length > 1 && (
                  <Select value={locationFilter} onValueChange={setLocationFilter}>
                    <SelectTrigger className="h-9 w-44" aria-label="Filter by location">
                      <SelectValue placeholder="Location" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="any">All locations</SelectItem>
                      {locations.map(([name, count]) => (
                        <SelectItem key={name} value={name}>
                          {name} ({count})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                {filtersActive && (
                  <Button size="sm" variant="ghost" onClick={clearFilters}>
                    Clear
                  </Button>
                )}
              </div>
              <p className="mt-2 text-xs text-muted-foreground" aria-live="polite">
                {filteredJobs.length} of {baseJobs.length}{" "}
                {baseJobs.length === 1 ? "posting" : "postings"}
              </p>
              {filteredJobs.length === 0 ? (
                <p className="mt-3 text-sm text-muted-foreground">
                  No postings match those filters.{" "}
                  <button
                    type="button"
                    className="text-primary underline underline-offset-4"
                    onClick={clearFilters}
                  >
                    Clear filters
                  </button>
                </p>
              ) : (
                <div className="mt-2 max-h-[560px] overflow-y-auto pr-1">
                  <ul className="divide-y divide-border">
                    {filteredJobs.map((job) => (
                      <li
                        key={job.id}
                        className="flex flex-wrap items-center justify-between gap-3 py-4 first:pt-0 last:pb-0"
                      >
                        <div>
                          <Link
                            to="/jobs/$jobId"
                            params={{ jobId: job.id }}
                            className="font-medium hover:text-primary"
                          >
                            {job.title}
                          </Link>
                          <p className="text-xs text-muted-foreground">
                            {[job.company, job.location].filter(Boolean).join(" · ") ||
                              "No company listed"}
                            {job.pay_min || job.pay_max
                              ? ` · $${(job.pay_min ?? job.pay_max)!.toLocaleString()}${
                                  job.pay_max && job.pay_min
                                    ? `–$${job.pay_max.toLocaleString()}`
                                    : ""
                                }`
                              : ""}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          {!job.archived_at && (
                            <Hint tip="Open this posting to tailor your resume against it and compare versions side by side.">
                              <Button asChild size="sm" variant="secondary">
                                <Link
                                  to="/jobs/$jobId"
                                  params={{ jobId: job.id }}
                                  aria-label={`Tailor resume and compare drafts for ${job.title}`}
                                >
                                  Tailor & compare
                                </Link>
                              </Button>
                            </Hint>
                          )}
                          <Hint tip="Fix the title, company, pay or link we read from this posting.">
                            <Button
                              size="icon"
                              variant="ghost"
                              aria-label={`Edit ${job.title}`}
                              onClick={() => setEditing(job)}
                            >
                              <Pencil aria-hidden="true" className="h-4 w-4" />
                            </Button>
                          </Hint>
                          <Hint
                            tip={
                              job.archived_at
                                ? "Put this posting back in your active list."
                                : "Hide this posting from your active list. Nothing is deleted."
                            }
                          >
                            <Button
                              size="icon"
                              variant="ghost"
                              aria-label={`${job.archived_at ? "Restore" : "Archive"} ${job.title}`}
                              disabled={archiveMutation.isPending}
                              onClick={() =>
                                archiveMutation.mutate({ id: job.id, archived: !job.archived_at })
                              }
                            >
                              {job.archived_at ? (
                                <ArchiveRestore aria-hidden="true" className="h-4 w-4" />
                              ) : (
                                <Archive aria-hidden="true" className="h-4 w-4" />
                              )}
                            </Button>
                          </Hint>
                          <AlertDialog>
                            <Hint tip="Delete this saved job and its tailored versions.">
                              <AlertDialogTrigger asChild>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  aria-label={`Delete ${job.title}`}
                                >
                                  <Trash2 aria-hidden="true" className="h-4 w-4" />
                                </Button>
                              </AlertDialogTrigger>
                            </Hint>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete this job?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  This removes "{job.title}"
                                  {job.company ? ` at ${job.company}` : ""} along with every
                                  tailored resume and cover letter generated for it. This can't be
                                  undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel disabled={deleteMutation.isPending}>
                                  Cancel
                                </AlertDialogCancel>
                                <AlertDialogAction
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                  disabled={deleteMutation.isPending}
                                  onClick={() => deleteMutation.mutate(job.id)}
                                >
                                  {deleteMutation.isPending ? (
                                    <Loader2
                                      aria-hidden="true"
                                      className="mr-1.5 size-4 animate-spin"
                                    />
                                  ) : null}
                                  Delete job
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <EditJobDialog
        job={editing}
        open={Boolean(editing)}
        onOpenChange={(o) => !o && setEditing(null)}
      />
    </div>
  );
}
