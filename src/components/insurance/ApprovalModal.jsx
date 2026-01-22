import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { CheckCircle2, XCircle } from "lucide-react";

export default function ApprovalModal({ document, isOpen, onClose, onApprove, onReject }) {
  const [notes, setNotes] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const handleApprove = async () => {
    setIsProcessing(true);
    await onApprove(document, notes);
    setIsProcessing(false);
    setNotes('');
    onClose();
  };

  const handleReject = async () => {
    if (!rejectionReason.trim()) {
      alert('Please provide a reason for rejection');
      return;
    }
    setIsProcessing(true);
    await onReject(document, rejectionReason);
    setIsProcessing(false);
    setRejectionReason('');
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">Review Insurance Document</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-slate-500 mb-1">Contractor</p>
              <p className="font-medium text-slate-900">{document?.contractor_name}</p>
            </div>
            <div>
              <p className="text-slate-500 mb-1">Insurance Type</p>
              <p className="font-medium text-slate-900">
                {document?.insurance_type?.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
              </p>
            </div>
            <div>
              <p className="text-slate-500 mb-1">Policy Number</p>
              <p className="font-medium text-slate-900">{document?.policy_number}</p>
            </div>
            <div>
              <p className="text-slate-500 mb-1">Provider</p>
              <p className="font-medium text-slate-900">{document?.insurance_provider}</p>
            </div>
            <div>
              <p className="text-slate-500 mb-1">Coverage Amount</p>
              <p className="font-medium text-slate-900">
                ${document?.coverage_amount?.toLocaleString()}
              </p>
            </div>
            <div>
              <p className="text-slate-500 mb-1">Expires</p>
              <p className="font-medium text-slate-900">
                {document?.expiration_date ? new Date(document.expiration_date).toLocaleDateString() : 'N/A'}
              </p>
            </div>
          </div>

          <div className="border-t pt-4">
            <a
              href={document?.document_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-red-600 hover:text-red-700 font-medium underline text-sm"
            >
              View Certificate Document →
            </a>
          </div>

          <div className="space-y-4 border-t pt-4">
            <div>
              <Label htmlFor="notes">Admin Notes (Optional)</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add any notes about this insurance document..."
                className="mt-2 min-h-20"
              />
            </div>

            <div>
              <Label htmlFor="rejection">Rejection Reason (Required if rejecting)</Label>
              <Textarea
                id="rejection"
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="Explain why this document is being rejected..."
                className="mt-2 min-h-20"
              />
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={handleReject}
            disabled={isProcessing || !rejectionReason.trim()}
            className="border-red-200 text-red-700 hover:bg-red-50"
          >
            <XCircle className="w-4 h-4 mr-2" />
            Reject
          </Button>
          <Button
            onClick={handleApprove}
            disabled={isProcessing}
            className="bg-emerald-600 hover:bg-emerald-700"
          >
            <CheckCircle2 className="w-4 h-4 mr-2" />
            Approve
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}