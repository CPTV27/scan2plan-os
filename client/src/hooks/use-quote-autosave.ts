import { useEffect, useRef, useState, useCallback } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";

export type AutosaveStatus = "idle" | "saving" | "saved" | "error";

interface QuoteData {
  projectName: string;
  clientName: string;
  projectAddress: string;
  specificBuilding: string;
  typeOfBuilding: string;
  hasBasement: boolean;
  hasAttic: boolean;
  notes: string;
  leadId: number | null;
  scopingMode: boolean;
  areas: any[];
  risks: string[];
  dispatchLocation: string;
  distance: number | null;
  customTravelCost: string | null;
  services: Record<string, number>;
  scopingData: any;
  totalPrice: string;
  pricingBreakdown: Record<string, any>;
}

interface UseQuoteAutosaveOptions {
  quoteId: string | undefined;
  leadId: number | undefined;
  debounceMs?: number;
  enabled?: boolean;
  getQuoteData: () => QuoteData;
  onQuoteSaved?: (quoteId: string) => void;
}

interface UseQuoteAutosaveReturn {
  status: AutosaveStatus;
  lastSavedAt: Date | null;
  error: string | null;
  retry: () => void;
  triggerSave: () => void;
  currentQuoteId: string | undefined;
}

function deepEqual(obj1: any, obj2: any): boolean {
  if (obj1 === obj2) return true;
  if (obj1 == null || obj2 == null) return obj1 === obj2;
  if (typeof obj1 !== "object" || typeof obj2 !== "object") return false;

  const keys1 = Object.keys(obj1);
  const keys2 = Object.keys(obj2);

  if (keys1.length !== keys2.length) return false;

  for (const key of keys1) {
    if (!keys2.includes(key) || !deepEqual(obj1[key], obj2[key])) {
      return false;
    }
  }
  return true;
}

export function useQuoteAutosave({
  quoteId: initialQuoteId,
  leadId,
  debounceMs = 2000,
  enabled = true,
  getQuoteData,
  onQuoteSaved,
}: UseQuoteAutosaveOptions): UseQuoteAutosaveReturn {
  const [status, setStatus] = useState<AutosaveStatus>("idle");
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [currentQuoteId, setCurrentQuoteId] = useState<string | undefined>(initialQuoteId);

  const lastSavedDataRef = useRef<QuoteData | null>(null);
  const pendingDataRef = useRef<QuoteData | null>(null);
  const isMountedRef = useRef(true);
  const idleTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastDataHashRef = useRef<string>("");

  // Update currentQuoteId when initialQuoteId changes
  useEffect(() => {
    if (initialQuoteId) {
      setCurrentQuoteId(initialQuoteId);
    }
  }, [initialQuoteId]);

  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
      if (idleTimerRef.current) {
        clearTimeout(idleTimerRef.current);
      }
    };
  }, []);

  const saveMutation = useMutation({
    mutationFn: async (data: QuoteData & { quoteId?: string }) => {
      const { quoteId: existingQuoteId, ...quoteData } = data;
      if (existingQuoteId) {
        const res = await apiRequest("PATCH", `/api/quotes/${existingQuoteId}`, quoteData);
        return res.json();
      } else {
        const res = await apiRequest("POST", "/api/quotes", quoteData);
        return res.json();
      }
    },
    onSuccess: (savedQuote: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api", "quotes"] });
      if (leadId) {
        queryClient.invalidateQueries({ queryKey: ["/api/leads", leadId, "cpq-quotes"] });
      }

      if (isMountedRef.current) {
        // Update currentQuoteId for new quotes
        if (savedQuote?.id && savedQuote.id !== currentQuoteId) {
          setCurrentQuoteId(savedQuote.id);
          onQuoteSaved?.(savedQuote.id);
        }

        lastSavedDataRef.current = pendingDataRef.current;
        pendingDataRef.current = null;
        setStatus("saved");
        setLastSavedAt(new Date());

        if (idleTimerRef.current) {
          clearTimeout(idleTimerRef.current);
        }
        idleTimerRef.current = setTimeout(() => {
          if (isMountedRef.current) {
            setStatus((current) => current === "saved" ? "idle" : current);
          }
        }, 2000);
      }
    },
    onError: (err: any) => {
      if (isMountedRef.current) {
        setStatus("error");
        setError(err instanceof Error ? err.message : "Failed to save quote");
      }
    },
  });

  const saveData = useCallback((data: QuoteData) => {
    if (!isMountedRef.current) return;

    setStatus("saving");
    setError(null);
    pendingDataRef.current = data;

    saveMutation.mutate({ ...data, quoteId: currentQuoteId });
  }, [currentQuoteId, saveMutation]);

  const retry = useCallback(() => {
    if (pendingDataRef.current) {
      saveData(pendingDataRef.current);
    }
  }, [saveData]);

  const triggerSave = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    const data = getQuoteData();
    const dataHash = JSON.stringify(data);

    // Only save if data has changed
    if (dataHash !== lastDataHashRef.current) {
      lastDataHashRef.current = dataHash;
      saveData(data);
    }
  }, [getQuoteData, saveData]);

  // Debounced autosave effect
  useEffect(() => {
    if (!enabled) return;

    const intervalId = setInterval(() => {
      const data = getQuoteData();
      const dataHash = JSON.stringify(data);

      // Only save if data has changed
      if (dataHash !== lastDataHashRef.current) {
        lastDataHashRef.current = dataHash;
        saveData(data);
      }
    }, debounceMs);

    return () => {
      clearInterval(intervalId);
    };
  }, [enabled, debounceMs, getQuoteData, saveData]);

  return {
    status,
    lastSavedAt,
    error,
    retry,
    triggerSave,
    currentQuoteId,
  };
}
