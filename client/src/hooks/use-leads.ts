import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl, type InsertLead } from "@shared/routes";
import { ZodError } from "zod";

function getCsrfToken(): string | null {
  const match = document.cookie.match(/csrf-token=([^;]+)/);
  return match ? match[1] : null;
}

function getHeaders(includeContentType = true): Record<string, string> {
  const headers: Record<string, string> = {};
  if (includeContentType) {
    headers["Content-Type"] = "application/json";
  }
  const csrfToken = getCsrfToken();
  if (csrfToken) {
    headers["x-csrf-token"] = csrfToken;
  }
  return headers;
}

export function useLeads() {
  return useQuery({
    queryKey: [api.leads.list.path],
    queryFn: async () => {
      const res = await fetch(api.leads.list.path, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch leads");
      return api.leads.list.responses[200].parse(await res.json());
    },
  });
}

export function useLead(id: number) {
  return useQuery({
    queryKey: [api.leads.get.path, id],
    queryFn: async () => {
      const url = buildUrl(api.leads.get.path, { id });
      const res = await fetch(url, { credentials: "include" });
      if (res.status === 404) return null;
      if (!res.ok) throw new Error("Failed to fetch lead");
      return api.leads.get.responses[200].parse(await res.json());
    },
    enabled: !!id,
  });
}

export function useCreateLead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: InsertLead) => {
      let validated;
      try {
        validated = api.leads.create.input.parse(data);
      } catch (err) {
        if (err instanceof ZodError) {
          const fieldErrors = err.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
          throw new Error(`Validation error: ${fieldErrors}`);
        }
        throw err;
      }
      
      const res = await fetch(api.leads.create.path, {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify(validated),
        credentials: "include",
      });
      
      if (res.status === 401) {
        throw new Error("Session expired. Please log out and log back in.");
      }
      
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || `Server error (${res.status})`);
      }
      return api.leads.create.responses[201].parse(await res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.leads.list.path] });
    },
  });
}

export function useUpdateLead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: number } & Partial<InsertLead>) => {
      let validated;
      try {
        validated = api.leads.update.input.parse(updates);
      } catch (err) {
        if (err instanceof ZodError) {
          const fieldErrors = err.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
          throw new Error(`Validation error: ${fieldErrors}`);
        }
        throw err;
      }
      
      const url = buildUrl(api.leads.update.path, { id });
      const res = await fetch(url, {
        method: "PUT",
        headers: getHeaders(),
        body: JSON.stringify(validated),
        credentials: "include",
      });
      
      if (res.status === 401) {
        throw new Error("Session expired. Please log out and log back in.");
      }
      
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || `Server error (${res.status})`);
      }
      const result = api.leads.update.responses[200].parse(await res.json());
      // Return result with id for onSuccess invalidation
      return { ...result, _updatedId: id };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [api.leads.list.path] });
      queryClient.invalidateQueries({ queryKey: [api.projects.list.path] });
      // Invalidate both specific lead query patterns used in the codebase
      if (data && typeof data._updatedId === 'number') {
        // Pattern used by DealWorkspace: ["/api/leads", id]
        queryClient.invalidateQueries({ queryKey: ["/api/leads", data._updatedId] });
        // Pattern used by useLead hook: [api.leads.get.path, id]
        queryClient.invalidateQueries({ queryKey: [api.leads.get.path, data._updatedId] });
      }
    },
  });
}

export function useDeleteLead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const url = buildUrl(api.leads.delete.path, { id });
      const res = await fetch(url, { 
        method: "DELETE",
        headers: getHeaders(false),
        credentials: "include" 
      });
      if (!res.ok) throw new Error("Failed to delete lead");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.leads.list.path] });
    },
  });
}
