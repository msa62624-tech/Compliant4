import { useState } from "react";
import { compliant } from "@/api/compliantClient";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Building2,
  Mail,
  Phone,
  MapPin,
  FolderOpen,
  Users,
  Pencil,
  DollarSign,
  CreditCard,
  Plus,
  Trash2,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import StatsCard from "@/components/insurance/StatsCard";
import AddressAutocomplete from "@/components/AddressAutocomplete.jsx";
import ZipCodeLookup from "@/components/ZipCodeLookup.jsx";

const US_STATES = [
  { code: 'AL', name: 'Alabama' }, { code: 'AK', name: 'Alaska' }, { code: 'AZ', name: 'Arizona' },
  { code: 'AR', name: 'Arkansas' }, { code: 'CA', name: 'California' }, { code: 'CO', name: 'Colorado' },
  { code: 'CT', name: 'Connecticut' }, { code: 'DE', name: 'Delaware' }, { code: 'FL', name: 'Florida' },
  { code: 'GA', name: 'Georgia' }, { code: 'HI', name: 'Hawaii' }, { code: 'ID', name: 'Idaho' },
  { code: 'IL', name: 'Illinois' }, { code: 'IN', name: 'Indiana' }, { code: 'IA', name: 'Iowa' },
  { code: 'KS', name: 'Kansas' }, { code: 'KY', name: 'Kentucky' }, { code: 'LA', name: 'Louisiana' },
  { code: 'ME', name: 'Maine' }, { code: 'MD', name: 'Maryland' }, { code: 'MA', name: 'Massachusetts' },
  { code: 'MI', name: 'Michigan' }, { code: 'MN', name: 'Minnesota' }, { code: 'MS', name: 'Mississippi' },
  { code: 'MO', name: 'Missouri' }, { code: 'MT', name: 'Montana' }, { code: 'NE', name: 'Nebraska' },
  { code: 'NV', name: 'Nevada' }, { code: 'NH', name: 'New Hampshire' }, { code: 'NJ', name: 'New Jersey' },
  { code: 'NM', name: 'New Mexico' }, { code: 'NY', name: 'New York' }, { code: 'NC', name: 'North Carolina' },
  { code: 'ND', name: 'North Dakota' }, { code: 'OH', name: 'Ohio' }, { code: 'OK', name: 'Oklahoma' },
  { code: 'OR', name: 'Oregon' }, { code: 'PA', name: 'Pennsylvania' }, { code: 'RI', name: 'Rhode Island' },
  { code: 'SC', name: 'South Carolina' }, { code: 'SD', name: 'South Dakota' }, { code: 'TN', name: 'Tennessee' },
  { code: 'TX', name: 'Texas' }, { code: 'UT', name: 'Utah' }, { code: 'VT', name: 'Vermont' },
  { code: 'VA', name: 'Virginia' }, { code: 'WA', name: 'Washington' }, { code: 'WV', name: 'West Virginia' },
  { code: 'WI', name: 'Wisconsin' }, { code: 'WY', name: 'Wyoming' }
];

