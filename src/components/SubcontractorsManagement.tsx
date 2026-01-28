import { useState } from "react";
import { compliant } from "@/api/compliantClient";
import { sendEmail } from "@/emailHelper";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { notifyBrokerAssignment } from "@/brokerNotifications";
import { Users, Eye, Edit, Mail, Upload } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import type * as ApiTypes from '@/api-types';

interface Contractor {
  id: string;
  company_name?: string;
  trade_types?: string[];
  trade_type?: string;
  email?: string;
  contractor_type?: string;
}

interface ProjectSubcontractor {
  id: string;
  project_id?: string;
  subcontractor_name?: string;
  status?: string;
}

interface GeneratedCOI {
  id: string;
  subcontractor_name?: string;
  broker_name?: string;
  broker_email?: string;
  broker_phone?: string;
  broker_company?: string;
  project_id?: string;
  project_name?: string;
  trade_type?: string;
  trade_types?: string[];
  coi_token?: string;
  sample_coi_pdf_url?: string;
  status?: string;
  broker_notified_date?: string;
  program_name?: string;
  program_id?: string;
  description_of_operations?: string;
  additional_insured_entities?: string[];
  additional_insureds?: string[];
}

interface Project {
  id: string;
  project_name?: string;
  project_address?: string;
  address?: string;
  city?: string;
  state?: string;
  zip_code?: string;
  owner_entity?: string;
  additional_insured_entities?: Array<{ name?: string } | string>;
  gc_name?: string;
  program_name?: string;
  program_id?: string;
  description_of_operations?: string;
}

interface BrokerForm {
  broker_name: string;
  broker_email: string;
  broker_phone: string;
  broker_company: string;
}

interface SelectedSubForBroker {
  sub: Contractor;
  coi: GeneratedCOI | null;
}

