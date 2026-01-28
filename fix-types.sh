#!/bin/bash

# Script to systematically add type imports to component files

FILES=(
  "src/components/COIReview.tsx"
  "src/components/ProjectDetails.tsx"
  "src/components/InsurancePrograms.tsx"
  "src/components/Contractors.tsx"
  "src/components/MessagingCenter.tsx"
  "src/components/BrokerInfoForm.tsx"
  "src/components/BrokerUploadCOI.tsx"
  "src/components/SubcontractorPortal.tsx"
  "src/components/GCProjects.tsx"
  "src/components/AdminCOIApprovalDashboard.tsx"
  "src/components/GCDetails.tsx"
  "src/components/DeficiencyMessenger.tsx"
  "src/components/TradeChangeValidator.tsx"
  "src/components/SubRequirements.tsx"
  "src/components/GCSubscription.tsx"
  "src/components/PolicyRenewalSystem.tsx"
  "src/components/NYCDOBLookup.tsx"
  "src/components/ComplianceReview.tsx"
  "src/components/ProjectRequirementsManager.tsx"
  "src/components/GCProjectView.tsx"
  "src/components/Financials.tsx"
  "src/components/AdminBookkeeping.tsx"
  "src/components/GCDashboard.tsx"
  "src/components/BrokerDashboard.tsx"
  "src/components/SubcontractorDashboard.tsx"
)

for file in "${FILES[@]}"; do
  if [ -f "$file" ]; then
    # Check if import doesn't already exist
    if ! grep -q "from '@/api-types'" "$file"; then
      # Add import after the last import statement
      sed -i '/^import.*from/a\import type * as ApiTypes from "@/api-types";' "$file" | head -1
      echo "Added types import to $file"
    fi
  fi
done

echo "Type imports added!"
