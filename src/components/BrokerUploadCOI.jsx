import React, { useState } from "react";
import { apiClient } from "@/api/apiClient";
import { sendEmail } from "@/emailHelper";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Upload, FileText, CheckCircle2, AlertCircle, Loader2, X, ChevronRight, ChevronLeft, Shield, AlertTriangle, Download } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createPageUrl } from "@/utils";

export default function BrokerUploadCOI() {
  const urlParams = new URLSearchParams(window.location.search);
  const token = urlParams.get('token');
  const action = urlParams.get('action');
  const stepParam = urlParams.get('step');
  const queryClient = useQueryClient();

  // Compute backend base for Codespaces or local
  const backendBase = React.useMemo(() => {
    const { protocol, host, origin } = window.location;
    const m = host.match(/^(.+)-(\d+)(\.app\.github\.dev)$/);
    if (m) return `${protocol}//${m[1]}-3001${m[3]}`;
    if (origin.includes(':5175')) return origin.replace(':5175', ':3001');
    if (origin.includes(':5176')) return origin.replace(':5176', ':3001');
    return import.meta?.env?.VITE_API_BASE_URL || '';
  }, []);

  // Ensure page doesn't redirect to login
  React.useEffect(() => {
    if (token) {
      sessionStorage.setItem('public_access_enabled', 'true');
      sessionStorage.setItem('public_access_token', token);
    } else {
      // No token provided - redirect to home
      window.location.href = '/';
    }
  }, [token]);

  const [currentStep, setCurrentStep] = useState(1);
  const [uploadedFiles, setUploadedFiles] = useState({
    coi: null,
    gl_policy: null,
    wc_policy: null,
    auto_policy: null,
    umbrella_policy: null,
  });
  const [uploadProgress, setUploadProgress] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [_analysisResults, setAnalysisResults] = useState({});
  const [error, setError] = useState(null);
  const [isComplete, setIsComplete] = useState(false);

  // Track which broker controls which policies
  const [_policyBrokers, setPolicyBrokers] = useState({
    gl: { name: '', email: '', phone: '' },
    auto: { name: '', email: '', phone: '' },
    umbrella: { name: '', email: '', phone: '' },
    wc: { name: '', email: '', phone: '' },
  });

  const [brokerContacts, setBrokerContacts] = useState({
    all: { name: '', email: '', phone: '' },
  });
  const [manualAdminEmails, setManualAdminEmails] = useState('');

  // Whether this is a single broker or multi-broker scenario
  const [useSingleBroker, setUseSingleBroker] = useState(true);

  // Single signature for ALL policies this broker manages
  const [brokerSignature, setBrokerSignature] = useState('');
  const [signatureText, setSignatureText] = useState('');
  const [currentSignatureType, setCurrentSignatureType] = useState(null);
  const canvasRef = React.useRef(null);
  const [isDrawing, setIsDrawing] = React.useState(false);

  const { data: coiRecord, isLoading: isLoadingCoiRecord } = useQuery({
    queryKey: ['coi-by-token', token],
    queryFn: async () => {
      if (!token) return null;
      try {
        const res = await fetch(`${backendBase}/public/coi-by-token?token=${encodeURIComponent(token)}`);
        if (!res.ok) return null;
        return await res.json();
      } catch (error) {
        console.error('Error fetching COI:', error);
        return null;
      }
    },
    enabled: !!token,
    retry: 1,
  });

  // Auto-advance past steps if COI already generated/uploaded
  React.useEffect(() => {
    if (coiRecord) {
      const defaultBrokerName = coiRecord.broker_name || coiRecord.broker_company || '';
      const defaultBrokerPhone = coiRecord.broker_phone || coiRecord.broker_contact_phone || '';
      const defaultBrokerEmail = coiRecord.broker_email || '';
      
      // Determine if multi-broker scenario (different brokers for each policy type)
      const hasMultiBrokerSetup = !!(coiRecord.broker_gl_email || coiRecord.broker_auto_email || coiRecord.broker_umbrella_email || coiRecord.broker_wc_email);
      setUseSingleBroker(!hasMultiBrokerSetup);
      
      // Deep-link handling
      const normalizedStep = stepParam ? parseInt(stepParam, 10) : null;
      if (action === 'sign' || normalizedStep === 3) {
        setCurrentStep(3);
        // If coming to sign and no signature yet, open dialog immediately
        if (!coiRecord.broker_signature_url) {
          setCurrentSignatureType('broker');
        }
      } else if (action === 'upload') {
        // If instructed to upload, go to COI upload if none, otherwise policy upload
        if (!coiRecord.first_coi_uploaded && !coiRecord.first_coi_url) {
          setCurrentStep(1);
        } else {
          setCurrentStep(2);
        }
      } else if (normalizedStep === 1 || normalizedStep === 2) {
        setCurrentStep(normalizedStep);
      } else {
        // Default auto-advance behavior based on record state
        if (coiRecord.broker_signature_url && coiRecord.first_coi_uploaded) {
          setCurrentStep(3);
        } else if ((coiRecord.first_coi_uploaded || coiRecord.first_coi_url) && !coiRecord.broker_signature_url) {
          setCurrentStep(2);
        }
      }

      // Initialize main broker contact info
      setBrokerContacts(prev => ({
        ...prev,
        all: {
          name: prev.all.name || defaultBrokerName,
          email: prev.all.email || defaultBrokerEmail,
          phone: prev.all.phone || defaultBrokerPhone,
        },
      }));

      // Initialize policy-specific brokers (for multi-broker scenarios)
      setPolicyBrokers({
        gl: {
          name: coiRecord.broker_gl_name || defaultBrokerName,
          email: coiRecord.broker_gl_email || defaultBrokerEmail,
          phone: coiRecord.broker_gl_phone || defaultBrokerPhone,
        },
        auto: {
          name: coiRecord.broker_auto_name || defaultBrokerName,
          email: coiRecord.broker_auto_email || defaultBrokerEmail,
          phone: coiRecord.broker_auto_phone || defaultBrokerPhone,
        },
        umbrella: {
          name: coiRecord.broker_umbrella_name || defaultBrokerName,
          email: coiRecord.broker_umbrella_email || defaultBrokerEmail,
          phone: coiRecord.broker_umbrella_phone || defaultBrokerPhone,
        },
        wc: {
          name: coiRecord.broker_wc_name || defaultBrokerName,
          email: coiRecord.broker_wc_email || defaultBrokerEmail,
          phone: coiRecord.broker_wc_phone || defaultBrokerPhone,
        },
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coiRecord?.broker_signature_url, coiRecord?.first_coi_uploaded]);

  const updateCOIMutation = useMutation({
    mutationFn: async ({ data }) => {
      const res = await fetch(`${backendBase}/public/coi-by-token?token=${encodeURIComponent(token)}` , {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (!res.ok) throw new Error('Failed to update COI');
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['coi-by-token']);
    },
  });

  // Determine which policies this broker manages
  const getPoliciesForBroker = () => {
    if (!coiRecord) return [];
    
    const currentBrokerEmail = brokerContacts.all.email;
    const policiesManaged = [];

    // Check which policies are assigned to this broker
    if (!coiRecord.broker_gl_email || coiRecord.broker_gl_email === currentBrokerEmail) {
      policiesManaged.push('gl');
    }
    if (!coiRecord.broker_umbrella_email || coiRecord.broker_umbrella_email === currentBrokerEmail) {
      policiesManaged.push('umbrella');
    }
    if (!coiRecord.broker_auto_email || coiRecord.broker_auto_email === currentBrokerEmail) {
      policiesManaged.push('auto');
    }
    if (!coiRecord.broker_wc_email || coiRecord.broker_wc_email === currentBrokerEmail) {
      policiesManaged.push('wc');
    }

    // If no specific assignments, all policies fall to the main broker
    if (policiesManaged.length === 0 && !coiRecord.broker_gl_email && !coiRecord.broker_auto_email && !coiRecord.broker_umbrella_email && !coiRecord.broker_wc_email) {
      return ['gl', 'umbrella', 'auto', 'wc'];
    }

    return policiesManaged;
  };

  const currentBrokerPolicies = getPoliciesForBroker();

  const handleFileSelect = (fileType, e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    if (file.type === 'application/pdf') {
      setUploadedFiles(prev => ({ ...prev, [fileType]: file }));
      setError(null);
    } else {
      setError(`Please select PDF files only (selected: ${file.type})`);
    }
  };

  const removeFile = (fileType) => {
    setUploadedFiles(prev => ({ ...prev, [fileType]: null }));
  };

  const getEffectiveBroker = (coverageKey) => {
    const brokerAll = brokerContacts?.all || { name: '', email: '', phone: '' };
    if (useSingleBroker) return brokerAll;
    return (brokerContacts?.[coverageKey] || brokerAll);
  };

  const extractCOIData = async (fileUrl) => {
    try {
      const resp = await fetch(`${backendBase}/public/extract-data`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          file_url: fileUrl,
          json_schema: {
            type: "object",
            properties: {
              named_insured: { type: "string", description: "Named Insured company name exactly as shown" },
              insurance_carrier_gl: { type: "string" },
              policy_number_gl: { type: "string" },
              gl_each_occurrence: { type: "number" },
              gl_general_aggregate: { type: "number" },
              gl_products_completed_ops: { type: "number" },
              gl_effective_date: { type: "string" },
              gl_expiration_date: { type: "string" },
              gl_additional_insured: { type: "boolean" },
              gl_waiver_of_subrogation: { type: "boolean" },
              insurance_carrier_umbrella: { type: "string" },
              policy_number_umbrella: { type: "string" },
              umbrella_each_occurrence: { type: "number" },
              umbrella_aggregate: { type: "number" },
              umbrella_effective_date: { type: "string" },
              umbrella_expiration_date: { type: "string" },
              insurance_carrier_wc: { type: "string" },
              policy_number_wc: { type: "string" },
              wc_each_accident: { type: "number" },
              wc_effective_date: { type: "string" },
              wc_expiration_date: { type: "string" },
              insurance_carrier_auto: { type: "string" },
              policy_number_auto: { type: "string" },
              auto_combined_single_limit: { type: "number" },
              auto_effective_date: { type: "string" },
              auto_expiration_date: { type: "string" },
            }
          }
        })
      });
      if (!resp.ok) return null;
      const result = await resp.json();
      return result?.status === 'success' ? (result.output || null) : null;
    } catch (e) {
      console.warn('COI data extraction failed, continuing:', e?.message || e);
      return null;
    }
  };

  const extractPolicyData = async (fileUrl, insuranceType) => {
    let schema = {};
    
    if (insuranceType === 'gl_policy') {
      schema = {
        type: "object",
        properties: {
          insurance_carrier_gl: { type: "string" },
          policy_number_gl: { type: "string" },
          gl_each_occurrence: { type: "number" },
          gl_general_aggregate: { type: "number" },
          gl_products_completed_ops: { type: "number" },
          gl_effective_date: { type: "string" },
          gl_expiration_date: { type: "string" },
          gl_naic: { type: "string" },
        }
      };
    } else if (insuranceType === 'wc_policy') {
      schema = {
        type: "object",
        properties: {
          insurance_carrier_wc: { type: "string" },
          policy_number_wc: { type: "string" },
          wc_each_accident: { type: "number" },
          wc_disease_policy_limit: { type: "number" },
          wc_disease_each_employee: { type: "number" },
          wc_effective_date: { type: "string" },
          wc_expiration_date: { type: "string" },
          wc_naic: { type: "string" },
        }
      };
    } else if (insuranceType === 'umbrella_policy') {
      schema = {
        type: "object",
        properties: {
          insurance_carrier_umbrella: { type: "string" },
          policy_number_umbrella: { type: "string" },
          umbrella_each_occurrence: { type: "number" },
          umbrella_aggregate: { type: "number" },
          umbrella_effective_date: { type: "string" },
          umbrella_expiration_date: { type: "string" },
          umbrella_naic: { type: "string" },
        }
      };
    } else if (insuranceType === 'auto_policy') {
      schema = {
        type: "object",
        properties: {
          insurance_carrier_auto: { type: "string" },
          policy_number_auto: { type: "string" },
          auto_combined_single_limit: { type: "number" },
          auto_effective_date: { type: "string" },
          auto_expiration_date: { type: "string" },
          auto_naic: { type: "string" },
        }
      };
    }

    try {
      const resp = await fetch(`${backendBase}/public/extract-data`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ file_url: fileUrl, json_schema: schema })
      });
      if (!resp.ok) return null;
      const result = await resp.json();
      return result?.status === 'success' ? (result.output || null) : null;
    } catch (e) {
      console.warn('Policy data extraction failed, continuing:', e?.message || e);
      return null;
    }
  };

  const runComplianceAnalysis = async (extractedData) => {
    if (!extractedData) {
      return {
        overall_status: 'pending',
        deficiencies: [],
        summary: 'No data to analyze'
      };
    }

    return {
      overall_status: 'pending',
      deficiencies: [],
      summary: 'Certificate data extracted - awaiting admin review'
    };
  };

  const handleStep1Upload = async () => {
    if (!uploadedFiles.coi) {
      alert('Please select a COI file');
      return;
    }

    try {
      setIsUploading(true);
      setError(null);
      setUploadProgress('Uploading COI...');

      // Step 1: Upload file (public endpoint)
      const formData = new FormData();
      formData.append('file', uploadedFiles.coi);
      const uploadRes = await fetch(`${backendBase}/public/upload-file`, { method: 'POST', body: formData });
      if (!uploadRes.ok) {
        let errorMessage = 'File upload failed';
        try {
          const errorData = await uploadRes.json();
          errorMessage = errorData.error || errorData.message || errorMessage;
        } catch (e) {
          // Use default error message if JSON parsing fails
        }
        throw new Error(errorMessage);
      }
      
      // Validate response is JSON
      const contentType = uploadRes.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        throw new Error('File upload returned invalid response');
      }
      
      const uploadResult = await uploadRes.json();
      
      // Validate upload result has file URL - try standard fields only
      const fileUrl = uploadResult?.file_url || uploadResult?.url;
      if (!fileUrl) {
        throw new Error('File upload failed - no URL returned from server');
      }
      
      // Validate the URL is a proper server URL, not a blob
      if (fileUrl.startsWith('blob:')) {
        throw new Error('File upload failed - received invalid blob URL');
      }

      // Step 2: Extract data
      setUploadProgress('Extracting data from COI...');
      const extractedData = await extractCOIData(fileUrl);

      // Step 3: Prepare update data
      let analysis = { overall_status: 'compliant', deficiencies: [], summary: 'Pending manual review' };
      const updateData = {
        first_coi_url: fileUrl,
        first_coi_uploaded: true,
        first_coi_upload_date: new Date().toISOString(),
        status: 'awaiting_admin_review',
        uploaded_for_review_date: new Date().toISOString(),
      };

      if (extractedData) {
        setUploadProgress('Running compliance analysis...');
        analysis = await runComplianceAnalysis(extractedData);
        Object.assign(updateData, extractedData, { policy_analysis: analysis });
      } else {
        setError('⚠️ Could not extract data automatically - proceeding for manual review');
      }

      // Step 4: Update COI record
      setUploadProgress('Updating certificate record...');
      await updateCOIMutation.mutateAsync({
        id: coiRecord.id,
        data: updateData
      });

      // Step 5: Update ProjectSubcontractor vetting status (best-effort; skip if not permitted)
      try {
        setUploadProgress('Updating vetting queue...');
        if (coiRecord.project_sub_id) {
          await apiClient.entities.ProjectSubcontractor.update(coiRecord.project_sub_id, {
            vetting_status: 'under_review',
            compliance_status: 'awaiting_admin_review'
          });
        }
      } catch (e) {
        console.warn('⚠️ Skipping ProjectSubcontractor update (public portal):', e?.message || e);
      }

      // Step 6: Notify admins
      setUploadProgress('Notifying admins...');
      let adminEmails = coiRecord.admin_emails || [];
      if (adminEmails.length === 0) {
        try {
          const allUsers = await apiClient.entities.User.list();
          const admins = allUsers.filter(u => u.role === 'admin' || u.role === 'super_admin');
          adminEmails = admins.map(a => a.email).filter(Boolean);
        } catch (_) {
          adminEmails = [];
        }
      }

      let _emailsSent = 0;
      for (const adminEmail of adminEmails) {
        try {
          await sendEmail({
            to: adminEmail,
            subject: `📄 COI Uploaded - ${coiRecord.subcontractor_name}`,
            body: `A Certificate of Insurance has been uploaded for review.

  Subcontractor: ${coiRecord.subcontractor_name}
  Project: ${coiRecord.project_name}
  Trade: ${coiRecord.trade_type}
  Broker: ${coiRecord.broker_company || 'N/A'}

  Review in Vetting Queue: ${window.location.origin}${createPageUrl('VettingQueue')}

  Best regards,
  InsureTrack System`
          });
          _emailsSent++;
        } catch (emailError) {
          console.error('Failed to email admin:', adminEmail, emailError.message);
        }
      }

      setAnalysisResults({ coi: analysis });
      setUploadProgress('');
      setIsUploading(false);
      setCurrentStep(2);
    } catch (error) {
      console.error('❌ Upload error:', error);
      setError(`Upload failed: ${error.message || 'Unknown error'}`);
      setIsUploading(false);
      setUploadProgress('');
    }
  };

  const handlePolicyUpload = async (policyType) => {
    const file = uploadedFiles[policyType];
    if (!file) return;

    if (!coiRecord.first_coi_uploaded && !coiRecord.first_coi_url) {
      setError('Please upload the ACORD COI in Step 1 before uploading policies.');
      setCurrentStep(1);
      return;
    }

    try {
      setIsUploading(true);
      setUploadProgress(`Uploading ${policyType.toUpperCase().replace('_', ' ')}...`);
      setError(null);

      const policyForm = new FormData();
      policyForm.append('file', file);
      const policyRes = await fetch(`${backendBase}/public/upload-file`, { method: 'POST', body: policyForm });
      if (!policyRes.ok) {
        let errorMessage = 'File upload failed';
        try {
          const errorData = await policyRes.json();
          errorMessage = errorData.error || errorData.message || errorMessage;
        } catch (e) {
          // Use default error message if JSON parsing fails
        }
        throw new Error(errorMessage);
      }
      
      // Validate response is JSON
      const contentType = policyRes.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        throw new Error('File upload returned invalid response');
      }
      
      const uploadResult = await policyRes.json();
      
      // Validate upload result has file URL - try standard fields only
      const fileUrl = uploadResult?.file_url || uploadResult?.url;
      if (!fileUrl) {
        throw new Error('File upload failed - no URL returned from server');
      }
      
      // Validate the URL is a proper server URL, not a blob
      if (fileUrl.startsWith('blob:')) {
        throw new Error('File upload failed - received invalid blob URL');
      }

      setUploadProgress(`Extracting policy data...`);
      const extractedData = await extractPolicyData(fileUrl, policyType);

      const updateData = {};
      updateData[`${policyType}_url`] = fileUrl;
      if (extractedData) {
        Object.assign(updateData, extractedData);
      }

      if (policyType === 'wc_policy') {
        const wcState = coiRecord.project_state || coiRecord.state || coiRecord.project_state_code || '';
        if (wcState) {
          updateData.wc_policy_state = wcState;
          updateData.wc_reuse_scope = `state:${wcState}`;
        }
      }

      await updateCOIMutation.mutateAsync({
        id: coiRecord.id,
        data: updateData
      });

      // Force refetch to ensure fresh data for validation
      await queryClient.invalidateQueries(['coi-by-token']);
      await new Promise(resolve => setTimeout(resolve, 500)); // Give query time to refetch

      setAnalysisResults(prev => ({ ...prev, [policyType]: extractedData }));
      removeFile(policyType);
      setUploadProgress('');
      setIsUploading(false);

      alert(`✅ ${policyType.toUpperCase().replace('_', ' ')} uploaded successfully!`);
    } catch (error) {
      console.error('Policy upload error:', error);
      setError(`Failed to upload ${policyType}: ${error.message || 'Unknown error'}`);
      setIsUploading(false);
      setUploadProgress('');
    }
  };

  const _startDrawing = (e) => {
    setIsDrawing(true);
    const canvas = canvasRef.current;
    if (!canvas) {
      console.error('❌ Canvas ref not found');
      return;
    }
    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    ctx.beginPath();
    ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top);
  };

  const _draw = (e) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#000';
    ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top);
    ctx.stroke();
  };

  const _stopDrawing = () => {
    setIsDrawing(false);
  };

  const applySignatureData = (dataUrl) => {
    if (!dataUrl) return;
    // One signature for all policies this broker manages
    setBrokerSignature(dataUrl);
    setSignatureText('');
    setCurrentSignatureType(null);
  };

  const _saveSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL('image/png');
    applySignatureData(dataUrl);
  };

  const saveTypedSignature = () => {
    if (!signatureText.trim()) return;
    const canvas = document.createElement('canvas');
    canvas.width = 600;
    canvas.height = 200;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#000000';
    ctx.font = '32px cursive';
    ctx.textBaseline = 'middle';
    ctx.fillText(signatureText.trim(), 24, canvas.height / 2);
    const dataUrl = canvas.toDataURL('image/png');
    applySignatureData(dataUrl);
  };

  const _clearSignature = () => {
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    } else {
      console.error('❌ Canvas not found for clear');
    }
  };

  const handleFinalSubmit = async () => {
    try {
      if (!coiRecord || !coiRecord.id) {
        const errorMsg = 'COI record not loaded. Please refresh the page.';
        console.error('❌', errorMsg);
        setError(errorMsg);
        throw new Error(errorMsg);
      }
      
      if (!brokerSignature) {
        const errorMsg = 'Please add your signature before submitting.';
        console.error('❌', errorMsg);
        setError(errorMsg);
        return;
      }
      
      setIsUploading(true);
      setUploadProgress('Validating broker info...');
      setError(null);

      // For self-generated COIs: broker must upload actual policy PDFs
      // Check if GL policy exists from: current upload OR previously uploaded GL PDF
      const hasGLPolicy = uploadedFiles.gl_policy || coiRecord?.gl_policy_url;
      
      // Only check if this broker manages GL - if not, skip GL validation
      if (currentBrokerPolicies.includes('gl') && !hasGLPolicy) {
        console.error('❌ GL validation failed - broker manages GL but no GL policy uploaded');
        setIsUploading(false);
        setError('Please upload the General Liability (GL) policy PDF in Step 2 before continuing.');
        return;
      }
      
      // For self-generated COIs: broker must upload actual policy PDFs
      // Check if Umbrella policy exists from: current upload OR previously uploaded Umbrella PDF
      const hasUmbrellaPolicy = uploadedFiles.umbrella_policy || coiRecord?.umbrella_policy_url;
      
      // Only check if this broker manages Umbrella - if not, skip Umbrella validation
      if (currentBrokerPolicies.includes('umbrella') && !hasUmbrellaPolicy) {
        console.error('❌ Umbrella validation failed - broker manages Umbrella but no Umbrella policy uploaded');
        setIsUploading(false);
        setError('Please upload the Umbrella/Excess Liability policy PDF in Step 2 before continuing.');
        return;
      }

      // For public portal, use single broker approach or fall back to coiRecord broker email
      const brokerEmail = brokerContacts?.all?.email || coiRecord?.broker_email || '';
      if (!brokerEmail) {
        throw new Error('Broker email is required. Please enter your email address.');
      }

      const brokerData = {};
      const getContactValue = (baseKey, field, contact) => {
        if (!contact) contact = { name: '', email: '', phone: '' };
        if (contact[field]) return contact[field];
        if (coiRecord?.[`${baseKey}_${field}`]) return coiRecord[`${baseKey}_${field}`];
        if (field === 'name') return coiRecord?.broker_name || coiRecord?.broker_company || '';
        if (field === 'email') return coiRecord?.broker_email || brokerEmail || '';
        if (field === 'phone') return coiRecord?.broker_phone || coiRecord?.broker_contact_phone || '';
        return '';
      };

      const applyContact = (baseKey, contact) => {
        const name = getContactValue(baseKey, 'name', contact);
        const email = getContactValue(baseKey, 'email', contact);
        const phone = getContactValue(baseKey, 'phone', contact);

        if (name) brokerData[`${baseKey}_name`] = name;
        if (email) brokerData[`${baseKey}_email`] = email;
        if (phone) brokerData[`${baseKey}_phone`] = phone;
      };

      // For public portal, use single broker for all policies
      applyContact('broker', brokerContacts?.all);
      applyContact('broker_gl', brokerContacts?.all);
      applyContact('broker_auto', brokerContacts?.all);
      applyContact('broker_umbrella', brokerContacts?.all);
      applyContact('broker_wc', brokerContacts?.all);

      if (!coiRecord.wc_policy_state) {
        const wcState = coiRecord.project_state || coiRecord.state || coiRecord.project_state_code || '';
        if (wcState) {
          brokerData.wc_policy_state = wcState;
          brokerData.wc_reuse_scope = `state:${wcState}`;
        }
      }

      const signatureUrls = {};

      setUploadProgress('Uploading signature...');

      // ONE signature for ALL policies this broker manages
      if (brokerSignature) {
        try {
          // Handle mock signature or real data URL
          if (brokerSignature.startsWith('data:mock')) {
            // Mock signature for testing - create a placeholder
            signatureUrls.broker_signature_url = `https://storage.example.com/signature-broker-${token}-${Date.now()}.png`;
          } else {
            // Real signature - upload to backend with proper error handling
            let blob;
            try {
              const response = await fetch(brokerSignature);
              if (!response.ok) {
                throw new Error(`Failed to fetch signature data: ${response.status}`);
              }
              blob = await response.blob();
              
              // Validate blob has content
              if (!blob || blob.size === 0) {
                throw new Error('Signature data is empty');
              }
            } catch (fetchError) {
              console.error('❌ Signature blob conversion failed:', fetchError);
              throw new Error(`Invalid signature data: ${fetchError.message}`);
            }
            
            const file = new File([blob], `signature-broker-${token}.png`, { type: 'image/png' });
            const sigForm = new FormData();
            sigForm.append('file', file);
            const sigRes = await fetch(`${backendBase}/public/upload-file`, { method: 'POST', body: sigForm });
            if (!sigRes.ok) {
              let errorMessage = `Signature upload failed: ${sigRes.status}`;
              try {
                const contentType = sigRes.headers.get('content-type');
                if (contentType && contentType.includes('application/json')) {
                  const errorData = await sigRes.json();
                  errorMessage = errorData.error || errorData.message || errorMessage;
                } else {
                  const errorText = await sigRes.text();
                  if (errorText) errorMessage = errorText;
                }
              } catch (e) {
                // Use default error message
              }
              console.error('❌ Signature upload failed:', errorMessage);
              throw new Error(errorMessage);
            }
            
            // Validate response is JSON
            const contentType = sigRes.headers.get('content-type');
            if (!contentType || !contentType.includes('application/json')) {
              throw new Error('Signature upload returned invalid response');
            }
            
            const result = await sigRes.json();
            const sigUrl = result?.file_url || result?.url;
            if (!sigUrl) {
              console.error('❌ No URL in response:', result);
              throw new Error('Signature upload failed - no URL returned from server');
            }
            signatureUrls.broker_signature_url = sigUrl;
          }
        } catch (sigError) {
          console.error('❌ Signature upload error:', sigError);
          throw new Error(`Signature upload failed: ${sigError.message}`);
        }
      } else {
        console.warn('⚠️ No broker signature provided');
      }

      setUploadProgress('Updating certificate status...');
      
      // Build complete update data with all uploaded files and signatures
      const finalUpdateData = {
        ...signatureUrls,
        ...brokerData,
        status: 'awaiting_admin_review',
        broker_signature_date: new Date().toISOString(),
        uploaded_for_review_date: new Date().toISOString(),
      };
      
      // Persist all uploaded policy file URLs from the current COI record
      if (coiRecord?.gl_policy_url) {
        finalUpdateData.gl_policy_url = coiRecord.gl_policy_url;
      }
      if (coiRecord?.umbrella_policy_url) {
        finalUpdateData.umbrella_policy_url = coiRecord.umbrella_policy_url;
      }
      if (coiRecord?.wc_policy_url) {
        finalUpdateData.wc_policy_url = coiRecord.wc_policy_url;
      }
      if (coiRecord?.auto_policy_url) {
        finalUpdateData.auto_policy_url = coiRecord.auto_policy_url;
      }
      
      await updateCOIMutation.mutateAsync({
        id: coiRecord.id,
        data: finalUpdateData
      });

      // Auto-trigger AI policy analysis
      setUploadProgress('Running AI policy analysis...');
      try {
        const apiBase = backendBase || (import.meta.env.VITE_API_BASE_URL || window.location.origin.replace(':5173', ':3001'));
        const authToken = sessionStorage.getItem('token');
        
        const policyAnalysisRes = await fetch(`${apiBase}/integrations/analyze-policy`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': authToken ? `Bearer ${authToken}` : ''
          },
          body: JSON.stringify({
            coi_id: coiRecord.id,
            policy_documents: [
              uploadedFiles.gl_policy,
              uploadedFiles.wc_policy,
              uploadedFiles.auto_policy,
              uploadedFiles.umbrella_policy
            ].filter(Boolean)
          }),
          credentials: 'include'
        });
        
        // Validate response before parsing JSON
        if (policyAnalysisRes.ok) {
          const contentType = policyAnalysisRes.headers.get('content-type');
          if (contentType && contentType.includes('application/json')) {
            const policyAnalysis = await policyAnalysisRes.json();
            
            // Update COI with analysis results
            if (policyAnalysis && !policyAnalysis.error) {
              await updateCOIMutation.mutateAsync({
                id: coiRecord.id,
                data: {
                  policy_analysis: policyAnalysis,
                  ai_analysis_date: new Date().toISOString()
                }
              });
            }
          } else {
            console.warn('⚠️ AI analysis returned non-JSON response');
          }
        } else {
          console.warn('⚠️ AI analysis request failed:', policyAnalysisRes.status);
        }
      } catch (analysisError) {
        console.warn('⚠️ AI analysis failed (continuing):', analysisError);
        // Don't fail the whole submission if analysis fails
      }

      setUploadProgress('Notifying admins...');
      // Use the finalUpdateData we just persisted, merged with original coiRecord for missing fields
      let refreshedCoi = { ...coiRecord, ...finalUpdateData };
      try {
        // Try to fetch from API but don't fail if unauthorized
        const apiData = await apiClient.entities.GeneratedCOI.read(coiRecord?.id);
        refreshedCoi = { ...refreshedCoi, ...apiData };
      } catch (_) {
        // Public portal may lack permission; use local data from finalUpdateData
      }
      
      // Send broker confirmation email via public endpoint (no auth required)
      setUploadProgress('Sending broker confirmation...');
      try {
        const brokerConfirmationEmail = brokerContacts?.all?.email || coiRecord?.broker_email || '';
        if (brokerConfirmationEmail) {
          const emailRes = await fetch(`${backendBase}/public/send-email`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              to: brokerConfirmationEmail,
              subject: `✅ Certificate Submitted Successfully - ${coiRecord?.subcontractor_name}`,
              body: `Your certificate of insurance has been successfully submitted.

Subcontractor: ${coiRecord?.subcontractor_name}
Project: ${coiRecord?.project_name}
Trade: ${coiRecord?.trade_type}
Submission Date: ${new Date().toLocaleDateString()}

Status: Under Admin Review

We will notify you once the certificate has been reviewed and approved.

Best regards,
InsureTrack System`
            })
          });
          if (emailRes.ok) {
            const contentType = emailRes.headers.get('content-type');
            if (contentType && contentType.includes('application/json')) {
              const _emailResult = await emailRes.json();
            } else {
              console.warn('⚠️ Broker email returned non-JSON response');
            }
          } else {
            // Try to parse error as JSON, but handle non-JSON responses
            try {
              const contentType = emailRes.headers.get('content-type');
              if (contentType && contentType.includes('application/json')) {
                const errorData = await emailRes.json();
                console.warn('⚠️ Broker email failed:', errorData);
              } else {
                const errorText = await emailRes.text();
                console.warn('⚠️ Broker email failed:', errorText);
              }
            } catch (_parseError) {
              console.warn('⚠️ Broker email failed with status:', emailRes.status);
            }
          }
        }
      } catch (brokerEmailError) {
        console.warn('⚠️ Failed to send broker confirmation email:', brokerEmailError?.message || brokerEmailError);
      }
      
      let adminEmailsToNotify = coiRecord?.admin_emails || [];
      // If no admin emails on COI, fetch all admins from User entity
      if (adminEmailsToNotify.length === 0) {
        try {
          const allUsers = await apiClient.entities.User.list();
          const admins = allUsers.filter(u => u.role === 'admin' || u.role === 'super_admin');
          adminEmailsToNotify = admins.map(a => a.email).filter(Boolean);
        } catch (error) {
          console.warn('⚠️ Could not fetch admin emails:', error);
          // Public fallback: fetch default admin emails from backend
          try {
            const res = await fetch(`${backendBase}/public/admin-emails`, { method: 'GET' });
            if (res.ok) {
              const data = await res.json();
              if (Array.isArray(data.emails) && data.emails.length > 0) {
                adminEmailsToNotify = data.emails;
              }
            }
          } catch (fallbackErr) {
            console.warn('⚠️ Fallback admin emails fetch failed:', fallbackErr);
          }
        }
      }

      if (adminEmailsToNotify.length === 0) {
        console.warn('⚠️ No admin emails found');
        // If broker provided manual admin emails, use them
        const manualList = (manualAdminEmails || '')
          .split(',')
          .map(e => e.trim())
          .filter(e => e.includes('@'));
        if (manualList.length > 0) {
          adminEmailsToNotify = manualList;
        }
      } else {
        const brokerPrimaryContact = getEffectiveBroker('gl');
        const brokerNameForEmail = getContactValue('broker', 'name', brokerPrimaryContact) || (refreshedCoi?.broker_company) || (coiRecord?.broker_company) || 'N/A';
        const brokerEmailForEmail = getContactValue('broker', 'email', brokerPrimaryContact) || (refreshedCoi?.broker_email) || (coiRecord?.broker_email) || 'N/A';
        const brokerPhoneForEmail = getContactValue('broker', 'phone', brokerPrimaryContact) || (refreshedCoi?.broker_phone) || (coiRecord?.broker_phone) || 'N/A';

        const _adminDashboardLink = `${window.location.origin}${createPageUrl('admin-dashboard')}?section=PendingReviews&coiId=${coiRecord.id}`;
        const deficiencyLines = (refreshedCoi.policy_analysis?.deficiencies || []).map(def => {
          const severity = def.severity || def.level || 'issue';
          const type = def.insurance_type ? ` (${(def.insurance_type || '').toUpperCase()})` : '';
          const description = def.description || def.summary || def.category || 'Issue detected';
          return `- [${severity.toUpperCase()}]${type} ${description}`;
        });
        const _deficiencySection = deficiencyLines.length > 0
          ? deficiencyLines.join('\n')
          : '- None detected yet (manual review pending)';

        const formatLimits = (values) => values.filter(Boolean).join(', ') || 'N/A';
        const formatDates = (start, end) => (start || end) ? `${start || 'N/A'} -> ${end || 'N/A'}` : 'N/A';

        const _policyLines = [
          `- GL: ${refreshedCoi.insurance_carrier_gl || 'N/A'} | Policy ${refreshedCoi.policy_number_gl || 'N/A'} | Limits: ${formatLimits([
            refreshedCoi.gl_each_occurrence ? `Each Occ ${refreshedCoi.gl_each_occurrence}` : null,
            refreshedCoi.gl_general_aggregate ? `Gen Agg ${refreshedCoi.gl_general_aggregate}` : null,
            refreshedCoi.gl_products_completed_ops ? `Prod/CO ${refreshedCoi.gl_products_completed_ops}` : null
          ])} | Dates: ${formatDates(refreshedCoi.gl_effective_date, refreshedCoi.gl_expiration_date)} | File: ${refreshedCoi.gl_policy_url || 'Missing'}`,
          `- Umbrella: ${refreshedCoi.insurance_carrier_umbrella || 'N/A'} | Policy ${refreshedCoi.policy_number_umbrella || 'N/A'} | Limits: ${formatLimits([
            refreshedCoi.umbrella_each_occurrence ? `Each Occ ${refreshedCoi.umbrella_each_occurrence}` : null,
            refreshedCoi.umbrella_aggregate ? `Agg ${refreshedCoi.umbrella_aggregate}` : null
          ])} | Dates: ${formatDates(refreshedCoi.umbrella_effective_date, refreshedCoi.umbrella_expiration_date)} | File: ${refreshedCoi.umbrella_policy_url || 'Missing'}`,
          `- Auto: ${refreshedCoi.insurance_carrier_auto || 'N/A'} | Policy ${refreshedCoi.policy_number_auto || 'N/A'} | Limits: ${formatLimits([
            refreshedCoi.auto_combined_single_limit ? `CSL ${refreshedCoi.auto_combined_single_limit}` : null
          ])} | Dates: ${formatDates(refreshedCoi.auto_effective_date, refreshedCoi.auto_expiration_date)} | File: ${refreshedCoi.auto_policy_url || 'Missing'}`,
          `- WC: ${refreshedCoi.insurance_carrier_wc || 'N/A'} | Policy ${refreshedCoi.policy_number_wc || 'N/A'} | Limits: ${formatLimits([
            refreshedCoi.wc_each_accident ? `Each Accident ${refreshedCoi.wc_each_accident}` : null,
            refreshedCoi.wc_disease_policy_limit ? `Disease Policy ${refreshedCoi.wc_disease_policy_limit}` : null,
            refreshedCoi.wc_disease_each_employee ? `Disease EE ${refreshedCoi.wc_disease_each_employee}` : null
          ])} | Dates: ${formatDates(refreshedCoi.wc_effective_date, refreshedCoi.wc_expiration_date)} | File: ${refreshedCoi.wc_policy_url || 'Missing'}`,
        ].join('\n');

        const _fileLinks = [
          `- COI (ACORD 25): ${refreshedCoi.first_coi_url || 'Missing'}`,
          `- GL policy: ${refreshedCoi.gl_policy_url || 'Missing'}`,
          `- Umbrella policy: ${refreshedCoi.umbrella_policy_url || 'Missing'}`,
          `- Auto policy: ${refreshedCoi.auto_policy_url || 'Missing'}`,
          `- WC policy: ${refreshedCoi.wc_policy_url || 'Missing'}`,
        ].join('\n');

        const _policySummary = refreshedCoi.policy_analysis?.summary || 'Certificate pending detailed review';

        let _emailsSent = 0;
        for (const adminEmail of adminEmailsToNotify) {
          try {
            
            // Create clean policy list
            const uploadedPolicies = [];
            if (refreshedCoi.gl_policy_url) uploadedPolicies.push('✅ General Liability (GL)');
            if (refreshedCoi.wc_policy_url) uploadedPolicies.push('✅ Workers Compensation (WC)');
            if (refreshedCoi.auto_policy_url) uploadedPolicies.push('✅ Auto Liability');
            if (refreshedCoi.umbrella_policy_url) uploadedPolicies.push('✅ Umbrella/Excess');
            if (refreshedCoi.first_coi_url) uploadedPolicies.push('✅ ACORD 25 Certificate');
            
            const policiesText = uploadedPolicies.length > 0 ? uploadedPolicies.join('\n') : 'No policies uploaded yet';
            
            // Create review link - direct URL without createPageUrl to avoid issues
            const reviewLink = `${window.location.origin}/COIReview?id=${coiRecord.id}`;
            
            
            const adminEmailRes = await fetch(`${backendBase}/public/send-email`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                to: adminEmail,
                subject: `🔍 COI Ready for Review - ${coiRecord.subcontractor_name}`,
                body: `A broker has uploaded policies and signed the Certificate of Insurance. Please review and approve.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 SUBCONTRACTOR INFORMATION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Company: ${coiRecord.subcontractor_name}
Project: ${coiRecord.project_name}
Trade: ${coiRecord.trade_type || 'N/A'}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
👔 BROKER INFORMATION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Broker: ${brokerNameForEmail}
Email: ${brokerEmailForEmail}
Phone: ${brokerPhoneForEmail || 'N/A'}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📄 UPLOADED POLICIES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${policiesText}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔗 ACTION REQUIRED
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Review & Approve COI:
${reviewLink}

Admin Dashboard:
${window.location.origin}${createPageUrl('admin-dashboard')}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Best regards,
InsureTrack System`
              })
            });
            if (adminEmailRes.ok) {
              _emailsSent++;
            } else {
              const errorData = await adminEmailRes.json();
              console.error('❌ Failed to email admin', adminEmail, ':', errorData);
            }
          } catch (emailError) {
            console.error('❌ Failed to email admin', adminEmail, ':', emailError.message || emailError);
          }
        }
        
        // Create dashboard notifications for admins (best-effort; skip if not permitted)
        setUploadProgress('Creating dashboard notifications...');
        try {
          for (const adminEmail of adminEmailsToNotify) {
            try {
              await apiClient.entities.Notification.create({
                recipient_type: 'admin',
                recipient_id: 'admin',
                recipient_email: adminEmail,
                sender_type: 'broker',
                sender_id: brokerEmailForEmail,
                sender_email: brokerEmailForEmail,
                sender_name: brokerNameForEmail,
                notification_type: 'coi_submitted',
                subject: `COI Ready for Review: ${coiRecord.subcontractor_name}`,
                body: `Broker has submitted COI and policies for ${coiRecord.subcontractor_name} on ${coiRecord.project_name}. ${refreshedCoi.policy_analysis?.total_deficiencies || 0} deficiencies detected.`,
                related_entity: 'GeneratedCOI',
                related_entity_id: coiRecord.id,
                action_url: `${window.location.origin}${createPageUrl(`COIReview?id=${coiRecord.id}`)}`,
                is_read: false
              });
            } catch (e) {
              console.warn('⚠️ Skipping notification for', adminEmail, '(public portal)');
            }
          }
        } catch (notifError) {
          console.warn('⚠️ Failed to create notifications (public portal):', notifError?.message || notifError);
        }
      }

      setUploadProgress('Notifying GC...');
      try {
        const projects = await apiClient.entities.Project.list();
        const project = projects.find(p => p.id === coiRecord.project_id);
        if (project?.gc_email) {
          try {
            await sendEmail({
              to: project.gc_email,
              subject: `📋 Insurance Certificate Uploaded - ${coiRecord.subcontractor_name}`,
              body: `A certificate of insurance has been uploaded and is under review.

  Project: ${coiRecord.project_name}
  Subcontractor: ${coiRecord.subcontractor_name}
  Trade: ${coiRecord.trade_type}
  Broker: ${coiRecord.broker_company || 'N/A'}

  Status: Under Admin Review

  You will be notified once the certificate is approved.

  Best regards,
  InsureTrack Team`
            });
          } catch (emailError) {
            console.error('❌ Failed to email GC', project.gc_email, ':', emailError);
          }
        }
      } catch (projError) {
        console.warn('⚠️ Could not fetch project for GC notification (public portal):', projError?.message || projError);
      }

      setIsComplete(true);
      setUploadProgress('');
      setIsUploading(false);
    } catch (error) {
      console.error('❌ Error submitting certificate:', error);
      console.error('❌ Error stack:', error.stack);
      const errorMsg = error.message || 'An unknown error occurred';
      setError(`Failed to submit: ${errorMsg}`);
      alert(`Failed to submit: ${errorMsg}`);
      setIsUploading(false);
      setUploadProgress('');
    }
  };

  if (isLoadingCoiRecord) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
        <Loader2 className="w-12 h-12 animate-spin text-red-600" />
      </div>
    );
  }

  if (!coiRecord) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
        <Card className="max-w-md">
          <CardContent className="p-8 text-center">
            <AlertCircle className="w-16 h-16 mx-auto text-red-500 mb-4" />
            <h2 className="text-xl font-bold text-slate-900 mb-2">Invalid Link</h2>
            <p className="text-slate-600">This upload link is invalid or has expired.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isComplete && token) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
        <Card className="max-w-2xl">
          <CardContent className="p-8 text-center">
            <CheckCircle2 className="w-16 h-16 mx-auto text-green-600 mb-4" />
            <h2 className="text-2xl font-bold text-slate-900 mb-2">
              {coiRecord?.status === 'active' ? 'Certificate Issued!' : 'Certificate Submitted!'}
            </h2>
            <p className="text-slate-600 mb-6">
              The certificate for <strong>{coiRecord.subcontractor_name}</strong> has been {coiRecord?.status === 'active' ? 'issued and is active' : 'submitted for admin review'}.
            </p>
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-left">
              <p className="font-semibold text-red-900 mb-2">Status:</p>
              <ul className="space-y-1 text-sm text-red-800">
                <li>✓ Certificate uploaded and signed</li>
                <li>✓ Policy data saved</li>
                {coiRecord?.status === 'active' ? (
                  <>
                    <li>✓ Admin approved</li>
                    <li>✓ All parties notified</li>
                  </>
                ) : (
                  <>
                    <li>⏳ Awaiting admin review</li>
                    <li>⏳ Admin will be notified shortly</li>
                  </>
                )}
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const projectState = coiRecord?.project_state || coiRecord?.state || coiRecord?.project_state_code || '';

  const steps = [
    { number: 1, title: 'Upload COI', description: 'Main certificate (ACORD 25)' },
    { number: 2, title: 'Policy Documents', description: 'Optional: Upload individual policies' },
    { number: 3, title: 'Signatures', description: 'Add broker signatures' },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-4 md:p-8">
      <div className="max-w-5xl mx-auto space-y-6">
        {/*Stepper */}
        <Card className="border-red-200">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              {steps.map((step, idx) => (
                <React.Fragment key={step.number}>
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${
                      currentStep > step.number ? 'bg-green-600 text-white' :
                      currentStep === step.number ? 'bg-red-600 text-white' :
                      'bg-slate-200 text-slate-600'
                    }`}>
                      {currentStep > step.number ? <CheckCircle2 className="w-5 h-5" /> : step.number}
                    </div>
                    <div className="hidden md:block">
                      <p className="font-semibold text-slate-900">{step.title}</p>
                      <p className="text-xs text-slate-500">{step.description}</p>
                    </div>
                  </div>
                  {idx < steps.length - 1 && (
                    <div className={`flex-1 h-1 mx-4 ${currentStep > step.number ? 'bg-green-600' : 'bg-slate-200'}`} />
                  )}
                </React.Fragment>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Project Info */}
        <Alert className="bg-red-50 border-red-200">
          <FileText className="h-4 w-4 text-red-600" />
          <AlertDescription className="text-red-900">
            <p><strong>Subcontractor:</strong> {coiRecord.subcontractor_name}</p>
            <p><strong>Project:</strong> {coiRecord.project_name}</p>
            <p><strong>Trade:</strong> {coiRecord.trade_type}</p>
          </AlertDescription>
        </Alert>

        {/* Step 1: Upload COI - Skip if already uploaded */}
        {currentStep === 1 && !coiRecord.first_coi_uploaded && (
          <Card className="border-slate-200 shadow-lg">
            <CardHeader className="border-b bg-gradient-to-r from-red-50 to-rose-50">
              <CardTitle className="text-2xl font-bold">Step 1: Upload Certificate of Insurance</CardTitle>
              <p className="text-sm text-slate-600 mt-1">Upload the main ACORD 25 certificate</p>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              <Card className="border-2 border-red-200 bg-red-50">
                <CardContent className="p-6">
                  <h4 className="font-semibold text-slate-900 mb-4">ACORD 25 Certificate</h4>
                  {uploadedFiles.coi ? (
                    <div className="bg-white p-4 rounded-lg flex items-center justify-between border-2 border-red-300">
                      <div className="flex items-center gap-2">
                        <FileText className="w-5 h-5 text-red-600" />
                        <span className="font-medium">{uploadedFiles.coi.name}</span>
                      </div>
                      <Button variant="ghost" size="icon" onClick={() => removeFile('coi')}>
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  ) : (
                    <label className="border-2 border-dashed border-red-300 rounded-lg p-8 cursor-pointer hover:bg-red-100 transition block">
                      <input
                        type="file"
                        accept="application/pdf"
                        onChange={(e) => handleFileSelect('coi', e)}
                        className="hidden"
                      />
                      <Upload className="w-8 h-8 mx-auto text-red-400 mb-2" />
                      <p className="text-center text-slate-700 font-medium">Click to upload COI PDF</p>
                    </label>
                  )}
                </CardContent>
              </Card>

              {error && (
                <Alert className="bg-red-50 border-red-200">
                  <AlertCircle className="h-4 w-4 text-red-600" />
                  <AlertDescription className="text-red-900">{error}</AlertDescription>
                </Alert>
              )}

              {uploadProgress && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3">
                  <Loader2 className="w-5 h-5 text-red-600 animate-spin" />
                  <span className="text-red-900 font-medium">{uploadProgress}</span>
                </div>
              )}

              <Button
                onClick={handleStep1Upload}
                disabled={!uploadedFiles.coi || isUploading}
                className="w-full bg-red-600 hover:bg-red-700 h-12 text-lg font-semibold"
              >
                {isUploading ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Upload className="w-5 h-5 mr-2" />
                    Upload & Analyze COI
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Show message if COI already uploaded */}
        {coiRecord.first_coi_uploaded && currentStep === 1 && (
          <Alert className="bg-emerald-50 border-emerald-200">
            <CheckCircle2 className="h-5 w-5 text-emerald-600" />
            <AlertDescription className="text-emerald-900 font-semibold">
              ✅ Your Certificate of Insurance was automatically generated from your insurance data. Proceed to add signatures.
            </AlertDescription>
          </Alert>
        )}

        {currentStep === 1 && (coiRecord.first_coi_uploaded || coiRecord.first_coi_url) && (
          <div className="flex justify-end">
            <Button onClick={() => setCurrentStep(2)} className="bg-red-600 hover:bg-red-700">
              Continue to Policies
              <ChevronRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        )}

        {/* Step 2: Upload Policy Documents */}
        {currentStep === 2 && (
          <Card className="border-slate-200 shadow-lg">
            <CardHeader className="border-b bg-gradient-to-r from-purple-50 to-pink-50">
              <CardTitle className="text-2xl font-bold">Step 2: Upload Your Policy Documents</CardTitle>
              <p className="text-sm text-slate-600 mt-1">
                {brokerContacts.all.name && (
                  <>
                    <strong>Broker:</strong> {brokerContacts.all.name}
                    {brokerContacts.all.email && ` (${brokerContacts.all.email})`}
                    <br />
                  </>
                )}
                Upload only the policy documents you manage. GL & Umbrella are required.
              </p>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              <Alert className="bg-purple-50 border-purple-200">
                <Shield className="h-4 w-4 text-purple-600" />
                <AlertDescription className="text-purple-900 text-sm">
                  General Liability and Umbrella/Excess are required. Auto and WC uploads help speed up review but are optional.
                </AlertDescription>
              </Alert>

              {/* GL Policy - Only show if this broker manages GL */}
              {currentBrokerPolicies.includes('gl') && (
              <Card className="border-2 border-purple-200">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-semibold">General Liability Policy</h4>
                    <Badge variant="destructive">Required</Badge>
                  </div>
                  {uploadedFiles.gl_policy ? (
                    <div className="bg-purple-50 p-3 rounded flex items-center justify-between">
                      <span className="text-sm">{uploadedFiles.gl_policy.name}</span>
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => handlePolicyUpload('gl_policy')} disabled={isUploading}>
                          Upload
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => removeFile('gl_policy')}>
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <label className="border-2 border-dashed border-purple-300 rounded p-4 cursor-pointer hover:bg-purple-50 transition block">
                      <input
                        type="file"
                        accept="application/pdf"
                        onChange={(e) => handleFileSelect('gl_policy', e)}
                        className="hidden"
                      />
                      <Upload className="w-5 h-5 mx-auto text-purple-400 mb-1" />
                      <p className="text-xs text-center text-slate-600">Click to upload</p>
                    </label>
                  )}
                </CardContent>
              </Card>
              )}

              {/* Umbrella Policy - Only show if this broker manages Umbrella */}
              {currentBrokerPolicies.includes('umbrella') && (
              <Card className="border-2 border-rose-200">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-semibold">Umbrella Policy</h4>
                    <Badge variant="destructive">Required</Badge>
                  </div>
                  {uploadedFiles.umbrella_policy ? (
                    <div className="bg-rose-50 p-3 rounded flex items-center justify-between">
                      <span className="text-sm">{uploadedFiles.umbrella_policy.name}</span>
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => handlePolicyUpload('umbrella_policy')} disabled={isUploading}>
                          Upload
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => removeFile('umbrella_policy')}>
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <label className="border-2 border-dashed border-indigo-300 rounded p-4 cursor-pointer hover:bg-rose-50 transition block">
                      <input
                        type="file"
                        accept="application/pdf"
                        onChange={(e) => handleFileSelect('umbrella_policy', e)}
                        className="hidden"
                      />
                      <Upload className="w-5 h-5 mx-auto text-indigo-400 mb-1" />
                      <p className="text-xs text-center text-slate-600">Click to upload</p>
                    </label>
                  )}
                </CardContent>
              </Card>
              )}

              {/* Auto Policy - Only show if this broker manages Auto */}
              {currentBrokerPolicies.includes('auto') && (
              <Card className="border-2 border-green-200">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-semibold">Auto Liability Policy</h4>
                    <Badge variant="outline">Optional</Badge>
                  </div>
                  {uploadedFiles.auto_policy ? (
                    <div className="bg-green-50 p-3 rounded flex items-center justify-between">
                      <span className="text-sm">{uploadedFiles.auto_policy.name}</span>
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => handlePolicyUpload('auto_policy')} disabled={isUploading}>
                          Upload
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => removeFile('auto_policy')}>
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <label className="border-2 border-dashed border-green-300 rounded p-4 cursor-pointer hover:bg-green-50 transition block">
                      <input
                        type="file"
                        accept="application/pdf"
                        onChange={(e) => handleFileSelect('auto_policy', e)}
                        className="hidden"
                      />
                      <Upload className="w-5 h-5 mx-auto text-green-400 mb-1" />
                      <p className="text-xs text-center text-slate-600">Click to upload</p>
                    </label>
                  )}
                </CardContent>
              </Card>
              )}

              {/* WC Policy - Only show if this broker manages WC */}
              {currentBrokerPolicies.includes('wc') && (
              <Card className="border-2 border-amber-200">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-semibold">Workers Compensation Policy</h4>
                    <Badge variant="outline">Optional</Badge>
                  </div>
                  <p className="text-xs text-amber-700 mb-3">
                    Reused only for projects in the same state{projectState ? ` (${projectState})` : ''}; upload a fresh WC policy for other states.
                  </p>
                  {uploadedFiles.wc_policy ? (
                    <div className="bg-amber-50 p-3 rounded flex items-center justify-between">
                      <span className="text-sm">{uploadedFiles.wc_policy.name}</span>
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => handlePolicyUpload('wc_policy')} disabled={isUploading}>
                          Upload
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => removeFile('wc_policy')}>
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <label className="border-2 border-dashed border-amber-300 rounded p-4 cursor-pointer hover:bg-amber-50 transition block">
                      <input
                        type="file"
                        accept="application/pdf"
                        onChange={(e) => handleFileSelect('wc_policy', e)}
                        className="hidden"
                      />
                      <Upload className="w-5 h-5 mx-auto text-amber-400 mb-1" />
                      <p className="text-xs text-center text-slate-600">Click to upload</p>
                    </label>
                  )}
                </CardContent>
              </Card>
              )}

              {uploadProgress && (
                <Alert className="bg-red-50 border-red-200">
                  <Loader2 className="h-4 w-4 text-red-600 animate-spin" />
                  <AlertDescription className="text-red-900">{uploadProgress}</AlertDescription>
                </Alert>
              )}

              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={() => setCurrentStep(1)}
                  className="flex-1"
                >
                  <ChevronLeft className="w-4 h-4 mr-2" />
                  Back
                </Button>
                <Button
                  onClick={() => setCurrentStep(3)}
                  className="flex-1 bg-red-600 hover:bg-red-700"
                  disabled={!coiRecord.first_coi_uploaded && !coiRecord.first_coi_url}
                >
                  Continue to Signatures
                  <ChevronRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* COI Preview - Show before signatures */}
        {currentStep === 3 && (coiRecord.first_coi_url || coiRecord.first_coi_uploaded) && (
          <Card className="border-slate-200 shadow-lg mb-6">
            <CardHeader className="border-b bg-gradient-to-r from-red-50 to-cyan-50">
              <CardTitle className="text-xl font-bold flex items-center gap-2">
                <FileText className="w-5 h-5" />
                Certificate Preview
              </CardTitle>
              <p className="text-sm text-slate-600 mt-1">Review your generated certificate before signing</p>
            </CardHeader>
            <CardContent className="p-6">
              {coiRecord.first_coi_url ? (
                <div className="space-y-3">
                  <iframe
                    src={coiRecord.first_coi_url}
                    className="w-full h-[600px] border-2 border-slate-200 rounded-lg"
                    title="Certificate of Insurance Preview"
                  />
                  <div className="flex gap-2">
                    <Button
                      onClick={() => window.open(coiRecord.first_coi_url, '_blank')}
                      variant="outline"
                      className="flex-1"
                    >
                      <FileText className="w-4 h-4 mr-2" />
                      Open in New Tab
                    </Button>
                    <Button
                      onClick={() => {
                        const link = document.createElement('a');
                        link.href = coiRecord.first_coi_url;
                        link.download = `COI_${coiRecord.subcontractor_name}_${coiRecord.project_name}.pdf`;
                        link.click();
                      }}
                      variant="outline"
                      className="flex-1"
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Download PDF
                    </Button>
                  </div>
                </div>
              ) : (
                <Alert className="bg-red-50 border-red-200">
                  <FileText className="h-4 w-4 text-red-600" />
                  <AlertDescription className="text-red-900">
                    Your certificate has been generated and is ready for your signature.
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        )}

        {/* Step 3: Signatures */}
        {currentStep === 3 && (
          <Card className="border-slate-200 shadow-lg">
            <CardHeader className="border-b bg-gradient-to-r from-green-50 to-emerald-50">
              <CardTitle className="text-2xl font-bold">Step 3: Add Your Broker Signatures</CardTitle>
              <p className="text-sm text-slate-600 mt-1">
                Sign for the {currentBrokerPolicies.length} policy/policies you manage.
                {brokerContacts.all.name && (
                  <>
                    <br />
                    <strong>Broker:</strong> {brokerContacts.all.name}
                    {brokerContacts.all.email && ` (${brokerContacts.all.email})`}
                  </>
                )}
              </p>
              <Alert className="mt-3 bg-amber-50 border-amber-200">
                <Shield className="h-4 w-4 text-amber-600" />
                <AlertDescription className="text-amber-900 text-sm">
                  <strong>Important:</strong> You must add a signature for General Liability (if it&apos;s listed below) to proceed.
                </AlertDescription>
              </Alert>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              <Card className="border border-slate-200">
                <CardContent className="p-4 space-y-4">
                  <div className="space-y-3">
                    <Label className="font-semibold">Broker Information (All Policies)</Label>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label className="text-xs">Broker name</Label>
                        <Input
                          value={brokerContacts.all.name}
                          onChange={(e) => setBrokerContacts(prev => ({ ...prev, all: { ...prev.all, name: e.target.value } }))}
                          placeholder="e.g., Smith Insurance"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs">Broker email</Label>
                        <Input
                          type="email"
                          value={brokerContacts.all.email}
                          onChange={(e) => setBrokerContacts(prev => ({ ...prev, all: { ...prev.all, email: e.target.value } }))}
                          placeholder="broker@email.com"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs">Broker phone</Label>
                        <Input
                          value={brokerContacts.all.phone}
                          onChange={(e) => setBrokerContacts(prev => ({ ...prev, all: { ...prev.all, phone: e.target.value } }))}
                          placeholder="(555) 555-5555"
                        />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <div className="flex items-center gap-2 p-4 bg-slate-50 rounded border border-slate-200">
                <input
                  type="checkbox"
                  id="sameSignature"
                  checked={true}
                  disabled
                  className="w-4 h-4"
                />
                <label htmlFor="sameSignature" className="font-medium text-sm">
                  Single signature covers all your policies: {currentBrokerPolicies.map(p => p.toUpperCase()).join(', ')}
                </label>
              </div>

              {/* Single Broker Signature for All Managed Policies */}
              <Card className={`border-2 ${brokerSignature ? 'border-red-200' : 'border-red-300 bg-red-50'}`}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-semibold">Broker Signature</h4>
                    {!brokerSignature && (
                      <div className="flex items-center gap-2">
                        <Badge className="bg-red-600">Required</Badge>
                        <button
                          className="text-sm text-red-700 underline"
                          onClick={async () => {
                            try {
                              await apiClient.integrations.Public.BrokerSignCOI({ token });
                              // Refresh COI and mark signature present locally
                              await queryClient.invalidateQueries(['coi-by-token']);
                              setBrokerSignature('data:mock/quick-sign');
                              alert('Signature saved. You can continue.');
                            } catch (e) {
                              alert('Failed to quick sign. Please add signature manually.');
                            }
                          }}
                          title="Quick Sign"
                        >
                          Sign
                        </button>
                      </div>
                    )}
                  </div>
                  <p className="text-sm text-slate-600 mb-4">
                    Sign to authorize all {currentBrokerPolicies.length} policy/policies you manage.
                  </p>
                  {brokerSignature ? (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-5 h-5 text-green-600" />
                        <span className="text-sm text-green-700 font-medium">Signature Added</span>
                      </div>
                      <img src={brokerSignature} alt="Signature" className="h-24 border rounded bg-white p-2" />
                      <Button size="sm" variant="outline" onClick={() => setBrokerSignature('')}>
                        Change Signature
                      </Button>
                    </div>
                  ) : (
                    <Button onClick={() => setCurrentSignatureType('broker')} className="w-full bg-red-600 hover:bg-red-700 h-12">
                      Click to Add Your Signature (Required)
                    </Button>
                  )}
                </CardContent>
              </Card>

              {coiRecord.policy_analysis?.deficiencies?.length > 0 && (
                <Alert className="bg-amber-50 border-amber-200">
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                  <AlertDescription className="text-amber-900">
                    <p className="font-semibold mb-2">⚠️ Issues detected (you can still proceed):</p>
                    <ul className="space-y-1 text-sm">
                      {coiRecord.policy_analysis.deficiencies.slice(0, 5).map((d, idx) => (
                        <li key={idx}>• {d.description}</li>
                      ))}
                    </ul>
                    <p className="mt-2 text-xs">These will be flagged for admin review.</p>
                  </AlertDescription>
                </Alert>
              )}

              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={() => setCurrentStep(2)}
                  className="flex-1"
                >
                  <ChevronLeft className="w-4 h-4 mr-2" />
                  Back
                </Button>
                <Button
                  onClick={() => {
                    handleFinalSubmit();
                  }}
                  disabled={!brokerSignature || isUploading}
                  title={!brokerSignature ? "Please add your signature first" : "Click to issue the certificate"}
                  className="flex-1 bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {!brokerSignature ? (
                    <>
                      <AlertCircle className="w-4 h-4 mr-2" />
                      Add Signature to Continue
                    </>
                  ) : isUploading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Issuing...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4 mr-2" />
                      Issue Certificate
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Signature Dialog */}
      <Dialog open={currentSignatureType !== null} onOpenChange={(open) => {
        if (!open) {
          setCurrentSignatureType(null);
        }
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Signature - {currentSignatureType?.toUpperCase().replace('_', ' ')}</DialogTitle>
            <DialogDescription>
              Enter your name to create a signature
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="signature-name" className="font-semibold">Your Name</Label>
              <Input
                id="signature-name"
                value={signatureText}
                onChange={(e) => setSignatureText(e.target.value)}
                placeholder="e.g., John Smith"
                className="text-lg"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    saveTypedSignature();
                  }
                }}
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="admin-emails" className="font-semibold">Admin Emails (optional)</Label>
              <Input
                id="admin-emails"
                value={manualAdminEmails}
                onChange={(e) => setManualAdminEmails(e.target.value)}
                placeholder="admin1@example.com, admin2@example.com"
              />
              <p className="text-xs text-slate-500">If your admins aren’t pre-configured, you can enter emails here to notify them.</p>
            </div>
            <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
              <p className="text-sm text-slate-600 mb-2">Preview:</p>
              {signatureText.trim() ? (
                <div className="text-3xl font-cursive text-slate-900" style={{ fontStyle: 'italic' }}>
                  {signatureText}
                </div>
              ) : (
                <div className="text-slate-400">Your signature will appear here</div>
              )}
            </div>
            <div className="flex gap-2 justify-end pt-4 border-t">
              <Button variant="outline" onClick={() => setCurrentSignatureType(null)}>
                Cancel
              </Button>
              <Button onClick={saveTypedSignature} disabled={!signatureText.trim()} className="bg-green-600 hover:bg-green-700">
                <CheckCircle2 className="w-4 h-4 mr-2" />
                Save Signature
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}