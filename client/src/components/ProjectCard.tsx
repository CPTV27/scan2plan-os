import { useEffect, useRef } from "react";
import { type Project, type Scantech } from "@shared/schema";
import { Calendar, Flag, AlertTriangle, Leaf, ExternalLink, User, FolderOpen, Paperclip, Box, Play, CheckCircle, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { clsx } from "clsx";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AttachmentCountBadge } from "./ProjectAttachments";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface ProjectCardProps {
  project: Project;
  onEdit: (project: Project) => void;
}

interface OutstandingBalance {
  leadId: number;
  outstandingBalance: number;
  hasOutstandingBalance: boolean;
  invoiceCount: number;
}

interface LeadRetainerStatus {
  retainerPaid: boolean;
  retainerAmount: string | null;
}

const priorityColors = {
  Low: "bg-blue-500/10 text-blue-500 hover:bg-blue-500/20",
  Medium: "bg-yellow-500/10 text-yellow-500 hover:bg-yellow-500/20",
  High: "bg-red-500/10 text-red-500 hover:bg-red-500/20",
};

export function ProjectCard({ project, onEdit }: ProjectCardProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Check for outstanding balance (delivery blocker for QC/Delivered stages)
  const { data: balanceData } = useQuery<OutstandingBalance>({
    queryKey: ["/api/leads", project.leadId, "outstanding-balance"],
    enabled: !!project.leadId && (project.status === "QC" || project.status === "Delivered"),
  });

  // Check for retainer payment status (scheduling blocker for Scheduling/Scanning stages)
  const { data: leadData } = useQuery<LeadRetainerStatus>({
    queryKey: ["/api/leads", project.leadId, "retainer-status"],
    enabled: !!project.leadId && (project.status === "Scheduling" || project.status === "Scanning"),
  });

  // Fetch assigned scantech info
  const { data: scantech } = useQuery<Scantech>({
    queryKey: ["/api/scantechs", project.assignedTechId],
    enabled: !!project.assignedTechId,
  });

  // Point Cloud Delivery mutation
  const generatePointCloudMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", `/api/projects/${project.id}/deliver-pointcloud`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      toast({ title: "Processing Started", description: "The point cloud conversion engine is warming up." });
      startPollingForCompletion();
    },
    onError: (error: any) => {
      const message = error?.message?.includes("prerequisite") 
        ? "Project needs storage setup before conversion" 
        : "Failed to start point cloud conversion.";
      toast({ title: "Error", description: message, variant: "destructive" });
    }
  });

  // Poll for completion when status is "processing"
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  const clearPolling = () => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  };
  
  const startPollingForCompletion = () => {
    if (pollIntervalRef.current) return;
    
    pollIntervalRef.current = setInterval(() => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
    }, 3000);
    
    timeoutRef.current = setTimeout(() => {
      clearPolling();
    }, 30000);
  };

  // Auto-poll when status is "processing", stop when status changes
  useEffect(() => {
    if (project.deliveryStatus === "processing") {
      startPollingForCompletion();
    } else {
      clearPolling();
    }
    return () => {
      clearPolling();
    };
  }, [project.deliveryStatus]);

  const showDeliveryBlocker = balanceData?.hasOutstandingBalance && 
    (project.status === "QC" || project.status === "Delivered");

  const showRetainerBlocker = leadData && !leadData.retainerPaid && 
    (project.status === "Scheduling" || project.status === "Scanning");

  const hasBlocker = showDeliveryBlocker || showRetainerBlocker;

  return (
    <div 
      className={clsx(
        "bg-card border rounded-xl p-4 shadow-sm transition-all duration-200 group relative hover-elevate",
        hasBlocker ? "border-destructive" : "border-border/50"
      )} 
      data-testid={`card-project-${project.id}`}
    >
      {showRetainerBlocker && (
        <div className="mb-3 p-2 bg-amber-500/10 rounded-md border border-amber-500/30" data-testid="retainer-blocker-warning">
          <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 text-xs font-medium">
            <AlertTriangle className="w-4 h-4" />
            <span>RETAINER NOT RECEIVED</span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Do not schedule scan until retainer is paid
          </p>
        </div>
      )}
      {showDeliveryBlocker && (
        <div className="mb-3 p-2 bg-destructive/10 rounded-md border border-destructive/30" data-testid="delivery-blocker-warning">
          <div className="flex items-center gap-2 text-destructive text-xs font-medium">
            <AlertTriangle className="w-4 h-4" />
            <span>DO NOT DELIVER WITHOUT PAYMENT</span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Outstanding balance: ${balanceData.outstandingBalance.toLocaleString()}
          </p>
        </div>
      )}
      {/* SQUARE FOOT AUDIT Alert - Billing Adjustment Required */}
      {project.sqftVariance && Math.abs(Number(project.sqftVariance)) > 10 && !project.billingAdjustmentApproved && (
        <div className="mb-3 p-2 bg-orange-500/10 rounded-md border border-orange-500/30" data-testid="sqft-audit-alert">
          <div className="flex items-center gap-2 text-orange-600 dark:text-orange-400 text-xs font-medium">
            <AlertTriangle className="w-4 h-4" />
            <span>SQUARE FOOT AUDIT REQUIRED</span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Scanned area {Number(project.sqftVariance) > 0 ? "exceeds" : "below"} estimate by {Math.abs(Number(project.sqftVariance)).toFixed(1)}%. Billing adjustment must be approved before Modeling.
            {project.estimatedSqft && project.actualSqft && (
              <span className="block">Est: {project.estimatedSqft.toLocaleString()} sqft | Actual: {project.actualSqft.toLocaleString()} sqft</span>
            )}
          </p>
        </div>
      )}
      {/* QC Gate Alert - B-Validation and C-Validation Required for Modeling */}
      {project.status === "Registration" && (
        (project.bValidationStatus !== "passed" && project.bValidationStatus !== "waived") ||
        (project.cValidationStatus !== "passed" && project.cValidationStatus !== "waived")
      ) && (
        <div className="mb-3 p-2 bg-purple-500/10 rounded-md border border-purple-500/30" data-testid="qc-validation-alert">
          <div className="flex items-center gap-2 text-purple-600 dark:text-purple-400 text-xs font-medium">
            <AlertTriangle className="w-4 h-4" />
            <span>QC GATE: VALIDATION REQUIRED FOR MODELING</span>
          </div>
          <div className="text-xs text-muted-foreground mt-1 space-y-1">
            <p>Complete registration validation to ensure LoA 40 (0-1/8") accuracy:</p>
            <ul className="list-disc list-inside pl-1 space-y-0.5">
              {project.bValidationStatus !== "passed" && project.bValidationStatus !== "waived" && (
                <li>B-Validation (cross-scan alignment): <span className="text-amber-500">{project.bValidationStatus || "pending"}</span></li>
              )}
              {project.cValidationStatus !== "passed" && project.cValidationStatus !== "waived" && (
                <li>C-Validation (control point alignment): <span className="text-amber-500">{project.cValidationStatus || "pending"}</span></li>
              )}
              {project.registrationRms && Number(project.registrationRms) > 0.125 && (
                <li>RMS: {project.registrationRms}" <span className="text-red-500">(exceeds 0.125" threshold)</span></li>
              )}
            </ul>
          </div>
        </div>
      )}

      <div className="flex justify-between items-start mb-3 gap-2">
        <Badge 
          variant="secondary" 
          className={clsx(
            "font-medium border-0", 
            priorityColors[project.priority as keyof typeof priorityColors] || priorityColors.Medium
          )}
        >
          <Flag className="w-3 h-3 mr-1" />
          {project.priority}
        </Badge>
        
        <Button 
          variant="outline" 
          size="sm"
          onClick={() => onEdit(project)}
          data-testid={`button-open-project-${project.id}`}
        >
          <ExternalLink className="w-3 h-3 mr-1" />
          Open
        </Button>
      </div>

      <h4 className="font-display font-semibold text-lg leading-tight mb-1 truncate" title={project.name}>
        {project.name}
      </h4>
      {project.universalProjectId && (
        <p className="text-xs font-mono text-muted-foreground mb-2" title="Universal Project ID for QuickBooks sync">
          {project.universalProjectId}
        </p>
      )}

      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
          <div className="flex items-center">
            <Calendar className="w-3.5 h-3.5 mr-1.5" />
            {project.dueDate ? format(new Date(project.dueDate), "MMM d, yyyy") : "No deadline"}
          </div>
          {scantech && (
            <div className="flex items-center" data-testid={`text-assigned-tech-${project.id}`}>
              <User className="w-3.5 h-3.5 mr-1" />
              <span className="font-medium">{scantech.name}</span>
            </div>
          )}
          {!project.assignedTechId && (
            <div className="flex items-center text-amber-500" title="No technician assigned">
              <User className="w-3.5 h-3.5 mr-1" />
              <span>Unassigned</span>
            </div>
          )}
        </div>

        {/* LoD/LoA Standards - Measure of Excellence */}
        <div className="flex flex-wrap gap-1.5">
          <Badge variant="outline" className="text-[10px] font-mono" title="Level of Development">
            {project.targetLoD || "LOD 300"}
          </Badge>
          <Badge variant="outline" className="text-[10px] font-mono" title="Measured Accuracy">
            {project.targetLoaMeasured || "LoA 40"}
          </Badge>
          <Badge variant="outline" className="text-[10px] font-mono" title="Modeled Accuracy">
            {project.targetLoaModeled || "LoA 30"}
          </Badge>
          <AttachmentCountBadge projectId={project.id} />
          {/* Square Foot Audit Status */}
          {project.sqftVariance && (
            <Badge 
              variant={Math.abs(Number(project.sqftVariance)) > 10 && !project.billingAdjustmentApproved ? "destructive" : "secondary"}
              className="text-[10px] font-mono"
              title={`Sqft Variance: ${project.estimatedSqft} est. vs ${project.actualSqft} actual`}
            >
              {Number(project.sqftVariance) > 0 ? "+" : ""}{project.sqftVariance}%
            </Badge>
          )}
          {project.billingAdjustmentApproved && (
            <Badge variant="secondary" className="text-[10px] bg-green-500/10 text-green-500" title="Billing Adjustment Approved">
              SQFT OK
            </Badge>
          )}
          {/* QC Validation Status - Registration → Modeling Gate */}
          {(project.status === "Registration" || project.status === "Modeling") && (
            <>
              <Badge 
                variant="outline" 
                className={clsx(
                  "text-[10px] font-mono",
                  project.bValidationStatus === "passed" && "bg-green-500/10 text-green-500 border-green-500/30",
                  project.bValidationStatus === "failed" && "bg-red-500/10 text-red-500 border-red-500/30",
                  project.bValidationStatus === "pending" && "bg-yellow-500/10 text-yellow-500 border-yellow-500/30",
                  project.bValidationStatus === "waived" && "bg-blue-500/10 text-blue-500 border-blue-500/30"
                )}
                title="B-Validation: Cross-scan overlap alignment (required for Modeling)"
              >
                B-Val: {project.bValidationStatus || "pending"}
              </Badge>
              <Badge 
                variant="outline" 
                className={clsx(
                  "text-[10px] font-mono",
                  project.cValidationStatus === "passed" && "bg-green-500/10 text-green-500 border-green-500/30",
                  project.cValidationStatus === "failed" && "bg-red-500/10 text-red-500 border-red-500/30",
                  project.cValidationStatus === "pending" && "bg-yellow-500/10 text-yellow-500 border-yellow-500/30",
                  project.cValidationStatus === "waived" && "bg-blue-500/10 text-blue-500 border-blue-500/30"
                )}
                title="C-Validation: Control point alignment (required for Modeling)"
              >
                C-Val: {project.cValidationStatus || "pending"}
              </Badge>
            </>
          )}
          {project.registrationRms && (
            <Badge 
              variant="outline" 
              className={clsx(
                "text-[10px] font-mono",
                Number(project.registrationRms) <= 0.25 ? "bg-green-500/10 text-green-500 border-green-500/30" : "bg-yellow-500/10 text-yellow-500 border-yellow-500/30"
              )}
              title={`RMS: ${project.registrationRms}" (LoA 40 target: ≤0.25")`}
            >
              RMS: {project.registrationRms}"
            </Badge>
          )}
          {/* Real-Time Margin Tracking Badge */}
          {project.marginPercent !== null && project.marginPercent !== undefined && (
            <Badge 
              variant="outline" 
              className={clsx(
                "text-[10px] font-mono",
                Number(project.marginPercent) >= 40 && "bg-green-500/10 text-green-500 border-green-500/30",
                Number(project.marginPercent) >= 25 && Number(project.marginPercent) < 40 && "bg-blue-500/10 text-blue-500 border-blue-500/30",
                Number(project.marginPercent) >= 10 && Number(project.marginPercent) < 25 && "bg-yellow-500/10 text-yellow-500 border-yellow-500/30",
                Number(project.marginPercent) < 10 && "bg-red-500/10 text-red-500 border-red-500/30"
              )}
              title={`Margin: $${Number(project.marginActual || 0).toLocaleString()} | Vendor Cost: $${Number(project.vendorCostActual || 0).toLocaleString()}`}
              data-testid={`badge-margin-${project.id}`}
            >
              {Number(project.marginPercent).toFixed(0)}% margin
            </Badge>
          )}
          {/* LEED v5 Embodied Carbon Tracking */}
          {project.leedCarbonEnabled && (
            <Badge 
              variant="outline" 
              className={clsx(
                "text-[10px] font-mono",
                project.gwpActual && project.gwpBaseline 
                  ? (Number(project.gwpActual) < Number(project.gwpBaseline) 
                    ? "bg-green-500/10 text-green-500 border-green-500/30" 
                    : "bg-yellow-500/10 text-yellow-500 border-yellow-500/30")
                  : "bg-emerald-500/10 text-emerald-500 border-emerald-500/30"
              )}
              title={project.gwpActual && project.gwpBaseline 
                ? `GWP: ${Number(project.gwpActual).toLocaleString()} vs ${Number(project.gwpBaseline).toLocaleString()} kgCO2e baseline (${project.gwpReductionTarget}% target)` 
                : "LEED v5 Embodied Carbon A1-A3 tracking enabled"}
            >
              <Leaf className="w-2.5 h-2.5 mr-0.5" />
              LEED v5
            </Badge>
          )}
        </div>

        <div className="space-y-1.5">
          <div className="flex justify-between text-xs font-medium text-muted-foreground">
            <span>Progress</span>
            <span>{project.progress}%</span>
          </div>
          <Progress value={project.progress || 0} className="h-1.5" />
        </div>

        {/* Google Drive Folder Link */}
        {project.driveFolderUrl && (
          <Button
            variant="outline"
            size="sm"
            className="w-full mt-2"
            onClick={(e) => {
              e.stopPropagation();
              window.open(project.driveFolderUrl!, '_blank');
            }}
            data-testid={`button-drive-folder-${project.id}`}
          >
            <FolderOpen className="w-3.5 h-3.5 mr-1.5" />
            Open Google Drive Folder
          </Button>
        )}

        {/* Digital Twin Viewer - Point Cloud Delivery */}
        {(project.status === "QC" || project.status === "Delivered" || project.status === "Modeling") && (
          <div className="mt-3 p-3 bg-muted/50 rounded-lg border" data-testid={`pointcloud-section-${project.id}`}>
            <div className="flex items-center justify-between gap-2 mb-2">
              <div className="flex items-center gap-2">
                <Box className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                <span className="text-sm font-medium">Digital Twin Viewer</span>
              </div>
              {project.deliveryStatus === "ready" && (
                <Badge variant="secondary" className="bg-green-500/10 text-green-600 dark:text-green-400 gap-1">
                  <CheckCircle className="h-3 w-3" /> Live
                </Badge>
              )}
            </div>

            {project.deliveryStatus === 'ready' && project.viewerUrl ? (
              <Button 
                size="sm"
                className="w-full"
                onClick={(e) => {
                  e.stopPropagation();
                  window.open(project.viewerUrl!, '_blank');
                }}
                data-testid={`button-open-viewer-${project.id}`}
              >
                Open 3D Viewer
              </Button>
            ) : project.deliveryStatus === 'processing' ? (
              <Button disabled size="sm" className="w-full" data-testid={`button-processing-${project.id}`}>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Converting Point Cloud...
              </Button>
            ) : project.deliveryStatus === 'failed' ? (
              <Button 
                variant="destructive"
                size="sm"
                className="w-full"
                onClick={(e) => {
                  e.stopPropagation();
                  generatePointCloudMutation.mutate();
                }}
                disabled={generatePointCloudMutation.isPending}
                data-testid={`button-retry-viewer-${project.id}`}
              >
                <Play className="mr-2 h-4 w-4" />
                Retry Conversion
              </Button>
            ) : (
              <Button 
                variant="outline"
                size="sm"
                className="w-full"
                onClick={(e) => {
                  e.stopPropagation();
                  generatePointCloudMutation.mutate();
                }}
                disabled={generatePointCloudMutation.isPending}
                data-testid={`button-generate-viewer-${project.id}`}
              >
                <Play className="mr-2 h-4 w-4" />
                Generate Viewer
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
