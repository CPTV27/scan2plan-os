import { useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";

export interface FieldAffirmations {
  [fieldId: string]: boolean;
}

interface AffirmableFieldProps {
  fieldId: string;
  affirmationLabel: string;
  isAffirmed: boolean;
  onAffirmationChange: (affirmed: boolean) => void;
  onFieldChange?: () => void;
  children: React.ReactNode;
  className?: string;
  showBorder?: boolean;
}

export function AffirmableField({
  fieldId,
  affirmationLabel,
  isAffirmed,
  onAffirmationChange,
  children,
  className = "",
  showBorder = true,
}: AffirmableFieldProps) {
  return (
    <div className={`space-y-2 ${className}`}>
      <div className={isAffirmed ? "opacity-50 pointer-events-none" : ""}>
        {children}
      </div>
      <div className={`flex items-center gap-2 ${showBorder ? "pt-2 border-t border-dashed" : ""}`}>
        <Checkbox
          id={`affirm-${fieldId}`}
          checked={isAffirmed}
          onCheckedChange={(checked) => {
            onAffirmationChange(!!checked);
          }}
          data-testid={`checkbox-affirm-${fieldId}`}
        />
        <label 
          htmlFor={`affirm-${fieldId}`} 
          className="text-xs text-muted-foreground cursor-pointer italic"
        >
          {affirmationLabel}
        </label>
      </div>
    </div>
  );
}

export function useFieldAffirmations(initialAffirmations: FieldAffirmations = {}) {
  const [affirmations, setAffirmations] = useState<FieldAffirmations>(initialAffirmations);

  const setAffirmation = (fieldId: string, affirmed: boolean) => {
    setAffirmations(prev => ({ ...prev, [fieldId]: affirmed }));
  };

  const isAffirmed = (fieldId: string) => affirmations[fieldId] === true;

  const clearAffirmation = (fieldId: string) => {
    setAffirmations(prev => {
      const next = { ...prev };
      delete next[fieldId];
      return next;
    });
  };

  return {
    affirmations,
    setAffirmations,
    setAffirmation,
    isAffirmed,
    clearAffirmation,
  };
}
