import { useState } from "react";
import { compliant } from "@/api/compliantClient";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { FileText, Shield, Eye } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useSearchParams } from "react-router-dom";

export default function UploadDocuments() {
  const [searchParams] = useSearchParams();
  const subName = searchParams.get('sub');
  const queryClient = useQueryClient();

  const [isProcessingUpload, setIsProcessingUpload] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');

  const { data: allCOIs = [] } = useQuery({
    queryKey: ['all-cois'],
    queryFn: () => compliant.entities.GeneratedCOI.list('-created_date'),
  });

  const subCOI = allCOIs.find(c => c.subcontractor_name === subName);

  const updateCOIMutation = useMutation({
    mutationFn: ({ id, data }) => compliant.entities.GeneratedCOI.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['all-cois']);
    },
  });

  const extractCOIData = async (fileUrl) => {
    setIsProcessingUpload(true);
    setUploadProgress('🤖 Analyzing COI with AI...');

    const schema = {
      subcontractor_name: "string",
      gl_policy_number: "string",
      gl_effective_date: "ISO date",
      gl_expiration_date: "ISO date",
      gl_aggregate: "number",
      gl_each_occurrence: "number",
      wc_policy_number: "string",
      wc_effective_date: "ISO date",
      wc_expiration_date: "ISO date",
      umbrella_policy_number: "string (optional)",
      umbrella_effective_date: "ISO date (optional)",
      umbrella_expiration_date: "ISO date (optional)",
      umbrella_aggregate: "number (optional)",
      auto_policy_number: "string (optional)",
      auto_effective_date: "ISO date (optional)",
      auto_expiration_date: "ISO date (optional)"
    };

    try {
      const extractionResult = await compliant.integrations.Core.ExtractDataFromUploadedFile({
        file_url: fileUrl,
        json_schema: schema
      });

      if (extractionResult.status === 'success' && extractionResult.output) {
        setUploadProgress('✅ COI data extracted!');
        return extractionResult.output;
      }
      setUploadProgress('⚠️ Failed to extract COI data.');
      return null;
    } catch (error) {
      setUploadProgress('❌ Error during COI extraction.');
      console.error("Error extracting COI data:", error);
      return null;
    } finally {
      setIsProcessingUpload(false);
    }
  };

  const extractPolicyData = async (fileUrl, policyType) => {
    setIsProcessingUpload(true);
    setUploadProgress(`🤖 Analyzing ${policyType.toUpperCase()} policy with AI...`);

    const schema = policyType === 'gl'
      ? {
          has_condo_exclusion: "boolean",
          has_height_limitation: "boolean",
          has_hammer_clause: "boolean",
          has_action_over_exclusion: "boolean"
        }
      : { policy_details: "string" };

    try {
      const extractionResult = await compliant.integrations.Core.ExtractDataFromUploadedFile({
        file_url: fileUrl,
        json_schema: schema
      });

      if (extractionResult.status === 'success' && extractionResult.output) {
        setUploadProgress('✅ Policy data extracted!');
        return extractionResult.output;
      }
      setUploadProgress('⚠️ Failed to extract policy data.');
      return null;
    } catch (error) {
      setUploadProgress('❌ Error during policy extraction.');
      console.error("Error extracting policy data:", error);
      return null;
    } finally {
      setIsProcessingUpload(false);
    }
  };

  const handleUploadCOI = async (file) => {
    if (!subCOI) return;

    try {
      setUploadProgress('📤 Uploading COI...');
      const uploadResult = await compliant.integrations.Core.UploadFile({ file });
      
      // Validate upload result has file_url
      if (!uploadResult || !uploadResult.file_url) {
        throw new Error('File upload failed - no URL returned');
      }
      
      const extractedData = await extractCOIData(uploadResult.file_url);
      
      const updateData = {
        first_coi_url: uploadResult.file_url,
        first_coi_uploaded: true,
        first_coi_upload_date: new Date().toISOString(),
        status: 'awaiting_admin_review'
      };
      
      if (extractedData) {
        Object.assign(updateData, extractedData);
      }
      
      await updateCOIMutation.mutateAsync({
        id: subCOI.id,
        data: updateData
      });
      
      setUploadProgress('');
      alert('✅ COI uploaded successfully' + (extractedData ? ' and data extracted!' : '!'));
    } catch (error) {
      setUploadProgress('');
      const errorMessage = error?.message || 'Unknown error';
      alert(`❌ Failed to upload COI: ${errorMessage}`);
      console.error("Error uploading COI:", error);
    }
  };

  const handleUploadPolicy = async (file, policyType) => {
    if (!subCOI) return;

    try {
      setUploadProgress(`📤 Uploading ${policyType.toUpperCase()} policy...`);
      const uploadResult = await compliant.integrations.Core.UploadFile({ file });
      
      // Validate upload result has file_url
      if (!uploadResult || !uploadResult.file_url) {
        throw new Error('File upload failed - no URL returned');
      }
      
      const extractedData = await extractPolicyData(uploadResult.file_url, policyType);
      
      const updateData = { [`${policyType}_policy_url`]: uploadResult.file_url };
      
      if (extractedData) {
        Object.assign(updateData, extractedData);
      }
      
      await updateCOIMutation.mutateAsync({
        id: subCOI.id,
        data: updateData
      });
      
      setUploadProgress('');
      alert(`✅ ${policyType.toUpperCase()} Policy uploaded successfully!`);
    } catch (error) {
      setUploadProgress('');
      const errorMessage = error?.message || 'Unknown error';
      alert(`❌ Failed to upload ${policyType.toUpperCase()} policy: ${errorMessage}`);
      console.error(`Error uploading ${policyType} policy:`, error);
    }
  };

  if (!subCOI) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-4 md:p-8">
        <div className="max-w-7xl mx-auto">
          <Card>
            <CardContent className="p-12 text-center">
              <h3 className="text-xl font-semibold text-slate-900 mb-2">
                Subcontractor Not Found
              </h3>
              <p className="text-slate-600">
                This subcontractor needs to be added to a project first.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold text-slate-900 mb-2">
            Upload Insurance Documents
          </h1>
          <p className="text-slate-600">Upload COI and policy documents for {subName}</p>
        </div>

        <Card className="border-slate-200 shadow-lg">
          <CardContent className="p-6">
            <Tabs defaultValue="coi" className="w-full">
              <TabsList className="grid w-full grid-cols-5">
                <TabsTrigger value="coi">COI</TabsTrigger>
                <TabsTrigger value="gl">GL Policy</TabsTrigger>
                <TabsTrigger value="wc">WC Policy</TabsTrigger>
                <TabsTrigger value="umbrella">Umbrella</TabsTrigger>
                <TabsTrigger value="auto">Auto</TabsTrigger>
              </TabsList>

              <TabsContent value="coi" className="space-y-6 py-6">
                <div className="p-6 bg-gradient-to-br from-red-50 to-cyan-50 rounded-xl border-4 border-red-500">
                  <Label htmlFor="coi_upload" className="text-2xl font-black text-red-900 flex items-center gap-2 mb-4">
                    <FileText className="w-8 h-8" />
                    Upload COI Certificate (PDF)
                  </Label>
                  <Input
                    id="coi_upload"
                    type="file"
                    accept=".pdf"
                    onChange={(e) => {
                      const file = e.target.files[0];
                      if (file) {
                        handleUploadCOI(file);
                        e.target.value = null;
                      }
                    }}
                    className="border-4 border-red-400 h-16 text-lg font-bold cursor-pointer hover:border-red-600 transition-all"
                    disabled={isProcessingUpload}
                  />
                  {isProcessingUpload && uploadProgress.includes('COI') && (
                    <div className="flex items-center gap-3 text-red-700 text-lg font-bold bg-red-100 p-4 rounded-lg mt-4">
                      <div className="animate-spin w-6 h-6 border-4 border-red-600 border-t-transparent rounded-full"></div>
                      {uploadProgress}
                    </div>
                  )}
                </div>

                {subCOI.first_coi_url && (
                  <div className="p-4 bg-emerald-50 rounded-lg border-2 border-emerald-300">
                    <p className="text-sm text-emerald-800 font-semibold mb-2">
                      ✅ Current COI on file:
                    </p>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => window.open(subCOI.first_coi_url, '_blank')}
                      className="border-2 border-emerald-500 text-emerald-700 font-bold"
                    >
                      <Eye className="w-4 h-4 mr-2" />
                      View Current COI
                    </Button>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="gl" className="space-y-6 py-6">
                <div className="p-6 bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl border-4 border-purple-500">
                  <Label htmlFor="gl_policy_upload" className="text-2xl font-black text-purple-900 flex items-center gap-2 mb-4">
                    <Shield className="w-8 h-8" />
                    Upload General Liability Policy (PDF)
                  </Label>
                  <Input
                    id="gl_policy_upload"
                    type="file"
                    accept=".pdf"
                    onChange={(e) => {
                      const file = e.target.files[0];
                      if (file) {
                        handleUploadPolicy(file, 'gl');
                        e.target.value = null;
                      }
                    }}
                    className="border-4 border-purple-400 h-16 text-lg font-bold cursor-pointer hover:border-purple-600 transition-all"
                    disabled={isProcessingUpload}
                  />
                  {isProcessingUpload && uploadProgress.includes('GL') && (
                    <div className="flex items-center gap-3 text-purple-700 text-lg font-bold bg-purple-100 p-4 rounded-lg mt-4">
                      <div className="animate-spin w-6 h-6 border-4 border-purple-600 border-t-transparent rounded-full"></div>
                      {uploadProgress}
                    </div>
                  )}
                </div>

                {subCOI.gl_policy_url && (
                  <div className="p-4 bg-emerald-50 rounded-lg border-2 border-emerald-300">
                    <p className="text-sm text-emerald-800 font-semibold mb-2">✅ Current GL Policy on file:</p>
                    <Button size="sm" variant="outline" onClick={() => window.open(subCOI.gl_policy_url, '_blank')} className="border-2 border-emerald-500 text-emerald-700 font-bold">
                      <Eye className="w-4 h-4 mr-2" /> View GL Policy
                    </Button>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="wc" className="space-y-6 py-6">
                <div className="p-6 bg-gradient-to-br from-amber-50 to-orange-50 rounded-xl border-4 border-amber-500">
                  <Label htmlFor="wc_policy_upload" className="text-2xl font-black text-amber-900 flex items-center gap-2 mb-4">
                    <Shield className="w-8 h-8" />
                    Upload Workers Comp Policy (PDF)
                  </Label>
                  <Input
                    id="wc_policy_upload"
                    type="file"
                    accept=".pdf"
                    onChange={(e) => {
                      const file = e.target.files[0];
                      if (file) {
                        handleUploadPolicy(file, 'wc');
                        e.target.value = null;
                      }
                    }}
                    className="border-4 border-amber-400 h-16 text-lg font-bold cursor-pointer hover:border-amber-600 transition-all"
                    disabled={isProcessingUpload}
                  />
                  {isProcessingUpload && uploadProgress.includes('WC') && (
                    <div className="flex items-center gap-3 text-amber-700 text-lg font-bold bg-amber-100 p-4 rounded-lg mt-4">
                      <div className="animate-spin w-6 h-6 border-4 border-amber-600 border-t-transparent rounded-full"></div>
                      {uploadProgress}
                    </div>
                  )}
                </div>

                {subCOI.wc_policy_url && (
                  <div className="p-4 bg-emerald-50 rounded-lg border-2 border-emerald-300">
                    <p className="text-sm text-emerald-800 font-semibold mb-2">✅ Current WC Policy on file:</p>
                    <Button size="sm" variant="outline" onClick={() => window.open(subCOI.wc_policy_url, '_blank')} className="border-2 border-emerald-500 text-emerald-700 font-bold">
                      <Eye className="w-4 h-4 mr-2" /> View WC Policy
                    </Button>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="umbrella" className="space-y-6 py-6">
                <div className="p-6 bg-gradient-to-br from-teal-50 to-cyan-50 rounded-xl border-4 border-teal-500">
                  <Label htmlFor="umbrella_policy_upload" className="text-2xl font-black text-teal-900 flex items-center gap-2 mb-4">
                    <Shield className="w-8 h-8" />
                    Upload Umbrella Policy (PDF)
                  </Label>
                  <Input
                    id="umbrella_policy_upload"
                    type="file"
                    accept=".pdf"
                    onChange={(e) => {
                      const file = e.target.files[0];
                      if (file) {
                        handleUploadPolicy(file, 'umbrella');
                        e.target.value = null;
                      }
                    }}
                    className="border-4 border-teal-400 h-16 text-lg font-bold cursor-pointer hover:border-teal-600 transition-all"
                    disabled={isProcessingUpload}
                  />
                  {isProcessingUpload && uploadProgress.includes('UMBRELLA') && (
                    <div className="flex items-center gap-3 text-teal-700 text-lg font-bold bg-teal-100 p-4 rounded-lg mt-4">
                      <div className="animate-spin w-6 h-6 border-4 border-teal-600 border-t-transparent rounded-full"></div>
                      {uploadProgress}
                    </div>
                  )}
                </div>

                {subCOI.umbrella_policy_url && (
                  <div className="p-4 bg-emerald-50 rounded-lg border-2 border-emerald-300">
                    <p className="text-sm text-emerald-800 font-semibold mb-2">✅ Current Umbrella Policy on file:</p>
                    <Button size="sm" variant="outline" onClick={() => window.open(subCOI.umbrella_policy_url, '_blank')} className="border-2 border-emerald-500 text-emerald-700 font-bold">
                      <Eye className="w-4 h-4 mr-2" /> View Umbrella Policy
                    </Button>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="auto" className="space-y-6 py-6">
                <div className="p-6 bg-gradient-to-br from-rose-50 to-rose-50 rounded-xl border-4 border-rose-500">
                  <Label htmlFor="auto_policy_upload" className="text-2xl font-black text-indigo-900 flex items-center gap-2 mb-4">
                    <Shield className="w-8 h-8" />
                    Upload Auto Liability Policy (PDF)
                  </Label>
                  <Input
                    id="auto_policy_upload"
                    type="file"
                    accept=".pdf"
                    onChange={(e) => {
                      const file = e.target.files[0];
                      if (file) {
                        handleUploadPolicy(file, 'auto');
                        e.target.value = null;
                      }
                    }}
                    className="border-4 border-indigo-400 h-16 text-lg font-bold cursor-pointer hover:border-indigo-600 transition-all"
                    disabled={isProcessingUpload}
                  />
                  {isProcessingUpload && uploadProgress.includes('AUTO') && (
                    <div className="flex items-center gap-3 text-rose-700 text-lg font-bold bg-indigo-100 p-4 rounded-lg mt-4">
                      <div className="animate-spin w-6 h-6 border-4 border-indigo-600 border-t-transparent rounded-full"></div>
                      {uploadProgress}
                    </div>
                  )}
                </div>

                {subCOI.auto_policy_url && (
                  <div className="p-4 bg-emerald-50 rounded-lg border-2 border-emerald-300">
                    <p className="text-sm text-emerald-800 font-semibold mb-2">✅ Current Auto Policy on file:</p>
                    <Button size="sm" variant="outline" onClick={() => window.open(subCOI.auto_policy_url, '_blank')} className="border-2 border-emerald-500 text-emerald-700 font-bold">
                      <Eye className="w-4 h-4 mr-2" /> View Auto Policy
                    </Button>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
