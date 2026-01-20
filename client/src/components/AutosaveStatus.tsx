import { Check, Cloud, CloudOff, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { AutosaveStatus as AutosaveStatusType } from "@/hooks/use-lead-autosave";

interface AutosaveStatusProps {
  status: AutosaveStatusType;
  error: string | null;
  onRetry?: () => void;
}

export function AutosaveStatus({ status, error, onRetry }: AutosaveStatusProps) {
  if (status === "idle") {
    return (
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground" data-testid="autosave-idle">
        <Cloud className="w-3.5 h-3.5" />
        <span>Auto-save enabled</span>
      </div>
    );
  }

  if (status === "saving") {
    return (
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground" data-testid="autosave-saving">
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
        <span>Saving...</span>
      </div>
    );
  }

  if (status === "saved") {
    return (
      <div className="flex items-center gap-1.5 text-xs text-green-600 dark:text-green-400" data-testid="autosave-saved">
        <Check className="w-3.5 h-3.5" />
        <span>Saved</span>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="flex items-center gap-1.5" data-testid="autosave-error">
        <CloudOff className="w-3.5 h-3.5 text-destructive" />
        <span className="text-xs text-destructive">{error || "Save failed"}</span>
        {onRetry && (
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-xs"
            onClick={onRetry}
            data-testid="button-autosave-retry"
          >
            <RefreshCw className="w-3 h-3 mr-1" />
            Retry
          </Button>
        )}
      </div>
    );
  }

  return null;
}
