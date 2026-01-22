import { useState } from "react";
import { compliant } from "@/api/compliantClient";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  FileText, Download, Eye, AlertTriangle, CheckCircle2, 
  BookOpen, Zap
} from "lucide-react";

/**
 * ProjectRequirementsViewer Component
 * Displays project requirements for subcontractors to review
 * Shows requirements based on their selected trade
 */
export default function ProjectRequirementsViewer({ projectId, selectedTrades = [] }) {
  const [expandedTiers, setExpandedTiers] = useState([1, 2, 3]);

  // Fetch project requirements
  const { data: requirements = [], isLoading } = useQuery({
    queryKey: ['projectRequirements', projectId],
    queryFn: async () => {
      if (!projectId) return [];
      const allRequirements = await compliant.entities.ProjectInsuranceRequirement.filter({
        project_id: projectId,
        is_active: true,
      });
      return allRequirements;
    },
  });

  // Filter requirements based on selected trades
  const applicableRequirements = selectedTrades.length > 0
    ? requirements.filter((req) => {
        if (!req.applicable_trades || req.applicable_trades.length === 0) return true;
        return selectedTrades.some((trade) => req.applicable_trades.includes(trade));
      })
    : requirements;

  // Group by tier
  const requirementsByTier = {
    1: applicableRequirements.filter((r) => r.requirement_tier === 1),
    2: applicableRequirements.filter((r) => r.requirement_tier === 2),
    3: applicableRequirements.filter((r) => r.requirement_tier === 3),
  };

  const getTierLabel = (tier) => {
    const labels = {
      1: 'Tier 1 - General Construction Trades',
      2: 'Tier 2 - Specialty Trades',
      3: 'Tier 3 - High-Risk Trades',
    };
    return labels[tier] || `Tier ${tier}`;
  };

  const getTierDescription = (tier) => {
    const descriptions = {
      1: 'General construction trades like carpentry, electrical, plumbing, and HVAC',
      2: 'Specialty trades including roofing and excavation work',
      3: 'High-risk trades such as crane operation and scaffolding',
    };
    return descriptions[tier] || '';
  };

  const toggleTier = (tier) => {
    setExpandedTiers(
      expandedTiers.includes(tier)
        ? expandedTiers.filter((t) => t !== tier)
        : [...expandedTiers, tier]
    );
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-center py-8">
            <div className="text-gray-500">Loading requirements...</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold mb-2">Project Insurance Requirements</h2>
        <p className="text-gray-600">
          Review the insurance coverage requirements for this project based on the trades you perform.
        </p>
      </div>

      {/* Filter Info */}
      {selectedTrades.length > 0 && (
        <Alert className="border-red-200 bg-red-50">
          <Zap className="h-4 w-4 text-red-600" />
          <AlertDescription>
            Showing requirements for: {selectedTrades.join(', ')}
          </AlertDescription>
        </Alert>
      )}

      {/* No Requirements Alert */}
      {applicableRequirements.length === 0 && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            No specific requirement documents have been uploaded for this project yet.
            Contact the General Contractor for insurance requirements.
          </AlertDescription>
        </Alert>
      )}

      {/* Requirements by Tier */}
      {[1, 2, 3].map((tier) => {
        const tierReqs = requirementsByTier[tier] || [];
        const isExpanded = expandedTiers.includes(tier);

        return (
          <Card key={tier}>
            <CardHeader
              className="cursor-pointer hover:bg-gray-50 transition"
              onClick={() => toggleTier(tier)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <BookOpen className="w-5 h-5 text-red-600" />
                  <div>
                    <CardTitle className="text-lg">{getTierLabel(tier)}</CardTitle>
                    <p className="text-sm text-gray-600 mt-1">{getTierDescription(tier)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{tierReqs.length} documents</Badge>
                  <div className={`transform transition ${isExpanded ? 'rotate-180' : ''}`}>
                    ▼
                  </div>
                </div>
              </div>
            </CardHeader>

            {isExpanded && (
              <CardContent className="border-t pt-6">
                {tierReqs.length === 0 ? (
                  <div className="text-center py-6 text-gray-500">
                    <FileText className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    <p>No documents for this tier</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {tierReqs.map((req) => (
                      <RequirementDocument key={req.id} requirement={req} />
                    ))}
                  </div>
                )}
              </CardContent>
            )}
          </Card>
        );
      })}

      {/* Summary Card */}
      {applicableRequirements.length > 0 && (
        <Card className="bg-gradient-to-r from-red-50 to-rose-50 border-red-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-green-600" />
              How to Use These Requirements
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div>
              <h4 className="font-semibold mb-1">1. Review the Documents</h4>
              <p className="text-gray-700">
                Read through the requirement documents to understand what your Certificate of Insurance must include.
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-1">2. Share with Your Broker</h4>
              <p className="text-gray-700">
                Provide these documents to your insurance broker so they can ensure your policies meet these specific requirements.
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-1">3. Submit Your COI</h4>
              <p className="text-gray-700">
                Once your broker prepares your Certificate of Insurance, it will be validated against these requirements.
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-1">4. Get Approved</h4>
              <p className="text-gray-700">
                Once your certificate meets all requirements, you&apos;ll receive approval and can begin work on the project.
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

/**
 * RequirementDocument Component - Individual requirement document display
 */
function RequirementDocument({ requirement }) {
  const [isLoading, setIsLoading] = useState(false);

  const handlePreview = async () => {
    setIsLoading(true);
    try {
      window.open(requirement.document_url, '_blank');
    } catch (error) {
      console.error('Error opening document:', error);
      alert('Failed to open document');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownload = async () => {
    setIsLoading(true);
    try {
      const link = document.createElement('a');
      link.href = requirement.document_url;
      link.download = requirement.document_name;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error('Error downloading document:', error);
      alert('Failed to download document');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex items-start justify-between p-4 bg-white border border-gray-200 rounded-lg hover:shadow-sm transition">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-3 mb-2">
          <FileText className="w-5 h-5 text-gray-600 flex-shrink-0" />
          <h3 className="font-semibold truncate">{requirement.document_name}</h3>
        </div>

        {requirement.document_description && (
          <p className="text-sm text-gray-600 mb-2">{requirement.document_description}</p>
        )}

        {requirement.applicable_trades?.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {requirement.applicable_trades.map((trade) => (
              <Badge key={trade} variant="secondary" className="text-xs">
                {trade.replace('_', ' ')}
              </Badge>
            ))}
          </div>
        )}

        <p className="text-xs text-gray-500 mt-2">
          Added {new Date(requirement.created_at).toLocaleDateString()}
        </p>
      </div>

      <div className="flex gap-2 ml-4 flex-shrink-0">
        <Button
          variant="outline"
          size="sm"
          onClick={handlePreview}
          disabled={isLoading}
          title="Preview document"
        >
          <Eye className="w-4 h-4" />
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={handleDownload}
          disabled={isLoading}
          title="Download document"
        >
          <Download className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