export default function SubcontractorsManagement(): JSX.Element {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [isBrokerDialogOpen, setIsBrokerDialogOpen] = useState<boolean>(false);
  const [selectedSubForBroker, setSelectedSubForBroker] = useState<SelectedSubForBroker | null>(null);
  const [brokerForm, setBrokerForm] = useState<BrokerForm>({
    broker_name: '',
    broker_email: '',
    broker_phone: '',
    broker_company: '',
  });

  const { data: allSubs = [], isLoading: _isLoading } = useQuery<Contractor[]>({
    queryKey: ['all-subs'],
    queryFn: () => compliant.entities.Contractor.filter({ contractor_type: 'subcontractor' }),
  });

  const { data: allProjectSubs = [] } = useQuery<ProjectSubcontractor[]>({
    queryKey: ['all-project-subs'],
    queryFn: () => compliant.entities.ProjectSubcontractor.list() as ApiTypes.ProjectSubcontractor[],
  });

  const { data: allCOIs = [] } = useQuery<GeneratedCOI[]>({
    queryKey: ['all-cois'],
    queryFn: () => compliant.entities.GeneratedCOI.list('-created_date'),
  });

  const { data: allProjects = [] } = useQuery<Project[]>({
    queryKey: ['all-projects'],
    queryFn: () => compliant.entities.Project.list() as ApiTypes.Project[],
  });

  const updateCOIMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<GeneratedCOI> }) => 
      compliant.entities.GeneratedCOI.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['all-cois']);
      setIsBrokerDialogOpen(false);
    },
  });

  const getSubProjects = (subName: string): ProjectSubcontractor[] => {
    return allProjectSubs.filter((ps: ProjectSubcontractor) => ps.subcontractor_name === subName);
  };

  const handleEditBroker = (sub: Contractor): void => {
    const subCOI = allCOIs.find((c: GeneratedCOI) => c.subcontractor_name === sub.company_name);
    setSelectedSubForBroker({ sub, coi: subCOI || null });
    setBrokerForm({
      broker_name: subCOI?.broker_name || '',
      broker_email: subCOI?.broker_email || '',
      broker_phone: subCOI?.broker_phone || '',
      broker_company: subCOI?.broker_company || '',
    });
    setIsBrokerDialogOpen(true);
  };

  const handleSaveBroker = async (): Promise<void> => {
    if (!selectedSubForBroker?.coi) {
      alert('This subcontractor needs to be added to a project first to create a COI record where broker information is stored.');
      return;
    }

    const oldBrokerEmail = selectedSubForBroker.coi.broker_email;
    const newBrokerEmail = brokerForm.broker_email;
    
    // Check if broker email changed
    const brokerEmailChanged = oldBrokerEmail !== newBrokerEmail;
    // Check if this is first time assigning broker (old broker email is empty)
    const isFirstTimeAssignment = !oldBrokerEmail && newBrokerEmail;

    await updateCOIMutation.mutateAsync({
      id: selectedSubForBroker.coi.id,
      data: brokerForm
    });

    // Send notifications if broker email changed or newly assigned
    if ((brokerEmailChanged || isFirstTimeAssignment) && selectedSubForBroker.sub) {
      try {
        const subData = {
          ...selectedSubForBroker.sub,
          broker_email: newBrokerEmail,
          broker_name: brokerForm.broker_name,
          broker_phone: brokerForm.broker_phone,
        };
        await notifyBrokerAssignment(subData, oldBrokerEmail || null, isFirstTimeAssignment);
      } catch (error) {
        console.error('Error sending broker change notifications:', error);
      }
    }
  };

  const handleSendBrokerRequest = async (sub: Contractor): Promise<void> => {
    const subCOI = allCOIs.find((c: GeneratedCOI) => c.subcontractor_name === sub.company_name);
    
    if (!subCOI) {
      alert('This subcontractor needs to be added to a project first. This creates a COI record with a sample certificate.');
      return;
    }

    if (!subCOI.broker_email) {
      alert('Please add broker information first using the "Broker" button.');
      return;
    }

    try {
      const baseUrl = window.location.origin.replace(/\/$/, '');
      const brokerUploadLink = `${baseUrl}${createPageUrl(`broker-upload-coi`)}?token=${subCOI.coi_token}&step=1`;
      const sampleLinkText = subCOI.sample_coi_pdf_url
        ? `\nVIEW SAMPLE CERTIFICATE: ${subCOI.sample_coi_pdf_url}\n`
        : '';

      const project = allProjects.find((p: Project) => p.id === subCOI.project_id) ||
        allProjects.find((p: Project) => p.project_name === subCOI.project_name);

      const projectAddress = project
        ? [project.address || project.project_address, project.city, project.state, project.zip_code]
          .filter(Boolean)
          .join(', ')
        : '';

      const projectInsureds: string[] = [];
      if (project?.owner_entity) projectInsureds.push(project.owner_entity);
      if (Array.isArray(project?.additional_insured_entities)) {
        project.additional_insured_entities.forEach((ai: { name?: string } | string) => {
          const value = typeof ai === 'string' ? ai : ai?.name;
          if (value) projectInsureds.push(value);
        });
      }

      await sendEmail({
        to: subCOI.broker_email,
        includeSampleCOI: true,
        recipientIsBroker: true,
        sampleCOIData: {
          project_name: project?.project_name || subCOI.project_name,
          gc_name: project?.gc_name || subCOI.gc_name,
          certificate_holder: project?.gc_name || subCOI.gc_name,
          projectAddress: projectAddress,
          trade: subCOI.trade_type || (Array.isArray(subCOI.trade_types) ? subCOI.trade_types.join(', ') : undefined),
          program: project?.program_name || subCOI.program_name || subCOI.program_id,
          program_id: project?.program_id,
          description_of_operations: project?.description_of_operations || subCOI.description_of_operations || '',
          additional_insureds: projectInsureds.length > 0 ? projectInsureds : (subCOI.additional_insured_entities || subCOI.additional_insureds),
          additional_insured_entities: projectInsureds.length > 0 ? projectInsureds : (subCOI.additional_insured_entities || subCOI.additional_insureds),
        },
        subject: `Insurance Certificate Request - ${sub.company_name}`,
        body: `Dear ${subCOI.broker_name || 'Insurance Professional'},

We need an insurance certificate for your client ${sub.company_name}.

WHAT WE NEED:
Please review the sample certificate and provide a matching ACORD 25 certificate.

      The sample certificate is attached for your reference.${sampleLinkText}

UPLOAD YOUR CERTIFICATE HERE: ${brokerUploadLink}

This is a streamlined process - once you upload the certificate matching our sample, it will be automatically processed.

Questions? Reply to this email.

Best regards,
InsureForce Team`
      });

      await updateCOIMutation.mutateAsync({
        id: subCOI.id,
        data: {
          status: 'awaiting_broker_upload',
          broker_notified_date: new Date().toISOString()
        }
      });

      alert('Broker request sent successfully!');
    } catch (error) {
      alert('Failed to send broker request. Please try again.');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold text-slate-900 mb-2">
            Subcontractors Management
          </h1>
          <p className="text-slate-600">Manage subcontractor information and broker relationships</p>
        </div>

        <Card className="border-slate-200 shadow-lg">
          <CardHeader className="border-b border-slate-200">
            <div className="flex items-center justify-between">
              <CardTitle className="text-xl font-bold text-slate-900 flex items-center gap-2">
                <Users className="w-5 h-5 text-red-600" />
                All Subcontractors ({allSubs.length})
              </CardTitle>
              <Button
                onClick={() => navigate(createPageUrl("SubcontractorsDirectory"))}
                className="bg-red-600 hover:bg-red-700"
              >
                View Directory
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {allSubs.length === 0 ? (
              <div className="p-12 text-center">
                <Users className="w-16 h-16 mx-auto text-slate-300 mb-4" />
                <h3 className="text-xl font-semibold text-slate-900 mb-2">
                  No Subcontractors Yet
                </h3>
                <p className="text-slate-600">
                  Subcontractors will appear here when added to projects
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50">
                      <TableHead className="font-semibold">Company Name</TableHead>
                      <TableHead className="font-semibold">Trades</TableHead>
                      <TableHead className="font-semibold">Contact</TableHead>
                      <TableHead className="font-semibold">Projects</TableHead>
                      <TableHead className="font-semibold">Broker</TableHead>
                      <TableHead className="font-semibold">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {allSubs.map((sub: Contractor) => {
                      const subProjects = getSubProjects(sub.company_name || '');
                      const subCOI = allCOIs.find((c: GeneratedCOI) => c.subcontractor_name === sub.company_name);
                      const trades = (sub.trade_types && sub.trade_types.length > 0)
                        ? sub.trade_types
                        : (sub.trade_type ? [sub.trade_type] : []);

                      return (
                        <TableRow key={sub.id} className="hover:bg-slate-50">
                          <TableCell 
                            className="font-medium text-slate-900 cursor-pointer hover:text-red-600 transition-colors"
                            onClick={() => navigate(createPageUrl(`SubcontractorView?name=${encodeURIComponent(sub.company_name)}`))}
                          >
                            {sub.company_name}
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              {trades.length > 0 ? trades.map((trade, idx) => (
                                <Badge key={idx} variant="outline" className="text-xs">
                                  {trade}
                                </Badge>
                              )) : <span className="text-xs text-slate-500">No trades</span>}
                            </div>
                          </TableCell>
                          <TableCell className="text-sm text-slate-600">
                            {sub.email || 'No email'}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="bg-purple-50 text-purple-700">
                                {subProjects.length}
                              </Badge>
                              {subProjects.length === 0 && (
                                <span className="text-xs text-amber-600">Add to project</span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-sm text-slate-600">
                            {subCOI?.broker_company || (
                              <span className="text-amber-600">Not set</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1 flex-wrap">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => navigate(createPageUrl(`SubcontractorView?name=${encodeURIComponent(sub.company_name)}`))}
                                className="text-slate-600 hover:text-slate-900 hover:bg-slate-100 font-semibold"
                              >
                                <Eye className="w-3 h-3 mr-1" />
                                View
                              </Button>
                              
                              {!subCOI?.broker_email ? (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleEditBroker(sub)}
                                  className="text-orange-700 border-orange-400 bg-orange-50 hover:bg-orange-100 font-bold"
                                >
                                  <Edit className="w-3 h-3 mr-1" />
                                  Add Broker
                                </Button>
                              ) : (
                                <>
                                  {subCOI?.sample_coi_pdf_url && (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => window.open(subCOI.sample_coi_pdf_url, '_blank')}
                                      className="text-green-600 border-green-300 hover:bg-green-50 font-semibold"
                                    >
                                      <Eye className="w-3 h-3 mr-1" />
                                      Sample
                                    </Button>
                                  )}
                                  
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleEditBroker(sub)}
                                    className="text-red-600 border-red-300 hover:bg-red-50 font-semibold"
                                  >
                                    <Edit className="w-3 h-3 mr-1" />
                                    Edit Broker
                                  </Button>
                                  
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleSendBrokerRequest(sub)}
                                    className="text-purple-600 border-purple-300 hover:bg-purple-50 font-semibold"
                                    disabled={!subCOI.sample_coi_pdf_url}
                                  >
                                    <Mail className="w-3 h-3 mr-1" />
                                    Request
                                  </Button>

                                  {subCOI && (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => navigate(createPageUrl(`UploadDocuments?sub=${encodeURIComponent(sub.company_name)}`))}
                                      className="text-emerald-600 border-emerald-300 hover:bg-emerald-50 font-bold"
                                    >
                                      <Upload className="w-3 h-3 mr-1" />
                                      Upload
                                    </Button>
                                  )}
                                </>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Broker Dialog */}
      <Dialog open={isBrokerDialogOpen} onOpenChange={setIsBrokerDialogOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-3xl font-black text-red-900">
              {selectedSubForBroker?.coi?.broker_company ? '✏️ Edit' : '➕ Add'} Broker Information
            </DialogTitle>
            <DialogDescription>
              Provide or update the broker details for this subcontractor.
            </DialogDescription>
            <p className="text-lg text-slate-600 mt-2">
              Enter insurance broker contact details for {selectedSubForBroker?.sub?.company_name}
            </p>
          </DialogHeader>
          <div className="space-y-6 py-6">
            <div className="space-y-3">
              <Label className="text-lg font-bold">
                Broker Company <span className="text-red-500 text-xl">*</span>
              </Label>
              <Input
                value={brokerForm.broker_company}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setBrokerForm({ ...brokerForm, broker_company: e.target.value })}
                placeholder="ABC Insurance Agency"
                required
                className="text-lg h-12 border-2"
              />
            </div>
            <div className="space-y-3">
              <Label className="text-lg font-bold">
                Broker Name <span className="text-red-500 text-xl">*</span>
              </Label>
              <Input
                value={brokerForm.broker_name}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setBrokerForm({ ...brokerForm, broker_name: e.target.value })}
                placeholder="John Smith"
                required
                className="text-lg h-12 border-2"
              />
            </div>
            <div className="space-y-3">
              <Label className="text-lg font-bold">
                Email <span className="text-red-500 text-xl">*</span>
              </Label>
              <Input
                type="email"
                value={brokerForm.broker_email}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setBrokerForm({ ...brokerForm, broker_email: e.target.value })}
                placeholder="john@insurance.com"
                required
                className="text-lg h-12 border-2"
              />
            </div>
            <div className="space-y-3">
              <Label className="text-lg font-bold">Phone</Label>
              <Input
                value={brokerForm.broker_phone}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setBrokerForm({ ...brokerForm, broker_phone: e.target.value })}
                placeholder="(555) 123-4567"
                className="text-lg h-12 border-2"
              />
            </div>
          </div>
          <DialogFooter className="gap-3">
            <Button 
              variant="outline" 
              onClick={() => setIsBrokerDialogOpen(false)}
              className="text-lg px-6 py-6"
            >
              Cancel
            </Button>
            <Button 
              onClick={handleSaveBroker} 
              className="bg-red-600 hover:bg-red-700 text-lg px-8 py-6"
              disabled={!brokerForm.broker_company || !brokerForm.broker_name || !brokerForm.broker_email || updateCOIMutation.isPending}
            >
              {updateCOIMutation.isPending ? 'Saving...' : '💾 Save Broker Info'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
