/**
 * Insurance Requirements System
 * Handles project-specific requirements and compliance validation
 */

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface Endorsement {
  code: string;
  name: string;
  required: boolean;
  blanketBasis: boolean;
}

export interface MinimumLimits {
  eachOccurrence?: number;
  generalAggregate?: number;
  productsComplOps?: number;
  aggregate?: number;
  eachAccident?: number;
  diseasePerEmployee?: number;
  diseasePolicyLimit?: number;
  combinedSingleLimit?: number;
}

export interface AdditionalInsuredRequirement {
  required: boolean;
  namedFromProject: boolean;
}

export interface GLRequirements {
  endorsements: Endorsement[];
  waiverOfSubrogation: boolean;
  additionalInsured: AdditionalInsuredRequirement;
  excludeProjectArea: boolean;
  minimumLimits: MinimumLimits;
  noCondoLimitation?: boolean;
}

export interface UmbrellaRequirements {
  endorsements: Endorsement[];
  waiverOfSubrogation: boolean;
  followForm: boolean;
  minimumLimits: MinimumLimits;
}

export interface WCRequirements {
  waiverOfSubrogation: boolean;
  waiverOfExcess: boolean;
  minimumLimits: MinimumLimits;
  mandatory?: boolean;
}

export interface AutoRequirements {
  hiredNonOwnedAuto: boolean;
  minimumLimits: MinimumLimits;
}

export interface UniversalRequirements {
  gl: GLRequirements;
  umbrella: UmbrellaRequirements;
  wc: WCRequirements;
  auto: AutoRequirements;
}

export type InsuranceType = 'gl' | 'umbrella' | 'wc' | 'auto';

export interface TradeSpecificRequirements {
  gl?: Partial<GLRequirements>;
  umbrella?: Partial<UmbrellaRequirements>;
  wc?: Partial<WCRequirements>;
  auto?: Partial<AutoRequirements>;
}

export interface TradeRequirement {
  tier: number;
  requiredInsurance: string[];
  specificRequirements: TradeSpecificRequirements;
}

export interface ProjectModifier {
  name: string;
  minimumLimitIncrease?: number;
  requiredInsurance?: string[];
  gl?: Partial<GLRequirements>;
}

export type ProjectType = 'condo' | 'high_rise' | 'standard';

export interface Project {
  id: string;
  project_type?: ProjectType;
  project_name?: string;
  project_address?: string;
  additional_insured?: string[];
  [key: string]: unknown;
}

export interface COI {
  id?: string;
  gl_each_occurrence?: number;
  gl_general_aggregate?: number;
  gl_products_completed_ops?: number;
  gl_endorsements?: Endorsement[];
  gl_waiver_of_subrogation?: boolean;
  gl_additional_insured?: string[];
  gl_has_condo_exclusion?: boolean;
  gl_has_project_area_exclusion?: boolean;
  gl_expiration_date?: string;
  umbrella_each_occurrence?: number;
  umbrella_aggregate?: number;
  umbrella_follow_form?: boolean;
  umbrella_waiver_of_subrogation?: boolean;
  umbrella_expiration_date?: string;
  wc_each_accident?: number;
  wc_waiver_of_subrogation?: boolean;
  wc_waiver_of_excess?: boolean;
  wc_expiration_date?: string;
  auto_combined_single_limit?: number;
  auto_hired_non_owned?: boolean;
  auto_expiration_date?: string;
  [key: string]: unknown;
}

export type IssueSeverity = 'error' | 'warning';

export interface ComplianceIssue {
  type: string;
  field: string;
  severity: IssueSeverity;
  required?: number;
  provided?: number;
  endorsement?: string;
  detail?: string;
  expirationDate?: string;
  missing?: string;
  daysUntilExpiry?: number;
}

export interface ValidationResult {
  compliant: boolean;
  issues: ComplianceIssue[];
  warnings: ComplianceIssue[];
  requirementsApplied?: Record<string, unknown>;
}

export interface TradeOption {
  value: string;
  label: string;
  tier: number;
}

