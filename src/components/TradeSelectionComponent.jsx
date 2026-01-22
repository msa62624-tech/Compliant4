import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertTriangle, Zap, Briefcase, TrendingUp } from "lucide-react";
import { getTradesByTier } from "@/insuranceRequirements";

/**
 * TradeSelectionComponent
 * Enhanced trade selection with tier information and insurance requirements visibility
 * Used when adding subcontractors to projects or editing subcontractor details
 */
export default function TradeSelectionComponent({
  selectedTrades = [],
  onTradesChange,
  required = true,
  disabled = false,
  multipleSelectionAllowed = true,
}) {
  const [expandedTiers, setExpandedTiers] = useState([1, 2, 3]);

  const tier1Trades = getTradesByTier(1);
  const tier2Trades = getTradesByTier(2);
  const tier3Trades = getTradesByTier(3);

  const toggleTrade = (trade) => {
    if (disabled) return;

    if (multipleSelectionAllowed) {
      const updated = selectedTrades.includes(trade)
        ? selectedTrades.filter((t) => t !== trade)
        : [...selectedTrades, trade];
      onTradesChange(updated);
    } else {
      onTradesChange(selectedTrades[0] === trade ? [] : [trade]);
    }
  };

  const _toggleTier = (tier) => {
    setExpandedTiers(
      expandedTiers.includes(tier)
        ? expandedTiers.filter((t) => t !== tier)
        : [...expandedTiers, tier]
    );
  };

  const getTierDescription = (tier) => {
    const descriptions = {
      1: "General construction trades with standard insurance requirements",
      2: "Specialty trades requiring higher coverage limits",
      3: "High-risk trades with maximum insurance requirements",
    };
    return descriptions[tier] || "";
  };

  const getTierRequirements = (tier) => {
    const requirements = {
      1: "GL: $1M each / $2M aggregate | WC: $1M | Auto: $1M CSL",
      2: "GL: $2M each / $5M aggregate | WC: $1M | Auto: $1M CSL | Umbrella: $2M required",
      3: "GL: $3M each / $6M aggregate | WC: $1M | Auto: $1M CSL | Umbrella: $3M required",
    };
    return requirements[tier] || "";
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <Label className="text-base font-semibold">
          {required ? "Select Trade(s) *" : "Select Trade(s)"}
        </Label>
        <p className="text-sm text-gray-600 mt-1">
          {multipleSelectionAllowed
            ? "Select all trades performed by this subcontractor. This determines insurance requirements."
            : "Select the primary trade for this subcontractor."}
        </p>
      </div>

      {/* Info Alert */}
      <Alert className="border-red-200 bg-red-50">
        <Zap className="h-4 w-4 text-red-600" />
        <AlertDescription>
          Trade selection determines the insurance requirements for this subcontractor on all projects.
          More specialized trades require higher coverage limits.
        </AlertDescription>
      </Alert>

      {/* Tier Selection Tabs */}
      <Tabs defaultValue="tier1">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="tier1">
            Tier 1 <span className="ml-1 text-xs">Standard</span>
          </TabsTrigger>
          <TabsTrigger value="tier2">
            Tier 2 <span className="ml-1 text-xs">Specialty</span>
          </TabsTrigger>
          <TabsTrigger value="tier3">
            Tier 3 <span className="ml-1 text-xs">High-Risk</span>
          </TabsTrigger>
        </TabsList>

        {/* Tier 1 - General Construction */}
        <TabsContent value="tier1" className="space-y-4">
          <TradeGroup
            tier={1}
            trades={tier1Trades}
            selectedTrades={selectedTrades}
            onToggleTrade={toggleTrade}
            disabled={disabled}
            description={getTierDescription(1)}
            requirements={getTierRequirements(1)}
          />
        </TabsContent>

        {/* Tier 2 - Specialty */}
        <TabsContent value="tier2" className="space-y-4">
          <TradeGroup
            tier={2}
            trades={tier2Trades}
            selectedTrades={selectedTrades}
            onToggleTrade={toggleTrade}
            disabled={disabled}
            description={getTierDescription(2)}
            requirements={getTierRequirements(2)}
          />
        </TabsContent>

        {/* Tier 3 - High Risk */}
        <TabsContent value="tier3" className="space-y-4">
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              High-risk trades require maximum insurance coverage and special review.
            </AlertDescription>
          </Alert>

          <TradeGroup
            tier={3}
            trades={tier3Trades}
            selectedTrades={selectedTrades}
            onToggleTrade={toggleTrade}
            disabled={disabled}
            description={getTierDescription(3)}
            requirements={getTierRequirements(3)}
          />
        </TabsContent>
      </Tabs>

      {/* Selection Summary */}
      {selectedTrades.length > 0 && (
        <Card className="bg-gradient-to-r from-red-50 to-rose-50 border-red-200">
          <CardHeader>
            <CardTitle className="text-base">Selected Trades</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2 mb-4">
              {selectedTrades.map((trade) => (
                <Badge key={trade} variant="secondary">
                  {trade}
                </Badge>
              ))}
            </div>
            <p className="text-sm text-gray-700">
              These trades will be used to determine project-specific insurance requirements
              when this subcontractor is added to projects.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Validation */}
      {required && selectedTrades.length === 0 && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Please select at least one trade
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}

/**
 * TradeGroup Component - Displays trades for a specific tier
 */
function TradeGroup({
  tier,
  trades,
  selectedTrades,
  onToggleTrade,
  disabled,
  description,
  requirements,
}) {
  const tierColors = {
    1: "bg-red-50 border-red-200",
    2: "bg-amber-50 border-amber-200",
    3: "bg-red-50 border-red-200",
  };

  const tierIcons = {
    1: <Briefcase className="w-5 h-5 text-red-600" />,
    2: <TrendingUp className="w-5 h-5 text-amber-600" />,
    3: <AlertTriangle className="w-5 h-5 text-red-600" />,
  };

  return (
    <Card className={tierColors[tier]}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          {tierIcons[tier]}
          Tier {tier} Trades
        </CardTitle>
        <p className="text-sm text-gray-600 mt-2">{description}</p>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Insurance Requirements Info */}
        <div className="bg-white/50 p-3 rounded border border-gray-200">
          <p className="text-xs font-semibold text-gray-700 mb-1">
            Base Insurance Requirements:
          </p>
          <p className="text-xs text-gray-600">{requirements}</p>
        </div>

        {/* Trade Checkboxes */}
        <div className="space-y-3">
          {trades.map((trade) => (
            <div key={trade.value} className="flex items-center">
              <Checkbox
                id={trade.value}
                checked={selectedTrades.includes(trade.value)}
                onCheckedChange={() => onToggleTrade(trade.value)}
                disabled={disabled}
              />
              <Label
                htmlFor={trade.value}
                className="ml-2 text-sm font-medium cursor-pointer"
              >
                {trade.label}
              </Label>
            </div>
          ))}
        </div>

        {/* Selected Count */}
        {trades.filter((t) => selectedTrades.includes(t.value)).length > 0 && (
          <div className="text-xs text-gray-600 pt-2 border-t">
            {trades.filter((t) => selectedTrades.includes(t.value)).length} trade(s)
            selected from this tier
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * TradeIcon Component - Visual indicator for trade tier level
 */
export function TradeIcon({ trade, size = "sm" }) {
  const sizeClasses = {
    xs: "w-3 h-3",
    sm: "w-4 h-4",
    md: "w-5 h-5",
    lg: "w-6 h-6",
  };

  // Determine tier from trade name
  let tier = 1;
  if (["roofing", "excavation"].includes(trade?.toLowerCase())) tier = 2;
  if (["crane_operator", "scaffold"].includes(trade?.toLowerCase())) tier = 3;

  const tierColors = {
    1: "text-red-600",
    2: "text-amber-600",
    3: "text-red-600",
  };

  return (
    <Briefcase className={`${sizeClasses[size]} ${tierColors[tier]}`} />
  );
}

/**
 * TradeInfo Component - Shows detailed info about a trade
 */
export function TradeInfo({ trade }) {
  // Determine tier
  let tier = 1;
  if (["roofing", "excavation"].includes(trade?.toLowerCase())) tier = 2;
  if (["crane_operator", "scaffold"].includes(trade?.toLowerCase())) tier = 3;

  const requirements = {
    1: {
      gl: "$1M each / $2M aggregate",
      wc: "$1M each accident",
      auto: "$1M CSL",
      umbrella: "Not required",
    },
    2: {
      gl: "$2M each / $5M aggregate",
      wc: "$1M each accident",
      auto: "$1M CSL",
      umbrella: "$2M required",
    },
    3: {
      gl: "$3M each / $6M aggregate",
      wc: "$1M each accident",
      auto: "$1M CSL",
      umbrella: "$3M required",
    },
  };

  const tierReqs = requirements[tier];

  return (
    <Card className="text-sm">
      <CardContent className="pt-4 space-y-2">
        <div>
          <p className="font-semibold capitalize">{trade}</p>
          <p className="text-gray-600 text-xs">Tier {tier}</p>
        </div>
        <div className="border-t pt-2 space-y-1">
          <div className="flex justify-between">
            <span>General Liability:</span>
            <span className="font-semibold">{tierReqs.gl}</span>
          </div>
          <div className="flex justify-between">
            <span>Workers&apos; Comp:</span>
            <span className="font-semibold">{tierReqs.wc}</span>
          </div>
          <div className="flex justify-between">
            <span>Auto Liability:</span>
            <span className="font-semibold">{tierReqs.auto}</span>
          </div>
          <div className="flex justify-between">
            <span>Umbrella/Excess:</span>
            <span className="font-semibold">{tierReqs.umbrella}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
