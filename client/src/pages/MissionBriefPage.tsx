import { useParams, useLocation } from "wouter";
import { MissionBriefView } from "@/components/MissionBrief";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

export default function MissionBriefPage() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  
  if (!id) {
    return <div className="p-8 text-center">Project ID is required</div>;
  }

  return (
    <div className="p-6">
      <div className="mb-4 print:hidden">
        <Button 
          variant="ghost" 
          onClick={() => setLocation(`/production`)}
          data-testid="button-back-to-production"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Production
        </Button>
      </div>
      <MissionBriefView projectId={parseInt(id)} />
    </div>
  );
}
