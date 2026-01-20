import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Trash2, RefreshCw, ArrowLeft, Loader2, Calendar, DollarSign, Building2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { format, differenceInDays } from "date-fns";
import type { Lead } from "@shared/schema";

export default function Trash() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: deletedLeads, isLoading } = useQuery<Lead[]>({
    queryKey: ["/api/leads/trash"],
  });

  const restoreMutation = useMutation({
    mutationFn: async (leadId: number) => {
      const response = await apiRequest("PATCH", `/api/leads/${leadId}/restore`);
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to restore");
      }
      return response.json();
    },
    onSuccess: (_, leadId) => {
      queryClient.invalidateQueries({ queryKey: ["/api/leads/trash"] });
      queryClient.invalidateQueries({ queryKey: ["/api/leads"] });
      toast({ title: "Deal Restored", description: "The deal has been restored to your pipeline." });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const permanentDeleteMutation = useMutation({
    mutationFn: async (leadId: number) => {
      const response = await apiRequest("DELETE", `/api/leads/${leadId}/permanent`);
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to delete permanently");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/leads/trash"] });
      toast({ title: "Permanently Deleted", description: "The deal has been permanently removed." });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const getDaysRemaining = (deletedAt: Date | null) => {
    if (!deletedAt) return 60;
    const daysElapsed = differenceInDays(new Date(), new Date(deletedAt));
    return Math.max(0, 60 - daysElapsed);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => setLocation("/sales")} data-testid="button-back-to-sales">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Trash2 className="w-6 h-6" />
            Trash
          </h1>
          <p className="text-muted-foreground">Deleted deals are kept for 60 days before permanent deletion</p>
        </div>
      </div>

      {deletedLeads && deletedLeads.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Trash2 className="w-12 h-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Trash is empty</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {deletedLeads?.map((lead) => {
            const daysRemaining = getDaysRemaining(lead.deletedAt);
            const isExpiringSoon = daysRemaining <= 7;
            
            return (
              <Card key={lead.id} className="relative" data-testid={`trash-item-${lead.id}`}>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <CardTitle className="text-lg">{lead.clientName}</CardTitle>
                      <CardDescription>{lead.projectAddress || lead.projectName || "No address"}</CardDescription>
                    </div>
                    <Badge variant={isExpiringSoon ? "destructive" : "secondary"} className="flex-shrink-0">
                      {daysRemaining} days left
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground mb-4">
                    {lead.value && (
                      <span className="flex items-center gap-1">
                        <DollarSign className="w-4 h-4" />
                        ${Number(lead.value).toLocaleString()}
                      </span>
                    )}
                    {lead.buildingType && (
                      <span className="flex items-center gap-1">
                        <Building2 className="w-4 h-4" />
                        {lead.buildingType}
                      </span>
                    )}
                    {lead.deletedAt && (
                      <span className="flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        Deleted {format(new Date(lead.deletedAt), "MMM d, yyyy")}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      onClick={() => restoreMutation.mutate(lead.id)}
                      disabled={restoreMutation.isPending}
                      data-testid={`button-restore-${lead.id}`}
                    >
                      {restoreMutation.isPending ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <RefreshCw className="w-4 h-4 mr-2" />
                      )}
                      Restore
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-destructive border-destructive/50"
                          data-testid={`button-permanent-delete-${lead.id}`}
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          Delete Forever
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Permanently Delete?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will permanently delete "{lead.clientName}" and all associated quotes. This action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => permanentDeleteMutation.mutate(lead.id)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            data-testid={`button-confirm-permanent-delete-${lead.id}`}
                          >
                            {permanentDeleteMutation.isPending ? (
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            ) : (
                              <Trash2 className="w-4 h-4 mr-2" />
                            )}
                            Delete Forever
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
