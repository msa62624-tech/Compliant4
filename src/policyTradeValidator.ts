/**
 * policyTradeValidator.ts
 * 
 * Validates insurance policies against trade requirements
 * Checks for:
 * - Trade exclusions in the policy
 * - Classification limitations
 * - Premium basis restrictions
 * - Warranty exclusions
 */

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export type TradeType = 
  | 'carpentry' | 'roofing' | 'electrical' | 'plumbing' | 'hvac'
  | 'excavation' | 'crane_operator' | 'scaffold' | 'concrete' | 'steel';

export type IssueSeverity = 'error' | 'warning' | 'high' | 'medium' | 'low';

export interface TradeExclusion {
  trade: string;
  exclusion: string;
  source: string;
}

export interface LimitedTrade {
  trade: string;
  classCode: number;
  message: string;
}

export interface ValidationIssue {
  type: 'error' | 'warning';
  trade?: string;
  message: string;
  severity: IssueSeverity;
  trades?: string[];
}

export interface ValidationResult {
  compliant: boolean;
  issues: ValidationIssue[];
  excludedTrades: TradeExclusion[];
  classifications: LimitedTrade[];
  warnings: ValidationIssue[];
  reviewNotes: string;
}

export interface COIPolicy {
  gl_policy_notes?: string;
  gl_exclusions?: string;
  gl_class_codes?: number;
  gl_premium_basis?: string;
  gl_inherent_exclusions?: string;
  auto_hired_coverage?: boolean;
  auto_nonowned_coverage?: boolean;
  gl_limits_per_occurrence?: number;
  umbrella_limit?: number;
  [key: string]: unknown;
}

export interface TradeRestriction {
  type: 'error' | 'warning';
  message: string;
  trade: string;
  recommendedLimit?: number;
}

export interface TradeComparison {
  added: string[];
  removed: string[];
  unchanged: string[];
  addedTradesValidation: Array<{ trade: string; validation: TradeRestriction[] }>;
  reviewRequired: boolean;
  summary: {
    tradesAdded: number;
    tradesRemoved: number;
    tradesUnchanged: number;
  };
}

export interface ClassificationValidation {
  compliant: boolean;
  limitedTrades: LimitedTrade[];
  issues: ValidationIssue[];
}

// ============================================================================
// TRADE EXCLUSION PATTERNS - Common phrases that indicate trade exclusions
// ============================================================================

/**
 * Patterns to detect trade exclusions in policy text
 * Used to match exclusion language in GL policy notes and exclusions
 */
export const TRADE_EXCLUSION_PATTERNS: Record<string, string[]> = {
    carpentry: [
      'no carpentry',
      'carpentry excluded',
      'woodworking excluded',
      'framing excluded',
    ],
    roofing: [
      'no roofing',
      'roofing excluded',
      'roof work excluded',
      'slate excluded',
      'shingle excluded',
    ],
    electrical: [
      'no electrical',
      'electrical excluded',
      'wiring excluded',
    ],
    plumbing: [
      'no plumbing',
      'plumbing excluded',
      'pipe work excluded',
    ],
    hvac: [
      'no hvac',
      'hvac excluded',
      'air conditioning excluded',
    ],
    excavation: [
      'no excavation',
      'excavation excluded',
      'digging excluded',
      'earth moving excluded',
    ],
    crane_operator: [
      'no crane',
      'crane excluded',
      'equipment operation excluded',
    ],
    scaffold: [
      'no scaffold',
      'scaffold excluded',
      'temporary structure excluded',
    ],
    concrete: [
      'no concrete',
      'concrete excluded',
      'cement work excluded',
    ],
    steel: [
      'no steel',
      'steel excluded',
      'structural steel excluded',
      'welding excluded',
    ],
};

// ============================================================================
// NCCI CLASSIFICATION CODE MAPPINGS
// ============================================================================

/**
 * NCCI classification codes mapped to construction trades
 * Reference: https://www.ncci.com/pages/classificationcodes.aspx
 */
