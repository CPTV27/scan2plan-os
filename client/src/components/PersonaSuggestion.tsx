import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { 
  Sparkles, 
  Check, 
  X, 
  Building2, 
  Compass, 
  Calculator, 
  HardHat, 
  KeyRound, 
  Rocket, 
  Landmark, 
  Users,
  RefreshCw,
  AlertCircle
} from "lucide-react";
import type { BuyerPersona } from "@shared/schema";

const iconMap: Record<string, any> = {
  Building2,
  Compass,
  Calculator,
  HardHat,
  KeyRound,
  Rocket,
  Landmark,
  Users,
};

interface PersonaSuggestionProps {
  leadId: number;
  clientName: string;
  projectName?: string;
  projectType?: string;
  contactName?: string;
  contactTitle?: string;
  notes?: string;
  currentPersonaCode?: string;
  onPersonaAssigned?: (code: string) => void;
}

export function PersonaSuggestion({
  leadId,
  clientName,
  projectName,
  projectType,
  contactName,
  contactTitle,
  notes,
  currentPersonaCode,
  onPersonaAssigned,
}: PersonaSuggestionProps) {
  const { toast } = useToast();
  const [dismissed, setDismissed] = useState(false);
  const [suggestion, setSuggestion] = useState<{
    suggestedCode: string;
    confidence: number;
    reasoning: string;
  } | null>(null);

  const { data: personas } = useQuery<BuyerPersona[]>({
    queryKey: ["/api/personas"],
  });

  const suggestMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/personas/suggest", {
        clientName,
        projectName,
        projectType,
        contactName,
        contactTitle,
        notes,
      });
      return response.json();
    },
    onSuccess: (data) => {
      setSuggestion(data);
    },
    onError: (error: Error) => {
      toast({
        title: "Suggestion failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const assignMutation = useMutation({
    mutationFn: async (code: string) => {
      const response = await apiRequest("PATCH", `/api/leads/${leadId}`, {
        buyerPersona: code,
      });
      return response.json();
    },
    onSuccess: (_, code) => {
      toast({
        title: "Persona assigned",
        description: `Lead updated with ${code} persona`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/leads", leadId] });
      onPersonaAssigned?.(code);
      setDismissed(true);
    },
    onError: (error: Error) => {
      toast({
        title: "Assignment failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  if (currentPersonaCode || dismissed) {
    return null;
  }

  const suggestedPersona = suggestion 
    ? personas?.find(p => p.code === suggestion.suggestedCode) 
    : null;

  const IconComponent = suggestedPersona?.icon 
    ? iconMap[suggestedPersona.icon] || Users 
    : Sparkles;

  const confidenceColor = suggestion
    ? suggestion.confidence >= 0.8 
      ? "text-green-500" 
      : suggestion.confidence >= 0.5 
        ? "text-yellow-500" 
        : "text-orange-500"
    : "";

  return (
    <Card className="border-dashed border-primary/30 bg-primary/5">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary" />
            <CardTitle className="text-sm">AI Persona Suggestion</CardTitle>
          </div>
          {!suggestion && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setDismissed(true)}
              data-testid="button-dismiss-persona-suggestion"
            >
              <X className="w-4 h-4" />
            </Button>
          )}
        </div>
        {!suggestion && (
          <CardDescription className="text-xs">
            Get AI-powered buyer persona recommendation for this lead
          </CardDescription>
        )}
      </CardHeader>
      <CardContent>
        {!suggestion ? (
          <Button
            size="sm"
            variant="outline"
            onClick={() => suggestMutation.mutate()}
            disabled={suggestMutation.isPending || !clientName}
            className="w-full"
            data-testid="button-get-persona-suggestion"
          >
            {suggestMutation.isPending ? (
              <>
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                Analyzing...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 mr-2" />
                Suggest Persona
              </>
            )}
          </Button>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <IconComponent className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{suggestedPersona?.name || suggestion.suggestedCode}</span>
                  <Badge variant="outline" className="text-xs">
                    {suggestion.suggestedCode}
                  </Badge>
                </div>
                <p className={`text-xs ${confidenceColor}`}>
                  {Math.round(suggestion.confidence * 100)}% confidence
                </p>
              </div>
            </div>

            <p className="text-xs text-muted-foreground">
              {suggestion.reasoning}
            </p>

            {suggestedPersona && (
              <div className="text-xs space-y-1 bg-muted/50 rounded-md p-2">
                <p><span className="font-medium">Primary Pain:</span> {suggestedPersona.primaryPain}</p>
                <p><span className="font-medium">Value Hook:</span> {suggestedPersona.valueHook}</p>
              </div>
            )}

            <div className="flex gap-2">
              <Button
                size="sm"
                variant="default"
                className="flex-1"
                onClick={() => assignMutation.mutate(suggestion.suggestedCode)}
                disabled={assignMutation.isPending}
                data-testid="button-accept-persona-suggestion"
              >
                <Check className="w-4 h-4 mr-1" />
                Accept
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setSuggestion(null)}
                data-testid="button-retry-persona-suggestion"
              >
                <RefreshCw className="w-4 h-4" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setDismissed(true)}
                data-testid="button-dismiss-accepted-suggestion"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
