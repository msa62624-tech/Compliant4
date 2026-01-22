/**
 * Insurance Requirements System
 * Handles project-specific requirements and compliance validation
 */

// ============================================================================
// BASE INSURANCE REQUIREMENTS - UNIVERSAL REQUIREMENTS FOR ALL PROJECTS
// ============================================================================

export const UNIVERSAL_REQUIREMENTS = {
  gl: {
    endorsements: [
      { code: 'CG2010', name: 'Additional Insured (ISO CG 20 10)', required: true, blanketBasis: true },
      { code: 'CG2037', name: 'Primary & Non-Contributory', required: true, blanketBasis: true },
    ],
    waiverOfSubrogation: true,
    additionalInsured: {
      required: true,
      namedFromProject: true, // Must name all additional insureds from project setup
    },
    excludeProjectArea: false, // Cannot have exclusion for project area
    minimumLimits: {
      eachOccurrence: 1000000, // $1M
      generalAggregate: 2000000, // $2M
      productsComplOps: 1000000, // $1M
    },
  },
  
  umbrella: {
    endorsements: [
      { code: 'CG2010', name: 'Additional Insured (ISO CG 20 10)', required: true, blanketBasis: true },
      { code: 'CG2037', name: 'Primary & Non-Contributory', required: true, blanketBasis: true },
    ],
    waiverOfSubrogation: true,
    followForm: true, // Follow form on all exclusions and additional insureds
    minimumLimits: {
      eachOccurrence: 1000000, // $1M
      aggregate: 2000000, // $2M
    },
  },

  wc: {
    waiverOfSubrogation: true,
    waiverOfExcess: true,
    minimumLimits: {
      eachAccident: 1000000,
      diseasePerEmployee: 1000000,
      diseasePolicyLimit: 1000000,
    },
  },

  auto: {
    hiredNonOwnedAuto: true,
    minimumLimits: {
      combinedSingleLimit: 1000000,
    },
  },
};

// ============================================================================
// TRADE-SPECIFIC REQUIREMENTS (Tiered by Trade Type)
// ============================================================================

export const TRADE_REQUIREMENTS = {
  // TIER 1: General Construction Trades
  carpentry: {
    tier: 1,
    requiredInsurance: ['gl', 'wc', 'auto'],
    specificRequirements: {
      gl: {
        minimumLimits: { eachOccurrence: 1000000, generalAggregate: 2000000 },
      },
      wc: {
        mandatory: true,
      },
    },
  },

  'electrical': {
    tier: 1,
    requiredInsurance: ['gl', 'wc', 'auto'],
    specificRequirements: {
      gl: {
        minimumLimits: { eachOccurrence: 1000000, generalAggregate: 2000000 },
      },
      wc: {
        mandatory: true,
      },
    },
  },

  'plumbing': {
    tier: 1,
    requiredInsurance: ['gl', 'wc', 'auto'],
    specificRequirements: {
      gl: {
        minimumLimits: { eachOccurrence: 1000000, generalAggregate: 2000000 },
      },
      wc: {
        mandatory: true,
      },
    },
  },

  'hvac': {
    tier: 1,
    requiredInsurance: ['gl', 'wc', 'auto'],
    specificRequirements: {
      gl: {
        minimumLimits: { eachOccurrence: 1000000, generalAggregate: 2000000 },
      },
      wc: {
        mandatory: true,
      },
    },
  },

  // TIER 2: Specialty Trades
  'roofing': {
    tier: 2,
    requiredInsurance: ['gl', 'wc', 'auto', 'umbrella'],
    specificRequirements: {
      gl: {
        minimumLimits: { eachOccurrence: 2000000, generalAggregate: 5000000 },
      },
      umbrella: {
        minimumLimits: { eachOccurrence: 2000000, aggregate: 5000000 },
      },
      wc: {
        mandatory: true,
      },
    },
  },

  'excavation': {
    tier: 2,
    requiredInsurance: ['gl', 'wc', 'auto', 'umbrella'],
    specificRequirements: {
      gl: {
        minimumLimits: { eachOccurrence: 2000000, generalAggregate: 5000000 },
      },
      umbrella: {
        minimumLimits: { eachOccurrence: 2000000, aggregate: 5000000 },
      },
      wc: {
        mandatory: true,
      },
    },
  },

  'demolition': {
    tier: 3,
    requiredInsurance: ['gl', 'wc', 'auto', 'umbrella'],
    specificRequirements: {
      gl: {
        minimumLimits: { eachOccurrence: 2000000, generalAggregate: 5000000 },
      },
      umbrella: {
        minimumLimits: { eachOccurrence: 2000000, aggregate: 5000000 },
      },
      wc: {
        mandatory: true,
      },
    },
  },

  // TIER 3: High-Risk Trades
  'crane_operator': {
    tier: 3,
    requiredInsurance: ['gl', 'wc', 'auto', 'umbrella'],
    specificRequirements: {
      gl: {
        minimumLimits: { eachOccurrence: 3000000, generalAggregate: 6000000 },
      },
      umbrella: {
        minimumLimits: { eachOccurrence: 3000000, aggregate: 6000000 },
      },
      wc: {
        mandatory: true,
      },
    },
  },

  'scaffold': {
    tier: 3,
    requiredInsurance: ['gl', 'wc', 'auto', 'umbrella'],
    specificRequirements: {
      gl: {
        minimumLimits: { eachOccurrence: 3000000, generalAggregate: 6000000 },
      },
      umbrella: {
        minimumLimits: { eachOccurrence: 3000000, aggregate: 6000000 },
      },
      wc: {
        mandatory: true,
      },
    },
  },
};

