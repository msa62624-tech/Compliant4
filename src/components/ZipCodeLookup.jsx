import { useState, useEffect } from 'react';
import { Input } from "@/components/ui/input";

export default function ZipCodeLookup({ value, onChange, onCityStateFound }) {
  const [isLooking, setIsLooking] = useState(false);

  useEffect(() => {
    const lookupZipCode = async () => {
      // Extract first 5 digits for lookup (supports ZIP+4 format)
      const zipBase = value?.replace(/\D/g, '').slice(0, 5);
      
      // Check if we have a valid 5-digit ZIP code base
      if (zipBase && zipBase.length === 5 && !isLooking) {
        setIsLooking(true);
        try {
          // Use free Zippopotam API for ZIP code lookup
          const response = await fetch(`https://api.zippopotam.us/us/${zipBase}`);
          
          if (response.ok) {
            const data = await response.json();
            if (data.places && data.places.length > 0) {
              const place = data.places[0];
              const city = place['place name'];
              const state = place['state abbreviation'];
              
              if (city && state && onCityStateFound) {
                onCityStateFound(city, state);
              }
            }
          }
        } catch (error) {
          console.error('Error looking up ZIP code:', error);
        } finally {
          setIsLooking(false);
        }
      }
    };

    const debounce = setTimeout(() => {
      lookupZipCode();
    }, 500);

    return () => clearTimeout(debounce);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const handleChange = (e) => {
    // Allow digits and hyphen for ZIP+4 format (12345-6789)
    const input = e.target.value;
    const filtered = input.replace(/[^\d-]/g, '');
    
    // Format: allow up to 5 digits, then optional hyphen and 4 more digits
    let formatted = filtered;
    if (filtered.length > 5 && !filtered.includes('-')) {
      formatted = filtered.slice(0, 5) + '-' + filtered.slice(5, 9);
    }
    
    onChange(formatted.slice(0, 10)); // Max length: 12345-6789 (10 chars)
  };

  return (
    <div className="relative">
      <Input
        value={value}
        onChange={handleChange}
        placeholder="12345 or 12345-6789"
        maxLength={10}
      />
      {isLooking && (
        <div className="absolute right-3 top-1/2 -translate-y-1/2">
          <div className="animate-spin w-4 h-4 border-2 border-red-600 border-t-transparent rounded-full"></div>
        </div>
      )}
    </div>
  );
}