export const NCCI_CLASS_CODE_MAPPINGS: Record<number, string[]> = {
  5402: ['carpentry'],
  5405: ['carpentry', 'framing'],
  5474: ['roofing', 'slate roofing'],
  5403: ['electrical', 'hvac', 'concrete'],
  5410: ['plumbing'],
  5478: ['excavation'],
  5485: ['crane_operator'],
  5473: ['scaffold'],
  5480: ['steel'],
};

/**
 * Minimum GL limits for high-risk trades (in dollars)
 */
export const TRADE_MINIMUM_LIMITS: Record<string, { gl_per_occurrence?: number; umbrella_required?: boolean; umbrella_minimum?: number }> = {
  excavation: {
    gl_per_occurrence: 2000000, // $2M
  },
  scaffold: {
    gl_per_occurrence: 3000000, // $3M
  },
  crane_operator: {
    umbrella_required: true,
    umbrella_minimum: 3000000, // $3M
  },
};

// ============================================================================
// VALIDATION FUNCTIONS
// ============================================================================

/**
 * Validates that a COI policy covers all required trades
 */
export function validatePolicyTradeCoverage(
  coi: COIPolicy | null | undefined,
  requiredTrades: string[] = []
): ValidationResult {
  const issues: ValidationIssue[] = [];
  const excludedTrades: TradeExclusion[] = [];
  const classifications: LimitedTrade[] = [];
  const warnings: ValidationIssue[] = [];

  if (!coi || !requiredTrades || requiredTrades.length === 0) {
    return {
      compliant: true,
      issues: [],
      excludedTrades: [],
      classifications: [],
      warnings: [],
      reviewNotes: '',
    };
  }

  // Check GL policy for exclusions
  if (coi.gl_policy_notes || coi.gl_exclusions) {
    const policyText = `${coi.gl_policy_notes || ''} ${coi.gl_exclusions || ''}`.toLowerCase();

    // Track which trades have already been excluded to avoid redundant checks
    const excludedTradeSet = new Set();

    for (const trade of requiredTrades) {
      // Skip if already excluded
      if (excludedTradeSet.has(trade)) continue;

      const tradeLower = trade.toLowerCase();
      const patterns = TRADE_EXCLUSION_PATTERNS[tradeLower] || [];

      for (const pattern of patterns) {
        if (policyText.includes(pattern)) {
          excludedTradeSet.add(trade);
          excludedTrades.push({
            trade,
            exclusion: pattern,
            source: 'gl_policy',
          });
          issues.push({
            type: 'error',
            trade,
            message: `GL policy excludes ${trade} (${pattern})`,
            severity: 'high',
          });
          break; // Stop checking other patterns for this trade
        }
      }
    }
  }

  // Check for classification limitations
  if (coi.gl_class_codes) {
    const classificationCheck = validateClassifications(
      coi.gl_class_codes,
      requiredTrades
    );

    if (!classificationCheck.compliant) {
      classifications.push(...classificationCheck.limitedTrades);
      issues.push(...classificationCheck.issues);
    }
  }

  // Check for premium basis restrictions
  if (coi.gl_premium_basis && requiredTrades.length > 1) {
    const premiumBasisText = coi.gl_premium_basis.toLowerCase();

    if (premiumBasisText.includes('single trade') || premiumBasisText.includes('one trade only')) {
      warnings.push({
        type: 'warning',
        message: 'Policy premium basis is for single trade only, but multiple trades assigned',
        trades: requiredTrades,
        severity: 'medium',
      });
    }
  }

  // Check for warranty/inherent exclusions
  if (coi.gl_inherent_exclusions) {
    const inheritantText = coi.gl_inherent_exclusions.toLowerCase();

    for (const trade of requiredTrades) {
      const tradeLower = trade.toLowerCase();
      if (inheritantText.includes(tradeLower)) {
        warnings.push({
          type: 'warning',
          trade,
          message: `GL policy has inherent/warranty exclusion that may affect ${trade}`,
          severity: 'medium',
        });
      }
    }
  }

  // Check auto policy for hired/non-owned coverage
  if (requiredTrades.some(t => ['carpentry', 'roofing', 'excavation', 'crane_operator'].includes(t))) {
    if (!coi.auto_hired_coverage || coi.auto_hired_coverage !== true) {
      warnings.push({
        type: 'warning',
        message: 'Hired auto not covered - required for construction trades',
        severity: 'high',
      });
    }

    if (!coi.auto_nonowned_coverage || coi.auto_nonowned_coverage !== true) {
      warnings.push({
        type: 'warning',
        message: 'Non-owned auto not covered - typically required for construction',
        severity: 'medium',
      });
    }
  }

  const compliant = issues.length === 0;

  return {
    compliant,
    issues,
    excludedTrades,
    classifications,
    warnings,
    reviewNotes: compileReviewNotes(issues, warnings, excludedTrades),
  };
}

