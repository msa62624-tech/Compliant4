
import { useState } from "react";
import { compliant } from "@/api/compliantClient";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertTriangle, CheckCircle2, XCircle, Shield, Clock } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function ComplianceReview() {
  const [selectedCheck, setSelectedCheck] = useState(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [consultantNotes, setConsultantNotes] = useState('');
  const queryClient = useQueryClient();

  const { data: complianceChecks = [], isLoading } = useQuery({
    queryKey: ['compliance-checks'],
    queryFn: () => compliant.entities.ComplianceCheck.filter({ check_status: 'pending' }, '-created_date'),
  });

  const { data: uploadRequests = [] } = useQuery({
    queryKey: ['upload-requests'],
    queryFn: () => compliant.entities.BrokerUploadRequest.list(),
  });

  const { data: policyDocs = [] } = useQuery({
    queryKey: ['policy-docs'],
    queryFn: () => compliant.entities.PolicyDocument.list(),
  });

  const { data: projects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: () => compliant.entities.Project.list(),
  });

  const updateCheckMutation = useMutation({
    mutationFn: ({ id, data }) => compliant.entities.ComplianceCheck.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['compliance-checks']);
      closeDialog();
    },
  });

  const openReviewDialog = async (check) => {
    setSelectedCheck(check);
    setConsultantNotes(check.consultant_notes || '');
    
    // Auto-run compliance analysis
    await analyzeCompliance(check);
    setIsDialogOpen(true);
  };

  const closeDialog = () => {
    setIsDialogOpen(false);
    setSelectedCheck(null);
    setConsultantNotes('');
  };

  const analyzeCompliance = async (check) => {
    const _request = uploadRequests.find(r => r.id === check.upload_request_id);
    const project = projects.find(p => p.id === check.project_id);
    const policies = policyDocs.filter(p => p.upload_request_id === check.upload_request_id);

    const deficiencies = [];

    // Define trade categories for automatic validation
    const exteriorTrades = ['roofing', 'siding', 'window', 'door', 'exterior', 'facade', 'masonry', 'stucco', 'cladding'];
    const groundStructuralTrades = ['excavation', 'foundation', 'earthwork', 'grading', 'site work', 'structural', 'piling', 'shoring'];
    
    const tradeType = check.trade_type?.toLowerCase() || '';
    const isExteriorTrade = exteriorTrades.some(t => tradeType.includes(t));
    const isGroundStructuralTrade = groundStructuralTrades.some(t => tradeType.includes(t));

    // Check each policy for issues
    policies.forEach(policy => {
      const insType = policy.insurance_type;

      // OCCURRENCE BASIS CHECK - Critical for GL and Umbrella
      if ((insType === 'general_liability' || insType === 'umbrella_policy') && policy.policy_basis === 'claims_made') {
        deficiencies.push({
          category: 'wrong_policy_basis',
          insurance_type: policy.insurance_type,
          severity: 'critical',
          description: `${insType.replace(/_/g, ' ').toUpperCase()} must be written on an OCCURRENCE basis, not Claims-Made`,
          required_value: 'Occurrence Basis',
          actual_value: 'Claims-Made Basis'
        });
      }

      // STANDARD REQUIREMENTS - Always Required for all types
      if (!policy.additional_insured) {
        deficiencies.push({
          category: 'missing_endorsement',
          insurance_type: policy.insurance_type,
          severity: 'critical',
          description: 'Policy missing Blanket Additional Insured for ongoing operations & completed operations',
          required_value: 'Blanket Additional Insured included',
          actual_value: 'Additional Insured clause missing or not blanket'
        });
      }

      // Waiver of Subrogation - Required for GL, Umbrella, WC (NOT Auto, Professional, or Pollution)
      if (insType !== 'auto_liability' && insType !== 'professional_liability' && insType !== 'pollution_liability' && !policy.waiver_of_subrogation) {
        deficiencies.push({
          category: 'missing_endorsement',
          insurance_type: policy.insurance_type,
          severity: 'critical',
          description: `Policy missing Waiver of Subrogation (required for ${insType.replace(/_/g, ' ')})`,
          required_value: 'Waiver of Subrogation included',
          actual_value: 'Waiver of Subrogation missing'
        });
      }

      // Primary & Non-Contributory - Required for GL and Umbrella ONLY (NOT WC or Auto)
      if ((insType === 'general_liability' || insType === 'umbrella_policy') && !policy.primary_non_contributory) {
        deficiencies.push({
          category: 'missing_endorsement',
          insurance_type: policy.insurance_type,
          severity: 'critical',
          description: `Policy missing Primary and Non-Contributory clause (required for ${insType.replace(/_/g, ' ')})`,
          required_value: 'Primary & Non-Contributory included',
          actual_value: 'Primary & Non-Contributory missing'
        });
      }

      // Per Project Aggregate - Required for GL and Umbrella
      if (!policy.per_project_aggregate && (insType === 'general_liability' || insType === 'umbrella_policy')) {
        deficiencies.push({
          category: 'missing_endorsement',
          insurance_type: policy.insurance_type,
          severity: 'critical',
          description: 'Policy missing Per Project Aggregate',
          required_value: 'Per Project Aggregate (not shared)',
          actual_value: 'No per project aggregate'
        });
      }

      // HEIGHT LIMITATION CHECK - Critical for exterior trades
      if (isExteriorTrade && policy.has_height_limitation) {
        if (project?.height_stories && policy.height_limitation_stories < project.height_stories) {
          deficiencies.push({
            category: 'height_limitation',
            insurance_type: policy.insurance_type,
            severity: 'critical',
            description: `EXTERIOR TRADE: Policy has ${policy.height_limitation_stories}-story limit but project is ${project.height_stories} stories. Exterior trades cannot have height limitations below project height.`,
            required_value: `${project.height_stories} stories or no limitation`,
            actual_value: `${policy.height_limitation_stories} stories`
          });
        } else {
          deficiencies.push({
            category: 'height_limitation',
            insurance_type: policy.insurance_type,
            severity: 'major',
            description: `EXTERIOR TRADE: Policy has height limitation which may restrict coverage. Trade type ${check.trade_type} typically works on exterior and should not have height restrictions.`,
            required_value: 'No height limitation for exterior trades',
            actual_value: `${policy.height_limitation_stories} stories limit`
          });
        }
      } else if (project?.height_stories && policy.has_height_limitation && 
                 policy.height_limitation_stories < project.height_stories) {
        deficiencies.push({
          category: 'height_limitation',
          insurance_type: policy.insurance_type,
          severity: 'major',
          description: `Policy has ${policy.height_limitation_stories}-story limit but project is ${project.height_stories} stories`,
          required_value: `${project.height_stories} stories or more`,
          actual_value: `${policy.height_limitation_stories} stories`
        });
      }

      // UNIT LIMITATION CHECK
      if (project?.unit_count && policy.has_unit_limitation) {
        if (policy.unit_limitation < project.unit_count) {
          deficiencies.push({
            category: 'other',
            insurance_type: policy.insurance_type,
            severity: 'critical',
            description: `Policy unit limitation (${policy.unit_limitation} units) is less than project unit count (${project.unit_count} units)`,
            required_value: `${project.unit_count} units or more`,
            actual_value: `${policy.unit_limitation} units maximum`
          });
        }
      }

      // SUBSIDENCE EXCLUSION CHECK - Critical for ground/structural trades
      if (isGroundStructuralTrade && policy.has_subsidence_exclusion) {
        deficiencies.push({
          category: 'subsidence_exclusion',
          insurance_type: policy.insurance_type,
          severity: 'critical',
          description: `GROUND/STRUCTURAL TRADE: Policy excludes subsidence but trade is ${check.trade_type} which requires this coverage. This exclusion is unacceptable for foundation, excavation, and structural work.`,
          required_value: 'Subsidence coverage included (no exclusion)',
          actual_value: 'Subsidence exclusion present'
        });
      }

      // CONDO EXCLUSION CHECK - Never allowed for condo projects
      if (project?.project_type === 'condos' && policy.has_condo_exclusion) {
        deficiencies.push({
          category: 'condo_exclusion',
          insurance_type: policy.insurance_type,
          severity: 'critical',
          description: 'CONDO PROJECT: Policy excludes condo projects but this is a condo project. This exclusion makes the policy invalid for this project.',
          required_value: 'Condo coverage included (no exclusion)',
          actual_value: 'Condo exclusion present'
        });
      }

      // Hammer clause check
      if (policy.has_hammer_clause) {
        deficiencies.push({
          category: 'hammer_clause',
          insurance_type: policy.insurance_type,
          severity: 'major',
          description: 'Policy contains a hammer clause which limits coverage if settlement is rejected',
          required_value: 'No hammer clause',
          actual_value: 'Hammer clause present'
        });
      }

      // Action over exclusion check
      if (policy.has_action_over_exclusion) {
        deficiencies.push({
          category: 'action_over_exclusion',
          insurance_type: policy.insurance_type,
          severity: 'major',
          description: 'Policy has action over exclusion limiting certain legal actions',
          required_value: 'No action over exclusion',
          actual_value: 'Action over exclusion present'
        });
      }

      // Exterior work exclusion check for exterior trades
      if (isExteriorTrade && policy.has_exterior_work_exclusion) {
        deficiencies.push({
          category: 'exterior_work_exclusion',
          insurance_type: policy.insurance_type,
          severity: 'critical',
          description: `EXTERIOR TRADE: Policy excludes exterior work but trade is ${check.trade_type}. This makes the policy invalid for this trade.`,
          required_value: 'Exterior work coverage included',
          actual_value: 'Exterior work exclusion present'
        });
      }

      // Classification limitations
      if (policy.has_classification_limitations) {
        deficiencies.push({
          category: 'classification_limitation',
          insurance_type: policy.insurance_type,
          severity: 'major',
          description: `Policy has work classification limitations: ${policy.classification_limitations_text}`,
          required_value: 'No classification limitations',
          actual_value: policy.classification_limitations_text
        });
      }

      // Trade-specific exclusions
      if (policy.trade_specific_exclusions && policy.trade_specific_exclusions.length > 0) {
        policy.trade_specific_exclusions.forEach(exclusion => {
          deficiencies.push({
            category: 'trade_specific_exclusion',
            insurance_type: policy.insurance_type,
            severity: 'major',
            description: `Trade-specific exclusion: ${exclusion}`,
            required_value: 'No trade exclusions',
            actual_value: exclusion
          });
        });
      }
    });

    // Update the compliance check with findings
    const checkPassed = deficiencies.length === 0;
    await updateCheckMutation.mutateAsync({
      id: check.id,
      data: {
        deficiencies,
        check_status: checkPassed ? 'passed' : 'failed',
        exclusions_check_passed: !deficiencies.some(d => 
          ['hammer_clause', 'action_over_exclusion', 'classification_limitation', 
           'condo_exclusion', 'subsidence_exclusion', 'exterior_work_exclusion', 
           'trade_specific_exclusion', 'height_limitation', 'wrong_policy_basis'].includes(d.category)
        ),
        additional_insured_check_passed: !deficiencies.some(d => 
          d.category === 'missing_endorsement' && d.description.includes('Additional Insured')
        ),
        project_height_stories: project?.height_stories,
        project_type: project?.project_type,
      }
    });
  };

  const handleApprove = async () => {
    const user = await compliant.auth.me();
    await updateCheckMutation.mutateAsync({
      id: selectedCheck.id,
      data: {
        check_status: 'passed',
        reviewed_by: user.email,
        review_date: new Date().toISOString(),
        consultant_notes: consultantNotes,
      }
    });

    // Update upload request status
    const request = uploadRequests.find(r => r.id === selectedCheck.upload_request_id);
    if (request) {
      await compliant.entities.BrokerUploadRequest.update(request.id, {
        status: 'approved',
        reviewed_date: new Date().toISOString(),
      });
    }
  };

  const handleReject = async () => {
    const user = await compliant.auth.me();
    await updateCheckMutation.mutateAsync({
      id: selectedCheck.id,
      data: {
        check_status: 'failed',
        reviewed_by: user.email,
        review_date: new Date().toISOString(),
        consultant_notes: consultantNotes,
      }
    });

    // Update upload request to needs correction
    const request = uploadRequests.find(r => r.id === selectedCheck.upload_request_id);
    if (request) {
      await compliant.entities.BrokerUploadRequest.update(request.id, {
        status: 'needs_correction',
        correction_notes: consultantNotes,
      });
    }
  };

  const getSeverityColor = (severity) => {
    switch (severity) {
      case 'critical': return 'bg-red-100 text-red-800 border-red-300';
      case 'major': return 'bg-orange-100 text-orange-800 border-orange-300';
      case 'minor': return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      default: return 'bg-slate-100 text-slate-800 border-slate-300';
    }
  };

  const getCategoryLabel = (category) => {
    const labels = {
      height_limitation: 'Height Limitation',
      hammer_clause: 'Hammer Clause',
      action_over_exclusion: 'Action Over Exclusion',
      classification_limitation: 'Classification Limitation',
      condo_exclusion: 'Condo Exclusion',
      subsidence_exclusion: 'Subsidence Exclusion',
      exterior_work_exclusion: 'Exterior Work Exclusion',
      trade_specific_exclusion: 'Trade-Specific Exclusion',
      missing_endorsement: 'Missing Endorsement',
      wrong_policy_basis: 'Wrong Policy Basis (Claims-Made)',
      other: 'Other Limitation/Exclusion'
    };
    return labels[category] || category.replace(/_/g, ' ');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 mb-2">
            Compliance Review
          </h1>
          <p className="text-slate-600">Review pending insurance document submissions</p>
        </div>

        <Card className="border-slate-200 shadow-lg">
          <CardHeader className="border-b border-slate-200">
            <CardTitle className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <Shield className="w-5 h-5" />
              Pending Reviews ({complianceChecks.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-6 space-y-4">
                {Array(3).fill(0).map((_, i) => (
                  <Skeleton key={`deficiency-skeleton-${i}`} className="h-20 w-full" />
                ))}
              </div>
            ) : complianceChecks.length === 0 ? (
              <div className="p-12 text-center">
                <CheckCircle2 className="w-16 h-16 mx-auto text-emerald-500 mb-4" />
                <h3 className="text-xl font-semibold text-slate-900 mb-2">
                  All Caught Up!
                </h3>
                <p className="text-slate-600">No pending compliance reviews at this time</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50">
                    <TableHead className="font-semibold">Subcontractor</TableHead>
                    <TableHead className="font-semibold">Trade</TableHead>
                    <TableHead className="font-semibold">Project</TableHead>
                    <TableHead className="font-semibold">Submitted</TableHead>
                    <TableHead className="font-semibold w-32">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {complianceChecks.map((check) => {
                    const request = uploadRequests.find(r => r.id === check.upload_request_id);
                    const project = projects.find(p => p.id === check.project_id);
                    
                    return (
                      <TableRow key={check.id} className="hover:bg-slate-50">
                        <TableCell className="font-medium text-slate-900">
                          {check.subcontractor_name}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="bg-red-50 text-red-700">
                            {check.trade_type}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-slate-600">
                          {project?.project_name || 'N/A'}
                        </TableCell>
                        <TableCell className="text-slate-600 text-sm">
                          {request?.uploaded_date ? format(new Date(request.uploaded_date), 'MMM d, yyyy') : 'N/A'}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
                            <Clock className="w-3 h-3 mr-1" />
                            Pending
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Button
                            size="sm"
                            onClick={() => openReviewDialog(check)}
                            className="bg-red-600 hover:bg-red-700"
                          >
                            Review
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={closeDialog}>
        <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">
              Compliance Review: {selectedCheck?.subcontractor_name}
            </DialogTitle>
          </DialogHeader>
          
          {selectedCheck && (
            <div className="space-y-6 py-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-slate-500 mb-1">Trade Type</p>
                  <p className="font-medium text-slate-900">{selectedCheck.trade_type}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500 mb-1">Project Type</p>
                  <p className="font-medium text-slate-900">
                    {selectedCheck.project_type ? selectedCheck.project_type.replace(/_/g, ' ') : 'N/A'}
                  </p>
                </div>
              </div>

              {selectedCheck.deficiencies && selectedCheck.deficiencies.length > 0 ? (
                <div>
                  <Alert variant="destructive" className="mb-4">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>
                      <strong>{selectedCheck.deficiencies.length} issue(s) found</strong> that require attention
                    </AlertDescription>
                  </Alert>

                  <div className="space-y-3">
                    {selectedCheck.deficiencies.map((deficiency, index) => (
                      <Card key={deficiency.id || `deficiency-${selectedCheck.id}-${index}`} className="border-l-4 border-l-red-500">
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className={getSeverityColor(deficiency.severity)}>
                                {deficiency.severity}
                              </Badge>
                              <span className="font-semibold text-slate-900">
                                {getCategoryLabel(deficiency.category)}
                              </span>
                            </div>
                            <Badge variant="outline" className="text-xs">
                              {deficiency.insurance_type?.replace(/_/g, ' ')}
                            </Badge>
                          </div>
                          <p className="text-slate-700 mb-2">{deficiency.description}</p>
                          <div className="grid grid-cols-2 gap-2 text-sm">
                            <div>
                              <span className="text-slate-500">Required:</span>
                              <p className="text-slate-900">{deficiency.required_value}</p>
                            </div>
                            <div>
                              <span className="text-slate-500">Actual:</span>
                              <p className="text-slate-900">{deficiency.actual_value}</p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              ) : (
                <Alert className="bg-emerald-50 border-emerald-200">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  <AlertDescription className="text-emerald-900">
                    <strong>No issues found!</strong> All requirements appear to be met.
                  </AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                <Label htmlFor="consultant_notes">Consultant Notes</Label>
                <Textarea
                  id="consultant_notes"
                  value={consultantNotes}
                  onChange={(e) => setConsultantNotes(e.target.value)}
                  placeholder="Add your review notes..."
                  className="min-h-32"
                />
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={handleReject}
              className="border-red-200 text-red-700 hover:bg-red-50"
              disabled={updateCheckMutation.isPending}
            >
              <XCircle className="w-4 h-4 mr-2" />
              Reject & Request Corrections
            </Button>
            <Button
              onClick={handleApprove}
              className="bg-emerald-600 hover:bg-emerald-700"
              disabled={updateCheckMutation.isPending}
            >
              <CheckCircle2 className="w-4 h-4 mr-2" />
              Approve
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
