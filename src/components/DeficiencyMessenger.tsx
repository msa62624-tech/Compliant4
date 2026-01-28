import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  Send, 
  X, 
  AlertCircle, 
  Loader2,
  FileText,
  Plus} from "lucide-react";
import { apiClient } from "@/api/apiClient";
import { sendEmail } from "@/emailHelper";
import { useQueryClient } from "@tanstack/react-query";

/**
 * DeficiencyMessenger
 * 
 * Allows admin to send deficiency notifications to brokers
 * with attachment support and threading
 * 
 * Props:
 * - coi: Certificate of Insurance object
 * - coiDeficiencies: Array of deficiency objects
 * - broker: Broker object
 * - subcontractor: Subcontractor object
 * - onMessageSent: Callback when message is sent
 */
export default function DeficiencyMessenger({
  coi,
  coiDeficiencies = [],
  broker,
  subcontractor,
  onMessageSent,
}) {
  const [message, setMessage] = useState("");
  const [attachments, setAttachments] = useState([]);
  const [fileUploading, setFileUploading] = useState(false);
  const [sending, setSending] = useState(false);
  const [includeDeficiencies, setIncludeDeficiencies] = useState(true);
  const queryClient = useQueryClient();

  /**
   * Handle file attachment
   */
  const handleAddAttachment = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      alert("File must be smaller than 10MB");
      return;
    }

    setFileUploading(true);
    try {
      const uploadResult = await apiClient.integrations.Core.UploadFile({ file });

      setAttachments([
        ...attachments,
        {
          name: file.name,
          url: uploadResult.file_url,
          size: file.size,
          type: file.type,
        },
      ]);
    } catch (error) {
      console.error("Upload failed:", error);
      alert("Failed to upload file: " + error.message);
    } finally {
      setFileUploading(false);
    }
  };

  /**
   * Remove attachment
   */
  const removeAttachment = (index) => {
    setAttachments(attachments.filter((_, i) => i !== index));
  };

  /**
   * Build message with deficiencies
   */
  const buildMessageWithDeficiencies = () => {
    let fullMessage = message;

    if (includeDeficiencies && coiDeficiencies.length > 0) {
      fullMessage += "\n\n--- CERTIFICATE OF INSURANCE DEFICIENCIES ---\n\n";

      coiDeficiencies.forEach((deficiency, idx) => {
        fullMessage += `${idx + 1}. ${deficiency.title}\n`;
        fullMessage += `   Issue: ${deficiency.description}\n`;

        if (deficiency.required_action) {
          fullMessage += `   Action Required: ${deficiency.required_action}\n`;
        }

        if (deficiency.field) {
          fullMessage += `   Field: ${deficiency.field}\n`;
        }

        if (deficiency.suggested_fix) {
          fullMessage += `   Suggestion: ${deficiency.suggested_fix}\n`;
        }

        fullMessage += "\n";
      });

      fullMessage += "Please resubmit the certificate with corrections.\n";
    }

    return fullMessage;
  };

  /**
   * Send message to broker
   */
  const sendMessage = async () => {
    if (!message.trim() || !broker || !subcontractor) {
      alert("Message and broker/subcontractor required");
      return;
    }

    setSending(true);

    try {
      const fullMessage = buildMessageWithDeficiencies();

      // Create message record
      const messageRecord = await apiClient.entities.Message.create({
        sender_type: "admin",
        sender_id: "admin",
        sender_name: "INsureTrack Admin",
        sender_email: "admin@insuretrack.com",
        recipient_type: "broker",
        recipient_id: broker.id,
        recipient_email: broker.broker_email,
        recipient_name: broker.broker_name,
        subject: `COI Deficiencies - ${subcontractor.name} (${coi?.company_name})`,
        message: fullMessage,
        attachments: attachments.map(a => a.url),
        attachment_metadata: attachments,
        coi_id: coi?.id,
        coiDeficiencies: coiDeficiencies,
        status: "unread",
        thread_id: coi?.message_thread_id,
        created_date: new Date().toISOString(),
      });

      // Send email notification
      const portalLink = `${window.location.origin}/broker-dashboard?name=${encodeURIComponent(broker.broker_name)}&coiId=${coi?.id}&tab=messages`;

      await sendEmail({
        recipient_email: broker.broker_email,
        subject: `ACTION REQUIRED: COI Corrections Needed - ${subcontractor.name}`,
        template: "COI_DEFICIENCIES_EMAIL",
        template_data: {
          broker_name: broker.broker_name,
          subcontractor_name: subcontractor.name,
          company_name: coi?.company_name,
          deficiency_count: coiDeficiencies.length,
          portal_link: portalLink,
          message_preview: message.substring(0, 200),
          deficiencies: coiDeficiencies,
        },
      });

      // Invalidate queries
      queryClient.invalidateQueries({ queryKey: ["messages"] });
      queryClient.invalidateQueries({ queryKey: ["coi-messages", coi?.id] });

      if (onMessageSent) {
        onMessageSent(messageRecord);
      }

      // Reset form
      setMessage("");
      setAttachments([]);
      setIncludeDeficiencies(true);

      alert("Message sent successfully");
    } catch (error) {
      console.error("Send failed:", error);
      alert("Failed to send message: " + error.message);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5" />
            Send Deficiency Notice to Broker
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Recipients Summary */}
          <div className="space-y-3">
            <Label className="text-base font-semibold">Recipients</Label>
            <div className="p-3 bg-slate-50 rounded border border-slate-200 space-y-2">
              <div>
                <p className="text-sm text-slate-600">Broker</p>
                <p className="font-medium">{broker?.broker_name}</p>
                <p className="text-sm text-slate-500">{broker?.broker_email}</p>
              </div>
              <div className="border-t pt-2">
                <p className="text-sm text-slate-600">Subcontractor</p>
                <p className="font-medium">{subcontractor?.name}</p>
                <p className="text-sm text-slate-500">{subcontractor?.email}</p>
              </div>
            </div>
          </div>

          {/* Deficiencies Summary */}
          {coiDeficiencies.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-base font-semibold">
                  Deficiencies Found ({coiDeficiencies.length})
                </Label>
                <input
                  type="checkbox"
                  id="include-deficiencies"
                  checked={includeDeficiencies}
                  onChange={(e) => setIncludeDeficiencies(e.target.checked)}
                  className="cursor-pointer"
                />
                <label
                  htmlFor="include-deficiencies"
                  className="text-sm cursor-pointer"
                >
                  Include in message
                </label>
              </div>

              <div className="space-y-2 max-h-48 overflow-y-auto">
                {coiDeficiencies.map((def, idx) => (
                  <div
                    key={idx}
                    className={`p-3 rounded border ${
                      def.severity === "critical"
                        ? "bg-red-50 border-red-200"
                        : def.severity === "high"
                        ? "bg-orange-50 border-orange-200"
                        : "bg-amber-50 border-amber-200"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-sm">{def.title}</p>
                          <Badge
                            variant="outline"
                            className="text-xs whitespace-nowrap"
                          >
                            {def.severity}
                          </Badge>
                        </div>
                        <p className="text-sm text-slate-600 mt-1">
                          {def.description}
                        </p>
                        {def.required_action && (
                          <p className="text-sm text-slate-700 font-medium mt-1">
                            Action: {def.required_action}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Message Composer */}
          <div className="space-y-3">
            <Label htmlFor="message" className="text-base font-semibold">
              Admin Message to Broker
            </Label>
            <Textarea
              id="message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Write instructions or additional context for the broker..."
              className="h-32"
            />
          </div>

          {/* Attachments */}
          <div className="space-y-3">
            <Label className="text-base font-semibold">Attachments</Label>

            {/* Attachment List */}
            {attachments.length > 0 && (
              <div className="space-y-2">
                {attachments.map((attachment, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-2 bg-slate-50 rounded border border-slate-200"
                  >
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <FileText className="w-4 h-4 text-slate-600 flex-shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">
                          {attachment.name}
                        </p>
                        <p className="text-xs text-slate-500">
                          {(attachment.size / 1024).toFixed(2)} KB
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => removeAttachment(idx)}
                      className="p-1 hover:bg-slate-200 rounded transition"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* File Upload Button */}
            <div>
              <input
                type="file"
                id="file-input"
                onChange={handleAddAttachment}
                disabled={fileUploading}
                className="hidden"
                accept=".pdf,.doc,.docx,.jpg,.png,.xls,.xlsx"
              />
              <label htmlFor="file-input">
                <Button
                  variant="outline"
                  className="w-full cursor-pointer"
                  disabled={fileUploading}
                  asChild
                >
                  <span>
                    {fileUploading ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Uploading...
                      </>
                    ) : (
                      <>
                        <Plus className="w-4 h-4 mr-2" />
                        Add Attachment (PDF, Word, Excel, Image)
                      </>
                    )}
                  </span>
                </Button>
              </label>
            </div>

            <p className="text-xs text-slate-500">
              Max file size: 10MB. Supported: PDF, DOC, DOCX, XLS, XLSX, JPG, PNG
            </p>
          </div>

          {/* Message Preview */}
          {message && (
            <div className="space-y-2">
              <Label className="text-sm font-semibold">Message Preview</Label>
              <div className="p-4 bg-slate-50 rounded border border-slate-200 text-sm whitespace-pre-wrap font-mono max-h-40 overflow-y-auto">
                {buildMessageWithDeficiencies()}
              </div>
            </div>
          )}

          {/* Send Button */}
          <div className="flex gap-2">
            <Button
              onClick={sendMessage}
              disabled={!message.trim() || sending}
              className="ml-auto"
            >
              {sending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4 mr-2" />
                  Send Message
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Threading Info */}
      {coi?.message_thread_id && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            This message will be added to an existing thread with the broker.
            They will receive a notification and can reply directly.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
