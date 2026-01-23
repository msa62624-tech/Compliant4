import { useEffect, useRef, useState } from 'react';
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";

export default function AddressAutocomplete({ value, onChange, onAddressSelect, placeholder = "Start typing address...", required }) {
  const inputRef = useRef(null);
  const autocompleteRef = useRef(null);
  const [error, setError] = useState(null);
  const [apiFailed, setApiFailed] = useState(false);
  const initializeAttemptRef = useRef(0);
  const [manualMode, setManualMode] = useState(false);
  const [selectedFromAutocomplete, setSelectedFromAutocomplete] = useState(false);

  useEffect(() => {
    // Ensure Google Maps API script is loaded
    if (!window.google?.maps?.places) {
      const loadGoogleMapsScript = () => {
        if (document.getElementById('google-maps-script')) {
          return; // Script already loading/loaded
        }
        
        const script = document.createElement('script');
        script.id = 'google-maps-script';
        script.src = 'https://maps.googleapis.com/maps/api/js?key=AIzaSyBBbK2wSmVFPtU5eScUh9RBz-gE7Qx4Sws&libraries=places';
        script.async = true;
        script.defer = true;
        script.onerror = () => {
          setApiFailed(true);
          setError("Address autocomplete unavailable. Enter address manually.");
        };
        window.gapi_error = () => {
          setApiFailed(true);
          setError("Address autocomplete unavailable. Enter address manually.");
        };
        document.head.appendChild(script);
      };

      loadGoogleMapsScript();
    }

    // Wait for Google Maps to be available
    const attemptInit = () => {
      if (window.google?.maps?.places && inputRef.current) {
        initializeAutocomplete();
        return true;
      }
      return false;
    };

    if (attemptInit()) return;

    // Poll for availability
    const checkInterval = setInterval(() => {
      initializeAttemptRef.current++;
      if (attemptInit()) {
        clearInterval(checkInterval);
      }
      if (initializeAttemptRef.current > 50) {
        clearInterval(checkInterval); // Stop after 5 seconds
      }
    }, 100);

    return () => clearInterval(checkInterval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const initializeAutocomplete = () => {
    if (!inputRef.current || !window.google?.maps?.places || autocompleteRef.current) return;

    try {
      // Initialize autocomplete with options for all 50 states
      autocompleteRef.current = new window.google.maps.places.Autocomplete(inputRef.current, {
        componentRestrictions: { country: 'us' },
        fields: ['address_components', 'formatted_address', 'geometry'],
        types: ['address'],
      });

      autocompleteRef.current.addListener('place_changed', () => {
        const place = autocompleteRef.current.getPlace();

        if (!place.address_components) {
          setError("Could not parse address. You can still enter it manually.");
          return;
        }

        const addressData = {
          address: '',
          city: '',
          state: '',
          zip_code: '',
        };

        let streetNumber = '';
        let route = '';
        let premise = ''; // For building/suite numbers
        let subpremise = ''; // For apt/unit numbers

        place.address_components.forEach((component) => {
          const types = component.types;

          if (types.includes('street_number')) {
            streetNumber = component.long_name;
          }
          if (types.includes('route')) {
            route = component.long_name;
          }
          if (types.includes('premise')) {
            premise = component.long_name;
          }
          if (types.includes('subpremise')) {
            subpremise = component.long_name;
          }
          if (types.includes('locality')) {
            addressData.city = component.long_name;
          }
          if (types.includes('administrative_area_level_1')) {
            addressData.state = component.short_name;
          }
          if (types.includes('postal_code')) {
            addressData.zip_code = component.long_name;
          }
        });

        // Build address from available components
        // Support addresses with or without street numbers - be very flexible
        const addressParts = [streetNumber, route, premise, subpremise].filter(Boolean);
        addressData.address = addressParts.join(' ').trim() || place.formatted_address?.split(',')[0]?.trim() || '';

        // VERY lenient validation - accept any address as long as we got something
        if (addressData.address || addressData.city || addressData.state) {
          setSelectedFromAutocomplete(true);
          if (onAddressSelect) {
            onAddressSelect(addressData);
          }
          if (onChange) {
            onChange(addressData.address);
          }
          setError(null);
          // Reset the autocomplete flag after a short delay to allow continued editing
          setTimeout(() => {
            setSelectedFromAutocomplete(false);
            if (inputRef.current) {
              // Re-enable the input and allow further typing
              inputRef.current.disabled = false;
            }
          }, 100);
        } else {
          setError("Address incomplete. Please adjust or enter manually.");
        }
      });

    } catch (err) {
      console.error('Autocomplete initialization error:', err);
      setError("Address lookup unavailable. Please enter manually.");
    }
  };

  return (
    <div className="space-y-2">
      <div className="relative">
        <Input
          ref={inputRef}
          value={value}
          onChange={(e) => {
            const newValue = e.target.value;
            if (onChange) {
              onChange(newValue);
            }
            // Clear autocomplete selection flag when user types manually
            if (selectedFromAutocomplete) {
              setSelectedFromAutocomplete(false);
            }
            setManualMode(true);
          }}
          onFocus={() => {
            setManualMode(false);
            // Reset selection flag on focus to allow fresh autocomplete
            setSelectedFromAutocomplete(false);
          }}
          onKeyDown={(e) => {
            // Clear autocomplete selection flag to allow manual editing
            if (selectedFromAutocomplete) {
              setSelectedFromAutocomplete(false);
            }
          }}
          onInput={(e) => {
            // Ensure value updates happen regardless of autocomplete state
            if (onChange && e.target.value !== value) {
              onChange(e.target.value);
            }
          }}
          placeholder={placeholder}
          className={`${error ? 'border-amber-300' : ''} pac-target-input`}
          autoComplete="off"
          required={required}
        />
      </div>
      {error && (
        <Alert className="bg-amber-50 border-amber-200 py-2">
          <AlertCircle className="h-3 w-3 text-amber-600" />
          <AlertDescription className="text-xs text-amber-800">
            {error}
          </AlertDescription>
        </Alert>
      )}
      {!error && !apiFailed && (
        <p className="text-xs text-emerald-600 font-medium">
          ✓ Start typing and select from dropdown to auto-fill address
        </p>
      )}
      {apiFailed && (
        <p className="text-xs text-slate-500">
          (Manual entry mode - type address directly)
        </p>
      )}
      {!apiFailed && (
        <style>{`
          .pac-container {
            background-color: white;
            border-radius: 8px;
            border: 2px solid #e2e8f0;
            box-shadow: 0 10px 25px rgba(0, 0, 0, 0.15);
            margin-top: 4px;
            z-index: 999999 !important;
            font-family: inherit;
          }
          .pac-item {
            padding: 12px 16px;
            cursor: pointer;
            border-bottom: 1px solid #f1f5f9;
            font-size: 14px;
            line-height: 1.5;
          }
          .pac-item:hover {
            background-color: #eff6ff;
          }
          .pac-item:last-child {
            border-bottom: none;
          }
          .pac-item-query {
            font-weight: 600;
            color: #1e293b;
          }
          .pac-matched {
            font-weight: 700;
            color: #2563eb;
          }
          .pac-icon {
            display: none;
          }
        `}</style>
      )}
    </div>
  );
}