import { useState, useEffect } from 'react';
import { Input } from "@/components/ui/input";

export default function ZipCodeLookup({ value, onChange, onCityStateFound }) {
  const [isLooking, setIsLooking] = useState(false);

  useEffect(() => {
    const lookupZipCode = async () => {
      // Check if we have a valid 5-digit ZIP code
      if (value && value.length === 5 && /^\d{5}$/.test(value) && !isLooking) {
        setIsLooking(true);
        try {
          // Use free Zippopotam API for ZIP code lookup
          const response = await fetch(`https://api.zippopotam.us/us/${value}`);
          
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

  return (
    <div className="relative">
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="12345"
        maxLength={5}
      />
      {isLooking && (
        <div className="absolute right-3 top-1/2 -translate-y-1/2">
          <div className="animate-spin w-4 h-4 border-2 border-red-600 border-t-transparent rounded-full"></div>
        </div>
      )}
    </div>
  );
}