export default function GCDetails() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const urlParams = new URLSearchParams(window.location.search);
  const gcId = urlParams.get('id');

  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isPricingDialogOpen, setIsPricingDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    company_name: '',
    contact_person: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    state: '',
    zip_code: '',
    mailing_address: '',
    additional_contacts: [],
    license_number: '',
    status: 'active',
  });
  const [pricingData, setPricingData] = useState({
    per_project: '',
    monthly: '',
    annual: '',
    notes: '',
  });

  const { data: contractor, isLoading } = useQuery({
    queryKey: ['contractor', gcId],
    queryFn: async () => {
      const contractors = await compliant.entities.Contractor.list();
      return contractors.find(c => c.id === gcId);
    },
    enabled: !!gcId,
  });

  const { data: projects = [] } = useQuery({
    queryKey: ['gc-projects', gcId],
    queryFn: () => compliant.entities.Project.filter({ gc_id: gcId }, '-created_date'),
    enabled: !!gcId,
  });

  const { data: projectSubs = [] } = useQuery({
    queryKey: ['project-subs'],
    queryFn: () => compliant.entities.ProjectSubcontractor.list(),
  });

  const updateContractorMutation = useMutation({
    mutationFn: ({ id, data }) => compliant.entities.Contractor.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['contractor', gcId]);
      queryClient.invalidateQueries(['contractors']);
      setIsEditDialogOpen(false);
      setIsPricingDialogOpen(false);
    },
  });

  const openEditDialog = () => {
    setFormData({
      company_name: contractor.company_name || '',
      contact_person: contractor.contact_person || '',
      email: contractor.email || '',
      phone: contractor.phone || '',
      address: contractor.address || '',
      city: contractor.city || '',
      state: contractor.state || '',
      zip_code: contractor.zip_code || '',
      mailing_address: contractor.mailing_address || '',
      additional_contacts: contractor.additional_contacts || [],
      license_number: contractor.license_number || '',
      status: contractor.status || 'active',
    });
    setIsEditDialogOpen(true);
  };

  const openPricingDialog = () => {
    setPricingData({
      per_project: contractor.custom_pricing?.per_project || '',
      monthly: contractor.custom_pricing?.monthly || '',
      annual: contractor.custom_pricing?.annual || '',
      notes: contractor.custom_pricing?.notes || '',
    });
    setIsPricingDialogOpen(true);
  };

  const handleAddressSelect = (addressData) => {
    setFormData({
      ...formData,
      address: addressData.address,
      city: addressData.city,
      state: addressData.state,
      zip_code: addressData.zip_code,
    });
  };

  const handleZipCityStateFound = (city, state) => {
    setFormData((prev) => ({
      ...prev,
      city: city || prev.city,
      state: state || prev.state,
    }));
  };

  const handleAddContact = () => {
    setFormData({
      ...formData,
      additional_contacts: [
        ...formData.additional_contacts,
        { name: '', email: '', phone: '', position: '', receive_emails: false }
      ]
    });
  };

  const handleRemoveContact = (index) => {
    setFormData({
      ...formData,
      additional_contacts: formData.additional_contacts.filter((_, i) => i !== index)
    });
  };

  const handleContactChange = (index, field, value) => {
    const newContacts = [...formData.additional_contacts];
    newContacts[index] = { ...newContacts[index], [field]: value };
    setFormData({ ...formData, additional_contacts: newContacts });
  };

  const handleUpdateInfo = async (e) => {
    e.preventDefault();
    await updateContractorMutation.mutateAsync({
      id: gcId,
      data: formData,
    });
  };

  const handleUpdatePricing = async (e) => {
    e.preventDefault();
    await updateContractorMutation.mutateAsync({
      id: gcId,
      data: {
        custom_pricing: {
          per_project: pricingData.per_project ? parseFloat(pricingData.per_project) : null,
          monthly: pricingData.monthly ? parseFloat(pricingData.monthly) : null,
          annual: pricingData.annual ? parseFloat(pricingData.annual) : null,
          notes: pricingData.notes,
        },
      },
    });
  };

  if (!gcId) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-8 flex items-center justify-center">
        <Card>
          <CardContent className="p-8 text-center">
            <p className="text-slate-600 mb-4">No contractor ID provided</p>
            {/* GC portal should not navigate to admin contractors */}
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-8">
        <div className="max-w-7xl mx-auto space-y-6">
          <Skeleton className="h-12 w-64" />
          <div className="grid md:grid-cols-3 gap-6">
            {Array(3).fill(0).map((_, i) => (
              <Skeleton key={i} className="h-32" />
            ))}
          </div>
          <Skeleton className="h-96" />
        </div>
      </div>
    );
  }

  if (!contractor) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-8 flex items-center justify-center">
        <Card>
          <CardContent className="p-8 text-center">
            <p className="text-slate-600 mb-4">Contractor not found</p>
            {/* GC portal should not navigate to admin contractors */}
          </CardContent>
        </Card>
      </div>
    );
  }

  const gcProjects = projectSubs.filter(ps => projects.some(p => p.id === ps.project_id));
  const hasCustomPricing = contractor.custom_pricing && 
    (contractor.custom_pricing.per_project || contractor.custom_pricing.monthly || contractor.custom_pricing.annual);

  const stats = {
    totalProjects: projects.length,
    activeProjects: projects.filter(p => p.status === 'active').length,
    totalSubs: gcProjects.length,
    compliantSubs: gcProjects.filter(ps => ps.compliance_status === 'compliant').length,
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center gap-4 mb-6">
          {/* Removed admin navigation from GC view */}
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <Building2 className="w-8 h-8 text-red-600" />
              <h1 className="text-3xl font-bold text-slate-900">{contractor.company_name}</h1>
              <Badge
                variant="outline"
                className={
                  contractor.status === 'active'
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : 'bg-amber-50 text-amber-700 border-amber-200'
                }
              >
                {contractor.status}
              </Badge>
            </div>
            <p className="text-slate-600">General Contractor Details</p>
          </div>
          <Button onClick={openEditDialog} className="bg-red-600 hover:bg-red-700">
            <Pencil className="w-4 h-4 mr-2" />
            Edit Info
          </Button>
        </div>

        <div className="grid md:grid-cols-4 gap-6">
          <StatsCard
            title="Total Projects"
            value={stats.totalProjects}
            icon={FolderOpen}
            color="blue"
          />
          <StatsCard
            title="Active Projects"
            value={stats.activeProjects}
            icon={FolderOpen}
            color="green"
          />
          <StatsCard
            title="Subcontractors"
            value={stats.totalSubs}
            icon={Users}
            color="amber"
          />
          <StatsCard
            title="Compliant"
            value={stats.compliantSubs}
            icon={Users}
            color="green"
          />
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <Card className="border-slate-200 shadow-lg">
            <CardHeader className="border-b border-slate-200">
              <CardTitle className="text-xl font-bold text-slate-900">
                Contact Information
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              <div className="flex items-start gap-3">
                <Users className="w-5 h-5 text-slate-400 mt-0.5" />
                <div>
                  <p className="text-sm text-slate-500">Primary Contact</p>
                  <p className="font-medium text-slate-900">{contractor.contact_person}</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Mail className="w-5 h-5 text-slate-400 mt-0.5" />
                <div>
                  <p className="text-sm text-slate-500">Email</p>
                  <p className="font-medium text-slate-900">{contractor.email}</p>
                </div>
              </div>

              {contractor.phone && (
                <div className="flex items-start gap-3">
                  <Phone className="w-5 h-5 text-slate-400 mt-0.5" />
                  <div>
                    <p className="text-sm text-slate-500">Phone</p>
                    <p className="font-medium text-slate-900">{contractor.phone}</p>
                  </div>
                </div>
              )}

              {contractor.address && (
                <div className="flex items-start gap-3">
                  <MapPin className="w-5 h-5 text-slate-400 mt-0.5" />
                  <div>
                    <p className="text-sm text-slate-500">Business Address</p>
                    <p className="font-medium text-slate-900">
                      {[contractor.address, contractor.city, contractor.state, contractor.zip_code]
                        .filter(Boolean)
                        .join(', ')}
                    </p>
                  </div>
                </div>
              )}

              {contractor.mailing_address && (
                <div className="flex items-start gap-3">
                  <Mail className="w-5 h-5 text-slate-400 mt-0.5" />
                  <div>
                    <p className="text-sm text-slate-500">Mailing Address</p>
                    <p className="font-medium text-slate-900">{contractor.mailing_address}</p>
                  </div>
                </div>
              )}

              {contractor.license_number && (
                <div className="flex items-start gap-3">
                  <CreditCard className="w-5 h-5 text-slate-400 mt-0.5" />
                  <div>
                    <p className="text-sm text-slate-500">License Number</p>
                    <p className="font-medium text-slate-900 font-mono">{contractor.license_number}</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-slate-200 shadow-lg">
            <CardHeader className="border-b border-slate-200">
              <div className="flex items-center justify-between">
                <CardTitle className="text-xl font-bold text-slate-900">
                  Pricing
                </CardTitle>
                <Button size="sm" variant="outline" onClick={openPricingDialog}>
                  <Pencil className="w-3 h-3 mr-1" />
                  Edit
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-6">
              {hasCustomPricing ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 mb-4">
                    <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200">
                      Custom Pricing Active
                    </Badge>
                  </div>
                  {contractor.custom_pricing.per_project && (
                    <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                      <span className="text-slate-600">Per Project</span>
                      <span className="text-lg font-bold text-slate-900">
                        ${contractor.custom_pricing.per_project.toLocaleString()}
                      </span>
                    </div>
                  )}
                  {contractor.custom_pricing.monthly && (
                    <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                      <span className="text-slate-600">Monthly</span>
                      <span className="text-lg font-bold text-slate-900">
                        ${contractor.custom_pricing.monthly.toLocaleString()}/mo
                      </span>
                    </div>
                  )}
                  {contractor.custom_pricing.annual && (
                    <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                      <span className="text-slate-600">Annual</span>
                      <span className="text-lg font-bold text-slate-900">
                        ${contractor.custom_pricing.annual.toLocaleString()}/yr
                      </span>
                    </div>
                  )}
                  {contractor.custom_pricing.notes && (
                    <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                      <p className="text-sm text-red-900">{contractor.custom_pricing.notes}</p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-8">
                  <DollarSign className="w-12 h-12 mx-auto text-slate-300 mb-3" />
                  <p className="text-slate-600 mb-4">Using standard pricing</p>
                  <Button size="sm" onClick={openPricingDialog}>
                    Set Custom Pricing
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {contractor.additional_contacts && contractor.additional_contacts.length > 0 && (
          <Card className="border-slate-200 shadow-lg">
            <CardHeader className="border-b border-slate-200">
              <CardTitle className="text-xl font-bold text-slate-900">
                Additional Contacts
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="grid md:grid-cols-2 gap-4">
                {contractor.additional_contacts.map((contact, idx) => (
                  <div key={idx} className="p-4 bg-slate-50 rounded-lg border">
                    <div className="flex items-start justify-between mb-2">
                      <h4 className="font-semibold text-slate-900">{contact.name}</h4>
                      {contact.receive_emails && (
                        <Badge variant="outline" className="bg-red-50 text-red-700 text-xs">
                          Email Notifications
                        </Badge>
                      )}
                    </div>
                    {contact.position && (
                      <p className="text-sm text-slate-500 mb-2">{contact.position}</p>
                    )}
                    {contact.email && (
                      <p className="text-sm text-slate-700 flex items-center gap-1">
                        <Mail className="w-3 h-3" /> {contact.email}
                      </p>
                    )}
                    {contact.phone && (
                      <p className="text-sm text-slate-700 flex items-center gap-1">
                        <Phone className="w-3 h-3" /> {contact.phone}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <Card className="border-slate-200 shadow-lg">
          <CardHeader className="border-b border-slate-200">
            <div className="flex items-center justify-between">
              <CardTitle className="text-xl font-bold text-slate-900">
                Projects ({projects.length})
              </CardTitle>
              <Button 
                onClick={() => navigate(createPageUrl("GCProjects") + `?id=${gcId}`)}
                className="bg-red-600 hover:bg-red-700"
                size="sm"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Project
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {projects.length === 0 ? (
              <div className="p-12 text-center">
                <FolderOpen className="w-16 h-16 mx-auto text-slate-300 mb-4" />
                <p className="text-slate-600">No projects yet</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50">
                    <TableHead className="font-semibold">Project Name</TableHead>
                    <TableHead className="font-semibold">Address</TableHead>
                    <TableHead className="font-semibold">Status</TableHead>
                    <TableHead className="font-semibold">Subs</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {projects.map((project) => {
                    const subCount = projectSubs.filter(ps => ps.project_id === project.id).length;
                    return (
                      <TableRow
                        key={project.id}
                        className="hover:bg-slate-50 cursor-pointer"
                        onClick={() => navigate(createPageUrl(`ProjectDetails?id=${project.id}`))}
                      >
                        <TableCell className="font-medium text-slate-900">
                          {project.project_name}
                        </TableCell>
                        <TableCell className="text-slate-600">
                          {[project.city, project.state].filter(Boolean).join(', ') || '-'}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={
                              project.status === 'active'
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : 'bg-red-50 text-red-700 border-red-200'
                            }
                          >
                            {project.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="bg-purple-50 text-purple-700">
                            {subCount}
                          </Badge>
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

      {/* Edit Info Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">
              Edit General Contractor Information
            </DialogTitle>
            <DialogDescription>
              Update the GC contact and company details for this project.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleUpdateInfo}>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="company_name">Company Name</Label>
                <Input
                  id="company_name"
                  value={formData.company_name}
                  onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="contact_person">Primary Contact Person</Label>
                <Input
                  id="contact_person"
                  value={formData.contact_person}
                  onChange={(e) => setFormData({ ...formData, contact_person: e.target.value })}
                  required
                />
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone">Phone</Label>
                  <Input
                    id="phone"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-2 border-t pt-4">
                <Label className="text-base font-semibold">Business Address</Label>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="address">Street Address</Label>
                    <AddressAutocomplete
                      value={formData.address}
                      onChange={(value) => setFormData({ ...formData, address: value })}
                      onAddressSelect={handleAddressSelect}
                    />
                  </div>

                  <div className="grid md:grid-cols-4 gap-4">
                    <div className="space-y-2 md:col-span-2">
                      <Label htmlFor="city">City</Label>
                      <Input
                        id="city"
                        value={formData.city}
                        onChange={(e) => setFormData({ ...formData, city: e.target.value })}
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
                      <ZipCodeLookup
                        value={formData.zip_code}
                        onChange={(value) => setFormData({ ...formData, zip_code: value })}
                        onCityStateFound={handleZipCityStateFound}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="mailing_address">Mailing Address (if different)</Label>
                <Input
                  id="mailing_address"
                  value={formData.mailing_address}
                  onChange={(e) => setFormData({ ...formData, mailing_address: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="license_number">License Number</Label>
                <Input
                  id="license_number"
                  value={formData.license_number}
                  onChange={(e) => setFormData({ ...formData, license_number: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Select
                  value={formData.status}
                  onValueChange={(value) => setFormData({ ...formData, status: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="suspended">Suspended</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Additional Contacts Section */}
              <div className="space-y-3 border-t pt-4">
                <div className="flex items-center justify-between">
                  <Label className="text-base font-semibold">Additional Contacts</Label>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={handleAddContact}
                    className="text-red-600"
                  >
                    <Plus className="w-3 h-3 mr-1" />
                    Add Contact
                  </Button>
                </div>
                
                {formData.additional_contacts.length === 0 ? (
                  <p className="text-sm text-slate-500 italic py-4">No additional contacts</p>
                ) : (
                  <div className="space-y-4">
                    {formData.additional_contacts.map((contact, index) => (
                      <div key={contact.email || `contact-${index}-${contact.name}`} className="p-4 bg-slate-50 rounded-lg border space-y-3">
                        <div className="flex items-center justify-between">
                          <Label className="text-sm font-medium">Contact {index + 1}</Label>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => handleRemoveContact(index)}
                            className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                        <div className="grid md:grid-cols-2 gap-3">
                          <Input
                            placeholder="Name"
                            value={contact.name}
                            onChange={(e) => handleContactChange(index, 'name', e.target.value)}
                          />
                          <Input
                            placeholder="Position"
                            value={contact.position}
                            onChange={(e) => handleContactChange(index, 'position', e.target.value)}
                          />
                          <Input
                            type="email"
                            placeholder="Email"
                            value={contact.email}
                            onChange={(e) => handleContactChange(index, 'email', e.target.value)}
                          />
                          <Input
                            placeholder="Phone"
                            value={contact.phone}
                            onChange={(e) => handleContactChange(index, 'phone', e.target.value)}
                          />
                        </div>
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            id={`receive-emails-${index}`}
                            checked={contact.receive_emails}
                            onChange={(e) => handleContactChange(index, 'receive_emails', e.target.checked)}
                            className="w-4 h-4 text-red-600 border-slate-300 rounded focus:ring-red-500"
                          />
                          <Label htmlFor={`receive-emails-${index}`} className="text-sm cursor-pointer">
                            Send email notifications to this contact
                          </Label>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <DialogFooter className="gap-2">
              <Button type="button" variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                type="submit"
                className="bg-red-600 hover:bg-red-700"
                disabled={updateContractorMutation.isPending}
              >
                Save Changes
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Pricing Dialog */}
      <Dialog open={isPricingDialogOpen} onOpenChange={setIsPricingDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">Custom Pricing</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleUpdatePricing}>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="per_project">Per Project Price</Label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input
                    id="per_project"
                    type="number"
                    step="0.01"
                    value={pricingData.per_project}
                    onChange={(e) => setPricingData({ ...pricingData, per_project: e.target.value })}
                    className="pl-9"
                    placeholder="299.00"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="monthly">Monthly Price</Label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input
                    id="monthly"
                    type="number"
                    step="0.01"
                    value={pricingData.monthly}
                    onChange={(e) => setPricingData({ ...pricingData, monthly: e.target.value })}
                    className="pl-9"
                    placeholder="999.00"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="annual">Annual Price</Label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input
                    id="annual"
                    type="number"
                    step="0.01"
                    value={pricingData.annual}
                    onChange={(e) => setPricingData({ ...pricingData, annual: e.target.value })}
                    className="pl-9"
                    placeholder="9999.00"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <Input
                  id="notes"
                  value={pricingData.notes}
                  onChange={(e) => setPricingData({ ...pricingData, notes: e.target.value })}
                  placeholder="Pricing details..."
                />
              </div>

              <p className="text-xs text-slate-500">
                Leave fields empty to use standard pricing. Custom pricing will override defaults.
              </p>
            </div>

            <DialogFooter className="gap-2">
              <Button type="button" variant="outline" onClick={() => setIsPricingDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                type="submit"
                className="bg-red-600 hover:bg-red-700"
                disabled={updateContractorMutation.isPending}
              >
                Save Pricing
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}