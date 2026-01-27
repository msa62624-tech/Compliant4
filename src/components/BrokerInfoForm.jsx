import { getFrontendBaseUrl, getBackendBaseUrl, createBrokerUploadLink, createBrokerDashboardLink } from "@/urlConfig";
import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/api/apiClient";
import { sendEmail } from "@/emailHelper";
import { createUserCredentials, generateSecurePassword } from "@/passwordUtils";
import { notifyAdminBrokerChanged } from "@/coiNotifications";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Trash2, Plus, Edit2 } from "lucide-react";
import { toast } from "sonner";

export default function BrokerInfoForm({ subcontractor, subId }) {
  const queryClient = useQueryClient();
  const [brokers, setBrokers] = useState([]);
  const [editingIndex, setEditingIndex] = useState(null);
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
  }, [subcontractor?.id, subcontractor]);

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

    // Check if any selected policy is already assigned to another broker
    const currentAssigned = getAssignedPolicies();
    const conflictingPolicies = Object.entries(newBroker.policies)
      .filter(([policy, isSelected]) => isSelected && currentAssigned[policy])
      .map(([policy]) => {
        const labels = { gl: "GL", auto: "Auto", wc: "WC", umbrella: "Umbrella" };
        return labels[policy];
      });

    if (conflictingPolicies.length > 0) {
      toast.error(`${conflictingPolicies.join(", ")} already assigned to another broker`);
      return;
    }

    // If editing, update in place
    if (editingIndex !== null) {
      const updatedBrokers = [...brokers];
      updatedBrokers[editingIndex] = { ...newBroker };
      setBrokers(updatedBrokers);
      setEditingIndex(null);
      setNewBroker({ name: "", email: "", phone: "", company: "", policies: { gl: false, auto: false, wc: false, umbrella: false } });
      toast.success("Broker updated");
    } else {
      // Add new broker to list
      const updatedBrokers = [...brokers, { ...newBroker }];
      setBrokers(updatedBrokers);
      setNewBroker({ name: "", email: "", phone: "", company: "", policies: { gl: false, auto: false, wc: false, umbrella: false } });
      toast.success("Broker added to list");
    }
  };

  const handleEditBroker = (index) => {
    setEditingIndex(index);
    setNewBroker({ ...brokers[index] });
  };

  const handleCancelEdit = () => {
    setEditingIndex(null);
    setNewBroker({ name: "", email: "", phone: "", company: "", policies: { gl: false, auto: false, wc: false, umbrella: false } });
  };

  // Get policies already assigned to other brokers (for disabling checkboxes)
  const getAssignedPolicies = () => {
    const assigned = { gl: false, auto: false, wc: false, umbrella: false };
    brokers.forEach((broker, idx) => {
      // Skip current broker if editing
      if (editingIndex !== null && idx === editingIndex) return;
      
      Object.entries(broker.policies).forEach(([policy, isAssigned]) => {
        if (isAssigned) {
          assigned[policy] = true;
        }
      });
    });
    return assigned;
  };

  const assignedPolicies = getAssignedPolicies();

  const handleRemoveBroker = (index) => {
    setBrokers(brokers.filter((_, i) => i !== index));
    toast.success("Broker removed");
  };

  const handleSaveAll = async () => {
    if (brokers.length === 0) {
      toast.error("Please add at least one broker");
      return;
    }

    // Load projects for this subcontractor to include GC + job location
    let projects = [];
    try {
      const projectsResponse = await apiClient.api.get(`/public/projects-for-sub/${subcontractor.id}`);
      projects = Array.isArray(projectsResponse) ? projectsResponse : [];
    } catch (_projErr) {
      projects = [];
    }
    const primaryProject = projects
      .slice()
      .sort((a, b) => new Date(b.createdAt || b.created_date || 0) - new Date(a.createdAt || a.created_date || 0))[0] || null;
    const projectLocation = primaryProject
      ? `${primaryProject.address || ''}, ${primaryProject.city || ''}, ${primaryProject.state || ''} ${primaryProject.zip_code || ''}`.replace(/\s+,/g, ',').replace(/,\s*,/g, ',').trim()
      : (subcontractor.address || subcontractor.city || subcontractor.company_name);
    const gcName = primaryProject?.gc_name || subcontractor.gc_name || subcontractor.company_name;
    const gcMailingAddress = primaryProject
      ? `${primaryProject.gc_address || ''}, ${primaryProject.gc_city || ''}, ${primaryProject.gc_state || ''} ${primaryProject.gc_zip || ''}`.replace(/\s+,/g, ',').replace(/,\s*,/g, ',').trim()
      : '';

    // Detect if brokers changed by comparing with existing
    const existingBrokers = Array.isArray(subcontractor.brokers) ? subcontractor.brokers : [];
    const brokersChanged = JSON.stringify(existingBrokers) !== JSON.stringify(brokers);

    // Save brokers list to subcontractor
    await updateSubcontractorMutation.mutateAsync({
      id: subcontractor.id,
      data: { brokers },
    });

    // If brokers were changed, notify admin and generate new COI/policy requests
    if (brokersChanged) {
      try {
        // Notify admin of broker change
        await notifyAdminBrokerChanged(subcontractor, brokers, existingBrokers, projects);
        toast.success("Admin notified of broker change");
      } catch (err) {
        console.error("Failed to notify admin of broker change:", err);
        toast.warning("Brokers saved but admin notification may have failed");
      }
    }

    // Notify each broker with login credentials and assigned policies
    // BUT: Only for newly added brokers, not existing ones
    try {
      const baseUrl = getFrontendBaseUrl();
      const backendBase = getBackendBaseUrl();
      const brokerLoginLink = `${baseUrl}/broker-login`;
      const existingBrokerEmails = new Set(existingBrokers.map(b => b.email?.toLowerCase()));

      for (const broker of brokers) {
        // Only process if this is a new broker (not in existing list)
        const isNewBroker = !existingBrokerEmails.has(broker.email?.toLowerCase());
        
        if (!isNewBroker) {
          console.log(`ℹ️ Broker ${broker.email} already exists - skipping password generation and initial email`);
          continue;
        }

        // ONLY generate password for NEW brokers on first assignment
        const password = generateSecurePassword();
        const brokerDashboardLink = createBrokerDashboardLink(broker.name, broker.email);
        // Generate a token up front so email link, upload request, and GeneratedCOI all align
        const uploadToken = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2, 10);
        const brokerUploadLink = createBrokerUploadLink(uploadToken, 1);
        const assignedPolicies = Object.entries(broker.policies)
          .filter(([_, selected]) => selected)
          .map(([policy]) => {
            const labels = { gl: "General Liability", auto: "Auto Liability", wc: "Workers Compensation", umbrella: "Umbrella" };
            return labels[policy];
          })
          .join(", ") || (subcontractor.trade_types?.join(', ') || 'General Construction');
        const projectName = primaryProject?.project_name || subcontractor.company_name;

        try {
          await sendEmail({
            to: broker.email,
            subject: `Insurance Broker Account Setup - ${subcontractor.company_name}`,
            body: `Hello ${broker.name || ""},\n\nYou have been designated as the insurance broker for ${subcontractor.company_name}.\n\nAssigned Policies: ${assignedPolicies}\n\nLOGIN CREDENTIALS:\nEmail: ${broker.email}\nPassword: ${password}\n\nQuick Actions:\n- Upload insurance for this subcontractor: ${brokerUploadLink}\n- Access your broker dashboard: ${brokerDashboardLink}\n- Login page (same credentials): ${brokerLoginLink}\n\nYou can manage all COI requests through your dashboard. Change your password in account settings after logging in.\n\nThank you.`,
            includeSampleCOI: true,
            recipientIsBroker: true,
            sampleCOIData: {
              trade: assignedPolicies || 'General Construction',
              program: primaryProject?.program_name || primaryProject?.program_id || subcontractor.program_name || subcontractor.program_id || 'Standard Program',
              program_id: primaryProject?.program_id,
              gc_name: gcName,
              gc_mailing_address: gcMailingAddress,
              project_name: projectName,
              projectAddress: projectLocation,
              certificate_holder: gcName,
              additional_insureds: [gcName].filter(Boolean),
              insured_name: subcontractor.company_name,
            }
          });
        } catch (emailErr) {
          console.error(`Failed to email ${broker.email}:`, emailErr);
        }

        try {
          // Create broker user with generated password
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

        try {
          // Create a pending upload request so the broker sees it in their portal
          await apiClient.entities.BrokerUploadRequest.create({
            broker_email: broker.email,
            broker_name: broker.name,
            broker_company: broker.company,
            subcontractor_id: subId,
            subcontractor_name: subcontractor.company_name,
            project_id: primaryProject?.id || null,
            project_name: primaryProject?.project_name || null,
            status: 'pending',
            sent_date: new Date().toISOString(),
            upload_token: uploadToken,
          });

          // Create a minimal GeneratedCOI record so the upload link works with the token
          await apiClient.entities.GeneratedCOI.create({
            coi_token: uploadToken,
            status: 'awaiting_broker_upload',
            broker_email: broker.email,
            broker_name: broker.name,
            broker_company: broker.company,
            subcontractor_id: subId,
            subcontractor_name: subcontractor.company_name,
            project_id: primaryProject?.id || null,
            project_name: primaryProject?.project_name || projectName,
            project_address: projectLocation,
            gc_name: gcName,
            certificate_holder: gcName,
            certificate_holder_address: gcMailingAddress || null,
            trade_type: assignedPolicies,
            created_date: new Date().toISOString(),
          });
        } catch (uploadErr) {
          console.error(`Failed to create broker upload request for ${broker.email}:`, uploadErr);
        }

        try {
          // Set the broker password in the backend so they can log in with the generated password
          await apiClient.api.post('/admin/set-broker-password', {
            email: broker.email,
            password: password
          });
        } catch (passwordErr) {
          console.error(`Failed to set password for broker ${broker.email}:`, passwordErr);
          toast.warning(`Password for ${broker.email} may not be set - they may need password reset`);
        }
      }

      // Always create a fresh COI request for the current project so brokers (including existing) receive a sample COI
      if (primaryProject?.id) {
        for (const broker of brokers) {
          if (!broker.email) continue;
          Object.entries(broker.policies)
            .filter(([_, selected]) => selected)
            .map(([policy]) => {
              const labels = { gl: "General Liability", auto: "Auto Liability", wc: "Workers Compensation", umbrella: "Umbrella" };
              return labels[policy];
            })
            .join(", ") || (subcontractor.trade_types?.join(', ') || 'General Construction');
          const tradeForRequirements = Array.isArray(subcontractor.trade_types) && subcontractor.trade_types.length > 0
            ? subcontractor.trade_types.join(', ')
            : (primaryProject?.trade_type || subcontractor.trade_type || 'General Construction');

          try {
            await fetch(`${backendBase}/public/create-coi-request`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                project_id: primaryProject.id,
                project_name: primaryProject.project_name,
                gc_id: primaryProject.gc_id,
                gc_name: primaryProject.gc_name,
                subcontractor_id: subcontractor.id,
                subcontractor_name: subcontractor.company_name,
                trade_type: tradeForRequirements,
                project_sub_id: primaryProject.project_sub_id || undefined,
                broker_email: broker.email,
                broker_name: broker.name,
                contact_email: broker.email,
                certificate_holder: primaryProject.gc_name,
                certificate_holder_address: gcMailingAddress || undefined,
                additional_insureds: [primaryProject.gc_name].filter(Boolean),
                project_location: projectLocation
              })
            });
          } catch (reqErr) {
            console.error(`Failed to create COI request for ${broker.email}:`, reqErr);
          }
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
                <label className={`flex items-center gap-2 cursor-pointer p-2 border rounded hover:bg-amber-100 ${assignedPolicies.gl && !newBroker.policies.gl ? 'opacity-50 cursor-not-allowed bg-gray-50' : ''}`}>
                  <input
                    type="checkbox"
                    disabled={assignedPolicies.gl && !newBroker.policies.gl}
                    checked={newBroker.policies.gl}
                    onChange={(e) => setNewBroker({ ...newBroker, policies: { ...newBroker.policies, gl: e.target.checked } })}
                  />
                  <span className="text-sm">General Liability (GL)</span>
                  {assignedPolicies.gl && !newBroker.policies.gl && <span className="text-xs text-gray-500 ml-auto">Assigned</span>}
                </label>
                <label className={`flex items-center gap-2 cursor-pointer p-2 border rounded hover:bg-amber-100 ${assignedPolicies.auto && !newBroker.policies.auto ? 'opacity-50 cursor-not-allowed bg-gray-50' : ''}`}>
                  <input
                    type="checkbox"
                    disabled={assignedPolicies.auto && !newBroker.policies.auto}
                    checked={newBroker.policies.auto}
                    onChange={(e) => setNewBroker({ ...newBroker, policies: { ...newBroker.policies, auto: e.target.checked } })}
                  />
                  <span className="text-sm">Auto Liability</span>
                  {assignedPolicies.auto && !newBroker.policies.auto && <span className="text-xs text-gray-500 ml-auto">Assigned</span>}
                </label>
                <label className={`flex items-center gap-2 cursor-pointer p-2 border rounded hover:bg-amber-100 ${assignedPolicies.wc && !newBroker.policies.wc ? 'opacity-50 cursor-not-allowed bg-gray-50' : ''}`}>
                  <input
                    type="checkbox"
                    disabled={assignedPolicies.wc && !newBroker.policies.wc}
                    checked={newBroker.policies.wc}
                    onChange={(e) => setNewBroker({ ...newBroker, policies: { ...newBroker.policies, wc: e.target.checked } })}
                  />
                  <span className="text-sm">Workers Compensation (WC)</span>
                  {assignedPolicies.wc && !newBroker.policies.wc && <span className="text-xs text-gray-500 ml-auto">Assigned</span>}
                </label>
                <label className={`flex items-center gap-2 cursor-pointer p-2 border rounded hover:bg-amber-100 ${assignedPolicies.umbrella && !newBroker.policies.umbrella ? 'opacity-50 cursor-not-allowed bg-gray-50' : ''}`}>
                  <input
                    type="checkbox"
                    disabled={assignedPolicies.umbrella && !newBroker.policies.umbrella}
                    checked={newBroker.policies.umbrella}
                    onChange={(e) => setNewBroker({ ...newBroker, policies: { ...newBroker.policies, umbrella: e.target.checked } })}
                  />
                  <span className="text-sm">Umbrella</span>
                  {assignedPolicies.umbrella && !newBroker.policies.umbrella && <span className="text-xs text-gray-500 ml-auto">Assigned</span>}
                </label>
              </div>
            </div>
            <Button
              onClick={handleAddBroker}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white"
            >
              <Plus className="w-4 h-4 mr-2" />
              {editingIndex !== null ? "Update Broker" : "Add Broker to List"}
            </Button>
            {editingIndex !== null && (
              <Button
                onClick={handleCancelEdit}
                variant="outline"
                className="w-full"
              >
                Cancel Edit
              </Button>
            )}
          </div>
        </div>

        {/* Broker List */}
        {brokers.length > 0 && (
          <div className="border-t pt-4 mt-4 space-y-3">
            <h4 className="font-semibold text-slate-900">Assigned Brokers ({brokers.length})</h4>
            {brokers.map((broker, idx) => (
              <div key={idx} className={`flex items-start justify-between p-3 rounded-lg border shadow-sm ${editingIndex === idx ? 'bg-blue-50 border-blue-300' : 'bg-white border-slate-200'}`}>
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
                <div className="flex gap-2 ml-3">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleEditBroker(idx)}
                    className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                    title="Edit this broker"
                  >
                    <Edit2 className="w-4 h-4" />
                  </Button>
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
