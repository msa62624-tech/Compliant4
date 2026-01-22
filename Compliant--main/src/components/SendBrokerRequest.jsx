import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function SendBrokerRequestDialog({ 
  open, 
  onOpenChange, 
  projectId: _projectId, 
  subcontractorId: _subcontractorId,
  onRequestSent 
}) {
  const [formData, setFormData] = useState({
    broker_email: '',
    subcontractor_name: '',
    message: '',
    priority: 'normal'
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    // Handle broker request submission
    if (onRequestSent) {
      onRequestSent(formData);
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[525px]">
        <DialogHeader>
          <DialogTitle>Request COI from Broker</DialogTitle>
          <DialogDescription>
            Send a COI request email to the broker with optional instructions.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="broker_email">Broker Email</Label>
            <Input
              id="broker_email"
              type="email"
              value={formData.broker_email}
              onChange={(e) => setFormData({ ...formData, broker_email: e.target.value })}
              placeholder="broker@insurance.com"
              required
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="subcontractor_name">Subcontractor Name</Label>
            <Input
              id="subcontractor_name"
              value={formData.subcontractor_name}
              onChange={(e) => setFormData({ ...formData, subcontractor_name: e.target.value })}
              placeholder="Company Name"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="priority">Priority</Label>
            <Select 
              value={formData.priority}
              onValueChange={(value) => setFormData({ ...formData, priority: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="normal">Normal</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="urgent">Urgent</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="message">Message (Optional)</Label>
            <Textarea
              id="message"
              value={formData.message}
              onChange={(e) => setFormData({ ...formData, message: e.target.value })}
              placeholder="Additional instructions or requirements..."
              rows={4}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit">Send Request</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
