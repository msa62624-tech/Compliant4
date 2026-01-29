import { Input } from "@/components/ui/input";

// Simplified version - Google Maps autocomplete was blocking input
// Using plain text input for now until Google Maps integration can be fixed properly
export default function AddressAutocomplete({ value, onChange, placeholder = "Start typing address...", required }): JSX.Element {
  return (
    <div className="space-y-2">
      <Input
        value={value || ''}
        onChange={(e) => {
          if (onChange) {
            onChange(e.target.value);
          }
        }}
        placeholder={placeholder}
        autoComplete="off"
        required={required}
        type="text"
      />
      <p className="text-xs text-slate-500">
        Enter full address (street, city, state, ZIP)
      </p>
    </div>
  );
}

/* DISABLED - Google Maps was blocking input
import { useEffect, useRef, useState } from 'react';
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";

export default function AddressAutocompleteWithGoogle({ value, onChange, onAddressSelect, placeholder = "Start typing address...", required }) {
  const inputRef = useRef(null);
  const autocompleteRef = useRef(null);
  const [error, setError] = useState(null);
  const [apiFailed, setApiFailed] = useState(false);
  const initializeAttemptRef = useRef(0);
  const [manualMode, setManualMode] = useState(false);
  const [selectedFromAutocomplete, setSelectedFromAutocomplete] = useState(false);

  useEffect(() => {
    // Ensure Google Maps API script is loaded with proper async callback
    if (!window.google?.maps?.places) {
      const loadGoogleMapsScript = () => {
        if (document.getElementById('google-maps-script')) {
          return; // Script already loading/loaded
        }
        
        // Set up callback for async loading
        window.initGoogleMaps = () => {
          console.log('✅ Google Maps loaded successfully');
          if (inputRef.current) {
            initializeAutocomplete();
          }
        };
        
        const script = document.createElement('script');
        script.id = 'google-maps-script';
        script.src = 'https://maps.googleapis.com/maps/api/js?key=AIzaSyBBbK2wSmVFPtU5eScUh9RBz-gE7Qx4Sws&libraries=places&callback=initGoogleMaps&loading=async';
        script.async = true;
        script.defer = true;
        script.onerror = () => {
          console.warn('⚠️ Google Maps failed to load - using manual entry mode');
          setApiFailed(true);
          setError("Address autocomplete unavailable. Enter address manually.");
        };
        document.head.appendChild(script);
      };

      loadGoogleMapsScript();
    } else {
      // Google Maps already loaded
      if (inputRef.current) {
        initializeAutocomplete();
      }
    }

    // Fallback: Poll for availability if callback doesn't work
    const checkInterval = setInterval(() => {
      initializeAttemptRef.current++;
      if (window.google?.maps?.places && inputRef.current && !autocompleteRef.current) {
        initializeAutocomplete();
        clearInterval(checkInterval);
      }
      if (initializeAttemptRef.current > 30) {
        // After 3 seconds, give up and allow manual entry
        console.warn('⚠️ Google Maps autocomplete unavailable - manual entry mode');
        setApiFailed(true);
        clearInterval(checkInterval);
      }
    }, 100);

    return () => {
      clearInterval(checkInterval);
      if (window.initGoogleMaps) {
        delete window.initGoogleMaps;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const initializeAutocomplete = () => {
    if (!inputRef.current || !window.google?.maps?.places || autocompleteRef.current) return;

    try {
      console.log('🔧 Initializing Google Maps autocomplete...');
      
      // Initialize autocomplete with options for all 50 states
      autocompleteRef.current = new window.google.maps.places.Autocomplete(inputRef.current, {
        componentRestrictions: { country: 'us' },
        fields: ['address_components', 'formatted_address', 'geometry'],
        types: ['address'],
      });

      // CRITICAL: Prevent Google Maps from blocking input after selection
      const input = inputRef.current;
      input.setAttribute('autocomplete', 'new-password'); // Prevent browser autocomplete conflict
      
      // Allow Enter key without blocking
      const handleKeyDown = (e) => {
        if (e.key === 'Enter') {
          const dropdown = document.querySelector('.pac-container');
          if (!dropdown || dropdown.style.display === 'none') {
            // No dropdown visible - allow form submission
            return;
          }
          e.preventDefault(); // Prevent form submission only if dropdown is open
        }
      };
      input.addEventListener('keydown', handleKeyDown);

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
          // Reset the autocomplete flag immediately to allow continued editing
          setSelectedFromAutocomplete(false);
        } else {
          setError("Address incomplete. Please adjust or enter manually.");
        }
      });

      console.log('✅ Google Maps autocomplete initialized successfully');
    } catch (err) {
      console.error('❌ Autocomplete initialization error:', err);
      setApiFailed(true);
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
          data-form-type="other"
          spellCheck="false"
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
*/