/**
 * Checks for trade-specific policy restrictions
 * Validates minimum limits and coverage requirements for high-risk trades
 */
export function validateTradeRestrictions(
  coi: COIPolicy | null | undefined,
  trade: string
): TradeRestriction[] {
  const restrictions: TradeRestriction[] = [];

  if (!coi) return restrictions;

  const tradeLower = trade.toLowerCase();

  // Roofing-specific checks
  if (tradeLower.includes('roof')) {
    if (coi.gl_exclusions && coi.gl_exclusions.toLowerCase().includes('roof')) {
      restrictions.push({
        type: 'error',
        message: 'GL policy excludes roofing work',
        trade,
      });
    }

    if (
      coi.gl_premium_basis &&
      coi.gl_premium_basis.toLowerCase().includes('pitched roof')
    ) {
      restrictions.push({
        type: 'warning',
        message: 'GL premium basis restricted to specific roof pitch',
        trade,
      });
    }
  }

  // Excavation-specific checks
  if (tradeLower.includes('excavat')) {
    const minLimit = TRADE_MINIMUM_LIMITS.excavation.gl_per_occurrence;
    if (coi.gl_limits_per_occurrence < minLimit) {
      restrictions.push({
        type: 'warning',
        message: 'GL limits may be insufficient for excavation work',
        trade,
        recommendedLimit: minLimit,
      });
    }
  }

  // Crane-specific checks
  if (tradeLower.includes('crane')) {
    const minUmbrella = TRADE_MINIMUM_LIMITS.crane_operator.umbrella_minimum;
    if (!coi.umbrella_limit || coi.umbrella_limit < minUmbrella) {
      restrictions.push({
        type: 'error',
        message: `Umbrella coverage required and must be at least $${(minUmbrella / 1000000)}M for crane operations`,
        trade,
      });
    }
  }

  // Scaffold-specific checks
  if (tradeLower.includes('scaffold')) {
    const minLimit = TRADE_MINIMUM_LIMITS.scaffold.gl_per_occurrence;
    if (coi.gl_limits_per_occurrence < minLimit) {
      restrictions.push({
        type: 'warning',
        message: `GL limits should be at least $${(minLimit / 1000000)}M for scaffolding`,
        trade,
        recommendedLimit: minLimit,
      });
    }
  }

  return restrictions;
}

/**
 * Compares trades between different scenarios
 * Identifies added, removed, and unchanged trades, and validates newly added trades
 */
export function compareTradesCoverage(
  oldTrades: string[],
  newTrades: string[],
  coi: COIPolicy
): TradeComparison {
  const added = newTrades.filter(t => !oldTrades.includes(t));
  const removed = oldTrades.filter(t => !newTrades.includes(t));
  const unchanged = oldTrades.filter(t => newTrades.includes(t));

  const addedValidation = added.map(trade => ({
    trade,
    validation: validateTradeRestrictions(coi, trade),
  }));

  return {
    added,
    removed,
    unchanged,
    addedTradesValidation: addedValidation,
    reviewRequired: added.length > 0 && addedValidation.some(v => v.validation.length > 0),
    summary: {
      tradesAdded: added.length,
      tradesRemoved: removed.length,
      tradesUnchanged: unchanged.length,
    },
  };
}

