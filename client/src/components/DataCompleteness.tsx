import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle2, AlertCircle, MessageSquare, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import type { MissingInfoEntry } from "@/features/deals/types";

interface DataCompletenessProps {
  fields: {
    key: string;
    label: string;
    value: string | null | undefined;
    required?: boolean;
  }[];
  missingInfo: MissingInfoEntry[];
  className?: string;
}

export function DataCompleteness({ fields, missingInfo, className }: DataCompletenessProps) {
  const pendingFields = missingInfo.filter(m => m.status === "pending").map(m => m.fieldKey);
  const sentFields = missingInfo.filter(m => m.status === "sent").map(m => m.fieldKey);
  
  const filledFields = fields.filter(f => f.value && f.value.trim() !== "");
  const handledFields = fields.filter(f => 
    (f.value && f.value.trim() !== "") || 
    pendingFields.includes(f.key) || 
    sentFields.includes(f.key)
  );
  const totalFields = fields.length;
  const completionPercent = Math.round((handledFields.length / totalFields) * 100);
  
  const pendingFollowUps = missingInfo.filter(m => m.status === "pending");
  const sentFollowUps = missingInfo.filter(m => m.status === "sent");
  
  const getStatusColor = (percent: number) => {
    if (percent >= 80) return "text-green-600";
    if (percent >= 50) return "text-amber-600";
    return "text-red-600";
  };
  
  const getProgressColor = (percent: number) => {
    if (percent >= 80) return "bg-green-500";
    if (percent >= 50) return "bg-amber-500";
    return "bg-red-500";
  };

  return (
    <Card className={cn("overflow-visible", className)}>
      <CardContent className="pt-4 pb-3">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">Data Completeness</span>
          </div>
          <span className={cn("text-lg font-bold", getStatusColor(completionPercent))}>
            {completionPercent}%
          </span>
        </div>
        
        <Progress 
          value={completionPercent} 
          className="h-2 mb-3"
          style={{ 
            ['--progress-indicator-color' as string]: completionPercent >= 80 
              ? 'rgb(34 197 94)' 
              : completionPercent >= 50 
                ? 'rgb(245 158 11)' 
                : 'rgb(239 68 68)'
          }}
        />
        
        <div className="flex flex-wrap gap-2 text-xs">
          <div className="flex items-center gap-1">
            <CheckCircle2 className="h-3 w-3 text-green-600" />
            <span>
              {filledFields.length} of {totalFields} filled
              {handledFields.length > filledFields.length && ` (+${handledFields.length - filledFields.length} tracked)`}
            </span>
          </div>
          
          {pendingFollowUps.length > 0 && (
            <Badge variant="outline" className="text-amber-600 border-amber-500/30 bg-amber-500/10">
              <MessageSquare className="h-3 w-3 mr-1" />
              {pendingFollowUps.length} follow-up{pendingFollowUps.length > 1 ? 's' : ''} needed
            </Badge>
          )}
          
          {sentFollowUps.length > 0 && (
            <Badge variant="outline" className="text-blue-600 border-blue-500/30 bg-blue-500/10">
              <AlertCircle className="h-3 w-3 mr-1" />
              {sentFollowUps.length} awaiting response
            </Badge>
          )}
        </div>
        
        {pendingFollowUps.length > 0 && (
          <div className="mt-3 pt-3 border-t">
            <p className="text-xs text-muted-foreground mb-2">Questions to ask client:</p>
            <ul className="space-y-1">
              {pendingFollowUps.map((item, idx) => (
                <li key={idx} className="text-xs flex items-start gap-2">
                  <MessageSquare className="h-3 w-3 text-amber-500 mt-0.5 flex-shrink-0" />
                  <span className="text-muted-foreground">{item.question}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
