import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Building2, Compass, Calculator, HardHat, KeyRound, Rocket, Landmark, Users,
  Brain, AlertTriangle, TrendingUp, Zap, ChevronDown, ChevronRight, Sparkles,
  MessageSquare, ShieldCheck, Target, Lightbulb, Ban, Volume2
} from "lucide-react";
import type { Lead, BuyerPersona } from "@shared/schema";

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  Building2, Compass, Calculator, HardHat, KeyRound, Rocket, Landmark, Users
};

function PersonaIcon({ name, className }: { name: string; className?: string }) {
  const Icon = iconMap[name] || Users;
  return <Icon className={className} />;
}

type BuyingMode = "firefighter" | "optimizer" | "innovator";

const BUYING_MODES: { value: BuyingMode; label: string; icon: React.ComponentType<{ className?: string }>; color: string; description: string }[] = [
  { 
    value: "firefighter", 
    label: "Firefighter", 
    icon: AlertTriangle, 
    color: "text-red-500",
    description: "Urgent need - lead with speed and certainty"
  },
  { 
    value: "optimizer", 
    label: "Optimizer", 
    icon: TrendingUp, 
    color: "text-blue-500",
    description: "Value focus - lead with ROI and efficiency"
  },
  { 
    value: "innovator", 
    label: "Innovator", 
    icon: Rocket, 
    color: "text-purple-500",
    description: "Future vision - lead with competitive edge"
  },
];

interface SalesCoPilotProps {
  lead: Lead;
  compact?: boolean;
}