// ============================================================================
// BASE INSURANCE REQUIREMENTS - UNIVERSAL REQUIREMENTS FOR ALL PROJECTS
// ============================================================================

export const UNIVERSAL_REQUIREMENTS: UniversalRequirements = {
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

export const TRADE_REQUIREMENTS: Record<string, TradeRequirement> = {
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

  // Additional Tier 1 common trades
  'concrete': {
    tier: 1,
    requiredInsurance: ['gl', 'wc', 'auto'],
    specificRequirements: { gl: { minimumLimits: { eachOccurrence: 1000000, generalAggregate: 2000000 } }, wc: { mandatory: true } },
  },
  'masonry': {
    tier: 1,
    requiredInsurance: ['gl', 'wc', 'auto'],
    specificRequirements: { gl: { minimumLimits: { eachOccurrence: 1000000, generalAggregate: 2000000 } }, wc: { mandatory: true } },
  },
  'drywall': {
    tier: 1,
    requiredInsurance: ['gl', 'wc', 'auto'],
    specificRequirements: { gl: { minimumLimits: { eachOccurrence: 1000000, generalAggregate: 2000000 } }, wc: { mandatory: true } },
  },
  'painting': {
    tier: 1,
    requiredInsurance: ['gl', 'wc', 'auto'],
    specificRequirements: { gl: { minimumLimits: { eachOccurrence: 1000000, generalAggregate: 2000000 } }, wc: { mandatory: true } },
  },
  'flooring': {
    tier: 1,
    requiredInsurance: ['gl', 'wc', 'auto'],
    specificRequirements: { gl: { minimumLimits: { eachOccurrence: 1000000, generalAggregate: 2000000 } }, wc: { mandatory: true } },
  },
  'siding': {
    tier: 1,
    requiredInsurance: ['gl', 'wc', 'auto'],
    specificRequirements: { gl: { minimumLimits: { eachOccurrence: 1000000, generalAggregate: 2000000 } }, wc: { mandatory: true } },
  },
  'glazing': {
    tier: 1,
    requiredInsurance: ['gl', 'wc', 'auto'],
    specificRequirements: { gl: { minimumLimits: { eachOccurrence: 1000000, generalAggregate: 2000000 } }, wc: { mandatory: true } },
  },
  'windows_doors': {
    tier: 1,
    requiredInsurance: ['gl', 'wc', 'auto'],
    specificRequirements: { gl: { minimumLimits: { eachOccurrence: 1000000, generalAggregate: 2000000 } }, wc: { mandatory: true } },
  },
  'insulation': {
    tier: 1,
    requiredInsurance: ['gl', 'wc', 'auto'],
    specificRequirements: { gl: { minimumLimits: { eachOccurrence: 1000000, generalAggregate: 2000000 } }, wc: { mandatory: true } },
  },
  'sheet_metal': {
    tier: 1,
    requiredInsurance: ['gl', 'wc', 'auto'],
    specificRequirements: { gl: { minimumLimits: { eachOccurrence: 1000000, generalAggregate: 2000000 } }, wc: { mandatory: true } },
  },
  'tile': {
    tier: 1,
    requiredInsurance: ['gl', 'wc', 'auto'],
    specificRequirements: { gl: { minimumLimits: { eachOccurrence: 1000000, generalAggregate: 2000000 } }, wc: { mandatory: true } },
  },
  'millwork': {
    tier: 1,
    requiredInsurance: ['gl', 'wc', 'auto'],
    specificRequirements: { gl: { minimumLimits: { eachOccurrence: 1000000, generalAggregate: 2000000 } }, wc: { mandatory: true } },
  },
  'landscaping': {
    tier: 1,
    requiredInsurance: ['gl', 'wc', 'auto'],
    specificRequirements: { gl: { minimumLimits: { eachOccurrence: 1000000, generalAggregate: 2000000 } }, wc: { mandatory: true } },
  },
  'paving': {
    tier: 1,
    requiredInsurance: ['gl', 'wc', 'auto'],
    specificRequirements: { gl: { minimumLimits: { eachOccurrence: 1000000, generalAggregate: 2000000 } }, wc: { mandatory: true } },
  },
  'steel_erection': {
    tier: 1,
    requiredInsurance: ['gl', 'wc', 'auto'],
    specificRequirements: { gl: { minimumLimits: { eachOccurrence: 1000000, generalAggregate: 2000000 } }, wc: { mandatory: true } },
  },
  'rebar': {
    tier: 1,
    requiredInsurance: ['gl', 'wc', 'auto'],
    specificRequirements: { gl: { minimumLimits: { eachOccurrence: 1000000, generalAggregate: 2000000 } }, wc: { mandatory: true } },
  },
  'fire_protection': {
    tier: 1,
    requiredInsurance: ['gl', 'wc', 'auto'],
    specificRequirements: { gl: { minimumLimits: { eachOccurrence: 1000000, generalAggregate: 2000000 } }, wc: { mandatory: true } },
  },
  'elevator': {
    tier: 1,
    requiredInsurance: ['gl', 'wc', 'auto'],
    specificRequirements: { gl: { minimumLimits: { eachOccurrence: 1000000, generalAggregate: 2000000 } }, wc: { mandatory: true } },
  },
  'waterproofing': {
    tier: 1,
    requiredInsurance: ['gl', 'wc', 'auto'],
    specificRequirements: { gl: { minimumLimits: { eachOccurrence: 1000000, generalAggregate: 2000000 } }, wc: { mandatory: true } },
  },
  'caulking': {
    tier: 1,
    requiredInsurance: ['gl', 'wc', 'auto'],
    specificRequirements: { gl: { minimumLimits: { eachOccurrence: 1000000, generalAggregate: 2000000 } }, wc: { mandatory: true } },
  },
  'acoustical_ceiling': {
    tier: 1,
    requiredInsurance: ['gl', 'wc', 'auto'],
    specificRequirements: { gl: { minimumLimits: { eachOccurrence: 1000000, generalAggregate: 2000000 } }, wc: { mandatory: true } },
  },
  'sitework': {
    tier: 1,
    requiredInsurance: ['gl', 'wc', 'auto'],
    specificRequirements: { gl: { minimumLimits: { eachOccurrence: 1000000, generalAggregate: 2000000 } }, wc: { mandatory: true } },
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

export const PROJECT_MODIFIERS: Record<string, ProjectModifier> = {
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
 */
export async function validateCOICompliance(
  coi: COI,
  project: Project,
  subTrades: string[]
): Promise<ValidationResult> {
  const issues: ComplianceIssue[] = [];
  const warnings: ComplianceIssue[] = [];

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
function buildApplicableRequirements(
  project: Project,
  subTrades: string[] = []
): Record<string, unknown> {
  const requirements: Record<string, unknown> = {};

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
export function getRequirementDescription(
  requirement: unknown,
  project: Project,
  subTrades: string[]
): string {
  const allReqs = buildApplicableRequirements(project, subTrades);
  const desc: string[] = [];

  if ((allReqs as any).gl) {
    desc.push(`GL: $${((allReqs as any).gl.minimumLimits.eachOccurrence / 1000000).toFixed(1)}M each/$${((allReqs as any).gl.minimumLimits.generalAggregate / 1000000).toFixed(1)}M aggregate`);
    if ((allReqs as any).gl.endorsements) {
      desc.push(`  Requires: ${(allReqs as any).gl.endorsements.map((e: Endorsement) => e.code).join(', ')}`);
    }
    if ((allReqs as any).gl.waiverOfSubrogation) {
      desc.push(`  Waiver of Subrogation: Required`);
    }
  }

  if ((allReqs as any).umbrella) {
    desc.push(`Umbrella: $${((allReqs as any).umbrella.minimumLimits.eachOccurrence / 1000000).toFixed(1)}M each/$${((allReqs as any).umbrella.minimumLimits.aggregate / 1000000).toFixed(1)}M aggregate`);
    if ((allReqs as any).umbrella.followForm) {
      desc.push(`  Follow Form: Required`);
    }
  }

  if ((allReqs as any).wc) {
    desc.push(`WC: $${((allReqs as any).wc.minimumLimits.eachAccident / 1000000).toFixed(1)}M each accident`);
    if ((allReqs as any).wc.waiverOfSubrogation) {
      desc.push(`  Waiver of Subrogation: Required`);
    }
    if ((allReqs as any).wc.waiverOfExcess) {
      desc.push(`  Waiver of Excess: Required`);
    }
  }

  if ((allReqs as any).auto) {
    desc.push(`Auto: $${((allReqs as any).auto.minimumLimits.combinedSingleLimit / 1000000).toFixed(1)}M CSL`);
    if ((allReqs as any).auto.hiredNonOwnedAuto) {
      desc.push(`  Hired & Non-Owned: Required`);
    }
  }

  return desc.join('\n');
}

/**
 * Get all available trades for selection
 */
export function getAvailableTrades(): TradeOption[] {
  const base = Object.keys(TRADE_REQUIREMENTS).map((key) => ({
    value: key,
    label: key.charAt(0).toUpperCase() + key.slice(1).replace(/_/g, ' '),
    tier: TRADE_REQUIREMENTS[key].tier,
  }));

  // Synthetic scope-based trade categories requested by user
  const synthetic = [
    {
      value: 'exterior_above_2_stories',
      label: 'Any exterior work above 2 stories',
      tier: 2,
    },
    {
      value: 'exterior_below_2_stories',
      label: 'Any exterior work 2 stories or below',
      tier: 1,
    }
  ];

  return [...base, ...synthetic];
}

/**
 * Get tier-specific trades only
 */
export function getTradesByTier(tier: number): TradeOption[] {
  return Object.entries(TRADE_REQUIREMENTS)
    .filter(([, req]) => req.tier === tier)
    .map(([key, req]) => ({
      value: key,
      label: key.charAt(0).toUpperCase() + key.slice(1).replace('_', ' '),
      tier: req.tier,
    }));
}

/**
 * Extract unique tiers from program requirements
 * Returns tiers sorted (e.g., [A, B, C, D] or [1, 2, 3])
 */
export function getTiersFromRequirements(requirements: any[] = []): string[] {
  if (!Array.isArray(requirements)) return [];
  // Optimized: filter first, then map
  const tierSet = new Set(requirements.filter(r => r.tier).map(r => r.tier));
  if (tierSet.size === 0) return [];
  
  // Sort tiers - handles both letter (A, B, C, D) and numeric (1, 2, 3) tiers
  const tierArray = Array.from(tierSet);
  return tierArray.sort((a: any, b: any) => {
    // If both are single letters, sort alphabetically
    if (/^[a-z]$/.test(a) && /^[a-z]$/.test(b)) {
      return a.localeCompare(b);
    }
    // If both are numbers, sort numerically
    if (!isNaN(a) && !isNaN(b)) {
      return Number(a) - Number(b);
    }
    // Otherwise, sort as strings
    return String(a).localeCompare(String(b));
  });
}

/**
 * Get tier label/description for display
 * Handles both letter tiers (A, B, C, D) and numeric tiers (1, 2, 3)
 */
export function getTierLabel(tier: string | number | null | undefined): string {
  if (!tier) return 'Standard';
  
  const tierStr = String(tier).toUpperCase();
  
  // Letter-based tier descriptions
  const letterTierLabels: Record<string, string> = {
    'A': 'Tier A - Prime Contractor (Highest Risk)',
    'B': 'Tier B - Major Subcontractor',
    'C': 'Tier C - Standard Subcontractor',
    'D': 'Tier D - All Other Trades',
    'STANDARD': 'Standard Requirements'
  };
  
  // Number-based tier descriptions (legacy)
  const numberTierLabels: Record<string, string> = {
    '1': 'Tier 1 - General Construction',
    '2': 'Tier 2 - Specialty Trades',
    '3': 'Tier 3 - High-Risk Trades'
  };
  
  return letterTierLabels[tierStr] || numberTierLabels[tierStr] || `Tier ${tierStr}`;
}
