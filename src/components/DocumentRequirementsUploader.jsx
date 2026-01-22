import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { FileUp, FileText, AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { compliant } from "@/api/compliantClient";

/**
 * DocumentRequirementsUploader
 * Allows admins to either upload a requirements document OR manually enter requirements
 * System flags issues for admin review before approval
 * 
 * Props:
 * - projectId: Project ID
 * - onRequirementsSaved: Callback when saved
 */
export default function DocumentRequirementsUploader({ projectId, onRequirementsSaved }) {
  const [uploadMode, setUploadMode] = useState("document"); // 'document' or 'manual'
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [manualRequirements, setManualRequirements] = useState({
    tier: "1",
    gl_min: "$1,000,000",
    gl_aggregate: "$2,000,000",
    wc_min: "$1,000,000",
    auto_min: "$1,000,000",
    umbrella_min: "",
    required_endorsements: [],
    waiver_subrogation: true,
    waiver_excess: true,
    additional_notes: "",
  });
  const [flags, setFlags] = useState([]);
  const [showReview, setShowReview] = useState(false);

  /**
   * Validate requirements and generate flags for admin review
   */
  const validateRequirements = (requirements) => {
    const newFlags = [];

    // Check for inconsistencies
    if (requirements.gl_min && requirements.gl_aggregate) {
      const glMin = parseInt(requirements.gl_min.replace(/\D/g, ''));
      const glAgg = parseInt(requirements.gl_aggregate.replace(/\D/g, ''));
      
      if (glMin > glAgg) {
        newFlags.push({
          type: 'error',
          message: `GL minimum ($${glMin}) cannot exceed aggregate ($${glAgg})`,
          field: 'gl_limits'
        });
      }
    }

    // Check for Tier 2/3 requiring umbrella
    if ((requirements.tier === '2' || requirements.tier === '3') && !requirements.umbrella_min) {
      newFlags.push({
        type: 'warning',
        message: `Tier ${requirements.tier} typically requires umbrella coverage`,
        field: 'umbrella'
      });
    }

    // Check for missing waiver of subrogation
    if (!requirements.waiver_subrogation) {
      newFlags.push({
        type: 'warning',
        message: 'Waiver of Subrogation is typically required for GL',
        field: 'waiver_subrogation'
      });
    }

    // Check for missing waiver of excess
    if (!requirements.waiver_excess) {
      newFlags.push({
        type: 'warning',
        message: 'Waiver of Excess is typically required for WC',
        field: 'waiver_excess'
      });
    }

    return newFlags;
  };

  /**
   * Handle document upload
   */
  const handleFileUpload = async (e) => {
    const uploadedFile = e.target.files?.[0];
    if (!uploadedFile) return;

    // Check file type
    const validTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    if (!validTypes.includes(uploadedFile.type)) {
      alert('Please upload a PDF or Word document');
      return;
    }

    // Check file size (max 10MB)
    if (uploadedFile.size > 10 * 1024 * 1024) {
      alert('File must be smaller than 10MB');
      return;
    }

    setFile(uploadedFile);
    setUploading(true);
    setUploadProgress(0);

    try {
      // Simulate progress
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => Math.min(prev + Math.random() * 40, 90));
      }, 300);

      const _uploadResult = await compliant.integrations.Core.UploadFile({ file: uploadedFile });
      clearInterval(progressInterval);
      setUploadProgress(100);

      // Create flags for this document upload
      const documentFlags = [
        {
          type: 'info',
          message: `Document uploaded: ${uploadedFile.name} (${(uploadedFile.size / 1024).toFixed(2)}KB)`,
          field: 'document'
        },
        {
          type: 'pending',
          message: 'Admin review required - document contains requirements',
          field: 'review'
        }
      ];

      setFlags(documentFlags);
      setShowReview(true);
      setUploading(false);

    } catch (error) {
      console.error('Upload failed:', error);
      alert('Upload failed: ' + error.message);
      setUploading(false);
      setUploadProgress(0);
    }
  };

  /**
   * Handle manual requirement entry
   */
  const handleManualEntry = () => {
    const validationFlags = validateRequirements(manualRequirements);
    setFlags(validationFlags);
    setShowReview(true);
  };

  /**
   * Submit requirements for admin review
   */
  const submitForReview = async () => {
    if (!projectId) {
      alert('Project ID required');
      return;
    }

    try {
      await compliant.entities.ProjectRequirementsReview.create({
        project_id: projectId,
        submission_type: uploadMode,
        submission_data: uploadMode === 'document' ? { file_name: file.name } : manualRequirements,
        flags: flags,
        review_status: 'pending_admin_review',
        created_date: new Date().toISOString()
      });

      if (onRequirementsSaved) {
        onRequirementsSaved();
      }

      // Reset form
      setFile(null);
      setFlags([]);
      setShowReview(false);
      setManualRequirements({
        tier: "1",
        gl_min: "$1,000,000",
        gl_aggregate: "$2,000,000",
        wc_min: "$1,000,000",
        auto_min: "$1,000,000",
        umbrella_min: "",
        required_endorsements: [],
        waiver_subrogation: true,
        waiver_excess: true,
        additional_notes: "",
      });

      alert('Requirements submitted for admin review');
    } catch (error) {
      console.error('Submission failed:', error);
      alert('Submission failed: ' + error.message);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Project Requirements Submission
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs value={uploadMode} onValueChange={setUploadMode} className="space-y-6">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="document" className="flex items-center gap-2">
                <FileUp className="w-4 h-4" />
                Upload Document
              </TabsTrigger>
              <TabsTrigger value="manual" className="flex items-center gap-2">
                <FileText className="w-4 h-4" />
                Manual Entry
              </TabsTrigger>
            </TabsList>

            {/* Document Upload Mode */}
            <TabsContent value="document" className="space-y-4">
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Upload a document showing all requirements for this project. The system will flag any potential issues for admin review.
                </AlertDescription>
              </Alert>

              <div className="border-2 border-dashed border-slate-300 rounded-lg p-8 text-center">
                <input
                  type="file"
                  accept=".pdf,.doc,.docx"
                  onChange={handleFileUpload}
                  disabled={uploading}
                  className="hidden"
                  id="file-input"
                />
                <label htmlFor="file-input" className="cursor-pointer">
                  <div className="flex flex-col items-center gap-2">
                    <FileUp className="w-8 h-8 text-slate-400" />
                    <div>
                      <p className="font-medium text-slate-900">Click to upload</p>
                      <p className="text-sm text-slate-500">PDF, DOC, or DOCX (max 10MB)</p>
                    </div>
                  </div>
                </label>
              </div>

              {uploading && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span className="text-sm">Uploading... {Math.round(uploadProgress)}%</span>
                  </div>
                  <div className="w-full bg-slate-200 rounded-full h-2">
                    <div
                      className="bg-red-600 h-2 rounded-full transition-all"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                </div>
              )}

              {file && !uploading && (
                <div className="flex items-center gap-2 p-3 bg-slate-50 rounded">
                  <CheckCircle2 className="w-5 h-5 text-green-600" />
                  <span className="text-sm font-medium">{file.name}</span>
                </div>
              )}
            </TabsContent>

            {/* Manual Entry Mode */}
            <TabsContent value="manual" className="space-y-4">
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Manually enter requirements. The system will validate and flag any issues for admin approval.
                </AlertDescription>
              </Alert>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Tier Selection */}
                <div className="space-y-2">
                  <Label>Requirement Tier</Label>
                  <select
                    value={manualRequirements.tier}
                    onChange={(e) =>
                      setManualRequirements({
                        ...manualRequirements,
                        tier: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
                  >
                    <option value="1">Tier 1 - Basic Trades</option>
                    <option value="2">Tier 2 - Medium Risk</option>
                    <option value="3">Tier 3 - High Risk</option>
                  </select>
                </div>

                {/* GL Minimum */}
                <div className="space-y-2">
                  <Label>GL Minimum Per Occurrence</Label>
                  <Input
                    value={manualRequirements.gl_min}
                    onChange={(e) =>
                      setManualRequirements({
                        ...manualRequirements,
                        gl_min: e.target.value,
                      })
                    }
                    placeholder="$1,000,000"
                  />
                </div>

                {/* GL Aggregate */}
                <div className="space-y-2">
                  <Label>GL Aggregate</Label>
                  <Input
                    value={manualRequirements.gl_aggregate}
                    onChange={(e) =>
                      setManualRequirements({
                        ...manualRequirements,
                        gl_aggregate: e.target.value,
                      })
                    }
                    placeholder="$2,000,000"
                  />
                </div>

                {/* WC Minimum */}
                <div className="space-y-2">
                  <Label>Workers Comp Minimum</Label>
                  <Input
                    value={manualRequirements.wc_min}
                    onChange={(e) =>
                      setManualRequirements({
                        ...manualRequirements,
                        wc_min: e.target.value,
                      })
                    }
                    placeholder="$1,000,000"
                  />
                </div>

                {/* Auto Minimum */}
                <div className="space-y-2">
                  <Label>Auto Minimum CSL</Label>
                  <Input
                    value={manualRequirements.auto_min}
                    onChange={(e) =>
                      setManualRequirements({
                        ...manualRequirements,
                        auto_min: e.target.value,
                      })
                    }
                    placeholder="$1,000,000"
                  />
                </div>

                {/* Umbrella Minimum */}
                <div className="space-y-2">
                  <Label>Umbrella Minimum (Optional)</Label>
                  <Input
                    value={manualRequirements.umbrella_min}
                    onChange={(e) =>
                      setManualRequirements({
                        ...manualRequirements,
                        umbrella_min: e.target.value,
                      })
                    }
                    placeholder="$2,000,000 (if required)"
                  />
                </div>
              </div>

              {/* Endorsements & Waivers */}
              <div className="space-y-3">
                <Label className="text-base font-semibold">Required Endorsements</Label>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="waiver-subrogation"
                    checked={manualRequirements.waiver_subrogation}
                    onChange={(e) =>
                      setManualRequirements({
                        ...manualRequirements,
                        waiver_subrogation: e.target.checked,
                      })
                    }
                  />
                  <label htmlFor="waiver-subrogation" className="text-sm cursor-pointer">
                    Waiver of Subrogation (GL, Umbrella, WC)
                  </label>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="waiver-excess"
                    checked={manualRequirements.waiver_excess}
                    onChange={(e) =>
                      setManualRequirements({
                        ...manualRequirements,
                        waiver_excess: e.target.checked,
                      })
                    }
                  />
                  <label htmlFor="waiver-excess" className="text-sm cursor-pointer">
                    Waiver of Excess (WC)
                  </label>
                </div>
              </div>

              {/* Additional Notes */}
              <div className="space-y-2">
                <Label>Additional Notes</Label>
                <Textarea
                  value={manualRequirements.additional_notes}
                  onChange={(e) =>
                    setManualRequirements({
                      ...manualRequirements,
                      additional_notes: e.target.value,
                    })
                  }
                  placeholder="Any special requirements or notes..."
                  className="h-24"
                />
              </div>
            </TabsContent>
          </Tabs>

          {/* Flags Review */}
          {showReview && flags.length > 0 && (
            <div className="mt-6 space-y-3">
              <Label className="text-base font-semibold">System Flags for Admin Review</Label>
              {flags.map((flag, idx) => (
                <div
                  key={idx}
                  className={`p-3 rounded-lg border ${
                    flag.type === 'error'
                      ? 'bg-red-50 border-red-200'
                      : flag.type === 'warning'
                      ? 'bg-amber-50 border-amber-200'
                      : flag.type === 'pending'
                      ? 'bg-red-50 border-red-200'
                      : 'bg-slate-50 border-slate-200'
                  }`}
                >
                  <div className="flex items-start gap-2">
                    {flag.type === 'error' && <AlertCircle className="w-4 h-4 text-red-600 mt-0.5" />}
                    {flag.type === 'warning' && <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5" />}
                    {flag.type === 'pending' && <Loader2 className="w-4 h-4 text-red-600 mt-0.5" />}
                    {flag.type === 'info' && <CheckCircle2 className="w-4 h-4 text-slate-600 mt-0.5" />}
                    <div>
                      <p className="text-sm font-medium">{flag.message}</p>
                      {flag.field && <p className="text-xs text-slate-500 mt-1">Field: {flag.field}</p>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Submit Button */}
          <div className="mt-6 flex gap-2">
            <Button
              onClick={uploadMode === 'document' ? handleManualEntry : handleManualEntry}
              variant="outline"
              disabled={uploadMode === 'document' ? !file : !manualRequirements.gl_min}
            >
              Review Requirements
            </Button>
            <Button
              onClick={submitForReview}
              disabled={flags.length === 0 || uploading}
              className="ml-auto"
            >
              Submit for Admin Review
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
