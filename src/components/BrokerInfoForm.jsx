import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/api/apiClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";
import { toast } from "sonner";

export default function BrokerInfoForm({ subcontractor, subId }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    broker_name: "",
    broker_email: "",
    broker_phone: "",
    broker_company: "",
  });

  const updateSubcontractorMutation = useMutation({
    mutationFn: ({ id, data }) => apiClient.entities.Contractor.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(["subcontractor", subId]);
      toast.success("Broker information saved successfully!");
    },
    onError: (err) => {
      toast.error(err?.message || "Failed to save broker information");
    }
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.broker_name || !form.broker_email) {
      toast.error("Please provide broker name and email");
      return;
    }

    await updateSubcontractorMutation.mutateAsync({
      id: subcontractor.id,
      data: {
        broker_name: form.broker_name,
        broker_email: form.broker_email,
        broker_phone: form.broker_phone,
        broker_company: form.broker_company,
      },
    });
  };

  return (
    <Card className="border-amber-200 bg-amber-50 shadow-md">
      <CardHeader>
        <CardTitle className="text-amber-900 flex items-center gap-2">
          <AlertTriangle className="w-5 h-5" />
          Action Required: Add Your Insurance Broker
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-amber-900">
          To proceed with your projects, please provide your insurance broker&apos;s information.
        </p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label>Broker Name *</Label>
              <Input
                value={form.broker_name}
                onChange={(e) => setForm({ ...form, broker_name: e.target.value })}
                placeholder="John Smith"
                required
              />
            </div>
            <div className="space-y-1">
              <Label>Broker Email *</Label>
              <Input
                type="email"
                value={form.broker_email}
                onChange={(e) => setForm({ ...form, broker_email: e.target.value })}
                placeholder="broker@insurance.com"
                required
              />
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label>Broker Phone</Label>
              <Input
                value={form.broker_phone}
                onChange={(e) => setForm({ ...form, broker_phone: e.target.value })}
                placeholder="(555) 123-4567"
              />
            </div>
            <div className="space-y-1">
              <Label>Broker Company</Label>
              <Input
                value={form.broker_company}
                onChange={(e) => setForm({ ...form, broker_company: e.target.value })}
                placeholder="ABC Insurance Agency"
              />
            </div>
          </div>

          <div className="flex justify-end">
            <Button 
              type="submit" 
              disabled={updateSubcontractorMutation.isPending}
              className="bg-amber-600 hover:bg-amber-700"
            >
              {updateSubcontractorMutation.isPending ? "Saving..." : "Save Broker Info"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
