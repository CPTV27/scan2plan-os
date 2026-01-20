import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { Sidebar, MobileHeader } from "@/components/Sidebar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Sun, Moon, Plus, X, Check, AlertTriangle,
  Database, Link2, Brain, MapPin, Loader2, Save, RefreshCw, DollarSign, Cloud, HelpCircle,
  ClipboardList, Pencil, Trash2
} from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import type { LeadSourcesConfig, StalenessConfig, BusinessDefaultsConfig, GcsStorageConfig } from "@shared/schema";
import { GCS_STORAGE_MODES } from "@shared/schema";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import PersonaManager from "@/components/PersonaManager";

interface IntegrationStatus {
  airtable: { configured: boolean; writeEnabled: boolean };
  cpq: { configured: boolean; baseUrl: string };
  openai: { configured: boolean };
}

interface QuickBooksStatus {
  configured: boolean;
  connected: boolean;
  redirectUri?: string;
  error?: string;
}

interface GHLStatus {
  configured: boolean;
  hasApiKey: boolean;
  hasLocationId: boolean;
}

interface GHLTestResult {
  connected: boolean;
  message: string;
  contactCount?: number;
  opportunityCount?: number;
}

interface GHLSyncResult {
  success: boolean;
  synced: number;
  errors: string[];
  opportunities: any[];
}

interface QBAccount {
  id: string;
  name: string;
  type: string;
  balance?: number;
}

interface QBAccountsResponse {
  bankAccounts: QBAccount[];
  creditCardAccounts: QBAccount[];
  allAccounts: QBAccount[];
}

interface FinancialMapping {
  operatingAccountId: string | null;
  taxAccountId: string | null;
  expenseAccountId: string | null;
}

