import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Sparkles, Plus, X } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { DealAttribution } from "@shared/schema";
import { TOUCHPOINT_OPTIONS } from "@shared/schema";

interface MarketingInfluenceWidgetProps {
  leadId: number;
}

export function MarketingInfluenceWidget({ leadId }: MarketingInfluenceWidgetProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [selectedTouchpoint, setSelectedTouchpoint] = useState("");

  const validLeadId = leadId && !isNaN(leadId);

  const { data: attributions, isLoading } = useQuery<DealAttribution[]>({
    queryKey: ["/api/leads", leadId, "attributions"],
    enabled: !!validLeadId,
  });

  const addMutation = useMutation({
    mutationFn: async (touchpoint: string) => {
      const response = await apiRequest("POST", `/api/leads/${leadId}/attributions`, { touchpoint });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/leads", leadId, "attributions"] });
      setSelectedTouchpoint("");
      toast({ title: "Influence Added", description: "Marketing touchpoint recorded" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (attrId: number) => {
      await apiRequest("DELETE", `/api/leads/${leadId}/attributions/${attrId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/leads", leadId, "attributions"] });
    },
  });

  const getTouchpointLabel = (value: string) => 
    TOUCHPOINT_OPTIONS.find(t => t.value === value)?.label || value;

  if (!validLeadId) {
    return null;
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Sparkles className="w-4 h-4" />
          Marketing Influence
        </CardTitle>
        <CardDescription>Track touchpoints that influenced this deal</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex gap-2">
          <Select value={selectedTouchpoint} onValueChange={setSelectedTouchpoint}>
            <SelectTrigger className="flex-1" data-testid="select-touchpoint">
              <SelectValue placeholder="Select touchpoint" />
            </SelectTrigger>
            <SelectContent>
              {TOUCHPOINT_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button 
            size="icon" 
            variant="default" 
            disabled={!selectedTouchpoint || addMutation.isPending}
            onClick={() => selectedTouchpoint && addMutation.mutate(selectedTouchpoint)}
            data-testid="button-add-touchpoint"
          >
            <Plus className="w-4 h-4" />
          </Button>
        </div>
        
        {isLoading ? (
          <div className="text-sm text-muted-foreground">Loading...</div>
        ) : attributions && attributions.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {attributions.map((attr) => (
              <Badge 
                key={attr.id} 
                variant="secondary" 
                className="gap-1 pr-1"
                data-testid={`badge-touchpoint-${attr.id}`}
              >
                {getTouchpointLabel(attr.touchpoint)}
                <Button 
                  size="icon" 
                  variant="ghost" 
                  className="h-4 w-4 p-0 ml-1"
                  onClick={() => deleteMutation.mutate(attr.id)}
                  data-testid={`button-remove-touchpoint-${attr.id}`}
                >
                  <X className="w-3 h-3" />
                </Button>
              </Badge>
            ))}
          </div>
        ) : (
          <div className="text-sm text-muted-foreground">No touchpoints recorded yet</div>
        )}
      </CardContent>
    </Card>
  );
}
