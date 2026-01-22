/**
 * policyTradeValidator.js
 * 
 * Validates insurance policies against trade requirements
 * Checks for:
 * - Trade exclusions in the policy
 * - Classification limitations
 * - Premium basis restrictions
 * - Warranty exclusions
 */

/**
 * Validates that a COI policy covers all required trades
 * 
 * @param {Object} coi - Certificate of Insurance
 * @param {Array<string>} requiredTrades - Trades that must be covered (e.g., ['carpentry', 'roofing'])
 * @returns {Object} { compliant, excludedTrades, classifications, warnings }
 */
export function validatePolicyTradeCoverage(coi, requiredTrades = []) {
  const issues = [];
  const excludedTrades = [];
  const classifications = [];
  const warnings = [];

  if (!coi || !requiredTrades || requiredTrades.length === 0) {
    return {
      compliant: true,
      excludedTrades: [],
      classifications: [],
      warnings: [],
    };
  }

  // Common trade exclusion phrases to check for in policy
  const tradeExclusionPatterns = {
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

  // Check GL policy for exclusions
  if (coi.gl_policy_notes || coi.gl_exclusions) {
    const policyText = `${coi.gl_policy_notes || ''} ${coi.gl_exclusions || ''}`.toLowerCase();

    for (const trade of requiredTrades) {
      const tradeLower = trade.toLowerCase();
      const patterns = tradeExclusionPatterns[tradeLower] || [];

      for (const pattern of patterns) {
        if (policyText.includes(pattern)) {
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
          break;
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
    if (!coi.auto_hired_coverage || coi.auto_hired_coverage === false) {
      warnings.push({
        type: 'warning',
        message: 'Hired auto not covered - required for construction trades',
        severity: 'high',
      });
    }

    if (!coi.auto_nonowned_coverage || coi.auto_nonowned_coverage === false) {
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
 * Validates class codes against required trades
 */
function validateClassifications(classCode, requiredTrades) {
  const limitedTrades = [];
  const issues = [];

  // NCCI classification code mappings (for reference/documentation)
  // eslint-disable-next-line no-unused-vars
  const classCodeTrades = {
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

  // Check each required trade
  for (const trade of requiredTrades) {
    let tradeCovered = false;

    // This is simplified - real implementation would need comprehensive NCCI mapping
    const tradeLower = trade.toLowerCase();

    if (tradeLower.includes('carpenter') || tradeLower.includes('framing')) {
      tradeCovered = [5402, 5405, 5403].includes(classCode);
    } else if (tradeLower.includes('roof')) {
      tradeCovered = [5474, 5405].includes(classCode);
    } else if (tradeLower.includes('electrical')) {
      tradeCovered = [5403, 5427].includes(classCode);
    } else if (tradeLower.includes('plumb')) {
      tradeCovered = [5410, 5403].includes(classCode);
    } else if (tradeLower.includes('hvac')) {
      tradeCovered = [5403, 5410].includes(classCode);
    } else if (tradeLower.includes('excavat')) {
      tradeCovered = [5478, 5403].includes(classCode);
    } else if (tradeLower.includes('crane')) {
      tradeCovered = [5485, 5403].includes(classCode);
    } else if (tradeLower.includes('scaffold')) {
      tradeCovered = [5473, 5403].includes(classCode);
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
 * Checks for trade-specific policy restrictions
 */
export function validateTradeRestrictions(coi, trade) {
  const restrictions = [];

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
    if (coi.gl_limits_per_occurrence < 2000000) {
      restrictions.push({
        type: 'warning',
        message: 'GL limits may be insufficient for excavation work',
        trade,
        recommendedLimit: 2000000,
      });
    }
  }

  // Crane-specific checks
  if (tradeLower.includes('crane')) {
    if (!coi.umbrella_limit || coi.umbrella_limit < 3000000) {
      restrictions.push({
        type: 'error',
        message: 'Umbrella coverage required and must be at least $3M for crane operations',
        trade,
      });
    }
  }

  // Scaffold-specific checks
  if (tradeLower.includes('scaffold')) {
    if (coi.gl_limits_per_occurrence < 3000000) {
      restrictions.push({
        type: 'warning',
        message: 'GL limits should be at least $3M for scaffolding',
        trade,
        recommendedLimit: 3000000,
      });
    }
  }

  return restrictions;
}

/**
 * Generates admin review notes from validation results
 */
function compileReviewNotes(issues, warnings, excludedTrades) {
  const notes = [];

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

/**
 * Compares trades between different scenarios
 */
export function compareTradesCoverage(oldTrades, newTrades, coi) {
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
 */
export function generateBrokerTradeMessage(coi, requiredTrades, validation) {
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

export default {
  validatePolicyTradeCoverage,
  validateTradeRestrictions,
  compareTradesCoverage,
  generateBrokerTradeMessage,
};
