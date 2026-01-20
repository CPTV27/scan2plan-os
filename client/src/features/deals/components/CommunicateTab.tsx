import { ScrollArea } from "@/components/ui/scroll-area";
import { TabsContent } from "@/components/ui/tabs";
import { CorrespondenceTimeline } from "@/components/CorrespondenceTimeline";

interface CommunicateTabProps {
  leadId: number;
  contactEmail: string | null | undefined;
}

export function CommunicateTab({ leadId, contactEmail }: CommunicateTabProps) {
  return (
    <TabsContent value="communicate" className="flex-1 overflow-hidden m-0">
      <ScrollArea className="h-full">
        <div className="p-4">
          <CorrespondenceTimeline 
            leadId={leadId} 
            contactEmail={contactEmail}
          />
        </div>
      </ScrollArea>
    </TabsContent>
  );
}
