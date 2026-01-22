import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  RefreshCw,

  Loader2,
} from "lucide-react";
import { compliant } from "@/api/compliantClient";
import { useQuery } from "@tanstack/react-query";
import { validatePolicyTradeCoverage, compareTradesCoverage } from "@/policyTradeValidator";
import TradeSelectionComponent from "@/components/TradeSelectionComponent.jsx";

/**
 * TradeChangeValidator
 * 
 * Handles changing trades when assigning an existing subcontractor to a new project.
 * Validates that the subcontractor's COI covers the new trades.
 * 
 * Props:
 * - subcontractor: The subcontractor being assigned
 * - project: The project they're being assigned to
 * - currentTrades: Current trades assigned (if updating)
 * - onTradesConfirmed: Callback with confirmed trades and validation
 * - onCancel: Cancel callback
 */
export default function TradeChangeValidator({
  subcontractor,
  project: _project,
  currentTrades = [],
  onTradesConfirmed,
  onCancel,
}) {
  const [selectedTrades, setSelectedTrades] = useState(currentTrades);
  const [validationResults, setValidationResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [tradeComparison, setTradeComparison] = useState(null);

  /**
   * Fetch subcontractor's active COI
   */
  const { data: activeCOI, isLoading: coiLoading } = useQuery({
    queryKey: ["subcontractor-active-coi", subcontractor?.id],
    queryFn: async () => {
      if (!subcontractor?.id) return null;

      const cois = await compliant.entities.GeneratedCOI.list();
      return cois.find(
        (c) =>
          c.subcontractor_id === subcontractor.id &&
          c.status === "active"
      );
    },
    enabled: !!subcontractor?.id,
  });

  /**
   * Validate trades against policy
   */
  const validateTrades = async () => {
    if (!activeCOI || selectedTrades.length === 0) {
      alert("Active COI and trades required");
      return;
    }

    setLoading(true);

    try {
      // Validate new trades
      const validation = validatePolicyTradeCoverage(activeCOI, selectedTrades);

      // Compare with existing trades
      const comparison = compareTradesCoverage(
        currentTrades,
        selectedTrades,
        activeCOI
      );

      setValidationResults(validation);
      setTradeComparison(comparison);

      // Check for policy exclusions for new trades
      if (comparison.added.length > 0) {
        const exclusionCheck = comparison.addedTradesValidation.filter(
          (v) => v.validation.length > 0
        );

        if (exclusionCheck.length > 0) {
          // Show detailed issues
          const issueMessage = exclusionCheck
            .map(
              (v) =>
                `${v.trade}: ${v.validation.map((i) => i.message).join(", ")}`
            )
            .join("\n");

          alert(
            `New trades have policy issues:\n\n${issueMessage}\n\nReview below before confirming.`
          );
        }
      }
    } catch (error) {
      console.error("Validation failed:", error);
      alert("Validation failed: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Confirm trade assignment
   */
  const confirmTrades = async () => {
    if (!validationResults) {
      alert("Run validation first");
      return;
    }

    if (validationResults.issues.length > 0) {
      const confirmed = window.confirm(
        `${validationResults.issues.length} issue(s) found.\n\nContinue anyway?\n\nNote: Broker will be notified of issues.`
      );

      if (!confirmed) return;
    }

    if (onTradesConfirmed) {
      onTradesConfirmed({
        trades: selectedTrades,
        validation: validationResults,
        comparison: tradeComparison,
        coiId: activeCOI?.id,
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* COI Status */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Active COI Status</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {coiLoading ? (
            <div className="flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-sm">Loading COI...</span>
            </div>
          ) : activeCOI ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-600">Company</span>
                <span className="font-medium">{activeCOI.company_name}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-600">GL Limits</span>
                <span className="font-medium">
                  ${activeCOI.gl_limits_per_occurrence?.toLocaleString()} / $
                  {activeCOI.gl_limits_aggregate?.toLocaleString()}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-600">Expiration</span>
                <Badge
                  variant={
                    new Date(activeCOI.gl_expiration_date) > new Date()
                      ? "default"
                      : "destructive"
                  }
                >
                  {new Date(activeCOI.gl_expiration_date).toLocaleDateString()}
                </Badge>
              </div>
              {activeCOI.umbrella_limit && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-600">Umbrella</span>
                  <span className="font-medium">
                    ${activeCOI.umbrella_limit.toLocaleString()}
                  </span>
                </div>
              )}
            </div>
          ) : (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                No active COI found for this subcontractor. They must upload a
                certificate before being assigned to a project.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Trade Selection */}
      {activeCOI && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Select Trades</CardTitle>
          </CardHeader>
          <CardContent>
            <TradeSelectionComponent
              selectedTrades={selectedTrades}
              onTradesChange={setSelectedTrades}
              multipleSelectionAllowed={true}
              required={true}
            />
          </CardContent>
        </Card>
      )}

      {/* Trade Comparison (if changing) */}
      {currentTrades.length > 0 && selectedTrades.length > 0 && (
        <Card className="bg-slate-50">
          <CardHeader>
            <CardTitle className="text-base">Trade Changes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {tradeComparison?.added.length > 0 && (
              <div>
                <p className="text-sm font-semibold text-slate-700 mb-2">
                  New Trades:
                </p>
                <div className="flex flex-wrap gap-2">
                  {tradeComparison.added.map((trade) => (
                    <Badge key={trade} variant="outline" className="bg-green-50">
                      + {trade}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {tradeComparison?.removed.length > 0 && (
              <div>
                <p className="text-sm font-semibold text-slate-700 mb-2">
                  Removed Trades:
                </p>
                <div className="flex flex-wrap gap-2">
                  {tradeComparison.removed.map((trade) => (
                    <Badge key={trade} variant="outline" className="bg-red-50">
                      - {trade}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {tradeComparison?.unchanged.length > 0 && (
              <div>
                <p className="text-sm font-semibold text-slate-700 mb-2">
                  Unchanged:
                </p>
                <div className="flex flex-wrap gap-2">
                  {tradeComparison.unchanged.map((trade) => (
                    <Badge key={trade} variant="secondary">
                      = {trade}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Validation Results */}
      {validationResults && (
        <Card
          className={
            validationResults.issues.length > 0 ? "border-red-200" : ""
          }
        >
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              {validationResults.issues.length > 0 ? (
                <>
                  <AlertTriangle className="w-5 h-5 text-red-600" />
                  Policy Coverage Issues
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-5 h-5 text-green-600" />
                  All Clear
                </>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {validationResults.issues.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-semibold">Issues Found:</p>
                {validationResults.issues.map((issue, idx) => (
                  <Alert
                    key={idx}
                    className={
                      issue.severity === "high"
                        ? "border-red-200 bg-red-50"
                        : "border-amber-200 bg-amber-50"
                    }
                  >
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="text-sm font-semibold">{issue.trade}</p>
                          <p className="text-sm mt-1">{issue.message}</p>
                        </div>
                        <Badge
                          variant="outline"
                          className={
                            issue.severity === "high"
                              ? "bg-red-100"
                              : "bg-amber-100"
                          }
                        >
                          {issue.severity}
                        </Badge>
                      </div>
                    </AlertDescription>
                  </Alert>
                ))}
              </div>
            )}

            {validationResults.warnings.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-semibold text-amber-900">Notes:</p>
                {validationResults.warnings.map((warning, idx) => (
                  <Alert
                    key={idx}
                    className="border-amber-200 bg-amber-50"
                  >
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription className="text-sm">
                      {warning.message}
                    </AlertDescription>
                  </Alert>
                ))}
              </div>
            )}

            {validationResults.excludedTrades.length > 0 && (
              <Alert className="border-red-300 bg-red-50">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  <p className="font-semibold text-sm mb-2">
                    Policy Exclusions:
                  </p>
                  <ul className="text-sm space-y-1">
                    {validationResults.excludedTrades.map((trade, idx) => (
                      <li key={idx}>
                        • {trade.trade}: {trade.exclusion}
                      </li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}

            {validationResults.issues.length === 0 &&
              validationResults.warnings.length === 0 &&
              validationResults.excludedTrades.length === 0 && (
                <Alert className="border-green-200 bg-green-50">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  <AlertDescription className="text-green-800">
                    Policy covers all selected trades. Ready to assign.
                  </AlertDescription>
                </Alert>
              )}
          </CardContent>
        </Card>
      )}

      {/* Action Buttons */}
      <div className="flex gap-3">
        {!validationResults ? (
          <Button
            onClick={validateTrades}
            disabled={!activeCOI || selectedTrades.length === 0 || loading}
            className="ml-auto"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Validating...
              </>
            ) : (
              <>
                <RefreshCw className="w-4 h-4 mr-2" />
                Validate Policy Coverage
              </>
            )}
          </Button>
        ) : (
          <>
            <Button
              onClick={() => setValidationResults(null)}
              variant="outline"
            >
              Back
            </Button>
            <Button onClick={confirmTrades} className="ml-auto">
              <CheckCircle2 className="w-4 h-4 mr-2" />
              Confirm Trade Assignment
            </Button>
          </>
        )}

        {onCancel && (
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        )}
      </div>
    </div>
  );
}
