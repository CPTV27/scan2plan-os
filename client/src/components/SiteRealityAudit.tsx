import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { 
  AlertTriangle, 
  CheckCircle2, 
  Building2, 
  MapPin, 
  Scan,
  Loader2,
  XCircle,
  Info,
  ArrowRight,
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface RiskItem {
  category: string;
  severity: "low" | "medium" | "high";
  description: string;
  recommendation: string;
}

interface SiteAuditResult {
  address: string;
  auditDate: string;
  buildingAnalysis: {
    estimatedFloors: number;
    roofComplexity: string;
    hvacDensity: string;
    exteriorFeatures: string[];
    potentialChallenges: string[];
  };
  sqftAssessment: {
    scopedSqft: number | null;
    estimatedActualSqft: number | null;
    variancePercent: number | null;
    varianceRisk: string;
    notes: string;
  };
  risks: RiskItem[];
  overallRiskScore: number;
  recommendations: string[];
  confidenceLevel: string;
  rawAnalysis: string;
}

interface SiteRealityAuditProps {
  projectId?: number;
  leadId?: number;
  projectAddress?: string;
  variant?: "button" | "icon";
}

export function SiteRealityAudit({ 
  projectId, 
  leadId, 
  projectAddress,
  variant = "button" 
}: SiteRealityAuditProps) {
  const [open, setOpen] = useState(false);
  const [auditResult, setAuditResult] = useState<SiteAuditResult | null>(null);

  const auditMutation = useMutation({
    mutationFn: async () => {
      const endpoint = projectId 
        ? `/api/site-audit/${projectId}`
        : `/api/site-audit/lead/${leadId}`;
      const response = await apiRequest("POST", endpoint);
      return response.json();
    },
    onSuccess: (data) => {
      setAuditResult(data);
    },
  });

  const handleRunAudit = () => {
    setAuditResult(null);
    auditMutation.mutate();
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "high": return "bg-red-500/20 text-red-400 border-red-500/30";
      case "medium": return "bg-yellow-500/20 text-yellow-400 border-yellow-500/30";
      case "low": return "bg-green-500/20 text-green-400 border-green-500/30";
      default: return "bg-muted text-muted-foreground";
    }
  };

  const getRiskScoreColor = (score: number) => {
    if (score >= 7) return "text-red-400";
    if (score >= 4) return "text-yellow-400";
    return "text-green-400";
  };

  const getVarianceRiskBadge = (risk: string) => {
    switch (risk) {
      case "high": return <Badge variant="destructive">High Variance Risk</Badge>;
      case "medium": return <Badge className="bg-yellow-500/20 text-yellow-400">Medium Variance</Badge>;
      case "low": return <Badge className="bg-green-500/20 text-green-400">Low Variance</Badge>;
      default: return <Badge variant="secondary">Unknown</Badge>;
    }
  };

  if (!projectId && !leadId) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {variant === "icon" ? (
          <Button 
            size="icon" 
            variant="ghost" 
            data-testid="button-reality-check"
            title="Site Reality Check"
          >
            <Scan className="h-4 w-4" />
          </Button>
        ) : (
          <Button 
            variant="outline" 
            size="sm"
            data-testid="button-reality-check"
          >
            <Scan className="mr-2 h-4 w-4" />
            Reality Check
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[85vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Site Reality Audit
          </DialogTitle>
        </DialogHeader>
        
        <ScrollArea className="max-h-[70vh] pr-4">
          {!auditResult && !auditMutation.isPending && (
            <div className="flex flex-col items-center justify-center py-8 gap-4">
              <div className="text-center space-y-2">
                <p className="text-muted-foreground">
                  Run an AI-powered analysis of the project site to identify potential risks, 
                  square footage discrepancies, and scoping issues before scheduling.
                </p>
                {projectAddress && (
                  <div className="flex items-center justify-center gap-2 text-sm">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    <span>{projectAddress}</span>
                  </div>
                )}
              </div>
              <Button 
                onClick={handleRunAudit}
                data-testid="button-run-audit"
              >
                <Scan className="mr-2 h-4 w-4" />
                Run Site Audit
              </Button>
            </div>
          )}

          {auditMutation.isPending && (
            <div className="flex flex-col items-center justify-center py-12 gap-4">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-muted-foreground">Analyzing site data...</p>
            </div>
          )}

          {auditMutation.isError && (
            <div className="flex flex-col items-center justify-center py-8 gap-4">
              <XCircle className="h-8 w-8 text-red-400" />
              <p className="text-red-400">Failed to run site audit</p>
              <Button variant="outline" onClick={handleRunAudit}>
                Retry
              </Button>
            </div>
          )}

          {auditResult && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">{auditResult.address}</span>
                </div>
                <Badge variant="outline">
                  Confidence: {auditResult.confidenceLevel}
                </Badge>
              </div>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center justify-between gap-2">
                    <span>Overall Risk Score</span>
                    <span className={`text-2xl font-bold ${getRiskScoreColor(auditResult.overallRiskScore)}`}>
                      {auditResult.overallRiskScore}/10
                    </span>
                  </CardTitle>
                </CardHeader>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Building Analysis</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Est. Floors</span>
                      <p className="font-medium">{auditResult.buildingAnalysis.estimatedFloors}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Roof Complexity</span>
                      <p className="font-medium capitalize">{auditResult.buildingAnalysis.roofComplexity}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">HVAC Density</span>
                      <p className="font-medium capitalize">{auditResult.buildingAnalysis.hvacDensity}</p>
                    </div>
                  </div>
                  
                  {auditResult.buildingAnalysis.potentialChallenges.length > 0 && (
                    <>
                      <Separator />
                      <div>
                        <span className="text-sm text-muted-foreground">Potential Challenges</span>
                        <ul className="mt-1 space-y-1">
                          {auditResult.buildingAnalysis.potentialChallenges.map((challenge, i) => (
                            <li key={i} className="text-sm flex items-start gap-2">
                              <AlertTriangle className="h-4 w-4 text-yellow-400 mt-0.5 flex-shrink-0" />
                              {challenge}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center justify-between gap-2">
                    <span>Square Foot Assessment</span>
                    {getVarianceRiskBadge(auditResult.sqftAssessment.varianceRisk)}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Scoped SQFT</span>
                      <p className="font-medium">
                        {auditResult.sqftAssessment.scopedSqft?.toLocaleString() || "N/A"}
                      </p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Estimated Actual</span>
                      <p className="font-medium">
                        {auditResult.sqftAssessment.estimatedActualSqft?.toLocaleString() || "N/A"}
                      </p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Variance</span>
                      <p className="font-medium">
                        {auditResult.sqftAssessment.variancePercent != null 
                          ? `${auditResult.sqftAssessment.variancePercent.toFixed(1)}%` 
                          : "N/A"}
                      </p>
                    </div>
                  </div>
                  {auditResult.sqftAssessment.notes && (
                    <p className="text-sm text-muted-foreground">
                      {auditResult.sqftAssessment.notes}
                    </p>
                  )}
                </CardContent>
              </Card>

              {auditResult.risks.length > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">Identified Risks</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {auditResult.risks.map((risk, i) => (
                      <div 
                        key={i} 
                        className={`p-3 rounded-md border ${getSeverityColor(risk.severity)}`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <Badge variant="outline" className="capitalize">
                            {risk.category}
                          </Badge>
                          <Badge className={getSeverityColor(risk.severity)}>
                            {risk.severity}
                          </Badge>
                        </div>
                        <p className="text-sm mb-2">{risk.description}</p>
                        <div className="flex items-start gap-2 text-sm text-muted-foreground">
                          <ArrowRight className="h-4 w-4 mt-0.5 flex-shrink-0" />
                          {risk.recommendation}
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}

              {auditResult.recommendations.length > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-green-400" />
                      Recommendations
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2">
                      {auditResult.recommendations.map((rec, i) => (
                        <li key={i} className="text-sm flex items-start gap-2">
                          <Info className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                          {rec}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}

              <div className="flex justify-end pt-2">
                <Button variant="outline" onClick={handleRunAudit}>
                  Re-run Audit
                </Button>
              </div>
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
