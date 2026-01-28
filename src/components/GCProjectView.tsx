import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import logger from '../utils/logger';

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
import { getBackendBaseUrl } from "@/urlConfig";

interface Project {
  id: string;
  project_name?: string;
  project_address?: string;
  address?: string;
  city?: string;
  state?: string;
  zip_code?: string;
  gc_id?: string;
  gc_name?: string;
  program_id?: string;
  owner_entity?: string;
  additional_insured_entities?: Array<{ name?: string } | string>;
  description_of_operations?: string;
}

interface ProjectSubcontractor {
  id: string;
  project_id?: string;
  subcontractor_id?: string;
  subcontractor_name?: string;
  trade_type?: string;
  trade_types?: string[];
  contact_email?: string;
  status?: string;
}

interface GeneratedCOI {
  id: string;
  project_id?: string;
  linked_projects?: string[];
  subcontractor_name?: string;
  status?: string;
}

interface Subcontractor {
  id: string;
  company_name?: string;
  contact_email?: string;
  trade_type?: string;
  trade_types?: string[];
}

interface SubForm {
  subcontractor_name: string;
  trade: string;
  contact_email: string;
}

export default function GCProjectView(): JSX.Element {
  const params = new URLSearchParams(window.location.search);
  const projectId = params.get("project");
  const gcId = params.get("id") || sessionStorage.getItem("gcPortalId");
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [form, setForm] = useState<SubForm>({ subcontractor_name: "", trade: "", contact_email: "" });
  const [subError, setSubError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<Subcontractor[]>([]);

  useEffect(() => {
    if (gcId) sessionStorage.setItem("gcPortalId", gcId);
  }, [gcId]);

  const { data: project, isLoading: projectLoading, error: projectError } = useQuery<Project>({
    queryKey: ["gc-project", projectId],
    queryFn: async (): Promise<Project> => {
      const backendBase = getBackendBaseUrl();
      const response = await fetch(`${backendBase}/public/projects`);
      if (!response.ok) throw new Error('Failed to fetch projects');
      const allProjects: Project[] = await response.json();
      const found = allProjects.find((p: Project) => p.id === projectId);
      if (!found) throw new Error("Project not found");
      if (gcId && found.gc_id !== gcId) throw new Error("This project is not assigned to your account");
      return found;
    },
    enabled: !!projectId,
    retry: 1,
  });

  const { data: subs = [], isLoading: subsLoading } = useQuery<ProjectSubcontractor[]>({
    queryKey: ["gc-project-subs", projectId],
    queryFn: async (): Promise<ProjectSubcontractor[]> => {
      const { protocol, host, origin } = window.location;
      const m = host.match(/^(.+)-(\d+)(\.app\.github\.dev)$/);
      const backendBase = m ? `${protocol}//${m[1]}-3001${m[3]}` : 
                         origin.includes(':5175') ? origin.replace(':5175', ':3001') :
                         origin.includes(':5176') ? origin.replace(':5176', ':3001') :
                         import.meta?.env?.VITE_API_BASE_URL || '';
      const response = await fetch(`${backendBase}/public/all-project-subcontractors`);
      if (!response.ok) throw new Error('Failed to fetch subcontractors');
      const allSubs: ProjectSubcontractor[] = await response.json();
      return allSubs.filter((ps: ProjectSubcontractor) => ps.project_id === projectId && ps.status !== 'archived');
    },
    enabled: !!projectId,
    retry: 1,
  });

  // COIs for this project to reflect more accurate review status per subcontractor
  const { data: projectCois = [] } = useQuery<GeneratedCOI[]>({
    queryKey: ["gc-project-cois", projectId],
    queryFn: async (): Promise<GeneratedCOI[]> => {
      const { protocol, host, origin } = window.location;
      const m = host.match(/^(.+)-(\d+)(\.app\.github\.dev)$/);
      const backendBase = m ? `${protocol}//${m[1]}-3001${m[3]}` : 
                         origin.includes(':5175') ? origin.replace(':5175', ':3001') :
                         origin.includes(':5176') ? origin.replace(':5176', ':3001') :
                         import.meta?.env?.VITE_API_BASE_URL || '';
      const response = await fetch(`${backendBase}/public/all-cois`);
      if (!response.ok) throw new Error('Failed to fetch COIs');
      const allCois: GeneratedCOI[] = await response.json();
      return (allCois || []).filter((c: GeneratedCOI) =>
        c.project_id === projectId || (Array.isArray(c.linked_projects) && c.linked_projects.includes(projectId))
      );
    },
    enabled: !!projectId,
    retry: 1,
  });

  // All subcontractors for typeahead reuse
  const { data: allSubcontractors = [] } = useQuery<Subcontractor[]>({
    queryKey: ["all-subs-for-typeahead"],
    queryFn: async (): Promise<Subcontractor[]> => {
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
        const subs: ProjectSubcontractor[] = await response.json();
        
        // Deduplicate by subcontractor_id and transform to have company_name field
        const uniqueSubs: Record<string, Subcontractor> = {};
        subs.forEach((sub: ProjectSubcontractor) => {
          if (!uniqueSubs[sub.subcontractor_id || '']) {
            uniqueSubs[sub.subcontractor_id || ''] = {
              id: sub.subcontractor_id || '',
              company_name: sub.subcontractor_name,
              contact_email: sub.contact_email,
              trade_type: sub.trade_type,
            };
          }
        });
        
        return Object.values(uniqueSubs);
      } catch (err) {
        logger.error('Error fetching subcontractors for typeahead', { context: 'GCProjectView', error: (err as Error).message });
        return [];
      }
    },
    retry: 1,
  });

  const addSubMutation = useMutation({
    mutationFn: async (): Promise<any> => {
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

      const contractorData = await createContractorResponse.json();
      const subcontractorId = contractorData.id;
      const contractorPassword = contractorData.contractor_password; // Capture password from contractor creation

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

      const psData = await psResponse.json();
      // Attach the password to the response so onSuccess can use it
      psData.contractor_password = contractorPassword;
      psData.contractor_username = contractorData.email || subcontractorId;
      
      return psData;
    },
    onSuccess: async (created: any): Promise<void> => {
      queryClient.invalidateQueries(["gc-project-subs", projectId]);
      
      const { protocol, host, origin } = window.location;
      const m = host.match(/^(.+)-(\d+)(\.app\.github\.dev)$/);
      
      // Get backend base URL
      const backendBaseUrl = m ? `${protocol}//${m[1]}-3001${m[3]}` : 
                            origin.includes(':5175') ? origin.replace(':5175', ':3001') :
                            origin.includes(':5176') ? origin.replace(':5176', ':3001') :
                            import.meta?.env?.VITE_API_BASE_URL || '';
      
      // First, try to create a COI request for this subcontractor on this project
      // This will happen even if we don't know the broker yet
      try {
        const coiResponse = await fetch(`${backendBaseUrl}/public/create-coi-request`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            project_id: project.id,
            project_name: project.project_name,
            gc_id: project.gc_id,
            gc_name: project.gc_name,
            subcontractor_id: created.subcontractor_id || created.id,
            subcontractor_name: form.subcontractor_name,
            trade_type: form.trade,
            project_sub_id: created.id
          })
        });
        
        if (coiResponse.ok) {
          const coiData = await coiResponse.json();
          logger.info('COI Request created', { context: 'GCProjectView', coiId: coiData.id, coiToken: coiData.coi_token });
        } else {
          const err = await coiResponse.json().catch(() => ({}));
          logger.warn('COI creation response', { context: 'GCProjectView', status: coiResponse.status, error: err });
        }
      } catch (err) {
        logger.error('COI creation error', { context: 'GCProjectView', error: err.message });
      }
      
      // ONLY send notification email if this is a NEW subcontractor (has password)
      // If contractor already existed, no welcome email is sent
      const isNewContractor = !!created.contractor_password;
      
      if (isNewContractor) {
        // Send notification email to subcontractor ONLY for new contractors
        try {
        // Construct portal login URL for subcontractor
        let portalUrl;
        if (m) {
          // GitHub Codespaces format
          portalUrl = `${protocol}//${m[1]}-5175${m[3]}/subcontractor-login`;
        } else if (origin.includes(':5175')) {
          portalUrl = origin.replace(':5175', '') + '/subcontractor-login';
        } else if (origin.includes(':5176')) {
          portalUrl = origin.replace(':5176', '') + '/subcontractor-login';
        } else {
          portalUrl = origin + '/subcontractor-login';
        }
        
        const contactEmail = form.contact_email.trim();
        
        // Create formatted HTML email with standardized styling
        const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { 
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
      line-height: 1.6; 
      color: #333; 
      background-color: #f3f4f6;
    }
    .container { 
      max-width: 600px; 
      margin: 0 auto; 
      padding: 0; 
      background-color: #fafafa;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 2px 8px rgba(0,0,0,0.15);
    }
    .header { 
      background: linear-gradient(135deg, #dc2626 0%, #991b1b 100%);
      color: white; 
      padding: 40px 20px; 
      text-align: center;
    }
    .header h1 {
      margin: 0 0 10px 0;
      font-size: 28px;
      font-weight: 700;
    }
    .header p {
      margin: 0;
      font-size: 16px;
      opacity: 0.95;
      font-weight: 500;
    }
    .content { 
      padding: 35px 25px; 
      background-color: #fafafa;
    }
    .intro-text {
      font-size: 16px;
      color: #111;
      margin: 20px 0;
      font-weight: 500;
    }
    .section { 
      margin: 25px 0; 
      padding: 20px; 
      background: linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%);
      border-left: 5px solid #dc2626;
      border-radius: 8px;
      border: 1px solid #fecaca;
    }
    .section-title { 
      font-weight: 700; 
      font-size: 16px; 
      margin: 0 0 15px 0;
      color: #991b1b; 
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .field { 
      margin: 12px 0; 
      font-size: 15px;
      padding: 8px 0;
      border-bottom: 1px solid rgba(220, 38, 38, 0.1);
    }
    .field:last-child {
      border-bottom: none;
    }
    .label { 
      font-weight: 700; 
      color: #991b1b; 
      display: inline-block;
      min-width: 140px;
    }
    .credentials { 
      background: linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%);
      padding: 25px; 
      border-radius: 8px; 
      border: 2px solid #dc2626;
      margin: 20px 0;
      box-shadow: 0 2px 6px rgba(220, 38, 38, 0.1);
    }
    .cred-label {
      font-weight: 700;
      color: #991b1b;
      display: inline-block;
      min-width: 140px;
      margin: 10px 0;
    }
    .cred-value {
      font-family: 'Courier New', monospace;
      background-color: white;
      padding: 8px 12px;
      border-radius: 4px;
      border: 1px solid #dc2626;
      font-weight: 600;
      color: #1f2937;
      word-break: break-all;
    }
    .button { 
      background: linear-gradient(135deg, #dc2626 0%, #991b1b 100%);
      color: white; 
      padding: 15px 35px; 
      text-decoration: none; 
      border-radius: 8px; 
      display: inline-block; 
      margin-top: 20px;
      font-weight: 700;
      border: none;
      cursor: pointer;
      font-size: 16px;
      box-shadow: 0 2px 8px rgba(220, 38, 38, 0.3);
    }
    .footer { 
      font-size: 13px; 
      color: #666; 
      margin-top: 30px; 
      padding: 25px;
      border-top: 2px solid #e5e7eb;
      text-align: center;
      background-color: #f9fafb;
    }
    .footer strong {
      color: #dc2626;
      font-weight: 700;
    }
    ol, ul {
      margin: 15px 0;
      padding-left: 25px;
    }
    li {
      margin: 10px 0;
      font-weight: 500;
      color: #1f2937;
    }
    .warning-text {
      color: #991b1b;
      font-weight: 700;
      background-color: #fff7ed;
      padding: 12px;
      border-radius: 6px;
      margin-top: 10px;
      border-left: 4px solid #dc2626;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>👋 Welcome to InsureTrack</h1>
      <p>You've been added to ${project?.project_name}</p>
    </div>
    
    <div class="content">
      <p>Dear ${form.subcontractor_name},</p>
      
      <p>You have been added to a new project in InsureTrack!</p>

      <div class="section">
        <div class="section-title">📋 PROJECT DETAILS</div>
        <div class="field"><span class="label">Project:</span> ${project?.project_name}</div>
        <div class="field"><span class="label">Trade:</span> ${form.trade}</div>
        <div class="field"><span class="label">Location:</span> ${project?.address || 'Address not provided'}</div>
      </div>

      <div class="section">
        <div class="section-title">🔐 PORTAL LOGIN INFORMATION</div>
        <div class="credentials">
          <div style="margin: 15px 0;">
            <div class="cred-label">Username:</div>
            <div class="cred-value">${created.contractor_username}</div>
          </div>
          <div style="margin: 15px 0;">
            <div class="cred-label">Password:</div>
            <div class="cred-value">${created.contractor_password}</div>
          </div>
          <div class="warning-text">
            ⚠️ Save your password - You'll need it to log in
          </div>
          <div style="text-align: center;">
            <a href="${portalUrl}" class="button">Login to Portal →</a>
          </div>
        </div>
      </div>

      <div class="section">
        <div class="section-title">� UPLOAD YOUR CERTIFICATE OF INSURANCE</div>
        <p style="margin: 10px 0; font-size: 14px; color: #374151;">
          We've attached a sample Certificate of Insurance (COI) for your reference. Please use your broker to prepare your actual insurance certificate.
        </p>
        <div style="text-align: center;">
          <a href="${portalUrl.replace('/subcontractor-login', '/UploadDocuments')}?sub=${encodeURIComponent(form.subcontractor_name)}" class="button">Upload COI Now →</a>
        </div>
      </div>

      <div class="section">
        <div class="section-title">📝 GETTING STARTED</div>
        <ol>
          <li>Click "Upload COI Now" above or log in to the portal</li>
          <li>Log in with your credentials</li>
          <li>Update your broker information in settings</li>
          <li>Submit your Certificate of Insurance (COI)</li>
          <li>Once approved, you're ready to start work!</li>
        </ol>
      </div>

      <p style="color: #666; font-size: 13px; margin-top: 20px;">
        <strong>Questions?</strong> Contact your General Contractor or the InsureTrack support team.
      </p>
    </div>
    
    <div class="footer">
      <p><strong>InsureTrack</strong> - Insurance Compliance Management</p>
      <p>This is an automated message. Please do not reply to this email.</p>
    </div>
  </div>
</body>
</html>
`;

        // Get backend base URL
        const backendBaseUrl = m ? `${protocol}//${m[1]}-3001${m[3]}` : 
                              origin.includes(':5175') ? origin.replace(':5175', ':3001') :
                              origin.includes(':5176') ? origin.replace(':5176', ':3001') :
                              import.meta?.env?.VITE_API_BASE_URL || '';
        
        logger.info('Sending email', { context: 'GCProjectView', contactEmail, portalUrl });
        
        const emailResponse = await fetch(`${backendBaseUrl}/public/send-email`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: contactEmail,
            subject: `Welcome to InsureTrack - ${project?.project_name}`,
            html: emailHtml,
            includeSampleCOI: false
          })
        });
        
        if (!emailResponse.ok) {
          const errorData = await emailResponse.json().catch(() => ({}));
          logger.error('Email send failed', { context: 'GCProjectView', status: emailResponse.status, error: errorData });
        } else {
          const result = await emailResponse.json().catch(() => ({}));
          logger.info('Email sent successfully', { context: 'GCProjectView', result });
        }
      } catch (err) {
        logger.error('Email notification error', { context: 'GCProjectView', error: err.message });
      }
      } else {
        logger.info('Subcontractor already exists in system - no welcome email sent', { context: 'GCProjectView' });
        
        // HOWEVER: If this subcontractor already has a broker from a previous project,
        // we should notify that broker about the NEW COI request for this project
        try {
          // We need to fetch the COI we just created to get broker info
          const allCOIsResponse = await fetch(`${backendBaseUrl}/public/all-cois`);
          if (allCOIsResponse.ok) {
            const allCOIs = await allCOIsResponse.json();
            // Find any COI for this subcontractor with broker info
            const existingCOI = allCOIs.find(c => 
              c.subcontractor_id === (created.subcontractor_id || created.id) && 
              c.broker_email
            );
            
            if (existingCOI?.broker_email) {
              logger.info('Found existing broker', { context: 'GCProjectView', brokerEmail: existingCOI.broker_email, subcontractor: form.subcontractor_name });
              
              // Find the COI we just created for this new project
              const newCOI = allCOIs.find(c => 
                c.subcontractor_id === (created.subcontractor_id || created.id) && 
                c.project_id === project.id
              );
              
              if (newCOI) {
                // Send COI sign/generate request email to the broker (reuse path)
                const signLink = m ? 
                  `${protocol}//${m[1]}-5175${m[3]}/broker-upload-coi?token=${newCOI.coi_token}&step=3&action=sign` :
                  `${origin}/broker-upload-coi?token=${newCOI.coi_token}&step=3&action=sign`;
                
                const brokerEmailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 0; background: white; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
    .header { background: linear-gradient(135deg, #dc2626 0%, #991b1b 100%); color: white; padding: 30px 20px; text-align: center; }
    .content { padding: 30px; }
    .section { margin: 20px 0; padding: 15px; background: #fef2f2; border-left: 4px solid #dc2626; }
    .button { display: inline-block; background: #dc2626; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600; }
    .footer { padding: 20px; text-align: center; font-size: 12px; color: #999; border-top: 1px solid #eee; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Certificate of Insurance Request</h1>
      <p>New Insurance Certificate Needed</p>
    </div>
    
    <div class="content">
      <p>Hello ${existingCOI.broker_name || 'Broker'},</p>
      
      <p>We have a new project for <strong>${form.subcontractor_name}</strong> and need a Certificate of Insurance (COI).</p>
      
      <div class="section">
        <strong>Project:</strong> ${project.project_name}<br>
        <strong>Subcontractor:</strong> ${form.subcontractor_name}<br>
        <strong>Trade:</strong> ${form.trade}
      </div>
      
      <p>Please review and sign the generated Certificate of Insurance using the button below:</p>
      
      <div style="text-align: center; margin: 30px 0;">
        <a href="${signLink}" class="button">Review & Sign COI →</a>
      </div>
      
      <p style="color: #666; font-size: 14px;">
        We've attached a sample Certificate of Insurance for your reference.
      </p>
    </div>
    
    <div class="footer">
      <p><strong>InsureTrack</strong> - Insurance Compliance Management</p>
      <p>This is an automated message. Please do not reply to this email.</p>
    </div>
  </div>
</body>
</html>
`;
                
                const brokerEmailResponse = await fetch(`${backendBaseUrl}/public/send-email`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    to: existingCOI.broker_email,
                    subject: `Certificate of Insurance Request for ${form.subcontractor_name} - ${project.project_name}`,
                    html: brokerEmailHtml,
                    includeSampleCOI: true,
                    // Provide complete data so sample COI reflects program requirements and project details
                    sampleCOIData: {
                      program: project?.program_name || project?.program_id,
                      program_id: project?.program_id,
                      trade: form.trade,
                      gc_name: project?.gc_name,
                      certificate_holder: project?.gc_name,
                      project_name: project?.project_name,
                      projectAddress: project?.address ? `${project.address}, ${project.city}, ${project.state} ${project.zip_code || ''}` : undefined,
                      description_of_operations: project?.description_of_operations || '',
                      requires_umbrella: project?.requires_umbrella || false,
                      owner_entity: project?.owner_entity || null,
                      additional_insureds: [
                        project?.owner_entity,
                        ...(Array.isArray(project?.additional_insured_entities)
                          ? project.additional_insured_entities.map(e => e?.name || e)
                          : [])
                      ].filter(Boolean),
                      additional_insured_entities: Array.isArray(project?.additional_insured_entities) ? project.additional_insured_entities.map(e => e?.name || e).filter(Boolean) : [],
                      // Include any insurer names if present from source insurance data
                      insurance_carrier_gl: existingCOI?.insurance_carrier_gl,
                      insurance_carrier_auto: existingCOI?.insurance_carrier_auto,
                      insurance_carrier_umbrella: existingCOI?.insurance_carrier_umbrella,
                      insurance_carrier_wc: existingCOI?.insurance_carrier_wc
                    }
                  })
                });
                
                if (brokerEmailResponse.ok) {
                  logger.info('Broker notification sent', { context: 'GCProjectView', brokerEmail: existingCOI.broker_email });
                } else {
                  logger.warn('Broker notification failed', { context: 'GCProjectView', status: brokerEmailResponse.status });
                }
              }
            }
          }
        } catch (err) {
          logger.error('Error checking for existing broker', { context: 'GCProjectView', error: err.message });
        }
      }
      
      setForm({ subcontractor_name: "", trade: "", contact_email: "" });
      toast.success('Subcontractor added successfully!');
    },
    onError: (err: Error) => {
      setSubError((err as any)?.message || "Failed to add subcontractor");
    },
  });

  // Mutation for GC to sign hold harmless agreement
  const signHoldHarmlessMutation = useMutation({
    mutationFn: async (coiId: string): Promise<{ id: string; signed: boolean }> => {
      // For public GC portal, we skip actual signing for now
      // In a full implementation, this would call a public endpoint
      return { id: coiId, signed: true };
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['gc-project-cois', projectId]);
      toast.success('Hold Harmless Agreement signed successfully!');
    },
    onError: (err) => {
      logger.error('Failed to sign hold harmless', { context: 'GCProjectView', error: err.message });
      alert('Failed to sign agreement. Please try again.');
    }
  });

  // Archive subcontractor from GC portal
  const archiveSubMutation = useMutation({
    mutationFn: async ({ id }) => {
      // For public GC portal, we skip actual archiving for now
      // In a full implementation, this would call a public endpoint
      return { id, archived: true };
    },
    onSuccess: () => {
      queryClient.invalidateQueries(["gc-project-subs", projectId]);
      toast.success('Subcontractor archived');
    },
    onError: (err) => {
      logger.error('Archive subcontractor failed', { context: 'GCProjectView', error: err.message });
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

  const handleNameInput = (value: string): void => {
    setForm((prev: SubForm) => ({ ...prev, subcontractor_name: value }));
    if (!value || value.length < 2) {
      setSuggestions([]);
      return;
    }
    const lower = value.toLowerCase();
    const matches = allSubcontractors
      .filter((s: Subcontractor) => s.company_name?.toLowerCase().includes(lower))
      .slice(0, 6);
    setSuggestions(matches);
  };

  const handleSuggestionSelect = (sub: Subcontractor): void => {
    const trade = Array.isArray(sub.trade_types) && sub.trade_types.length > 0 ? sub.trade_types[0] : sub.trade_type || "";
    setForm({
      subcontractor_name: sub.company_name || "",
      trade,
      contact_email: (sub as any).email || sub.contact_email || "",
    });
    setSuggestions([]);
  };

  const getLatestCoiForSub = (sub: ProjectSubcontractor): any | null => {
    const related = projectCois.filter((c: any) => c.subcontractor_id === sub.subcontractor_id || c.project_sub_id === sub.id);
    if (related.length === 0) return null;
    return related.sort((a: any, b: any) => new Date(b.created_date || b.updatedAt || 0).getTime() - new Date(a.created_date || a.updatedAt || 0).getTime())[0];
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
                        {(() => {
                          const latestCoi = getLatestCoiForSub(sub);
                          const coiLink = latestCoi?.pdf_url || latestCoi?.regenerated_coi_url || latestCoi?.first_coi_url;
                          const hhLink = latestCoi?.hold_harmless_sub_signed_url || latestCoi?.hold_harmless_template_url;
                          const hhStatus = latestCoi?.hold_harmless_status || '';
                          const hhBadge = hhStatus === 'signed_by_gc'
                            ? { label: 'GC Signed', className: 'bg-emerald-50 text-emerald-700' }
                            : hhStatus === 'signed_by_sub'
                              ? { label: 'Sub Signed', className: 'bg-amber-50 text-amber-700' }
                              : hhLink
                                ? { label: 'Template Ready', className: 'bg-slate-100 text-slate-700' }
                                : null;
                          return (
                            <div className="inline-flex items-center gap-2">
                              {coiLink && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => window.open(coiLink, '_blank')}
                                >
                                  View COI
                                </Button>
                              )}
                              {hhLink && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => window.open(hhLink, '_blank')}
                                >
                                  Hold Harmless
                                </Button>
                              )}
                              {hhBadge && (
                                <Badge variant="outline" className={hhBadge.className}>
                                  {hhBadge.label}
                                </Badge>
                              )}
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
                            </div>
                          );
                        })()}
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
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleNameInput(e.target.value)}
                  placeholder="Subcontractor LLC"
                  required
                  autoComplete="off"
                />
                {suggestions.length > 0 && (
                  <div className="absolute z-10 mt-1 w-full bg-white border border-slate-200 rounded shadow-sm max-h-48 overflow-auto">
                    {suggestions.map((s: Subcontractor) => (
                      <button
                        type="button"
                        key={s.id}
                        className="w-full text-left px-3 py-2 hover:bg-slate-50 text-sm"
                        onClick={() => handleSuggestionSelect(s)}
                      >
                        <div className="font-medium">{s.company_name}</div>
                        <div className="text-xs text-slate-500">{s.trade_types?.join(', ') || s.trade_type || 'Trade not set'}</div>
                        {((s as any).email || s.contact_email) && (
                          <div className="text-xs text-slate-500">{(s as any).email || s.contact_email}</div>
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
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, trade: e.target.value })}
                  placeholder="e.g., Electrical"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Contact email</Label>
                <Input
                  type="email"
                  value={form.contact_email}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, contact_email: e.target.value })}
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