// ============================================================================
// PROJECT-SPECIFIC MODIFIERS
// ============================================================================

export const PROJECT_MODIFIERS = {
  condo: {
    name: 'Condo Project',
    gl: {
      endorsements: [
        { code: 'CG2010', name: 'Additional Insured (ISO CG 20 10)', required: true, blanketBasis: true },
        { code: 'CG2037', name: 'Primary & Non-Contributory', required: true, blanketBasis: true },
      ],
      noCondoLimitation: true, // Cannot include condo exclusions
      waiverOfSubrogation: true,
    },
  },

  highRise: {
    name: 'High-Rise Building',
    minimumLimitIncrease: 1.5, // Increase minimum limits by 50%
  },

  hazmat: {
    name: 'Hazmat Work',
    requiredInsurance: ['gl', 'wc', 'auto', 'umbrella', 'pollution'],
    gl: {
      minimumLimits: { eachOccurrence: 5000000, generalAggregate: 10000000 },
    },
  },
};

// ============================================================================
// COMPLIANCE CHECKING
// ============================================================================

/**
 * Check if a COI meets all project requirements
 * @param {Object} coi - GeneratedCOI object with insurance details
 * @param {Object} project - Project object
 * @param {string[]} subTrades - Array of trade types for the subcontractor
 * @returns {Object} - { compliant: boolean, issues: [], warnings: [] }
 */
