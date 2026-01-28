#!/bin/bash

# Add type annotations to common API patterns
files=$(find src/components -name "*.tsx" -type f)

for file in $files; do
  # Fix common entity calls with type assertions
  # Pattern: .list() -> .list() as EntityType[]
  sed -i 's/GeneratedCOI\.list()/GeneratedCOI.list() as ApiTypes.GeneratedCOI[]/g' "$file"
  sed -i 's/Project\.list()/Project.list() as ApiTypes.Project[]/g' "$file"
  sed -i 's/Contractor\.list()/Contractor.list() as ApiTypes.Contractor[]/g' "$file"
  sed -i 's/Subscription\.list(/Subscription.list(/g' "$file"
  sed -i 's/InsuranceProgram\.list()/InsuranceProgram.list() as ApiTypes.InsuranceProgram[]/g' "$file"
  sed -i 's/SubInsuranceRequirement\.list()/SubInsuranceRequirement.list() as ApiTypes.SubInsuranceRequirement[]/g' "$file"
  sed -i 's/ProjectSubcontractor\.list()/ProjectSubcontractor.list() as ApiTypes.ProjectSubcontractor[]/g' "$file"
  sed -i 's/PolicyDocument\.list()/PolicyDocument.list() as ApiTypes.PolicyDocument[]/g' "$file"
  sed -i 's/BrokerUploadRequest\.list()/BrokerUploadRequest.list() as ApiTypes.BrokerUploadRequest[]/g' "$file"
  sed -i 's/ComplianceCheck\.list()/ComplianceCheck.list() as ApiTypes.ComplianceCheck[]/g' "$file"
  sed -i 's/Message\.list()/Message.list() as ApiTypes.Message[]/g' "$file"
  sed -i 's/Trade\.list()/Trade.list() as ApiTypes.Trade[]/g' "$file"
  
  # Fix filter calls
  sed -i 's/GeneratedCOI\.filter(/GeneratedCOI.filter(/g' "$file"
  sed -i 's/Project\.filter(/Project.filter(/g' "$file"
  sed -i 's/Contractor\.filter(/Contractor.filter(/g' "$file"
  sed -i 's/SubInsuranceRequirement\.filter(/SubInsuranceRequirement.filter(/g' "$file"
  
  # Fix read calls
  sed -i 's/Project\.read(/Project.read(/g' "$file"
  sed -i 's/InsuranceProgram\.read(/InsuranceProgram.read(/g' "$file"
  sed -i 's/GeneratedCOI\.read(/GeneratedCOI.read(/g' "$file"
done

echo "Done fixing API calls!"
