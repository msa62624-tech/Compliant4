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
import { Plus, Pencil, Trash2, Settings, Upload, Sparkles, X, Search } from "lucide-react";
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
    wc_each_accident: 1000000,
    wc_disease_policy_limit: 1000000,
    wc_disease_each_employee: 1000000,
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
    auto_hired_non_owned_required: true,
    applicable_trades: [],
    is_all_other_trades: false,
  });

  const newUmbrellaRequirement = (tierName = 'Tier 1') => ({
    id: `req-local-${Date.now()}-${Math.random()}`,
    trade_name: 'All Trades',
    tier: tierName,
    insurance_type: 'umbrella_policy',
    is_required: true,
    gl_each_occurrence: null,
    gl_general_aggregate: null,
    gl_products_completed_ops: null,
    umbrella_each_occurrence: 1000000,
    umbrella_aggregate: 1000000,
    wc_each_accident: null,
    wc_disease_policy_limit: null,
    wc_disease_each_employee: null,
    auto_combined_single_limit: null,
    auto_hired_non_owned_required: null,
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
  
  // Search and filter state
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all"); // all, active, inactive

  const { data: programs = [], isLoading } = useQuery({
    queryKey: ['programs'],
    queryFn: () => apiClient.entities.InsuranceProgram.list(),
  });

  // Filter programs based on search and status
  const filteredPrograms = programs.filter(program => {
    const matchesSearch = searchTerm === "" || 
      program.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      program.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      program.id?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === "all" || 
      (statusFilter === "active" && program.is_active) ||
      (statusFilter === "inactive" && !program.is_active);
    
    return matchesSearch && matchesStatus;
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

  const openDialog = async (program = null) => {
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
      
      // Load requirements for this program
      try {
        const programReqs = await apiClient.entities.SubInsuranceRequirement.filter({ program_id: program.id });
        const reqs = Array.isArray(programReqs) ? programReqs : (programReqs?.data || []);
        console.log('Loaded requirements for program:', reqs.length);
        setRequirements(reqs);
        
        // Extract unique tiers from loaded requirements
        const tierSet = new Set(reqs.map(r => r.tier).filter(Boolean));
        const extractedTiers = Array.from(tierSet).sort().map((tierName, idx) => ({
          name: tierName,
          id: `tier-${tierName}-${idx}`
        }));
        
        if (extractedTiers.length > 0) {
          setTiers(extractedTiers);
        } else {
          setTiers([{ name: 'Tier 1', id: `tier-${Date.now()}` }]);
        }
      } catch (err) {
        console.error('Error loading requirements:', err);
        // Fallback to empty requirements
        setRequirements([]);
        setTiers([{ name: 'Tier 1', id: `tier-${Date.now()}` }]);
      }
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
    try {
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
        const existingReqs = Array.isArray(existing) ? existing : (existing?.data || []);
        await Promise.all(existingReqs.map((r) => apiClient.entities.SubInsuranceRequirement.delete(r.id)));
        await Promise.all(requirements.map((req) => apiClient.entities.SubInsuranceRequirement.create({ 
          ...req, 
          program_id: editingProgram.id,
          insurance_type: req.insurance_type || 'general_liability',
          is_required: req.is_required !== undefined ? req.is_required : true
        })));
        console.log('✅ Program updated with', requirements.length, 'requirements');
      } else {
        const created = await createProgramMutation.mutateAsync(data);
        await Promise.all(requirements.map((req) => apiClient.entities.SubInsuranceRequirement.create({ 
          ...req, 
          program_id: created.id,
          insurance_type: req.insurance_type || 'general_liability',
          is_required: req.is_required !== undefined ? req.is_required : true
        })));
        console.log('✅ Program created with ID', created.id, 'and', requirements.length, 'requirements');
      }
      
      // Refresh the data
      await queryClient.invalidateQueries({ queryKey: ['programs'] });
      await queryClient.invalidateQueries({ queryKey: ['SubInsuranceRequirement'] });
      
      // Clear form
      setIsDialogOpen(false);
      setEditingProgram(null);
      setFormData({ name: '', description: '', is_active: true, hold_harmless_template_url: '', hold_harmless_template_name: '', pdf_name: '', pdf_data: '', pdf_type: '' });
      setRequirements([]);
      setTiers([]);
    } catch (err) {
      console.error('Error saving program:', err);
      alert('Failed to save program. Check console for details.');
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
          // Show preview for user review
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
      console.log('Starting import with', parsePreview.requirements?.length || 0, 'requirements');
      const existingPrograms = await apiClient.entities.InsuranceProgram.list();
      const match = existingPrograms.find(p => p.name === parsePreview.program.name);
      let programId;
      if (match) {
        console.log('Updating existing program:', match.id);
        await apiClient.entities.InsuranceProgram.update(match.id, parsePreview.program);
        programId = match.id;
        const existingReqs = await apiClient.entities.SubInsuranceRequirement.filter({ program_id: programId });
        const reqs = Array.isArray(existingReqs) ? existingReqs : (existingReqs?.data || []);
        console.log('Deleting', reqs.length, 'existing requirements');
        await Promise.all(reqs.map(r => apiClient.entities.SubInsuranceRequirement.delete(r.id)));
      } else {
        console.log('Creating new program:', parsePreview.program.name);
        const createdProgram = await apiClient.entities.InsuranceProgram.create(parsePreview.program);
        programId = createdProgram.id;
        console.log('New program created with ID:', programId);
      }

      const requirementsToCreate = (parsePreview.requirements || []).map((req) => ({
        ...req, 
        program_id: programId,
        insurance_type: req.insurance_type || 'general_liability',
        is_required: req.is_required !== undefined ? req.is_required : true
      }));
      
      console.log('Creating', requirementsToCreate.length, 'requirements');
      await Promise.all(
        requirementsToCreate.map((req) =>
          apiClient.entities.SubInsuranceRequirement.create(req)
        )
      );
      
      console.log('✅ Import completed successfully');
      await queryClient.invalidateQueries({ queryKey: ['programs'] });
      await queryClient.invalidateQueries({ queryKey: ['SubInsuranceRequirement'] });
      setParsePreview(null);
      setParseError('');
      alert('Program imported successfully with ' + requirementsToCreate.length + ' requirements!');
    } catch (err) {
      console.error('Import error:', err);
      setParseError('Failed to save imported program: ' + err.message);
    }
  };

  const autoImportAndPopulate = async (parsed) => {
    try {
      // Auto-populate form with parsed data
      setFormData(prev => ({
        ...prev,
        name: parsed.program?.name || prev.name,
        description: parsed.program?.description || prev.description,
        pdf_name: parsed.program?.pdf_name || prev.pdf_name,
        pdf_data: parsed.program?.pdf_data || prev.pdf_data,
        pdf_type: parsed.program?.pdf_type || prev.pdf_type,
      }));

      // Extract unique tiers from requirements
      const tierSet = new Set((parsed.requirements || []).map(r => r.tier).filter(Boolean));
      const extractedTiers = Array.from(tierSet).sort().map((tierName, idx) => ({
        name: tierName,
        id: `tier-${Date.now()}-${idx}`
      }));

      if (extractedTiers.length > 0) {
        setTiers(extractedTiers);
      }

      // Set requirements directly from parsed data
      setRequirements(parsed.requirements || []);
      setParsePreview(null);
      setParseError('');
    } catch (err) {
      console.error('Auto-import failed:', err);
      setParseError('Failed to auto-populate from PDF. Please review manually.');
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
            <div className="flex items-center justify-between">
              <CardTitle className="text-xl font-bold">Programs ({filteredPrograms.length})</CardTitle>
              <div className="flex items-center gap-3">
                {/* Search Input */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input
                    placeholder="Search programs..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9 w-64"
                  />
                </div>
                {/* Status Filter */}
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-12 text-center text-slate-500">Loading programs...</div>
            ) : filteredPrograms.length === 0 ? (
              <div className="p-12 text-center">
                {programs.length === 0 ? (
                  <>
                    <Settings className="w-16 h-16 mx-auto text-slate-300 mb-4" />
                    <h3 className="text-xl font-semibold mb-2">No Programs Yet</h3>
                    <p className="text-slate-600 mb-6">Create your first insurance program template</p>
                    <Button onClick={() => openDialog()} className="bg-red-600 hover:bg-red-700">
                      <Plus className="w-4 h-4 mr-2" />
                      Create Program
                    </Button>
                  </>
                ) : (
                  <>
                    <Search className="w-16 h-16 mx-auto text-slate-300 mb-4" />
                    <h3 className="text-xl font-semibold mb-2">No Matching Programs</h3>
                    <p className="text-slate-600 mb-6">Try adjusting your search or filters</p>
                    <Button 
                      onClick={() => { setSearchTerm(""); setStatusFilter("all"); }} 
                      variant="outline"
                    >
                      Clear Filters
                    </Button>
                  </>
                )}
              </div>
            ) : (
              <div className="divide-y">
                {filteredPrograms.map((program) => (
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
                    <Label>Import from PDF (AI)</Label>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="application/pdf"
                      className="hidden"
                      onChange={handleFileSelected}
                    />
                    <div className="flex flex-wrap items-center gap-3">
                      <Button type="button" variant="outline" onClick={handleImportClick} disabled={isParsing}>
                        <Upload className="w-4 h-4 mr-2" />
                        Import from PDF (AI)
                      </Button>
                      {isParsing && <span className="text-sm text-slate-600">Parsing PDF...</span>}
                      {parseError && <span className="text-sm text-red-600">{parseError}</span>}
                    </div>
                    <p className="text-xs text-slate-500">
                      Upload a program PDF to auto-build tiers, trades, and limits. You can edit before saving.
                    </p>
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
                                const groupedByTier = (parsePreview.requirements || []).reduce((acc, req) => {
                                  const tier = req.tier || 'Unnamed Tier';
                                  if (!acc[tier]) {
                                    acc[tier] = [];
                                  }
                                  acc[tier].push(req);
                                  return acc;
                                }, {});

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
                          <Button variant="outline" type="button" onClick={() => setParsePreview(null)}>
                            Dismiss
                          </Button>
                          <Button variant="outline" type="button" onClick={async () => {
                            await autoImportAndPopulate(parsePreview);
                            if (!isDialogOpen) setIsDialogOpen(true);
                          }}>
                            Edit Manually
                          </Button>
                          <Button type="button" className="bg-red-600 hover:bg-red-700" onClick={handleConfirmImport}>
                            Save Directly
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  )}

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
                    <Label className="text-lg font-bold">Insurance Requirements by Tier</Label>
                    
                    <div className="text-sm text-slate-600 bg-blue-50 p-3 rounded border border-blue-200">
                      Each tier below can have different GL and Umbrella limits. Workers Comp and Auto are applied to ALL tiers.
                    </div>

                    {/* Add Tier Button */}
                    <Button 
                      type="button" 
                      variant="outline"
                      onClick={() => {
                        const newTierNum = tiers.length + 1;
                        const newTierName = `Tier ${newTierNum}`;
                        setTiers([...tiers, { name: newTierName, id: `tier-${Date.now()}` }]);
                        // Add default GL requirement for new tier
                        setRequirements([...requirements, newGLRequirement(newTierName)]);
                      }}
                    >
                      <Plus className="w-4 h-4 mr-2" /> Add New Tier
                    </Button>

                    {/* Display Tiers */}
                    <div className="space-y-3">
                      {tiers.map((tier, tierIndex) => {
                        const tierReqs = requirements.filter(r => r.tier === tier.name);
                        return (
                          <Card key={tier.id} className="border-2 border-slate-200">
                            <CardHeader className="pb-2">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3 flex-1">
                                  <h3 className="text-base font-bold text-slate-900">{tier.name}</h3>
                                  <span className="text-sm text-slate-500 bg-slate-100 px-2 py-1 rounded">
                                    {tierReqs.filter(r => r.insurance_type === 'general_liability').length} GL
                                    {tierReqs.filter(r => r.insurance_type === 'umbrella_policy').length > 0 ? ` + Umbrella` : ''}
                                  </span>
                                </div>
                                <div className="flex gap-2">
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    onClick={() => {
                                      const newName = prompt('Enter new tier name:', tier.name);
                                      if (newName && newName !== tier.name) {
                                        const newTiers = [...tiers];
                                        newTiers[tierIndex].name = newName;
                                        setTiers(newTiers);
                                        setRequirements(prev => prev.map(r => 
                                          r.tier === tier.name ? { ...r, tier: newName } : r
                                        ));
                                      }
                                    }}
                                  >
                                    <Pencil className="w-3 h-3 mr-1" /> Edit
                                  </Button>
                                  {tiers.length > 1 && (
                                    <Button 
                                      type="button" 
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => {
                                        setTiers(tiers.filter((_, i) => i !== tierIndex));
                                        setRequirements(prev => prev.filter(r => r.tier !== tier.name));
                                      }}
                                      className="text-red-600 hover:text-red-700"
                                    >
                                      <Trash2 className="w-3 h-3" />
                                    </Button>
                                  )}
                                </div>
                              </div>
                            </CardHeader>
                            <CardContent className="space-y-3 pt-2">
                              {/* Requirements for this tier */}
                              <div className="space-y-2">
                                {tierReqs.length === 0 ? (
                                  <p className="text-sm text-slate-500 italic">No requirements yet</p>
                                ) : (
                                  <div className="space-y-2">
                                    {tierReqs.map((req) => (
                                      <div key={req.id} className="p-3 border rounded bg-white">
                                        <div className="flex items-center justify-between mb-2">
                                          <span className="font-semibold text-sm">
                                            {req.insurance_type === 'general_liability' ? '💰 General Liability' : 
                                             req.insurance_type === 'umbrella_policy' ? '☂️ Excess/Umbrella' : req.insurance_type}
                                          </span>
                                          <Button 
                                            type="button" 
                                            size="icon" 
                                            variant="ghost"
                                            onClick={() => setRequirements(prev => prev.filter(r => r.id !== req.id))}
                                            className="text-red-600 hover:text-red-700 h-6 w-6"
                                          >
                                            <Trash2 className="w-3 h-3" />
                                          </Button>
                                        </div>
                                        
                                        {req.insurance_type === 'general_liability' && (
                                          <div className="grid grid-cols-3 gap-2 text-sm">
                                            <div>
                                              <p className="text-xs text-slate-600">Each Occurrence</p>
                                              <p className="font-semibold">${(req.gl_each_occurrence || 0).toLocaleString()}</p>
                                            </div>
                                            <div>
                                              <p className="text-xs text-slate-600">General Aggregate</p>
                                              <p className="font-semibold">${(req.gl_general_aggregate || 0).toLocaleString()}</p>
                                            </div>
                                            <div>
                                              <p className="text-xs text-slate-600">Products/Ops</p>
                                              <p className="font-semibold">${(req.gl_products_completed_ops || 0).toLocaleString()}</p>
                                            </div>
                                          </div>
                                        )}
                                        
                                        {req.insurance_type === 'umbrella_policy' && (
                                          <div className="grid grid-cols-2 gap-2 text-sm">
                                            <div>
                                              <p className="text-xs text-slate-600">Each Occurrence</p>
                                              <p className="font-semibold">${(req.umbrella_each_occurrence || 0).toLocaleString()}</p>
                                            </div>
                                            <div>
                                              <p className="text-xs text-slate-600">Aggregate</p>
                                              <p className="font-semibold">${(req.umbrella_aggregate || 0).toLocaleString()}</p>
                                            </div>
                                          </div>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>

                              {/* Add requirement buttons for this tier */}
                              <div className="flex gap-2 pt-2 border-t">
                                {tierReqs.filter(r => r.insurance_type === 'general_liability').length === 0 && (
                                  <Button 
                                    type="button" 
                                    size="sm"
                                    variant="outline"
                                    onClick={() => setRequirements([...requirements, newGLRequirement(tier.name)])}
                                  >
                                    <Plus className="w-3 h-3 mr-1" /> Add GL
                                  </Button>
                                )}
                                {tierReqs.filter(r => r.insurance_type === 'umbrella_policy').length === 0 && (
                                  <Button 
                                    type="button" 
                                    size="sm"
                                    variant="outline"
                                    onClick={() => setRequirements([...requirements, newUmbrellaRequirement(tier.name)])}
                                  >
                                    <Plus className="w-3 h-3 mr-1" /> Add Umbrella
                                  </Button>
                                )}
                              </div>
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>

                    {/* Global Requirements (WC & Auto) */}
                    <div className="space-y-3 border-t pt-4 mt-4">
                      <Label className="text-base font-bold">Global Requirements (All Tiers)</Label>
                      <p className="text-sm text-slate-600 bg-purple-50 p-3 rounded border border-purple-200">
                        Workers Comp and Auto insurance apply to ALL tiers in this program.
                      </p>

                      <div className="space-y-3">
                        {/* Workers Comp */}
                        <Card className="border-slate-200">
                          <CardHeader className="pb-2">
                            <div className="flex items-center justify-between">
                              <h4 className="font-semibold text-slate-900">👷 Workers Compensation</h4>
                              <div className="flex gap-2">
                                {requirements.filter(r => r.insurance_type === 'workers_compensation').length === 0 ? (
                                  <Button 
                                    type="button" 
                                    size="sm"
                                    variant="outline"
                                    onClick={() => setRequirements([...requirements, newWCRequirement('Global')])}
                                  >
                                    <Plus className="w-3 h-3 mr-1" /> Add WC
                                  </Button>
                                ) : (
                                  <Button 
                                    type="button" 
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => setRequirements(prev => prev.filter(r => r.insurance_type !== 'workers_compensation'))}
                                    className="text-red-600 hover:text-red-700"
                                  >
                                    <Trash2 className="w-3 h-3 mr-1" /> Remove
                                  </Button>
                                )}
                              </div>
                            </div>
                          </CardHeader>
                          {requirements.filter(r => r.insurance_type === 'workers_compensation').length > 0 && (
                            <CardContent className="pt-2">
                              {requirements.filter(r => r.insurance_type === 'workers_compensation').map((req) => (
                                <div key={req.id} className="grid grid-cols-3 gap-2 text-sm">
                                  <div>
                                    <p className="text-xs text-slate-600">Each Accident</p>
                                    <p className="font-semibold">${(req.wc_each_accident || 0).toLocaleString()}</p>
                                  </div>
                                  <div>
                                    <p className="text-xs text-slate-600">Disease Policy Limit</p>
                                    <p className="font-semibold">${(req.wc_disease_policy_limit || 0).toLocaleString()}</p>
                                  </div>
                                  <div>
                                    <p className="text-xs text-slate-600">Disease/Employee</p>
                                    <p className="font-semibold">${(req.wc_disease_each_employee || 0).toLocaleString()}</p>
                                  </div>
                                </div>
                              ))}
                            </CardContent>
                          )}
                        </Card>

                        {/* Auto Liability */}
                        <Card className="border-slate-200">
                          <CardHeader className="pb-2">
                            <div className="flex items-center justify-between">
                              <h4 className="font-semibold text-slate-900">🚗 Auto Liability</h4>
                              <div className="flex gap-2">
                                {requirements.filter(r => r.insurance_type === 'auto_liability').length === 0 ? (
                                  <Button 
                                    type="button" 
                                    size="sm"
                                    variant="outline"
                                    onClick={() => setRequirements([...requirements, newAutoRequirement('Global')])}
                                  >
                                    <Plus className="w-3 h-3 mr-1" /> Add Auto
                                  </Button>
                                ) : (
                                  <Button 
                                    type="button" 
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => setRequirements(prev => prev.filter(r => r.insurance_type !== 'auto_liability'))}
                                    className="text-red-600 hover:text-red-700"
                                  >
                                    <Trash2 className="w-3 h-3 mr-1" /> Remove
                                  </Button>
                                )}
                              </div>
                            </div>
                          </CardHeader>
                          {requirements.filter(r => r.insurance_type === 'auto_liability').length > 0 && (
                            <CardContent className="pt-2">
                              {requirements.filter(r => r.insurance_type === 'auto_liability').map((req) => (
                                <div key={req.id} className="space-y-2">
                                  <div>
                                    <p className="text-xs text-slate-600">Combined Single Limit</p>
                                    <p className="font-semibold text-sm">${(req.auto_combined_single_limit || 0).toLocaleString()}</p>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <Checkbox id={`hnoa-${req.id}`} checked={!!req.auto_hired_non_owned_required} onCheckedChange={(checked) => setRequirements(prev => prev.map(r => r.id === req.id ? { ...r, auto_hired_non_owned_required: !!checked } : r))} />
                                    <Label htmlFor={`hnoa-${req.id}`} className="text-xs cursor-pointer">Hired & Non-owned Required</Label>
                                  </div>
                                </div>
                              ))}
                            </CardContent>
                          )}
                        </Card>
                      </div>
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
