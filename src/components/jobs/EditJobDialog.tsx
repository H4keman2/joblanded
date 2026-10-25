import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { updateJob } from "@/lib/jobs.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

export type EditableJob = {
  id: string;
  title: string;
  company: string | null;
  location: string | null;
  pay_min: number | null;
  pay_max: number | null;
  source_url: string | null;
};

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

export function EditJobDialog({
  job,
  open,
  onOpenChange,
}: {
  job: EditableJob | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const qc = useQueryClient();
  const save = useServerFn(updateJob);

  const [title, setTitle] = useState("");
  const [company, setCompany] = useState("");
  const [location, setLocation] = useState("");
  const [payMin, setPayMin] = useState("");
  const [payMax, setPayMax] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");

  useEffect(() => {
    if (!job) return;
    setTitle(job.title ?? "");
    setCompany(job.company ?? "");
    setLocation(job.location ?? "");
    setPayMin(job.pay_min != null ? String(job.pay_min) : "");
    setPayMax(job.pay_max != null ? String(job.pay_max) : "");
    setSourceUrl(job.source_url ?? "");
  }, [job]);

  const mutation = useMutation({
    mutationFn: (input: {
      id: string;
      title: string;
      company: string;
      location: string;
      pay_min: number | null;
      pay_max: number | null;
      source_url: string;
    }) => save({ data: input }),
    onSuccess: () => {
      toast.success("Posting updated");
      onOpenChange(false);
      void qc.invalidateQueries({ queryKey: ["jobs"] });
      void qc.invalidateQueries({ queryKey: ["job"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toNumber = (v: string) => {
    const digits = v.replace(/[^0-9.]/g, "");
    const n = Number(digits);
    // digits must be non-empty: "abc" strips to "" which Number() turns into 0
    return digits && Number.isFinite(n) ? n : null;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit posting</DialogTitle>
          <DialogDescription>
            Fix anything we read wrong from the posting. This doesn't change the posting text used
            for tailoring.
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            if (!job) return;
            if (!title.trim()) {
              toast.error("Role title can't be blank.");
              return;
            }
            const min = toNumber(payMin);
            if (payMin.trim() && min == null) {
              toast.error("Pay from didn't look like a number — enter digits only.");
              return;
            }

            const max = toNumber(payMax);
            if (payMax.trim() && max == null) {
              toast.error("Pay to didn't look like a number — enter digits only.");
              return;
            }
            if (min != null && max != null && min > max) {
              toast.error("The pay range is flipped — ‘Pay from’ should be lower than ‘Pay to’.");
              return;
            }
            const link = sourceUrl.trim();
            if (link && !isFullUrl(link)) {
              toast.error("That link needs a full address — paste it starting with https://");
              return;
            }
            mutation.mutate({
              id: job.id,
              title: title.trim(),
              company: company.trim(),
              location: location.trim(),
              pay_min: min,
              pay_max: max,
              source_url: sourceUrl.trim(),
            });
          }}
        >
          <div>
            <Label htmlFor="edit-title">Role title</Label>
            <Input
              id="edit-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="mt-1.5"
              required
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="edit-company">Company</Label>
              <Input
                id="edit-company"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                className="mt-1.5"
              />
            </div>
            <div>
              <Label htmlFor="edit-location">Location</Label>
              <Input
                id="edit-location"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                autoComplete="address-level2"
                className="mt-1.5"
              />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="edit-pay-min">Pay from</Label>
              <Input
                id="edit-pay-min"
                inputMode="numeric"
                value={payMin}
                onChange={(e) => setPayMin(e.target.value)}
                placeholder="e.g. 120000"
                className="mt-1.5"
              />
            </div>
            <div>
              <Label htmlFor="edit-pay-max">Pay to</Label>
              <Input
                id="edit-pay-max"
                inputMode="numeric"
                value={payMax}
                onChange={(e) => setPayMax(e.target.value)}
                placeholder="e.g. 150000"
                className="mt-1.5"
              />
            </div>
          </div>
          <div>
            <Label htmlFor="edit-url">Posting link</Label>
            <Input
              id="edit-url"
              type="url"
              inputMode="url"
              autoComplete="url"
              value={sourceUrl}
              onChange={(e) => setSourceUrl(e.target.value)}
              placeholder="https://…"
              className="mt-1.5"
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending && (
                <Loader2 aria-hidden="true" className="mr-1.5 h-4 w-4 animate-spin" />
              )}
              Save changes
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
