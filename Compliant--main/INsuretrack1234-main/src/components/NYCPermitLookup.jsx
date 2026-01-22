import { useState } from 'react';
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Search, CheckCircle2, AlertCircle } from "lucide-react";
import { compliant } from "@/api/compliantClient";

export default function NYCPermitLookup({ onDataFound }) {
  const [permitNumber, setPermitNumber] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  const searchPermit = async () => {
    if (!permitNumber.trim()) {
      setError('Please enter a permit number');
      return;
    }

    setIsSearching(true);
    setError(null);
    setSuccess(false);

    try {
      // Use LLM with internet access to fetch DOB Now data
      const response = await compliant.integrations.Core.InvokeLLM({
        prompt: `Look up NYC DOB Now permit number ${permitNumber}. Find the following information from the NYC Department of Buildings website:
- Full address (street, city, state, zip)
- Block number
- Lot number
- Building height in stories (if available)
- Project type (new building, alteration, etc.)
- Number of units (if residential)
- Structure type (if available)

Return the data as JSON with these exact keys: address, city, state, zip_code, block_number, lot_number, height_stories, project_type, unit_count, structure_type.
If you cannot find specific information, use null for that field.
For project_type, map to one of: condos, rentals, commercial, mixed_use, industrial, other
For structure_type, map to one of: wood_frame, steel, concrete, masonry, mixed`,
        add_context_from_internet: true,
        response_json_schema: {
          type: "object",
          properties: {
            address: { type: "string" },
            city: { type: "string" },
            state: { type: "string" },
            zip_code: { type: "string" },
            block_number: { type: "string" },
            lot_number: { type: "string" },
            height_stories: { type: "number" },
            project_type: { type: "string" },
            unit_count: { type: "number" },
            structure_type: { type: "string" }
          }
        }
      });

      if (response && response.address) {
        // Normalize minimal permit response
        const normalizePermit = (raw) => {
          if (!raw) return null;
          return {
            address: raw.address || null,
            city: raw.city || null,
            state: raw.state || 'NY',
            zip_code: raw.zip_code || null,
            block_number: raw.block_number ? String(raw.block_number).padStart(5, '0') : null,
            lot_number: raw.lot_number ? String(raw.lot_number).padStart(4, '0') : null,
            height_stories: raw.height_stories || null,
            project_type: raw.project_type || null,
            unit_count: raw.unit_count || null,
            structure_type: raw.structure_type || null
          };
        };

        const normalized = normalizePermit(response);
        onDataFound(normalized);
        setSuccess(true);
        setPermitNumber('');
      } else {
        setError('Could not find permit information. Please verify the permit number.');
      }
    } catch (err) {
      console.error('Error looking up permit:', err);
      setError('Failed to fetch permit data. Please try again or enter manually.');
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <div className="space-y-3 p-4 bg-red-50 border border-red-200 rounded-lg">
      <div className="flex items-center gap-2">
        <Search className="w-4 h-4 text-red-600" />
        <Label className="text-red-900 font-semibold">NYC DOB Permit Lookup</Label>
      </div>
      
      <p className="text-sm text-red-700">
        Enter an NB (New Building) or Alt (Alteration) permit number to auto-fill project details
      </p>

      <div className="flex gap-2">
        <Input
          value={permitNumber}
          onChange={(e) => {
            setPermitNumber(e.target.value);
            setError(null);
            setSuccess(false);
          }}
          placeholder="e.g., 121234567"
          className="bg-white"
          disabled={isSearching}
        />
        <Button
          onClick={searchPermit}
          disabled={isSearching || !permitNumber.trim()}
          className="bg-red-600 hover:bg-red-700 whitespace-nowrap"
        >
          {isSearching ? (
            <>
              <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full mr-2"></div>
              Searching...
            </>
          ) : (
            <>
              <Search className="w-4 h-4 mr-2" />
              Look Up
            </>
          )}
        </Button>
      </div>

      {error && (
        <Alert className="bg-red-50 border-red-200 py-2">
          <AlertCircle className="h-3 w-3 text-red-600" />
          <AlertDescription className="text-xs text-red-800">
            {error}
          </AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert className="bg-green-50 border-green-200 py-2">
          <CheckCircle2 className="h-3 w-3 text-green-600" />
          <AlertDescription className="text-xs text-green-800">
            Permit data loaded successfully! Review and adjust fields as needed.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}