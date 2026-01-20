import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { HelpCircle } from "lucide-react";

interface ContextHelpProps {
  content: string;
}

export function ContextHelp({ content }: ContextHelpProps) {
  return (
    <HoverCard>
      <HoverCardTrigger asChild>
        <HelpCircle className="h-4 w-4 text-muted-foreground hover:text-primary cursor-help inline-block ml-2 align-middle" data-testid="icon-context-help" />
      </HoverCardTrigger>
      <HoverCardContent className="w-80 text-sm text-muted-foreground">
        {content}
      </HoverCardContent>
    </HoverCard>
  );
}
