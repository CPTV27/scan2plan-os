import { useState, useEffect, useRef, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Loader2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

interface AddressAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  onPlaceSelected?: (formattedAddress: string, placeId: string) => void;
  placeholder?: string;
  className?: string;
  "data-testid"?: string;
}

interface PlacePrediction {
  place_id: string;
  description: string;
  structured_formatting?: {
    main_text: string;
    secondary_text: string;
  };
}

export function AddressAutocomplete({
  value,
  onChange,
  onPlaceSelected,
  placeholder = "Start typing an address...",
  className,
  "data-testid": testId,
}: AddressAutocompleteProps) {
  const [inputValue, setInputValue] = useState(value);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [debouncedInput, setDebouncedInput] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setInputValue(value);
  }, [value]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (inputValue && inputValue.length >= 3) {
        setDebouncedInput(inputValue);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [inputValue]);

  const { data: predictions, isLoading } = useQuery<PlacePrediction[]>({
    queryKey: ["/api/location/autocomplete", debouncedInput],
    queryFn: async () => {
      const response = await fetch(
        `/api/location/autocomplete?input=${encodeURIComponent(debouncedInput)}`
      );
      const data = await response.json();
      return data.predictions || [];
    },
    enabled: debouncedInput.length >= 3 && showSuggestions,
    staleTime: 1000 * 60,
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setInputValue(newValue);
    onChange(newValue);
    setShowSuggestions(true);
  };

  const handleSelectPrediction = useCallback(
    async (prediction: PlacePrediction) => {
      try {
        const response = await fetch(
          `/api/location/place-details?placeId=${encodeURIComponent(prediction.place_id)}`
        );
        const data = await response.json();

        if (data.found && data.businessInfo?.address) {
          const formattedAddress = data.businessInfo.address;
          setInputValue(formattedAddress);
          onChange(formattedAddress);
          onPlaceSelected?.(formattedAddress, prediction.place_id);
        } else {
          setInputValue(prediction.description);
          onChange(prediction.description);
          onPlaceSelected?.(prediction.description, prediction.place_id);
        }
      } catch (error) {
        setInputValue(prediction.description);
        onChange(prediction.description);
        onPlaceSelected?.(prediction.description, prediction.place_id);
      }
      setShowSuggestions(false);
    },
    [onChange, onPlaceSelected]
  );

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        suggestionsRef.current &&
        !suggestionsRef.current.contains(e.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(e.target as Node)
      ) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="relative">
      <Input
        ref={inputRef}
        value={inputValue}
        onChange={handleInputChange}
        onFocus={() => setShowSuggestions(true)}
        placeholder={placeholder}
        className={className}
        data-testid={testId}
      />
      {isLoading && (
        <div className="absolute right-3 top-1/2 -translate-y-1/2">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        </div>
      )}
      {showSuggestions && predictions && predictions.length > 0 && (
        <div
          ref={suggestionsRef}
          className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-lg"
        >
          {predictions.map((prediction) => (
            <button
              key={prediction.place_id}
              type="button"
              className="w-full px-3 py-2 text-left text-sm hover-elevate active-elevate-2 first:rounded-t-md last:rounded-b-md"
              onClick={() => handleSelectPrediction(prediction)}
              data-testid={`suggestion-${prediction.place_id}`}
            >
              {prediction.structured_formatting ? (
                <>
                  <span className="font-medium">
                    {prediction.structured_formatting.main_text}
                  </span>
                  <span className="text-muted-foreground ml-1">
                    {prediction.structured_formatting.secondary_text}
                  </span>
                </>
              ) : (
                prediction.description
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
