import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { HelpCircle, Check, MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";

interface HungryFieldProps {
  fieldKey: string;
  question: string;
  onUnknownChange: (isUnknown: boolean) => void;
  isUnknown?: boolean;
  children: React.ReactNode;
  className?: string;
}

export function HungryField({
  fieldKey,
  question,
  onUnknownChange,
  isUnknown = false,
  children,
  className,
}: HungryFieldProps) {
  const [showUnknown, setShowUnknown] = useState(isUnknown);

  useEffect(() => {
    setShowUnknown(isUnknown);
  }, [isUnknown]);

  const handleMarkUnknown = () => {
    setShowUnknown(true);
    onUnknownChange(true);
  };

  const handleClearUnknown = () => {
    setShowUnknown(false);
    onUnknownChange(false);
  };

  if (showUnknown) {
    return (
      <div className={cn("space-y-2", className)}>
        <div className="flex items-center justify-between p-3 rounded-lg border border-amber-500/30 bg-amber-500/5">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-amber-500" />
            <span className="text-sm text-muted-foreground">
              Will ask client: <span className="font-medium text-foreground">"{question}"</span>
            </span>
          </div>
          <Badge variant="outline" className="text-amber-600 border-amber-500/30 bg-amber-500/10">
            Follow-up needed
          </Badge>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={handleClearUnknown}
          className="text-xs text-muted-foreground hover:text-foreground"
          data-testid={`button-clear-unknown-${fieldKey}`}
        >
          <Check className="h-3 w-3 mr-1" />
          I have this information now
        </Button>
      </div>
    );
  }

  return (
    <div className={cn("space-y-2", className)}>
      {children}
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={handleMarkUnknown}
        className="text-xs text-muted-foreground hover:text-amber-600"
        data-testid={`button-idk-${fieldKey}`}
      >
        <HelpCircle className="h-3 w-3 mr-1" />
        I don't know - add to follow-up
      </Button>
    </div>
  );
}

export const HUNGRY_FIELD_QUESTIONS: Record<string, string> = {
  timeline: "What is your target timeline for project completion?",
  paymentTerms: "What are your preferred payment terms?",
  proofLinks: "Can you share any floor plans, photos, or existing drawings of the site?",
  contactPhone: "What is the best phone number to reach you?",
  billingContactPhone: "What is the billing contact's phone number?",
  sqft: "What is the approximate square footage of the project?",
  buildingType: "What type of building is this (warehouse, office, historic, etc.)?",
  registrationRms: "What is the registration RMS value from quality control?",
  progress: "What percentage of the project has been completed?",
  dueDate: "When is the project deadline?",
  assignedTechId: "Which technician should be assigned to this project?",
};
