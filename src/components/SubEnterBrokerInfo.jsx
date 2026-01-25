import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getApiBase } from "@/api/apiClient";
import { sendEmail } from "@/emailHelper";
import { generateSecurePassword, formatLoginCredentialsForEmail, createUserCredentials } from "@/passwordUtils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, CheckCircle2, AlertTriangle } from "lucide-react";
import { getFrontendBaseUrl } from "@/urlConfig";

export default function SubEnterBrokerInfo() {
  const params = new URLSearchParams(window.location.search);
  const token = params.get("token");
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    broker_name: "",
    broker_email: "",
    broker_phone: "",
    broker_company: "",
  });
  const [submitted, setSubmitted] = useState(false);

  const { data: coi, isLoading: coiLoading } = useQuery({
    queryKey: ["coi-by-token", token],
    enabled: !!token,
    queryFn: async () => {
      if (!token) return null;
      try {
        const res = await fetch(`${getApiBase()}/public/coi-by-token?token=${encodeURIComponent(token)}`);
        if (!res.ok) return null;
        return await res.json();
      } catch (error) {
        console.error('Error fetching COI:', error);
        return null;
      }
    },
    retry: 1,
  });

  const { data: subcontractor, isLoading: subLoading } = useQuery({
    queryKey: ["sub-for-coi", coi?.subcontractor_id],
    enabled: !!coi?.subcontractor_id,
    queryFn: async () => {
      try {
        const res = await fetch(`${getApiBase()}/public/contractor/${coi.subcontractor_id}`, {
          credentials: 'include'
        });
        if (!res.ok) return null;
        return await res.json();
      } catch (error) {
        console.error('Error fetching subcontractor:', error);
        return null;
      }
    },
    retry: 1,
  });

  const updateSubcontractorMutation = useMutation({
    mutationFn: async ({ id, data }) => {
      const res = await fetch(`${getApiBase()}/public/contractor/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data)
      });
      if (!res.ok) throw new Error('Failed to update subcontractor');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries(["sub-for-coi", coi?.subcontractor_id]);
    },
  });

  const updateCoiMutation = useMutation({
    mutationFn: async ({ id, data }) => {
      const res = await fetch(`${getApiBase()}/public/coi-by-token`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ token, updates: data })
      });
      if (!res.ok) throw new Error('Failed to update COI');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries(["coi-by-token", token]);
    },
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!coi || !subcontractor) return;
    if (!form.broker_name || !form.broker_email) {
      alert("Please provide broker name and email");
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

    await updateCoiMutation.mutateAsync({
      id: coi.id,
      data: {
        broker_name: form.broker_name,
        broker_email: form.broker_email,
        broker_phone: form.broker_phone,
        broker_company: form.broker_company,
        status: coi.status === "awaiting_broker_info" ? "awaiting_broker_upload" : coi.status,
      },
    });

    // Notify the broker with credentials and links
    if (form.broker_email && token) {
      const baseUrl = getFrontendBaseUrl();
      const brokerUploadLink = `${baseUrl}/broker-upload-coi?token=${token}&step=1`;
      const brokerDashboardLink = `${baseUrl}/broker-dashboard`;
      
      // Generate secure credentials for broker
      const password = generateSecurePassword();
      const loginInfo = formatLoginCredentialsForEmail(
        form.broker_email,
        password,
        brokerDashboardLink,
        brokerDashboardLink
      );
      
      try {
        await sendEmail({
          to: form.broker_email,
          includeSampleCOI: true,
          sampleCOIData: {
            project_name: coi.project_name,
            gc_name: coi.gc_name,
            projectAddress: coi.project_location || coi.certificate_holder_address,
            trade: subcontractor?.trade_types?.join(', '),
            program: coi.program_name || coi.program_id,
            additional_insureds: coi.additional_insured_entities ? 
              (Array.isArray(coi.additional_insured_entities) ? coi.additional_insured_entities : 
                coi.additional_insured_entities.split(',').map(s => s.trim())) : 
              [coi.gc_name, coi.owner_entity].filter(Boolean)
          },
          subject: `COI Request for ${coi.project_name || "Project"}`,
          body: `Hello ${form.broker_name || ""},\n\nA client needs a Certificate of Insurance for ${coi.project_name || "the project"}.\n\n${loginInfo}\n\nThis project upload link: ${brokerUploadLink}\n\nUse the dashboard to manage all requests or the upload link to go directly to this project's COI portal.\n\nThank you.`
        });
        
        // Create broker user account
        try {
          const userCredentials = createUserCredentials(
            form.broker_email,
            form.broker_name || form.broker_email,
            'broker',
            {}
          );
          userCredentials.password = password; // Use the same password from email
        await fetch(`${getApiBase()}/entities/User`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(userCredentials)
        });
        } catch (_userError) {
          // User may already exist - that's fine
        }
      } catch (err) {
        console.error("Failed to notify broker for upload", err);
      }
    }

    setSubmitted(true);
  };

  const isLoading = coiLoading || subLoading;


  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-4 md:p-8">
      <div className="max-w-2xl mx-auto">
        <Card className="shadow-lg border-slate-200">
          <CardHeader>
            <CardTitle className="text-xl">Provide Broker Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {isLoading && (
              <div className="flex items-center gap-2 text-slate-600">
                <Loader2 className="w-4 h-4 animate-spin" />
                Loading request...
              </div>
            )}

            {!isLoading && !coi && (
              <Alert variant="destructive">
                <AlertTriangle className="w-4 h-4" />
                <AlertDescription>Invalid or expired link. Please contact your GC for a new link.</AlertDescription>
              </Alert>
            )}

            {!isLoading && coi && (
              <>
                <div className="text-slate-700 space-y-1">
                  <div className="font-semibold">Project: {coi.project_name || ""}</div>
                  <div className="text-sm">Subcontractor: {coi.subcontractor_name || subcontractor?.company_name}</div>
                </div>

                {submitted ? (
                  <Alert className="border-emerald-200 bg-emerald-50 text-emerald-800">
                    <CheckCircle2 className="w-4 h-4" />
                    <AlertDescription>
                      Broker information saved. We emailed {form.broker_email} a secure link to upload the COI.
                    </AlertDescription>
                  </Alert>
                ) : (
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid md:grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <Label>Broker Name *</Label>
                        <Input
                          value={form.broker_name}
                          onChange={(e) => setForm({ ...form, broker_name: e.target.value })}
                          required
                        />
                      </div>
                      <div className="space-y-1">
                        <Label>Broker Email *</Label>
                        <Input
                          type="email"
                          value={form.broker_email}
                          onChange={(e) => setForm({ ...form, broker_email: e.target.value })}
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
                        />
                      </div>
                      <div className="space-y-1">
                        <Label>Broker Company</Label>
                        <Input
                          value={form.broker_company}
                          onChange={(e) => setForm({ ...form, broker_company: e.target.value })}
                        />
                      </div>
                    </div>

                    <div className="flex justify-end items-center">
                      <Button type="submit" disabled={updateSubcontractorMutation.isPending || updateCoiMutation.isPending}>
                        {updateSubcontractorMutation.isPending || updateCoiMutation.isPending ? (
                          <span className="inline-flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Saving...</span>
                        ) : 'Save Broker Info'}
                      </Button>
                    </div>
                  </form>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}