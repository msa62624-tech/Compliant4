import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { useState, useEffect } from "react";
import { apiClient, getApiBase } from "@/api/apiClient";
import { sendEmail } from "@/emailHelper";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { notifySubCOIApproved } from "@/brokerNotifications";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  ArrowLeft, Upload, CheckCircle2, XCircle, FileText,
  RefreshCw, Zap, AlertCircle, ExternalLink, Shield, X, Paperclip
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { format } from "date-fns";
import { validateCOICompliance } from "@/insuranceRequirements";

export default function COIReview() {
  const navigate = useNavigate();
  const urlParams = new URLSearchParams(window.location.search);
  const coiId = urlParams.get('id');
  const queryClient = useQueryClient();

  const [isManualEntryOpen, setIsManualEntryOpen] = useState(false);
  const [isFileUploadOpen, setIsFileUploadOpen] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [isDeficiencyDialogOpen, setIsDeficiencyDialogOpen] = useState(false);
  const [deficiencyText, setDeficiencyText] = useState('');
  const [deficiencySubject, setDeficiencySubject] = useState('');
  const [deficiencyAttachments, setDeficiencyAttachments] = useState([]);
  const [uploadingDeficiencyFile, setUploadingDeficiencyFile] = useState(false);
  const [includeEndorsementUpload, setIncludeEndorsementUpload] = useState(false);
  const [requireNewCOI, setRequireNewCOI] = useState(false);
  const [applyToAllProjects, setApplyToAllProjects] = useState(false);
  const [analyzingCompliance, setAnalyzingCompliance] = useState(false);
  const [programFile, setProgramFile] = useState(null);
  const [isProgramReviewRunning, setIsProgramReviewRunning] = useState(false);
  const [programReviewResult, setProgramReviewResult] = useState(null);
  const [isGeneratingCOI, setIsGeneratingCOI] = useState(false);
  const [isSigningCOI, setIsSigningCOI] = useState(false);

  // Mock user for admin context. In a real app, this would come from an auth context.
  const user = { email: 'admin@example.com', role: 'admin' };
  const isAdmin = user.role === 'admin';

  const [manualCOIData, setManualCOIData] = useState({
    insurance_carrier_gl: '',
    policy_number_gl: '',
    gl_each_occurrence: '',
    gl_general_aggregate: '',
    gl_products_completed_ops: '',
    gl_effective_date: '',
    gl_expiration_date: '',
    insurance_carrier_umbrella: '',
    policy_number_umbrella: '',
    umbrella_each_occurrence: '',
    umbrella_aggregate: '',
    umbrella_effective_date: '',
    umbrella_expiration_date: '',
    insurance_carrier_wc: '',
    policy_number_wc: '',
    wc_each_accident: '',
    wc_disease_policy_limit: '',
    wc_disease_each_employee: '',
    wc_effective_date: '',
    wc_expiration_date: '',
    insurance_carrier_auto: '',
    policy_number_auto: '',
    auto_combined_single_limit: '',
    auto_effective_date: '',
    auto_expiration_date: '',
    broker_name: '',
    broker_company: '',
    broker_email: '',
    broker_phone: '',
  });

  const { data: coi, isLoading: coiLoading } = useQuery({
    queryKey: ['coi', coiId],
    queryFn: async () => {
      const cois = await apiClient.entities.GeneratedCOI.list();
      return cois.find(c => c.id === coiId);
    },
    enabled: !!coiId,
  });

  const { data: project } = useQuery({
    queryKey: ['project', coi?.project_id],
    queryFn: async () => {
      const projects = await apiClient.entities.Project.list();
      return projects.find(p => p.id === coi.project_id);
    },
    enabled: !!coi?.project_id,
  });

  const { data: requirements = [] } = useQuery({
    queryKey: ['requirements', project?.program_id, coi?.trade_type],
    queryFn: async () => {
      if (!project?.program_id || !coi?.trade_type) return [];
      const allReqs = await apiClient.entities.SubInsuranceRequirement.filter({
        program_id: project.program_id
      });
      // Filter for this specific trade
      return allReqs.filter(r =>
        r.trade_types && Array.isArray(r.trade_types) && r.trade_types.includes(coi.trade_type)
      );
    },
    enabled: !!project?.program_id && !!coi?.trade_type,
  });

  const { data: program } = useQuery({
    queryKey: ['program', project?.program_id],
    queryFn: async () => {
      if (!project?.program_id) return null;
      try {
        return await apiClient.entities.InsuranceProgram.read(project.program_id);
      } catch (err) {
        console.error('Failed to load program', err);
        return null;
      }
    },
    enabled: !!project?.program_id,
  });

  const updateCOIMutation = useMutation({
    mutationFn: ({ id, data }) => apiClient.entities.GeneratedCOI.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['coi', coiId] });
      queryClient.invalidateQueries({ queryKey: ['pending-coi-reviews'] });
    },
  });

  const sendMessageMutation = useMutation({
    mutationFn: async ({ to, subject, body }) => {
      await sendEmail({ to, subject, body });
    },
  });

  // Auto-analyze compliance when COI is loaded for review
  useEffect(() => {
    // Only analyze if COI is loaded, project and requirements are available,
    // and there's no existing policy analysis or if the COI is awaiting review (meaning it might need re-analysis)
    if (coi && project && requirements.length > 0 &&
        (!coi.policy_analysis || coi.status === 'awaiting_admin_review')) {
      analyzeCompliance();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coi, project, requirements.length, coi?.policy_analysis, coi?.status]);

  const analyzeCompliance = async () => {
    if (!coi || !project || !requirements.length) {
      console.warn("Missing COI, Project, or Requirements data for compliance analysis.");
      return;
    }

    setAnalyzingCompliance(true);

    try {
      // First, run the tier-based compliance validation
      const subTrades = coi.trade_type ? coi.trade_type.split(',').map(t => t.trim().toLowerCase()) : [];
      const tierValidation = await validateCOICompliance(coi, project, subTrades);
      
      console.log('Tier Validation Result:', tierValidation);

      const reqContext = requirements.map(r => ({
        insurance_type: r.insurance_type,
        tier: r.tier_name,
        minimums: {
          gl_each_occurrence: r.gl_each_occurrence,
          gl_general_aggregate: r.gl_general_aggregate,
          gl_products_completed_ops: r.gl_products_completed_ops,
          umbrella_each_occurrence: r.umbrella_each_occurrence,
          umbrella_aggregate: r.umbrella_aggregate,
          wc_each_accident: r.wc_each_accident,
          wc_disease_policy_limit: r.wc_disease_policy_limit,
          wc_disease_each_employee: r.wc_disease_each_employee,
          auto_combined_single_limit: r.auto_combined_single_limit,
        },
        required_endorsements: {
          blanket_additional_insured: r.blanket_additional_insured,
          waiver_of_subrogation: r.waiver_of_subrogation_required,
          primary_non_contributory: r.primary_non_contributory,
          per_project_aggregate: r.per_project_aggregate,
        },
        trade_specific_flags: {
          no_condo_exclusion: r.no_condo_exclusion_required,
          no_height_restriction: r.no_height_restriction,
          no_action_over_exclusion: r.no_action_over_exclusion,
          no_hammer_clause: r.no_hammer_clause,
          no_subsidence_exclusion: r.no_subsidence_exclusion,
          no_roofing_limitation: r.no_roofing_limitation,
          no_direct_employee_exclusion: r.no_direct_employee_exclusion,
        }
      }));

      const coiDataProvided = {
        gl: coi.gl_each_occurrence ? {
          carrier: coi.insurance_carrier_gl,
          policy_number: coi.policy_number_gl,
          each_occurrence: coi.gl_each_occurrence,
          general_aggregate: coi.gl_general_aggregate,
          products_completed_ops: coi.gl_products_completed_ops,
          effective_date: coi.gl_effective_date,
          expiration_date: coi.gl_expiration_date,
        } : null,
        umbrella: coi.umbrella_each_occurrence ? {
          carrier: coi.insurance_carrier_umbrella,
          policy_number: coi.policy_number_umbrella,
          each_occurrence: coi.umbrella_each_occurrence,
          aggregate: coi.umbrella_aggregate,
          effective_date: coi.umbrella_effective_date,
          expiration_date: coi.umbrella_expiration_date,
        } : null,
        wc: coi.wc_each_accident ? {
          carrier: coi.insurance_carrier_wc,
          policy_number: coi.policy_number_wc,
          each_accident: coi.wc_each_accident,
          disease_policy_limit: coi.wc_disease_policy_limit,
          disease_each_employee: coi.wc_disease_each_employee,
          effective_date: coi.wc_effective_date,
          expiration_date: coi.wc_expiration_date,
        } : null,
        auto: coi.auto_combined_single_limit ? {
          carrier: coi.insurance_carrier_auto,
          policy_number: coi.policy_number_auto,
          combined_single_limit: coi.auto_combined_single_limit,
          effective_date: coi.auto_effective_date,
          expiration_date: coi.auto_expiration_date,
        } : null,
      };

      const glReq = requirements.find(r => r.insurance_type === 'general_liability');
      
      // Calculate effective umbrella
      let effectiveUmbrellaOccurrence = coi.umbrella_each_occurrence || 0;
      let effectiveUmbrellaAggregate = coi.umbrella_aggregate || 0;
      
      if (glReq && coi.gl_each_occurrence && coi.gl_each_occurrence > glReq.gl_each_occurrence) {
        effectiveUmbrellaOccurrence += (coi.gl_each_occurrence - glReq.gl_each_occurrence);
      }
      
      if (glReq && coi.gl_general_aggregate && coi.gl_general_aggregate > glReq.gl_general_aggregate) {
        effectiveUmbrellaAggregate += (coi.gl_general_aggregate - glReq.gl_general_aggregate);
      }

      const analysis = await apiClient.integrations.Core.ExtractDataFromUploadedFile({
        prompt: `You are analyzing a Certificate of Insurance for compliance. Check ALL items below systematically.

CRITICAL VERIFICATION CHECKLIST:
1. Named Insured - Must EXACTLY match subcontractor name
2. Policy Numbers - Must exist and match carrier format patterns
3. Insurance Carriers - Verify they are legitimate and match policy docs
4. Effective Date - Policy must be currently active
5. Expiration Date - Policy must NOT be expired
6. Coverage Limits - Must meet or EXCEED requirements
7. Coverage Types - Must include all required types (GL, WC, Auto, Umbrella)
8. Additional Insured - GC/project entities must be listed
9. Waiver of Subrogation - Must be present with endorsement
10. Primary & Non-Contributory - When required by contract
11. Certificate Holder - Should be the GC
12. Issue Date - Should be recent from broker

CRITICAL RULES:
1. ONLY flag deficiencies when coverage is LESS than required
2. HIGHER coverage is ALWAYS acceptable - never flag it
3. GL excess above required counts toward umbrella coverage
4. FLAG NAMED INSURED MISMATCH AS CRITICAL - this is a legal issue
5. FLAG MISSING ENDORSEMENTS OR MISMATCHES AS MAJOR/CRITICAL

PROJECT: ${project.project_name}
LOCATION: ${project.city}, ${project.state}
TYPE: ${project.project_type}
HEIGHT: ${project.height_stories || 'Unknown'} stories
SUBCONTRACTOR (Named Insured Must Match): ${coi.subcontractor_name}
TRADE: ${coi.trade_type}

REQUIREMENTS:
${JSON.stringify(reqContext, null, 2)}

COI DATA:
${JSON.stringify(coiDataProvided, null, 2)}

EFFECTIVE UMBRELLA (including GL excess):
- Each Occurrence: $${effectiveUmbrellaOccurrence.toLocaleString()}
- Aggregate: $${effectiveUmbrellaAggregate.toLocaleString()}

Analyze for deficiencies - check all 12 items above. Remember: ONLY flag coverage LESS than required, but DO FLAG named insured mismatches, missing endorsements, or date issues.`,
        add_context_from_internet: false,
        response_json_schema: {
          type: "object",
          properties: {
            overall_status: {
              type: "string",
              enum: ["compliant", "minor_issues", "major_issues", "critical_issues"]
            },
            compliance_score: { type: "number" },
            deficiencies: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  deficiency_id: { type: "string" },
                  category: { type: "string" },
                  insurance_type: { type: "string" },
                  severity: { type: "string" },
                  description: { type: "string" },
                  required_value: { type: "string" },
                  actual_value: { type: "string" },
                  remediation: { type: "string" },
                  can_be_overridden: { type: "boolean" }
                }
              }
            },
            summary: { type: "string" },
            approval_recommendation: { type: "string" }
          }
        }
      });

      // Merge tier validation issues with AI analysis
      // Determine compliance status based on tier validation
      const complianceStatus = tierValidation.compliant ? 'compliant' : 'issues';
      const overallStatus = tierValidation.compliant ? analysis.overall_status : 'critical_issues';
      
      const mergedAnalysis = {
        ...analysis,
        tierValidation: tierValidation,
        compliance_status: overallStatus,
      };

      await updateCOIMutation.mutateAsync({
        id: coi.id,
        data: { 
          policy_analysis: mergedAnalysis,
          compliance_status: complianceStatus,
          compliance_issues: tierValidation.issues || []
        }
      });

    } catch (error) {
      alert('Compliance analysis failed. Please review manually.');
    } finally {
      setAnalyzingCompliance(false);
    }
  };

  const runProgramReview = async () => {
    if (!project) {
      alert('Project not loaded.');
      return;
    }
    const reqContext = (requirements || []).map(r => ({
      insurance_type: r.insurance_type,
      tier: r.tier_name,
      minimums: {
        gl_each_occurrence: r.gl_each_occurrence,
        gl_general_aggregate: r.gl_general_aggregate,
        gl_products_completed_ops: r.gl_products_completed_ops,
        umbrella_each_occurrence: r.umbrella_each_occurrence,
        umbrella_aggregate: r.umbrella_aggregate,
        wc_each_accident: r.wc_each_accident,
        wc_disease_policy_limit: r.wc_disease_policy_limit,
        wc_disease_each_employee: r.wc_disease_each_employee,
        auto_combined_single_limit: r.auto_combined_single_limit,
      },
      required_endorsements: {
        blanket_additional_insured: r.blanket_additional_insured,
        waiver_of_subrogation: r.waiver_of_subrogation_required,
        primary_non_contributory: r.primary_non_contributory,
        per_project_aggregate: r.per_project_aggregate,
      }
    }));

    try {
      setIsProgramReviewRunning(true);
      let programFileUrl = null;
      if (programFile) {
        const uploadRes = await apiClient.integrations.Core.UploadFile({ file: programFile });
        programFileUrl = uploadRes.file_url || uploadRes.url || uploadRes.downloadUrl;
      }
      if (!programFileUrl && program?.program_pdf_url) {
        programFileUrl = program.program_pdf_url;
      }
      if (!programFileUrl) {
        alert('Please upload a Program PDF or set program_pdf_url on the Insurance Program.');
        setIsProgramReviewRunning(false);
        return;
      }

      const result = await apiClient.integrations.Public.ProgramReview({
        file_url: programFileUrl,
        requirements: reqContext
      });
      setProgramReviewResult(result);
    } catch (err) {
      console.error('Program review failed:', err);
      alert('Program review failed.');
    } finally {
      setIsProgramReviewRunning(false);
    }
  };

  const generateCOIFromSystem = async () => {
    if (!coi) return;
    try {
      setIsGeneratingCOI(true);
      await apiClient.integrations.Admin.GenerateCOI({ coi_id: coi.id });
      queryClient.invalidateQueries(['coi', coi.id]);
      alert('COI generated from system data and set to Pending.');
    } catch (err) {
      console.error('Generate COI failed:', err);
      alert('Failed to generate COI from system data.');
    } finally {
      setIsGeneratingCOI(false);
    }
  };

  const signCOIAsAdmin = async () => {
    if (!coi) return;
    if (!coi.first_coi_url) {
      alert('No COI PDF found to sign. Please generate first.');
      return;
    }
    try {
      setIsSigningCOI(true);
      await apiClient.integrations.Admin.SignCOI({ coi_id: coi.id });
      queryClient.invalidateQueries(['coi', coi.id]);
      alert('Admin signature applied. Final COI URL updated.');
    } catch (err) {
      console.error('Sign COI failed:', err);
      alert('Failed to apply admin signature.');
    } finally {
      setIsSigningCOI(false);
    }
  };

  const handleFileUpload = async (file) => {
    if (!file) return;

    setUploadingFile(true);
    try {
      const { file_url } = await apiClient.integrations.Core.UploadFile({ file });

      await updateCOIMutation.mutateAsync({
        id: coi.id,
        data: {
          first_coi_url: file_url,
          first_coi_uploaded: true,
          first_coi_upload_date: new Date().toISOString(),
          status: 'awaiting_admin_review', // New status for AI review
          uploaded_for_review_date: new Date().toISOString(),
          // Clear any previous analysis if a new file is uploaded
          // Removed policy_analysis: null, as new analysis will overwrite it, and trigger is below
        }
      });

      setIsFileUploadOpen(false);
      // Trigger analysis after file upload
      setTimeout(() => analyzeCompliance(), 1000);
    } catch (error) {
      alert('File upload failed. Please try again.');
    } finally {
      setUploadingFile(false);
    }
  };

  const handleManualEntry = () => {
    // Pre-fill form if data exists
    setManualCOIData({
      insurance_carrier_gl: coi.insurance_carrier_gl || '',
      policy_number_gl: coi.policy_number_gl || '',
      gl_each_occurrence: coi.gl_each_occurrence ? coi.gl_each_occurrence.toString() : '',
      gl_general_aggregate: coi.gl_general_aggregate ? coi.gl_general_aggregate.toString() : '',
      gl_products_completed_ops: coi.gl_products_completed_ops ? coi.gl_products_completed_ops.toString() : '',
      gl_effective_date: coi.gl_effective_date || '',
      gl_expiration_date: coi.gl_expiration_date || '',
      insurance_carrier_umbrella: coi.insurance_carrier_umbrella || '',
      policy_number_umbrella: coi.policy_number_umbrella || '',
      umbrella_each_occurrence: coi.umbrella_each_occurrence ? coi.umbrella_each_occurrence.toString() : '',
      umbrella_aggregate: coi.umbrella_aggregate ? coi.umbrella_aggregate.toString() : '',
      umbrella_effective_date: coi.umbrella_effective_date || '',
      umbrella_expiration_date: coi.umbrella_expiration_date || '',
      insurance_carrier_wc: coi.insurance_carrier_wc || '',
      policy_number_wc: coi.policy_number_wc || '',
      wc_each_accident: coi.wc_each_accident ? coi.wc_each_accident.toString() : '',
      wc_disease_policy_limit: coi.wc_disease_policy_limit ? coi.wc_disease_policy_limit.toString() : '',
      wc_disease_each_employee: coi.wc_disease_each_employee ? coi.wc_disease_each_employee.toString() : '',
      wc_effective_date: coi.wc_effective_date || '',
      wc_expiration_date: coi.wc_expiration_date || '',
      insurance_carrier_auto: coi.insurance_carrier_auto || '',
      policy_number_auto: coi.policy_number_auto || '',
      auto_combined_single_limit: coi.auto_combined_single_limit ? coi.auto_combined_single_limit.toString() : '',
      auto_effective_date: coi.auto_effective_date || '',
      auto_expiration_date: coi.auto_expiration_date || '',
      broker_name: coi.broker_name || '',
      broker_company: coi.broker_company || '',
      broker_email: coi.broker_email || '',
      broker_phone: coi.broker_phone || '',
    });
    setIsManualEntryOpen(true);
  };

  const handleSaveManualEntry = async () => {
    const updateData = {
      ...manualCOIData,
      gl_each_occurrence: manualCOIData.gl_each_occurrence ? Number(manualCOIData.gl_each_occurrence) : null,
      gl_general_aggregate: manualCOIData.gl_general_aggregate ? Number(manualCOIData.gl_general_aggregate) : null,
      gl_products_completed_ops: manualCOIData.gl_products_completed_ops ? Number(manualCOIData.gl_products_completed_ops) : null,
      wc_each_accident: manualCOIData.wc_each_accident ? Number(manualCOIData.wc_each_accident) : null,
      wc_disease_policy_limit: manualCOIData.wc_disease_policy_limit ? Number(manualCOIData.wc_disease_policy_limit) : null,
      wc_disease_each_employee: manualCOIData.wc_disease_each_employee ? Number(manualCOIData.wc_disease_each_employee) : null,
      umbrella_each_occurrence: manualCOIData.umbrella_each_occurrence ? Number(manualCOIData.umbrella_each_occurrence) : null,
      umbrella_aggregate: manualCOIData.umbrella_aggregate ? Number(manualCOIData.umbrella_aggregate) : null,
      auto_combined_single_limit: manualCOIData.auto_combined_single_limit ? Number(manualCOIData.auto_combined_single_limit) : null,
      first_coi_uploaded: true,
      first_coi_upload_date: new Date().toISOString(),
      status: 'awaiting_admin_review', // Set status to awaiting review after manual entry
      uploaded_for_review_date: new Date().toISOString(),
      // Clear any previous analysis if data is manually entered/edited
      policy_analysis: null,
    };

    await updateCOIMutation.mutateAsync({
      id: coi.id,
      data: updateData
    });

    setIsManualEntryOpen(false);
    // Trigger compliance analysis after manual entry
    // A small delay to ensure mutation completes and query cache is invalidated
    setTimeout(() => queryClient.invalidateQueries({ queryKey: ['coi', coiId] }), 500);
  };

  const buildHoldHarmlessHtml = async () => {
    const today = format(new Date(), 'MMMM d, yyyy');
    const aiList = [];
    if (project?.gc_name) {
      aiList.push(`${project.gc_name}${project.project_address ? ` — ${project.project_address}` : ''}`);
    }
    if (project?.owner_entity) {
      aiList.push(`${project.owner_entity} (Owner)`);
    }
    const extraAIs = Array.isArray(project?.additional_insured_entities)
      ? project.additional_insured_entities
      : (typeof project?.additional_insured_entities === 'string'
        ? project.additional_insured_entities.split(',').map(e => e.trim()).filter(Boolean)
        : []);
    extraAIs.forEach(ai => aiList.push(ai));

    const aiMarkup = aiList.length > 0
      ? aiList.map(ai => `<li>${ai}</li>`).join('')
      : '<li>General Contractor and Project Owner</li>';

    const replacements = {
      '{{PROJECT_NAME}}': project?.project_name || 'N/A',
      '{{PROJECT_ADDRESS}}': project?.project_address || project?.address || 'N/A',
      '{{GC_NAME}}': project?.gc_name || 'General Contractor',
      '{{OWNER_NAME}}': project?.owner_entity || 'Owner',
      '{{ADDITIONAL_INSUREDS}}': aiList.join(', ') || 'General Contractor; Project Owner',
      '{{SUBCONTRACTOR_NAME}}': coi?.subcontractor_name || 'Subcontractor',
      '{{TRADE_TYPE}}': coi?.trade_type || 'Trade',
      '{{DATE}}': today,
    };

    const mergeTemplate = (html) => {
      let output = html;
      Object.entries(replacements).forEach(([token, value]) => {
        const regex = new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
        output = output.replace(regex, value);
      });
      return output;
    };

    if (program?.hold_harmless_template_url) {
      try {
        const response = await fetch(program.hold_harmless_template_url);
        const text = await response.text();
        if (text) {
          return mergeTemplate(text);
        }
      } catch (err) {
        console.error('Failed to fetch program hold harmless template, falling back to default', err);
      }
    }

    return mergeTemplate(`<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <title>Hold Harmless Agreement - {{SUBCONTRACTOR_NAME}}</title>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; padding: 24px; color: #111; }
    h1 { font-size: 22px; margin-bottom: 8px; }
    h2 { font-size: 16px; margin-top: 20px; }
    .section { margin-top: 16px; }
    .muted { color: #555; font-size: 12px; }
    ul { margin: 8px 0 0 20px; }
    .signature { margin-top: 24px; }
  </style>
</head>
<body>
  <h1>Hold Harmless and Indemnification Agreement</h1>
  <p class="muted">Generated {{DATE}}</p>

  <div class="section">
    <strong>Project:</strong> {{PROJECT_NAME}}<br/>
    <strong>Location:</strong> {{PROJECT_ADDRESS}}<br/>
    <strong>Subcontractor:</strong> {{SUBCONTRACTOR_NAME}}<br/>
    <strong>Trade:</strong> {{TRADE_TYPE}}
  </div>

  <div class="section">
    <h2>Additional Insured / Certificate Holder</h2>
    <ul>${aiMarkup}</ul>
  </div>

  <div class="section">
    <p>The Subcontractor agrees to the fullest extent permitted by law to defend, indemnify, and hold harmless the General Contractor, Project Owner, and all listed Additional Insureds from and against any and all claims, damages, losses, and expenses arising out of or resulting from Subcontractor's work at the project.</p>
    <p>This obligation applies to claims attributable to bodily injury, sickness, disease, death, property damage, or loss, but only to the extent caused in whole or in part by the negligent acts or omissions of the Subcontractor, its employees, agents, or anyone directly or indirectly employed by them.</p>
  </div>

  <div class="section">
    <h2>Insurance Requirement Acknowledgement</h2>
    <p>Subcontractor confirms that the insurance policies evidenced by the Certificate of Insurance meet or exceed the project requirements and remain in force for the duration of the work. Any material change, cancellation, or non-renewal will be reported in accordance with policy terms.</p>
  </div>

  <div class="section">
    <h2>Signatures</h2>
    <p>Subcontractor Representative: _____________________________</p>
    <p>Date: _____________________________</p>
    <p>General Contractor Representative (for acknowledgment after receipt): _____________________________</p>
    <p>Date: _____________________________</p>
  </div>

  <div class="section muted">Please sign, date, and return. A fully executed copy will be shared with the General Contractor.</div>
</body>
</html>`);
  };

  const uploadHoldHarmlessTemplate = async () => {
    const html = await buildHoldHarmlessHtml();
    const blob = new Blob([html], { type: 'text/html' });
    const file = new File([blob], `hold-harmless-${coi?.id || 'agreement'}.html`, { type: 'text/html' });
    const uploadResult = await apiClient.integrations.Core.UploadFile({ file });
    return uploadResult?.file_url || uploadResult?.url || uploadResult?.downloadUrl || uploadResult?.data?.file_url || uploadResult?.data?.url || '';
  };

  const handleApprove = async () => {
    if (!confirm('Approve this COI? A hold harmless agreement will be required before work can proceed.')) return;

    // Check if hold harmless is already signed by subcontractor
    const signedStatuses = ['signed_by_sub', 'pending_gc_signature'];
    const alreadySignedHoldHarmless = signedStatuses.includes(coi.hold_harmless_status) || !!coi.hold_harmless_sub_signed_url;
    
    let holdHarmlessTemplateUrl = coi.hold_harmless_template_url;

    if (!holdHarmlessTemplateUrl) {
      try {
        holdHarmlessTemplateUrl = await uploadHoldHarmlessTemplate();
      } catch (templateErr) {
        console.error('Failed to generate Hold Harmless template:', templateErr);
      }
    }

    // Determine the appropriate hold harmless status
    const getHoldHarmlessStatus = () => {
      if (alreadySignedHoldHarmless) {
        // Preserve current status if already signed
        return coi.hold_harmless_status || 'signed_by_sub';
      }
      return 'pending_signature';
    };

    await updateCOIMutation.mutateAsync({
      id: coi.id,
      data: {
        status: 'active',
        admin_approved: true,
        review_date: new Date().toISOString(),
        hold_harmless_status: getHoldHarmlessStatus(),
        hold_harmless_template_url: holdHarmlessTemplateUrl || coi.hold_harmless_template_url || null,
      }
    });

    // Send approval notification with hold harmless requirement
    try {
      const subPortalLink = `${window.location.origin}${createPageUrl('subcontractor-dashboard')}?id=${coi.subcontractor_id || ''}`;
      const holdHarmlessInstructions = alreadySignedHoldHarmless
        ? `We have a signed Hold Harmless Agreement on file. No further action is needed on that document.`
        : `Please sign and return the Hold Harmless Agreement:
- Download template: ${holdHarmlessTemplateUrl || 'Template generating...'}
- Upload the signed copy: ${subPortalLink}

Work cannot proceed until the signed agreement is uploaded.`;

      await sendMessageMutation.mutateAsync({
        to: coi.contact_email || coi.broker_email,
        subject: `COI Approved ${alreadySignedHoldHarmless ? '- Hold Harmless On File' : '- Hold Harmless Required'} - ${project.project_name}`,
        body: `Good news! Your Certificate of Insurance for ${project.project_name} has been approved.

${holdHarmlessInstructions}

Project: ${project.project_name}
Subcontractor: ${coi.subcontractor_name}
Trade: ${coi.trade_type}

Thank you!`
      });
    } catch (err) {
      console.error('Failed to notify subcontractor:', err);
    }

    // Notify GC about approval and hold harmless requirement
    if (project?.gc_email) {
      try {
        await sendMessageMutation.mutateAsync({
          to: project.gc_email,
          subject: `✅ Insurance Approved - Hold Harmless ${alreadySignedHoldHarmless ? 'On File' : 'Pending'} - ${coi.subcontractor_name}`,
          body: `A subcontractor's insurance has been approved.

Project: ${project.project_name}
Subcontractor: ${coi.subcontractor_name}
Trade: ${coi.trade_type}

Status: APPROVED - ${alreadySignedHoldHarmless ? 'Hold Harmless on file' : 'Awaiting Hold Harmless Agreement Signature'}
${alreadySignedHoldHarmless ? 'Work may proceed from an indemnity standpoint.' : 'Work cannot proceed until the hold harmless agreement is signed.'}

${alreadySignedHoldHarmless ? '' : `Template: ${holdHarmlessTemplateUrl || 'Generating...'}
Subcontractor upload portal: ${window.location.origin}${createPageUrl('subcontractor-dashboard')}?id=${coi.subcontractor_id || ''}`}

View project: ${window.location.origin}${createPageUrl('ProjectDetails')}?id=${project.id}

Best regards,
InsureTrack Team`
        });
      } catch (err) {
        console.error('Failed to notify GC:', err);
      }
    }

    // Also notify broker asynchronously using dedicated broker notifications
    try {
      if (coi.subcontractor_id && project?.id) {
        const subcontractor = await apiClient.entities.Contractor.read(coi.subcontractor_id);
        await notifySubCOIApproved(coi, subcontractor, project);
      }
    } catch (err) {
      console.error('Failed to send broker approval notification:', err);
    }

    alert('COI approved! Hold harmless agreement signature is now required before work can begin.');
    navigate(createPageUrl("AdminDashboard"));
  };

  const handleSendDeficiency = async () => {
    if (!deficiencyText.trim()) {
      alert('Please enter deficiency details');
      return;
    }

    // Update COI status
    await updateCOIMutation.mutateAsync({
      id: coi.id,
      data: {
        status: 'deficiency_pending',
        deficiency_message: deficiencyText,
        deficiency_sent_date: new Date().toISOString(),
        requires_endorsement_upload: includeEndorsementUpload,
        requires_new_coi_after_endorsement: requireNewCOI,
        apply_endorsement_to_all_projects: applyToAllProjects,
      }
    });

    // Build broker upload links
    const brokerUploadLink = `${window.location.origin}${createPageUrl('broker-upload-coi')}?token=${coi.coi_token}`;
    const brokerDashboardLink = `${window.location.origin}${createPageUrl('broker-dashboard')}?email=${encodeURIComponent(coi.broker_email)}&coiId=${coi.id}`;
    const endorsementUploadLink = includeEndorsementUpload ? brokerUploadLink : null;

    // Helper function to build email sections
    const buildAttachmentsSection = () => {
      if (deficiencyAttachments.length === 0) return '';
      
      // Validate URLs are from trusted source (our upload system)
      const validatedAttachments = deficiencyAttachments.filter(file => {
        try {
          const fileUrl = new URL(file.url);
          const apiBaseUrl = new URL(getApiBase());
          // Only allow URLs from our API backend domain
          // Check protocol is https (or http for local dev) and hostname matches exactly
          const isValidProtocol = fileUrl.protocol === 'https:' || fileUrl.protocol === 'http:';
          const isValidHostname = fileUrl.hostname === apiBaseUrl.hostname;
          return isValidProtocol && isValidHostname;
        } catch {
          console.warn('Invalid attachment URL:', file.url);
          return false;
        }
      });
      
      if (validatedAttachments.length === 0) return '';
      
      return `\n\nATTACHED DOCUMENTS:\n${validatedAttachments.map((file, idx) => 
        `${idx + 1}. ${file.name}: ${file.url}`
      ).join('\n')}\n`;
    };

    const buildEndorsementSection = () => {
      if (!includeEndorsementUpload) return '';
      
      let section = '\n\n📎 ENDORSEMENT UPLOAD REQUIRED:\n';
      section += `Please upload the endorsement documents using this link: ${endorsementUploadLink}\n`;
      
      if (requireNewCOI) {
        section += '\n⚠️ NOTE: After uploading the endorsement, a new COI will need to be generated with the updated information.\n';
      }
      
      if (applyToAllProjects) {
        section += '\n📋 IMPORTANT: These changes will be applied to ALL projects this subcontractor is on, and new COIs will be generated for each project.\n';
      }
      
      return section;
    };

    const attachmentsSection = buildAttachmentsSection();
    const endorsementSection = buildEndorsementSection();

    // Determine subject line
    const emailSubject = deficiencySubject.trim() || `⚠️ COI Corrections Needed - ${project.project_name} (${coi.subcontractor_name})`;

    // Send deficiency notification to broker with all options
    await sendMessageMutation.mutateAsync({
      to: coi.contact_email || coi.broker_email,
      subject: emailSubject,
      body: `The Certificate of Insurance you submitted for ${coi.subcontractor_name} requires corrections before approval.

PROJECT:
• Project: ${project.project_name}
• Location: ${project.project_address}
• General Contractor: ${project.gc_name}
• Trade: ${coi.trade_type}

DEFICIENCIES IDENTIFIED:
${deficiencyText}${attachmentsSection}${endorsementSection}

ACTION REQUIRED:
You have two options:

OPTION 1: Upload Updated Documents
If the issues can be corrected with updated supporting documents (policy declarations, endorsements, etc.):
1. Upload the corrected documents here: ${brokerUploadLink}
2. Step 2: Policy Documents (attach updated GL, Umbrella, or other policies)
3. Submit for re-review

OPTION 2: Submit a New COI
If the certificate itself needs to be regenerated with different information:
1. Go to your broker portal: ${brokerDashboardLink}
2. Click "Upload" on this certificate request
3. Complete all three steps (COI upload, policies, and signature)
4. We'll review and approve once complete

TIMELINE:
Please submit corrections within 5 business days. After this period, the subcontractor may be marked non-compliant for this project.

QUESTIONS?
Reply to this email or contact the project administrator.

Best regards,
InsureTrack Team`
    });

    // Notify GC about deficiency
    if (project?.gc_email) {
      await sendMessageMutation.mutateAsync({
        to: project.gc_email,
        subject: `⚠️ Insurance Corrections Requested - ${coi.subcontractor_name} (${project.project_name})`,
        body: `A subcontractor's insurance certificate requires corrections before it can be approved.

PROJECT:
• Project: ${project.project_name}
• Subcontractor: ${coi.subcontractor_name}
• Trade: ${coi.trade_type}

STATUS: Deficiency Pending - Broker notified

ISSUES:
${deficiencyText}${endorsementSection}

We've notified the broker and expect corrections within 5 business days.

VIEW PROJECT:
${window.location.origin}${createPageUrl('ProjectDetails')}?id=${project.id}

Best regards,
InsureTrack Team`
      });
    }

    // Notify subcontractor
    const subDashboardLink = `${window.location.origin}${createPageUrl('subcontractor-dashboard')}?id=${coi.subcontractor_id}`;
    await sendMessageMutation.mutateAsync({
      to: coi.contact_email || coi.subcontractor_name,
      subject: `⚠️ Certificate Update Needed - ${project.project_name}`,
      body: `Your insurance certificate for ${project.project_name} needs updates before approval.

Your insurance broker has been notified of the required corrections. Please contact them to:
• Review the specific issues that need addressing
• Provide any additional documentation if needed
• Resubmit the corrected certificate or a new one

PROJECT: ${project.project_name}
GENERAL CONTRACTOR: ${project.gc_name}

Once your broker resubmits, we'll review and approve.

📊 DASHBOARD:
${subDashboardLink}

Best regards,
InsureTrack Team`
    });

    // Reset form and close dialog
    setIsDeficiencyDialogOpen(false);
    setDeficiencyText('');
    setDeficiencySubject('');
    setDeficiencyAttachments([]);
    setIncludeEndorsementUpload(false);
    setRequireNewCOI(false);
    setApplyToAllProjects(false);
    
    alert('Deficiency notification sent to broker, subcontractor, and GC!');
    navigate(createPageUrl("AdminDashboard"));
  };

  const handleOverrideDeficiency = async (deficiencyId, deficiency) => {
    const reason = prompt(`Override reason for: ${deficiency.description}\n\nEnter your reason for overriding this deficiency:`);

    if (!reason || !reason.trim()) {
      return;
    }

    try {
      const currentOverrides = coi.manual_overrides || [];
      const newOverride = {
        deficiency_id: deficiencyId,
        overridden_by: user?.email || 'admin',
        override_date: new Date().toISOString(),
        override_reason: reason.trim()
      };

      await updateCOIMutation.mutateAsync({
        id: coi.id,
        data: {
          manual_overrides: [...currentOverrides, newOverride]
        }
      });

      alert('✅ Deficiency overridden successfully');
    } catch (error) {
      alert('❌ Failed to override deficiency');
    }
  };

  const handleRemoveOverride = async (deficiencyId) => {
    if (!confirm('Remove this override?')) return;

    try {
      const currentOverrides = coi.manual_overrides || [];
      const updatedOverrides = currentOverrides.filter(o => o.deficiency_id !== deficiencyId);

      await updateCOIMutation.mutateAsync({
        id: coi.id,
        data: {
          manual_overrides: updatedOverrides
        }
      });

      alert('✅ Override removed');
    } catch (error) {
      alert('❌ Failed to remove override');
    }
  };

  const isDeficiencyOverridden = (deficiencyId) => {
    return (coi.manual_overrides || []).some(o => o.deficiency_id === deficiencyId);
  };

  const getOverrideInfo = (deficiencyId) => {
    return (coi.manual_overrides || []).find(o => o.deficiency_id === deficiencyId);
  };

  if (coiLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-4 md:p-8">
        <div className="max-w-7xl mx-auto space-y-6">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-96 w-full" />
        </div>
      </div>
    );
  }

  if (!coi) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-4 md:p-8 flex items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="p-8 text-center">
            <AlertCircle className="w-16 h-16 mx-auto text-red-500 mb-4" />
            <p className="text-slate-600 mb-4">COI not found</p>
            <Button onClick={() => navigate(createPageUrl("AdminDashboard"))}>
              Back to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const analysis = coi.policy_analysis;

  const getSeverityColor = (severity) => {
    switch (severity) {
      case 'critical': return 'red';
      case 'major': return 'orange';
      case 'minor': return 'yellow';
      default: return 'slate';
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'compliant': return 'emerald';
      case 'minor_issues': return 'blue';
      case 'major_issues': return 'amber';
      case 'critical_issues': return 'red';
      default: return 'slate';
    }
  };

  // Calculate active (non-overridden) deficiencies
  const activeDeficiencies = analysis?.deficiencies?.filter(def =>
    !isDeficiencyOverridden(def.deficiency_id || `${def.category}_${def.insurance_type}`)
  ) || [];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center gap-4 mb-6">
          <Button
            variant="outline"
            size="icon"
            onClick={() => navigate(createPageUrl("AdminDashboard"))}
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div className="flex-1">
            <h1 className="text-3xl font-bold text-slate-900">COI Review</h1>
            <p className="text-slate-600">{coi.subcontractor_name} - {coi.project_name}</p>
          </div>
          <Button
            onClick={() => setIsFileUploadOpen(true)}
            variant="outline"
            className="bg-green-50 text-green-700 hover:bg-green-100"
          >
            <Upload className="w-4 h-4 mr-2" />
            Upload COI File
          </Button>
          <Button
            onClick={handleManualEntry}
            variant="outline"
            className="bg-red-50 text-red-700 hover:bg-red-100"
          >
            <Upload className="w-4 h-4 mr-2" />
            Manual Entry / Edit
          </Button>
          <Button
            onClick={analyzeCompliance}
            variant="outline"
            disabled={analyzingCompliance || coi.status !== 'awaiting_admin_review'}
            className="bg-purple-50 text-purple-700 hover:bg-purple-100"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${analyzingCompliance ? 'animate-spin' : ''}`} />
            {analyzingCompliance ? 'Analyzing...' : 'Re-Analyze'}
          </Button>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setDeficiencyText(coi.deficiency_message || ''); // Pre-fill if exists
                setIsDeficiencyDialogOpen(true);
              }}
              className="border-red-300 text-red-700 hover:bg-red-50"
            >
              <XCircle className="w-4 h-4 mr-2" />
              Request Corrections
            </Button>
            <Button
              onClick={handleApprove}
              className="bg-emerald-600 hover:bg-emerald-700"
              disabled={updateCOIMutation.isPending}
            >
              <CheckCircle2 className="w-4 h-4 mr-2" />
              Approve
            </Button>
          </div>
        </div>

        {/* Insurance Details Summary - PROMINENT DISPLAY */}
        <Card className="border-2 border-red-400 shadow-xl bg-red-50">
          <CardHeader className="border-b bg-red-100">
            <CardTitle className="text-2xl font-bold text-red-900 flex items-center gap-2">
              <Shield className="w-6 h-6" />
              Insurance Coverage Summary
            </CardTitle>
            <p className="text-sm text-red-800 mt-2">Complete insurance details for {coi.subcontractor_name}</p>
          </CardHeader>
          <CardContent className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* GL Insurance */}
              <div className="bg-white rounded-lg border-2 border-red-200 p-4">
                <h4 className="font-bold text-slate-900 mb-3 text-lg">General Liability</h4>
                {coi.insurance_carrier_gl || coi.policy_number_gl ? (
                  <div className="space-y-2 text-sm">
                    {coi.insurance_carrier_gl && (
                      <div>
                        <p className="text-xs font-semibold text-slate-500">Carrier</p>
                        <p className="font-bold text-slate-900">{coi.insurance_carrier_gl}</p>
                      </div>
                    )}
                    {coi.policy_number_gl && (
                      <div>
                        <p className="text-xs font-semibold text-slate-500">Policy #</p>
                        <p className="font-mono text-slate-900">{coi.policy_number_gl}</p>
                      </div>
                    )}
                    {coi.gl_each_occurrence && (
                      <div>
                        <p className="text-xs font-semibold text-slate-500">Each Occurrence</p>
                        <p className="font-bold text-emerald-700">${Number(coi.gl_each_occurrence).toLocaleString()}</p>
                      </div>
                    )}
                    {coi.gl_general_aggregate && (
                      <div>
                        <p className="text-xs font-semibold text-slate-500">General Aggregate</p>
                        <p className="font-bold text-emerald-700">${Number(coi.gl_general_aggregate).toLocaleString()}</p>
                      </div>
                    )}
                    {coi.gl_effective_date && (
                      <div className="mt-2 pt-2 border-t">
                        <p className="text-xs text-slate-600">Valid: {format(new Date(coi.gl_effective_date), 'MMM d, yyyy')} - {coi.gl_expiration_date ? format(new Date(coi.gl_expiration_date), 'MMM d, yyyy') : 'N/A'}</p>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-slate-500 text-sm italic">Not provided</p>
                )}
              </div>

              {/* Umbrella Insurance */}
              <div className="bg-white rounded-lg border-2 border-rose-200 p-4">
                <h4 className="font-bold text-slate-900 mb-3 text-lg">Umbrella/Excess</h4>
                {coi.insurance_carrier_umbrella || coi.policy_number_umbrella ? (
                  <div className="space-y-2 text-sm">
                    {coi.insurance_carrier_umbrella && (
                      <div>
                        <p className="text-xs font-semibold text-slate-500">Carrier</p>
                        <p className="font-bold text-slate-900">{coi.insurance_carrier_umbrella}</p>
                      </div>
                    )}
                    {coi.policy_number_umbrella && (
                      <div>
                        <p className="text-xs font-semibold text-slate-500">Policy #</p>
                        <p className="font-mono text-slate-900">{coi.policy_number_umbrella}</p>
                      </div>
                    )}
                    {coi.umbrella_each_occurrence && (
                      <div>
                        <p className="text-xs font-semibold text-slate-500">Each Occurrence</p>
                        <p className="font-bold text-emerald-700">${Number(coi.umbrella_each_occurrence).toLocaleString()}</p>
                      </div>
                    )}
                    {coi.umbrella_aggregate && (
                      <div>
                        <p className="text-xs font-semibold text-slate-500">Aggregate</p>
                        <p className="font-bold text-emerald-700">${Number(coi.umbrella_aggregate).toLocaleString()}</p>
                      </div>
                    )}
                    {coi.umbrella_effective_date && (
                      <div className="mt-2 pt-2 border-t">
                        <p className="text-xs text-slate-600">Valid: {format(new Date(coi.umbrella_effective_date), 'MMM d, yyyy')} - {coi.umbrella_expiration_date ? format(new Date(coi.umbrella_expiration_date), 'MMM d, yyyy') : 'N/A'}</p>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-slate-500 text-sm italic">Not provided</p>
                )}
              </div>

              {/* Workers Compensation */}
              <div className="bg-white rounded-lg border-2 border-orange-200 p-4">
                <h4 className="font-bold text-slate-900 mb-3 text-lg">Workers Comp</h4>
                {coi.insurance_carrier_wc || coi.policy_number_wc ? (
                  <div className="space-y-2 text-sm">
                    {coi.insurance_carrier_wc && (
                      <div>
                        <p className="text-xs font-semibold text-slate-500">Carrier</p>
                        <p className="font-bold text-slate-900">{coi.insurance_carrier_wc}</p>
                      </div>
                    )}
                    {coi.policy_number_wc && (
                      <div>
                        <p className="text-xs font-semibold text-slate-500">Policy #</p>
                        <p className="font-mono text-slate-900">{coi.policy_number_wc}</p>
                      </div>
                    )}
                    {coi.wc_each_accident && (
                      <div>
                        <p className="text-xs font-semibold text-slate-500">Per Accident</p>
                        <p className="font-bold text-emerald-700">${Number(coi.wc_each_accident).toLocaleString()}</p>
                      </div>
                    )}
                    {coi.wc_disease_policy_limit && (
                      <div>
                        <p className="text-xs font-semibold text-slate-500">Disease Limit</p>
                        <p className="font-bold text-emerald-700">${Number(coi.wc_disease_policy_limit).toLocaleString()}</p>
                      </div>
                    )}
                    {coi.wc_effective_date && (
                      <div className="mt-2 pt-2 border-t">
                        <p className="text-xs text-slate-600">Valid: {format(new Date(coi.wc_effective_date), 'MMM d, yyyy')} - {coi.wc_expiration_date ? format(new Date(coi.wc_expiration_date), 'MMM d, yyyy') : 'N/A'}</p>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-slate-500 text-sm italic">Not provided</p>
                )}
              </div>

              {/* Auto Liability */}
              <div className="bg-white rounded-lg border-2 border-green-200 p-4">
                <h4 className="font-bold text-slate-900 mb-3 text-lg">Auto Liability</h4>
                {coi.insurance_carrier_auto || coi.policy_number_auto ? (
                  <div className="space-y-2 text-sm">
                    {coi.insurance_carrier_auto && (
                      <div>
                        <p className="text-xs font-semibold text-slate-500">Carrier</p>
                        <p className="font-bold text-slate-900">{coi.insurance_carrier_auto}</p>
                      </div>
                    )}
                    {coi.policy_number_auto && (
                      <div>
                        <p className="text-xs font-semibold text-slate-500">Policy #</p>
                        <p className="font-mono text-slate-900">{coi.policy_number_auto}</p>
                      </div>
                    )}
                    {coi.auto_combined_single_limit && (
                      <div>
                        <p className="text-xs font-semibold text-slate-500">Combined Single Limit</p>
                        <p className="font-bold text-emerald-700">${Number(coi.auto_combined_single_limit).toLocaleString()}</p>
                      </div>
                    )}
                    {coi.auto_effective_date && (
                      <div className="mt-2 pt-2 border-t">
                        <p className="text-xs text-slate-600">Valid: {format(new Date(coi.auto_effective_date), 'MMM d, yyyy')} - {coi.auto_expiration_date ? format(new Date(coi.auto_expiration_date), 'MMM d, yyyy') : 'N/A'}</p>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-slate-500 text-sm italic">Not provided</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* AI Compliance Analysis Section */}
        {analyzingCompliance && (
          <Alert className="bg-purple-50 border-purple-200">
            <Zap className="h-4 w-4 text-purple-600 animate-pulse" />
            <AlertDescription className="text-purple-900">
              <div className="flex items-center gap-2">
                <div className="animate-spin w-4 h-4 border-2 border-purple-600 border-t-transparent rounded-full"></div>
                <span className="font-semibold">AI Compliance Analysis in Progress...</span>
              </div>
              <p className="text-sm mt-1">Analyzing coverage amounts, exclusions, endorsements, and project-specific requirements</p>
            </AlertDescription>
          </Alert>
        )}

        {analysis && (
          <Card className={`border-2 border-${getStatusColor(analysis.overall_status)}-300 shadow-lg`}>
            <CardHeader className={`border-b bg-${getStatusColor(analysis.overall_status)}-50`}>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Zap className={`w-5 h-5 text-${getStatusColor(analysis.overall_status)}-600`} />
                  AI Compliance Analysis
                </CardTitle>
                <div className="flex items-center gap-3">
                  <Badge className={`bg-${getStatusColor(analysis.overall_status)}-100 text-${getStatusColor(analysis.overall_status)}-800 border border-${getStatusColor(analysis.overall_status)}-300`}>
                    Score: {analysis.compliance_score}/100
                  </Badge>
                  <Badge className={`bg-${getStatusColor(analysis.overall_status)}-100 text-${getStatusColor(analysis.overall_status)}-800 border border-${getStatusColor(analysis.overall_status)}-300 text-lg px-4 py-1`}>
                    {analysis.overall_status.replace(/_/g, ' ').toUpperCase()}
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              {/* Summary */}
              {analysis.summary && (
                <Alert className="bg-red-50 border-red-200">
                  <FileText className="h-4 w-4 text-red-600" />
                  <AlertDescription className="text-red-900">
                    <p className="font-semibold mb-2">Analysis Summary:</p>
                    <p className="text-sm">{analysis.summary}</p>
                  </AlertDescription>
                </Alert>
              )}

              {/* Critical Flags - Removed as schema no longer includes it */}

              {/* Deficiencies */}
              {coi.policy_analysis?.deficiencies && coi.policy_analysis.deficiencies.length > 0 ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-black text-slate-900">
                      🚨 Issues Found ({activeDeficiencies.length} active, {coi.manual_overrides?.length || 0} overridden)
                    </h3>
                  </div>
                  {coi.policy_analysis.deficiencies.map((deficiency, idx) => {
                    const defId = deficiency.deficiency_id || `${deficiency.category}_${deficiency.insurance_type}_${idx}`;
                    const isOverridden = isDeficiencyOverridden(defId);
                    const overrideInfo = getOverrideInfo(defId);

                    return (
                      <Card key={idx} className={`border-2 ${
                        isOverridden ? 'border-gray-300 bg-gray-50 opacity-60' :
                        deficiency.severity === 'critical' ? 'border-red-400 bg-red-50' :
                        deficiency.severity === 'major' ? 'border-orange-400 bg-orange-50' :
                        'border-yellow-400 bg-yellow-50'
                      }`}>
                        <CardContent className="p-4">
                          <div className="flex items-start gap-3">
                            <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                              isOverridden ? 'bg-gray-400' :
                              deficiency.severity === 'critical' ? 'bg-red-600' :
                              deficiency.severity === 'major' ? 'bg-orange-600' :
                              'bg-yellow-600'
                            }`}>
                              <span className="text-white font-black text-lg">{idx + 1}</span>
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2 flex-wrap">
                                {isOverridden ? (
                                  <>
                                    <Badge className="bg-gray-600 text-white">
                                      OVERRIDDEN
                                    </Badge>
                                    <Badge className={`${
                                      deficiency.severity === 'critical' ? 'bg-red-200 text-red-900' :
                                      deficiency.severity === 'major' ? 'bg-orange-200 text-orange-900' :
                                      'bg-yellow-200 text-yellow-900'
                                    }`}>
                                      {deficiency.severity.toUpperCase()} (Original)
                                    </Badge>
                                  </>
                                ) : (
                                  <Badge className={`${
                                    deficiency.severity === 'critical' ? 'bg-red-600 text-white' :
                                    deficiency.severity === 'major' ? 'bg-orange-600 text-white' :
                                    'bg-yellow-600 text-white'
                                  }`}>
                                    {deficiency.severity.toUpperCase()}
                                  </Badge>
                                )}
                                {deficiency.insurance_type && (
                                  <Badge variant="outline" className="bg-white">
                                    {deficiency.insurance_type}
                                  </Badge>
                                )}
                                <Badge variant="outline" className="bg-white text-xs">
                                  {deficiency.category.replace(/_/g, ' ')}
                                </Badge>
                              </div>

                              <p className={`font-bold mb-2 text-base ${isOverridden ? 'line-through text-gray-600' : 'text-slate-900'}`}>
                                {deficiency.description}
                              </p>

                              {isOverridden && overrideInfo && (
                                <Alert className="bg-red-50 border-red-300 mb-3">
                                  <AlertDescription className="text-sm">
                                    <p className="font-semibold text-red-900 mb-1">✅ Override Applied:</p>
                                    <p className="text-red-800 mb-1"><strong>By:</strong> {overrideInfo.overridden_by}</p>
                                    <p className="text-red-800 mb-1"><strong>Date:</strong> {format(new Date(overrideInfo.override_date), 'MMM d, yyyy h:mm a')}</p>
                                    <p className="text-red-800"><strong>Reason:</strong> {overrideInfo.override_reason}</p>
                                  </AlertDescription>
                                </Alert>
                              )}

                              {!isOverridden && (
                                <>
                                  <div className="grid md:grid-cols-2 gap-3 mb-3 text-sm">
                                    <div className="bg-white p-2 rounded border">
                                      <p className="text-xs font-semibold text-slate-500 mb-1">REQUIRED:</p>
                                      <p className="font-bold text-emerald-700">{deficiency.required_value}</p>
                                    </div>
                                    <div className="bg-white p-2 rounded border">
                                      <p className="text-xs font-semibold text-slate-500 mb-1">ACTUAL:</p>
                                      <p className="font-bold text-red-700">{deficiency.actual_value}</p>
                                    </div>
                                  </div>

                                  {deficiency.remediation && (
                                    <Alert className="bg-red-50 border-red-300 mt-3">
                                      <AlertDescription className="text-sm">
                                        <p className="font-semibold text-red-900 mb-1">💡 Recommended Fix:</p>
                                        <p className="text-red-800">{deficiency.remediation}</p>
                                      </AlertDescription>
                                    </Alert>
                                  )}
                                </>
                              )}

                              {isAdmin && (
                                <div className="mt-3 flex gap-2">
                                  {!isOverridden && (deficiency.can_be_overridden !== false) && (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => handleOverrideDeficiency(defId, deficiency)}
                                      className="border-red-300 text-red-700 hover:bg-red-50"
                                    >
                                      <CheckCircle2 className="w-3 h-3 mr-1" />
                                      Override This Issue
                                    </Button>
                                  )}
                                  {isOverridden && (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => handleRemoveOverride(defId)}
                                      className="border-red-300 text-red-700 hover:bg-red-50"
                                    >
                                      <XCircle className="w-3 h-3 mr-1" />
                                      Remove Override
                                    </Button>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}

                  {isAdmin && coi.policy_analysis.approval_recommendation && (
                    <Alert className={`border-2 mt-6 ${
                      activeDeficiencies.length === 0 ? 'bg-emerald-50 border-emerald-300' :
                      'bg-slate-900 border-slate-700'
                    }`}>
                      <AlertDescription className={activeDeficiencies.length === 0 ? 'text-emerald-900' : 'text-white'}>
                        <p className="font-black text-lg mb-2">
                          {activeDeficiencies.length === 0 ? '✅ All Issues Resolved!' : '🤖 AI Recommendation:'}
                        </p>
                        <p className="text-base">
                          {activeDeficiencies.length === 0 ?
                            'All deficiencies have been overridden. You can now approve this COI.' :
                            coi.policy_analysis.approval_recommendation === 'approve' ? '✅ Approve with minor notes' :
                            coi.policy_analysis.approval_recommendation === 'reject' ? '❌ Reject - Critical issues must be resolved' :
                            '⚠️ Request corrections from broker'
                          }
                        </p>
                      </AlertDescription>
                    </Alert>
                  )}
                </div>
              ) : (
                <Alert className="bg-emerald-50 border-emerald-300">
                  <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                  <AlertDescription className="text-emerald-900 font-semibold text-base">
                    ✅ All requirements met! No deficiencies found.
                  </AlertDescription>
                </Alert>
              )}

            </CardContent>
          </Card>
        )}

        {isAdmin && (
          <Card className="border-2 border-purple-300 shadow-lg mt-6">
            <CardHeader className="border-b bg-purple-50">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Zap className="w-5 h-5 text-purple-600" />
                  Program Review (Insurance Program)
                </CardTitle>
                <div className="flex items-center gap-2">
                  {program?.program_pdf_url && (
                    <a
                      href={program.program_pdf_url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-sm text-purple-700 hover:underline flex items-center gap-1"
                    >
                      <ExternalLink className="w-3 h-3" />
                      View Program PDF
                    </a>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={isGeneratingCOI}
                    onClick={generateCOIFromSystem}
                    className="ml-2 border-purple-300 text-purple-700 hover:bg-purple-50"
                  >
                    {isGeneratingCOI ? (
                      <span className="flex items-center gap-2"><RefreshCw className="w-3 h-3 animate-spin" /> Generating COI...</span>
                    ) : (
                      <span className="flex items-center gap-2"><FileText className="w-3 h-3" /> Generate COI</span>
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={isSigningCOI}
                    onClick={signCOIAsAdmin}
                    className="ml-2 border-green-300 text-green-700 hover:bg-green-50"
                  >
                    {isSigningCOI ? (
                      <span className="flex items-center gap-2"><RefreshCw className="w-3 h-3 animate-spin" /> Applying Signature...</span>
                    ) : (
                      <span className="flex items-center gap-2"><CheckCircle2 className="w-3 h-3" /> Admin Sign</span>
                    )}
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              <div className="grid md:grid-cols-2 gap-4 items-end">
                <div>
                  <Label htmlFor="program-file">Upload Program PDF (optional)</Label>
                  <Input
                    id="program-file"
                    type="file"
                    accept="application/pdf"
                    onChange={(e) => setProgramFile(e.target.files?.[0] || null)}
                    className="mt-2"
                  />
                  <p className="text-xs text-slate-500 mt-1">
                    Use the uploaded file or the saved program PDF.
                  </p>
                </div>
                <div className="flex md:justify-end">
                  <Button
                    variant="default"
                    disabled={isProgramReviewRunning || (!programFile && !program?.program_pdf_url)}
                    onClick={runProgramReview}
                    className="bg-purple-600 hover:bg-purple-700"
                  >
                    {isProgramReviewRunning ? (
                      <span className="flex items-center gap-2">
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        Running Program Review...
                      </span>
                    ) : (
                      <span className="flex items-center gap-2">
                        <Zap className="w-4 h-4" />
                        Run Program Review
                      </span>
                    )}
                  </Button>
                </div>
              </div>

              {isProgramReviewRunning && (
                <Alert className="bg-purple-50 border-purple-200">
                  <AlertCircle className="h-4 w-4 text-purple-600" />
                  <AlertDescription className="text-purple-900">
                    <div className="flex items-center gap-2">
                      <div className="animate-spin w-4 h-4 border-2 border-purple-600 border-t-transparent rounded-full"></div>
                      <span className="font-semibold">Analyzing Insurance Program...</span>
                    </div>
                    <p className="text-sm mt-1">Extracting policy data, comparing to requirements, and generating recommendations.</p>
                  </AlertDescription>
                </Alert>
              )}

              {programReviewResult && (
                <div className="space-y-6">
                  <Card className="border-2 border-purple-200">
                    <CardHeader className="bg-purple-50">
                      <CardTitle className="text-purple-800">Summary</CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 space-y-3">
                      {programReviewResult.compliance?.summary && (
                        <Alert className="bg-red-50 border-red-200">
                          <FileText className="h-4 w-4 text-red-600" />
                          <AlertDescription className="text-red-900">
                            <p className="font-semibold mb-2">Compliance Summary:</p>
                            <p className="text-sm">{programReviewResult.compliance.summary}</p>
                          </AlertDescription>
                        </Alert>
                      )}

                      {programReviewResult.programData?.text_preview && (
                        <div className="bg-white rounded border p-3">
                          <p className="text-xs font-semibold text-slate-500 mb-1">Program Text Preview</p>
                          <pre className="text-xs whitespace-pre-wrap text-slate-800 max-h-48 overflow-auto">{programReviewResult.programData.text_preview}</pre>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  <div className="grid md:grid-cols-2 gap-4">
                    <Card className="border-2 border-emerald-200">
                      <CardHeader className="bg-emerald-50">
                        <CardTitle className="text-emerald-800">Extracted Policy Data</CardTitle>
                      </CardHeader>
                      <CardContent className="p-4 space-y-2 text-sm">
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <p className="text-xs text-slate-500">Policy #</p>
                            <p className="font-mono">{programReviewResult.policyData?.policy_number || 'N/A'}</p>
                          </div>
                          <div>
                            <p className="text-xs text-slate-500">Insurer</p>
                            <p className="font-bold">{programReviewResult.policyData?.insurer_name || 'N/A'}</p>
                          </div>
                          <div>
                            <p className="text-xs text-slate-500">Coverage Type</p>
                            <p>{programReviewResult.policyData?.coverage_type || 'N/A'}</p>
                          </div>
                          <div>
                            <p className="text-xs text-slate-500">Effective</p>
                            <p>{programReviewResult.policyData?.effective_date || 'N/A'}</p>
                          </div>
                          <div>
                            <p className="text-xs text-slate-500">Expiration</p>
                            <p>{programReviewResult.policyData?.expiration_date || 'N/A'}</p>
                          </div>
                          <div>
                            <p className="text-xs text-slate-500">Limits (Each / Agg)</p>
                            <p>{programReviewResult.policyData?.limits?.each_occurrence || '—'} / {programReviewResult.policyData?.limits?.aggregate || '—'}</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="border-2 border-yellow-200">
                      <CardHeader className="bg-yellow-50">
                        <CardTitle className="text-yellow-800">Risk Assessment</CardTitle>
                      </CardHeader>
                      <CardContent className="p-4 space-y-2 text-sm">
                        <div className="flex items-center gap-2">
                          <Badge className="bg-yellow-100 text-yellow-800 border border-yellow-300">Level: {programReviewResult.risk?.level || 'N/A'}</Badge>
                          <Badge className="bg-yellow-100 text-yellow-800 border border-yellow-300">Score: {programReviewResult.risk?.score ?? 'N/A'}</Badge>
                        </div>
                        {Array.isArray(programReviewResult.risk?.factors) && programReviewResult.risk.factors.length > 0 && (
                          <div className="mt-2">
                            <p className="text-xs text-slate-500 mb-1">Factors</p>
                            <ul className="list-disc list-inside text-slate-800">
                              {programReviewResult.risk.factors.map((f, i) => (
                                <li key={`risk-factor-${i}-${f.substring(0,20)}`}>{f}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </div>

                  <Card className="border-2 border-orange-200">
                    <CardHeader className="bg-orange-50">
                      <CardTitle className="text-orange-800">Deficiencies</CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 space-y-3">
                      {Array.isArray(programReviewResult.compliance?.deficiencies) && programReviewResult.compliance.deficiencies.length > 0 ? (
                        programReviewResult.compliance.deficiencies.slice(0, 10).map((d, idx) => (
                          <div key={idx} className="border rounded p-3 bg-white">
                            <div className="flex items-center gap-2 mb-1">
                              <Badge className={
                                d.severity === 'critical' ? 'bg-red-600 text-white' :
                                d.severity === 'major' ? 'bg-orange-600 text-white' :
                                'bg-yellow-600 text-white'
                              }>
                                {d.severity?.toUpperCase() || 'ISSUE'}
                              </Badge>
                              {d.category && (
                                <Badge variant="outline" className="bg-white">{d.category}</Badge>
                              )}
                            </div>
                            <p className="font-bold text-slate-900">{d.title || d.description || 'Issue'}</p>
                            {d.description && (
                              <p className="text-sm text-slate-700 mt-1">{d.description}</p>
                            )}
                            {d.required_action && (
                              <p className="text-xs text-slate-600 mt-2"><span className="font-semibold">Action:</span> {d.required_action}</p>
                            )}
                          </div>
                        ))
                      ) : (
                        <Alert className="bg-emerald-50 border-emerald-300">
                          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                          <AlertDescription className="text-emerald-900">No deficiencies identified in program review.</AlertDescription>
                        </Alert>
                      )}
                    </CardContent>
                  </Card>

                  {Array.isArray(programReviewResult.recommendations) && programReviewResult.recommendations.length > 0 && (
                    <Card className="border-2 border-red-200">
                      <CardHeader className="bg-red-50">
                        <CardTitle className="text-red-800">Recommendations</CardTitle>
                      </CardHeader>
                      <CardContent className="p-4">
                        <ul className="list-disc list-inside text-slate-800 space-y-1">
                          {programReviewResult.recommendations.map((r, i) => (
                            <li key={`recommendation-${i}-${r.substring(0,20)}`} className="text-sm">{r}</li>
                          ))}
                        </ul>
                      </CardContent>
                    </Card>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Project & Subcontractor Info */}
        <div className="grid md:grid-cols-2 gap-6">
          <Card>
            <CardHeader className="border-b">
              <CardTitle className="text-lg">Project Information</CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-3">
              <div>
                <p className="text-sm text-slate-500">Project Name</p>
                <p className="font-medium text-slate-900">{coi.project_name}</p>
              </div>
              <div>
                <p className="text-sm text-slate-500">General Contractor</p>
                <p className="font-medium text-slate-900">{coi.gc_name}</p>
              </div>
              <div>
                <p className="text-sm text-slate-500">Location</p>
                <p className="font-medium text-slate-900">{coi.project_address}</p>
              </div>
              {project && (
                <>
                  <div>
                    <p className="text-sm text-slate-500">Project Type</p>
                    <Badge>{project.project_type}</Badge>
                  </div>
                  {project.unit_count && (
                    <div>
                      <p className="text-sm text-slate-500">Unit Count</p>
                      <p className="font-medium text-slate-900">{project.unit_count} units</p>
                    </div>
                  )}
                  {project.height_stories && (
                    <div>
                      <p className="text-sm text-slate-500">Height</p>
                      <p className="font-medium text-slate-900">{project.height_stories} stories</p>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="border-b">
              <CardTitle className="text-lg">Subcontractor & Broker</CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-3">
              <div>
                <p className="text-sm text-slate-500">Subcontractor</p>
                <p className="font-medium text-slate-900">{coi.subcontractor_name}</p>
              </div>
              <div>
                <p className="text-sm text-slate-500">Trade Type</p>
                <Badge variant="outline" className="bg-red-50 text-red-700">{coi.trade_type}</Badge>
              </div>
              <div>
                <p className="text-sm text-slate-500">Broker Company</p>
                <p className="font-medium text-slate-900">{coi.broker_company || 'N/A'}</p>
              </div>
              <div>
                <p className="text-sm text-slate-500">Broker Contact</p>
                <p className="font-medium text-slate-900">{coi.broker_name || 'N/A'}</p>
                <p className="text-sm text-slate-600">{coi.broker_email}</p>
              </div>
              <div>
                <p className="text-sm text-slate-500">Uploaded</p>
                <p className="font-medium text-slate-900">
                  {coi.uploaded_for_review_date ? format(new Date(coi.uploaded_for_review_date), 'MMM d, yyyy h:mm a') : 'N/A'}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Documents */}
        <Card>
          <CardHeader className="border-b">
            <CardTitle className="text-lg">Uploaded Documents</CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="grid md:grid-cols-3 gap-4">
              {coi.first_coi_url && (
                <Button variant="outline" className="justify-start" asChild>
                  <a href={coi.first_coi_url} target="_blank" rel="noopener noreferrer">
                    <FileText className="w-4 h-4 mr-2" />
                    ACORD 25 Certificate
                    <ExternalLink className="w-3 h-3 ml-auto" />
                  </a>
                </Button>
              )}
              {coi.gl_policy_url && (
                <Button variant="outline" className="justify-start" asChild>
                  <a href={coi.gl_policy_url} target="_blank" rel="noopener noreferrer">
                    <FileText className="w-4 h-4 mr-2" />
                    GL Policy
                    <ExternalLink className="w-3 h-3 ml-auto" />
                  </a>
                </Button>
              )}
              {coi.umbrella_policy_url && (
                <Button variant="outline" className="justify-start" asChild>
                  <a href={coi.umbrella_policy_url} target="_blank" rel="noopener noreferrer">
                    <FileText className="w-4 h-4 mr-2" />
                    Umbrella Policy
                    <ExternalLink className="w-3 h-3 ml-auto" />
                  </a>
                </Button>
              )}
              {coi.wc_policy_url && (
                <Button variant="outline" className="justify-start" asChild>
                  <a href={coi.wc_policy_url} target="_blank" rel="noopener noreferrer">
                    <FileText className="w-4 h-4 mr-2" />
                    WC Policy
                    <ExternalLink className="w-3 h-3 ml-auto" />
                  </a>
                </Button>
              )}
              {coi.auto_policy_url && (
                <Button variant="outline" className="justify-start" asChild>
                  <a href={coi.auto_policy_url} target="_blank" rel="noopener noreferrer">
                    <FileText className="w-4 h-4 mr-2" />
                    Auto Policy
                    <ExternalLink className="w-3 h-3 ml-auto" />
                  </a>
                </Button>
              )}
              {coi.professional_liability_policy_url && (
                <Button variant="outline" className="justify-start" asChild>
                  <a href={coi.professional_liability_policy_url} target="_blank" rel="noopener noreferrer">
                    <FileText className="w-4 h-4 mr-2" />
                    Professional Liability
                    <ExternalLink className="w-3 h-3 ml-auto" />
                  </a>
                </Button>
              )}
              {coi.pollution_liability_policy_url && (
                <Button variant="outline" className="justify-start" asChild>
                  <a href={coi.pollution_liability_policy_url} target="_blank" rel="noopener noreferrer">
                    <FileText className="w-4 h-4 mr-2" />
                    Pollution Liability
                    <ExternalLink className="w-3 h-3 ml-auto" />
                  </a>
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Manual Entry Dialog */}
      <Dialog open={isManualEntryOpen} onOpenChange={setIsManualEntryOpen}>
        <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">Manual COI Data Entry</DialogTitle>
            <DialogDescription>
              Enter policy details manually to complete the COI when auto-extraction is not available.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <Alert className="bg-red-50 border-red-200">
              <AlertCircle className="h-4 w-4 text-red-600" />
              <AlertDescription className="text-red-900 text-sm">
                Enter insurance policy information manually. This will mark the COI as uploaded and ready for AI review.
              </AlertDescription>
            </Alert>

            {/* General Liability */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-slate-900 border-b pb-2">General Liability</h3>
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Insurance Carrier</Label>
                  <Input
                    value={manualCOIData.insurance_carrier_gl}
                    onChange={(e) => setManualCOIData({...manualCOIData, insurance_carrier_gl: e.target.value})}
                    placeholder="ABC Insurance Company"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Policy Number</Label>
                  <Input
                    value={manualCOIData.policy_number_gl}
                    onChange={(e) => setManualCOIData({...manualCOIData, policy_number_gl: e.target.value})}
                    placeholder="GL123456789"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Each Occurrence Limit</Label>
                  <Input
                    type="number"
                    value={manualCOIData.gl_each_occurrence}
                    onChange={(e) => setManualCOIData({...manualCOIData, gl_each_occurrence: e.target.value})}
                    placeholder="2000000"
                  />
                </div>
                <div className="space-y-2">
                  <Label>General Aggregate Limit</Label>
                  <Input
                    type="number"
                    value={manualCOIData.gl_general_aggregate}
                    onChange={(e) => setManualCOIData({...manualCOIData, gl_general_aggregate: e.target.value})}
                    placeholder="4000000"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Products/Completed Operations Aggregate</Label>
                  <Input
                    type="number"
                    value={manualCOIData.gl_products_completed_ops}
                    onChange={(e) => setManualCOIData({...manualCOIData, gl_products_completed_ops: e.target.value})}
                    placeholder="2000000"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Effective Date</Label>
                  <Input
                    type="date"
                    value={manualCOIData.gl_effective_date}
                    onChange={(e) => setManualCOIData({...manualCOIData, gl_effective_date: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Expiration Date</Label>
                  <Input
                    type="date"
                    value={manualCOIData.gl_expiration_date}
                    onChange={(e) => setManualCOIData({...manualCOIData, gl_expiration_date: e.target.value})}
                  />
                </div>
              </div>
            </div>

            {/* Workers Compensation */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-slate-900 border-b pb-2">Workers Compensation</h3>
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Insurance Carrier</Label>
                  <Input
                    value={manualCOIData.insurance_carrier_wc}
                    onChange={(e) => setManualCOIData({...manualCOIData, insurance_carrier_wc: e.target.value})}
                    placeholder="XYZ Workers Comp"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Policy Number</Label>
                  <Input
                    value={manualCOIData.policy_number_wc}
                    onChange={(e) => setManualCOIData({...manualCOIData, policy_number_wc: e.target.value})}
                    placeholder="WC123456789"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Each Accident Limit</Label>
                  <Input
                    type="number"
                    value={manualCOIData.wc_each_accident}
                    onChange={(e) => setManualCOIData({...manualCOIData, wc_each_accident: e.target.value})}
                    placeholder="1000000"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Disease Policy Limit</Label>
                  <Input
                    type="number"
                    value={manualCOIData.wc_disease_policy_limit}
                    onChange={(e) => setManualCOIData({...manualCOIData, wc_disease_policy_limit: e.target.value})}
                    placeholder="1000000"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Disease Each Employee Limit</Label>
                  <Input
                    type="number"
                    value={manualCOIData.wc_disease_each_employee}
                    onChange={(e) => setManualCOIData({...manualCOIData, wc_disease_each_employee: e.target.value})}
                    placeholder="1000000"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Effective Date</Label>
                  <Input
                    type="date"
                    value={manualCOIData.wc_effective_date}
                    onChange={(e) => setManualCOIData({...manualCOIData, wc_effective_date: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Expiration Date</Label>
                  <Input
                    type="date"
                    value={manualCOIData.wc_expiration_date}
                    onChange={(e) => setManualCOIData({...manualCOIData, wc_expiration_date: e.target.value})}
                  />
                </div>
              </div>
            </div>

            {/* Umbrella (if required) */}
            {coi.requires_umbrella && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-slate-900 border-b pb-2">Umbrella Policy</h3>
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Insurance Carrier</Label>
                    <Input
                      value={manualCOIData.insurance_carrier_umbrella}
                      onChange={(e) => setManualCOIData({...manualCOIData, insurance_carrier_umbrella: e.target.value})}
                      placeholder="Umbrella Insurance Co"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Policy Number</Label>
                    <Input
                      value={manualCOIData.policy_number_umbrella}
                      onChange={(e) => setManualCOIData({...manualCOIData, policy_number_umbrella: e.target.value})}
                      placeholder="UMB123456789"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Each Occurrence Limit</Label>
                    <Input
                      type="number"
                      value={manualCOIData.umbrella_each_occurrence}
                      onChange={(e) => setManualCOIData({...manualCOIData, umbrella_each_occurrence: e.target.value})}
                      placeholder="5000000"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Aggregate Limit</Label>
                    <Input
                      type="number"
                      value={manualCOIData.umbrella_aggregate}
                      onChange={(e) => setManualCOIData({...manualCOIData, umbrella_aggregate: e.target.value})}
                      placeholder="5000000"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Effective Date</Label>
                    <Input
                      type="date"
                      value={manualCOIData.umbrella_effective_date}
                      onChange={(e) => setManualCOIData({...manualCOIData, umbrella_effective_date: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Expiration Date</Label>
                  <Input
                    type="date"
                    value={manualCOIData.umbrella_expiration_date}
                    onChange={(e) => setManualCOIData({...manualCOIData, umbrella_expiration_date: e.target.value})}
                  />
                </div>
              </div>
            </div>
            )}

            {/* Auto Liability */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-slate-900 border-b pb-2">Auto Liability (Optional)</h3>
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Insurance Carrier</Label>
                  <Input
                    value={manualCOIData.insurance_carrier_auto}
                    onChange={(e) => setManualCOIData({...manualCOIData, insurance_carrier_auto: e.target.value})}
                    placeholder="Auto Insurance Co"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Policy Number</Label>
                  <Input
                    value={manualCOIData.policy_number_auto}
                    onChange={(e) => setManualCOIData({...manualCOIData, policy_number_auto: e.target.value})}
                    placeholder="AUTO123456789"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Combined Single Limit</Label>
                  <Input
                    type="number"
                    value={manualCOIData.auto_combined_single_limit}
                    onChange={(e) => setManualCOIData({...manualCOIData, auto_combined_single_limit: e.target.value})}
                    placeholder="1000000"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Effective Date</Label>
                  <Input
                    type="date"
                    value={manualCOIData.auto_effective_date}
                    onChange={(e) => setManualCOIData({...manualCOIData, auto_effective_date: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Expiration Date</Label>
                  <Input
                    type="date"
                    value={manualCOIData.auto_expiration_date}
                    onChange={(e) => setManualCOIData({...manualCOIData, auto_expiration_date: e.target.value})}
                  />
                </div>
              </div>
            </div>

            {/* Broker Information */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-slate-900 border-b pb-2">Broker Information (Optional)</h3>
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Broker Name</Label>
                  <Input
                    value={manualCOIData.broker_name}
                    onChange={(e) => setManualCOIData({...manualCOIData, broker_name: e.target.value})}
                    placeholder="Broker Name"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Broker Company</Label>
                  <Input
                    value={manualCOIData.broker_company}
                    onChange={(e) => setManualCOIData({...manualCOIData, broker_company: e.target.value})}
                    placeholder="Broker Company"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Broker Email</Label>
                  <Input
                    type="email"
                    value={manualCOIData.broker_email}
                    onChange={(e) => setManualCOIData({...manualCOIData, broker_email: e.target.value})}
                    placeholder="broker@example.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Broker Phone</Label>
                  <Input
                    type="tel"
                    value={manualCOIData.broker_phone}
                    onChange={(e) => setManualCOIData({...manualCOIData, broker_phone: e.target.value})}
                    placeholder="(123) 456-7890"
                  />
                </div>
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setIsManualEntryOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSaveManualEntry}
              className="bg-red-600 hover:bg-red-700"
              disabled={updateCOIMutation.isPending}
            >
              Save & Submit for AI Review
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* File Upload Dialog */}
      <Dialog open={isFileUploadOpen} onOpenChange={setIsFileUploadOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">Upload COI File</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <Alert className="bg-red-50 border-red-200">
              <AlertCircle className="h-4 w-4 text-red-600" />
              <AlertDescription className="text-red-900 text-sm">
                Upload the Certificate of Insurance file (PDF, PNG, or JPG). This will mark the COI as uploaded and ready for AI review.
              </AlertDescription>
            </Alert>

            <div className="space-y-2">
              <Label htmlFor="coi-upload">Select COI File</Label>
              <Input
                id="coi-upload"
                type="file"
                accept=".pdf,.png,.jpg,.jpeg"
                onChange={(e) => {
                  const file = e.target.files[0];
                  if (file) {
                    handleFileUpload(file);
                  }
                }}
                disabled={uploadingFile}
              />
            </div>

            {uploadingFile && (
              <div className="text-center py-6">
                <div className="animate-spin w-12 h-12 border-4 border-red-600 border-t-transparent rounded-full mx-auto mb-3"></div>
                <p className="text-sm text-slate-600 font-medium">Uploading file...</p>
                <p className="text-xs text-slate-500 mt-1">Please wait</p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsFileUploadOpen(false)}
              disabled={uploadingFile}
            >
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Deficiency Dialog */}
      <Dialog open={isDeficiencyDialogOpen} onOpenChange={setIsDeficiencyDialogOpen}>
        <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-red-900">
              Request Corrections
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {analysis && analysis.deficiencies && analysis.deficiencies.length > 0 && (
              <Alert className="bg-red-50 border-red-200">
                <FileText className="h-4 w-4 text-red-600" />
                <AlertDescription className="text-red-900">
                  <p className="font-semibold mb-2">AI-Identified Issues (click to auto-fill):</p>
                  <div className="space-y-1">
                    {analysis.deficiencies.map((def, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => {
                          const defTextToAppend = `${def.insurance_type?.toUpperCase() || ''} - ${def.category.replace(/_/g, ' ')}: ${def.description}${def.remediation ? `\nFix: ${def.remediation}` : ''}`;
                          setDeficiencyText(prev => prev ? `${prev}\n\n${defTextToAppend}` : defTextToAppend);
                        }}
                        className="block w-full text-left text-xs p-2 hover:bg-red-100 rounded transition-colors"
                      >
                        <Badge className={`bg-${getSeverityColor(def.severity)}-200 text-${getSeverityColor(def.severity)}-900 mr-2`}>
                          {def.severity}
                        </Badge>
                        {def.description}
                      </button>
                    ))}
                  </div>
                </AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="deficiency-subject">
                Email Subject <span className="text-red-500">*</span>
              </Label>
              <Input
                id="deficiency-subject"
                value={deficiencySubject}
                onChange={(e) => setDeficiencySubject(e.target.value)}
                placeholder={`⚠️ COI Corrections Needed - ${project?.project_name || ''} (${coi?.subcontractor_name || ''})`}
              />
              <p className="text-xs text-slate-500">
                Customize the email subject line
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="deficiency">
                Deficiency Details <span className="text-red-500">*</span>
              </Label>
              <Textarea
                id="deficiency"
                value={deficiencyText}
                onChange={(e) => setDeficiencyText(e.target.value)}
                placeholder="List all items that need correction..."
                className="min-h-48"
                required
              />
              <p className="text-xs text-slate-500">
                This will be sent to the broker/subcontractor. Be specific about what needs correction.
              </p>
            </div>

            {/* Attachments Section */}
            <div className="space-y-2">
              <Label>Attachments (Optional)</Label>
              <div className="border-2 border-dashed border-slate-300 rounded-lg p-4">
                <Input
                  type="file"
                  multiple
                  onChange={async (e) => {
                    const files = Array.from(e.target.files || []);
                    if (files.length === 0) return;
                    
                    setUploadingDeficiencyFile(true);
                    try {
                      const uploadedFiles = [];
                      for (const file of files) {
                        const result = await apiClient.integrations.Core.UploadFile({ file });
                        uploadedFiles.push({
                          name: file.name,
                          url: result.file_url || result.url || result.downloadUrl
                        });
                      }
                      setDeficiencyAttachments(prev => [...prev, ...uploadedFiles]);
                    } catch (err) {
                      console.error('Failed to upload attachment:', err);
                      alert('Failed to upload file. Please try again.');
                    } finally {
                      setUploadingDeficiencyFile(false);
                      e.target.value = '';
                    }
                  }}
                  disabled={uploadingDeficiencyFile}
                  className="cursor-pointer"
                />
                <p className="text-xs text-slate-500 mt-2">
                  Upload supporting documents, examples, or reference materials
                </p>
              </div>

              {/* Display uploaded attachments */}
              {deficiencyAttachments.length > 0 && (
                <div className="space-y-2">
                  {deficiencyAttachments.map((file, idx) => (
                    <div key={idx} className="flex items-center justify-between p-2 bg-slate-50 rounded border">
                      <div className="flex items-center gap-2">
                        <Paperclip className="w-4 h-4 text-slate-500" />
                        <span className="text-sm font-medium">{file.name}</span>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setDeficiencyAttachments(prev => prev.filter((_, i) => i !== idx));
                        }}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Endorsement Upload Option */}
            <div className="border-t pt-4 space-y-4">
              <div className="flex items-start space-x-2">
                <Checkbox
                  id="include-endorsement"
                  checked={includeEndorsementUpload}
                  onCheckedChange={(checked) => setIncludeEndorsementUpload(checked)}
                />
                <div className="grid gap-1.5 leading-none">
                  <Label
                    htmlFor="include-endorsement"
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                  >
                    Include upload link for endorsements
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Provide a link for the broker to upload endorsement documents
                  </p>
                </div>
              </div>

              {includeEndorsementUpload && (
                <div className="ml-6 space-y-3 p-3 bg-blue-50 border border-blue-200 rounded">
                  <div className="flex items-start space-x-2">
                    <Checkbox
                      id="require-new-coi"
                      checked={requireNewCOI}
                      onCheckedChange={(checked) => setRequireNewCOI(checked)}
                    />
                    <div className="grid gap-1.5 leading-none">
                      <Label
                        htmlFor="require-new-coi"
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                      >
                        Changes require new COI generation
                      </Label>
                      <p className="text-sm text-muted-foreground">
                        After endorsement upload, generate a new COI with updated information
                      </p>
                    </div>
                  </div>

                  {requireNewCOI && (
                    <div className="ml-6 flex items-start space-x-2">
                      <Checkbox
                        id="apply-to-all"
                        checked={applyToAllProjects}
                        onCheckedChange={(checked) => setApplyToAllProjects(checked)}
                      />
                      <div className="grid gap-1.5 leading-none">
                        <Label
                          htmlFor="apply-to-all"
                          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                        >
                          Apply changes to all projects
                        </Label>
                        <p className="text-sm text-muted-foreground">
                          Generate new COIs for all active projects this subcontractor is on
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setIsDeficiencyDialogOpen(false);
              setDeficiencyText('');
              setDeficiencySubject('');
              setDeficiencyAttachments([]);
              setIncludeEndorsementUpload(false);
              setRequireNewCOI(false);
              setApplyToAllProjects(false);
            }}>
              Cancel
            </Button>
            <Button
              onClick={handleSendDeficiency}
              className="bg-red-600 hover:bg-red-700"
              disabled={!deficiencyText.trim() || sendMessageMutation.isPending || uploadingDeficiencyFile}
            >
              {sendMessageMutation.isPending ? 'Sending...' : 'Send Deficiency Notice'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}