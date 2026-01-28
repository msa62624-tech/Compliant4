#!/bin/bash

# Add type casts to API entity calls across all component files
files=$(find src/components -name "*.tsx" -type f)

for file in $files; do
  # Skip if already has api-types import
  if grep -q "from '@/api-types'" "$file" 2>/dev/null; then
    continue
  fi
  
  # Check if file uses apiClient or compliant
  if grep -q "apiClient.entities\|compliant.entities" "$file" 2>/dev/null; then
    # Add import after last import
    sed -i '/^import/{ h; }; ${ x; /^import/{ s|$|\nimport type * as ApiTypes from "@/api-types";|; }; x; }' "$file"
    echo "Added types to: $file"
  fi
done

echo "Done adding type imports!"