export async function validateCOICompliance(coi, project, subTrades) {
  const issues = [];
  const warnings = [];

  // Get all applicable requirements
  const allRequirements = buildApplicableRequirements(project, subTrades);

  // ========================================================================
  // GENERAL LIABILITY VALIDATION
  // ========================================================================
  if (allRequirements.gl) {
    const glReq = allRequirements.gl;

    // Check limits
    if (coi.gl_each_occurrence < glReq.minimumLimits.eachOccurrence) {
      issues.push({
        type: 'GL_LIMIT_INSUFFICIENT',
        field: 'Each Occurrence',
        required: glReq.minimumLimits.eachOccurrence,
        provided: coi.gl_each_occurrence,
        severity: 'error',
      });
    }

    if (coi.gl_general_aggregate < glReq.minimumLimits.generalAggregate) {
      issues.push({
        type: 'GL_AGGREGATE_INSUFFICIENT',
        field: 'General Aggregate',
        required: glReq.minimumLimits.generalAggregate,
        provided: coi.gl_general_aggregate,
        severity: 'error',
      });
    }

    if (coi.gl_products_completed_ops < glReq.minimumLimits.productsComplOps) {
      issues.push({
        type: 'GL_PRODUCTS_INSUFFICIENT',
        field: 'Products/Completed Ops',
        required: glReq.minimumLimits.productsComplOps,
        provided: coi.gl_products_completed_ops,
        severity: 'error',
      });
    }

    // Check endorsements
    const glEndorsements = coi.gl_endorsements || [];
    for (const requiredEndorsement of glReq.endorsements) {
      const hasEndorsement = glEndorsements.some(
        (e) => e.code === requiredEndorsement.code
      );
      if (!hasEndorsement) {
        issues.push({
          type: 'MISSING_ENDORSEMENT',
          field: `GL ${requiredEndorsement.code}`,
          endorsement: requiredEndorsement.name,
          severity: 'error',
        });
      }
    }

    // Check waiver of subrogation
    if (glReq.waiverOfSubrogation && !coi.gl_waiver_of_subrogation) {
      issues.push({
        type: 'MISSING_WAIVER_SUBROGATION',
        field: 'GL Waiver of Subrogation',
        severity: 'error',
      });
    }

    // Check additional insured
    if (glReq.additionalInsured?.required) {
      if (!coi.gl_additional_insured || coi.gl_additional_insured.length === 0) {
        issues.push({
          type: 'MISSING_ADDITIONAL_INSURED',
          field: 'GL Additional Insured',
          required: project.additional_insured || ['Project Owner'],
          severity: 'error',
        });
      } else {
        // Verify all project additional insureds are named
        const requiredInsured = project.additional_insured || [];
        for (const insured of requiredInsured) {
          const isNamed = coi.gl_additional_insured.some((ai) =>
            ai.toLowerCase().includes(insured.toLowerCase())
          );
          if (!isNamed) {
            warnings.push({
              type: 'MISSING_NAMED_INSURED',
              field: 'GL Additional Insured',
              missing: insured,
              provided: coi.gl_additional_insured,
              severity: 'warning',
            });
          }
        }
      }
    }

    // Check no condo exclusion (for condo projects)
    if (project.project_type === 'condo') {
      if (coi.gl_has_condo_exclusion) {
        issues.push({
          type: 'CONDO_EXCLUSION_PRESENT',
          field: 'GL Condo Exclusion',
          detail: 'Condo projects cannot have condo exclusions',
          severity: 'error',
        });
      }
    }

    // Check no project area exclusion
    if (coi.gl_has_project_area_exclusion) {
      issues.push({
        type: 'PROJECT_AREA_EXCLUSION',
        field: 'GL Project Area Exclusion',
        detail: 'Cannot exclude the project location from coverage',
        severity: 'error',
      });
    }
  }

  // ========================================================================
  // UMBRELLA/EXCESS LIABILITY VALIDATION
  // ========================================================================
  if (allRequirements.umbrella) {
    const umbrellaReq = allRequirements.umbrella;

    // Check limits
    if (coi.umbrella_each_occurrence < umbrellaReq.minimumLimits.eachOccurrence) {
      issues.push({
        type: 'UMBRELLA_LIMIT_INSUFFICIENT',
        field: 'Umbrella Each Occurrence',
        required: umbrellaReq.minimumLimits.eachOccurrence,
        provided: coi.umbrella_each_occurrence,
        severity: 'error',
      });
    }

    if (coi.umbrella_aggregate < umbrellaReq.minimumLimits.aggregate) {
      issues.push({
        type: 'UMBRELLA_AGGREGATE_INSUFFICIENT',
        field: 'Umbrella Aggregate',
        required: umbrellaReq.minimumLimits.aggregate,
        provided: coi.umbrella_aggregate,
        severity: 'error',
      });
    }

    // Check follow form
    if (umbrellaReq.followForm && !coi.umbrella_follow_form) {
      issues.push({
        type: 'UMBRELLA_NOT_FOLLOW_FORM',
        field: 'Umbrella Follow Form',
        detail: 'Excess must be "follow form" for all exclusions and additional insureds',
        severity: 'error',
      });
    }

    // Check waiver of subrogation
    if (umbrellaReq.waiverOfSubrogation && !coi.umbrella_waiver_of_subrogation) {
      issues.push({
        type: 'UMBRELLA_WAIVER_SUBROGATION',
        field: 'Umbrella Waiver of Subrogation',
        severity: 'error',
      });
    }
  }

  // ========================================================================
  // WORKERS' COMPENSATION VALIDATION
  // ========================================================================
  if (allRequirements.wc) {
    const wcReq = allRequirements.wc;

    // Check limits
    if (coi.wc_each_accident < wcReq.minimumLimits.eachAccident) {
      issues.push({
        type: 'WC_LIMIT_INSUFFICIENT',
        field: 'WC Each Accident',
        required: wcReq.minimumLimits.eachAccident,
        provided: coi.wc_each_accident,
        severity: 'error',
      });
    }

    // Check waiver of subrogation
    if (wcReq.waiverOfSubrogation && !coi.wc_waiver_of_subrogation) {
      issues.push({
        type: 'WC_WAIVER_SUBROGATION',
        field: 'WC Waiver of Subrogation',
        severity: 'error',
      });
    }

    // Check waiver of excess
    if (wcReq.waiverOfExcess && !coi.wc_waiver_of_excess) {
      issues.push({
        type: 'WC_WAIVER_EXCESS',
        field: 'WC Waiver of Excess',
        severity: 'error',
      });
    }
  }

  // ========================================================================
  // AUTO LIABILITY VALIDATION
  // ========================================================================
  if (allRequirements.auto) {
    const autoReq = allRequirements.auto;

    // Check limits
    if (coi.auto_combined_single_limit < autoReq.minimumLimits.combinedSingleLimit) {
      issues.push({
        type: 'AUTO_LIMIT_INSUFFICIENT',
        field: 'Auto Combined Single Limit',
        required: autoReq.minimumLimits.combinedSingleLimit,
        provided: coi.auto_combined_single_limit,
        severity: 'error',
      });
    }

    // Check hired and non-owned auto
    if (autoReq.hiredNonOwnedAuto && !coi.auto_hired_non_owned) {
      issues.push({
        type: 'AUTO_HIRED_NONOWNED_MISSING',
        field: 'Auto Hired & Non-Owned',
        severity: 'error',
      });
    }
  }

  // ========================================================================
  // EXPIRATION DATE VALIDATION
  // ========================================================================
  const today = new Date();
  const thirtyDaysFromNow = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);

  const checkExpiration = (expirationStr, policyType) => {
    if (!expirationStr) return;
    const expDate = new Date(expirationStr);
    if (expDate < today) {
      issues.push({
        type: 'POLICY_EXPIRED',
        field: `${policyType} Expiration`,
        expirationDate: expirationStr,
        severity: 'error',
      });
    } else if (expDate < thirtyDaysFromNow) {
      warnings.push({
        type: 'POLICY_EXPIRING_SOON',
        field: `${policyType} Expiration`,
        expirationDate: expirationStr,
        daysUntilExpiry: Math.ceil((expDate - today) / (24 * 60 * 60 * 1000)),
        severity: 'warning',
      });
    }
  };

  checkExpiration(coi.gl_expiration_date, 'GL');
  checkExpiration(coi.umbrella_expiration_date, 'Umbrella');
  checkExpiration(coi.wc_expiration_date, 'WC');
  checkExpiration(coi.auto_expiration_date, 'Auto');

  return {
    compliant: issues.length === 0,
    issues,
    warnings,
    requirementsApplied: allRequirements,
  };
}

