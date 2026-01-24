import { useEffect, useRef, useState, useCallback } from "react";
import { UseFormReturn } from "react-hook-form";
import { useMutation, useQueryClient, type UseMutationResult } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";
import type { LeadFormData } from "@/features/deals/types";
import { useUpdateLead } from "./use-leads";

export type AutosaveStatus = "idle" | "saving" | "saved" | "error";

interface UseLeadAutosaveOptions {
  leadId: number;
  form: UseFormReturn<LeadFormData>;
  debounceMs?: number;
  enabled?: boolean;
  updateMutation?: UseMutationResult<any, Error, { id: number } & LeadFormData, unknown>;
  createMutation?: UseMutationResult<any, Error, LeadFormData, unknown>;
  onLeadCreated?: (leadId: number) => void;
}

interface UseLeadAutosaveReturn {
  status: AutosaveStatus;
  lastSavedAt: Date | null;
  error: string | null;
  retry: () => void;
  triggerSave: () => void;
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
  updateMutation,
  createMutation,
  onLeadCreated,
}: UseLeadAutosaveOptions): UseLeadAutosaveReturn {
  const [status, setStatus] = useState<AutosaveStatus>("idle");
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  const queryClient = useQueryClient();
  const fallbackMutation = useUpdateLead();
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastSavedValuesRef = useRef<LeadFormData | null>(null);
  const pendingDataRef = useRef<LeadFormData | null>(null);
  const inFlightRef = useRef(false);
  const isMountedRef = useRef(true);
  const idleTimerRef = useRef<NodeJS.Timeout | null>(null);
  const hasCreatedRef = useRef(false); // Prevent duplicate creates for new leads
  const isReady = enabled && Number.isFinite(leadId) && leadId > 0;

  const getCsrfToken = useCallback((): string | null => {
    const match = document.cookie.match(/csrf-token=([^;]+)/);
    return match ? match[1] : null;
  }, []);

  const putLead = useMutation({
    mutationFn: async (payload: LeadFormData) => {
      const csrfToken = getCsrfToken();
      const url = buildUrl(api.leads.update.path, { id: leadId });
      const res = await fetch(url, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...(csrfToken ? { "x-csrf-token": csrfToken } : {}),
        },
        body: JSON.stringify(payload),
        credentials: "include",
      });

      if (res.status === 401) {
        throw new Error("Session expired. Please log out and log back in.");
      }

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || `Save failed (${res.status})`);
      }

      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.leads.list.path] });
      queryClient.invalidateQueries({ queryKey: [api.projects.list.path] });
      queryClient.invalidateQueries({ queryKey: ["/api/leads", leadId] });
      queryClient.invalidateQueries({ queryKey: [api.leads.get.path, leadId] });
    },
  });

  useEffect(() => {
    isMountedRef.current = true;
    lastSavedValuesRef.current = form.getValues();
    // Reset create flag when leadId becomes valid (after navigation)
    if (isReady) {
      hasCreatedRef.current = false;
    }

    return () => {
      isMountedRef.current = false;
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      if (idleTimerRef.current) {
        clearTimeout(idleTimerRef.current);
      }
    };
  }, [form, leadId, isReady]);

  const saveData = useCallback(async (data: LeadFormData) => {
    if (!isMountedRef.current || inFlightRef.current || !enabled) return;
    
    inFlightRef.current = true;
    setStatus("saving");
    setError(null);
    
    try {
      const cleanData = Object.fromEntries(
        Object.entries(data).filter(([_, v]) => v !== undefined)
      ) as LeadFormData;
      const payload = { id: leadId, ...cleanData };

      if (isReady && updateMutation) {
        await updateMutation.mutateAsync(payload);
      } else if (isReady) {
        await putLead.mutateAsync(cleanData);
      } else if (createMutation && !hasCreatedRef.current) {
        // Mark as creating to prevent duplicate creates
        hasCreatedRef.current = true;
        const created = await createMutation.mutateAsync(cleanData);
        if (created?.id) {
          lastSavedValuesRef.current = cleanData;
          pendingDataRef.current = null;
          setStatus("saved");
          setLastSavedAt(new Date());
          queryClient.setQueryData(["/api/leads", created.id], created);
          queryClient.invalidateQueries({ queryKey: ["/api/leads"] });
          // Notify parent that lead was created so it can navigate to the new URL
          onLeadCreated?.(created.id);
          return;
        }
      } else if (!isReady && hasCreatedRef.current) {
        // Already created, waiting for navigation - skip this save
        inFlightRef.current = false;
        return;
      } else {
        await fallbackMutation.mutateAsync(payload);
      }
      
      if (isMountedRef.current) {
        lastSavedValuesRef.current = cleanData;
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
    } finally {
      inFlightRef.current = false;
    }
  }, [leadId, putLead, updateMutation, createMutation, fallbackMutation, enabled, isReady, queryClient, onLeadCreated]);

  const retry = useCallback(() => {
    if (pendingDataRef.current) {
      setStatus("saving");
      setError(null);
      saveData(pendingDataRef.current);
    }
  }, [saveData]);

  const triggerSave = useCallback(() => {
    const snapshot = form.getValues();
    pendingDataRef.current = snapshot;
    setStatus("saving");
    setError(null);
    saveData(snapshot);
  }, [form, saveData]);

  useEffect(() => {
    if (!enabled) return;

    const intervalId = setInterval(() => {
      if (inFlightRef.current) return;

      const lastSaved = lastSavedValuesRef.current || {};
      const snapshot = form.getValues();
      const changed = !deepEqual(snapshot, lastSaved);
      if (!changed) return;

      pendingDataRef.current = snapshot;
      setStatus("saving");
      setError(null);
      saveData(snapshot);
    }, debounceMs);

    return () => {
      clearInterval(intervalId);
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
    triggerSave,
  };
}
