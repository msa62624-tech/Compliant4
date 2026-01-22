import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Send, Paperclip, X } from "lucide-react";
import { format } from "date-fns";
import { compliant } from "@/api/compliantClient";
import { useMutation, useQueryClient } from "@tanstack/react-query";

export default function MessageThread({ messages, currentUser, recipientType = "admin" }) {
  const [newMessage, setNewMessage] = useState("");
  const [subject, setSubject] = useState("");
  const [attachments, setAttachments] = useState([]);
  const queryClient = useQueryClient();

  const sendMessageMutation = useMutation({
    mutationFn: (data) => compliant.entities.Message.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries(['messages']);
      setNewMessage("");
      setSubject("");
      setAttachments([]);
    },
  });

  const handleFileSelect = async (e) => {
    const files = Array.from(e.target.files);
    for (const file of files) {
      const result = await compliant.integrations.Core.UploadFile({ file });
      setAttachments([...attachments, result.file_url]);
    }
  };

  const handleSend = async () => {
    if (!newMessage.trim()) return;

    await sendMessageMutation.mutateAsync({
      sender_type: currentUser.user_type || "broker",
      sender_id: currentUser.id,
      sender_name: currentUser.name,
      sender_email: currentUser.email,
      recipient_type: recipientType,
      subject: subject || "Message from Portal",
      message: newMessage,
      attachments,
      status: "unread"
    });
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="border-b">
          <CardTitle>Messages</CardTitle>
        </CardHeader>
        <CardContent className="p-4 max-h-96 overflow-y-auto space-y-3">
          {messages.length === 0 ? (
            <p className="text-center text-slate-500 py-8">No messages yet</p>
          ) : (
            messages.map((msg) => (
              <div
                key={msg.id}
                className={`p-4 rounded-lg ${
                  msg.sender_type === "admin"
                    ? "bg-red-50 border-red-200"
                    : "bg-slate-50 border-slate-200"
                } border`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-900">{msg.sender_name}</span>
                    <Badge variant="outline" className="text-xs">
                      {msg.sender_type}
                    </Badge>
                  </div>
                  <span className="text-xs text-slate-500">
                    {format(new Date(msg.created_date), "MMM d, h:mm a")}
                  </span>
                </div>
                {msg.subject && (
                  <p className="font-semibold text-sm mb-1">{msg.subject}</p>
                )}
                <p className="text-slate-700 text-sm">{msg.message}</p>
                {msg.attachments && msg.attachments.length > 0 && (
                  <div className="mt-2 flex gap-2">
                    {msg.attachments.map((url, idx) => (
                      <a
                        key={`msg-${msg.id}-attachment-${idx}-${url.substring(url.length-10)}`}
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-red-600 hover:underline"
                      >
                        Attachment {idx + 1}
                      </a>
                    ))}
                  </div>
                )}
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="border-b">
          <CardTitle className="text-lg">Send Message</CardTitle>
        </CardHeader>
        <CardContent className="p-4 space-y-3">
          <div className="space-y-2">
            <Label>Subject</Label>
            <Input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Message subject..."
            />
          </div>

          <div className="space-y-2">
            <Label>Message</Label>
            <Textarea
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Type your message..."
              rows={4}
            />
          </div>

          {attachments.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {attachments.map((url, idx) => (
                <Badge key={`new-attachment-${idx}-${url.substring(url.length-10)}`} variant="outline" className="gap-2">
                  Attachment {idx + 1}
                  <button
                    onClick={() => setAttachments(attachments.filter((_, i) => i !== idx))}
                    className="text-red-600 hover:text-red-700"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </Badge>
              ))}
            </div>
          )}

          <div className="flex gap-2">
            <label className="cursor-pointer">
              <input
                type="file"
                multiple
                onChange={handleFileSelect}
                className="hidden"
              />
              <Button type="button" variant="outline" size="sm" asChild>
                <span>
                  <Paperclip className="w-4 h-4 mr-2" />
                  Attach Files
                </span>
              </Button>
            </label>

            <Button
              onClick={handleSend}
              disabled={!newMessage.trim() || sendMessageMutation.isPending}
              className="ml-auto bg-red-600 hover:bg-red-700"
            >
              <Send className="w-4 h-4 mr-2" />
              {sendMessageMutation.isPending ? "Sending..." : "Send Message"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}