/**
 * Build all applicable insurance requirements for a project/subcontractor combination
 */
function buildApplicableRequirements(project, subTrades = []) {
  const requirements = {};

  // Start with universal requirements
  requirements.gl = { ...UNIVERSAL_REQUIREMENTS.gl };
  requirements.umbrella = { ...UNIVERSAL_REQUIREMENTS.umbrella };
  requirements.wc = { ...UNIVERSAL_REQUIREMENTS.wc };
  requirements.auto = { ...UNIVERSAL_REQUIREMENTS.auto };

  // Apply trade-specific requirements (highest tier takes precedence)
  let highestTier = 0;
  for (const trade of subTrades) {
    const tradeReq = TRADE_REQUIREMENTS[trade?.toLowerCase()] || TRADE_REQUIREMENTS.carpentry;
    if (tradeReq.tier > highestTier) {
      highestTier = tradeReq.tier;
      for (const insType in tradeReq.specificRequirements) {
        if (requirements[insType]) {
          requirements[insType] = {
            ...requirements[insType],
            ...tradeReq.specificRequirements[insType],
          };
        }
      }
      // Add umbrella if not included yet
      if (tradeReq.requiredInsurance.includes('umbrella') && !requirements.umbrella) {
        requirements.umbrella = { ...UNIVERSAL_REQUIREMENTS.umbrella };
      }
    }
  }

  // Apply project-specific modifiers
  if (project.project_type === 'condo') {
    const condoMod = PROJECT_MODIFIERS.condo;
    requirements.gl = { ...requirements.gl, ...condoMod.gl };
  }

  if (project.project_type === 'high_rise') {
    const highRiseMod = PROJECT_MODIFIERS.highRise;
    for (const insType in requirements) {
      if (requirements[insType]?.minimumLimits) {
        for (const limitType in requirements[insType].minimumLimits) {
          requirements[insType].minimumLimits[limitType] = Math.ceil(
            requirements[insType].minimumLimits[limitType] * highRiseMod.minimumLimitIncrease
          );
        }
      }
    }
  }

  return requirements;
}

