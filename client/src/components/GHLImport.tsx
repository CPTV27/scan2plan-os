import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Loader2, RefreshCw, Download, CheckCircle, XCircle, Users, Briefcase } from "lucide-react";

interface GHLStatus {
  connected: boolean;
  message: string;
  contactCount?: number;
  opportunityCount?: number;
}

interface GHLOpportunity {
  ghlId: string;
  name: string;
  amount: number;
  stage: string;
  contact?: {
    name?: string;
    email?: string;
    phone?: string;
  };
}

interface SyncResult {
  synced: number;
  errors: string[];
  opportunities: GHLOpportunity[];
}

interface ImportResult {
  imported: number;
  total: number;
  errors: string[];
  message: string;
}

export function GHLImport() {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const statusQuery = useQuery<GHLStatus>({
    queryKey: ["/api/ghl/status"],
    enabled: open,
    refetchOnWindowFocus: false,
  });

  const syncQuery = useQuery<SyncResult>({
    queryKey: ["/api/ghl/sync"],
    enabled: open && statusQuery.data?.connected,
    refetchOnWindowFocus: false,
  });

  const importMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/ghl/import");
      return res.json() as Promise<ImportResult>;
    },
    onSuccess: (data) => {
      toast({
        title: "Import Complete",
        description: data.message,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/leads"] });
      if (data.errors.length > 0) {
        console.warn("GHL import errors:", data.errors);
      }
    },
    onError: (err: any) => {
      toast({
        title: "Import Failed",
        description: err.message || "Failed to import opportunities from Go High Level",
        variant: "destructive",
      });
    },
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" data-testid="button-ghl-import">
          <Briefcase className="w-4 h-4 mr-2" />
          Import from GHL
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Briefcase className="w-5 h-5 text-blue-500" />
            Go High Level Import
          </DialogTitle>
          <DialogDescription>
            Import opportunities from Go High Level into Scan2Plan leads
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {statusQuery.isLoading && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              <span className="ml-2 text-muted-foreground">Connecting to Go High Level...</span>
            </div>
          )}

          {statusQuery.data && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  {statusQuery.data.connected ? (
                    <CheckCircle className="w-4 h-4 text-green-500" />
                  ) : (
                    <XCircle className="w-4 h-4 text-destructive" />
                  )}
                  Connection Status
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-3">{statusQuery.data.message}</p>
                {statusQuery.data.connected && (
                  <div className="flex flex-wrap gap-3">
                    <div className="flex items-center gap-1.5">
                      <Users className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm">{statusQuery.data.contactCount ?? 0} Contacts</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Briefcase className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm">{statusQuery.data.opportunityCount ?? 0} Opportunities</span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {statusQuery.data?.connected && syncQuery.isLoading && (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              <span className="ml-2 text-sm text-muted-foreground">Loading opportunities...</span>
            </div>
          )}

          {statusQuery.data?.connected && syncQuery.data && (
            <>
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium">Available Opportunities ({syncQuery.data.opportunities.length})</h3>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => syncQuery.refetch()}
                  disabled={syncQuery.isRefetching}
                  data-testid="button-refresh-ghl-opportunities"
                >
                  <RefreshCw className={`w-4 h-4 ${syncQuery.isRefetching ? "animate-spin" : ""}`} />
                </Button>
              </div>

              <ScrollArea className="h-[300px] border rounded-md">
                <div className="p-2 space-y-2">
                  {syncQuery.data.opportunities.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">
                      No opportunities found in Go High Level
                    </p>
                  ) : (
                    syncQuery.data.opportunities.map((opp) => (
                      <div
                        key={opp.ghlId}
                        className="flex items-center justify-between p-3 rounded-md bg-muted/50"
                        data-testid={`ghl-opportunity-${opp.ghlId}`}
                      >
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-sm truncate">{opp.name}</p>
                          {opp.contact?.name && (
                            <p className="text-xs text-muted-foreground truncate">{opp.contact.name}</p>
                          )}
                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            <Badge variant="outline" className="text-xs">{opp.stage}</Badge>
                            <span className="text-xs text-muted-foreground">{formatCurrency(opp.amount)}</span>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </ScrollArea>

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  variant="outline"
                  onClick={() => setOpen(false)}
                  data-testid="button-cancel-ghl-import"
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => importMutation.mutate()}
                  disabled={importMutation.isPending || syncQuery.data.opportunities.length === 0}
                  data-testid="button-import-ghl-opportunities"
                >
                  {importMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Importing...
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4 mr-2" />
                      Import {syncQuery.data.opportunities.length} Opportunities
                    </>
                  )}
                </Button>
              </div>
            </>
          )}

          {!statusQuery.data?.connected && !statusQuery.isLoading && (
            <div className="text-center py-4">
              <p className="text-sm text-muted-foreground mb-4">
                Go High Level is not connected. Please add your GHL API Key and Location ID in the secrets settings.
              </p>
              <Button variant="outline" onClick={() => statusQuery.refetch()}>
                <RefreshCw className="w-4 h-4 mr-2" />
                Retry Connection
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