export default function Settings() {
  const { toast } = useToast();
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    // Check if dark class is already on the document (set by inline script in HTML)
    if (typeof document !== 'undefined' && document.documentElement.classList.contains('dark')) {
      return 'dark';
    }
    const stored = localStorage.getItem("theme") as "light" | "dark" | null;
    return stored || 'dark';
  });

  const toggleTheme = () => {
    const newTheme = theme === "dark" ? "light" : "dark";
    setTheme(newTheme);
    localStorage.setItem("theme", newTheme);
    document.documentElement.classList.toggle("dark", newTheme === "dark");
  };

  // Fetch all settings
  const { data: settings, isLoading } = useQuery<Record<string, unknown>>({
    queryKey: ["/api/settings"],
  });

  // Fetch integration status
  const { data: integrations } = useQuery<IntegrationStatus>({
    queryKey: ["/api/integrations/status"],
  });

  // Fetch QuickBooks status
  const { data: qbStatus, refetch: refetchQB } = useQuery<QuickBooksStatus>({
    queryKey: ["/api/quickbooks/status"],
  });

  // QuickBooks connect mutation
  const qbConnectMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("GET", "/api/quickbooks/auth");
      const data = await response.json();
      return data.authUrl;
    },
    onSuccess: (authUrl: string) => {
      window.location.href = authUrl;
    },
    onError: (error: any) => {
      toast({
        title: "Failed to connect QuickBooks",
        description: error.message,
        variant: "destructive"
      });
    },
  });

  // QuickBooks disconnect mutation
  const qbDisconnectMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/quickbooks/disconnect");
    },
    onSuccess: () => {
      refetchQB();
      toast({ title: "QuickBooks disconnected" });
    },
  });

  // QuickBooks sync mutation
  const qbSyncMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/quickbooks/sync");
      return response.json();
    },
    onSuccess: (data: { synced: number; errors: string[] }) => {
      toast({
        title: "Expenses synced",
        description: `${data.synced} expenses synced from QuickBooks`
      });
      queryClient.invalidateQueries({ queryKey: ["/api/expenses"] });
    },
    onError: (error: any) => {
      toast({
        title: "Sync failed",
        description: error.message,
        variant: "destructive"
      });
    },
  });

  // QuickBooks pipeline sync mutation (invoices + estimates → leads)
  const qbPipelineSyncMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/quickbooks/sync-pipeline");
      return response.json();
    },
    onSuccess: (data: { message: string; invoices: { imported: number; updated: number }; estimates: { imported: number; updated: number } }) => {
      toast({
        title: "Pipeline synced",
        description: data.message
      });
      queryClient.invalidateQueries({ queryKey: ["/api/leads"] });
    },
    onError: (error: any) => {
      toast({
        title: "Pipeline sync failed",
        description: error.message,
        variant: "destructive"
      });
    },
  });

  // Fetch GoHighLevel status
  const { data: ghlStatus, refetch: refetchGHL } = useQuery<GHLStatus>({
    queryKey: ["/api/ghl/status"],
  });

  // GoHighLevel test connection mutation
  const ghlTestMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/ghl/test");
      return response.json();
    },
    onSuccess: (data: GHLTestResult) => {
      if (data.connected) {
        toast({
          title: "GoHighLevel connected",
          description: `Found ${data.contactCount || 0} contacts and ${data.opportunityCount || 0} opportunities`
        });
      } else {
        toast({
          title: "Connection test failed",
          description: data.message,
          variant: "destructive"
        });
      }
      refetchGHL();
    },
    onError: (error: any) => {
      toast({
        title: "Connection test failed",
        description: error.message,
        variant: "destructive"
      });
    },
  });

  // GoHighLevel sync mutation
  const ghlSyncMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/ghl/sync");
      return response.json();
    },
    onSuccess: (data: GHLSyncResult) => {
      if (data.success) {
        toast({
          title: "GoHighLevel synced",
          description: `${data.synced} opportunities imported`
        });
        queryClient.invalidateQueries({ queryKey: ["/api/leads"] });
      } else {
        toast({
          title: "Sync completed with errors",
          description: data.errors.join(", "),
          variant: "destructive"
        });
      }
    },
    onError: (error: any) => {
      toast({
        title: "Sync failed",
        description: error.message,
        variant: "destructive"
      });
    },
  });

  const leadSources = (settings?.leadSources as LeadSourcesConfig) || { sources: [] };
  const staleness = (settings?.staleness as StalenessConfig) || { warningDays: 7, criticalDays: 14, penaltyPercent: 5 };
  const businessDefaults = (settings?.businessDefaults as BusinessDefaultsConfig) || {
    defaultTravelRate: 4,
    dispatchLocations: [],
    defaultBimDeliverable: "Revit",
    defaultBimVersion: ""
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen bg-background">
        <Sidebar />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <main className="flex-1 overflow-auto">
        <MobileHeader />
        <div className="p-4 md:p-8 space-y-6">
          <div>
            <h1 className="text-2xl font-bold text-foreground" data-testid="text-settings-title">Settings</h1>
            <p className="text-muted-foreground">Configure your CEO HUB preferences</p>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            {/* Theme Toggle */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  {theme === "dark" ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
                  Appearance
                </CardTitle>
                <CardDescription>Customize the look and feel</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="theme-toggle">Dark Mode</Label>
                    <p className="text-sm text-muted-foreground">Toggle between light and dark themes</p>
                  </div>
                  <Switch
                    id="theme-toggle"
                    checked={theme === "dark"}
                    onCheckedChange={toggleTheme}
                    data-testid="switch-theme-toggle"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Integration Status */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Link2 className="h-5 w-5" />
                  Integrations
                </CardTitle>
                <CardDescription>Connection status for external services</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <IntegrationRow
                  name="Airtable"
                  icon={<Database className="h-4 w-4" />}
                  connected={integrations?.airtable.configured ?? false}
                  details={integrations?.airtable.writeEnabled ? "Read/Write" : "Read Only"}
                />
                <IntegrationRow
                  name="CPQ Tool"
                  icon={<Link2 className="h-4 w-4" />}
                  connected={integrations?.cpq.configured ?? false}
                  details={integrations?.cpq.baseUrl}
                />
                <IntegrationRow
                  name="OpenAI (Scoping AI)"
                  icon={<Brain className="h-4 w-4" />}
                  connected={integrations?.openai.configured ?? false}
                />
              </CardContent>
            </Card>

            {/* QuickBooks Integration */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5" />
                  QuickBooks Online
                </CardTitle>
                <CardDescription>Sync expenses for profitability tracking</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium">Connection Status</p>
                    <p className="text-xs text-muted-foreground">
                      {qbStatus?.connected
                        ? "Connected - expenses will sync automatically"
                        : qbStatus?.configured
                          ? "Credentials configured, click Connect to authorize"
                          : "Add QUICKBOOKS_CLIENT_ID, QUICKBOOKS_CLIENT_SECRET, and QUICKBOOKS_REDIRECT_URI to secrets"}
                    </p>
                    {qbStatus?.error && (
                      <p className="text-xs text-destructive mt-1">{qbStatus.error}</p>
                    )}
                    {qbStatus?.redirectUri && !qbStatus?.connected && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Redirect URI: {qbStatus.redirectUri}
                      </p>
                    )}
                  </div>
                  <Badge variant={qbStatus?.connected ? "default" : "secondary"}>
                    {qbStatus?.connected ? "Connected" : qbStatus?.configured ? "Ready" : "Not Configured"}
                  </Badge>
                </div>

                <Separator />

                <div className="flex flex-wrap gap-2">
                  {qbStatus?.connected ? (
                    <>
                      <Button
                        size="sm"
                        onClick={() => qbSyncMutation.mutate()}
                        disabled={qbSyncMutation.isPending}
                        data-testid="button-qb-sync"
                      >
                        {qbSyncMutation.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        ) : (
                          <RefreshCw className="h-4 w-4 mr-2" />
                        )}
                        Sync Expenses
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => qbPipelineSyncMutation.mutate()}
                        disabled={qbPipelineSyncMutation.isPending}
                        data-testid="button-qb-sync-pipeline"
                      >
                        {qbPipelineSyncMutation.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        ) : (
                          <DollarSign className="h-4 w-4 mr-2" />
                        )}
                        Sync Pipeline
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => qbDisconnectMutation.mutate()}
                        disabled={qbDisconnectMutation.isPending}
                        data-testid="button-qb-disconnect"
                      >
                        Disconnect
                      </Button>
                    </>
                  ) : qbStatus?.configured ? (
                    <Button
                      size="sm"
                      onClick={() => qbConnectMutation.mutate()}
                      disabled={qbConnectMutation.isPending}
                      data-testid="button-qb-connect"
                    >
                      {qbConnectMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : (
                        <Link2 className="h-4 w-4 mr-2" />
                      )}
                      Connect QuickBooks
                    </Button>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Please add the QuickBooks credentials to secrets to enable connection.
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* GoHighLevel Integration */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Link2 className="h-5 w-5" />
                  GoHighLevel (GHL)
                </CardTitle>
                <CardDescription>Sync contacts and opportunities from GHL CRM</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium">Connection Status</p>
                    <p className="text-xs text-muted-foreground">
                      {ghlStatus?.configured
                        ? "Credentials configured - click Test to verify connection"
                        : `Missing: ${!ghlStatus?.hasApiKey ? 'GHL_API_KEY' : ''} ${!ghlStatus?.hasLocationId ? 'GHL_LOCATION_ID' : ''}`.trim()}
                    </p>
                  </div>
                  <Badge variant={ghlStatus?.configured ? "default" : "secondary"}>
                    {ghlStatus?.configured ? "Ready" : "Not Configured"}
                  </Badge>
                </div>

                <Separator />

                <div className="flex flex-wrap gap-2">
                  {ghlStatus?.configured ? (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => ghlTestMutation.mutate()}
                        disabled={ghlTestMutation.isPending}
                        data-testid="button-ghl-test"
                      >
                        {ghlTestMutation.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        ) : (
                          <Check className="h-4 w-4 mr-2" />
                        )}
                        Test Connection
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => ghlSyncMutation.mutate()}
                        disabled={ghlSyncMutation.isPending}
                        data-testid="button-ghl-sync"
                      >
                        {ghlSyncMutation.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        ) : (
                          <RefreshCw className="h-4 w-4 mr-2" />
                        )}
                        Sync Opportunities
                      </Button>
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Please add GHL_API_KEY and GHL_LOCATION_ID to secrets to enable connection.
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Financial Mapping - Profit First */}
            {qbStatus?.connected && <FinancialMappingEditor />}

            {/* Lead Sources */}
            <LeadSourcesEditor sources={leadSources.sources} />

            {/* Staleness Configuration */}
            <StalenessEditor config={staleness} />

            {/* Buyer Personas */}
            <PersonaManager />

            {/* Cloud Storage Settings */}
            <CloudStorageEditor />

            {/* Business Defaults */}
            <BusinessDefaultsEditor config={businessDefaults} />

            {/* Technical Standards */}
            <StandardsEditor />


          </div>
        </div>
      </main>
    </div>
  );
}

