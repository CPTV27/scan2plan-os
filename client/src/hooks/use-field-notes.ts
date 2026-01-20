import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl, type InsertFieldNote } from "@shared/routes";

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

export function useFieldNotes() {
  return useQuery({
    queryKey: [api.fieldNotes.list.path],
    queryFn: async () => {
      const res = await fetch(api.fieldNotes.list.path, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch field notes");
      return api.fieldNotes.list.responses[200].parse(await res.json());
    },
  });
}

export function useCreateFieldNote() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: InsertFieldNote) => {
      const validated = api.fieldNotes.create.input.parse(data);
      const res = await fetch(api.fieldNotes.create.path, {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify(validated),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to create field note");
      return api.fieldNotes.create.responses[201].parse(await res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.fieldNotes.list.path] });
    },
  });
}

export function useProcessFieldNote() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const url = buildUrl(api.fieldNotes.process.path, { id });
      const res = await fetch(url, { 
        method: "POST",
        headers: getHeaders(false),
        credentials: "include" 
      });
      if (!res.ok) throw new Error("Failed to process field note");
      return api.fieldNotes.process.responses[200].parse(await res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.fieldNotes.list.path] });
    },
  });
}
