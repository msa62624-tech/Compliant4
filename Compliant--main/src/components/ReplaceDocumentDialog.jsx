import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle, Upload, Loader2 } from "lucide-react";
import { replaceApprovedDocument } from "@/documentReplacementUtils";

export default function ReplaceDocumentDialog({
  isOpen,
  onClose,
  document,
  uploadRequestId,
  complianceCheckId,
  projectId,
  subcontractorId,
  brokerEmail,
  brokerName,
  onSuccess
}) {
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async () => {
    if (!reason.trim()) {
      setError('Please provide a reason for replacing this document');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await replaceApprovedDocument({
        documentId: document.id,
        uploadRequestId,
        complianceCheckId,
        projectId,
        subcontractorId,
        brokerEmail,
        brokerName,
        reason: reason.trim()
      });

      // Success!
      if (onSuccess) {
        onSuccess();
      }
      onClose();
    } catch (err) {
      console.error('Error replacing document:', err);
      setError(err.message || 'Failed to replace document. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-500" />
            Replace Approved Document
          </DialogTitle>
          <DialogDescription>
            This will change the subcontractor&apos;s status from <strong>Compliant</strong> to <strong>Pending Review</strong> 
            and notify all General Contractors associated with this project.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <strong>Important:</strong> Replacing this document will:
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>Reset the approval status to &quot;Pending Review&quot;</li>
                <li>Notify all GCs that re-review is required</li>
                <li>Update the compliance check status</li>
              </ul>
            </AlertDescription>
          </Alert>

          <div className="space-y-2">
            <Label htmlFor="reason">
              Reason for Replacement <span className="text-red-500">*</span>
            </Label>
            <Textarea
              id="reason"
              placeholder="Please explain why you are replacing this document (e.g., updated coverage, corrected information, new endorsements)"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={4}
              disabled={isSubmitting}
            />
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting || !reason.trim()}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <Upload className="mr-2 h-4 w-4" />
                Replace Document
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
