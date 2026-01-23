import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/api/apiClient";
import { sendEmail } from "@/emailHelper";
import { generateSecurePassword, formatLoginCredentialsForEmail, createUserCredentials } from "@/passwordUtils";
import { getFrontendBaseUrl } from "@/urlConfig";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Trash2, Plus } from "lucide-react";
import { toast } from "sonner";

export default function BrokerInfoForm({ subcontractor, subId }) {
  const queryClient = useQueryClient();
  const [brokers, setBrokers] = useState([]);
  const [newBroker, setNewBroker] = useState({
    name: "",
    email: "",
    phone: "",
    company: "",
    policies: {
      gl: false,
      auto: false,
      wc: false,
      umbrella: false,
    },
  });

  // Load existing brokers from subcontractor data on mount
  useEffect(() => {
    if (!subcontractor) return;
    
    // If using old global model, convert to new multi-broker model
    if (subcontractor.broker_email && !Array.isArray(subcontractor.brokers)) {
      // Legacy: single broker for all policies
      setBrokers([{
        name: subcontractor.broker_name || "",
        email: subcontractor.broker_email || "",
        phone: subcontractor.broker_phone || "",
        company: subcontractor.broker_company || "",
        policies: { gl: true, auto: true, wc: true, umbrella: true },
      }]);
    } else if (Array.isArray(subcontractor.brokers)) {
      // New multi-broker model
      setBrokers(subcontractor.brokers);
    } else {
      setBrokers([]);
    }
  }, [subcontractor?.id]);

  const updateSubcontractorMutation = useMutation({
    mutationFn: ({ id, data }) => apiClient.entities.Contractor.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(["subcontractor", subId]);
      toast.success("Brokers saved successfully!");
    },
    onError: (err) => {
      toast.error(err?.message || "Failed to save brokers");
    }
  });

  const handleAddBroker = async (e) => {
    e.preventDefault();
    if (!newBroker.name || !newBroker.email) {
      toast.error("Please provide broker name and email");
      return;
    }
    if (!newBroker.email.includes("@")) {
      toast.error("Please provide a valid email address");
      return;
    }
    const hasAnyPolicy = Object.values(newBroker.policies).some(v => v);
    if (!hasAnyPolicy) {
      toast.error("Please select at least one policy for this broker");
      return;
    }

    // Add broker to list
    const updatedBrokers = [...brokers, { ...newBroker }];
    setBrokers(updatedBrokers);
    setNewBroker({ name: "", email: "", phone: "", company: "", policies: { gl: false, auto: false, wc: false, umbrella: false } });
    toast.success("Broker added to list");
  };

  const handleRemoveBroker = (index) => {
    setBrokers(brokers.filter((_, i) => i !== index));
    toast.success("Broker removed");
  };

  const handleSaveAll = async () => {
    if (brokers.length === 0) {
      toast.error("Please add at least one broker");
      return;
    }

    // Save brokers list to subcontractor
    await updateSubcontractorMutation.mutateAsync({
      id: subcontractor.id,
      data: { brokers },
    });

    // Notify each broker with credentials and assigned policies
    try {
      const baseUrl = getFrontendBaseUrl();
      const brokerDashboardLink = `${baseUrl}/broker-dashboard`;

      for (const broker of brokers) {
        const password = generateSecurePassword();
        const assignedPolicies = Object.entries(broker.policies)
          .filter(([_, selected]) => selected)
          .map(([policy]) => {
            const labels = { gl: "General Liability", auto: "Auto Liability", wc: "Workers Compensation", umbrella: "Umbrella" };
            return labels[policy];
          })
          .join(", ");

        const loginInfo = formatLoginCredentialsForEmail(
          broker.email,
          password,
          brokerDashboardLink,
          brokerDashboardLink
        );

        try {
          await sendEmail({
            to: broker.email,
            subject: `Insurance Broker Account Setup - ${subcontractor.company_name}`,
            body: `Hello ${broker.name || ""},\n\nYou have been designated as the insurance broker for ${subcontractor.company_name}.\n\nAssigned Policies: ${assignedPolicies}\n\n${loginInfo}\n\nYou can manage all COI requests through your dashboard.\n\nThank you.`
          });
        } catch (emailErr) {
          console.error(`Failed to email ${broker.email}:`, emailErr);
        }

        try {
          const userCredentials = createUserCredentials(
            broker.email,
            broker.name || broker.email,
            'broker',
            {}
          );
          userCredentials.password = password;
          await apiClient.entities.User.create(userCredentials);
        } catch (_userError) {
          // User may already exist - that's fine
        }
      }
      
      toast.success("All brokers notified and saved");
    } catch (err) {
      console.error("Failed to notify broker(s):", err);
      toast.error("Brokers saved but notification may have failed");
    }
  };

  return (
    <Card className="border-amber-200 bg-amber-50 shadow-md">
      <CardHeader>
        <CardTitle className="text-amber-900 flex items-center gap-2">
          <AlertTriangle className="w-5 h-5" />
          {brokers.length > 0 ? "Your Insurance Brokers" : "Action Required: Add Your Insurance Brokers"}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-amber-900">
          {brokers.length > 0 
            ? "Manage your assigned brokers. You can add additional brokers or remove existing ones."
            : "To proceed with your projects, please provide your insurance broker information. You can assign different brokers to different policy types (e.g., Broker A for GL, Broker B for Umbrella)."}
        </p>

        {/* Add Broker Form */}
        <div className="border-t pt-4 mt-4 space-y-4">
          <h4 className="font-semibold text-slate-900">Add New Broker</h4>
          <div className="space-y-3">
            <div className="grid md:grid-cols-2 gap-3">
              <Input
                placeholder="Broker Name *"
                value={newBroker.name}
                onChange={(e) => setNewBroker({ ...newBroker, name: e.target.value })}
              />
              <Input
                type="email"
                placeholder="Broker Email *"
                value={newBroker.email}
                onChange={(e) => setNewBroker({ ...newBroker, email: e.target.value })}
              />
            </div>
            <div className="grid md:grid-cols-2 gap-3">
              <Input
                placeholder="Broker Phone"
                value={newBroker.phone}
                onChange={(e) => setNewBroker({ ...newBroker, phone: e.target.value })}
              />
              <Input
                placeholder="Broker Company"
                value={newBroker.company}
                onChange={(e) => setNewBroker({ ...newBroker, company: e.target.value })}
              />
            </div>
            <div>
              <Label className="text-sm font-semibold mb-2 block">Select Policies This Broker Handles *</Label>
              <div className="grid grid-cols-2 gap-3">
                <label className="flex items-center gap-2 cursor-pointer p-2 border rounded hover:bg-amber-100">
                  <input
                    type="checkbox"
                    checked={newBroker.policies.gl}
                    onChange={(e) => setNewBroker({ ...newBroker, policies: { ...newBroker.policies, gl: e.target.checked } })}
                  />
                  <span className="text-sm">General Liability (GL)</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer p-2 border rounded hover:bg-amber-100">
                  <input
                    type="checkbox"
                    checked={newBroker.policies.auto}
                    onChange={(e) => setNewBroker({ ...newBroker, policies: { ...newBroker.policies, auto: e.target.checked } })}
                  />
                  <span className="text-sm">Auto Liability</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer p-2 border rounded hover:bg-amber-100">
                  <input
                    type="checkbox"
                    checked={newBroker.policies.wc}
                    onChange={(e) => setNewBroker({ ...newBroker, policies: { ...newBroker.policies, wc: e.target.checked } })}
                  />
                  <span className="text-sm">Workers Compensation (WC)</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer p-2 border rounded hover:bg-amber-100">
                  <input
                    type="checkbox"
                    checked={newBroker.policies.umbrella}
                    onChange={(e) => setNewBroker({ ...newBroker, policies: { ...newBroker.policies, umbrella: e.target.checked } })}
                  />
                  <span className="text-sm">Umbrella</span>
                </label>
              </div>
            </div>
            <Button
              onClick={handleAddBroker}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Broker to List
            </Button>
          </div>
        </div>

        {/* Broker List */}
        {brokers.length > 0 && (
          <div className="border-t pt-4 mt-4 space-y-3">
            <h4 className="font-semibold text-slate-900">Assigned Brokers ({brokers.length})</h4>
            {brokers.map((broker, idx) => (
              <div key={idx} className="flex items-start justify-between p-3 bg-white rounded-lg border border-slate-200 shadow-sm">
                <div className="flex-1">
                  <p className="font-medium text-slate-900">{broker.name || "Unnamed"}</p>
                  <p className="text-sm text-slate-600">{broker.email}</p>
                  {broker.phone && <p className="text-sm text-slate-600">{broker.phone}</p>}
                  <div className="mt-2 flex flex-wrap gap-1">
                    {broker.policies.gl && <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded font-medium">GL</span>}
                    {broker.policies.auto && <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded font-medium">Auto</span>}
                    {broker.policies.wc && <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded font-medium">WC</span>}
                    {broker.policies.umbrella && <span className="text-xs bg-purple-100 text-purple-800 px-2 py-1 rounded font-medium">Umbrella</span>}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleRemoveBroker(idx)}
                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                  title="Remove this broker"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            ))}
          </div>
        )}

        {/* Save All Button */}
        {brokers.length > 0 && (
          <div className="flex justify-end mt-4 pt-4 border-t">
            <Button
              onClick={handleSaveAll}
              disabled={updateSubcontractorMutation.isPending}
              className="bg-amber-600 hover:bg-amber-700 text-white"
            >
              {updateSubcontractorMutation.isPending ? "Saving..." : `Save & Notify ${brokers.length} Broker${brokers.length !== 1 ? 's' : ''}`}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
