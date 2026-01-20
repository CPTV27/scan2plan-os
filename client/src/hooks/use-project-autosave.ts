import { useEffect, useRef, useState, useCallback } from "react";
import { UseFormReturn } from "react-hook-form";
import { useUpdateProject } from "./use-projects";
import type { AutosaveStatus as BaseAutosaveStatus } from "./use-lead-autosave";

export type AutosaveStatus = BaseAutosaveStatus;

export interface ProjectFormData {
  name: string;
  status: string;
  priority: string;
  progress: number;
  bValidationStatus: string;
  cValidationStatus: string;
  registrationRms?: number;
  assignedTechId?: number;
  billingAdjustmentApproved?: boolean;
  dueDate?: Date;
  leadId?: number;
}

interface UseProjectAutosaveOptions {
  projectId: number;
  form: UseFormReturn<any>;
  debounceMs?: number;
  enabled?: boolean;
}

interface UseProjectAutosaveReturn {
  status: AutosaveStatus;
  lastSavedAt: Date | null;
  error: string | null;
  retry: () => void;
  resetBaseline: (values: Partial<ProjectFormData>) => void;
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

export function useProjectAutosave({
  projectId,
  form,
  debounceMs = 1500,
  enabled = true,
}: UseProjectAutosaveOptions): UseProjectAutosaveReturn {
  const [status, setStatus] = useState<AutosaveStatus>("idle");
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  const updateMutation = useUpdateProject();
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastSavedValuesRef = useRef<Partial<ProjectFormData> | null>(null);
  const pendingDataRef = useRef<Partial<ProjectFormData> | null>(null);
  const isMountedRef = useRef(true);
  const idleTimerRef = useRef<NodeJS.Timeout | null>(null);
  const initializedRef = useRef(false);
  
  useEffect(() => {
    isMountedRef.current = true;
    
    return () => {
      isMountedRef.current = false;
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      if (idleTimerRef.current) {
        clearTimeout(idleTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (projectId) {
      initializedRef.current = false;
      lastSavedValuesRef.current = null;
    }
  }, [projectId]);

  const resetBaseline = useCallback((values: Partial<ProjectFormData>) => {
    if (!enabled) return;
    lastSavedValuesRef.current = { ...values };
    initializedRef.current = true;
    setStatus("idle");
  }, [enabled]);

  const saveData = useCallback(async (data: Partial<ProjectFormData>) => {
    if (!isMountedRef.current || !enabled || !projectId) return;
    
    setStatus("saving");
    setError(null);
    
    try {
      const cleanData = Object.fromEntries(
        Object.entries(data).filter(([_, v]) => v !== undefined)
      );
      
      await updateMutation.mutateAsync({ id: projectId, ...cleanData });
      
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
  }, [projectId, updateMutation, enabled]);

  const retry = useCallback(() => {
    if (pendingDataRef.current) {
      saveData(pendingDataRef.current);
    }
  }, [saveData]);

  useEffect(() => {
    if (!enabled || !projectId) return;

    const subscription = form.watch((formValues) => {
      if (!initializedRef.current) return;
      
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      
      debounceTimerRef.current = setTimeout(() => {
        const lastSaved = lastSavedValuesRef.current || {};
        const changedData: Partial<ProjectFormData> = {};
        
        const keysToWatch: (keyof ProjectFormData)[] = [
          'name', 'status', 'priority', 'progress', 
          'bValidationStatus', 'cValidationStatus',
          'registrationRms', 'assignedTechId', 'billingAdjustmentApproved'
        ];
        
        for (const key of keysToWatch) {
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
  }, [form, enabled, debounceMs, saveData, projectId]);

  return {
    status,
    lastSavedAt,
    error,
    retry,
    resetBaseline,
  };
}
