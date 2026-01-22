import React, { useState } from "react";
import { compliant } from "@/api/compliantClient";
import { sendEmail } from "@/emailHelper";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { notifySubAddedToProject } from "@/brokerNotifications";
import { notifyGCProjectCreated, notifyGCSubcontractorAdded } from "@/gcNotifications";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, ArrowLeft, Users, AlertCircle, CheckCircle2, Clock, Trash2, Building2, Shield, AlertTriangle, Eye} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Alert,
  AlertDescription,
} from "@/components/ui/alert";
import SendBrokerRequestDialog from "./SendBrokerRequest";
import { format } from 'date-fns'; // Added import for date formatting
import TradeSelectionComponent from "./TradeSelectionComponent";
import ProjectRequirementsManager from "./ProjectRequirementsManager";

export default function ProjectDetails() {
  const navigate = useNavigate();
  const urlParams = new URLSearchParams(window.location.search);
  const projectId = urlParams.get('id');
  
  // If this is a GC public session, redirect to the GC project view
  React.useEffect(() => {
    const redirectForGC = async () => {
      const isGcPublic = typeof window !== 'undefined' && sessionStorage.getItem('gcPublicSession') === 'true';
      if (!projectId) return;

      // If already in GC session, use stored gcPortalId
      if (isGcPublic) {
        const gcIdStored = sessionStorage.getItem('gcPortalId');
        const targetStored = gcIdStored
          ? `/gc-project?project=${projectId}&id=${gcIdStored}`
          : `/gc-project?project=${projectId}`;
        navigate(targetStored, { replace: true });
        return;
      }

      // Otherwise, if not an admin user, redirect using the project's gc_id
      try {
        const me = await compliant.auth.me();
        const isAdmin = me?.role === 'admin' || me?.role === 'super_admin';
        if (isAdmin) return; // Admin stays on ProjectDetails
      } catch (err) {
        // 401 or failure → treat as non-admin and continue redirect
      }

      try {
        const projectList = await compliant.entities.Project.filter({ id: projectId });
        const project = Array.isArray(projectList) && projectList.length > 0 ? projectList[0] : null;
        const gcIdForProject = project?.gc_id;
        const target = gcIdForProject
          ? `/gc-project?project=${projectId}&id=${gcIdForProject}`
          : `/gc-project?project=${projectId}`;
        navigate(target, { replace: true });
      } catch (err) {
        // If project lookup fails, leave user on admin view to show error state
      }
    };

    redirectForGC();
  }, [projectId, navigate]);

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isBrokerRequestOpen, setIsBrokerRequestOpen] = useState(false);
  const [selectedSubForRequest, setSelectedSubForRequest] = useState(null);
  const [_searchSub, setSearchSub] = useState('');
  const [formData, setFormData] = useState({
    subcontractor_name: '',
    contact_email: '',
    contact_phone: '',
    trade_types: [], // Changed to array
    notes: '',
  });
  const [isAddInsuredOpen, setIsAddInsuredOpen] = useState(false);
  const [newInsuredEntity, setNewInsuredEntity] = useState('');
  const [_isSetupMode, setIsSetupMode] = useState(false);
  const [setupFormData, setSetupFormData] = useState({
    program_id: '',
    additional_insured_entities: []
  });
  const [newTrade, setNewTrade] = useState(''); // New state for custom trade input
  const [_selectedExistingSub, setSelectedExistingSub] = useState(null); // New state for selected existing subcontractor
  const [_useExistingTrades, setUseExistingTrades] = useState(false); // New state to track if user wants to use existing trades

  const queryClient = useQueryClient();

  const { data: user } = useQuery({
    queryKey: ['current-user'],
    queryFn: () => compliant.auth.me(),
  });

  const { data: project } = useQuery({
    queryKey: ['project', projectId],
    queryFn: async () => {
      const projects = await compliant.entities.Project.list();
      return projects.find(p => p.id === projectId);
    },
    enabled: !!projectId,
  });

  const { data: programs = [] } = useQuery({
    queryKey: ['insurance-programs'],
    queryFn: () => compliant.entities.InsuranceProgram.list(),
    enabled: user?.role === 'admin' || user?.role === 'super_admin',
  });

  const { data: projectSubs = [], isLoading: subsLoading } = useQuery({
    queryKey: ['project-subs', projectId],
    queryFn: () => compliant.entities.ProjectSubcontractor.filter({ project_id: projectId }),
    enabled: !!projectId && !project?.needs_admin_setup, // Only fetch if project setup is complete
  });

  const { data: requirements = [] } = useQuery({
    queryKey: ['sub-requirements', project?.program_id],
    queryFn: () => compliant.entities.SubInsuranceRequirement.filter({ program_id: project.program_id }),
    enabled: !!project?.program_id && !project?.needs_admin_setup, // Only fetch if project setup is complete
  });

  const { data: stateRequirements = [] } = useQuery({
    queryKey: ['state-requirements', project?.state],
    queryFn: () => compliant.entities.StateRequirement.filter({ state: project.state }),
    enabled: !!project?.state && !project?.needs_admin_setup, // Only fetch if project setup is complete
  });

  const { data: documents = [] } = useQuery({
    queryKey: ['insurance-documents'],
    queryFn: () => compliant.entities.InsuranceDocument.list(),
    enabled: !project?.needs_admin_setup, // Only fetch if project setup is complete
  });

  const { data: allCOIs = [] } = useQuery({
    queryKey: ['project-cois', projectId],
    queryFn: () => compliant.entities.GeneratedCOI.list(),
    enabled: !!projectId && !project?.needs_admin_setup,
  });

  const { data: allTrades = [] } = useQuery({
    queryKey: ['trades'],
    queryFn: () => compliant.entities.Trade.filter({ is_active: true }),
    enabled: !project?.needs_admin_setup, // Only fetch if project setup is complete
  });

  const { data: allSubcontractors = [] } = useQuery({
    queryKey: ['subcontractors'],
    queryFn: () => compliant.entities.Contractor.filter({ contractor_type: 'subcontractor' }),
    enabled: !project?.needs_admin_setup, // Only fetch if project setup is complete
  });

  const addSubMutation = useMutation({
    mutationFn: async (data) => {
      const newProjectSub = await compliant.entities.ProjectSubcontractor.create(data);
      
      // Fetch full subcontractor and project data for notifications
      if (data.subcontractor_id && data.project_id) {
        try {
          const subcontractor = await compliant.entities.Contractor.read(data.subcontractor_id);
          const projectData = await compliant.entities.Project.read(data.project_id);
          const contactEmail = subcontractor.email || subcontractor.contact_email || data.contact_email;
          
          // Send notifications asynchronously (don't wait for them)
          notifySubAddedToProject(subcontractor, projectData).catch(err => {
            console.error('Sub notification failed:', err);
            // Fallback minimal email so subs still get a link
            if (contactEmail) {
              const subDashboardLink = `${window.location.origin}/subcontractor-dashboard?id=${subcontractor.id}`;
              sendEmail({
                to: contactEmail,
                subject: `Added to Project - ${projectData.project_name}`,
                body: `You have been added to ${projectData.project_name}.\n\nAccess your portal: ${subDashboardLink}\n\nAdd your broker to proceed with insurance.`
              }).catch(() => {});
            }
          });
          
          notifyGCSubcontractorAdded(projectData, subcontractor).catch(err => 
            console.error('GC notification failed:', err)
          );
        } catch (err) {
          console.error('Error fetching notification data:', err);
        }
      }
      
      return newProjectSub;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['project-subs']);
      closeDialog();
    },
  });

  const deleteSubMutation = useMutation({
    mutationFn: (id) => compliant.entities.ProjectSubcontractor.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['project-subs']);
    },
  });

  // Archive mutation for ProjectSubcontractors
  const archiveSubMutation = useMutation({
    mutationFn: async ({ id, reason }) => {
      const response = await compliant.api.post(`/entities/ProjectSubcontractor/${id}/archive`, { reason });
      return response.data;
    },
    onSuccess: () => {
      toast.success('Subcontractor archived successfully');
      queryClient.invalidateQueries(['project-subs']);
    },
    onError: (error) => {
      toast.error(`Failed to archive: ${error.message}`);
    },
  });

  // Fetch current user for permission check
  const { data: _currentUser } = useQuery({
    queryKey: ['current-user'],
    queryFn: () => compliant.auth.me(),
  });

  const createContractorMutation = useMutation({
    mutationFn: (data) => compliant.entities.Contractor.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries(['subcontractors']);
    },
  });

  const updateContractorMutation = useMutation({
    mutationFn: ({ id, data }) => compliant.entities.Contractor.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['subcontractors']);
    },
  });

  const updateProjectMutation = useMutation({
    mutationFn: async ({ id, data }) => {
      const updated = await compliant.entities.Project.update(id, data);
      
      // If this is first save, notify GC
      if (data.status && !project?.status) {
        setTimeout(() => {
          notifyGCProjectCreated(updated).catch(err => 
            console.error('GC notification failed:', err)
          );
        }, 100);
      }
      
      return updated;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['project']);
      queryClient.invalidateQueries(['projects']); // Invalidate projects list to reflect setup status change
      setIsAddInsuredOpen(false);
      setNewInsuredEntity('');
      setIsSetupMode(false); // Reset setup mode flag after successful update
    },
  });

  const closeDialog = () => {
    setIsDialogOpen(false);
    setSearchSub('');
    setSelectedExistingSub(null); // Reset selected existing sub
    setFormData({
      subcontractor_name: '',
      contact_email: '',
      contact_phone: '',
      trade_types: [], // Reset trade_types
      notes: '',
    });
    setNewTrade(''); // Reset newTrade
    setUseExistingTrades(false); // Reset useExistingTrades
  };

  const _handleSelectExistingSub = (sub) => {
    setSelectedExistingSub(sub);
    // Get existing trades
    const existingTrades = (sub.trade_types && sub.trade_types.length > 0)
      ? sub.trade_types
      : (sub.trade_type ? [sub.trade_type] : []);

    setFormData({
      subcontractor_name: sub.company_name,
      contact_email: sub.email || '',
      contact_phone: sub.phone || '',
      trade_types: existingTrades, // Auto-populate with existing trades
      notes: '',
    });
    setUseExistingTrades(existingTrades.length > 0); // Set flag if trades exist
    setSearchSub('');
  };

  const _handleAddTradeType = () => {
    if (newTrade.trim() && !formData.trade_types.includes(newTrade.trim())) {
      setFormData({
        ...formData,
        trade_types: [...formData.trade_types, newTrade.trim()]
      });
      setNewTrade('');
      setUseExistingTrades(false); // User modified trades
    }
  };

  const _handleAddExistingTrade = (tradeName) => {
    if (!formData.trade_types.includes(tradeName)) {
      setFormData({
        ...formData,
        trade_types: [...formData.trade_types, tradeName]
      });
      setUseExistingTrades(false); // User modified trades
    }
  };

  const _handleRemoveTradeType = (trade) => {
    setFormData({
      ...formData,
      trade_types: formData.trade_types.filter(t => t !== trade)
    });
    setUseExistingTrades(false); // User modified trades
  };

  const getRequirementsForTrade = (tradeType) => {
    if (!tradeType) return [];

    // Get program requirements for this specific trade
    // Each tier has a trade_types array - check if this trade is in any tier
    const programReqs = requirements.filter(r => {
      // Check if this requirement's tier includes this trade
      return r.trade_types && Array.isArray(r.trade_types) && r.trade_types.includes(tradeType);
    });

    // Get state requirements for this trade or all trades
    const stateReqs = stateRequirements.filter(r =>
      r.trade_type === tradeType || r.trade_type === 'all'
    );

    // Combine program and state requirements
    const allReqs = [...programReqs];

    // Add state requirements that aren't already covered by program
    stateReqs.forEach(stateReq => {
      const alreadyCovered = programReqs.some(pr => pr.insurance_type === stateReq.insurance_type);
      if (!alreadyCovered) {
        allReqs.push({
          ...stateReq,
          source: 'state',
          tier_name: 'State Law',
          description: `${stateReq.description || ''} (Required by ${stateReq.state_name || stateReq.state} Law)`,
          minimum_coverage: stateReq.coverage_amount, // Use coverage_amount for state reqs
          is_required: true
        });
      }
    });

    return allReqs;
  };

  // NEW FUNCTION: Get the highest-tier requirements when multiple trades
  const getHighestTierRequirements = (trades) => {
    if (!trades || trades.length === 0) return [];
    if (trades.length === 1) return getRequirementsForTrade(trades[0]);

    // Define tier priority (higher number = higher risk = more requirements)
    const tierPriority = {
      'Foundation Contractors': 5,
      'Roofing Specialists': 4,
      'Exterior Trades': 3,
      'Structural Trades': 3,
      'MEP Contractors': 2,
      'Interior Trades': 1,
      'Low-Risk Trades': 0
    };

    // Get all requirements for all trades
    const allTradeReqs = trades.flatMap(trade => getRequirementsForTrade(trade));

    // Find the highest tier
    let highestTierName = '';
    let highestTierPriority = -1;

    allTradeReqs.forEach(req => {
      const priority = tierPriority[req.tier_name] || 0;
      if (priority > highestTierPriority) {
        highestTierPriority = priority;
        highestTierName = req.tier_name;
      }
    });

    // Return only requirements from the highest tier (plus state requirements)
    // Ensure state requirements are always included regardless of program tier
    return allTradeReqs.filter(req =>
      req.tier_name === highestTierName || req.source === 'state'
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (formData.trade_types.length === 0) {
      alert('Please select at least one trade type');
      return;
    }
    if (!formData.contact_email) {
      alert('Contact email is required.');
      return;
    }
    if (!formData.subcontractor_name) {
      alert('Subcontractor name is required.');
      return;
    }

    try {
      // Check if subcontractor exists in system
      const existingSub = allSubcontractors.find(s =>
        s.company_name.toLowerCase() === formData.subcontractor_name.toLowerCase()
      );

      let subId = existingSub?.id;

      // If doesn't exist, create new contractor record
      if (!existingSub) {
        const newSub = await createContractorMutation.mutateAsync({
          company_name: formData.subcontractor_name,
          contact_person: formData.subcontractor_name,
          email: formData.contact_email,
          phone: formData.contact_phone,
          contractor_type: 'subcontractor',
          trade_types: formData.trade_types,
          status: 'active',
          // Add broker info if available
          broker_email: insuranceData?.broker_email || null,
          broker_name: insuranceData?.broker_name || null,
          broker_company: insuranceData?.broker_company || null,
          broker_phone: insuranceData?.broker_phone || null,
        });
        subId = newSub.id;
      } else {
        // Update existing sub to add any new trades
        const existingContractorTrades = existingSub.trade_types || (existingSub.trade_type ? [existingSub.trade_type] : []);
        const allTradesForContractor = [...new Set([...existingContractorTrades, ...formData.trade_types])];

        await updateContractorMutation.mutateAsync({
          id: existingSub.id,
          data: {
            email: formData.contact_email || existingSub.email,
            phone: formData.contact_phone || existingSub.phone,
            trade_types: allTradesForContractor,
          }
        });
      }

      // Get requirements for all selected trades - USE HIGHEST TIER
      const allReqs = getHighestTierRequirements(formData.trade_types);
      const requiresUmbrella = allReqs.some(r => r.insurance_type === 'umbrella_policy' && r.is_required);
      
      // Check if any selected trade requires professional or pollution liability
      const tradeObjects = allTrades.filter(t => formData.trade_types.includes(t.trade_name));
      const requiresProfessionalLiability = tradeObjects.some(t => t.requires_professional_liability);
      const requiresPollutionLiability = tradeObjects.some(t => t.requires_pollution_liability);

      // Add to project
      const projectSubData = {
        ...formData,
        project_id: project.id,
        project_name: project.project_name,
        gc_id: project.gc_id,
        program_id: project.program_id,
        subcontractor_id: subId,
        trade_type: formData.trade_types[0],
        compliance_status: 'pending_broker',
        contact_email: formData.contact_email,
        contact_phone: formData.contact_phone,
      };

      const newProjectSub = await addSubMutation.mutateAsync(projectSubData);

      // Check if this subcontractor already has insurance on file FOR THIS STATE
      const existingCOIs = await compliant.entities.GeneratedCOI.filter({ subcontractor_name: formData.subcontractor_name, state: project.state });
      const existingActiveCOI = existingCOIs.find(c => c.status === 'active' && c.gl_each_occurrence);

      // Get master insurance from subcontractor record
      const masterInsurance = existingSub?.master_insurance_data;

      // Force a fresh, project-specific COI (do not treat prior insurance as "on file")
      const hasReusableInsurance = false;

      // If no master insurance, try to get from the most recent COI (any state)
      let sourceData = masterInsurance || existingActiveCOI;
      if (!sourceData) {
        const allCOIsForSub = await compliant.entities.GeneratedCOI.filter({ subcontractor_name: formData.subcontractor_name });
        const mostRecentCOI = allCOIsForSub.sort((a, b) => new Date(b.created_date) - new Date(a.created_date))[0];
        sourceData = mostRecentCOI;
      }

      // Merge broker defaults from subcontractor if missing in source
      const brokerDefaults = {
        broker_company: existingSub?.broker_company || existingSub?.company_name || '',
        broker_name: existingSub?.broker_name || existingSub?.contact_person || '',
        broker_email: existingSub?.broker_email || existingSub?.email || formData.contact_email || '',
        broker_phone: existingSub?.broker_phone || existingSub?.contact_phone || existingSub?.phone || '',
        broker_address: existingSub?.broker_address || '',
        broker_city: existingSub?.broker_city || '',
        broker_state: existingSub?.broker_state || '',
        broker_zip: existingSub?.broker_zip || '',
      };

      // Use source data - FULL COPY with broker fallbacks so brokers see new COIs
      const insuranceData = {
        ...brokerDefaults,
        ...(sourceData || {}),
      };

      // Generate secure COI token using crypto
      const tokenBytes = new Uint8Array(24);
      crypto.getRandomValues(tokenBytes);
      const coiToken = Array.from(tokenBytes, byte => byte.toString(16).padStart(2, '0')).join('');

      const umbrellaText = requiresUmbrella ? ' & Umbrella' : '';
      const professionalText = requiresProfessionalLiability ? ', Professional Liability' : '';
      const pollutionText = requiresPollutionLiability ? ', Contractors Pollution Liability' : '';
      const tradesText = formData.trade_types.join(', ');
      
      const description = `Certificate holder, ${project.owner_entity ? project.owner_entity + ',' : ''} entities listed on page 2 and all other parties indemnified in the contract are included as additional insureds on the GL${umbrellaText} policies for ongoing & completed operations on a primary & non-contributory basis, as required by written contract agreement. General Liability${umbrellaText}${professionalText}${pollutionText} & Workers Compensation policies include endorsement for waiver of subrogation.`;

      // Get required limits from highest tier
      const glReq = allReqs.find(r => r.insurance_type === 'general_liability');
      const umbReq = allReqs.find(r => r.insurance_type === 'umbrella_policy');
      const wcReq = allReqs.find(r => r.insurance_type === 'workers_compensation');
      const autoReq = allReqs.find(r => r.insurance_type === 'auto_liability');

      // Generate sample COI - ALWAYS show all standard ACORD 25 sections
      let sampleCoiUrl = null;
      try {
        const hasGL = !!(insuranceData?.insurance_carrier_gl); // Check if GL carrier exists
        const _hasAuto = !!(insuranceData?.insurance_carrier_auto); // Check if Auto carrier exists
        const hasUmbrella = !!(insuranceData?.insurance_carrier_umbrella); // Check if Umbrella carrier exists
        const hasWC = !!(insuranceData?.insurance_carrier_wc); // Check if WC carrier exists

        const sampleCoiContent = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>${hasReusableInsurance ? 'Certificate' : 'SAMPLE'} - Certificate of Liability Insurance</title>
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
body { 
  font-family: 'Arial', sans-serif; 
  font-size: 7pt; 
  line-height: 1.2;
  padding: 10px;
  position: relative;
}
${!hasReusableInsurance ? `.watermark { 
  position: fixed; 
  top: 50%; 
  left: 50%; 
  transform: translate(-50%, -50%) rotate(-45deg);
  font-size: 120pt; 
  color: rgba(255,0,0,0.08); 
  font-weight: bold;
  z-index: 1000;
  pointer-events: none;
  white-space: nowrap;
}` : ''}
table { width: 100%; border-collapse: collapse; }
td { border: 1px solid #000; padding: 2px 4px; vertical-align: top; font-size: 7pt; }
.section-header { font-weight: bold; font-size: 6pt; background: #fff; }
.small { font-size: 5pt; }
.checkbox { display: inline-block; width: 10px; height: 10px; border: 1px solid #000; margin-right: 3px; vertical-align: middle; position: relative; }
.checkbox.checked::after { content: 'X'; position: absolute; top: -2px; left: 2px; font-weight: bold; font-size: 9pt; }
.acord-header { text-align: center; font-weight: bold; font-size: 14pt; margin-bottom: 5px; }
.acord-subheader { text-align: right; font-size: 6pt; margin-bottom: 10px; }
</style>
</head>
<body>

${!hasReusableInsurance ? '<div class="watermark">SAMPLE<br/>BROKER REFERENCE</div>' : ''}

<div class="acord-header">CERTIFICATE OF LIABILITY INSURANCE</div>
<div class="acord-subheader">DATE (MM/DD/YYYY): ${format(new Date(), 'MM/dd/yyyy')}</div>

<!-- Producer Section -->
<table style="margin-bottom: 2px;">
  <tr>
    <td style="width: 50%; padding: 5px;">
      <div class="section-header">PRODUCER</div>
      <div style="margin-top: 8px; line-height: 1.4;">
        <strong>${insuranceData?.broker_company || '[BROKER/AGENCY NAME]'}</strong><br/>
        ${insuranceData?.broker_name ? insuranceData.broker_name + '<br/>' : '[Contact Name]<br/>'}
        ${insuranceData?.broker_address || '[Address Line 1]'}<br/>
        ${insuranceData?.broker_city && insuranceData?.broker_state ? insuranceData.broker_city + ', ' + insuranceData.broker_state + ' ' + (insuranceData?.broker_zip || '') + '<br/>' : '[City, State ZIP]<br/>'}
        PHONE: ${insuranceData?.broker_phone || '[___] ___-____'}<br/>
        E-MAIL: ${insuranceData?.broker_email || '[broker@agency.com]'}
      </div>
    </td>
    <td style="width: 25%; padding: 5px;">
      <div class="section-header">CONTACT NAME:</div>
      <div style="margin-top: 8px;">${insuranceData?.broker_name || '[Broker Contact Name]'}</div>
      <div class="section-header" style="margin-top: 10px;">PHONE: ${insuranceData?.broker_phone || '[___] ___-____'}</div>
      <div class="section-header" style="margin-top: 5px;">E-MAIL ADDRESS:</div>
      <div>${insuranceData?.broker_email || '[contact@agency.com]'}</div>
    </td>
    <td style="width: 25%; padding: 5px;">
      <div class="section-header">INSURER(S) AFFORDING COVERAGE</div>
      <div class="section-header" style="margin-top: 8px;">NAIC #</div>
      <div style="margin-top: 3px;">
        <strong>INSURER A:</strong> ${insuranceData?.insurance_carrier_gl || '_____________'} ${insuranceData?.gl_naic || '_____'}<br/>
        <strong>INSURER B:</strong> ${insuranceData?.insurance_carrier_auto || '_____________'} ${insuranceData?.auto_naic || '_____'}<br/>
        <strong>INSURER C:</strong> ${insuranceData?.insurance_carrier_umbrella || '_____________'} ${insuranceData?.umbrella_naic || '_____'}<br/>
        <strong>INSURER D:</strong> ${insuranceData?.insurance_carrier_wc || '_____________'} ${insuranceData?.wc_naic || '_____'}
      </div>
    </td>
  </tr>
</table>

<!-- Insured Section -->
<table style="margin-bottom: 2px;">
  <tr>
    <td style="width: 50%; padding: 5px;">
      <div class="section-header">INSURED</div>
      <div style="margin-top: 8px; line-height: 1.4;">
        <strong>${formData.subcontractor_name}</strong><br/>
        ${existingSub?.address || '[Subcontractor Address]'}<br/>
        ${existingSub?.city && existingSub?.state ? existingSub.city + ', ' + existingSub.state + ' ' + (existingSub?.zip_code || '') : '[City, State ZIP]'}
      </div>
    </td>
    <td style="width: 50%; padding: 5px;">
      <div class="section-header">CERTIFICATE NUMBER:</div>
      <div>${hasReusableInsurance ? 'COI-' + Date.now() : 'SAMPLE-' + Date.now()}</div>
      <div class="section-header" style="margin-top: 5px;">REVISION NUMBER:</div>
      <div>___</div>
    </td>
  </tr>
</table>

<!-- THIS IS TO CERTIFY Section -->
<table style="margin-bottom: 2px;">
  <tr>
    <td style="padding: 3px; font-size: 6pt;">
      THIS IS TO CERTIFY THAT THE POLICIES OF INSURANCE LISTED BELOW HAVE BEEN ISSUED TO THE INSURED NAMED ABOVE FOR THE POLICY PERIOD
      INDICATED. NOTWITHSTANDING ANY REQUIREMENT, TERM OR CONDITION OF ANY CONTRACT OR OTHER DOCUMENT WITH RESPECT TO WHICH THIS
      CERTIFICATE MAY BE ISSUED OR MAY PERTAIN, THE INSURANCE AFFORDED BY THE POLICIES DESCRIBED HEREIN IS SUBJECT TO ALL THE TERMS,
      EXCLUSIONS AND CONDITIONS OF SUCH POLICIES. LIMITS SHOWN MAY HAVE BEEN REDUCED BY PAID CLAIMS.
    </td>
  </tr>
</table>

<!-- Coverage Table - ALWAYS SHOW ALL SECTIONS -->
<table style="margin-bottom: 2px;">
  <tr style="background: #fff;">
    <td style="width: 3%; text-align: center; font-weight: bold; font-size: 6pt;">INSR LTR</td>
    <td style="width: 15%; font-weight: bold; font-size: 6pt;">TYPE OF INSURANCE</td>
    <td style="width: 5%; text-align: center; font-weight: bold; font-size: 6pt;">ADDL INSD</td>
    <td style="width: 5%; text-align: center; font-weight: bold; font-size: 6pt;">SUBR WVD</td>
    <td style="width: 15%; font-weight: bold; font-size: 6pt;">POLICY NUMBER</td>
    <td style="width: 10%; text-align: center; font-weight: bold; font-size: 6pt;">POLICY EFF (MM/DD/YYYY)</td>
    <td style="width: 10%; text-align: center; font-weight: bold; font-size: 6pt;">POLICY EXP (MM/DD/YYYY)</td>
    <td style="width: 37%; font-weight: bold; font-size: 6pt;">LIMITS</td>
  </tr>
  
  <!-- GENERAL LIABILITY - ALWAYS SHOW -->
  <tr>
    <td style="text-align: center;">A</td>
    <td>
      <div><span class="checkbox ${hasGL ? 'checked' : ''}"></span> COMMERCIAL GENERAL LIABILITY</div>
      <div style="margin-left: 15px;"><span class="checkbox"></span> CLAIMS-MADE <span class="checkbox ${hasGL ? 'checked' : ''}"></span> OCCUR</div>
      <div style="margin-left: 5px; margin-top: 3px; font-size: 5pt;">
        ${insuranceData?.gl_per_project_aggregate ? '<span class="checkbox checked"></span> Per Project Aggregate' : '<span class="checkbox"></span> General Aggregate applies per:'}
      </div>
    </td>
    <td style="text-align: center;">${insuranceData?.gl_additional_insured ? 'X' : ''}</td>
    <td style="text-align: center;">${insuranceData?.gl_waiver_of_subrogation ? 'X' : ''}</td>
    <td>${insuranceData?.policy_number_gl || ''}</td>
    <td style="text-align: center;">${insuranceData?.gl_effective_date ? format(new Date(insuranceData.gl_effective_date), 'MM/dd/yyyy') : ''}</td>
    <td style="text-align: center;">${insuranceData?.gl_expiration_date ? format(new Date(insuranceData.gl_expiration_date), 'MM/dd/yyyy') : ''}</td>
    <td>
      <div>EACH OCCURRENCE: $${insuranceData?.gl_each_occurrence?.toLocaleString() || (glReq?.minimum_coverage?.toLocaleString() || '________')}</div>
      <div>DAMAGE TO RENTED PREMISES: $${insuranceData?.gl_damage_rented_premises?.toLocaleString() || '________'}</div>
      <div>MED EXP (Any one person): $${insuranceData?.gl_med_exp?.toLocaleString() || '________'}</div>
      <div>PERSONAL & ADV INJURY: $${insuranceData?.gl_personal_adv_injury?.toLocaleString() || (glReq?.minimum_coverage?.toLocaleString() || '________')}</div>
      <div>GENERAL AGGREGATE: $${insuranceData?.gl_general_aggregate?.toLocaleString() || (glReq?.gl_general_aggregate?.toLocaleString() || '________')}</div>
      <div>PRODUCTS - COMP/OP AGG: $${insuranceData?.gl_products_completed_ops?.toLocaleString() || (glReq?.gl_products_completed_ops?.toLocaleString() || '________')}</div>
    </td>
  </tr>

  <!-- AUTOMOBILE LIABILITY - ALWAYS SHOW -->
  <tr>
    <td style="text-align: center;">B</td>
    <td>
      <div>AUTOMOBILE LIABILITY</div>
      <div style="margin-left: 5px;"><span class="checkbox ${insuranceData?.auto_any_auto ? 'checked' : ''}"></span> ANY AUTO</div>
      <div style="margin-left: 5px;"><span class="checkbox ${insuranceData?.auto_owned_autos ? 'checked' : ''}"></span> ALL OWNED AUTOS</div>
      <div style="margin-left: 5px;"><span class="checkbox ${insuranceData?.auto_scheduled_autos ? 'checked' : ''}"></span> SCHEDULED AUTOS</div>
      <div style="margin-left: 5px;"><span class="checkbox ${insuranceData?.auto_hired_autos ? 'checked' : ''}"></span> HIRED AUTOS</div>
      <div style="margin-left: 5px;"><span class="checkbox ${insuranceData?.auto_non_owned_autos ? 'checked' : ''}"></span> NON-OWNED AUTOS</div>
    </td>
    <td style="text-align: center;">${insuranceData?.auto_additional_insured ? 'X' : ''}</td>
    <td style="text-align: center;">${insuranceData?.auto_waiver_of_subrogation ? 'X' : ''}</td>
    <td>${insuranceData?.policy_number_auto || ''}</td>
    <td style="text-align: center;">${insuranceData?.auto_effective_date ? format(new Date(insuranceData.auto_effective_date), 'MM/dd/yyyy') : ''}</td>
    <td style="text-align: center;">${insuranceData?.auto_expiration_date ? format(new Date(insuranceData.auto_expiration_date), 'MM/dd/yyyy') : ''}</td>
    <td>
      <div>COMBINED SINGLE LIMIT: $${insuranceData?.auto_combined_single_limit?.toLocaleString() || (autoReq?.auto_combined_single_limit?.toLocaleString() || '________')}</div>
      <div>BODILY INJURY (Per person): $${insuranceData?.auto_bi_per_person?.toLocaleString() || '________'}</div>
      <div>BODILY INJURY (Per accident): $${insuranceData?.auto_bi_per_accident?.toLocaleString() || '________'}</div>
      <div>PROPERTY DAMAGE: $${insuranceData?.auto_property_damage?.toLocaleString() || '________'}</div>
    </td>
  </tr>

  <!-- UMBRELLA LIABILITY - ALWAYS SHOW -->
  <tr>
    <td style="text-align: center;">C</td>
    <td>
      <div><span class="checkbox ${hasUmbrella ? 'checked' : ''}"></span> UMBRELLA LIAB</div>
      <div><span class="checkbox"></span> EXCESS LIAB</div>
      <div style="margin-left: 15px;"><span class="checkbox"></span> CLAIMS-MADE</div>
      <div style="margin-left: 15px;"><span class="checkbox ${hasUmbrella ? 'checked' : ''}"></span> OCCUR</div>
    </td>
    <td style="text-align: center;">${insuranceData?.umbrella_additional_insured ? 'X' : ''}</td>
    <td style="text-align: center;">${insuranceData?.umbrella_waiver_of_subrogation ? 'X' : ''}</td>
    <td>${insuranceData?.policy_number_umbrella || ''}</td>
    <td style="text-align: center;">${insuranceData?.umbrella_effective_date ? format(new Date(insuranceData.umbrella_effective_date), 'MM/dd/yyyy') : ''}</td>
    <td style="text-align: center;">${insuranceData?.umbrella_expiration_date ? format(new Date(insuranceData.umbrella_expiration_date), 'MM/dd/yyyy') : ''}</td>
    <td>
      <div>EACH OCCURRENCE: $${insuranceData?.umbrella_each_occurrence?.toLocaleString() || (umbReq?.umbrella_each_occurrence?.toLocaleString() || '________')}</div>
      <div>AGGREGATE: $${insuranceData?.umbrella_aggregate?.toLocaleString() || (umbReq?.umbrella_aggregate?.toLocaleString() || '________')}</div>
    </td>
  </tr>

  <!-- WORKERS COMPENSATION - ALWAYS SHOW -->
  <tr>
    <td style="text-align: center;">D</td>
    <td>
      <div>WORKERS COMPENSATION AND EMPLOYERS' LIABILITY</div>
      <div style="margin-left: 5px;">ANY PROPRIETOR/PARTNER/EXECUTIVE OFFICER/MEMBER EXCLUDED? <span class="checkbox"></span> N/A</div>
      <div style="font-size: 5pt; margin-top: 2px;">State: ${project.state}</div>
    </td>
    <td style="text-align: center;"></td>
    <td style="text-align: center;">${insuranceData?.wc_waiver_of_subrogation ? 'X' : ''}</td>
    <td>${insuranceData?.policy_number_wc || ''}</td>
    <td style="text-align: center;">${insuranceData?.wc_effective_date ? format(new Date(insuranceData.wc_effective_date), 'MM/dd/yyyy') : ''}</td>
    <td style="text-align: center;">${insuranceData?.wc_expiration_date ? format(new Date(insuranceData.wc_expiration_date), 'MM/dd/yyyy') : ''}</td>
    <td>
      <div>PER STATUTE: <span class="checkbox ${hasWC ? 'checked' : ''}"></span> OTHER</div>
      <div>E.L. EACH ACCIDENT: $${insuranceData?.wc_each_accident?.toLocaleString() || (wcReq?.wc_each_accident?.toLocaleString() || '________')}</div>
      <div>E.L. DISEASE - EA EMPLOYEE: $${insuranceData?.wc_disease_each_employee?.toLocaleString() || (wcReq?.wc_disease_each_employee?.toLocaleString() || '________')}</div>
      <div>E.L. DISEASE - POLICY LIMIT: $${insuranceData?.wc_disease_policy_limit?.toLocaleString() || (wcReq?.wc_disease_policy_limit?.toLocaleString() || '________')}</div>
    </td>
  </tr>
</table>

<!-- DESCRIPTION OF OPERATIONS -->
<table style="margin-bottom: 2px;">
  <tr>
    <td style="padding: 5px;">
      <div class="section-header" style="margin-bottom: 5px;">DESCRIPTION OF OPERATIONS / LOCATIONS / VEHICLES</div>
      <div style="line-height: 1.4; font-size: 6.5pt;">
        <strong>PROJECT:</strong> ${project.project_name}<br/>
        <strong>LOCATION:</strong> ${project.address}, ${project.city}, ${project.state} ${project.zip_code}<br/><br/>
        
        <strong>REQUIRED ENDORSEMENTS:</strong><br/>
        ${description}<br/><br/>
        
        ${project.additional_insured_entities && project.additional_insured_entities.length > 0 ? 
          `<strong>ADDITIONAL INSURED ENTITIES:</strong><br/>${project.owner_entity}<br/>${project.additional_insured_entities.join('<br/>')}` : 
          ''}
      </div>
    </td>
  </tr>
</table>

<!-- CERTIFICATE HOLDER -->
<table style="margin-bottom: 2px;">
  <tr>
    <td style="width: 50%; padding: 5px;">
      <div class="section-header">CERTIFICATE HOLDER</div>
      <div style="margin-top: 8px; line-height: 1.4;">
        <strong>${project.gc_name}</strong><br/>
        ${project.gc_address || '[GC Address]'}
      </div>
    </td>
    <td style="width: 50%; padding: 5px;">
      <div class="section-header">CANCELLATION</div>
      <div class="small" style="margin-top: 5px; line-height: 1.3;">
        SHOULD ANY OF THE ABOVE DESCRIBED POLICIES BE CANCELLED BEFORE
        THE EXPIRATION DATE THEREOF, NOTICE WILL BE DELIVERED IN
        ACCORDANCE WITH THE POLICY PROVISIONS.
      </div>
      <div style="margin-top: 15px;">
        <div class="section-header">AUTHORIZED REPRESENTATIVE</div>
        <div style="margin-top: 20px; border-top: 1px solid #000; padding-top: 2px;">
          ${insuranceData?.broker_signature_url ? `<img src="${insuranceData.broker_signature_url}" style="max-height: 30px;"/>` : '[Broker Signature Required]'}
        </div>
      </div>
    </td>
  </tr>
</table>

<!-- Footer -->
<div style="margin-top: 5px; padding: 5px; border: 2px solid #000; text-align: center; background: ${hasReusableInsurance ? '#fff' : '#f0f0f0'};">
  ${hasReusableInsurance ? '<div style="font-weight: bold; font-size: 8pt;">CERTIFICATE OF INSURANCE - PAGE 1 OF 2</div>' : '<div style="font-weight: bold; font-size: 8pt; color: #d00;">** SAMPLE CERTIFICATE - PAGE 1 OF 2 **</div>'}
  <div class="small" style="margin-top: 3px;">
    ${hasReusableInsurance ? 'Valid insurance certificate' : 'Broker to complete all coverage details and limits based on actual policies'}<br/>
    ACORD 25 (2016/03) | © 1988-2015 ACORD CORPORATION. All rights reserved.
  </div>
</div>

<!-- PAGE BREAK -->
<div style="page-break-after: always;"></div>

<!-- PAGE 2 - ADDITIONAL INSURED ENTITIES -->
<div style="margin-top: 20px;">
  <div class="acord-header" style="margin-bottom: 10px;">ADDITIONAL INSURED ENTITIES</div>
  <div style="text-align: right; font-size: 6pt; margin-bottom: 10px;">PAGE 2 OF 2</div>

  <table style="margin-bottom: 10px;">
    <tr>
      <td style="padding: 5px; background: #f0f0f0;">
        <div style="font-weight: bold; margin-bottom: 5px;">Project Information</div>
        <div style="font-size: 7pt;">
          <strong>Project:</strong> ${project.project_name}<br/>
          <strong>Location:</strong> ${project.address}, ${project.city}, ${project.state} ${project.zip_code}<br/>
          <strong>Named Insured:</strong> ${formData.subcontractor_name}
        </div>
      </td>
    </tr>
  </table>

  <table>
    <tr style="background: #fff;">
      <td style="padding: 8px; border: 2px solid #000;">
        <div style="font-weight: bold; font-size: 8pt; margin-bottom: 10px; text-decoration: underline;">
          THE FOLLOWING ENTITIES MUST BE LISTED AS ADDITIONAL INSURED:
        </div>

        <div style="margin-bottom: 15px;">
          <div style="font-weight: bold; font-size: 7pt; color: #333; margin-bottom: 5px;">CERTIFICATE HOLDER:</div>
          <div style="font-size: 8pt; padding: 5px; background: #f9f9f9; border-left: 3px solid #2563eb;">
            <strong>${project.gc_name}</strong><br/>
            ${project.gc_address || '[GC Address]'}
          </div>
        </div>

        ${project.owner_entity ? `
        <div style="margin-bottom: 15px;">
          <div style="font-weight: bold; font-size: 7pt; color: #333; margin-bottom: 5px;">OWNER/DEVELOPER:</div>
          <div style="font-size: 8pt; padding: 5px; background: #f9f9f9; border-left: 3px solid #10b981;">
            ${project.owner_entity}
          </div>
        </div>
        ` : ''}

        ${project.additional_insured_entities && project.additional_insured_entities.length > 0 ? `
        <div style="margin-bottom: 10px;">
          <div style="font-weight: bold; font-size: 7pt; color: #333; margin-bottom: 5px;">ADDITIONAL INSURED ENTITIES:</div>
          ${project.additional_insured_entities.map((entity, idx) => `
            <div style="font-size: 8pt; padding: 5px; background: #f9f9f9; border-left: 3px solid #f59e0b; margin-bottom: 5px;">
              ${idx + 1}. ${entity}
            </div>
          `).join('')}
        </div>
        ` : ''}

        <div style="margin-top: 20px; padding: 10px; background: #fef3c7; border: 1px solid #f59e0b; border-radius: 4px;">
          <div style="font-weight: bold; font-size: 7pt; color: #92400e; margin-bottom: 5px;">⚠️ IMPORTANT NOTICE TO BROKER:</div>
          <div style="font-size: 6pt; color: #92400e; line-height: 1.4;">
            All entities listed above MUST be included as Additional Insured on the General Liability${project.additional_insured_entities && project.additional_insured_entities.length > 0 ? ' and Umbrella' : ''} policies. 
            Policies must include endorsements for ongoing and completed operations on a primary and non-contributory basis.
            Blanket Additional Insured language with privity requirements is NOT acceptable.
          </div>
        </div>
      </td>
    </tr>
  </table>

  <!-- Page 2 Footer -->
  <div style="margin-top: 10px; padding: 5px; border: 2px solid #000; text-align: center; background: ${hasReusableInsurance ? '#fff' : '#f0f0f0'};">
    ${hasReusableInsurance ? '<div style="font-weight: bold; font-size: 8pt;">CERTIFICATE OF INSURANCE - PAGE 2 OF 2</div>' : '<div style="font-weight: bold; font-size: 8pt; color: #d00;">** SAMPLE CERTIFICATE - PAGE 2 OF 2 **</div>'}
    <div class="small" style="margin-top: 3px;">
      Additional Insured Requirements | ACORD 25 (2016/03)
    </div>
  </div>
</div>

</body>
</html>`;

        // Upload the HTML as a file
        const htmlBlob = new Blob([sampleCoiContent], { type: 'text/html' });
        const htmlFile = new File([htmlBlob], `${hasReusableInsurance ? 'coi' : 'sample'}-acord25-${coiToken}.html`, { type: 'text/html' });

        const uploadResult = await compliant.integrations.Core.UploadFile({ file: htmlFile });
        sampleCoiUrl = uploadResult.file_url;

      } catch (error) {
        console.error('Failed to generate sample COI:', error);
        // Continue without sample COI if generation or upload fails
      }

      // Get all admin emails from the User entity
      let adminEmails = [];
      try {
        const allUsers = await compliant.entities.User.list();
        const admins = allUsers.filter(u => u.role === 'admin' || u.role === 'super_admin');
        adminEmails = admins.map(a => a.email).filter(Boolean);
      } catch (error) {
        console.error('Failed to fetch admin emails:', error);
        adminEmails = user?.email ? [user.email] : [];
      }

      const coiData = {
        project_sub_id: newProjectSub.id,
        project_id: project.id,
        subcontractor_id: subId,
        project_name: project.project_name,
        project_address: `${project.address}, ${project.city}, ${project.state} ${project.zip_code}`,
        state: project.state,
        subcontractor_name: formData.subcontractor_name,
        trade_type: tradesText,
        gc_id: project.gc_id,
        gc_name: project.gc_name,
        gc_address: project.gc_address || '',
        owner_entity: project.owner_entity || '',
        additional_insured_entities: project.additional_insured_entities || [],
        description_of_operations: description,
        requires_umbrella: requiresUmbrella,
        coi_token: coiToken,
        status: 'awaiting_broker_upload',
        sub_notified_date: new Date().toISOString(),
        sample_coi_pdf_url: sampleCoiUrl,
        broker_company: insuranceData.broker_company,
        broker_name: insuranceData.broker_name,
        broker_email: insuranceData.broker_email,
        broker_phone: insuranceData.broker_phone,
        broker_address: insuranceData.broker_address,
        broker_city: insuranceData.broker_city,
        broker_state: insuranceData.broker_state,
        broker_zip: insuranceData.broker_zip,
        admin_emails: adminEmails,
      };

      // If sub has existing insurance, copy ALL fields exactly
      if (insuranceData && (insuranceData.insurance_carrier_gl || insuranceData.insurance_carrier_wc || insuranceData.insurance_carrier_auto || insuranceData.insurance_carrier_umbrella)) {
        Object.assign(coiData, {
          // GL Policy - copy ALL fields
          insurance_carrier_gl: insuranceData.insurance_carrier_gl,
          policy_number_gl: insuranceData.policy_number_gl,
          gl_each_occurrence: insuranceData.gl_each_occurrence,
          gl_general_aggregate: insuranceData.gl_general_aggregate,
          gl_products_completed_ops: insuranceData.gl_products_completed_ops,
          gl_damage_rented_premises: insuranceData.gl_damage_rented_premises,
          gl_med_exp: insuranceData.gl_med_exp,
          gl_personal_adv_injury: insuranceData.gl_personal_adv_injury,
          gl_effective_date: insuranceData.gl_effective_date,
          gl_expiration_date: insuranceData.gl_expiration_date,
          gl_per_project_aggregate: insuranceData.gl_per_project_aggregate,
          gl_additional_insured: insuranceData.gl_additional_insured,
          gl_waiver_of_subrogation: insuranceData.gl_waiver_of_subrogation,
          gl_primary_non_contributory: insuranceData.gl_primary_non_contributory,
          gl_naic: insuranceData.gl_naic,

          // Umbrella Policy - copy ALL fields
          insurance_carrier_umbrella: insuranceData.insurance_carrier_umbrella,
          policy_number_umbrella: insuranceData.policy_number_umbrella,
          umbrella_each_occurrence: insuranceData.umbrella_each_occurrence,
          umbrella_aggregate: insuranceData.umbrella_aggregate,
          umbrella_effective_date: insuranceData.umbrella_effective_date,
          umbrella_expiration_date: insuranceData.umbrella_expiration_date,
          umbrella_additional_insured: insuranceData.umbrella_additional_insured,
          umbrella_waiver_of_subrogation: insuranceData.umbrella_waiver_of_subrogation,
          umbrella_naic: insuranceData.umbrella_naic,

          // WC Policy - copy ALL fields
          insurance_carrier_wc: insuranceData.insurance_carrier_wc,
          policy_number_wc: insuranceData.policy_number_wc,
          wc_each_accident: insuranceData.wc_each_accident,
          wc_disease_policy_limit: insuranceData.wc_disease_policy_limit,
          wc_disease_each_employee: insuranceData.wc_disease_each_employee,
          wc_effective_date: insuranceData.wc_effective_date,
          wc_expiration_date: insuranceData.wc_expiration_date,
          wc_waiver_of_subrogation: insuranceData.wc_waiver_of_subrogation,
          wc_naic: insuranceData.wc_naic,

          // Auto Policy - copy ALL fields
          insurance_carrier_auto: insuranceData.insurance_carrier_auto,
          policy_number_auto: insuranceData.policy_number_auto,
          auto_combined_single_limit: insuranceData.auto_combined_single_limit,
          auto_bi_per_person: insuranceData.auto_bi_per_person,
          auto_bi_per_accident: insuranceData.auto_bi_per_accident,
          auto_property_damage: insuranceData.auto_property_damage,
          auto_effective_date: insuranceData.auto_effective_date,
          auto_expiration_date: insuranceData.auto_expiration_date,
          auto_additional_insured: insuranceData.auto_additional_insured,
          auto_waiver_of_subrogation: insuranceData.auto_waiver_of_subrogation,
          auto_any_auto: insuranceData.auto_any_auto,
          auto_owned_autos: insuranceData.auto_owned_autos,
          auto_scheduled_autos: insuranceData.auto_scheduled_autos,
          auto_hired_autos: insuranceData.auto_hired_autos,
          auto_non_owned_autos: insuranceData.auto_non_owned_autos,
          auto_naic: insuranceData.auto_naic,

          first_coi_uploaded: false,
          first_coi_url: null,
          first_coi_upload_date: null,
          broker_signature_url: null,
        });
      }

      const _createdCOI = await compliant.entities.GeneratedCOI.create(coiData);
      
      // Create Portal for subcontractor (async, don't block)
      const baseUrl = window.location.origin.replace(/\/$/, '');
      
      // Generate secure portal token using crypto
      const portalTokenBytes = new Uint8Array(24);
      crypto.getRandomValues(portalTokenBytes);
      const portalToken = Array.from(portalTokenBytes, byte => byte.toString(16).padStart(2, '0')).join('');
      
      const portalUrl = `${baseUrl}${createPageUrl('SubcontractorDashboard')}?id=${subId}`;

      compliant.entities.Portal.create({
        user_type: 'subcontractor',
        user_id: subId,
        user_name: formData.subcontractor_name,
        user_email: formData.contact_email,
        access_token: portalToken,
        dashboard_url: portalUrl,
        status: 'active',
        welcome_email_sent: false
      }).catch(err => console.error('Failed to create subcontractor portal:', err));

      // Notify broker to upload/sign for this project
      if (insuranceData?.broker_email) {
        try {
          const baseUrl = window.location.origin.replace(/\/$/, '');
          const brokerSignLink = `${baseUrl}${createPageUrl('broker-upload-coi')}?token=${coiToken}`;

          // Check if broker record exists, if not create it
          const _existingBroker = allSubcontractors.find(s => s.contractor_type === 'subcontractor')?.id;

          const allBrokers = await compliant.entities.Broker.list();
          let broker = allBrokers.find(b => b.broker_email === insuranceData.broker_email);

          if (!broker) {
            broker = await compliant.entities.Broker.create({
              subcontractor_id: subId,
              subcontractor_name: formData.subcontractor_name,
              broker_company: insuranceData.broker_company || 'Insurance Broker',
              broker_name: insuranceData.broker_name || 'Broker',
              broker_email: insuranceData.broker_email,
              broker_phone: insuranceData.broker_phone || '',
            });
            const _brokerId = broker.id;

            // Create Portal for broker (async, don't block)
            // Generate secure broker portal token using crypto
            const brokerPortalTokenBytes = new Uint8Array(24);
            crypto.getRandomValues(brokerPortalTokenBytes);
            const brokerPortalToken = Array.from(brokerPortalTokenBytes, byte => byte.toString(16).padStart(2, '0')).join('');
            
            const brokerPortalUrl = `${baseUrl}${createPageUrl('BrokerDashboard')}?id=${broker.id}`;
            const brokerDashboardLink = brokerPortalUrl;

            compliant.entities.Portal.create({
              user_type: 'broker',
              user_id: broker.id,
              user_name: insuranceData.broker_name || 'Broker',
              user_email: insuranceData.broker_email,
              access_token: brokerPortalToken,
              dashboard_url: brokerPortalUrl,
              status: 'active',
              welcome_email_sent: false
            }).then(async () => {
              // Send welcome email after portal is created
              try {
                await sendEmail({
                  to: insuranceData.broker_email,
                  subject: `Welcome to InsureTrack - ${insuranceData.broker_company || 'Insurance Broker'}`,
                  body: `Dear ${insuranceData.broker_name || 'Broker'},

          Welcome to InsureTrack! You've been added as an insurance broker.

          📊 Access Your Dashboard: ${brokerDashboardLink}

          From your dashboard, you can:
          • View all certificate requests
          • Upload certificates
          • Track certificate status
          • Manage client insurance

          You have project-specific certificate requests awaiting upload and signature: ${brokerSignLink}

          Best regards,
          InsureTrack Team`
                });
              } catch (err) {
                console.error('Failed to send broker welcome email:', err);
              }
            }).catch(err => console.error('Failed to create broker portal:', err));
          } else {
            // brokerId = broker.id;
          }

          await sendEmail({
            to: insuranceData.broker_email,
            subject: `📝 Certificate Requested - Upload & Sign (${project.project_name})`,
            body: `A project-specific certificate is required for your client.

Subcontractor: ${formData.subcontractor_name}
Project: ${project.project_name}
Trade: ${tradesText}

Action needed: Upload the ACORD COI and policies, then sign for this project: ${brokerSignLink}

After you sign, it will be submitted to the admin for final approval.

Best regards,
InsureTrack System`
          });
        } catch (emailError) {
          console.error('Failed to send broker notification:', emailError);
        }
      }

      // Send email to subcontractor
      const brokerInfoLink = `${baseUrl}${createPageUrl('SubEnterBrokerInfo')}?token=${coiToken}`;

      const dashboardLink = `${baseUrl}${createPageUrl('SubcontractorDashboard')}?id=${subId}`;

      // Send email async (don't block)
      const emailParams = {
        to: formData.contact_email,
        subject: `Insurance Certificate Required - ${project.project_name}`,
        body: `Dear ${formData.subcontractor_name},

      You have been added to the project "${project.project_name}" with ${project.gc_name}.

      To complete onboarding, we need a project-specific insurance certificate.

      ⭐ STEP 1: Enter Your Insurance Broker Information
      👉 Click here to get started: ${brokerInfoLink}

      We'll send your broker the project details and sample so they can upload and sign the COI for this job.

      ${sampleCoiUrl ? 'A sample certificate showing the required format is attached to this email.' : ''}

      📊 After submitting broker info, view your dashboard: ${dashboardLink}

      Project Details:
      - Project: ${project.project_name}
      - Location: ${project.address}, ${project.city}, ${project.state}

      Questions? Reply to this email or contact ${project.gc_name}.

      Best regards,
      InsureTrack Team`
      };

      // Add attachment if sample COI exists
      // Attachment functionality is not supported, the link is already in the email body.

      // Send email to subcontractor and wait for confirmation
      try {
        await sendEmail(emailParams);
      } catch (err) {
        console.error('Failed to send subcontractor email:', err);
        alert(`⚠️ Subcontractor added but email to ${formData.contact_email} failed. Error: ${err.message}`);
        return;
      }
      
      // Notify broker to upload/sign a project-specific COI
      if (insuranceData?.broker_email) {
        sendEmail({
          to: insuranceData.broker_email,
          subject: `Certificate Required - ${project.project_name}`,
          body: `Your client ${formData.subcontractor_name} has been added to the project "${project.project_name}".

Project Details:
- Project: ${project.project_name}
- Location: ${project.address}, ${project.city}, ${project.state}
- General Contractor: ${project.gc_name}
- Trade(s): ${formData.trade_types.join(', ')}

Action needed: Upload and sign a project-specific COI with this project's additional insureds/locations using the link provided to you.

Best regards,
InsureTrack System`
        }).catch(err => console.error('Failed to send broker notification:', err));
      }

      // Notify GC about new subcontractor (async)
      if (project.gc_email) {
        sendEmail({
          to: project.gc_email,
          subject: `New Subcontractor Added - ${project.project_name}`,
          body: `A new subcontractor has been added to your project.

      Project: ${project.project_name}
      Subcontractor: ${formData.subcontractor_name}
      Trade(s): ${formData.trade_types.join(', ')}
      Contact: ${formData.contact_email}

      They have been notified to provide and sign a project-specific insurance certificate.

      View project: ${baseUrl}${createPageUrl('ProjectDetails')}?id=${project.id}

      Best regards,
      InsureTrack Team`
        }).catch(err => console.error('Failed to send GC notification:', err));
      }

      alert(`✅ Subcontractor added! Email sent to ${formData.contact_email} with broker info form.`);
      } catch (error) {
        console.error("Failed to add subcontractor:", error);
        alert(`Failed to add subcontractor: ${error.message}`);
      }
    };
  

  const _handleDelete = async (id) => {
    if (!confirm('Remove this subcontractor from the project?')) return;

    try {
      await deleteSubMutation.mutateAsync(id);
    } catch (error) {
        console.error("Failed to remove subcontractor:", error);
        alert('Failed to remove subcontractor. Please try again.');
    }
  };

  const _handleArchiveSub = async (sub) => {
    const subName = allSubcontractors.find(s => s.id === sub.subcontractor_id)?.company_name || 'Subcontractor';
    const reason = prompt(`Archive ${subName} from this project?\n\nPlease provide a reason (e.g., "Job completed", "Removed from project"):`);
    
    if (reason === null) {
      // User cancelled
      return;
    }
    
    if (!reason.trim()) {
      toast.error('Please provide a reason for archiving');
      return;
    }
    
    await archiveSubMutation.mutateAsync({ 
      id: sub.id, 
      reason: reason.trim() 
    });
  };

  const handleCompleteSetup = async () => {
    const program = programs.find(p => p.id === setupFormData.program_id);
    await updateProjectMutation.mutateAsync({
      id: project.id,
      data: {
        program_id: setupFormData.program_id,
        program_name: program?.program_name || '',
        additional_insured_entities: setupFormData.additional_insured_entities,
        needs_admin_setup: false
      }
    });
  };

  const handleAddInsuredToSetup = () => {
    if (newInsuredEntity.trim()) {
      setSetupFormData(prev => ({
        ...prev,
        additional_insured_entities: [...prev.additional_insured_entities, newInsuredEntity.trim()]
      }));
      setNewInsuredEntity('');
      setIsAddInsuredOpen(false); // Close dialog after adding
    }
  };

  const handleRemoveInsuredFromSetup = (entity) => {
    setSetupFormData(prev => ({
      ...prev,
      additional_insured_entities: prev.additional_insured_entities.filter(e => e !== entity)
    }));
  };

  const handleAddInsured = async (e) => {
    e.preventDefault();
    if (!newInsuredEntity.trim()) return;

    const currentEntities = project.additional_insured_entities || [];
    await updateProjectMutation.mutateAsync({
      id: project.id,
      data: {
        additional_insured_entities: [...currentEntities, newInsuredEntity.trim()]
      }
    });
  };

  const handleRemoveInsured = async (entity) => {
    if (!confirm(`Remove "${entity}" from additional insured list?`)) return;

    const currentEntities = project.additional_insured_entities || [];
    await updateProjectMutation.mutateAsync({
      id: project.id,
      data: {
        additional_insured_entities: currentEntities.filter(e => e !== entity)
      }
    });
  };

  const getSubDocuments = (_subName, _tradeTypes) => { // Updated parameter name to reflect multiple trades
    return documents.filter(d =>
      d.subcontractor_name === _subName &&
      d.gc_id === project.gc_id
    );
  };

  const calculateComplianceStatus = (sub) => {
    const subTrades = (sub.trade_types && sub.trade_types.length > 0)
      ? sub.trade_types
      : (sub.trade_type ? [sub.trade_type] : []); // Robustly get trades from project sub

    // For compliance status, we should check against all requirements from all trades
    const allReqsForSub = subTrades.flatMap(trade => getRequirementsForTrade(trade));
    const subDocs = getSubDocuments(sub.subcontractor_name, subTrades);

    if (sub.compliance_status === 'pending_broker') {
      return { status: 'pending_broker', label: 'Pending Broker Info', icon: Clock, color: 'blue' };
    }

    const subCOIs = allCOIs.filter(c => c.project_sub_id === sub.id && c.project_id === project.id);
    const hasPendingHoldHarmless = subCOIs.some(c =>
      c.hold_harmless_status === 'pending_signature' ||
      c.hold_harmless_status === 'signed_by_sub' ||
      c.hold_harmless_status === 'pending_gc_signature'
    );

    if (hasPendingHoldHarmless) {
      return { status: 'pending_hold_harmless', label: 'Pending Hold Harmless', icon: Clock, color: 'amber' };
    }

    if (allReqsForSub.length === 0) return { status: 'compliant', color: 'emerald' };

    const requiredReqs = allReqsForSub.filter(r => r.is_required);
    const approvedDocs = subDocs.filter(d => d.approval_status === 'approved');

    if (approvedDocs.length === 0) return { status: 'pending_documents', color: 'amber' };

    // Check if all *types* of required insurance are covered by at least one approved document
    const hasAllRequired = requiredReqs.every(req =>
      approvedDocs.some(doc => doc.insurance_type === req.insurance_type)
    );

    if (hasAllRequired) return { status: 'compliant', color: 'emerald' };
    return { status: 'non_compliant', color: 'red' };
  };

  const _complianceStatusConfig = {
    pending_broker: { label: 'Pending Broker Info', icon: Clock, color: 'blue' },
    pending_documents: { label: 'Pending Documents', icon: Clock, color: 'amber' },
    pending_hold_harmless: { label: 'Pending Hold Harmless', icon: Clock, color: 'amber' },
    compliant: { label: 'Compliant', icon: CheckCircle2, color: 'emerald' },
    non_compliant: { label: 'Non-Compliant', icon: AlertCircle, color: 'red' },
    under_review: { label: 'Under Review', icon: Clock, color: 'blue' },
  };

  const _openBrokerRequest = (sub) => {
    setSelectedSubForRequest(sub);
    setIsBrokerRequestOpen(true);
  };

  const _handleViewSubDetails = (sub) => {
    navigate(createPageUrl(`SubcontractorView?id=${sub.subcontractor_id}&name=${encodeURIComponent(sub.subcontractor_name)}&project=${projectId}`));
  };

  if (!projectId || !project) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-4 md:p-8 flex items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="p-8 text-center">
            <p className="text-slate-600 mb-4">Project not found</p>
            <Button onClick={() => navigate(createPageUrl("Projects"))}>
              Back to Projects
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin';

  // Check if project needs setup
  if (project.needs_admin_setup) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-4 md:p-8">
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="flex items-center gap-4 mb-6">
            <Button
              variant="outline"
              size="icon"
              onClick={() => navigate(isAdmin ? createPageUrl("Projects") : createPageUrl("GCProjects"))}
            >
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold text-slate-900">{project.project_name}</h1>
              <p className="text-slate-600">{project.gc_name}</p>
            </div>
          </div>

          {isAdmin ? (
            <>
              <Alert className="bg-red-50 border-red-200">
                <AlertTriangle className="h-4 w-4 text-red-600" />
                <AlertDescription className="text-red-900">
                  <p className="font-semibold mb-2">Complete Project Setup</p>
                  <p>Assign an insurance program and additional insured entities to activate this project.</p>
                </AlertDescription>
              </Alert>

              <Card className="border-slate-200 shadow-lg">
                <CardHeader className="border-b border-slate-200">
                  <CardTitle className="text-xl font-bold">Project Information</CardTitle>
                </CardHeader>
                <CardContent className="p-6 space-y-4">
                  {project.address && (
                    <div>
                      <p className="text-sm text-slate-500 mb-1">Address</p>
                      <p className="text-slate-900">
                        {[project.address, project.city, project.state, project.zip_code].filter(Boolean).join(', ')}
                      </p>
                    </div>
                  )}
                  {project.unit_count && (
                    <div>
                      <p className="text-sm text-slate-500 mb-1">Units</p>
                      <p className="text-slate-900">{project.unit_count}</p>
                    </div>
                  )}
                  {project.project_type && (
                    <div>
                      <p className="text-sm text-slate-500 mb-1">Project Type</p>
                      <Badge variant="outline">{project.project_type.replace('_', ' ')}</Badge>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="border-slate-200 shadow-lg">
                <CardHeader className="border-b border-slate-200">
                  <CardTitle className="text-xl font-bold">Setup Configuration</CardTitle>
                </CardHeader>
                <CardContent className="p-6 space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="program_id">
                      Insurance Program <span className="text-red-500">*</span>
                    </Label>
                    <Select
                      value={setupFormData.program_id}
                      onValueChange={(value) => setSetupFormData({ ...setupFormData, program_id: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select insurance program" />
                      </SelectTrigger>
                      <SelectContent>
                        {programs.map((program) => (
                          <SelectItem key={program.id} value={program.id}>
                            {program.program_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-slate-500">
                      This program&apos;s requirements will apply to all subcontractors
                    </p>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between mb-2">
                      <Label>Additional Insured Entities</Label>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => setIsAddInsuredOpen(true)}
                        className="text-red-600"
                      >
                        <Plus className="w-3 h-3 mr-1" />
                        Add Entity
                      </Button>
                    </div>
                    {setupFormData.additional_insured_entities.length === 0 ? (
                      <p className="text-sm text-slate-500 italic">
                        No additional insured entities added yet (e.g., property owners, lenders, neighbors)
                      </p>
                    ) : (
                      <div className="grid gap-2">
                        {setupFormData.additional_insured_entities.map((entity, index) => (
                          <div key={`setup-entity-${index}-${entity.substring(0,15)}`} className="flex items-center justify-between p-3 bg-slate-50 rounded border">
                            <span className="font-medium text-slate-900">{entity}</span>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => handleRemoveInsuredFromSetup(entity)}
                              className="text-red-600 hover:text-red-700 hover:bg-red-50"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                    <p className="text-xs text-slate-500">
                      These entities will be required on all insurance certificates
                    </p>
                  </div>

                  <Button
                    onClick={handleCompleteSetup}
                    disabled={!setupFormData.program_id || updateProjectMutation.isPending}
                    className="w-full bg-red-600 hover:bg-red-700"
                  >
                    <CheckCircle2 className="w-4 h-4 mr-2" />
                    Complete Setup & Activate Project
                  </Button>
                </CardContent>
              </Card>
            </>
          ) : (
            <Alert className="bg-amber-50 border-amber-200">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              <AlertDescription className="text-amber-900">
                <p className="font-semibold mb-2">Project Setup in Progress</p>
                <p>Our team is setting up the insurance program for this project. You&apos;ll be able to add subcontractors once setup is complete.</p>
              </AlertDescription>
            </Alert>
          )}

          <Card className="border-slate-200 shadow-lg">
            <CardHeader className="border-b border-slate-200">
              <CardTitle className="text-xl font-bold">Project Details</CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              {project.address && (
                <div>
                  <p className="text-sm text-slate-500 mb-1">Address</p>
                  <p className="text-slate-900">
                    {[project.address, project.city, project.state, project.zip_code].filter(Boolean).join(', ')}
                  </p>
                </div>
              )}
              {project.unit_count && (
                <div>
                  <p className="text-sm text-slate-500 mb-1">Units</p>
                  <p className="text-slate-900">{project.unit_count}</p>
                </div>
              )}
              {project.project_type && (
                <div>
                  <p className="text-sm text-slate-500 mb-1">Project Type</p>
                  <Badge variant="outline">{project.project_type.replace('_', ' ')}</Badge>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Add Insured Entity Dialog for Setup */}
        <Dialog open={isAddInsuredOpen} onOpenChange={setIsAddInsuredOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold">
                Add Additional Insured Entity
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="entity_name">
                  Entity Name <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="entity_name"
                  value={newInsuredEntity}
                  onChange={(e) => setNewInsuredEntity(e.target.value)}
                  placeholder="e.g., ABC Property LLC, XYZ Management Corp"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddInsuredToSetup();
                    }
                  }}
                />
                <p className="text-xs text-slate-500">
                  This entity will need to be listed as additional insured on all insurance certificates
                </p>
              </div>
            </div>

            <DialogFooter className="gap-2">
              <Button type="button" variant="outline" onClick={() => setIsAddInsuredOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleAddInsuredToSetup}
                className="bg-red-600 hover:bg-red-700"
                disabled={!newInsuredEntity.trim()}
              >
                Add Entity
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="space-y-4 animate-fade-in">
          <div className="flex items-center justify-between gap-4 mb-6">
            <Button
              variant="outline"
              size="icon"
              onClick={() => navigate(createPageUrl("Projects"))}
              className="bg-slate-800 border-slate-700 hover:bg-slate-700 text-slate-300"
            >
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div className="flex-1">
              <h1 className="text-4xl font-bold text-white mb-2">{project.project_name}</h1>
              <div className="flex items-center gap-3 flex-wrap">
                <p className="text-lg text-slate-300">{project.gc_name}</p>
                <span className="text-slate-500">•</span>
                <Badge className="bg-teal-500/30 text-teal-200 border-teal-400/50">
                  <Shield className="w-3 h-3 mr-1" />
                  {project.program_name}
                </Badge>
                {project.state && (
                  <>
                    <span className="text-slate-500">•</span>
                    <Badge className="bg-slate-700 text-slate-200 border-slate-600">
                      {project.state}
                    </Badge>
                  </>
                )}
              </div>
            </div>
            <Button
              onClick={() => setIsDialogOpen(true)}
              className="bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 group"
            >
              <Plus className="w-4 h-4 mr-2 group-hover:rotate-90 transition-transform" />
              Add Subcontractor
            </Button>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid md:grid-cols-4 gap-6 animate-fade-in-delay-100">
          <StatCardProject
            icon={Users}
            label="Subcontractors"
            value={projectSubs.length}
            colorClass="blue"
          />
          <StatCardProject
            icon={CheckCircle2}
            label="Compliant"
            value={projectSubs.filter(sub => calculateComplianceStatus(sub).status === 'compliant').length}
            colorClass="emerald"
          />
          <StatCardProject
            icon={AlertCircle}
            label="Pending"
            value={projectSubs.filter(sub => calculateComplianceStatus(sub).status !== 'compliant').length}
            colorClass="amber"
          />
          <StatCardProject
            icon={Building2}
            label="Units"
            value={project.unit_count || '-'}
            colorClass="purple"
          />
        </div>

        {/* Additional Insured Entities */}
        <div className="animate-fade-in-delay-200">
          <Card className="border-slate-700 bg-slate-800/50 backdrop-blur-sm shadow-xl">
            <CardHeader className="border-b border-slate-700 pb-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Shield className="w-5 h-5 text-teal-400" />
                  <CardTitle className="text-2xl font-bold bg-gradient-to-r from-red-200 to-rose-200 bg-clip-text text-transparent">
                    Additional Insured Entities
                  </CardTitle>
                </div>
                <Button
                  onClick={() => setIsAddInsuredOpen(true)}
                  size="sm"
                  className="bg-teal-600 hover:bg-teal-700"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Entity
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-6">
              {!project.additional_insured_entities || project.additional_insured_entities.length === 0 ? (
                <div className="text-center py-8">
                  <Shield className="w-12 h-12 mx-auto text-slate-600 mb-4" />
                  <p className="text-slate-300">No additional insured entities specified</p>
                  <p className="text-sm text-slate-400 mt-1">Add entities that must be listed on insurance certificates</p>
                </div>
              ) : (
                <div className="grid md:grid-cols-2 gap-3">
                  {project.additional_insured_entities.map((entity, index) => (
                    <div key={`project-entity-${project.id}-${index}-${entity.substring(0,15)}`} className="flex items-center justify-between p-4 bg-slate-700/50 rounded-lg border border-slate-600 hover:border-teal-400/50 transition-colors">
                      <span className="font-medium text-white">{entity}</span>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRemoveInsured(entity)}
                        className="text-red-400 hover:text-red-500 hover:bg-red-500/10"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Insurance Requirements Documents Section */}
        <div className="animate-fade-in-delay-250">
          <ProjectRequirementsManager 
            projectId={project.id} 
            projectName={project.project_name}
          />
        </div>

        {/* Subcontractors Section */}
        <div className="animate-fade-in-delay-300">
          <Card className="border-slate-700 bg-slate-800/50 backdrop-blur-sm shadow-xl">
            <CardHeader className="border-b border-slate-700 pb-6">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-teal-400" />
                <CardTitle className="text-2xl font-bold bg-gradient-to-r from-red-200 to-rose-200 bg-clip-text text-transparent">
                  Subcontractors on Project
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {subsLoading ? (
                <div className="p-6 space-y-4">
                  {Array(3).fill(0).map((_, i) => (
                    <Skeleton key={i} className="h-20 w-full bg-slate-700" />
                  ))}
                </div>
              ) : projectSubs.length === 0 ? (
                <div className="p-12 text-center">
                  <div className="inline-flex items-center justify-center w-20 h-20 bg-slate-700 rounded-full mb-6">
                    <Users className="w-10 h-10 text-slate-500" />
                  </div>
                  <h3 className="text-xl font-semibold text-white mb-2">
                    No Subcontractors Yet
                  </h3>
                  <p className="text-slate-300 mb-6">
                    Add subcontractors to track their insurance compliance
                  </p>
                  <Button onClick={() => setIsDialogOpen(true)} className="bg-teal-600 hover:bg-teal-700">
                    <Plus className="w-4 h-4 mr-2" />
                    Add First Subcontractor
                  </Button>
                </div>
              ) : (
                <div className="divide-y divide-slate-700">
                  {projectSubs.slice(0, 5).map((sub, idx) => {
                    const compStatus = calculateComplianceStatus(sub);
                    return (
                      <SubcontractorRow 
                        key={sub.id} 
                        sub={sub} 
                        compStatus={compStatus}
                        project={project}
                        idx={idx}
                      />
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

      <Dialog open={isDialogOpen} onOpenChange={closeDialog}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">
              Add Subcontractor to Project
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="subcontractor_name">
                  Company Name <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="subcontractor_name"
                  value={formData.subcontractor_name}
                  onChange={(e) => setFormData({ ...formData, subcontractor_name: e.target.value })}
                  placeholder="Subcontractor company"
                  required
                />
              </div>

              <div className="space-y-2">
                <TradeSelectionComponent
                  selectedTrades={formData.trade_types}
                  onTradesChange={(trades) => setFormData({ ...formData, trade_types: trades })}
                  required={true}
                  multipleSelectionAllowed={true}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="contact_email">
                  Contact Email <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="contact_email"
                  type="email"
                  value={formData.contact_email}
                  onChange={(e) => setFormData({ ...formData, contact_email: e.target.value })}
                  placeholder="contact@company.com"
                  required
                />
              </div>
            </div>

            <DialogFooter className="gap-2 flex-col sm:flex-row">
              <Button type="button" variant="outline" onClick={closeDialog} className="w-full sm:w-auto">
                Cancel
              </Button>
              <Button
                type="submit"
                className="bg-red-600 hover:bg-red-700 w-full sm:w-auto"
                disabled={addSubMutation.isPending || formData.trade_types.length === 0 || !formData.contact_email || !formData.subcontractor_name}
              >
                {addSubMutation.isPending ? 'Adding...' : 'Add Subcontractor'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Add Insured Entity Dialog (for already setup projects) */}
      <Dialog open={isAddInsuredOpen} onOpenChange={setIsAddInsuredOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">
              Add Additional Insured Entity
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAddInsured}>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="entity_name">
                  Entity Name <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="entity_name"
                  value={newInsuredEntity}
                  onChange={(e) => setNewInsuredEntity(e.target.value)}
                  placeholder="e.g., ABC Property LLC, XYZ Management Corp"
                  required
                />
                <p className="text-xs text-slate-500">
                  This entity will need to be listed as additional insured on all insurance certificates
                </p>
              </div>
            </div>

            <DialogFooter className="gap-2">
              <Button type="button" variant="outline" onClick={() => setIsAddInsuredOpen(false)}>
                Cancel
              </Button>
              <Button
                type="submit"
                className="bg-red-600 hover:bg-red-700"
                disabled={updateProjectMutation.isPending}
              >
                Add Entity
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <SendBrokerRequestDialog
        isOpen={isBrokerRequestOpen}
        onClose={() => setIsBrokerRequestOpen(false)}
        projectSub={selectedSubForRequest}
        project={project}
      />

      <style>{`
        @keyframes fade-in {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .animate-fade-in {
          animation: fade-in 0.6s ease-out;
        }

        .animate-fade-in-delay-100 {
          animation: fade-in 0.6s ease-out 0.1s both;
        }

        .animate-fade-in-delay-200 {
          animation: fade-in 0.6s ease-out 0.2s both;
        }

        .animate-fade-in-delay-300 {
          animation: fade-in 0.6s ease-out 0.3s both;
        }
      `}</style>
    </div>
    </div>
  );
}

function StatCardProject({ icon: Icon, label, value, colorClass }) {
  const colorMap = {
    blue: { bg: 'from-red-500/10 to-rose-600/5', icon: 'text-red-400', border: 'border-red-500/20', hover: 'hover:border-red-400/40' },
    emerald: { bg: 'from-emerald-500/10 to-emerald-600/5', icon: 'text-emerald-400', border: 'border-emerald-500/20', hover: 'hover:border-emerald-400/40' },
    amber: { bg: 'from-amber-500/10 to-amber-600/5', icon: 'text-amber-400', border: 'border-amber-500/20', hover: 'hover:border-amber-400/40' },
    purple: { bg: 'from-purple-500/10 to-purple-600/5', icon: 'text-purple-400', border: 'border-purple-500/20', hover: 'hover:border-purple-400/40' },
  };

  const colors = colorMap[colorClass];

  return (
    <div className={`relative p-6 bg-gradient-to-br ${colors.bg} border ${colors.border} rounded-xl ${colors.hover} transition-all duration-300`}>
      <div className="flex items-center justify-between mb-4">
        <div className={`p-3 bg-${colorClass}-500/20 rounded-lg`}>
          <Icon className={`w-6 h-6 ${colors.icon}`} />
        </div>
      </div>
      <h3 className="text-sm font-medium text-slate-400 mb-1">{label}</h3>
      <p className="text-3xl font-bold text-white">{value}</p>
    </div>
  );
}

function SubcontractorRow({ sub, compStatus, project: _project, idx }) {
  const statusStyles = {
    compliant: { bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', badge: 'bg-emerald-500/20 text-emerald-300 border-emerald-400/30' },
    pending: { bg: 'bg-amber-500/10', border: 'border-amber-500/20', badge: 'bg-amber-500/20 text-amber-300 border-amber-400/30' },
    deficient: { bg: 'bg-red-500/10', border: 'border-red-500/20', badge: 'bg-red-500/20 text-red-300 border-red-400/30' },
  };

  const styles = statusStyles[compStatus.status] || statusStyles.pending;

  return (
    <div className={`p-6 transition-all duration-300 border-l-4 border-transparent hover:border-teal-400 ${idx % 2 === 0 ? 'bg-slate-800/30' : ''} ${styles.bg}`}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-3">
            <h3 className="text-lg font-bold text-white">{sub.subcontractor_name}</h3>
            <Badge className={`${styles.badge} border`}>
              {compStatus.icon === CheckCircle2 && <CheckCircle2 className="w-3 h-3 mr-1" />}
              {compStatus.icon === AlertTriangle && <AlertTriangle className="w-3 h-3 mr-1" />}
              {compStatus.icon === Clock && <Clock className="w-3 h-3 mr-1" />}
              {compStatus.label}
            </Badge>
          </div>
          
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="text-slate-300">
              <span className="text-slate-400">Trade:</span> {sub.trade_type}
            </div>
            {sub.contact_email && (
              <div className="text-slate-300">
                <span className="text-slate-400">Email:</span> {sub.contact_email}
              </div>
            )}
          </div>
        </div>
        <Button size="sm" variant="outline" className="text-teal-400 border-teal-400/30 hover:bg-teal-500/10">
          <Eye className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}