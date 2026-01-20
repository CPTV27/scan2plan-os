import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Users, Building2, Compass, Calculator, HardHat, KeyRound, Rocket, Landmark,
  Pencil, TrendingUp, Shield, Brain, AlertTriangle, Loader2, ChevronRight
} from "lucide-react";
import type { BuyerPersona } from "@shared/schema";

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  Building2, Compass, Calculator, HardHat, KeyRound, Rocket, Landmark, Users
};

function PersonaIcon({ name, className }: { name: string; className?: string }) {
  const Icon = iconMap[name] || Users;
  return <Icon className={className} />;
}

function getWinRateColor(winRate: string | null | undefined): "secondary" | "default" | "outline" | "destructive" {
  if (!winRate) return "secondary";
  const rate = parseFloat(winRate);
  if (isNaN(rate) || rate === 0) return "secondary";
  if (rate >= 50) return "default";
  if (rate >= 30) return "outline";
  return "destructive";
}

interface PersonaEditorProps {
  persona: BuyerPersona | null;
  onClose: () => void;
}

function PersonaEditor({ persona, onClose }: PersonaEditorProps) {
  const { toast } = useToast();
  const isNew = !persona;
  
  const [formData, setFormData] = useState({
    code: persona?.code || "",
    name: persona?.name || "",
    icon: persona?.icon || "Users",
    roleTitle: persona?.roleTitle || "",
    description: persona?.description || "",
    organizationType: persona?.organizationType || "",
    coreValues: (persona?.coreValues || []).join(", "),
    primaryPain: persona?.primaryPain || "",
    secondaryPain: persona?.secondaryPain || "",
    hiddenFear: persona?.hiddenFear || "",
    purchaseTriggers: (persona?.purchaseTriggers || []).join(", "),
    valueDriver: persona?.valueDriver || "",
    valueHook: persona?.valueHook || "",
    exactLanguage: (persona?.exactLanguage || []).join(", "),
    avoidWords: (persona?.avoidWords || []).join(", "),
    vetoPower: persona?.vetoPower ?? true,
    defaultRiskLevel: persona?.defaultRiskLevel || "medium",
    firefighterStrategy: persona?.buyingModeStrategies?.firefighter || "",
    optimizerStrategy: persona?.buyingModeStrategies?.optimizer || "",
    innovatorStrategy: persona?.buyingModeStrategies?.innovator || "",
    requiredAssets: (persona?.requiredAssets || []).join(", "),
    isActive: persona?.isActive ?? true,
  });

  const saveMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const payload = {
        ...data,
        coreValues: data.coreValues.split(",").map(s => s.trim()).filter(Boolean),
        purchaseTriggers: data.purchaseTriggers.split(",").map(s => s.trim()).filter(Boolean),
        exactLanguage: data.exactLanguage.split(",").map(s => s.trim()).filter(Boolean),
        avoidWords: data.avoidWords.split(",").map(s => s.trim()).filter(Boolean),
        requiredAssets: data.requiredAssets.split(",").map(s => s.trim()).filter(Boolean),
        buyingModeStrategies: {
          firefighter: data.firefighterStrategy,
          optimizer: data.optimizerStrategy,
          innovator: data.innovatorStrategy,
        },
      };
      
      if (isNew) {
        return apiRequest("POST", "/api/personas", payload);
      } else {
        return apiRequest("PATCH", `/api/personas/${persona.id}`, payload);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/personas"] });
      toast({ title: isNew ? "Persona created" : "Persona updated" });
      onClose();
    },
    onError: (error: any) => {
      toast({ 
        title: "Failed to save persona", 
        description: error.message,
        variant: "destructive" 
      });
    },
  });

  return (
    <DialogContent className="max-w-3xl max-h-[90vh]">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <PersonaIcon name={formData.icon} className="h-5 w-5" />
          {isNew ? "Create New Persona" : `Edit ${persona?.name}`}
        </DialogTitle>
        <DialogDescription>
          Define buyer psychology, communication preferences, and sales strategies
        </DialogDescription>
      </DialogHeader>

      <Tabs defaultValue="identity" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="identity">Identity</TabsTrigger>
          <TabsTrigger value="strategy">Strategy</TabsTrigger>
          <TabsTrigger value="risk">Risk & Assets</TabsTrigger>
          <TabsTrigger value="insights">AI Insights</TabsTrigger>
        </TabsList>

        <ScrollArea className="h-[60vh] mt-4 pr-4">
          <TabsContent value="identity" className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="code">Persona Code</Label>
                <Input 
                  id="code" 
                  value={formData.code} 
                  onChange={e => setFormData(p => ({ ...p, code: e.target.value }))}
                  placeholder="BP8"
                  data-testid="input-persona-code"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="name">Display Name</Label>
                <Input 
                  id="name" 
                  value={formData.name} 
                  onChange={e => setFormData(p => ({ ...p, name: e.target.value }))}
                  placeholder="The Innovator"
                  data-testid="input-persona-name"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="icon">Icon</Label>
                <Select value={formData.icon} onValueChange={v => setFormData(p => ({ ...p, icon: v }))}>
                  <SelectTrigger data-testid="select-persona-icon">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.keys(iconMap).map(name => (
                      <SelectItem key={name} value={name}>
                        <span className="flex items-center gap-2">
                          <PersonaIcon name={name} className="h-4 w-4" />
                          {name}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="roleTitle">Role Title</Label>
                <Input 
                  id="roleTitle" 
                  value={formData.roleTitle} 
                  onChange={e => setFormData(p => ({ ...p, roleTitle: e.target.value }))}
                  placeholder="Design Principal"
                  data-testid="input-persona-role"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea 
                id="description" 
                value={formData.description} 
                onChange={e => setFormData(p => ({ ...p, description: e.target.value }))}
                placeholder="Brief description of this buyer type..."
                className="min-h-20"
                data-testid="textarea-persona-description"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="coreValues">Core Values (comma-separated)</Label>
              <Input 
                id="coreValues" 
                value={formData.coreValues} 
                onChange={e => setFormData(p => ({ ...p, coreValues: e.target.value }))}
                placeholder="Design Integrity, Accuracy, Efficiency"
                data-testid="input-persona-values"
              />
            </div>

            <Separator />

            <div className="space-y-2">
              <Label htmlFor="primaryPain">Primary Pain Point</Label>
              <Textarea 
                id="primaryPain" 
                value={formData.primaryPain} 
                onChange={e => setFormData(p => ({ ...p, primaryPain: e.target.value }))}
                placeholder="The main problem this persona faces..."
                className="min-h-16"
                data-testid="textarea-persona-pain"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="hiddenFear">Hidden Fear</Label>
              <Textarea 
                id="hiddenFear" 
                value={formData.hiddenFear} 
                onChange={e => setFormData(p => ({ ...p, hiddenFear: e.target.value }))}
                placeholder="The unspoken concern driving their decisions..."
                className="min-h-16"
                data-testid="textarea-persona-fear"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="purchaseTriggers">Purchase Triggers (comma-separated)</Label>
              <Input 
                id="purchaseTriggers" 
                value={formData.purchaseTriggers} 
                onChange={e => setFormData(p => ({ ...p, purchaseTriggers: e.target.value }))}
                placeholder="Renovation project, Historic preservation, Adaptive reuse"
                data-testid="input-persona-triggers"
              />
            </div>
          </TabsContent>

          <TabsContent value="strategy" className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="valueHook">Value Hook</Label>
              <Textarea 
                id="valueHook" 
                value={formData.valueHook} 
                onChange={e => setFormData(p => ({ ...p, valueHook: e.target.value }))}
                placeholder="The compelling one-liner that captures their attention..."
                className="min-h-16"
                data-testid="textarea-persona-hook"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="exactLanguage">Exact Language to Use (comma-separated)</Label>
              <Input 
                id="exactLanguage" 
                value={formData.exactLanguage} 
                onChange={e => setFormData(p => ({ ...p, exactLanguage: e.target.value }))}
                placeholder="design integrity, accurate base drawings, point cloud precision"
                data-testid="input-persona-language"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="avoidWords">Words to AVOID (comma-separated)</Label>
              <Input 
                id="avoidWords" 
                value={formData.avoidWords} 
                onChange={e => setFormData(p => ({ ...p, avoidWords: e.target.value }))}
                placeholder="cheap, good enough, rough estimate"
                data-testid="input-persona-avoid"
              />
            </div>

            <Separator />
            
            <h3 className="text-sm font-medium flex items-center gap-2">
              <Brain className="h-4 w-4" />
              Buying Mode Strategies
            </h3>

            <div className="space-y-2">
              <Label htmlFor="firefighter" className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-red-500" />
                Firefighter Mode (Urgent Need)
              </Label>
              <Textarea 
                id="firefighter" 
                value={formData.firefighterStrategy} 
                onChange={e => setFormData(p => ({ ...p, firefighterStrategy: e.target.value }))}
                placeholder="Lead with speed: 'We can have verified documentation in 5 business days...'"
                className="min-h-16"
                data-testid="textarea-firefighter-strategy"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="optimizer" className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-blue-500" />
                Optimizer Mode (Value Focus)
              </Label>
              <Textarea 
                id="optimizer" 
                value={formData.optimizerStrategy} 
                onChange={e => setFormData(p => ({ ...p, optimizerStrategy: e.target.value }))}
                placeholder="Lead with ROI: 'Our clients typically see 3x return through...'"
                className="min-h-16"
                data-testid="textarea-optimizer-strategy"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="innovator" className="flex items-center gap-2">
                <Rocket className="h-4 w-4 text-purple-500" />
                Innovator Mode (Future Vision)
              </Label>
              <Textarea 
                id="innovator" 
                value={formData.innovatorStrategy} 
                onChange={e => setFormData(p => ({ ...p, innovatorStrategy: e.target.value }))}
                placeholder="Lead with competitive edge: 'Be the first to leverage digital twin...'"
                className="min-h-16"
                data-testid="textarea-innovator-strategy"
              />
            </div>
          </TabsContent>

          <TabsContent value="risk" className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="riskLevel">Default Risk Level</Label>
                <Select 
                  value={formData.defaultRiskLevel} 
                  onValueChange={v => setFormData(p => ({ ...p, defaultRiskLevel: v as "low" | "medium" | "high" }))}
                >
                  <SelectTrigger data-testid="select-persona-risk">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low Risk</SelectItem>
                    <SelectItem value="medium">Medium Risk</SelectItem>
                    <SelectItem value="high">High Risk</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <Label>Veto Power</Label>
                  <p className="text-xs text-muted-foreground">Can block deal single-handedly</p>
                </div>
                <Switch 
                  checked={formData.vetoPower}
                  onCheckedChange={v => setFormData(p => ({ ...p, vetoPower: v }))}
                  data-testid="switch-persona-veto"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="requiredAssets">Required Assets (comma-separated)</Label>
              <Input 
                id="requiredAssets" 
                value={formData.requiredAssets} 
                onChange={e => setFormData(p => ({ ...p, requiredAssets: e.target.value }))}
                placeholder="sample_deliverables, accuracy_specifications, roi_calculator"
                data-testid="input-persona-assets"
              />
            </div>

            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div>
                <Label>Active</Label>
                <p className="text-xs text-muted-foreground">Include in persona suggestions</p>
              </div>
              <Switch 
                checked={formData.isActive}
                onCheckedChange={v => setFormData(p => ({ ...p, isActive: v }))}
                data-testid="switch-persona-active"
              />
            </div>
          </TabsContent>

          <TabsContent value="insights" className="space-y-4">
            {persona ? (
              <div className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Performance Metrics</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Win Rate</span>
                      <Badge variant={getWinRateColor(persona.winRate)}>
                        {persona.winRate ? `${parseFloat(persona.winRate).toFixed(1)}%` : "No data"}
                      </Badge>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Avg Deal Size</span>
                      <span className="font-medium">
                        {persona.avgDealSize ? `$${parseFloat(persona.avgDealSize).toLocaleString()}` : "No data"}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Avg Sales Cycle</span>
                      <span className="font-medium">
                        {persona.avgSalesCycleDays ? `${persona.avgSalesCycleDays} days` : "No data"}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Total Insights</span>
                      <span className="font-medium">{persona.totalDeals || 0}</span>
                    </div>
                  </CardContent>
                </Card>

                <p className="text-sm text-muted-foreground text-center">
                  Insights are automatically collected from deal outcomes and analyzed by AI to refine persona strategies.
                </p>
              </div>
            ) : (
              <div className="text-center text-muted-foreground py-8">
                AI insights will be available after creating this persona and recording deal outcomes.
              </div>
            )}
          </TabsContent>
        </ScrollArea>
      </Tabs>

      <div className="flex justify-end gap-2 pt-4 border-t">
        <Button variant="outline" onClick={onClose} data-testid="button-cancel-persona">
          Cancel
        </Button>
        <Button 
          onClick={() => saveMutation.mutate(formData)}
          disabled={saveMutation.isPending || !formData.code || !formData.name}
          data-testid="button-save-persona"
        >
          {saveMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
          {isNew ? "Create Persona" : "Save Changes"}
        </Button>
      </div>
    </DialogContent>
  );
}

export default function PersonaManager() {
  const [editingPersona, setEditingPersona] = useState<BuyerPersona | null>(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);

  const { data: personas, isLoading } = useQuery<BuyerPersona[]>({
    queryKey: ["/api/personas"],
  });

  const openEditor = (persona: BuyerPersona | null) => {
    setEditingPersona(persona);
    setIsEditorOpen(true);
  };

  const closeEditor = () => {
    setIsEditorOpen(false);
    setEditingPersona(null);
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          Buyer Personas
        </CardTitle>
        <CardDescription>
          Manage buyer psychology profiles for AI-powered sales guidance
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3">
          {personas?.map(persona => (
            <Dialog key={persona.id} open={isEditorOpen && editingPersona?.id === persona.id} onOpenChange={open => !open && closeEditor()}>
              <DialogTrigger asChild>
                <div 
                  className="flex items-center justify-between p-3 border rounded-lg hover-elevate cursor-pointer"
                  onClick={() => openEditor(persona)}
                  data-testid={`card-persona-${persona.code}`}
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-md bg-muted">
                      <PersonaIcon name={persona.icon || "Users"} className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{persona.name}</span>
                        <Badge variant="outline" className="text-xs">{persona.code}</Badge>
                        {!persona.isActive && (
                          <Badge variant="secondary" className="text-xs">Inactive</Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">{persona.roleTitle}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant={getWinRateColor(persona.winRate)}>
                      {persona.winRate ? `${parseFloat(persona.winRate).toFixed(0)}% win` : "No data"}
                    </Badge>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </div>
              </DialogTrigger>
              <PersonaEditor persona={persona} onClose={closeEditor} />
            </Dialog>
          ))}
        </div>

        <Separator />

        <Dialog open={isEditorOpen && editingPersona === null} onOpenChange={open => !open && closeEditor()}>
          <DialogTrigger asChild>
            <Button 
              variant="outline" 
              className="w-full"
              onClick={() => openEditor(null)}
              data-testid="button-create-persona"
            >
              Create New Persona
            </Button>
          </DialogTrigger>
          <PersonaEditor persona={null} onClose={closeEditor} />
        </Dialog>
      </CardContent>
    </Card>
  );
}
