import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormLabel } from "@/components/ui/form";
import { Star, AlertTriangle, ExternalLink, Loader2, Save } from "lucide-react";
import type { Lead } from "@shared/schema";
import type { useUpdateLead } from "@/hooks/use-leads";
import type { useQueryClient } from "@tanstack/react-query";
import type { useToast } from "@/hooks/use-toast";

interface TierAEstimatorCardProps {
  lead: Lead;
  leadId: number;
  updateMutation: ReturnType<typeof useUpdateLead>;
  queryClient: ReturnType<typeof useQueryClient>;
  toast: ReturnType<typeof useToast>["toast"];
}

export function TierAEstimatorCard({ 
  lead, 
  leadId, 
  updateMutation, 
  queryClient, 
  toast 
}: TierAEstimatorCardProps) {
  const [cardUrl, setCardUrl] = useState((lead as any).estimatorCardUrl || "");
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    if (!cardUrl.trim()) return;
    setIsSaving(true);
    try {
      await updateMutation.mutateAsync({
        id: leadId,
        estimatorCardUrl: cardUrl.trim(),
      } as any);
      queryClient.invalidateQueries({ queryKey: ["/api/leads", leadId] });
      toast({ title: "Estimator card linked", description: "Proposal generation is now available." });
    } catch (err) {
      toast({ title: "Error", description: "Failed to save estimator card link", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const hasExistingCard = !!(lead as any).estimatorCardUrl;
  const hasUnsavedChanges = cardUrl !== ((lead as any).estimatorCardUrl || "");

  return (
    <Card className="border-amber-500/30 bg-amber-500/5">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Star className="w-4 h-4 text-amber-500" />
          Tier A Requirements
          {hasExistingCard ? (
            <Badge variant="secondary" className="ml-auto gap-1 text-green-600">
              Complete
            </Badge>
          ) : (
            <Badge variant="outline" className="ml-auto gap-1 text-amber-600">
              Recommended
            </Badge>
          )}
        </CardTitle>
        <CardDescription>
          Large projects ({(lead.sqft || 0).toLocaleString()} sqft) - estimator card helps with proposal accuracy.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-end gap-2">
          <div className="flex-1">
            <FormLabel>Estimator Card URL</FormLabel>
            <Input
              placeholder="Paste Google Drive link to estimator card..."
              value={cardUrl}
              onChange={(e) => setCardUrl(e.target.value)}
              data-testid="input-estimator-card-url"
            />
          </div>
          <Button
            variant={hasUnsavedChanges ? "default" : "outline"}
            size="sm"
            onClick={handleSave}
            disabled={!cardUrl.trim() || !hasUnsavedChanges || isSaving}
            data-testid="button-save-estimator-card"
          >
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          </Button>
          {hasExistingCard && (
            <Button
              variant="outline"
              size="sm"
              asChild
            >
              <a href={(lead as any).estimatorCardUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="w-4 h-4" />
              </a>
            </Button>
          )}
        </div>
        {!hasExistingCard && (
          <div className="flex items-center gap-2 p-2 text-sm rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400" data-testid="alert-estimator-recommended">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            <span>Adding an estimator card improves AI proposal accuracy for Tier A projects.</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
