import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { addJob, deleteJob, listJobs } from "@/lib/jobs.functions";
import { JobRecommendations } from "@/components/jobs/JobRecommendations";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Hint } from "@/components/ui/hint";
import { toast } from "sonner";
import { Loader2, Plus, Trash2 } from "lucide-react";

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

  const [description, setDescription] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [open, setOpen] = useState(false);

  const jobs = useQuery({ queryKey: ["jobs"], queryFn: () => fetchJobs() });

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
      <div className="panel p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold">Jobs</h1>
            <p className="mt-2 max-w-xl text-sm text-muted-foreground">
              Paste a real job posting. JobLanded pulls out the role details, then you can run your
              resume against it and compare tailored versions side by side.
            </p>
          </div>
          <Button onClick={() => setOpen((o) => !o)} variant={open ? "ghost" : "default"}>
            {open ? (
              "Cancel"
            ) : (
              <>
                <Plus className="mr-1.5 h-4 w-4" /> Add job
              </>
            )}
          </Button>
        </div>

        {open && (
          <form
            className="mt-6 space-y-4 border-t border-border pt-6"
            onSubmit={(e) => {
              e.preventDefault();
              addMutation.mutate({ description, sourceUrl });
            }}
          >
            <div>
              <Label htmlFor="description">Job description</Label>
              <Textarea
                id="description"
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
              {addMutation.isPending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
              Save job
            </Button>
          </form>
        )}
      </div>

      <JobRecommendations />

      <div className="panel p-8">
        {jobs.isLoading ? (
          <p className="text-sm text-muted-foreground">Loading your jobs…</p>
        ) : (jobs.data?.length ?? 0) === 0 ? (
          <p className="text-sm text-muted-foreground">
            No jobs saved yet. Paste your first posting above to start tailoring against it.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {jobs.data!.map((job) => (
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
                    {[job.company, job.location].filter(Boolean).join(" · ") || "No company listed"}
                    {job.pay_min || job.pay_max
                      ? ` · $${(job.pay_min ?? job.pay_max)!.toLocaleString()}${
                          job.pay_max && job.pay_min ? `–$${job.pay_max.toLocaleString()}` : ""
                        }`
                      : ""}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button asChild size="sm" variant="secondary">
                    <Link to="/jobs/$jobId" params={{ jobId: job.id }}>
                      Tailor & compare
                    </Link>
                  </Button>
                  <Hint tip="Delete this saved job and its tailored versions.">
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label={`Delete ${job.title}`}
                      onClick={() => deleteMutation.mutate(job.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </Hint>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
