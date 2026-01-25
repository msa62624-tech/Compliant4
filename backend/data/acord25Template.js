/**
 * ACORD 25 Certificate of Liability Insurance Template
 * Standard template data for generating sample and actual COIs
 * Based on ACORD 25 (2016/03) format
 */

export const acord25Template = {
  // Form metadata
  formVersion: 'ACORD 25 (2016/03)',
  formTitle: 'CERTIFICATE OF LIABILITY INSURANCE',
  
  // Standard ACORD disclaimer text
  disclaimerText: `THIS IS TO CERTIFY THAT THE POLICIES OF INSURANCE LISTED BELOW HAVE BEEN ISSUED TO THE INSURED NAMED ABOVE FOR THE POLICY PERIOD INDICATED. NOTWITHSTANDING ANY REQUIREMENT, TERM OR CONDITION OF ANY CONTRACT OR OTHER DOCUMENT WITH RESPECT TO WHICH THIS CERTIFICATE MAY BE ISSUED OR MAY PERTAIN, THE INSURANCE AFFORDED BY THE POLICIES DESCRIBED HEREIN IS SUBJECT TO ALL THE TERMS, EXCLUSIONS AND CONDITIONS OF SUCH POLICIES. LIMITS SHOWN MAY HAVE BEEN REDUCED BY PAID CLAIMS.`,
  
  footerText: '© 1988-2015 ACORD CORPORATION. All rights reserved.\nThe ACORD name and logo are registered marks of ACORD',
  
  // Sample Producer/Broker Information
  sampleProducer: {
    name: 'ABC Insurance Brokers LLC',
    contactName: 'Sarah Williams',
    address: '123 Insurance Plaza, Suite 500',
    city: 'New York',
    state: 'NY',
    zipCode: '10005',
    phone: '(212) 555-1234',
    fax: '(212) 555-1235',
    email: 'sarah@abcbrokers.com',
    naic: '12345'
  },
  
  // Sample Insured (Subcontractor) Information
  sampleInsured: {
    name: 'Sample Construction Company LLC',
    address: '456 Builder Avenue',
    city: 'Brooklyn',
    state: 'NY',
    zipCode: '11201',
    phone: '(718) 555-5678',
    email: 'info@sampleconstruction.com'
  },
  
  // Sample Insurance Companies (Insurers A-F)
  sampleInsurers: {
    A: {
      name: 'National Liability Insurance Co.',
      naic: '10001',
      amBestRating: 'A+'
    },
    B: {
      name: 'State Workers Compensation Fund',
      naic: '10002',
      amBestRating: 'A'
    },
    C: {
      name: 'American Auto Insurance Company',
      naic: '10003',
      amBestRating: 'A+'
    },
    D: {
      name: 'Umbrella Coverage Corporation',
      naic: '10004',
      amBestRating: 'A++'
    },
    E: {
      name: 'Professional Liability Insurers',
      naic: '10005',
      amBestRating: 'A'
    },
    F: {
      name: 'Pollution Coverage Specialists',
      naic: '10006',
      amBestRating: 'A+'
    }
  },
  
  // Standard Coverage Types with typical limits
  coverageTypes: {
    generalLiability: {
      type: 'COMMERCIAL GENERAL LIABILITY',
      claimsOccurrence: 'X', // or 'CLAIMS-MADE'
      policyType: 'X', // Standard policy
      policyNumber: 'GL-2026-123456',
      effectiveDate: '01/01/2026',
      expirationDate: '01/01/2027',
      limits: {
        eachOccurrence: 1000000,
        damageToRentedPremises: 300000,
        medicalExpense: 10000,
        personalAdvInjury: 1000000,
        generalAggregate: 2000000,
        productsCompletedOps: 2000000
      },
      additionalInsureds: true,
      primaryNonContributory: true,
      waiverOfSubrogation: true
    },
    
    automobile: {
      type: 'AUTOMOBILE LIABILITY',
      anyAuto: false,
      allOwnedAutos: true,
      scheduledAutos: false,
      hiredAutos: true,
      nonOwnedAutos: true,
      policyNumber: 'AUTO-2026-789012',
      effectiveDate: '01/01/2026',
      expirationDate: '01/01/2027',
      limits: {
        combinedSingleLimit: 1000000,
        bodilyInjuryPerPerson: null,
        bodilyInjuryPerAccident: null,
        propertyDamage: null
      },
      additionalInsureds: true,
      waiverOfSubrogation: true
    },
    
    umbrella: {
      type: 'UMBRELLA LIAB',
      occurrence: true,
      claimsMade: false,
      policyNumber: 'UMB-2026-345678',
      effectiveDate: '01/01/2026',
      expirationDate: '01/01/2027',
      limits: {
        eachOccurrence: 5000000,
        aggregate: 5000000
      },
      retention: 10000,
      additionalInsureds: true,
      primaryNonContributory: true
    },
    
    workersCompensation: {
      type: 'WORKERS COMPENSATION AND EMPLOYERS LIABILITY',
      statutoryLimits: true,
      policyNumber: 'WC-2026-901234',
      effectiveDate: '01/01/2026',
      expirationDate: '01/01/2027',
      proprietorOfficerExcluded: false,
      limits: {
        elEachAccident: 1000000,
        elDiseasePolicyLimit: 1000000,
        elDiseaseEachEmployee: 1000000
      },
      waiverOfSubrogation: true
    },
    
    professionalLiability: {
      type: 'PROFESSIONAL LIABILITY',
      claimsMade: true,
      policyNumber: 'PROF-2026-567890',
      effectiveDate: '01/01/2026',
      expirationDate: '01/01/2027',
      limits: {
        eachClaim: 1000000,
        aggregate: 2000000
      },
      retroactiveDate: '01/01/2020'
    },
    
    pollutionLiability: {
      type: 'POLLUTION LIABILITY',
      claimsMade: true,
      policyNumber: 'POLL-2026-234567',
      effectiveDate: '01/01/2026',
      expirationDate: '01/01/2027',
      limits: {
        eachClaim: 1000000,
        aggregate: 2000000
      }
    }
  },
  
  // Description of Operations / Locations / Vehicles section
  sampleDescriptions: {
    standard: 'Certificate holder, entities listed as Additional Insured, and all other parties required by written contract are included as additional insureds on the General Liability and Umbrella policies for ongoing and completed operations on a primary and non-contributory basis. General Liability, Auto Liability, Umbrella, and Workers Compensation policies include waiver of subrogation in favor of certificate holder as required by written contract.',
    
    withProject: (projectName, projectAddress) => 
      `RE: ${projectName}\nProject Location: ${projectAddress}\n\nCertificate holder and entities listed as Additional Insured are included as additional insureds on the General Liability and Umbrella policies for ongoing and completed operations on a primary and non-contributory basis as required by written contract. General Liability, Auto Liability, Umbrella, and Workers Compensation policies include waiver of subrogation in favor of certificate holder.`,
    
    withAdditionalInsured: (aiName) =>
      `${aiName} is included as Additional Insured as required by written contract for the project listed below. Coverage is primary and non-contributory. Waiver of Subrogation applies per contract requirements.`
  },
  
  // Sample Certificate Holder
  sampleCertificateHolder: {
    name: 'ABC Development Company',
    attention: 'Risk Management Department',
    address: '789 Owner Boulevard, Suite 1000',
    city: 'New York',
    state: 'NY',
    zipCode: '10001'
  },
  
  // Cancellation clause
  cancellationClause: 'SHOULD ANY OF THE ABOVE DESCRIBED POLICIES BE CANCELLED BEFORE THE EXPIRATION DATE THEREOF, NOTICE WILL BE DELIVERED IN ACCORDANCE WITH THE POLICY PROVISIONS.',
  
  // Additional Insured endorsements
  endorsements: {
    glAdditionalInsured: 'CG 20 10 04 13 - Additional Insured - Owners, Lessees or Contractors - Scheduled Person or Organization',
    glPrimaryNonContributory: 'CG 20 01 04 13 - Primary and Non-Contributory - Other Insurance Condition',
    glWaiverSubrogation: 'CG 24 04 05 09 - Waiver of Transfer of Rights of Recovery Against Others to Us',
    autoAdditionalInsured: 'CA 20 48 - Designated Insured for Covered Autos Liability Coverage',
    autoWaiverSubrogation: 'CA 04 44 - Waiver of Transfer of Rights of Recovery Against Others to Us',
    umbrellaAdditionalInsured: 'Additional Insured - Primary and Non-Contributory',
    wcWaiverSubrogation: 'WC 00 03 13 - Waiver of Our Right to Recover from Others'
  },
  
  // State-specific requirements
  stateRequirements: {
    NY: {
      workersComp: 'All employees must be covered under NYS Workers Compensation Law',
      disability: 'NYS Disability Benefits Insurance required',
      dbbl: 'DBL Policy # and Carrier information required'
    },
    NJ: {
      workersComp: 'Coverage under NJ Workers Compensation Law',
      disability: 'NJ Temporary Disability Benefits Law coverage required'
    },
    CT: {
      workersComp: 'CT Workers Compensation Act compliance required'
    },
    PA: {
      workersComp: 'PA Workers Compensation Act compliance required'
    }
  }
};

