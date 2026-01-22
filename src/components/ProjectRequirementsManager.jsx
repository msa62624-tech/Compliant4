import { useState } from "react";
import { apiClient } from "@/api/apiClient";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  FileText, Upload, Eye, Trash2, Plus, AlertTriangle,
 Clock, Zap
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/**
 * ProjectRequirementsManager Component
 * Allows admins to upload and manage project requirement documents
 * Documents are tiered by trade and used for compliance validation
 */
export default function ProjectRequirementsManager({ projectId, projectName: _projectName }) {
  const queryClient = useQueryClient();
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [selectedTier, setSelectedTier] = useState(null);
  const [selectedTrades, setSelectedTrades] = useState([]);
  const [documentName, setDocumentName] = useState('');
  const [documentDescription, setDocumentDescription] = useState('');
  const [uploadingFile, setUploadingFile] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);

  // Fetch project requirements
  const { data: requirements = [], isLoading: _isLoading } = useQuery({
    queryKey: ['projectRequirements', projectId],
    queryFn: async () => {
      if (!projectId) return [];
      const allRequirements = await apiClient.entities.ProjectInsuranceRequirement.filter({
        project_id: projectId,
      });
      return allRequirements;
    },
  });

  // Upload requirements document mutation
  const uploadMutation = useMutation({
    mutationFn: async (data) => {
      const newReq = await apiClient.entities.ProjectInsuranceRequirement.create({
        project_id: projectId,
        requirement_tier: data.tier,
        applicable_trades: data.trades,
        document_name: data.name,
        document_description: data.description,
        document_url: data.documentUrl,
        document_type: data.documentType,
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
      return newReq;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['projectRequirements', projectId]);
      setUploadDialogOpen(false);
      setDocumentName('');
      setDocumentDescription('');
      setSelectedTier(null);
      setSelectedTrades([]);
      setUploadingFile(null);
    },
  });

  // Delete requirement mutation
  const deleteMutation = useMutation({
    mutationFn: async (requirementId) => {
      await apiClient.entities.ProjectInsuranceRequirement.delete(requirementId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['projectRequirements', projectId]);
    },
  });

  // Handle file upload
  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingFile(file.name);
    setUploadProgress(0);

    try {
      // Simulate file upload with progress
      for (let i = 0; i <= 100; i += 10) {
        setUploadProgress(i);
        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      // Mock document URL (in real app, upload to cloud storage)
      const documentUrl = `https://storage.example.com/requirements/${projectId}/${file.name}`;

      // Submit the requirement
      await uploadMutation.mutateAsync({
        tier: selectedTier,
        trades: selectedTrades,
        name: documentName || file.name,
        description: documentDescription,
        documentUrl,
        documentType: file.type,
      });
    } catch (error) {
      console.error('Error uploading document:', error);
      alert('Failed to upload document');
    } finally {
      setUploadingFile(null);
      setUploadProgress(0);
    }
  };

  // Group requirements by tier
  const requirementsByTier = {
    1: requirements.filter((r) => r.requirement_tier === 1),
    2: requirements.filter((r) => r.requirement_tier === 2),
    3: requirements.filter((r) => r.requirement_tier === 3),
  };

  const getTierLabel = (tier) => {
    const labels = {
      1: 'Tier 1 - General Construction',
      2: 'Tier 2 - Specialty Trades',
      3: 'Tier 3 - High-Risk Trades',
    };
    return labels[tier] || `Tier ${tier}`;
  };

  const getTierColor = (tier) => {
    const colors = { 1: 'bg-red-50', 2: 'bg-amber-50', 3: 'bg-red-50' };
    return colors[tier] || 'bg-gray-50';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Insurance Requirements</h2>
          <p className="text-gray-600">Manage project-specific insurance requirements by trade tier</p>
        </div>
        <Button
          onClick={() => setUploadDialogOpen(true)}
          className="gap-2"
        >
          <Plus className="w-4 h-4" />
          Add Requirement
        </Button>
      </div>

      {/* Info Banner */}
      <Alert className="border-red-200 bg-red-50">
        <Zap className="h-4 w-4 text-red-600" />
        <AlertDescription>
          Upload PDF or document files that detail insurance requirements for each trade tier.
          Subcontractors must meet these requirements in their Certificates of Insurance.
        </AlertDescription>
      </Alert>

      {/* Requirements by Tier */}
      {[1, 2, 3].map((tier) => (
        <Card key={tier} className={getTierColor(tier)}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              {getTierLabel(tier)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {requirementsByTier[tier]?.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <FileText className="w-12 h-12 mx-auto mb-2 opacity-30" />
                <p>No requirements uploaded for this tier</p>
              </div>
            ) : (
              <div className="space-y-4">
                {requirementsByTier[tier].map((req) => (
                  <RequirementCard
                    key={req.id}
                    requirement={req}
                    onDelete={() => deleteMutation.mutate(req.id)}
                    isDeleting={deleteMutation.isPending}
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      ))}

      {/* Upload Dialog */}
      <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Add Insurance Requirement Document</DialogTitle>
            <DialogDescription>
              Upload or update the requirement document for the selected tier and applicable trades.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            {/* Tier Selection */}
            <div>
              <Label htmlFor="tier">Requirement Tier *</Label>
              <Select value={selectedTier?.toString()} onValueChange={(v) => setSelectedTier(parseInt(v))}>
                <SelectTrigger>
                  <SelectValue placeholder="Select trade tier..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">Tier 1 - General Construction (Carpentry, Electrical, Plumbing, HVAC)</SelectItem>
                  <SelectItem value="2">Tier 2 - Specialty Trades (Roofing, Excavation)</SelectItem>
                  <SelectItem value="3">Tier 3 - High-Risk (Crane Operators, Scaffolding)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Trade Selection */}
            <div>
              <Label>Applicable Trades (Optional)</Label>
              <p className="text-sm text-gray-600 mb-2">Leave empty for all trades in this tier</p>
              <div className="grid grid-cols-2 gap-3">
                {getTrades(selectedTier).map((trade) => (
                  <label key={trade} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedTrades.includes(trade)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedTrades([...selectedTrades, trade]);
                        } else {
                          setSelectedTrades(selectedTrades.filter((t) => t !== trade));
                        }
                      }}
                      className="w-4 h-4 rounded"
                    />
                    <span className="text-sm capitalize">{trade.replace('_', ' ')}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Document Name */}
            <div>
              <Label htmlFor="docName">Document Name</Label>
              <Input
                id="docName"
                placeholder="e.g., 'Tier 1 Insurance Requirements'"
                value={documentName}
                onChange={(e) => setDocumentName(e.target.value)}
              />
            </div>

            {/* Document Description */}
            <div>
              <Label htmlFor="docDesc">Description</Label>
              <Textarea
                id="docDesc"
                placeholder="Describe what this document covers..."
                value={documentDescription}
                onChange={(e) => setDocumentDescription(e.target.value)}
                rows={3}
              />
            </div>

            {/* File Upload */}
            <div>
              <Label>Document File *</Label>
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-gray-400 cursor-pointer transition">
                <input
                  type="file"
                  accept=".pdf,.doc,.docx,.txt"
                  onChange={handleFileUpload}
                  disabled={uploadingFile}
                  className="hidden"
                  id="fileInput"
                />
                <label htmlFor="fileInput" className="cursor-pointer block">
                  {uploadingFile ? (
                    <div className="space-y-2">
                      <Clock className="w-8 h-8 mx-auto text-red-600 animate-spin" />
                      <p className="text-sm text-gray-600">{uploadingFile}</p>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-red-600 h-2 rounded-full transition-all"
                          style={{ width: `${uploadProgress}%` }}
                        />
                      </div>
                      <p className="text-xs text-gray-500">{uploadProgress}%</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Upload className="w-8 h-8 mx-auto text-gray-400" />
                      <p className="text-sm text-gray-600">Click to upload PDF or document</p>
                      <p className="text-xs text-gray-500">Max 10MB</p>
                    </div>
                  )}
                </label>
              </div>
            </div>

            {/* Error message if needed */}
            {uploadMutation.error && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>{uploadMutation.error.message}</AlertDescription>
              </Alert>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setUploadDialogOpen(false)}
              disabled={uploadMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (!selectedTier) {
                  alert('Please select a tier');
                  return;
                }
                if (!uploadingFile) {
                  alert('Please upload a file');
                  return;
                }
              }}
              disabled={uploadMutation.isPending}
            >
              {uploadMutation.isPending ? 'Uploading...' : 'Upload'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/**
 * RequirementCard Component - Display individual requirement
 */
function RequirementCard({ requirement, onDelete, isDeleting }) {
  return (
    <div className="flex items-start justify-between p-4 bg-white border border-gray-200 rounded-lg hover:shadow-sm transition">
      <div className="flex-1">
        <div className="flex items-center gap-3 mb-2">
          <FileText className="w-5 h-5 text-gray-600" />
          <h4 className="font-semibold">{requirement.document_name}</h4>
          <Badge variant="outline">{requirement.requirement_tier}</Badge>
          {requirement.is_active && (
            <Badge className="bg-green-100 text-green-800">Active</Badge>
          )}
        </div>

        {requirement.document_description && (
          <p className="text-sm text-gray-600 mb-2">{requirement.document_description}</p>
        )}

        {requirement.applicable_trades?.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-2">
            {requirement.applicable_trades.map((trade) => (
              <Badge key={trade} variant="secondary" className="text-xs">
                {trade.replace('_', ' ')}
              </Badge>
            ))}
          </div>
        )}

        <p className="text-xs text-gray-500">
          Added {new Date(requirement.created_at).toLocaleDateString()}
        </p>
      </div>

      <div className="flex gap-2 ml-4">
        <Button
          variant="outline"
          size="sm"
          onClick={() => window.open(requirement.document_url, '_blank')}
        >
          <Eye className="w-4 h-4" />
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onDelete()}
          disabled={isDeleting}
        >
          <Trash2 className="w-4 h-4 text-red-600" />
        </Button>
      </div>
    </div>
  );
}

/**
 * Helper to get trades for a tier
 */
function getTrades(tier) {
  const tradesByTier = {
    1: ['carpentry', 'electrical', 'plumbing', 'hvac'],
    2: ['roofing', 'excavation'],
    3: ['crane_operator', 'scaffold'],
  };
  return tradesByTier[tier] || [];
}
