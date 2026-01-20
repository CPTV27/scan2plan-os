import { useEffect, useRef, useState, useCallback } from "react";
import { UseFormReturn } from "react-hook-form";
import { useUpdateLead } from "./use-leads";
import type { LeadFormData } from "@/features/deals/types";

export type AutosaveStatus = "idle" | "saving" | "saved" | "error";

interface UseLeadAutosaveOptions {
  leadId: number;
  form: UseFormReturn<LeadFormData>;
  debounceMs?: number;
  enabled?: boolean;
}

interface UseLeadAutosaveReturn {
  status: AutosaveStatus;
  lastSavedAt: Date | null;
  error: string | null;
  retry: () => void;
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

export function useLeadAutosave({
  leadId,
  form,
  debounceMs = 1500,
  enabled = true,
}: UseLeadAutosaveOptions): UseLeadAutosaveReturn {
  const [status, setStatus] = useState<AutosaveStatus>("idle");
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  const updateMutation = useUpdateLead();
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastSavedValuesRef = useRef<Partial<LeadFormData> | null>(null);
  const pendingDataRef = useRef<Partial<LeadFormData> | null>(null);
  const isMountedRef = useRef(true);
  const idleTimerRef = useRef<NodeJS.Timeout | null>(null);
  
  useEffect(() => {
    isMountedRef.current = true;
    lastSavedValuesRef.current = form.getValues();
    
    return () => {
      isMountedRef.current = false;
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      if (idleTimerRef.current) {
        clearTimeout(idleTimerRef.current);
      }
    };
  }, [form]);

  const saveData = useCallback(async (data: Partial<LeadFormData>) => {
    if (!isMountedRef.current) return;
    
    setStatus("saving");
    setError(null);
    
    try {
      const cleanData = Object.fromEntries(
        Object.entries(data).filter(([_, v]) => v !== undefined)
      );
      
      await updateMutation.mutateAsync({ id: leadId, ...cleanData });
      
      if (isMountedRef.current) {
        lastSavedValuesRef.current = { ...lastSavedValuesRef.current, ...cleanData };
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
    } catch (err) {
      if (isMountedRef.current) {
        setStatus("error");
        setError(err instanceof Error ? err.message : "Failed to save");
        pendingDataRef.current = data;
      }
    }
  }, [leadId, updateMutation]);

  const retry = useCallback(() => {
    if (pendingDataRef.current) {
      saveData(pendingDataRef.current);
    }
  }, [saveData]);

  useEffect(() => {
    if (!enabled) return;

    const subscription = form.watch((formValues) => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      
      debounceTimerRef.current = setTimeout(() => {
        const lastSaved = lastSavedValuesRef.current || {};
        const changedData: Partial<LeadFormData> = {};
        
        for (const key of Object.keys(formValues) as (keyof LeadFormData)[]) {
          const currentValue = formValues[key];
          const savedValue = lastSaved[key];
          
          if (currentValue !== undefined && !deepEqual(currentValue, savedValue)) {
            changedData[key] = currentValue as any;
          }
        }
        
        if (Object.keys(changedData).length > 0) {
          saveData(changedData);
        }
      }, debounceMs);
    });

    return () => {
      subscription.unsubscribe();
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [form, enabled, debounceMs, saveData]);

  return {
    status,
    lastSavedAt,
    error,
    retry,
  };
}
