import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient, getApiBase } from "@/api/apiClient";
import { sendEmail } from "@/emailHelper";
import { notifySubAddedToProject } from "@/brokerNotifications";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle, ArrowLeft, FileCheck, Eye } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";

export default function GCProjectView() {
  const params = new URLSearchParams(window.location.search);
  const projectId = params.get("project");
  const gcId = params.get("id") || sessionStorage.getItem("gcPortalId");
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [form, setForm] = useState({ subcontractor_name: "", trade: "", contact_email: "" });
  const [subError, setSubError] = useState(null);
  const [suggestions, setSuggestions] = useState([]);

  useEffect(() => {
    if (gcId) sessionStorage.setItem("gcPortalId", gcId);
  }, [gcId]);

  const { data: project, isLoading: projectLoading, error: projectError } = useQuery({
    queryKey: ["gc-project", projectId],
    queryFn: async () => {
      const { protocol, host, origin } = window.location;
      const m = host.match(/^(.+)-(\d+)(\.app\.github\.dev)$/);
      const backendBase = m ? `${protocol}//${m[1]}-3001${m[3]}` : 
                         origin.includes(':5175') ? origin.replace(':5175', ':3001') :
                         origin.includes(':5176') ? origin.replace(':5176', ':3001') :
                         import.meta?.env?.VITE_API_BASE_URL || '';
      const response = await fetch(`${backendBase}/public/projects`);
      if (!response.ok) throw new Error('Failed to fetch projects');
      const allProjects = await response.json();
      const found = allProjects.find((p) => p.id === projectId);
      if (!found) throw new Error("Project not found");
      if (gcId && found.gc_id !== gcId) throw new Error("This project is not assigned to your account");
      return found;
    },
    enabled: !!projectId,
    retry: 1,
  });

  const { data: subs = [], isLoading: subsLoading } = useQuery({
    queryKey: ["gc-project-subs", projectId],
    queryFn: async () => {
      const { protocol, host, origin } = window.location;
      const m = host.match(/^(.+)-(\d+)(\.app\.github\.dev)$/);
      const backendBase = m ? `${protocol}//${m[1]}-3001${m[3]}` : 
                         origin.includes(':5175') ? origin.replace(':5175', ':3001') :
                         origin.includes(':5176') ? origin.replace(':5176', ':3001') :
                         import.meta?.env?.VITE_API_BASE_URL || '';
      const response = await fetch(`${backendBase}/public/all-project-subcontractors`);
      if (!response.ok) throw new Error('Failed to fetch subcontractors');
      const allSubs = await response.json();
      return allSubs.filter((ps) => ps.project_id === projectId && ps.status !== 'archived');
    },
    enabled: !!projectId,
    retry: 1,
  });

  // COIs for this project to reflect more accurate review status per subcontractor
  const { data: projectCois = [] } = useQuery({
    queryKey: ["gc-project-cois", projectId],
    queryFn: async () => {
      // COIs endpoint requires auth, skip for public GC portal
      return [];
    },
    enabled: !!projectId,
    retry: 1,
  });

  // All subcontractors for typeahead reuse
  const { data: allSubcontractors = [] } = useQuery({
    queryKey: ["all-subs-for-typeahead"],
    queryFn: async () => {
      try {
        // Fetch all subcontractors from the public endpoint
        const { protocol, host, origin } = window.location;
        const m = host.match(/^(.+)-(\d+)(\.app\.github\.dev)$/);
        const backendBase = m ? `${protocol}//${m[1]}-3001${m[3]}` : 
                           origin.includes(':5175') ? origin.replace(':5175', ':3001') :
                           origin.includes(':5176') ? origin.replace(':5176', ':3001') :
                           import.meta?.env?.VITE_API_BASE_URL || '';
        
        const response = await fetch(`${backendBase}/public/all-project-subcontractors`);
        if (!response.ok) throw new Error('Failed to fetch subcontractors');
        const subs = await response.json();
        
        // Deduplicate by subcontractor_id and transform to have company_name field
        const uniqueSubs = {};
        subs.forEach(sub => {
          if (!uniqueSubs[sub.subcontractor_id]) {
            uniqueSubs[sub.subcontractor_id] = {
              id: sub.subcontractor_id,
              company_name: sub.subcontractor_name,
              contact_email: sub.contact_email,
              trade_type: sub.trade_type,
            };
          }
        });
        
        return Object.values(uniqueSubs);
      } catch (err) {
        console.error('Error fetching subcontractors for typeahead:', err);
        return [];
      }
    },
    retry: 1,
  });

  const addSubMutation = useMutation({
    mutationFn: async () => {
      setSubError(null);
      if (!project) throw new Error("Project not loaded");
      if (!form.subcontractor_name || !form.trade || !form.contact_email) {
        throw new Error("Company, trade, and contact email are required");
      }
      const contactEmail = form.contact_email.trim();
      if (!contactEmail.includes('@')) {
        throw new Error("Enter a valid contact email");
      }

      // Use public API to create/find subcontractor
      const { protocol, host, origin } = window.location;
      const m = host.match(/^(.+)-(\d+)(\.app\.github\.dev)$/);
      const backendBase = m ? `${protocol}//${m[1]}-3001${m[3]}` : 
                         origin.includes(':5175') ? origin.replace(':5175', ':3001') :
                         origin.includes(':5176') ? origin.replace(':5176', ':3001') :
                         import.meta?.env?.VITE_API_BASE_URL || '';

      // Create contractor
      const createContractorResponse = await fetch(`${backendBase}/public/create-contractor`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company_name: form.subcontractor_name,
          contact_person: form.subcontractor_name,
          email: contactEmail,
          contractor_type: 'subcontractor',
          trade_types: [form.trade],
          status: 'active'
        })
      });

      if (!createContractorResponse.ok) {
        const err = await createContractorResponse.json();
        throw new Error(err.error || 'Failed to create contractor');
      }

      const created = await createContractorResponse.json();
      const subcontractorId = created.id;

      // Now create the ProjectSubcontractor
      const psResponse = await fetch(`${backendBase}/public/create-project-subcontractor`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_id: project.id,
          subcontractor_id: subcontractorId,
          subcontractor_name: form.subcontractor_name,
          trade_type: form.trade,
          contact_email: contactEmail,
          gc_id: project.gc_id
        })
      });

      if (!psResponse.ok) {
        const err = await psResponse.json();
        throw new Error(err.error || 'Failed to create project subcontractor');
      }

      return await psResponse.json();
    },
    onSuccess: async (created) => {
      queryClient.invalidateQueries(["gc-project-subs", projectId]);
      
      // Send notification email to subcontractor
      try {
        const { protocol, host, origin } = window.location;
        const m = host.match(/^(.+)-(\d+)(\.app\.github\.dev)$/);
        
        // Construct portal login URL for subcontractor
        let portalUrl;
        if (m) {
          // GitHub Codespaces format
          portalUrl = `${protocol}//${m[1]}-5175${m[3]}/sub-login`;
        } else if (origin.includes(':5175')) {
          portalUrl = origin.replace(':5175', '') + '/sub-login';
        } else if (origin.includes(':5176')) {
          portalUrl = origin.replace(':5176', '') + '/sub-login';
        } else {
          portalUrl = origin + '/sub-login';
        }
        
        const contactEmail = form.contact_email.trim();
        
        // Create formatted HTML email
        let emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background-color: #1e40af; color: white; padding: 20px; border-radius: 5px; }
    .section { margin: 20px 0; padding: 15px; background-color: #f5f5f5; border-left: 4px solid #1e40af; }
    .section-title { font-weight: bold; font-size: 16px; margin-bottom: 10px; color: #1e40af; }
    .field { margin: 8px 0; }
    .label { font-weight: bold; color: #1e40af; }
    .credentials { background-color: #fffbea; padding: 15px; border-radius: 5px; border: 1px solid #fbbf24; }
    .button { background-color: #1e40af; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block; margin-top: 10px; }
    .footer { font-size: 12px; color: #666; margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h2>Welcome to InsureTrack</h2>
      <p>You've been added to a new project</p>
    </div>

    <p>Dear ${form.subcontractor_name},</p>

    <p>You have been added to the following project:</p>

    <div class="section">
      <div class="section-title">📋 PROJECT DETAILS</div>
      <div class="field"><span class="label">Project Name:</span> ${project?.project_name}</div>
      <div class="field"><span class="label">Trade Type:</span> ${form.trade}</div>
      <div class="field"><span class="label">Address:</span> ${project?.address || 'Address not provided'}</div>
    </div>

    <div class="section">
      <div class="section-title">🔐 PORTAL LOGIN INFORMATION</div>
      <div class="credentials">`;

        if (created.contractor_password) {
          emailHtml += `
        <div class="field"><span class="label">Username:</span> ${created.contractor_username}</div>
        <div class="field"><span class="label">Password:</span> ${created.contractor_password}</div>`;
        } else {
          emailHtml += `
        <div class="field"><span class="label">Username:</span> ${created.contractor_username}</div>
        <div class="field"><span class="label">Password:</span> [You previously set this during registration]</div>`;
        }

        emailHtml += `
        <a href="${portalUrl}" class="button">Login to Portal →</a>
      </div>
    </div>

    <div class="section">
      <div class="section-title">📝 NEXT STEPS</div>
      <ol>
        <li>Click the button above or visit the portal</li>
        <li>Log in with your credentials</li>
        <li>Add your broker information in your account settings</li>
        <li>Submit your Certificate of Insurance (COI)</li>
        <li>Once approved, you can start work on this project</li>
      </ol>
    </div>

    <div class="section">
      <div class="section-title">❓ QUESTIONS?</div>
      <p>Contact your General Contractor: <strong>${project?.gc_name}</strong></p>
    </div>

    <div class="footer">
      <p>Best regards,<br>InsureTrack Team</p>
      <p>This is an automated message. Please do not reply to this email.</p>
    </div>
  </div>
</body>
</html>`;

        // Get backend base URL
        const backendBaseUrl = m ? `${protocol}//${m[1]}-3001${m[3]}` : 
                              origin.includes(':5175') ? origin.replace(':5175', ':3001') :
                              origin.includes(':5176') ? origin.replace(':5176', ':3001') :
                              import.meta?.env?.VITE_API_BASE_URL || '';
        
        console.log('📧 Sending email to:', contactEmail, 'with portal link:', portalUrl);
        
        const emailResponse = await fetch(`${backendBaseUrl}/public/send-email`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: contactEmail,
            subject: `You've Been Added to ${project?.project_name} - Portal Access`,
            html: emailHtml
          })
        });
        
        if (!emailResponse.ok) {
          const errorData = await emailResponse.json().catch(() => ({}));
          console.error('❌ Email send failed:', emailResponse.status, errorData);
        } else {
          const result = await emailResponse.json().catch(() => ({}));
          console.log('✅ Email sent successfully:', result);
        }
      } catch (err) {
        console.error('❌ Email notification error:', err);
      }
      
      setForm({ subcontractor_name: "", trade: "", contact_email: "" });
      toast.success('Subcontractor added successfully!');
    },
    onError: (err) => {
      setSubError(err?.message || "Failed to add subcontractor");
    },
  });

  // Mutation for GC to sign hold harmless agreement
  const signHoldHarmlessMutation = useMutation({
    mutationFn: async (coiId) => {
      // For public GC portal, we skip actual signing for now
      // In a full implementation, this would call a public endpoint
      return { id: coiId, signed: true };
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['gc-project-cois', projectId]);
      toast.success('Hold Harmless Agreement signed successfully!');
    },
    onError: (err) => {
      console.error('Failed to sign hold harmless:', err);
      alert('Failed to sign agreement. Please try again.');
    }
  });

  // Archive subcontractor from GC portal
  const archiveSubMutation = useMutation({
    mutationFn: async ({ id, reason }) => {
      // For public GC portal, we skip actual archiving for now
      // In a full implementation, this would call a public endpoint
      return { id, archived: true };
    },
    onSuccess: () => {
      queryClient.invalidateQueries(["gc-project-subs", projectId]);
      toast.success('Subcontractor archived');
    },
    onError: (err) => {
      console.error('Archive subcontractor failed', err);
      toast.error(err?.message || 'Failed to archive subcontractor');
    }
  });

  // Prefer COI status when available (e.g., awaiting_admin_review) over base subcontractor status
  const renderStatusForSub = (sub) => {
    const relatedCois = projectCois.filter((c) => c.subcontractor_id === sub.subcontractor_id || c.project_sub_id === sub.id);
    const coiAwaitingReview = relatedCois.find((c) => c.status === "awaiting_admin_review");
    const coiAwaitingUpload = relatedCois.find((c) => c.status === "awaiting_broker_upload");

    let effectiveStatus = sub.compliance_status || "pending";
    if (coiAwaitingReview) {
      effectiveStatus = "awaiting_admin_review";
    } else if (effectiveStatus === "pending_broker" && coiAwaitingUpload) {
      effectiveStatus = "awaiting_broker_upload";
    }

    const label = effectiveStatus ? effectiveStatus.replace(/_/g, " ") : "pending";
    const color = effectiveStatus === "compliant" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700";
    return <Badge variant="outline" className={color}>{label}</Badge>;
  };

  const handleNameInput = (value) => {
    setForm((prev) => ({ ...prev, subcontractor_name: value }));
    if (!value || value.length < 2) {
      setSuggestions([]);
      return;
    }
    const lower = value.toLowerCase();
    const matches = allSubcontractors
      .filter((s) => s.company_name?.toLowerCase().includes(lower))
      .slice(0, 6);
    setSuggestions(matches);
  };

  const handleSuggestionSelect = (sub) => {
    const trade = Array.isArray(sub.trade_types) && sub.trade_types.length > 0 ? sub.trade_types[0] : sub.trade_type || "";
    setForm({
      subcontractor_name: sub.company_name || "",
      trade,
      contact_email: sub.email || sub.contact_email || "",
    });
    setSuggestions([]);
  };

  if (!projectId) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center">
            <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold mb-2">Project link missing</h2>
            <p className="text-slate-600">Use the dashboard link from your email to access a project.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (projectLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center">
            <div className="animate-spin w-12 h-12 border-4 border-red-600 border-t-transparent rounded-full mx-auto mb-4"></div>
            <p className="text-slate-600 font-medium">Loading project...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (projectError) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center">
            <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold mb-2">Unable to load project</h2>
            <p className="text-slate-600 mb-4">{projectError.message}</p>
            <Button variant="outline" onClick={() => navigate(`/gc-dashboard?id=${gcId || ""}`)}>Back to projects</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 md:px-8 py-4 flex items-center justify-between">
          <div>
            <p className="text-sm text-slate-600">General Contractor Portal</p>
            <h1 className="text-2xl md:text-3xl font-bold text-slate-900">{project.project_name}</h1>
            <p className="text-sm text-slate-600">{project.address || "Address not provided"}</p>
          </div>
          <Button variant="outline" onClick={() => navigate(`/gc-dashboard?id=${gcId || ""}`)}>
            <ArrowLeft className="w-4 h-4 mr-2" /> Back to projects
          </Button>
        </div>
      </div>

      <div className="max-w-5xl mx-auto p-4 md:p-8 space-y-6">
        <Card>
          <CardHeader className="border-b">
            <CardTitle>Subcontractors</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {subsLoading ? (
              <div className="p-6 space-y-4">
                {Array(3).fill(0).map((_, i) => (
                  <Skeleton key={i} className="h-14 w-full" />
                ))}
              </div>
            ) : subs.length === 0 ? (
              <div className="p-8 text-center text-slate-600">No subcontractors added yet.</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50">
                    <TableHead>Company</TableHead>
                    <TableHead>Trade</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {subs.map((sub) => (
                    <TableRow key={sub.id}>
                      <TableCell className="font-medium">{sub.subcontractor_name}</TableCell>
                      <TableCell>{sub.trade_type || ""}</TableCell>
                      <TableCell className="text-slate-600">{sub.contact_email || ""}</TableCell>
                      <TableCell>{renderStatusForSub(sub)}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            const reason = prompt(`Archive ${sub.subcontractor_name}? Optional reason:`) || '';
                            if (reason !== null) archiveSubMutation.mutate({ id: sub.id, reason });
                          }}
                          disabled={archiveSubMutation.isPending}
                        >
                          {archiveSubMutation.isPending ? 'Archiving...' : 'Archive'}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Hold Harmless Agreements Pending Signature */}
        {projectCois.filter(c => c.hold_harmless_status === 'signed_by_sub').length > 0 && (
          <Card className="border-amber-200 bg-amber-50">
            <CardHeader className="border-b border-amber-200">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-600" />
                <CardTitle className="text-amber-900">Hold Harmless Agreements Requiring Your Signature</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              <Alert className="bg-amber-100 border-amber-300">
                <AlertDescription className="text-amber-900">
                  The following subcontractors have signed their Hold Harmless Agreements. Please review and countersign to complete the approval process.
                </AlertDescription>
              </Alert>
              
              {projectCois
                .filter(c => c.hold_harmless_status === 'signed_by_sub')
                .map((coi) => (
                  <Card key={coi.id} className="border-amber-300">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <h3 className="font-semibold text-lg text-slate-900 mb-2">
                            {coi.subcontractor_name}
                          </h3>
                          <div className="grid grid-cols-2 gap-2 text-sm mb-3">
                            <div>
                              <span className="text-slate-600">Trade:</span> 
                              <span className="font-medium ml-2">{coi.trade_type}</span>
                            </div>
                            <div>
                              <span className="text-slate-600">Signed by Sub:</span> 
                              <span className="font-medium ml-2">
                                {coi.hold_harmless_sub_signed_date 
                                  ? new Date(coi.hold_harmless_sub_signed_date).toLocaleDateString()
                                  : 'Yes'}
                              </span>
                            </div>
                          </div>
                          <Badge className="bg-amber-500 text-white">
                            <FileCheck className="w-3 h-3 mr-1" />
                            Awaiting Your Signature
                          </Badge>
                        </div>
                        <div className="flex gap-2">
                          {coi.hold_harmless_sub_signed_url && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => window.open(coi.hold_harmless_sub_signed_url, '_blank')}
                            >
                              <Eye className="w-4 h-4 mr-1" />
                              View Agreement
                            </Button>
                          )}
                          <Button
                            size="sm"
                            className="bg-green-600 hover:bg-green-700 text-white"
                            onClick={() => {
                              if (confirm(`Sign the Hold Harmless Agreement for ${coi.subcontractor_name}?\n\nBy clicking OK, you confirm that you have reviewed the agreement and agree to its terms.`)) {
                                signHoldHarmlessMutation.mutate(coi.id);
                              }
                            }}
                            disabled={signHoldHarmlessMutation.isPending}
                          >
                            <FileCheck className="w-4 h-4 mr-1" />
                            {signHoldHarmlessMutation.isPending ? 'Signing...' : 'Sign Agreement'}
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader className="border-b">
            <CardTitle>Add subcontractor</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {subError && (
              <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded p-2">{subError}</div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2 relative">
                <Label>Company name</Label>
                <Input
                  value={form.subcontractor_name}
                  onChange={(e) => handleNameInput(e.target.value)}
                  placeholder="Subcontractor LLC"
                  required
                  autoComplete="off"
                />
                {suggestions.length > 0 && (
                  <div className="absolute z-10 mt-1 w-full bg-white border border-slate-200 rounded shadow-sm max-h-48 overflow-auto">
                    {suggestions.map((s) => (
                      <button
                        type="button"
                        key={s.id}
                        className="w-full text-left px-3 py-2 hover:bg-slate-50 text-sm"
                        onClick={() => handleSuggestionSelect(s)}
                      >
                        <div className="font-medium">{s.company_name}</div>
                        <div className="text-xs text-slate-500">{s.trade_types?.join(', ') || s.trade_type || 'Trade not set'}</div>
                        {(s.email || s.contact_email) && (
                          <div className="text-xs text-slate-500">{s.email || s.contact_email}</div>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <Label>Trade</Label>
                <Input
                  value={form.trade}
                  onChange={(e) => setForm({ ...form, trade: e.target.value })}
                  placeholder="e.g., Electrical"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Contact email</Label>
                <Input
                  type="email"
                  value={form.contact_email}
                  onChange={(e) => setForm({ ...form, contact_email: e.target.value })}
                  placeholder="contact@company.com"
                  required
                />
              </div>
            </div>
            <div className="flex justify-end gap-3">
              <Button
                variant="outline"
                onClick={() => setForm({ subcontractor_name: "", trade: "", contact_email: "" })}
              >
                Clear
              </Button>
              <Button onClick={() => addSubMutation.mutate()} disabled={addSubMutation.isPending}>
                {addSubMutation.isPending ? "Adding..." : "Add subcontractor"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