/**
 * Get readable requirement description for display
 */
export function getRequirementDescription(requirement, project, subTrades) {
  const allReqs = buildApplicableRequirements(project, subTrades);
  const desc = [];

  if (allReqs.gl) {
    desc.push(`GL: $${(allReqs.gl.minimumLimits.eachOccurrence / 1000000).toFixed(1)}M each/$${(allReqs.gl.minimumLimits.generalAggregate / 1000000).toFixed(1)}M aggregate`);
    if (allReqs.gl.endorsements) {
      desc.push(`  Requires: ${allReqs.gl.endorsements.map((e) => e.code).join(', ')}`);
    }
    if (allReqs.gl.waiverOfSubrogation) {
      desc.push(`  Waiver of Subrogation: Required`);
    }
  }

  if (allReqs.umbrella) {
    desc.push(`Umbrella: $${(allReqs.umbrella.minimumLimits.eachOccurrence / 1000000).toFixed(1)}M each/$${(allReqs.umbrella.minimumLimits.aggregate / 1000000).toFixed(1)}M aggregate`);
    if (allReqs.umbrella.followForm) {
      desc.push(`  Follow Form: Required`);
    }
  }

  if (allReqs.wc) {
    desc.push(`WC: $${(allReqs.wc.minimumLimits.eachAccident / 1000000).toFixed(1)}M each accident`);
    if (allReqs.wc.waiverOfSubrogation) {
      desc.push(`  Waiver of Subrogation: Required`);
    }
    if (allReqs.wc.waiverOfExcess) {
      desc.push(`  Waiver of Excess: Required`);
    }
  }

  if (allReqs.auto) {
    desc.push(`Auto: $${(allReqs.auto.minimumLimits.combinedSingleLimit / 1000000).toFixed(1)}M CSL`);
    if (allReqs.auto.hiredNonOwnedAuto) {
      desc.push(`  Hired & Non-Owned: Required`);
    }
  }

  return desc.join('\n');
}

/**
 * Get all available trades for selection
 */
export function getAvailableTrades() {
  return Object.keys(TRADE_REQUIREMENTS).map((key) => ({
    value: key,
    label: key.charAt(0).toUpperCase() + key.slice(1).replace('_', ' '),
    tier: TRADE_REQUIREMENTS[key].tier,
  }));
}

/**
 * Get tier-specific trades only
 */
export function getTradesByTier(tier) {
  return Object.entries(TRADE_REQUIREMENTS)
    .filter(([, req]) => req.tier === tier)
    .map(([key, req]) => ({
      value: key,
      label: key.charAt(0).toUpperCase() + key.slice(1).replace('_', ' '),
      tier: req.tier,
    }));
}