/**
 * Generates detailed broker message about trade coverage issues
 * Creates a formatted message for brokers explaining validation issues
 */
export function generateBrokerTradeMessage(
  coi: COIPolicy,
  requiredTrades: string[],
  validation: ValidationResult
): string {
  const { excludedTrades, warnings, issues } = validation;

  let message = 'Certificate of Insurance Review - Trade Coverage Issues\n\n';

  if (excludedTrades.length > 0) {
    message += `CRITICAL - EXCLUSIONS FOUND:\n`;
    for (const excluded of excludedTrades) {
      message += `  • ${excluded.trade}: ${excluded.exclusion}\n`;
    }
    message += '\nPlease update the certificate to remove these exclusions or provide alternative coverage.\n\n';
  }

  if (issues.length > 0) {
    message += `ISSUES TO ADDRESS:\n`;
    for (const issue of issues) {
      message += `  • [${issue.severity.toUpperCase()}] ${issue.message}\n`;
    }
    message += '\n';
  }

  if (warnings.length > 0) {
    message += `NOTES FOR REVIEW:\n`;
    for (const warning of warnings) {
      if (warning.trade) {
        message += `  • ${warning.trade}: ${warning.message}\n`;
      } else {
        message += `  • ${warning.message}\n`;
      }
    }
    message += '\n';
  }

  message += `REQUIRED TRADES:\n`;
  for (const trade of requiredTrades) {
    message += `  • ${trade}\n`;
  }

  return message;
}

// ============================================================================
// HELPER FUNCTIONS (Internal Use)
// ============================================================================

/**
 * Validates class codes against required trades
 * Uses NCCI classification code mappings to determine coverage
 * @private
 */
function validateClassifications(
  classCode: number,
  requiredTrades: string[]
): ClassificationValidation {
  const limitedTrades: LimitedTrade[] = [];
  const issues: ValidationIssue[] = [];

  // Check each required trade
  for (const trade of requiredTrades) {
    let tradeCovered = false;
    const tradeLower = trade.toLowerCase();

    // Check if the classification code covers this trade
    // by iterating through NCCI_CLASS_CODE_MAPPINGS
    for (const [code, trades] of Object.entries(NCCI_CLASS_CODE_MAPPINGS)) {
      if (parseInt(code) === classCode) {
        // Check if any of the mapped trades match the required trade
        tradeCovered = trades.some(mappedTrade => 
          tradeLower.includes(mappedTrade.toLowerCase()) ||
          mappedTrade.toLowerCase().includes(tradeLower)
        );
        if (tradeCovered) break;
      }
    }

    if (!tradeCovered) {
      limitedTrades.push({
        trade,
        classCode,
        message: `Classification ${classCode} may not cover ${trade}`,
      });

      issues.push({
        type: 'warning',
        trade,
        message: `GL classification code ${classCode} may not fully cover ${trade}`,
        severity: 'medium',
      });
    }
  }

  return {
    compliant: limitedTrades.length === 0,
    limitedTrades,
    issues,
  };
}

/**
 * Generates admin review notes from validation results
 * @private
 */
function compileReviewNotes(
  issues: ValidationIssue[],
  warnings: ValidationIssue[],
  excludedTrades: TradeExclusion[]
): string {
  const notes: string[] = [];

  if (excludedTrades.length > 0) {
    notes.push(
      `POLICY EXCLUSIONS FOUND: ${excludedTrades.map(e => e.trade).join(', ')}`
    );
    notes.push(
      'Admin must contact broker to obtain COI with proper coverage or request waiver.'
    );
  }

  if (issues.length > 0) {
    notes.push(
      `COMPLIANCE ISSUES: ${issues.length} issue(s) found requiring review`
    );
  }

  if (warnings.length > 0) {
    notes.push(
      `WARNINGS: ${warnings.length} warning(s) - review before approval`
    );
  }

  return notes.join('\n');
}

export default {
  validatePolicyTradeCoverage,
  validateTradeRestrictions,
  compareTradesCoverage,
  generateBrokerTradeMessage,
};
