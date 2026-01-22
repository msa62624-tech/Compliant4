import { useState } from "react";
import { compliant } from "@/api/compliantClient";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2, FolderOpen, ArrowLeft, Archive } from "lucide-react";
import { notifyGCProjectCreated } from "@/gcNotifications";
import { toast } from "sonner";

const US_STATES = [
  { code: 'AL', name: 'Alabama' },
  { code: 'AK', name: 'Alaska' },
  { code: 'AZ', name: 'Arizona' },
  { code: 'AR', name: 'Arkansas' },
  { code: 'CA', name: 'California' },
  { code: 'CO', name: 'Colorado' },
  { code: 'CT', name: 'Connecticut' },
  { code: 'DE', name: 'Delaware' },
  { code: 'FL', name: 'Florida' },
  { code: 'GA', name: 'Georgia' },
  { code: 'HI', name: 'Hawaii' },
  { code: 'ID', name: 'Idaho' },
  { code: 'IL', name: 'Illinois' },
  { code: 'IN', name: 'Indiana' },
  { code: 'IA', name: 'Iowa' },
  { code: 'KS', name: 'Kansas' },
  { code: 'KY', name: 'Kentucky' },
  { code: 'LA', name: 'Louisiana' },
  { code: 'ME', name: 'Maine' },
  { code: 'MD', name: 'Maryland' },
  { code: 'MA', name: 'Massachusetts' },
  { code: 'MI', name: 'Michigan' },
  { code: 'MN', name: 'Minnesota' },
  { code: 'MS', name: 'Mississippi' },
  { code: 'MO', name: 'Missouri' },
  { code: 'MT', name: 'Montana' },
  { code: 'NE', name: 'Nebraska' },
  { code: 'NV', name: 'Nevada' },
  { code: 'NH', name: 'New Hampshire' },
  { code: 'NJ', name: 'New Jersey' },
  { code: 'NM', name: 'New Mexico' },
  { code: 'NY', name: 'New York' },
  { code: 'NC', name: 'North Carolina' },
  { code: 'ND', name: 'North Dakota' },
  { code: 'OH', name: 'Ohio' },
  { code: 'OK', name: 'Oklahoma' },
  { code: 'OR', name: 'Oregon' },
  { code: 'PA', name: 'Pennsylvania' },
  { code: 'RI', name: 'Rhode Island' },
  { code: 'SC', name: 'South Carolina' },
  { code: 'SD', name: 'South Dakota' },
  { code: 'TN', name: 'Tennessee' },
  { code: 'TX', name: 'Texas' },
  { code: 'UT', name: 'Utah' },
  { code: 'VT', name: 'Vermont' },
  { code: 'VA', name: 'Virginia' },
  { code: 'WA', name: 'Washington' },
  { code: 'WV', name: 'West Virginia' },
  { code: 'WI', name: 'Wisconsin' },
  { code: 'WY', name: 'Wyoming' },
];

