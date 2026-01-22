import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { compliant } from "@/api/compliantClient";
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
      const allProjects = await compliant.entities.Project.list();
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
      const allSubs = await compliant.entities.ProjectSubcontractor.list();
      return allSubs.filter((ps) => ps.project_id === projectId);
    },
    enabled: !!projectId,
    retry: 1,
  });

  // COIs for this project to reflect more accurate review status per subcontractor
  const { data: projectCois = [] } = useQuery({
    queryKey: ["gc-project-cois", projectId],
    queryFn: async () => {
      const allCois = await compliant.entities.GeneratedCOI.list();
      return allCois.filter((c) => c.project_id === projectId);
    },
    enabled: !!projectId,
    retry: 1,
  });

  // All subcontractors for typeahead reuse
  const { data: allSubcontractors = [] } = useQuery({
    queryKey: ["all-subs-for-typeahead"],
    queryFn: async () => {
      const all = await compliant.entities.Contractor.list();
      return all.filter((c) => c.contractor_type === "subcontractor");
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

      // Ensure session still valid
      try {
        await compliant.auth.me();
      } catch (err) {
        throw new Error("Your session expired. Refresh the link and try again.");
      }

      const allSubs = await compliant.entities.Contractor.list();
      const existing = allSubs.find(
        (s) => s.company_name?.toLowerCase() === form.subcontractor_name.toLowerCase()
      );
      let subcontractorId = existing?.id;

      if (!existing) {
        const created = await compliant.entities.Contractor.create({
          company_name: form.subcontractor_name,
          contact_person: form.subcontractor_name,
          email: contactEmail,
          contractor_type: "subcontractor",
          trade_types: [form.trade],
          status: "active",
        });
        subcontractorId = created.id;
      } else {
        const trades = new Set([...(existing.trade_types || []), form.trade]);
        await compliant.entities.Contractor.update(existing.id, {
          email: contactEmail,
          trade_types: Array.from(trades),
        });
        subcontractorId = existing.id;
      }

      return compliant.entities.ProjectSubcontractor.create({
        project_id: project.id,
        project_name: project.project_name,
        gc_id: project.gc_id,
        subcontractor_id: subcontractorId,
        subcontractor_name: form.subcontractor_name,
        trade_type: form.trade,
        contact_email: contactEmail,
        compliance_status: "pending_broker",
      });
    },
    onSuccess: async (created) => {
      queryClient.invalidateQueries(["gc-project-subs", projectId]);
      try {
        // Fetch the FULL subcontractor record with all fields including broker_email
        const allContractors = await compliant.entities.Contractor.list();
        const subcontractor = allContractors.find(c => c.id === created.subcontractor_id) || {
          id: created.subcontractor_id,
          company_name: created.subcontractor_name || form.subcontractor_name,
          email: created.contact_email || form.contact_email,
          trade_types: [created.trade_type || form.trade],
        };
        
        const projectList = await compliant.entities.Project.filter({ id: created.project_id });
        const projectData = Array.isArray(projectList) && projectList.length > 0 ? projectList[0] : {
          id: created.project_id,
          project_name: project?.project_name,
          gc_id: project?.gc_id,
          gc_name: project?.gc_name,
        };
        const contactEmail = subcontractor.email || subcontractor.contact_email || created.contact_email || form.contact_email;

        // Ensure subcontractor portal exists so the email link works
        const subDashboardLink = `${window.location.origin}/subcontractor-dashboard?id=${subcontractor.id}`;
        const existingSubPortals = await compliant.entities.Portal.filter({
          user_id: subcontractor.id,
          user_type: "subcontractor",
        });
        if (existingSubPortals.length === 0) {
          await compliant.entities.Portal.create({
            user_type: "subcontractor",
            user_id: subcontractor.id,
            user_email: contactEmail || subcontractor.email,
            user_name: subcontractor.company_name,
            dashboard_url: subDashboardLink,
            status: "active",
            // Generate secure access token using crypto
            access_token: (() => {
              const tokenBytes = new Uint8Array(24);
              crypto.getRandomValues(tokenBytes);
              return Array.from(tokenBytes, byte => byte.toString(16).padStart(2, '0')).join('');
            })(),
          });
        }

        // Ensure a certificate request exists so the broker sees it
        const existingCOIs = await compliant.entities.GeneratedCOI.filter({ project_id: projectData.id, subcontractor_id: subcontractor.id });
        if (!existingCOIs || existingCOIs.length === 0) {
          // Generate secure COI token using crypto
          const tokenBytes = new Uint8Array(12);
          crypto.getRandomValues(tokenBytes);
          const coiToken = `coi-${Date.now()}-${Array.from(tokenBytes, byte => byte.toString(16).padStart(2, '0')).join('')}`;
          
          // Pre-populate COI with project-specific info
          const additionalInsuredList = [];
          if (projectData.gc_name) {
            additionalInsuredList.push(projectData.gc_name);
          }
          if (projectData.owner_entity) {
            additionalInsuredList.push(projectData.owner_entity);
          }
          const extraAIs = Array.isArray(projectData.additional_insured_entities)
            ? projectData.additional_insured_entities
            : (typeof projectData.additional_insured_entities === 'string'
              ? projectData.additional_insured_entities.split(',').map(s => s.trim()).filter(Boolean)
              : []);
          additionalInsuredList.push(...extraAIs);
          
          await compliant.entities.GeneratedCOI.create({
            project_id: projectData.id,
            project_name: projectData.project_name,
            gc_id: projectData.gc_id,
            gc_name: projectData.gc_name,
            subcontractor_id: subcontractor.id,
            subcontractor_name: subcontractor.company_name,
            trade_type: created.trade_type || form.trade,
            project_sub_id: created.id,
            status: "awaiting_broker_upload",
            broker_email: subcontractor.broker_email || form.contact_email,
            broker_name: subcontractor.broker_name || undefined,
            created_date: new Date().toISOString(),
            first_coi_uploaded: false,
            first_coi_url: null,
            coi_token: coiToken,
            // Pre-populate with project details
            certificate_holder: projectData.gc_name,
            certificate_holder_address: projectData.project_address,
            additional_insureds: additionalInsuredList,
            project_location: projectData.project_address,
          });
        }

        // Notify subcontractor only if broker is not already on file
        if (contactEmail && !subcontractor.broker_email) {
          const brokerGlobalLink = `${window.location.origin}/broker-upload?type=global&subId=${subcontractor.id}`;
          const brokerPerPolicyLink = `${window.location.origin}/broker-upload?type=per-policy&subId=${subcontractor.id}`;

          await sendEmail({
            to: contactEmail,
            subject: `Added to Project - ${projectData.project_name}`,
            body: `You have been added to ${projectData.project_name}.\n\nAdd your insurance broker to proceed:\n- One Broker for All Policies: ${brokerGlobalLink}\n- Different Brokers per Policy: ${brokerPerPolicyLink}\n\nAfter submitting, you'll be redirected to your dashboard.`
          }).catch(err => console.error("Direct sub email failed", err));
        }

        try {
          await notifySubAddedToProject(subcontractor, projectData);
        } catch (notifyErr) {
          console.error("notifySubAddedToProject failed", notifyErr);
        }
      } catch (err) {
        console.error("Post-add notification failed", err);
      }
      setForm({ subcontractor_name: "", trade: "", contact_email: "" });
    },
    onError: (err) => {
      setSubError(err?.message || "Failed to add subcontractor");
    },
  });

  // Mutation for GC to sign hold harmless agreement
  const signHoldHarmlessMutation = useMutation({
    mutationFn: async (coiId) => {
      const coi = projectCois.find(c => c.id === coiId);
      if (!coi) throw new Error("COI not found");

      // Update COI with GC signature status
      await compliant.entities.GeneratedCOI.update(coiId, {
        hold_harmless_status: 'signed',
        hold_harmless_gc_signed_date: new Date().toISOString()
      });

      return { coi, project };
    },
    onSuccess: async ({ coi }) => {
      queryClient.invalidateQueries(['gc-project-cois', projectId]);
      
      // Notify admin that hold harmless is fully signed
      if (coi.admin_emails && Array.isArray(coi.admin_emails)) {
        for (const adminEmail of coi.admin_emails) {
          try {
            await sendEmail({
              to: adminEmail,
              subject: `✅ Hold Harmless Fully Signed - ${coi.subcontractor_name} APPROVED - ${project.project_name}`,
              body: `The Hold Harmless Agreement has been fully signed by both the subcontractor and GC.

Project: ${project.project_name}
Subcontractor: ${coi.subcontractor_name}
Trade: ${coi.trade_type}
GC: ${project.gc_name}

STATUS: ✅ FULLY APPROVED - Subcontractor can proceed with work

Subcontractor signed: ${coi.hold_harmless_sub_signed_date ? new Date(coi.hold_harmless_sub_signed_date).toLocaleDateString() : 'Yes'}
GC signed: ${new Date().toLocaleDateString()}

Signed agreement: ${coi.hold_harmless_sub_signed_url}

Best regards,
InsureTrack System`
            });
          } catch (err) {
            console.error('Failed to notify admin:', err);
          }
        }
      }

      // Notify subcontractor that they are approved
      if (coi.contact_email || coi.broker_email) {
        try {
          const subEmail = coi.contact_email || coi.broker_email;
          await sendEmail({
            to: subEmail,
            subject: `✅ APPROVED - Hold Harmless Agreement Fully Signed - ${project.project_name}`,
            body: `Great news! Your Hold Harmless Agreement has been fully signed and you are approved to proceed with work.

Project: ${project.project_name}
Subcontractor: ${coi.subcontractor_name}
Trade: ${coi.trade_type}

STATUS: ✅ APPROVED

The General Contractor has countersigned the agreement. You may now proceed with work on this project.

Agreement: ${coi.hold_harmless_sub_signed_url}

Best regards,
InsureTrack System`
          });
        } catch (err) {
          console.error('Failed to notify subcontractor:', err);
        }
      }

      // Notify GC (confirmation)
      if (project?.gc_email) {
        try {
          await sendEmail({
            to: project.gc_email,
            subject: `✅ Confirmation - Hold Harmless Signed - ${coi.subcontractor_name} - ${project.project_name}`,
            body: `Thank you for signing the Hold Harmless Agreement.

Project: ${project.project_name}
Subcontractor: ${coi.subcontractor_name}
Trade: ${coi.trade_type}

STATUS: ✅ FULLY SIGNED

All parties have been notified. The subcontractor is approved to proceed with work.

Signed agreement: ${coi.hold_harmless_sub_signed_url}

Best regards,
InsureTrack System`
          });
        } catch (err) {
          console.error('Failed to send GC confirmation:', err);
        }
      }

      alert('✅ Hold Harmless Agreement signed successfully! All parties have been notified.');
    },
    onError: (err) => {
      console.error('Failed to sign hold harmless:', err);
      alert('Failed to sign agreement. Please try again.');
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
            <p className="text-sm text-slate-600">{project.project_address || "Address not provided"}</p>
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
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {subs.map((sub) => (
                    <TableRow key={sub.id}>
                      <TableCell className="font-medium">{sub.subcontractor_name}</TableCell>
                      <TableCell>{sub.trade_type || ""}</TableCell>
                      <TableCell className="text-slate-600">{sub.contact_email || ""}</TableCell>
                      <TableCell>{renderStatusForSub(sub)}</TableCell>
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
