import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

/**
 * Confirm dialog shown when someone marks an application as rejected:
 * always sets the rejected status, and optionally archives the posting
 * so it drops out of the active lists.
 */
export function RejectArchiveDialog({
  open,
  onOpenChange,
  jobTitle,
  pending,
  onDecide,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  jobTitle: string;
  pending: boolean;
  /** Called with true when the posting should be archived too. */
  onDecide: (archive: boolean) => void;
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Didn&apos;t get the job?</AlertDialogTitle>
          <AlertDialogDescription>
            This marks &ldquo;{jobTitle}&rdquo; as rejected. You can also archive the posting to
            remove it from your active lists — you can always restore it from the Jobs page.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
          <Button variant="secondary" disabled={pending} onClick={() => onDecide(false)}>
            {pending && <Loader2 aria-hidden="true" className="mr-1.5 h-4 w-4 animate-spin" />}
            Keep in list
          </Button>
          <Button disabled={pending} onClick={() => onDecide(true)}>
            {pending && <Loader2 aria-hidden="true" className="mr-1.5 h-4 w-4 animate-spin" />}
            Archive posting
          </Button>
          {pending && (
            <span className="sr-only" role="status">
              Saving…
            </span>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