export default function GCProjects() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const urlParams = new URLSearchParams(window.location.search);
  const gcId = urlParams.get('id');

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingProject, setEditingProject] = useState(null);
  const [isAutoLookingUp, setIsAutoLookingUp] = useState(false);
  const [formData, setFormData] = useState({
    project_name: '',
    project_type: '',
    structure_type: '',
    tenancy_type: '',
    address: '',
    city: '',
    state: '',
    zip_code: '',
    owner_entity: '',
    additional_insured_entities: '',
    start_date: '',
    estimated_completion: '',
    budget: '',
    program_id: '',
    notes: '',
  });

  // Fetch GC
  const { data: gc } = useQuery({
    queryKey: ['gc', gcId],
    queryFn: async () => {
      const contractors = await compliant.entities.Contractor.list();
      return contractors.find(c => c.id === gcId);
    },
    enabled: !!gcId,
  });

  // Fetch projects for this GC
  const { data: projects = [] } = useQuery({
    queryKey: ['gc-projects', gcId],
    queryFn: () => compliant.entities.Project.filter({ gc_id: gcId }, '-created_date'),
    enabled: !!gcId,
  });

  // Fetch programs
  const { data: programs = [] } = useQuery({
    queryKey: ['programs'],
    queryFn: () => compliant.entities.InsuranceProgram.list(),
  });

  // Fetch all project subs for counts
  const { data: allProjectSubs = [] } = useQuery({
    queryKey: ['all-project-subs'],
    queryFn: () => compliant.entities.ProjectSubcontractor.list(),
  });

  const createProjectMutation = useMutation({
    mutationFn: (data) => compliant.entities.Project.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries(['gc-projects', gcId]);
      setIsDialogOpen(false);
      resetForm();
    },
  });

  const updateProjectMutation = useMutation({
    mutationFn: ({ id, data }) => compliant.entities.Project.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['gc-projects', gcId]);
      setIsDialogOpen(false);
      setEditingProject(null);
      resetForm();
    },
  });

  const deleteProjectMutation = useMutation({
    mutationFn: (id) => compliant.entities.Project.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['gc-projects', gcId]);
    },
  });

  // Archive mutation
  const archiveProjectMutation = useMutation({
    mutationFn: async ({ id, reason }) => {
      const response = await compliant.api.post(`/entities/Project/${id}/archive`, { reason });
      return response.data;
    },
    onSuccess: () => {
      toast.success('Project archived successfully');
      queryClient.invalidateQueries(['gc-projects', gcId]);
    },
    onError: (error) => {
      toast.error(`Failed to archive: ${error.message}`);
    },
  });

  // Fetch current user for permission check
  const { data: user } = useQuery({
    queryKey: ['current-user'],
    queryFn: () => compliant.auth.me(),
  });

  const resetForm = () => {
    setFormData({
      project_name: '',
      project_type: '',
      structure_type: '',
      tenancy_type: '',
      address: '',
      city: '',
      state: '',
      zip_code: '',
      building_height: '',
      unit_count: '',
      owner_entity: '',
      additional_insured_entities: '',
      start_date: '',
      estimated_completion: '',
      budget: '',
      program_id: '',
      notes: '',
    });
  };

  // Auto-lookup NYC property data when address changes
  const handleAddressChange = async (newAddress) => {
    setFormData({ ...formData, address: newAddress });
    
    // Auto-trigger lookup for NYC addresses
    const parsed = parseAddress(newAddress);
    if (parsed.city || parsed.state || parsed.zip) {
      setFormData(prev => ({
        ...prev,
        city: parsed.city || prev.city,
        state: parsed.state || prev.state,
        zip_code: parsed.zip || prev.zip_code,
      }));
    }

    if (newAddress && newAddress.length > 10 && (parsed.state === 'NY' || formData.state === 'NY' || !formData.state)) {
      setIsAutoLookingUp(true);
      try {
        const response = await compliant.integrations.Core.InvokeLLM({
          prompt: `Extract NYC property data for: "${newAddress}"

STEP 1: NYC ACRIS (https://a836-acris.nyc.gov/)
- Search by address: "${newAddress}"
- Use MOST RECENT deed (Document Type = "DEED")
- Extract: Block (5 digits), Lot (4 digits), PARTY 2 name (owner)

STEP 2: NYC ACRIS adjacent owners
- For each neighboring lot that PHYSICALLY TOUCHES this property
- Get the deed owner name
- Return 3-8 adjacent property owners

STEP 3: NYC DOB NOW permits (https://a810-dobnow.nyc.gov/)
- Search: "${newAddress}" or the BBL from STEP 1
- Find MOST RECENT GC permit (NB/ALT1/ALT2 with General Contractor) and return:
  * unit_count
  * height_stories
  * project_type / description
  * job_type (NB/ALT1/ALT2)
  * structure_material if visible (concrete/steel/wood/masonry/frame)

Return actual data only. If not found, return null.`,
          add_context_from_internet: true,
          response_json_schema: {
            type: "object",
            properties: {
              block_number: { type: "string" },
              lot_number: { type: "string" },
              owner_entity: { type: "string" },
              additional_insured_entities: { type: "array", items: { type: "string" } },
              unit_count: { type: "number" },
              height_stories: { type: "number" },
              project_type: { type: "string" },
              city: { type: "string" },
              zip_code: { type: "string" }
            }
          }
        });

        if (response && response.owner_entity) {
          setFormData(prev => ({
            ...prev,
            address: newAddress,
            owner_entity: response.owner_entity || prev.owner_entity,
            additional_insured_entities: response.additional_insured_entities?.join(', ') || prev.additional_insured_entities,
            city: response.city || prev.city || 'New York',
            state: 'NY',
            zip_code: response.zip_code || prev.zip_code,
            building_height: response.height_stories || prev.building_height,
            unit_count: response.unit_count || prev.unit_count,
            structure_type: response.height_stories > 12 ? 'high_rise' : response.height_stories > 6 ? 'mid_rise' : 'low_rise',
            project_type: response.project_type || prev.project_type,
          }));
        }
      } catch (err) {
        console.error('Auto-lookup failed:', err);
      } finally {
        setIsAutoLookingUp(false);
      }
    }
  };

  function parseAddress(address) {
    if (!address) return {};
    const parts = address.split(',').map(p => p.trim()).filter(Boolean);
    let city = '', state = '', zip = '';
    const last = parts[parts.length - 1] || '';
    const stateZipMatch = last.match(/([A-Z]{2})\s*(\d{5})?/i);
    if (stateZipMatch) {
      state = stateZipMatch[1].toUpperCase();
      zip = stateZipMatch[2] || '';
      city = parts[parts.length - 2] || '';
    }
    return { city, state, zip };
  }

  const openDialog = (project = null) => {
    if (project) {
      setEditingProject(project);
      setFormData({
        project_name: project.project_name || '',
        project_type: project.project_type || '',
        address: project.address || '',
        city: project.city || '',
        state: project.state || '',
        zip_code: project.zip_code || '',
        building_height: project.building_height || '',
        unit_count: project.unit_count || '',
        owner_entity: project.owner_entity || '',
        additional_insured_entities: Array.isArray(project.additional_insured_entities)
          ? project.additional_insured_entities.join(', ')
          : (project.additional_insured_entities || ''),
        start_date: project.start_date || '',
        estimated_completion: project.estimated_completion || '',
        budget: project.budget || '',
        program_id: project.program_id || '',
        notes: project.notes || '',
      });
    } else {
      resetForm();
    }
    setIsDialogOpen(true);
  };

  const closeDialog = () => {
    setIsDialogOpen(false);
    setEditingProject(null);
    resetForm();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    const data = {
      ...formData,
      gc_id: gcId,
      gc_name: gc?.company_name,
      gc_email: gc?.email,
      gc_address: gc?.address,
      building_height: formData.building_height ? Number(formData.building_height) : undefined,
      unit_count: formData.unit_count ? Number(formData.unit_count) : undefined,
      additional_insured_entities: formData.additional_insured_entities
        .split(',')
        .map(e => e.trim())
        .filter(e => e),
      status: 'active',
      needs_admin_setup: !formData.program_id, // Mark for setup if no program selected
    };

    if (editingProject) {
      await updateProjectMutation.mutateAsync({ id: editingProject.id, data });
    } else {
      const created = await createProjectMutation.mutateAsync(data);
      try {
        await notifyGCProjectCreated({
          ...data,
          id: created.id,
        });
      } catch (err) {
        console.warn('Failed to send GC project created email', err);
      }
    }
  };

  const handleArchiveProject = async (project) => {
    const reason = prompt(`Archive ${project.project_name}?\n\nPlease provide a reason (e.g., "Project completed", "Cancelled"):`);
    
    if (reason === null) {
      // User cancelled
      return;
    }
    
    if (!reason.trim()) {
      toast.error('Please provide a reason for archiving');
      return;
    }
    
    await archiveProjectMutation.mutateAsync({ 
      id: project.id, 
      reason: reason.trim() 
    });
  };

  if (!gcId || !gc) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-4 md:p-8">
        <Card className="max-w-md w-full mx-auto">
          <CardContent className="p-8 text-center">
            <p className="text-slate-600 mb-4">GC not found</p>
            {/* GC portal should not navigate to admin contractors */}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
                onClick={() => navigate(`/gc-details?id=${gcId}`)}
              className="p-2 hover:bg-white rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-slate-600" />
            </button>
            <div>
              <h1 className="text-3xl font-bold text-slate-900 mb-2">
                {gc.company_name} - Projects
              </h1>
              <p className="text-slate-600">Create and manage construction projects</p>
            </div>
          </div>
          <Button
            onClick={() => openDialog()}
            className="bg-red-600 hover:bg-red-700 shadow-lg"
          >
            <Plus className="w-4 h-4 mr-2" />
            New Project
          </Button>
        </div>

        {/* Projects List */}
        <Card className="border-slate-200 shadow-lg">
          <CardHeader className="border-b border-slate-200">
            <CardTitle className="text-xl font-bold">Projects</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {projects.length === 0 ? (
              <div className="p-12 text-center">
                <FolderOpen className="w-16 h-16 mx-auto text-slate-300 mb-4" />
                <h3 className="text-xl font-semibold mb-2">No Projects Yet</h3>
                <p className="text-slate-600 mb-6">Create your first project to get started</p>
                <Button onClick={() => openDialog()} className="bg-red-600 hover:bg-red-700">
                  <Plus className="w-4 h-4 mr-2" />
                  Create Project
                </Button>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50">
                    <TableHead>Project Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Program</TableHead>
                    <TableHead>Subs</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {projects.map((project) => (
                    <TableRow key={project.id} className="hover:bg-slate-50">
                      <TableCell className="font-medium">{project.project_name}</TableCell>
                      <TableCell>{project.project_type}</TableCell>
                      <TableCell>
                        {project.city}, {project.state}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="bg-purple-50 text-purple-700">
                          {programs.find(p => p.id === project.program_id)?.name || 'Not Set'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {allProjectSubs.filter(ps => ps.project_id === project.id).length}
                      </TableCell>
                      <TableCell>
                        <Badge
                          className={
                            project.status === 'active'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : 'bg-slate-50 text-slate-700 border-slate-200'
                          }
                          variant="outline"
                        >
                          {project.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <button
                            onClick={() => navigate(`/project-details?id=${project.id}`)}
                            className="p-2 hover:bg-red-100 rounded-lg transition-colors text-red-600"
                          >
                            View
                          </button>
                          <button
                            onClick={() => openDialog(project)}
                            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                          >
                            <Pencil className="w-4 h-4 text-slate-600" />
                          </button>
                          {(user?.role === 'super_admin' || user?.role === 'admin') && (
                            <button
                              onClick={() => handleArchiveProject(project)}
                              className="p-2 hover:bg-amber-100 rounded-lg transition-colors text-amber-600"
                              title="Archive project"
                            >
                              <Archive className="w-4 h-4" />
                            </button>
                          )}
                          <button
                            onClick={() => {
                              if (window.confirm('Delete this project?')) {
                                deleteProjectMutation.mutate(project.id);
                              }
                            }}
                            className="p-2 hover:bg-red-100 rounded-lg transition-colors text-red-600"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Create/Edit Project Dialog */}
        {isDialogOpen && (
          <div className="fixed inset-0 z-[99999] bg-black/50 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
              <div className="flex items-center justify-between mb-6 px-6 pt-6">
                <h2 className="text-xl font-bold text-slate-900">
                  {editingProject ? 'Edit Project' : 'Create New Project'}
                </h2>
                <button
                  onClick={closeDialog}
                  className="text-slate-500 hover:text-slate-700 text-2xl leading-none"
                >
                  ×
                </button>
              </div>

              <form onSubmit={handleSubmit} className="flex flex-col flex-1">
                <div className="space-y-4 py-4 px-6 overflow-y-auto flex-1">
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="project_name">
                        Project Name <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        id="project_name"
                        value={formData.project_name}
                        onChange={(e) => setFormData({ ...formData, project_name: e.target.value })}
                        placeholder="Hudson Yards Tower B"
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="project_type">
                        Project Type <span className="text-red-500">*</span>
                      </Label>
                      <Select
                        value={formData.project_type}
                        onValueChange={(value) => setFormData({ ...formData, project_type: value })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="commercial">Commercial</SelectItem>
                          <SelectItem value="residential">Residential</SelectItem>
                          <SelectItem value="mixed_use">Mixed Use</SelectItem>
                          <SelectItem value="industrial">Industrial</SelectItem>
                          <SelectItem value="infrastructure">Infrastructure</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="building_height">Building Height (stories)</Label>
                      <Input
                        id="building_height"
                        type="number"
                        min="0"
                        value={formData.building_height}
                        onChange={(e) => setFormData({ ...formData, building_height: e.target.value })}
                        placeholder="e.g., 12"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="unit_count">Unit Count</Label>
                      <Input
                        id="unit_count"
                        type="number"
                        min="0"
                        value={formData.unit_count}
                        onChange={(e) => setFormData({ ...formData, unit_count: e.target.value })}
                        placeholder="e.g., 240"
                      />
                    </div>
                  </div>

                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="structure_type">Structure Type</Label>
                      <Select
                        value={formData.structure_type}
                        onValueChange={(value) => setFormData({ ...formData, structure_type: value })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select structure type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="concrete">Concrete</SelectItem>
                          <SelectItem value="steel">Steel</SelectItem>
                          <SelectItem value="wood">Wood</SelectItem>
                          <SelectItem value="masonry">Masonry</SelectItem>
                          <SelectItem value="frame">Frame</SelectItem>
                          <SelectItem value="other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="tenancy_type">Condos or Rentals</Label>
                      <Select
                        value={formData.tenancy_type}
                        onValueChange={(value) => setFormData({ ...formData, tenancy_type: value })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select occupancy" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="condos">Condos</SelectItem>
                          <SelectItem value="rentals">Rentals</SelectItem>
                          <SelectItem value="mixed">Mixed</SelectItem>
                          <SelectItem value="n/a">N/A</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="address">
                      Street Address <span className="text-red-500">*</span>
                    </Label>
                    <div className="relative">
                      <Input
                        id="address"
                        value={formData.address}
                        onChange={(e) => handleAddressChange(e.target.value)}
                        placeholder="123 Business Ave"
                        required
                      />
                      {isAutoLookingUp && (
                        <div className="absolute right-3 top-1/2 -translate-y-1/2">
                          <div className="animate-spin w-4 h-4 border-2 border-red-600 border-t-transparent rounded-full"></div>
                        </div>
                      )}
                    </div>
                    {formData.state === 'NY' && (
                      <p className="text-xs text-red-600">
                        ✓ Auto-loading owner & neighbors from NYC property records
                      </p>
                    )}
                  </div>

                  <div className="grid md:grid-cols-4 gap-4">
                    <div className="space-y-2 md:col-span-2">
                      <Label htmlFor="city">City</Label>
                      <Input
                        id="city"
                        value={formData.city}
                        onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                        placeholder="New York"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="state">State</Label>
                      <Select
                        value={formData.state}
                        onValueChange={(value) => setFormData({ ...formData, state: value })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="State" />
                        </SelectTrigger>
                        <SelectContent className="max-h-60">
                          {US_STATES.map((state) => (
                            <SelectItem key={state.code} value={state.code}>
                              {state.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="zip_code">ZIP Code</Label>
                      <Input
                        id="zip_code"
                        value={formData.zip_code}
                        onChange={(e) => setFormData({ ...formData, zip_code: e.target.value })}
                        placeholder="10001"
                      />
                    </div>
                  </div>

                  <div className="space-y-2 border-t pt-4">
                    <Label htmlFor="owner_entity">Property Owner Entity</Label>
                    <Input
                      id="owner_entity"
                      value={formData.owner_entity}
                      onChange={(e) => setFormData({ ...formData, owner_entity: e.target.value })}
                      placeholder="e.g., Hudson Yards Development LLC"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="additional_insured">Additional Insured Entities</Label>
                    <Textarea
                      id="additional_insured"
                      value={formData.additional_insured_entities}
                      onChange={(e) => setFormData({ ...formData, additional_insured_entities: e.target.value })}
                      placeholder="Comma-separated list: Hudson Yards Property LLC, Related Companies, etc."
                      rows={2}
                    />
                    <p className="text-xs text-slate-500">Comma-separated list of entities that must be additional insured</p>
                  </div>

                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="start_date">Start Date</Label>
                      <Input
                        id="start_date"
                        type="date"
                        value={formData.start_date}
                        onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="estimated_completion">Estimated Completion</Label>
                      <Input
                        id="estimated_completion"
                        type="date"
                        value={formData.estimated_completion}
                        onChange={(e) => setFormData({ ...formData, estimated_completion: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="budget">Budget</Label>
                    <Input
                      id="budget"
                      type="number"
                      value={formData.budget}
                      onChange={(e) => setFormData({ ...formData, budget: e.target.value })}
                      placeholder="50000000"
                    />
                  </div>

                  <div className="space-y-2 border-t pt-4">
                    <Label htmlFor="program_id">
                      Insurance Program <span className="text-amber-500">*</span>
                    </Label>
                    <Select
                      value={formData.program_id}
                      onValueChange={(value) => setFormData({ ...formData, program_id: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select insurance program" />
                      </SelectTrigger>
                      <SelectContent>
                        {programs.map((program) => (
                          <SelectItem key={program.id} value={program.id}>
                            {program.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-slate-500">
                      {!formData.program_id ? '⚠️ No program selected - project will need admin setup' : '✓ Program selected'}
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="notes">Notes</Label>
                    <Textarea
                      id="notes"
                      value={formData.notes}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                      placeholder="Additional notes about this project"
                      rows={2}
                    />
                  </div>
                </div>

                <div className="flex gap-2 px-6 py-6 border-t bg-slate-50 rounded-b-lg">
                  <Button type="button" variant="outline" onClick={closeDialog}>
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    className="bg-red-600 hover:bg-red-700"
                    disabled={createProjectMutation.isPending || updateProjectMutation.isPending}
                  >
                    {editingProject ? 'Update' : 'Create'} Project
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
