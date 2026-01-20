import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { GitBranch, Plus, Clock, Edit2, Check, X } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Quote } from "@shared/schema";
import { format } from "date-fns";

interface VersionControlProps {
  currentQuoteId: string;
  onVersionSelect: (quoteId: string) => void;
}

export default function VersionControl({ currentQuoteId, onVersionSelect }: VersionControlProps) {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newVersionName, setNewVersionName] = useState("");
  const [editingVersionId, setEditingVersionId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");

  const { data: versions = [], isLoading } = useQuery<Quote[]>({
    queryKey: ["/api/quotes", currentQuoteId, "versions"],
    queryFn: async () => {
      const response = await fetch(`/api/quotes/${currentQuoteId}/versions`);
      if (!response.ok) throw new Error("Failed to fetch versions");
      return response.json();
    },
    enabled: !!currentQuoteId,
  });

  const createVersionMutation = useMutation({
    mutationFn: async (versionName: string) => {
      const response = await apiRequest("POST", `/api/quotes/${currentQuoteId}/versions`, {
        versionName,
      });
      return response.json();
    },
    onSuccess: (newVersion: Quote) => {
      queryClient.invalidateQueries({ queryKey: ["/api/quotes", currentQuoteId, "versions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/quotes"] });
      setIsCreateDialogOpen(false);
      setNewVersionName("");
      onVersionSelect(newVersion.id);
    },
  });

  const updateVersionNameMutation = useMutation({
    mutationFn: async ({ quoteId, versionName }: { quoteId: string; versionName: string }) => {
      const response = await apiRequest("PATCH", `/api/quotes/${quoteId}`, {
        versionName,
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/quotes", currentQuoteId, "versions"] });
      setEditingVersionId(null);
      setEditingName("");
    },
  });

  const handleCreateVersion = () => {
    if (newVersionName.trim()) {
      createVersionMutation.mutate(newVersionName.trim());
    }
  };

  const handleStartEdit = (version: Quote) => {
    setEditingVersionId(version.id);
    setEditingName(version.versionName || `Version ${version.versionNumber}`);
  };

  const handleSaveEdit = (quoteId: string) => {
    if (editingName.trim()) {
      updateVersionNameMutation.mutate({ quoteId, versionName: editingName.trim() });
    }
  };

  const handleCancelEdit = () => {
    setEditingVersionId(null);
    setEditingName("");
  };

  if (isLoading) {
    return (
      <Card className="p-4">
        <div className="flex items-center gap-2 text-muted-foreground">
          <GitBranch className="h-4 w-4" />
          <span>Loading versions...</span>
        </div>
      </Card>
    );
  }

  if (versions.length === 0) {
    return null;
  }

  return (
    <Card className="p-4">
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <GitBranch className="h-5 w-5 text-primary" />
            <h3 className="font-semibold">Project Versions</h3>
            <Badge variant="secondary">{versions.length}</Badge>
          </div>
          
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" data-testid="button-create-version">
                <Plus className="h-4 w-4 mr-1" />
                New Version
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New Version</DialogTitle>
                <DialogDescription>
                  Create a copy of the current quote as a new version. All data will be duplicated.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="version-name">Version Name</Label>
                  <Input
                    id="version-name"
                    placeholder="e.g., 'Final Quote' or 'Budget Option'"
                    value={newVersionName}
                    onChange={(e) => setNewVersionName(e.target.value)}
                    data-testid="input-version-name"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={handleCreateVersion}
                  disabled={!newVersionName.trim() || createVersionMutation.isPending}
                  data-testid="button-confirm-create-version"
                >
                  {createVersionMutation.isPending ? "Creating..." : "Create Version"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <div className="space-y-2">
          {versions.map((version) => (
            <div
              key={version.id}
              className={`flex flex-wrap items-center justify-between gap-2 p-3 rounded-md border transition-colors ${
                version.id === currentQuoteId
                  ? "border-primary bg-primary/5"
                  : "border-border hover-elevate cursor-pointer"
              }`}
              onClick={() => {
                if (version.id !== currentQuoteId && editingVersionId !== version.id) {
                  onVersionSelect(version.id);
                }
              }}
              data-testid={`version-item-${version.id}`}
            >
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <Badge
                  variant={version.id === currentQuoteId ? "default" : "outline"}
                  className="shrink-0"
                >
                  V{version.versionNumber}
                </Badge>
                
                {editingVersionId === version.id ? (
                  <div className="flex items-center gap-2 flex-1">
                    <Input
                      value={editingName}
                      onChange={(e) => setEditingName(e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                      className="h-8"
                      data-testid="input-edit-version-name"
                    />
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSaveEdit(version.id);
                      }}
                      disabled={updateVersionNameMutation.isPending}
                      data-testid="button-save-version-name"
                    >
                      <Check className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCancelEdit();
                      }}
                      data-testid="button-cancel-edit-version"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <>
                    <span className="font-medium truncate">
                      {version.versionName || `Version ${version.versionNumber}`}
                    </span>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleStartEdit(version);
                      }}
                      className="h-6 w-6 shrink-0"
                      data-testid={`button-edit-version-${version.id}`}
                    >
                      <Edit2 className="h-3 w-3" />
                    </Button>
                  </>
                )}
              </div>
              
              <div className="flex items-center gap-2 text-sm text-muted-foreground shrink-0 ml-2">
                <Clock className="h-3 w-3" />
                <span>{format(new Date(version.createdAt), "MMM d, yyyy")}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}