export function SalesCoPilot({ lead, compact = false }: SalesCoPilotProps) {
  const [selectedMode, setSelectedMode] = useState<BuyingMode>("optimizer");
  const [expandedSections, setExpandedSections] = useState<string[]>(["strategy"]);

  const { data: persona, isLoading } = useQuery<BuyerPersona>({
    queryKey: ["/api/personas", lead.buyerPersona],
    enabled: !!lead.buyerPersona,
    queryFn: async () => {
      const res = await fetch(`/api/personas?code=${lead.buyerPersona}`);
      const personas = await res.json();
      return personas[0];
    }
  });

  const toggleSection = (section: string) => {
    setExpandedSections(prev => 
      prev.includes(section) 
        ? prev.filter(s => s !== section)
        : [...prev, section]
    );
  };

  if (!lead.buyerPersona) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-6 text-center">
          <Users className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Assign a buyer persona to unlock AI sales guidance
          </p>
        </CardContent>
      </Card>
    );
  }

  if (isLoading || !persona) {
    return (
      <Card>
        <CardContent className="py-6 text-center">
          <div className="animate-pulse flex flex-col items-center gap-2">
            <div className="h-8 w-8 bg-muted rounded-full" />
            <div className="h-4 w-32 bg-muted rounded" />
          </div>
        </CardContent>
      </Card>
    );
  }

  const currentModeInfo = BUYING_MODES.find(m => m.value === selectedMode)!;
  const modeStrategy = persona.buyingModeStrategies?.[selectedMode] || "No specific strategy defined.";

  if (compact) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <PersonaIcon name={persona.icon || "Users"} className="h-4 w-4" />
            {persona.name}
            <Badge variant="outline" className="ml-auto text-xs">{persona.code}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-1">
            {BUYING_MODES.map(mode => {
              const ModeIcon = mode.icon;
              return (
                <Button
                  key={mode.value}
                  size="sm"
                  variant={selectedMode === mode.value ? "default" : "outline"}
                  className="flex-1 gap-1"
                  onClick={() => setSelectedMode(mode.value)}
                  data-testid={`button-mode-${mode.value}`}
                >
                  <ModeIcon className={`h-3 w-3 ${selectedMode === mode.value ? "" : mode.color}`} />
                  <span className="text-xs">{mode.label}</span>
                </Button>
              );
            })}
          </div>
          <div className="p-2 rounded-lg bg-muted text-sm">
            <p className="font-medium flex items-center gap-1 mb-1">
              <Lightbulb className="h-3 w-3" />
              Strategy
            </p>
            <p className="text-muted-foreground text-xs">{modeStrategy}</p>
          </div>
          <div className="p-2 rounded-lg bg-primary/5 text-sm">
            <p className="font-medium flex items-center gap-1 mb-1">
              <Target className="h-3 w-3" />
              Value Hook
            </p>
            <p className="text-muted-foreground text-xs italic">"{persona.valueHook}"</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-md bg-primary/10">
              <PersonaIcon name={persona.icon || "Users"} className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-base">{persona.name}</CardTitle>
              <CardDescription>{persona.roleTitle}</CardDescription>
            </div>
          </div>
          <Badge variant="outline">{persona.code}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-2">Buying Mode</p>
          <div className="flex gap-2">
            {BUYING_MODES.map(mode => {
              const ModeIcon = mode.icon;
              const isActive = selectedMode === mode.value;
              return (
                <Button
                  key={mode.value}
                  size="sm"
                  variant={isActive ? "default" : "outline"}
                  className="flex-1 gap-1"
                  onClick={() => setSelectedMode(mode.value)}
                  data-testid={`button-mode-${mode.value}`}
                >
                  <ModeIcon className={`h-4 w-4 ${isActive ? "" : mode.color}`} />
                  {mode.label}
                </Button>
              );
            })}
          </div>
          <p className="text-xs text-muted-foreground mt-2 text-center">
            {currentModeInfo.description}
          </p>
        </div>

        <Separator />

        <Collapsible 
          open={expandedSections.includes("strategy")} 
          onOpenChange={() => toggleSection("strategy")}
        >
          <CollapsibleTrigger className="flex items-center justify-between w-full p-2 rounded-md hover-elevate">
            <span className="flex items-center gap-2 text-sm font-medium">
              <Sparkles className="h-4 w-4 text-yellow-500" />
              Mode Strategy
            </span>
            {expandedSections.includes("strategy") 
              ? <ChevronDown className="h-4 w-4" />
              : <ChevronRight className="h-4 w-4" />
            }
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-2">
            <div className="p-3 rounded-lg bg-muted text-sm">
              {modeStrategy}
            </div>
          </CollapsibleContent>
        </Collapsible>

        <Collapsible 
          open={expandedSections.includes("valuehook")} 
          onOpenChange={() => toggleSection("valuehook")}
        >
          <CollapsibleTrigger className="flex items-center justify-between w-full p-2 rounded-md hover-elevate">
            <span className="flex items-center gap-2 text-sm font-medium">
              <Target className="h-4 w-4 text-green-500" />
              Value Hook
            </span>
            {expandedSections.includes("valuehook") 
              ? <ChevronDown className="h-4 w-4" />
              : <ChevronRight className="h-4 w-4" />
            }
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-2">
            <div className="p-3 rounded-lg bg-green-50 dark:bg-green-950/30 text-sm italic">
              "{persona.valueHook}"
            </div>
          </CollapsibleContent>
        </Collapsible>

        <Collapsible 
          open={expandedSections.includes("language")} 
          onOpenChange={() => toggleSection("language")}
        >
          <CollapsibleTrigger className="flex items-center justify-between w-full p-2 rounded-md hover-elevate">
            <span className="flex items-center gap-2 text-sm font-medium">
              <MessageSquare className="h-4 w-4 text-blue-500" />
              Exact Language
            </span>
            {expandedSections.includes("language") 
              ? <ChevronDown className="h-4 w-4" />
              : <ChevronRight className="h-4 w-4" />
            }
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-2 space-y-2">
            <div>
              <p className="text-xs font-medium text-green-600 dark:text-green-400 flex items-center gap-1 mb-1">
                <Volume2 className="h-3 w-3" /> Use These Phrases
              </p>
              <div className="flex flex-wrap gap-1">
                {persona.exactLanguage?.map((phrase, i) => (
                  <Badge key={i} variant="outline" className="text-xs bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800">
                    {phrase}
                  </Badge>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs font-medium text-red-600 dark:text-red-400 flex items-center gap-1 mb-1">
                <Ban className="h-3 w-3" /> Avoid These Words
              </p>
              <div className="flex flex-wrap gap-1">
                {persona.avoidWords?.map((word, i) => (
                  <Badge key={i} variant="outline" className="text-xs bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800 line-through">
                    {word}
                  </Badge>
                ))}
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>

        <Collapsible 
          open={expandedSections.includes("pain")} 
          onOpenChange={() => toggleSection("pain")}
        >
          <CollapsibleTrigger className="flex items-center justify-between w-full p-2 rounded-md hover-elevate">
            <span className="flex items-center gap-2 text-sm font-medium">
              <AlertTriangle className="h-4 w-4 text-orange-500" />
              Pain Points & Fears
            </span>
            {expandedSections.includes("pain") 
              ? <ChevronDown className="h-4 w-4" />
              : <ChevronRight className="h-4 w-4" />
            }
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-2 space-y-2">
            <div className="p-2 rounded-lg bg-orange-50 dark:bg-orange-950/30 text-sm">
              <p className="font-medium text-xs text-orange-700 dark:text-orange-400">Primary Pain</p>
              <p className="text-muted-foreground text-sm">{persona.primaryPain}</p>
            </div>
            {persona.hiddenFear && (
              <div className="p-2 rounded-lg bg-red-50 dark:bg-red-950/30 text-sm">
                <p className="font-medium text-xs text-red-700 dark:text-red-400">Hidden Fear</p>
                <p className="text-muted-foreground text-sm">{persona.hiddenFear}</p>
              </div>
            )}
          </CollapsibleContent>
        </Collapsible>

        <Collapsible 
          open={expandedSections.includes("triggers")} 
          onOpenChange={() => toggleSection("triggers")}
        >
          <CollapsibleTrigger className="flex items-center justify-between w-full p-2 rounded-md hover-elevate">
            <span className="flex items-center gap-2 text-sm font-medium">
              <Zap className="h-4 w-4 text-purple-500" />
              Purchase Triggers
            </span>
            {expandedSections.includes("triggers") 
              ? <ChevronDown className="h-4 w-4" />
              : <ChevronRight className="h-4 w-4" />
            }
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-2">
            <div className="flex flex-wrap gap-1">
              {persona.purchaseTriggers?.map((trigger, i) => (
                <Badge key={i} variant="secondary" className="text-xs">
                  {trigger}
                </Badge>
              ))}
            </div>
          </CollapsibleContent>
        </Collapsible>

        {persona.vetoPower && (
          <div className="flex items-center gap-2 p-2 rounded-lg bg-yellow-50 dark:bg-yellow-950/30 text-sm">
            <ShieldCheck className="h-4 w-4 text-yellow-600" />
            <span className="text-yellow-700 dark:text-yellow-400 font-medium">Has Veto Power</span>
          </div>
        )}

        <Separator />

        <div className="text-center">
          <Badge variant={
            !persona.winRate ? "secondary" :
            parseFloat(persona.winRate) >= 50 ? "default" :
            parseFloat(persona.winRate) >= 30 ? "outline" : "destructive"
          }>
            {persona.winRate 
              ? `${parseFloat(persona.winRate).toFixed(0)}% Win Rate` 
              : "No data yet"
            }
          </Badge>
          {persona.avgSalesCycleDays && (
            <p className="text-xs text-muted-foreground mt-1">
              Avg {persona.avgSalesCycleDays} day sales cycle
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