function IntegrationRow({
  name,
  icon,
  connected,
  details
}: {
  name: string;
  icon: React.ReactNode;
  connected: boolean;
  details?: string;
}) {
  return (
    <div className="flex items-center justify-between" data-testid={`integration-${name.toLowerCase().replace(/\s+/g, '-')}`}>
      <div className="flex items-center gap-2">
        {icon}
        <span className="text-sm font-medium">{name}</span>
      </div>
      <div className="flex items-center gap-2">
        {details && <span className="text-xs text-muted-foreground">{details}</span>}
        <Badge variant={connected ? "default" : "secondary"} className="text-xs">
          {connected ? "Connected" : "Not Configured"}
        </Badge>
      </div>
    </div>
  );
}

function FinancialMappingEditor() {
  const { toast } = useToast();

  // Fetch QBO accounts
  const { data: accounts, isLoading: accountsLoading } = useQuery<QBAccountsResponse>({
    queryKey: ["/api/quickbooks/accounts"],
  });

  // Fetch current mapping
  const { data: mapping, isLoading: mappingLoading } = useQuery<FinancialMapping>({
    queryKey: ["/api/settings/financial-mapping"],
  });

  const [localMapping, setLocalMapping] = useState<FinancialMapping>({
    operatingAccountId: null,
    taxAccountId: null,
    expenseAccountId: null,
  });

  useEffect(() => {
    if (mapping) {
      setLocalMapping(mapping);
    }
  }, [mapping]);

  const saveMutation = useMutation({
    mutationFn: async (newMapping: FinancialMapping) => {
      return apiRequest("POST", "/api/settings/financial-mapping", newMapping);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings/financial-mapping"] });
      toast({ title: "Financial mapping saved" });
    },
    onError: (error: any) => {
      toast({ title: "Failed to save mapping", description: error.message, variant: "destructive" });
    },
  });

  const handleSave = () => {
    saveMutation.mutate(localMapping);
  };

  const isLoading = accountsLoading || mappingLoading;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <DollarSign className="h-5 w-5" />
          Profit First Mapping
        </CardTitle>
        <CardDescription>Map QuickBooks accounts for financial dashboard</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            <div className="space-y-2">
              <Label>Operating Account (Bank)</Label>
              <select
                className="w-full p-2 rounded-md border bg-background text-foreground"
                value={localMapping.operatingAccountId || ""}
                onChange={(e) => setLocalMapping(prev => ({ ...prev, operatingAccountId: e.target.value || null }))}
                data-testid="select-operating-account"
              >
                <option value="">Select operating account...</option>
                {accounts?.bankAccounts.map(acc => (
                  <option key={acc.id} value={acc.id}>
                    {acc.name} {acc.balance !== undefined ? `($${acc.balance.toLocaleString()})` : ""}
                  </option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground">Your main operating/checking account</p>
            </div>

            <div className="space-y-2">
              <Label>Tax Reserve Account (Bank)</Label>
              <select
                className="w-full p-2 rounded-md border bg-background text-foreground"
                value={localMapping.taxAccountId || ""}
                onChange={(e) => setLocalMapping(prev => ({ ...prev, taxAccountId: e.target.value || null }))}
                data-testid="select-tax-account"
              >
                <option value="">Select tax reserve account...</option>
                {accounts?.bankAccounts.map(acc => (
                  <option key={acc.id} value={acc.id}>
                    {acc.name} {acc.balance !== undefined ? `($${acc.balance.toLocaleString()})` : ""}
                  </option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground">Account where you hold tax reserves</p>
            </div>

            <div className="space-y-2">
              <Label>Expenses Account (Credit Card)</Label>
              <select
                className="w-full p-2 rounded-md border bg-background text-foreground"
                value={localMapping.expenseAccountId || ""}
                onChange={(e) => setLocalMapping(prev => ({ ...prev, expenseAccountId: e.target.value || null }))}
                data-testid="select-expense-account"
              >
                <option value="">Select expense account...</option>
                {accounts?.creditCardAccounts.map(acc => (
                  <option key={acc.id} value={acc.id}>
                    {acc.name} {acc.balance !== undefined ? `($${acc.balance.toLocaleString()})` : ""}
                  </option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground">Primary credit card for business expenses</p>
            </div>

            <Separator />

            <Button
              onClick={handleSave}
              disabled={saveMutation.isPending}
              data-testid="button-save-financial-mapping"
            >
              {saveMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Save Mapping
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function LeadSourcesEditor({ sources }: { sources: string[] }) {
  const { toast } = useToast();
  const [localSources, setLocalSources] = useState(sources);
  const [newSource, setNewSource] = useState("");

  useEffect(() => {
    setLocalSources(sources);
  }, [sources]);

  const mutation = useMutation({
    mutationFn: async (newSources: string[]) => {
      return apiRequest("PUT", "/api/settings/leadSources", { value: { sources: newSources } });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
      toast({ title: "Lead sources updated" });
    },
    onError: () => {
      toast({ title: "Failed to update", variant: "destructive" });
    }
  });

  const addSource = () => {
    if (newSource.trim() && !localSources.includes(newSource.trim())) {
      const updated = [...localSources, newSource.trim()];
      setLocalSources(updated);
      setNewSource("");
      mutation.mutate(updated);
    }
  };

  const removeSource = (source: string) => {
    const updated = localSources.filter(s => s !== source);
    setLocalSources(updated);
    mutation.mutate(updated);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5" />
          Lead Sources
        </CardTitle>
        <CardDescription>Customize where your leads come from</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {localSources.map((source) => (
            <Badge
              key={source}
              variant="outline"
              className="flex items-center gap-1 pr-1"
              data-testid={`badge-source-${source.toLowerCase().replace(/\s+/g, '-')}`}
            >
              {source}
              <Button
                size="icon"
                variant="ghost"
                className="h-4 w-4 p-0 no-default-hover-elevate"
                onClick={() => removeSource(source)}
                data-testid={`button-remove-source-${source.toLowerCase().replace(/\s+/g, '-')}`}
              >
                <X className="h-3 w-3" />
              </Button>
            </Badge>
          ))}
        </div>
        <div className="flex gap-2">
          <Input
            placeholder="Add new source..."
            value={newSource}
            onChange={(e) => setNewSource(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addSource()}
            data-testid="input-new-source"
          />
          <Button
            size="icon"
            onClick={addSource}
            disabled={!newSource.trim() || mutation.isPending}
            data-testid="button-add-source"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function StalenessEditor({ config }: { config: StalenessConfig }) {
  const { toast } = useToast();
  const [localConfig, setLocalConfig] = useState(config);

  useEffect(() => {
    setLocalConfig(config);
  }, [config]);

  const mutation = useMutation({
    mutationFn: async (newConfig: StalenessConfig) => {
      return apiRequest("PUT", "/api/settings/staleness", { value: newConfig });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
      toast({ title: "Staleness settings updated" });
    },
    onError: () => {
      toast({ title: "Failed to update", variant: "destructive" });
    }
  });

  const save = () => mutation.mutate(localConfig);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5" />
          Staleness Thresholds
        </CardTitle>
        <CardDescription>Configure when leads are marked as stale</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4">
          <div className="space-y-2">
            <Label htmlFor="warning-days">Warning After (days)</Label>
            <Input
              id="warning-days"
              type="number"
              value={localConfig.warningDays}
              onChange={(e) => setLocalConfig({ ...localConfig, warningDays: parseInt(e.target.value) || 0 })}
              data-testid="input-warning-days"
            />
            <p className="text-xs text-muted-foreground">Leads show yellow warning after this many days without contact</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="critical-days">Critical After (days)</Label>
            <Input
              id="critical-days"
              type="number"
              value={localConfig.criticalDays}
              onChange={(e) => setLocalConfig({ ...localConfig, criticalDays: parseInt(e.target.value) || 0 })}
              data-testid="input-critical-days"
            />
            <p className="text-xs text-muted-foreground">Leads show red critical status after this many days</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="penalty-percent">Probability Penalty (%/day)</Label>
            <Input
              id="penalty-percent"
              type="number"
              value={localConfig.penaltyPercent}
              onChange={(e) => setLocalConfig({ ...localConfig, penaltyPercent: parseInt(e.target.value) || 0 })}
              data-testid="input-penalty-percent"
            />
            <p className="text-xs text-muted-foreground">Reduce win probability by this % each day after warning</p>
          </div>
        </div>
        <Button
          onClick={save}
          disabled={mutation.isPending}
          className="w-full"
          data-testid="button-save-staleness"
        >
          {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
          Save Staleness Settings
        </Button>
      </CardContent>
    </Card>
  );
}

function BusinessDefaultsEditor({ config }: { config: BusinessDefaultsConfig }) {
  const { toast } = useToast();
  const [localConfig, setLocalConfig] = useState(config);
  const [newLocation, setNewLocation] = useState("");

  useEffect(() => {
    setLocalConfig(config);
  }, [config]);

  const mutation = useMutation({
    mutationFn: async (newConfig: BusinessDefaultsConfig) => {
      return apiRequest("PUT", "/api/settings/businessDefaults", { value: newConfig });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
      toast({ title: "Business defaults updated" });
    },
    onError: () => {
      toast({ title: "Failed to update", variant: "destructive" });
    }
  });

  const addLocation = () => {
    if (newLocation.trim() && !localConfig.dispatchLocations.includes(newLocation.trim())) {
      setLocalConfig({
        ...localConfig,
        dispatchLocations: [...localConfig.dispatchLocations, newLocation.trim()]
      });
      setNewLocation("");
    }
  };

  const removeLocation = (location: string) => {
    setLocalConfig({
      ...localConfig,
      dispatchLocations: localConfig.dispatchLocations.filter(l => l !== location)
    });
  };

  const save = () => mutation.mutate(localConfig);

  return (
    <Card className="md:col-span-2">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MapPin className="h-5 w-5" />
          Business Defaults
        </CardTitle>
        <CardDescription>Default values for new deals and quotes</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-6 md:grid-cols-2">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="travel-rate">Default Travel Rate ($/mile)</Label>
              <Input
                id="travel-rate"
                type="number"
                step="0.01"
                value={localConfig.defaultTravelRate}
                onChange={(e) => setLocalConfig({ ...localConfig, defaultTravelRate: parseFloat(e.target.value) || 0 })}
                data-testid="input-travel-rate"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bim-deliverable">Default BIM Deliverable</Label>
              <Input
                id="bim-deliverable"
                value={localConfig.defaultBimDeliverable}
                onChange={(e) => setLocalConfig({ ...localConfig, defaultBimDeliverable: e.target.value })}
                placeholder="e.g., Revit"
                data-testid="input-bim-deliverable"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bim-version">Default BIM Version/Template</Label>
              <Input
                id="bim-version"
                value={localConfig.defaultBimVersion}
                onChange={(e) => setLocalConfig({ ...localConfig, defaultBimVersion: e.target.value })}
                placeholder="e.g., 2024"
                data-testid="input-bim-version"
              />
            </div>
          </div>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Dispatch Locations</Label>
              <div className="flex flex-wrap gap-2 min-h-[40px]">
                {localConfig.dispatchLocations.map((location) => (
                  <Badge
                    key={location}
                    variant="outline"
                    className="flex items-center gap-1 pr-1"
                    data-testid={`badge-location-${location.toLowerCase().replace(/[,\s]+/g, '-')}`}
                  >
                    {location}
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-4 w-4 p-0 no-default-hover-elevate"
                      onClick={() => removeLocation(location)}
                      data-testid={`button-remove-location-${location.toLowerCase().replace(/[,\s]+/g, '-')}`}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </Badge>
                ))}
              </div>
              <div className="flex gap-2">
                <Input
                  placeholder="Add location (e.g., Brooklyn, NY)"
                  value={newLocation}
                  onChange={(e) => setNewLocation(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addLocation()}
                  data-testid="input-new-location"
                />
                <Button
                  size="icon"
                  onClick={addLocation}
                  disabled={!newLocation.trim()}
                  data-testid="button-add-location"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>
        <Separator className="my-6" />
        <Button
          onClick={save}
          disabled={mutation.isPending}
          className="w-full"
          data-testid="button-save-defaults"
        >
          {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
          Save Business Defaults
        </Button>
      </CardContent>
    </Card>
  );
}

// Cloud Storage (GCS) Configuration
function CloudStorageEditor() {
  const { toast } = useToast();
  const [projectId, setProjectId] = useState("");
  const [bucket, setBucket] = useState("");
  const [storageMode, setStorageMode] = useState<"legacy_drive" | "hybrid_gcs" | "gcs_native">("hybrid_gcs");
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  // Fetch current GCS configuration
  const { data: gcsData, isLoading } = useQuery<{
    config: GcsStorageConfig | null;
    hasCredentials: boolean;
  }>({
    queryKey: ["/api/storage/gcs/config"],
  });

  useEffect(() => {
    if (gcsData?.config) {
      setProjectId(gcsData.config.projectId || "");
      setBucket(gcsData.config.defaultBucket || "");
      setStorageMode(gcsData.config.defaultStorageMode || "hybrid_gcs");
    }
  }, [gcsData]);

  // Test connection mutation
  const testMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/storage/gcs/test", {
        projectId,
        bucket,
      });
      return response.json();
    },
    onSuccess: (data: { success: boolean; message?: string; error?: string; bucketLocation?: string }) => {
      if (data.success) {
        setTestResult({
          success: true,
          message: `Connection successful! Bucket location: ${data.bucketLocation || "Unknown"}`
        });
        toast({ title: "Connection test passed" });
      } else {
        setTestResult({ success: false, message: data.error || "Connection failed" });
      }
    },
    onError: (error: any) => {
      setTestResult({ success: false, message: error.message || "Connection test failed" });
      toast({
        title: "Connection test failed",
        description: error.message,
        variant: "destructive"
      });
    },
  });

  // Save configuration mutation
  const saveMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/storage/gcs/configure", {
        projectId,
        bucket,
        defaultStorageMode: storageMode,
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/storage/gcs/config"] });
      toast({ title: "Cloud storage configuration saved" });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to save configuration",
        description: error.message,
        variant: "destructive"
      });
    },
  });

  // Disconnect mutation
  const disconnectMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/storage/gcs/disconnect");
      return response.json();
    },
    onSuccess: () => {
      setProjectId("");
      setBucket("");
      setStorageMode("legacy_drive");
      setTestResult(null);
      queryClient.invalidateQueries({ queryKey: ["/api/storage/gcs/config"] });
      toast({ title: "Cloud storage disconnected" });
    },
  });

  const isConfigured = gcsData?.config?.configured;
  const hasCredentials = gcsData?.hasCredentials;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Cloud className="h-5 w-5" />
          Cloud Storage (GCS)
        </CardTitle>
        <CardDescription>
          Configure Google Cloud Storage for project files
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            {/* Status Badge */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Connection Status</p>
                <p className="text-xs text-muted-foreground">
                  {isConfigured
                    ? `Connected to ${gcsData?.config?.defaultBucket}`
                    : "Not configured"}
                </p>
              </div>
              <Badge variant={isConfigured ? "default" : "secondary"}>
                {isConfigured ? "Connected" : "Not Connected"}
              </Badge>
            </div>

            <Separator />

            {/* Setup Instructions */}
            {!hasCredentials && (
              <Alert>
                <HelpCircle className="h-4 w-4" />
                <AlertDescription className="text-sm">
                  <strong>Step 1 - Add Credentials:</strong> Before configuring storage, add your Google Cloud service account credentials as a Replit secret.
                  <ol className="mt-2 ml-4 list-decimal space-y-1 text-xs">
                    <li><strong>Google Cloud Console:</strong> Go to IAM &amp; Admin &gt; Service Accounts</li>
                    <li><strong>Create Service Account:</strong> Give it "Storage Admin" role for your bucket</li>
                    <li><strong>Generate Key:</strong> Create a JSON key and download it</li>
                    <li><strong>Add to Replit:</strong> In the Secrets tab, create <code className="bg-muted px-1 rounded">GCS_SERVICE_ACCOUNT_JSON</code> and paste the entire JSON content</li>
                    <li><strong>Restart:</strong> Restart the app after adding the secret</li>
                  </ol>
                </AlertDescription>
              </Alert>
            )}

            {hasCredentials && !isConfigured && (
              <Alert>
                <Check className="h-4 w-4 text-green-600" />
                <AlertDescription className="text-sm">
                  <strong>Credentials Found!</strong> Your service account is configured. Now enter your project details below and test the connection.
                </AlertDescription>
              </Alert>
            )}

            {hasCredentials && (
              <>
                {/* Project ID Input */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Label htmlFor="gcs-project-id">GCP Project ID</Label>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Find this in your Google Cloud Console dashboard</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <Input
                    id="gcs-project-id"
                    placeholder="my-project-id"
                    value={projectId}
                    onChange={(e) => setProjectId(e.target.value)}
                    data-testid="input-gcs-project-id"
                  />
                </div>

                {/* Bucket Name Input */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Label htmlFor="gcs-bucket">Default Bucket Name</Label>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>The GCS bucket where project files will be stored</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <Input
                    id="gcs-bucket"
                    placeholder="my-scan-data-bucket"
                    value={bucket}
                    onChange={(e) => setBucket(e.target.value)}
                    data-testid="input-gcs-bucket"
                  />
                </div>

                {/* Storage Mode Selection */}
                <div className="space-y-3">
                  <Label>Default Storage Mode for New Projects</Label>
                  <RadioGroup
                    value={storageMode}
                    onValueChange={(v) => setStorageMode(v as typeof storageMode)}
                    className="space-y-2"
                  >
                    {(Object.entries(GCS_STORAGE_MODES) as [keyof typeof GCS_STORAGE_MODES, typeof GCS_STORAGE_MODES[keyof typeof GCS_STORAGE_MODES]][]).map(([key, value]) => (
                      <div key={key} className="flex items-start space-x-3">
                        <RadioGroupItem value={key} id={`storage-mode-${key}`} data-testid={`radio-storage-${key}`} />
                        <div className="space-y-0.5">
                          <Label htmlFor={`storage-mode-${key}`} className="font-medium cursor-pointer">
                            {value.label}
                          </Label>
                          <p className="text-xs text-muted-foreground">{value.description}</p>
                        </div>
                      </div>
                    ))}
                  </RadioGroup>
                </div>

                {/* Test Result */}
                {testResult && (
                  <Alert variant={testResult.success ? "default" : "destructive"}>
                    {testResult.success ? (
                      <Check className="h-4 w-4" />
                    ) : (
                      <AlertTriangle className="h-4 w-4" />
                    )}
                    <AlertDescription>{testResult.message}</AlertDescription>
                  </Alert>
                )}

                <Separator />

                {/* Action Buttons */}
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    onClick={() => testMutation.mutate()}
                    disabled={!projectId || !bucket || testMutation.isPending}
                    data-testid="button-test-gcs"
                  >
                    {testMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <Check className="h-4 w-4 mr-2" />
                    )}
                    Test Connection
                  </Button>

                  <Button
                    onClick={() => saveMutation.mutate()}
                    disabled={!projectId || !bucket || saveMutation.isPending}
                    data-testid="button-save-gcs"
                  >
                    {saveMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <Save className="h-4 w-4 mr-2" />
                    )}
                    Save Configuration
                  </Button>

                  {isConfigured && (
                    <Button
                      variant="destructive"
                      onClick={() => disconnectMutation.mutate()}
                      disabled={disconnectMutation.isPending}
                      data-testid="button-disconnect-gcs"
                    >
                      {disconnectMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : (
                        <X className="h-4 w-4 mr-2" />
                      )}
                      Disconnect
                    </Button>
                  )}
                </div>
              </>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

interface StandardDefinition {
  id: number;
  term: string;
  definition: string;
  guaranteeText: string | null;
  category: string | null;
  active: boolean;
  createdAt: string;
}

const STANDARDS_CATEGORY_LABELS: Record<string, string> = {
  scanning_loa: "Scanning - Levels of Accuracy",
  scanning_devices: "Scanning - Devices",
  scanning_process: "Scanning - Process",
  modeling_lod: "Modeling - Levels of Detail",
  modeling_disciplines: "Modeling - Disciplines",
  quality_control: "Quality Control",
  general: "General",
};

const STANDARDS_CATEGORY_ORDER = [
  "scanning_loa",
  "scanning_devices",
  "scanning_process",
  "modeling_lod",
  "modeling_disciplines",
  "quality_control",
  "general",
];

function StandardsEditor() {
  const { toast } = useToast();
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState({ term: "", definition: "", guaranteeText: "" });
  const [newCategory, setNewCategory] = useState<string | null>(null);
  const [newForm, setNewForm] = useState({ term: "", definition: "", guaranteeText: "" });

  const { data: standardsData, isLoading } = useQuery<{ success: boolean; data: StandardDefinition[] }>({
    queryKey: ["/api/brand/standards"],
  });

  const seedMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/brand/standards/seed", {});
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/brand/standards"] });
      toast({ title: "Standards seeded successfully" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, term, definition, guaranteeText }: { id: number; term: string; definition: string; guaranteeText: string }) => {
      const res = await apiRequest("PUT", `/api/brand/standards/${id}`, { term, definition, guaranteeText: guaranteeText || null });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/brand/standards"] });
      setEditingId(null);
      toast({ title: "Standard updated" });
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: { category: string; term: string; definition: string; guaranteeText: string }) => {
      const res = await apiRequest("POST", "/api/brand/standards", { ...data, guaranteeText: data.guaranteeText || null });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/brand/standards"] });
      setNewCategory(null);
      setNewForm({ term: "", definition: "", guaranteeText: "" });
      toast({ title: "Standard added" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("DELETE", `/api/brand/standards/${id}`, {});
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/brand/standards"] });
      toast({ title: "Standard deleted" });
    },
  });

  const groupedStandards = STANDARDS_CATEGORY_ORDER.reduce((acc, cat) => {
    acc[cat] = standardsData?.data?.filter(s => s.category === cat) || [];
    return acc;
  }, {} as Record<string, StandardDefinition[]>);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5" />
            Technical Standards
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (!standardsData?.data?.length) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5" />
            Technical Standards
          </CardTitle>
          <CardDescription>
            Scanning and modeling standards that inform AI proposal writing
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center py-8">
          <p className="text-muted-foreground mb-4">No standards configured yet.</p>
          <Button onClick={() => seedMutation.mutate()} disabled={seedMutation.isPending} data-testid="button-seed-standards">
            {seedMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
            Load Scan2Plan Standards
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ClipboardList className="h-5 w-5" />
          Technical Standards
        </CardTitle>
        <CardDescription>
          Scanning and modeling standards that inform AI proposal writing
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {STANDARDS_CATEGORY_ORDER.map(category => {
          const standards = groupedStandards[category];
          if (standards.length === 0 && category !== newCategory) return null;

          return (
            <div key={category} className="space-y-3">
              <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">
                {STANDARDS_CATEGORY_LABELS[category] || category}
              </h4>
              <div className="space-y-2">
                {standards.map(standard => (
                  <div key={standard.id} className="border rounded-lg p-3">
                    {editingId === standard.id ? (
                      <div className="space-y-3">
                        <Input
                          value={editForm.term}
                          onChange={e => setEditForm(f => ({ ...f, term: e.target.value }))}
                          placeholder="Term (e.g., LoD 300)"
                          data-testid={`input-edit-term-${standard.id}`}
                        />
                        <Textarea
                          value={editForm.definition}
                          onChange={e => setEditForm(f => ({ ...f, definition: e.target.value }))}
                          placeholder="Definition"
                          rows={2}
                          data-testid={`input-edit-definition-${standard.id}`}
                        />
                        <Input
                          value={editForm.guaranteeText}
                          onChange={e => setEditForm(f => ({ ...f, guaranteeText: e.target.value }))}
                          placeholder="Guarantee text (optional)"
                          data-testid={`input-edit-guarantee-${standard.id}`}
                        />
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={() => updateMutation.mutate({ id: standard.id, ...editForm })}
                            disabled={updateMutation.isPending}
                            data-testid={`button-save-standard-${standard.id}`}
                          >
                            <Save className="h-4 w-4 mr-1" /> Save
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => setEditingId(null)}>
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <h5 className="font-medium text-sm">{standard.term}</h5>
                          <p className="text-sm text-muted-foreground mt-1">{standard.definition}</p>
                          {standard.guaranteeText && (
                            <p className="text-xs text-primary mt-1">{standard.guaranteeText}</p>
                          )}
                        </div>
                        <div className="flex gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => {
                              setEditingId(standard.id);
                              setEditForm({
                                term: standard.term,
                                definition: standard.definition,
                                guaranteeText: standard.guaranteeText || "",
                              });
                            }}
                            data-testid={`button-edit-standard-${standard.id}`}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => deleteMutation.mutate(standard.id)}
                            data-testid={`button-delete-standard-${standard.id}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}

                {newCategory === category ? (
                  <div className="border rounded-lg p-3 border-dashed space-y-3">
                    <Input
                      value={newForm.term}
                      onChange={e => setNewForm(f => ({ ...f, term: e.target.value }))}
                      placeholder="Term"
                      data-testid="input-new-term"
                    />
                    <Textarea
                      value={newForm.definition}
                      onChange={e => setNewForm(f => ({ ...f, definition: e.target.value }))}
                      placeholder="Definition"
                      rows={2}
                      data-testid="input-new-definition"
                    />
                    <Input
                      value={newForm.guaranteeText}
                      onChange={e => setNewForm(f => ({ ...f, guaranteeText: e.target.value }))}
                      placeholder="Guarantee text (optional)"
                      data-testid="input-new-guarantee"
                    />
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => createMutation.mutate({ category, ...newForm })}
                        disabled={createMutation.isPending || !newForm.term || !newForm.definition}
                        data-testid="button-add-standard"
                      >
                        <Plus className="h-4 w-4 mr-1" /> Add
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setNewCategory(null)}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full border-dashed border"
                    onClick={() => setNewCategory(category)}
                    data-testid={`button-add-to-${category}`}
                  >
                    <Plus className="h-4 w-4 mr-1" /> Add Standard
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
