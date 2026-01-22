import { useState } from "react";
import { compliant } from "@/api/compliantClient";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, ArrowLeft, ClipboardList } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

export default function SubRequirements() {
  const navigate = useNavigate();
  const urlParams = new URLSearchParams(window.location.search);
  const policyId = urlParams.get('policy_id');

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingRequirement, setEditingRequirement] = useState(null);
  const [formData, setFormData] = useState({
    trade_type: '',
    insurance_type: '',
    minimum_coverage: '',
    is_required: true,
    additional_insured_required: false,
    waiver_of_subrogation_required: false,
    description: '',
  });
  const queryClient = useQueryClient();

  const { data: policy } = useQuery({
    queryKey: ['gc-policy', policyId],
    queryFn: async () => {
      const policies = await compliant.entities.GCInsurancePolicy.list();
      return policies.find(p => p.id === policyId);
    },
    enabled: !!policyId,
  });

  const { data: requirements = [], isLoading } = useQuery({
    queryKey: ['sub-requirements', policy?.gc_id],
    queryFn: () => compliant.entities.SubInsuranceRequirement.filter({ gc_id: policy.gc_id }),
    enabled: !!policy?.gc_id,
  });

  const createRequirementMutation = useMutation({
    mutationFn: (data) => compliant.entities.SubInsuranceRequirement.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries(['sub-requirements']);
      closeDialog();
    },
  });

  const updateRequirementMutation = useMutation({
    mutationFn: ({ id, data }) => compliant.entities.SubInsuranceRequirement.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['sub-requirements']);
      closeDialog();
    },
  });

  const deleteRequirementMutation = useMutation({
    mutationFn: (id) => compliant.entities.SubInsuranceRequirement.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['sub-requirements']);
    },
  });

  const openDialog = (requirement = null) => {
    if (requirement) {
      setEditingRequirement(requirement);
      setFormData({
        trade_type: requirement.trade_type,
        insurance_type: requirement.insurance_type,
        minimum_coverage: requirement.minimum_coverage,
        is_required: requirement.is_required,
        additional_insured_required: requirement.additional_insured_required,
        waiver_of_subrogation_required: requirement.waiver_of_subrogation_required,
        description: requirement.description || '',
      });
    } else {
      setEditingRequirement(null);
      setFormData({
        trade_type: '',
        insurance_type: '',
        minimum_coverage: '',
        is_required: true,
        additional_insured_required: false,
        waiver_of_subrogation_required: false,
        description: '',
      });
    }
    setIsDialogOpen(true);
  };

  const closeDialog = () => {
    setIsDialogOpen(false);
    setEditingRequirement(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const data = {
      ...formData,
      gc_id: policy.gc_id,
      gc_name: policy.gc_name,
      gc_policy_id: policy.id,
      minimum_coverage: parseFloat(formData.minimum_coverage),
    };

    if (editingRequirement) {
      await updateRequirementMutation.mutateAsync({ id: editingRequirement.id, data });
    } else {
      await createRequirementMutation.mutateAsync(data);
    }
  };

  const _handleDelete = async (id) => {
    if (confirm('Are you sure you want to delete this requirement?')) {
      await deleteRequirementMutation.mutateAsync(id);
    }
  };

  const groupedRequirements = requirements.reduce((acc, req) => {
    if (!acc[req.trade_type]) {
      acc[req.trade_type] = [];
    }
    acc[req.trade_type].push(req);
    return acc;
  }, {});

  if (!policyId || !policy) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-4 md:p-8 flex items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="p-8 text-center">
            <p className="text-slate-600 mb-4">Policy not found</p>
            <Button onClick={() => navigate(createPageUrl("GCPolicies"))}>
              Back to Policies
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center gap-4 mb-6">
          <Button
            variant="outline"
            size="icon"
            onClick={() => navigate(createPageUrl("GCPolicies"))}
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div className="flex-1">
            <h1 className="text-3xl font-bold text-slate-900">{policy.gc_name}</h1>
            <p className="text-slate-600">{policy.policy_name} - Subcontractor Requirements</p>
          </div>
          <Button
            onClick={() => openDialog()}
            className="bg-red-600 hover:bg-red-700"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Requirement
          </Button>
        </div>

        {isLoading ? (
          <Card className="border-slate-200 shadow-lg">
            <CardContent className="p-6">
              <div className="space-y-4">
                {Array(5).fill(0).map((_, i) => (
                  <Skeleton key={i} className="h-20 w-full" />
                ))}
              </div>
            </CardContent>
          </Card>
        ) : Object.keys(groupedRequirements).length === 0 ? (
          <Card className="border-slate-200 shadow-lg">
            <CardContent className="p-12 text-center">
              <ClipboardList className="w-16 h-16 mx-auto text-slate-300 mb-4" />
              <h3 className="text-xl font-semibold text-slate-900 mb-2">
                No Requirements Yet
              </h3>
              <p className="text-slate-600 mb-6">
                Add insurance requirements for the subcontractors you hire
              </p>
              <Button onClick={() => openDialog()} className="bg-red-600 hover:bg-red-700">
                <Plus className="w-4 h-4 mr-2" />
                Add First Requirement
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {Object.entries(groupedRequirements).map(([tradeType, reqs]) => (
              <Card key={tradeType} className="border-slate-200 shadow-lg">
                <CardHeader className="border-b border-slate-200 bg-slate-50">
                  <CardTitle className="text-xl font-bold text-slate-900 flex items-center gap-2">
                    <ClipboardList className="w-5 h-5" />
                    {tradeType}
                    <Badge variant="outline" className="ml-auto">
                      {reqs.length} requirement{reqs.length !== 1 ? 's' : ''}
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-slate-50">
                        <TableHead className="font-semibold">Insurance Type</TableHead>
                        <TableHead className="font-semibold">Coverage</TableHead>
                        <TableHead className="font-semibold">Status</TableHead>
                        <TableHead className="font-semibold">Additional Requirements</TableHead>
                        <TableHead className="font-semibold w-24">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {reqs.map((req) => (
                        <TableRow key={req.id} className="hover:bg-slate-50 transition-colors">
                          <TableCell className="font-medium text-slate-900">
                            {req.insurance_type?.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                          </TableCell>
                          <TableCell className="text-slate-600">
                            ${req.minimum_coverage?.toLocaleString()}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className={req.is_required
                                ? 'bg-red-50 text-red-700 border-red-200'
                                : 'bg-red-50 text-red-700 border-red-200'}
                            >
                              {req.is_required ? 'Required' : 'Optional'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              {req.additional_insured_required && (
                                <Badge variant="outline" className="text-xs bg-purple-50 text-purple-700 border-purple-200">
                                  Additional Insured
                                </Badge>
                              )}
                              {req.waiver_of_subrogation_required && (
                                <Badge variant="outline" className="text-xs bg-cyan-50 text-cyan-700 border-cyan-200">
                                  Waiver of Subrogation
                                </Badge>
                              )}
                              {!req.additional_insured_required && !req.waiver_of_subrogation_required && (
                                <span className="text-sm text-slate-400">None</span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => openDialog(req)}
                              >
                                <Pencil className="w-4 h-4" />
                              </Button>
                              {/* <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleDelete(req.id)}
                                className="text-red-600 hover:text-red-700 hover:bg-red-50"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button> */}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <Dialog open={isDialogOpen} onOpenChange={closeDialog}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">
              {editingRequirement ? 'Edit Requirement' : 'Add New Requirement'}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="trade_type">
                  Trade Type <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="trade_type"
                  value={formData.trade_type}
                  onChange={(e) => setFormData({ ...formData, trade_type: e.target.value })}
                  placeholder="e.g., Electrician, Plumber, HVAC"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="insurance_type">
                  Insurance Type <span className="text-red-500">*</span>
                </Label>
                <Select
                  value={formData.insurance_type}
                  onValueChange={(value) => setFormData({ ...formData, insurance_type: value })}
                  required
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select insurance type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="general_liability">General Liability</SelectItem>
                    <SelectItem value="workers_compensation">Workers Compensation</SelectItem>
                    <SelectItem value="auto_liability">Auto Liability</SelectItem>
                    <SelectItem value="umbrella_policy">Umbrella Policy</SelectItem>
                    <SelectItem value="professional_liability">Professional Liability</SelectItem>
                    <SelectItem value="builders_risk">Builders Risk</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="minimum_coverage">
                  Minimum Coverage ($) <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="minimum_coverage"
                  type="number"
                  value={formData.minimum_coverage}
                  onChange={(e) => setFormData({ ...formData, minimum_coverage: e.target.value })}
                  placeholder="1000000"
                  required
                />
              </div>

              <div className="space-y-3 pt-2">
                <div className="flex items-center space-x-3">
                  <Switch
                    id="is_required"
                    checked={formData.is_required}
                    onCheckedChange={(checked) => setFormData({ ...formData, is_required: checked })}
                  />
                  <Label htmlFor="is_required" className="cursor-pointer">
                    This insurance is required (not optional)
                  </Label>
                </div>

                <div className="flex items-center space-x-3">
                  <Switch
                    id="additional_insured"
                    checked={formData.additional_insured_required}
                    onCheckedChange={(checked) => setFormData({ ...formData, additional_insured_required: checked })}
                  />
                  <Label htmlFor="additional_insured" className="cursor-pointer">
                    GC must be listed as additional insured
                  </Label>
                </div>

                <div className="flex items-center space-x-3">
                  <Switch
                    id="waiver_of_subrogation"
                    checked={formData.waiver_of_subrogation_required}
                    onCheckedChange={(checked) => setFormData({ ...formData, waiver_of_subrogation_required: checked })}
                  />
                  <Label htmlFor="waiver_of_subrogation" className="cursor-pointer">
                    Waiver of subrogation required
                  </Label>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description / Notes</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Additional details about this requirement..."
                  className="min-h-20"
                />
              </div>
            </div>

            <DialogFooter className="gap-2">
              <Button type="button" variant="outline" onClick={closeDialog}>
                Cancel
              </Button>
              <Button
                type="submit"
                className="bg-red-600 hover:bg-red-700"
                disabled={createRequirementMutation.isPending || updateRequirementMutation.isPending}
              >
                {editingRequirement ? 'Update' : 'Create'} Requirement
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}