/**
 * Generate complete COI data using template with custom overrides
 * @param {object} overrides - Custom data to override template defaults
 * @returns {object} Complete COI data ready for PDF generation
 */
export function generateCOIData(overrides = {}) {
  const template = acord25Template;
  
  return {
    // Form information
    formVersion: template.formVersion,
    formTitle: template.formTitle,
    issueDate: overrides.issueDate || new Date().toLocaleDateString('en-US'),
    
    // Producer/Broker
    producer: overrides.producer || template.sampleProducer,
    
    // Insured
    insured: overrides.insured || template.sampleInsured,
    
    // Insurers
    insurers: overrides.insurers || template.sampleInsurers,
    
    // Coverages - merge with template defaults
    coverages: {
      generalLiability: { ...template.coverageTypes.generalLiability, ...(overrides.generalLiability || {}) },
      automobile: { ...template.coverageTypes.automobile, ...(overrides.automobile || {}) },
      umbrella: overrides.includeUmbrella ? { ...template.coverageTypes.umbrella, ...(overrides.umbrella || {}) } : null,
      workersCompensation: { ...template.coverageTypes.workersCompensation, ...(overrides.workersCompensation || {}) },
      professionalLiability: overrides.includeProfessional ? { ...template.coverageTypes.professionalLiability, ...(overrides.professionalLiability || {}) } : null,
      pollutionLiability: overrides.includePollution ? { ...template.coverageTypes.pollutionLiability, ...(overrides.pollutionLiability || {}) } : null
    },
    
    // Description
    description: overrides.description || template.sampleDescriptions.standard,
    
    // Certificate Holder
    certificateHolder: overrides.certificateHolder || template.sampleCertificateHolder,
    
    // Additional fields
    disclaimerText: template.disclaimerText,
    cancellationClause: template.cancellationClause,
    footerText: template.footerText,
    endorsements: template.endorsements,
    
    // Metadata
    isSample: overrides.isSample !== false, // Default to sample unless explicitly set to false
    generatedAt: new Date().toISOString()
  };
}

export default acord25Template;
