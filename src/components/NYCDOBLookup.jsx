import { useState } from 'react';
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Search, CheckCircle2, AlertCircle, Building2 } from "lucide-react";
import { compliant } from "@/api/compliantClient";

export default function NYCDOBLookup({ onDataFound }) {
  const [address, setAddress] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [foundData, setFoundData] = useState(null);

  const searchDOB = async () => {
    if (!address.trim()) {
      setError('Please enter an address');
      return;
    }

    setIsSearching(true);
    setError(null);
    setSuccess(false);
    setFoundData(null);

    try {
      const response = await compliant.integrations.Core.InvokeLLM({
        prompt: `You are a NYC property data extraction specialist. Extract property information for: "${address}"

CRITICAL INSTRUCTIONS:
1. Only return ACTUAL data found from real sources
2. If data is not available, return null for that field
3. DO NOT make up or estimate any values
4. Use exact formatting as specified

DATA SOURCES (in order):

SOURCE 1: NYC DOB NOW (https://a810-dobnow.nyc.gov/publish/Index.html#!/)
Search for: "${address}"
Extract from LEFT PANEL "Building Information":
- HOUSE # + STREET NAME = address (e.g., "914-920 ATLANTIC AVENUE")
- BLOCK (must be 5 digits with leading zeros, e.g., "01234")
- LOT (must be 4 digits with leading zeros, e.g., "0001")
- BIN (7-digit number)
- BOROUGH name
- ZIP CODE (5 digits)
- CITY (from borough: Manhattan=New York, Brooklyn=Brooklyn, Queens=Queens, Bronx=Bronx, Staten Island=Staten Island)

From "Filings & Permits" tab, find MOST RECENT permit with:
- Job Type: NB (New Building), ALT1, or ALT2
- Job Description: contains "GC" or "GENERAL CONTRACTOR"
Extract:
- unit_count (number of units/dwellings)
- height_stories (number of stories)
- project_type: determine from job description (condos/rentals/commercial/mixed_use)

SOURCE 2: NYC ACRIS (https://a836-acris.nyc.gov/DS/DocumentSearch/BBL)
Search using BBL (Borough + Block + Lot from SOURCE 1)
Filter: Document Type = "DEED", Sort by Date (newest first)
Get the PARTY 2 (GRANTEE) name = owner_entity

SOURCE 3: NYC ZOLA (https://zola.planning.nyc.gov/)
Search: "Block [block] Lot [lot]"
From the map, identify ONLY lots that PHYSICALLY TOUCH (share boundary):
- DO NOT include properties across streets
- DO NOT include corner properties unless they share a boundary
- Get 2-6 adjacent property owners from ACRIS
- Return as additional_insured_entities array

VALIDATION:
- Block must be exactly 5 digits (pad with zeros: "123" → "00123")
- Lot must be exactly 4 digits (pad with zeros: "45" → "0045")
- State must be "NY"
- All values must be from actual sources, not estimates

Return ONLY valid JSON:`,
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
            bin: { type: "string" },
            height_stories: { type: "number" },
            project_type: { type: "string" },
            unit_count: { type: "number" },
            structure_type: { type: "string" },
            owner_entity: { type: "string" },
            additional_insured_entities: {
              type: "array",
              items: { type: "string" }
            }
          },
          required: ["address", "block_number", "lot_number", "owner_entity"]
        }
      });

      // Normalize and validate response
      const normalize = (raw) => {
        if (!raw) return null;
        const pad = (v, len) => (v ? String(v).padStart(len, '0') : null);
        const mapBoroughToCity = (b) => {
          if (!b) return null;
          const bb = String(b).toLowerCase();
          if (bb.includes('manhattan')) return 'New York';
          if (bb.includes('brooklyn')) return 'Brooklyn';
          if (bb.includes('queens')) return 'Queens';
          if (bb.includes('bronx')) return 'Bronx';
          if (bb.includes('staten')) return 'Staten Island';
          return null;
        };

        const additional = Array.isArray(raw.additional_insured_entities)
          ? raw.additional_insured_entities.map(s => String(s).trim()).filter(Boolean).slice(0, 6)
          : [];

        const normalized = {
          address: raw.address || null,
          city: raw.city || mapBoroughToCity(raw.borough) || null,
          state: raw.state || 'NY',
          zip_code: raw.zip_code || null,
          block_number: raw.block_number ? pad(raw.block_number, 5) : null,
          lot_number: raw.lot_number ? pad(raw.lot_number, 4) : null,
          bin: raw.bin || null,
          height_stories: raw.height_stories || null,
          project_type: raw.project_type || null,
          unit_count: raw.unit_count || null,
          structure_type: raw.structure_type || null,
          owner_entity: raw.owner_entity || null,
          additional_insured_entities: additional
        };

        return normalized;
      };

      const normalized = normalize(response);

      if (normalized && normalized.block_number && normalized.address && normalized.owner_entity) {
        setFoundData(normalized);
        onDataFound(normalized);
        setSuccess(true);
        setAddress('');
      } else {
        setError('Could not find complete property information (block/lot/owner). Please verify or enter details manually.');
      }
    } catch (err) {
      console.error('Error looking up DOB data:', err);
      setError('Failed to fetch property data. Please try again or enter details manually.');
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <div className="space-y-3 p-4 bg-gradient-to-r from-red-50 to-rose-50 border-2 border-red-300 rounded-lg shadow-sm">
      <div className="flex items-center gap-2">
        <Building2 className="w-5 h-5 text-red-600" />
        <Label className="text-red-900 font-bold text-base">NYC Property Lookup</Label>
      </div>
      
      <p className="text-sm text-red-800 font-medium">
        Enter address - Finds latest GC permit + adjacent owners
      </p>

      <div className="flex gap-2">
        <Input
          value={address}
          onChange={(e) => {
            setAddress(e.target.value);
            setError(null);
            setSuccess(false);
            setFoundData(null);
          }}
          placeholder="e.g., 918 Atlantic Ave"
          className="bg-white border-red-300 focus:border-red-500"
          disabled={isSearching}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              searchDOB();
            }
          }}
        />
        <Button
          onClick={searchDOB}
          disabled={isSearching || !address.trim()}
          className="bg-red-600 hover:bg-red-700 whitespace-nowrap font-semibold shadow-md"
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
        <Alert className="bg-red-50 border-red-300 py-2">
          <AlertCircle className="h-4 w-4 text-red-600" />
          <AlertDescription className="text-sm text-red-800 font-medium">
            {error}
          </AlertDescription>
        </Alert>
      )}

      {success && foundData && (
        <Alert className="bg-green-50 border-green-300 py-3 shadow-sm">
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-sm text-green-900 space-y-2">
            <div className="font-bold text-base">✓ Property Data Loaded!</div>
            
            {foundData.address && (
              <div className="bg-white p-2 rounded border border-green-200">
                <p className="font-semibold text-green-900">{foundData.address}</p>
                <p className="text-xs text-green-700">
                  Block: <span className="font-mono font-bold">{foundData.block_number}</span> | 
                  Lot: <span className="font-mono font-bold">{foundData.lot_number}</span>
                  {foundData.unit_count && <> | Units: <span className="font-bold">{foundData.unit_count}</span></>}
                </p>
              </div>
            )}
            
            {foundData.owner_entity && (
              <div className="bg-rose-50 p-2 rounded border border-rose-200">
                <p className="text-xs text-rose-700 font-semibold">Owner:</p>
                <p className="text-sm font-bold text-indigo-900">{foundData.owner_entity}</p>
              </div>
            )}
            
            {foundData.additional_insured_entities && foundData.additional_insured_entities.length > 0 && (
              <div className="bg-purple-50 p-2 rounded border border-purple-200">
                <p className="text-xs font-semibold text-purple-900 mb-1">
                  {foundData.additional_insured_entities.length} Adjacent Owners:
                </p>
                <div className="space-y-1 max-h-24 overflow-y-auto">
                  {foundData.additional_insured_entities.map((entity, idx) => (
                    <p key={idx} className="text-xs text-purple-800">• {entity}</p>
                  ))}
                </div>
              </div>
            )}
          </AlertDescription>
        </Alert>
      )}

      <div className="text-xs text-slate-600 bg-white p-2 rounded border">
        <p><strong>Sources:</strong> DOB NOW (latest GC permit) + ACRIS (owners) + ZOLA (adjacent only)</p>
      </div>
    </div>
  );
}