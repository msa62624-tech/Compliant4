import { useRef, useState } from "react";
import { apiClient } from "@/api/apiClient";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Pencil, Trash2, Settings, Upload, Sparkles, X } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { getAvailableTrades } from "@/insuranceRequirements";

export default function InsurancePrograms() {
  const queryClient = useQueryClient();

  // Get all available trades from the system
  const allTrades = getAvailableTrades();

  const newGLRequirement = (tierName = 'Tier 1') => ({
    id: `req-local-${Date.now()}-${Math.random()}`,
    trade_name: 'All Trades',
    tier: tierName,
    insurance_type: 'general_liability',
    is_required: true,
    gl_each_occurrence: 1000000,
    gl_general_aggregate: 2000000,
    gl_products_completed_ops: 2000000,
    umbrella_each_occurrence: null,
    umbrella_aggregate: null,
    wc_each_accident: null,
    wc_disease_policy_limit: null,
    wc_disease_each_employee: null,
    auto_combined_single_limit: null,
    applicable_trades: [],
    is_all_other_trades: false,
  });

  const newWCRequirement = (tierName = 'Tier 1') => ({
    id: `req-local-${Date.now()}-${Math.random()}`,
    trade_name: 'All Trades',
    tier: tierName,
    insurance_type: 'workers_compensation',
    is_required: true,
    gl_each_occurrence: null,
    gl_general_aggregate: null,
    gl_products_completed_ops: null,
    umbrella_each_occurrence: null,
    umbrella_aggregate: null,
    wc_each_accident: 500000,
    wc_disease_policy_limit: 500000,
    wc_disease_each_employee: 500000,
    auto_combined_single_limit: null,
    applicable_trades: [],
    is_all_other_trades: false,
  });

  const newAutoRequirement = (tierName = 'Tier 1') => ({
    id: `req-local-${Date.now()}-${Math.random()}`,
    trade_name: 'All Trades',
    tier: tierName,
    insurance_type: 'auto_liability',
    is_required: true,
    gl_each_occurrence: null,
    gl_general_aggregate: null,
    gl_products_completed_ops: null,
    umbrella_each_occurrence: null,
    umbrella_aggregate: null,
    wc_each_accident: null,
    wc_disease_policy_limit: null,
    wc_disease_each_employee: null,
    auto_combined_single_limit: 1000000,
    applicable_trades: [],
    is_all_other_trades: false,
  });

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingProgram, setEditingProgram] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    is_active: true,
    pdf_name: '',
    pdf_data: '',
    pdf_type: '',
    hold_harmless_template_url: '',
    hold_harmless_template_name: '',
  });
  const [isUploading, setIsUploading] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [parsePreview, setParsePreview] = useState(null);
  const [parseError, setParseError] = useState('');
  const fileInputRef = useRef(null);
  const [tiers, setTiers] = useState([{ name: 'Tier 1', id: `tier-${Date.now()}` }]);
  const [requirements, setRequirements] = useState([newGLRequirement('Tier 1')]);

  const { data: programs = [], isLoading } = useQuery({
    queryKey: ['programs'],
    queryFn: () => apiClient.entities.InsuranceProgram.list(),
  });

  const createProgramMutation = useMutation({
    mutationFn: (data) => apiClient.entities.InsuranceProgram.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries(['programs']);
      closeDialog();
    },
  });

  const updateProgramMutation = useMutation({
    mutationFn: ({ id, data }) => apiClient.entities.InsuranceProgram.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['programs']);
      closeDialog();
    },
  });

  const deleteProgramMutation = useMutation({
    mutationFn: (id) => apiClient.entities.InsuranceProgram.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['programs']);
    },
  });

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      is_active: true,
      pdf_name: '',
      pdf_data: '',
      pdf_type: '',
      hold_harmless_template_url: '',
      hold_harmless_template_name: '',
    });
    setTiers([{ name: 'Tier 1', id: `tier-${Date.now()}` }]);
    setRequirements([newGLRequirement('Tier 1')]);
  };

  const openDialog = (program = null) => {
    if (program) {
      setEditingProgram(program);
      setFormData({
        name: program.name || '',
        description: program.description || '',
        is_active: program.is_active !== false,
        pdf_name: program.pdf_name || '',
        pdf_data: program.pdf_data || '',
        pdf_type: program.pdf_type || '',
        hold_harmless_template_url: program.hold_harmless_template_url || '',
        hold_harmless_template_name: program.hold_harmless_template_name || '',
      });
      // load requirements for editing if needed in future
    } else {
      setEditingProgram(null);
      resetForm();
    }
    setIsDialogOpen(true);
  };

  const closeDialog = () => {
    setIsDialogOpen(false);
    setEditingProgram(null);
    resetForm();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const data = {
      ...formData,
      name: formData.name,
      description: formData.description,
      is_active: formData.is_active,
      hold_harmless_template_url: formData.hold_harmless_template_url || '',
      hold_harmless_template_name: formData.hold_harmless_template_name || '',
    };

    if (editingProgram) {
      await updateProgramMutation.mutateAsync({ id: editingProgram.id, data });
      const existing = await apiClient.entities.SubInsuranceRequirement.filter({ program_id: editingProgram.id });
      await Promise.all(existing.map((r) => apiClient.entities.SubInsuranceRequirement.delete(r.id)));
      await Promise.all(requirements.map((req) => apiClient.entities.SubInsuranceRequirement.create({ ...req, program_id: editingProgram.id })));
    } else {
      const created = await createProgramMutation.mutateAsync(data);
      await Promise.all(requirements.map((req) => apiClient.entities.SubInsuranceRequirement.create({ ...req, program_id: created.id })));
    }
  };

  const handleImportClick = () => {
    setParseError('');
    fileInputRef.current?.click();
  };

  const handleFileSelected = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsParsing(true);
    setParseError('');
    try {
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const base64 = reader.result.split(',')[1];
          const parsed = await apiClient.integrations.Core.ParseProgramPDF({
            pdf_base64: base64,
            pdf_name: file.name,
            pdf_type: file.type || 'application/pdf'
          });
          setParsePreview(parsed);
        } catch (err) {
          console.error(err);
          setParseError('Failed to parse PDF. Please verify the file is readable.');
        } finally {
          setIsParsing(false);
          e.target.value = '';
        }
      };
      reader.onerror = () => {
        setParseError('Failed to read PDF file.');
        setIsParsing(false);
      };
      reader.readAsDataURL(file);
    } catch (err) {
      console.error(err);
      setParseError('Failed to process the file.');
      setIsParsing(false);
    }
  };

  const handleConfirmImport = async () => {
    if (!parsePreview) return;
    try {
      const existingPrograms = await apiClient.entities.InsuranceProgram.list();
      const match = existingPrograms.find(p => p.name === parsePreview.program.name);
      let programId;
      if (match) {
        await apiClient.entities.InsuranceProgram.update(match.id, parsePreview.program);
        programId = match.id;
        const existingReqs = await apiClient.entities.SubInsuranceRequirement.filter({ program_id: programId });
        await Promise.all(existingReqs.map(r => apiClient.entities.SubInsuranceRequirement.delete(r.id)));
      } else {
        const createdProgram = await apiClient.entities.InsuranceProgram.create(parsePreview.program);
        programId = createdProgram.id;
      }

      await Promise.all(
        (parsePreview.requirements || []).map((req) =>
          apiClient.entities.SubInsuranceRequirement.create({ ...req, program_id: programId })
        )
      );
      queryClient.invalidateQueries(['programs']);
      setParsePreview(null);
    } catch (err) {
      console.error(err);
      setParseError('Failed to save imported program.');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 mb-2">Insurance Programs</h1>
            <p className="text-slate-600">Manage insurance program templates for projects</p>
          </div>
          <Button onClick={() => openDialog()} className="bg-red-600 hover:bg-red-700 shadow-lg">
            <Plus className="w-4 h-4 mr-2" />
            New Program
          </Button>
        </div>

        <div className="flex flex-wrap gap-3 items-center">
          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf"
            className="hidden"
            onChange={handleFileSelected}
          />
          <Button variant="outline" onClick={handleImportClick} disabled={isParsing}>
            <Upload className="w-4 h-4 mr-2" />
            Import from PDF (AI)
          </Button>
          {isParsing && <span className="text-sm text-slate-600">Parsing PDF...</span>}
          {parseError && <span className="text-sm text-red-600">{parseError}</span>}
        </div>

        {parsePreview && (
          <Card className="border-green-200 bg-green-50">
            <CardHeader className="border-b border-green-200">
              <CardTitle className="flex items-center gap-2 text-green-900">
                <Sparkles className="w-4 h-4" /> Parsed Program Preview (review & save)
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              <div>
                <p className="font-semibold text-slate-900">Program: {parsePreview.program?.name || 'Untitled'}</p>
                <p className="text-sm text-slate-600">{parsePreview.program?.description}</p>
              </div>

              <div className="overflow-auto">
                <table className="w-full text-sm">
                  <thead className="text-left bg-white">
                    <tr className="border-b">
                      <th className="p-2">Tier</th>
                      <th className="p-2">Trade</th>
                      <th className="p-2">Scope</th>
                      <th className="p-2">GL Occ / Agg / Prod</th>
                      <th className="p-2">Umbrella Occ / Agg</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      // Group requirements by tier
                      const groupedByTier = (parsePreview.requirements || []).reduce((acc, req) => {
                        const tier = req.tier || 'Unnamed Tier';
                        if (!acc[tier]) {
                          acc[tier] = [];
                        }
                        acc[tier].push(req);
                        return acc;
                      }, {});

                      // Render grouped requirements
                      return Object.entries(groupedByTier).map(([tierName, reqs]) => (
                        reqs.map((req, idx) => (
                          <tr key={req.id} className="border-b last:border-0">
                            {idx === 0 && (
                              <td className="p-2 font-bold align-top bg-slate-50" rowSpan={reqs.length}>
                                {tierName}
                              </td>
                            )}
                            <td className="p-2 font-medium">{req.trade_name || '—'}</td>
                            <td className="p-2 text-slate-700">{req.scope}</td>
                            <td className="p-2">
                              {`$${req.gl_each_occurrence?.toLocaleString() || '—'} / $${req.gl_general_aggregate?.toLocaleString() || '—'} / $${req.gl_products_completed_ops?.toLocaleString() || '—'}`}
                            </td>
                            <td className="p-2">
                              {req.umbrella_each_occurrence || req.umbrella_aggregate
                                ? `${req.umbrella_each_occurrence ? `$${req.umbrella_each_occurrence.toLocaleString()}` : '—'} / ${req.umbrella_aggregate ? `$${req.umbrella_aggregate.toLocaleString()}` : '—'}`
                                : '—'}
                            </td>
                          </tr>
                        ))
                      ));
                    })()}
                  </tbody>
                </table>
              </div>

              <div className="flex gap-3">
                <Button variant="outline" onClick={() => setParsePreview(null)}>
                  Dismiss
                </Button>
                <Button className="bg-red-600 hover:bg-red-700" onClick={handleConfirmImport}>
                  Save Program & Requirements
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Info Card */}
        <Card className="bg-red-50 border-red-200">
          <CardContent className="p-6">
            <h3 className="font-semibold text-red-900 mb-2">Insurance Programs</h3>
            <p className="text-sm text-red-800">
              Define insurance program templates that will be assigned to projects. 
              Each program specifies the insurance requirements (GL, WC, Umbrella, etc.) 
              that subcontractors must meet for projects using that program.
            </p>
          </CardContent>
        </Card>

        {/* Programs List */}
        <Card className="border-slate-200 shadow-lg">
          <CardHeader className="border-b border-slate-200">
            <CardTitle className="text-xl font-bold">Programs ({programs.length})</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-12 text-center text-slate-500">Loading programs...</div>
            ) : programs.length === 0 ? (
              <div className="p-12 text-center">
                <Settings className="w-16 h-16 mx-auto text-slate-300 mb-4" />
                <h3 className="text-xl font-semibold mb-2">No Programs Yet</h3>
                <p className="text-slate-600 mb-6">Create your first insurance program template</p>
                <Button onClick={() => openDialog()} className="bg-red-600 hover:bg-red-700">
                  <Plus className="w-4 h-4 mr-2" />
                  Create Program
                </Button>
              </div>
            ) : (
              <div className="divide-y">
                {programs.map((program) => (
                  <div
                    key={program.id}
                    className="p-6 hover:bg-slate-50 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-lg font-semibold text-slate-900">
                            {program.name}
                          </h3>
                          <Badge
                            variant="outline"
                            className={
                              program.is_active
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : 'bg-slate-50 text-slate-700'
                            }
                          >
                            {program.is_active ? 'Active' : 'Inactive'}
                          </Badge>
                        </div>
                        <p className="text-slate-600 mb-2">{program.description}</p>
                        <p className="text-xs text-slate-500">
                          ID: {program.id}
                        </p>
                        {program.pdf_name && (
                          <div className="mt-3 inline-flex items-center gap-2">
                            <Badge variant="outline" className="bg-rose-50 text-rose-700 border-rose-200">
                              PDF
                            </Badge>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                try {
                                  if (!program.pdf_data) return;
                                  const byteCharacters = atob(program.pdf_data);
                                  const byteNumbers = new Array(byteCharacters.length);
                                  for (let i = 0; i < byteCharacters.length; i++) {
                                    byteNumbers[i] = byteCharacters.charCodeAt(i);
                                  }
                                  const byteArray = new Uint8Array(byteNumbers);
                                  const blob = new Blob([byteArray], { type: program.pdf_type || 'application/pdf' });
                                  const url = URL.createObjectURL(blob);
                                  window.open(url, '_blank');
                                } catch (err) {
                                  console.error('Failed to open PDF', err);
                                  alert('Could not open PDF');
                                }
                              }}
                            >
                              View PDF ({program.pdf_name})
                            </Button>
                          </div>
                        )}
                      </div>
                      <div className="flex gap-2 ml-4">
                        <button
                          onClick={() => openDialog(program)}
                          className="p-2 hover:bg-red-100 rounded-lg transition-colors text-red-600"
                          title="Edit"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => {
                            if (window.confirm(`Delete program "${program.name}"?`)) {
                              deleteProgramMutation.mutate(program.id);
                            }
                          }}
                          className="p-2 hover:bg-red-100 rounded-lg transition-colors text-red-600"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Info Box */}
        <Card className="bg-amber-50 border-amber-200">
          <CardContent className="p-6">
            <h3 className="font-semibold text-amber-900 mb-2">⚠️ Next Steps</h3>
            <ul className="text-sm text-amber-800 space-y-1 list-disc list-inside">
              <li>Create insurance programs for your different project types</li>
              <li>Each program will define the insurance requirements for subcontractors</li>
              <li>Assign programs when creating new projects in the GC section</li>
              <li>Use ProjectsSetup page to manage insurance requirements for each program/trade combination</li>
            </ul>
          </CardContent>
        </Card>

        {/* Create/Edit Program Dialog */}
        {isDialogOpen && (
          <div className="fixed inset-0 z-[99999] bg-black/50 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
              <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b flex-shrink-0">
                <h2 className="text-xl font-bold text-slate-900">
                  {editingProgram ? 'Edit Program' : 'Create New Program'}
                </h2>
                <button
                  onClick={closeDialog}
                  className="text-slate-500 hover:text-slate-700 text-2xl leading-none"
                >
                  ×
                </button>
              </div>

              <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
                <div className="space-y-4 py-4 px-6 overflow-y-auto flex-1 min-h-0">
                  <div className="space-y-2">
                    <Label htmlFor="name">
                      Program Name <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="e.g., Standard Commercial Program, High-Rise Program"
                      required
                    />
                    <p className="text-xs text-slate-500">
                      A descriptive name for this insurance program template
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="description">
                      Description
                    </Label>
                    <Textarea
                      id="description"
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      placeholder="Describe the types of projects and requirements for this program..."
                      rows={4}
                    />
                    <p className="text-xs text-slate-500">
                      Explain what this program is for and any special requirements
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="pdf_upload">Attach Program PDF (optional)</Label>
                    <Input
                      id="pdf_upload"
                      type="file"
                      accept="application/pdf"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        setIsUploading(true);
                        try {
                          const reader = new FileReader();
                          reader.onload = () => {
                            const base64 = reader.result.split(',')[1];
                            setFormData((prev) => ({
                              ...prev,
                              pdf_name: file.name,
                              pdf_data: base64,
                              pdf_type: file.type,
                            }));
                          };
                          reader.onerror = () => {
                            alert('Failed to read PDF file.');
                          };
                          reader.readAsDataURL(file);
                        } finally {
                          setIsUploading(false);
                        }
                      }}
                    />
                    {formData.pdf_name && (
                      <p className="text-xs text-slate-600">Attached: {formData.pdf_name}</p>
                    )}
                    <p className="text-xs text-slate-500">
                      Upload the official program PDF so admins and GCs can view it.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="hh_upload">Hold Harmless Template (HTML preferred)</Label>
                    <Input
                      id="hh_upload"
                      type="file"
                      accept="text/html,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                      disabled={isUploading}
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        setIsUploading(true);
                        try {
                          const uploadResult = await apiClient.integrations.Core.UploadFile({ file });
                          const url = uploadResult?.file_url || uploadResult?.url || uploadResult?.downloadUrl || uploadResult?.data?.file_url || uploadResult?.data?.url || '';
                          if (!url) {
                            alert('Upload failed - no URL returned.');
                          } else {
                            setFormData((prev) => ({
                              ...prev,
                              hold_harmless_template_url: url,
                              hold_harmless_template_name: file.name,
                            }));
                          }
                        } catch (err) {
                          console.error('Failed to upload hold harmless template', err);
                          alert('Could not upload the hold harmless template.');
                        } finally {
                          setIsUploading(false);
                          e.target.value = '';
                        }
                      }}
                    />
                    {formData.hold_harmless_template_name && (
                      <p className="text-xs text-slate-600">Template: {formData.hold_harmless_template_name}</p>
                    )}
                    <p className="text-xs text-slate-500">
                      Upload your master Hold Harmless/Indemnity agreement. The system will merge in project address and additional insureds for each COI approval.
                    </p>
                  </div>

                  <div className="space-y-2 border-t pt-4">
                    <div className="flex items-center gap-2">
                      <input
                        id="is_active"
                        type="checkbox"
                        checked={formData.is_active}
                        onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                        className="w-4 h-4 text-red-600 border-slate-300 rounded focus:ring-red-500"
                      />
                      <Label htmlFor="is_active" className="text-sm cursor-pointer">
                        Active Program (available for project assignment)
                      </Label>
                    </div>
                  </div>

                  {/* Tier Management Section */}
                  <div className="space-y-4 border-t pt-4">
                    <div className="flex items-center justify-between">
                      <Label className="text-base font-semibold">Program Tiers</Label>
                      <Button 
                        type="button" 
                        variant="outline" 
                        size="sm" 
                        onClick={() => {
                          const newTierNum = tiers.length + 1;
                          setTiers([...tiers, { name: `Tier ${newTierNum}`, id: `tier-${Date.now()}` }]);
                        }}
                      >
                        <Plus className="w-4 h-4 mr-1" /> Add Tier
                      </Button>
                    </div>
                    
                    <div className="text-sm text-slate-600 bg-red-50 p-3 rounded">
                      Define your insurance requirement tiers. Each tier can specify which trades it applies to and their insurance limits.
                    </div>

                    <div className="space-y-4">
                      {tiers.map((tier, tierIndex) => (
                        <Card key={tier.id} className="border-2">
                          <CardHeader className="pb-3">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3 flex-1">
                                <Label className="text-sm font-semibold">Tier Name:</Label>
                                <Input 
                                  value={tier.name} 
                                  onChange={(e) => {
                                    const oldTierName = tiers[tierIndex].name;
                                    const newTiers = [...tiers];
                                    newTiers[tierIndex].name = e.target.value;
                                    setTiers(newTiers);
                                    // Update requirements with new tier name
                                    setRequirements(prev => prev.map(r => 
                                      r.tier === oldTierName ? { ...r, tier: e.target.value } : r
                                    ));
                                  }}
                                  className="w-48"
                                  placeholder="e.g., Tier 1, High Risk, etc."
                                />
                              </div>
                              {tiers.length > 1 && (
                                <Button 
                                  type="button" 
                                  variant="ghost" 
                                  size="icon"
                                  onClick={() => {
                                    const tierName = tier.name;
                                    setTiers(tiers.filter((_, i) => i !== tierIndex));
                                    // Remove requirements for this tier
                                    setRequirements(prev => prev.filter(r => r.tier !== tierName));
                                  }}
                                  className="text-red-600 hover:text-red-700"
                                >
                                  <X className="w-4 h-4" />
                                </Button>
                              )}
                            </div>
                          </CardHeader>
                          <CardContent className="space-y-4">
                            {/* Trade Selection for this tier */}
                            <div className="space-y-2">
                              <div className="flex items-center justify-between">
                                <Label className="text-sm font-medium">Applicable Trades</Label>
                                <div className="flex items-center gap-2">
                                  <Checkbox 
                                    id={`all-other-${tier.id}`}
                                    checked={requirements.some(r => r.tier === tier.name && r.is_all_other_trades)}
                                    onCheckedChange={(checked) => {
                                      setRequirements(prev => prev.map(r => 
                                        r.tier === tier.name ? { ...r, is_all_other_trades: !!checked } : r
                                      ));
                                    }}
                                  />
                                  <Label htmlFor={`all-other-${tier.id}`} className="text-sm cursor-pointer">
                                    All Other Trades (catch-all)
                                  </Label>
                                </div>
                              </div>
                              
                              <Select 
                                value="" 
                                onValueChange={(tradeValue) => {
                                  // Add trade to this tier's requirements
                                  const tierReqs = requirements.filter(r => r.tier === tier.name);
                                  if (tierReqs.length === 0) {
                                    // Create first requirement for this tier
                                    setRequirements(prev => [...prev, {
                                      ...newGLRequirement(tier.name),
                                      applicable_trades: [tradeValue]
                                    }]);
                                  } else {
                                    // Add trade to existing requirements
                                    setRequirements(prev => prev.map(r => {
                                      if (r.tier === tier.name) {
                                        const currentTrades = r.applicable_trades || [];
                                        if (!currentTrades.includes(tradeValue)) {
                                          return { ...r, applicable_trades: [...currentTrades, tradeValue] };
                                        }
                                      }
                                      return r;
                                    }));
                                  }
                                }}
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Select trades for this tier..." />
                                </SelectTrigger>
                                <SelectContent>
                                  {allTrades.map((trade) => (
                                    <SelectItem key={trade.value} value={trade.value}>
                                      {trade.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>

                              {/* Display selected trades */}
                              <div className="flex flex-wrap gap-2 mt-2">
                                {requirements
                                  .filter(r => r.tier === tier.name)
                                  .flatMap(r => r.applicable_trades || [])
                                  .filter((v, i, a) => a.indexOf(v) === i) // unique
                                  .map((trade) => (
                                    <Badge key={trade} variant="secondary" className="gap-1">
                                      {allTrades.find(t => t.value === trade)?.label || trade}
                                      <X 
                                        className="w-3 h-3 cursor-pointer hover:text-red-600" 
                                        onClick={() => {
                                          setRequirements(prev => prev.map(r => {
                                            if (r.tier === tier.name && r.applicable_trades) {
                                              return { ...r, applicable_trades: r.applicable_trades.filter(t => t !== trade) };
                                            }
                                            return r;
                                          }));
                                        }}
                                      />
                                    </Badge>
                                  ))}
                              </div>
                            </div>

                            {/* Requirements for this tier */}
                            <div className="space-y-2 border-t pt-3">
                              <div className="flex items-center justify-between">
                                <Label className="text-sm font-semibold">Insurance Requirements</Label>
                                <div className="flex gap-2">
                                  <Button type="button" variant="outline" size="sm" onClick={() => setRequirements(prev => [...prev, newGLRequirement(tier.name)])}>
                                    <Plus className="w-3 h-3 mr-1" /> GL
                                  </Button>
                                  <Button type="button" variant="outline" size="sm" onClick={() => setRequirements(prev => [...prev, newWCRequirement(tier.name)])}>
                                    <Plus className="w-3 h-3 mr-1" /> WC
                                  </Button>
                                  <Button type="button" variant="outline" size="sm" onClick={() => setRequirements(prev => [...prev, newAutoRequirement(tier.name)])}>
                                    <Plus className="w-3 h-3 mr-1" /> Auto
                                  </Button>
                                </div>
                              </div>

                              <div className="space-y-2">
                                {requirements.filter(r => r.tier === tier.name).map((req) => (
                                  <div key={req.id} className="p-3 border rounded-lg bg-slate-50 space-y-2">
                                    <div className="flex items-center justify-between">
                                      <div className="flex gap-2 items-center flex-wrap">
                                        <Select value={req.insurance_type} onValueChange={(val) => setRequirements(prev => prev.map(r => r.id === req.id ? { ...r, insurance_type: val } : r))}>
                                          <SelectTrigger className="w-40">
                                            <SelectValue />
                                          </SelectTrigger>
                                          <SelectContent>
                                            <SelectItem value="general_liability">General Liability</SelectItem>
                                            <SelectItem value="umbrella_policy">Excess / Umbrella</SelectItem>
                                            <SelectItem value="workers_compensation">Workers Comp</SelectItem>
                                            <SelectItem value="auto_liability">Auto Liability</SelectItem>
                                          </SelectContent>
                                        </Select>
                                      </div>
                                      <Button type="button" variant="ghost" size="icon" onClick={() => setRequirements(prev => prev.filter(r => r.id !== req.id))} className="text-red-600 hover:text-red-700">
                                        <Trash2 className="w-3 h-3" />
                                      </Button>
                                    </div>

                                    {req.insurance_type === 'general_liability' && (
                                      <div className="grid grid-cols-3 gap-2">
                                        <Input type="number" placeholder="Each Occurrence" value={req.gl_each_occurrence || ''} onChange={(e) => setRequirements(prev => prev.map(r => r.id === req.id ? { ...r, gl_each_occurrence: Number(e.target.value) || null } : r))} className="text-sm" />
                                        <Input type="number" placeholder="General Aggregate" value={req.gl_general_aggregate || ''} onChange={(e) => setRequirements(prev => prev.map(r => r.id === req.id ? { ...r, gl_general_aggregate: Number(e.target.value) || null } : r))} className="text-sm" />
                                        <Input type="number" placeholder="Products/Ops" value={req.gl_products_completed_ops || ''} onChange={(e) => setRequirements(prev => prev.map(r => r.id === req.id ? { ...r, gl_products_completed_ops: Number(e.target.value) || null } : r))} className="text-sm" />
                                      </div>
                                    )}

                                    {req.insurance_type === 'umbrella_policy' && (
                                      <div className="grid grid-cols-2 gap-2">
                                        <Input type="number" placeholder="Each Occurrence" value={req.umbrella_each_occurrence || ''} onChange={(e) => setRequirements(prev => prev.map(r => r.id === req.id ? { ...r, umbrella_each_occurrence: Number(e.target.value) || null } : r))} className="text-sm" />
                                        <Input type="number" placeholder="Aggregate" value={req.umbrella_aggregate || ''} onChange={(e) => setRequirements(prev => prev.map(r => r.id === req.id ? { ...r, umbrella_aggregate: Number(e.target.value) || null } : r))} className="text-sm" />
                                      </div>
                                    )}

                                    {req.insurance_type === 'workers_compensation' && (
                                      <div className="grid grid-cols-3 gap-2">
                                        <Input type="number" placeholder="Each Accident" value={req.wc_each_accident || ''} onChange={(e) => setRequirements(prev => prev.map(r => r.id === req.id ? { ...r, wc_each_accident: Number(e.target.value) || null } : r))} className="text-sm" />
                                        <Input type="number" placeholder="Disease Limit" value={req.wc_disease_policy_limit || ''} onChange={(e) => setRequirements(prev => prev.map(r => r.id === req.id ? { ...r, wc_disease_policy_limit: Number(e.target.value) || null } : r))} className="text-sm" />
                                        <Input type="number" placeholder="Disease/Employee" value={req.wc_disease_each_employee || ''} onChange={(e) => setRequirements(prev => prev.map(r => r.id === req.id ? { ...r, wc_disease_each_employee: Number(e.target.value) || null } : r))} className="text-sm" />
                                      </div>
                                    )}

                                    {req.insurance_type === 'auto_liability' && (
                                      <Input type="number" placeholder="Combined Single Limit" value={req.auto_combined_single_limit || ''} onChange={(e) => setRequirements(prev => prev.map(r => r.id === req.id ? { ...r, auto_combined_single_limit: Number(e.target.value) || null } : r))} className="text-sm" />
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex gap-2 px-6 py-4 border-t bg-slate-50 flex-shrink-0">
                  <Button type="button" variant="outline" onClick={closeDialog}>
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    className="bg-red-600 hover:bg-red-700"
                    disabled={createProgramMutation.isPending || updateProgramMutation.isPending || isUploading}
                  >
                    {editingProgram ? 'Update' : 'Create'} Program
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
