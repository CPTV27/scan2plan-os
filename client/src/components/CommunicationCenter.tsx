import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { Copy, Mail, MessageSquare, FileText, CheckCircle, UserCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { Lead } from "@shared/schema";
import { BUYER_PERSONAS } from "@shared/schema";

interface CommunicationCenterProps {
  lead: Lead;
  onClose?: () => void;
}

interface CommunicationTemplate {
  id: string;
  name: string;
  subject?: string;
  body: string;
  type: "email" | "sms" | "proposal";
}

const getPersonaTemplates = (lead: Lead): Record<string, CommunicationTemplate[]> => {
  const clientName = lead.clientName || "Valued Client";
  const projectAddress = lead.projectAddress || "your project location";
  const projectName = lead.projectName || "your project";
  const value = lead.value ? Number(lead.value).toLocaleString() : "TBD";
  const sqft = lead.sqft?.toLocaleString() || "the specified";

  return {
    BP1: [
      {
        id: "bp1-intro",
        name: "Technical Introduction",
        type: "email",
        subject: `Scan2Plan Technical Capabilities - ${projectName}`,
        body: `Dear ${clientName},

Thank you for your interest in our laser scanning and BIM documentation services.

For your project at ${projectAddress}, I wanted to share our technical specifications:

SCANNING CAPABILITIES:
- LiDAR point cloud capture with 2mm resolution
- LoA 40 (0-1/4") measured accuracy guarantee
- Full RGB color capture for photorealistic deliverables
- Interior/exterior scanning with registration RMS tracking

BIM DELIVERABLES:
- LOD 300-400 as specified per discipline
- Clash detection and coordination
- B-Validation cross-scan alignment QC
- Revit/AutoCAD native formats

I'd be happy to discuss our methodology in detail and provide sample deliverables from comparable projects.

Best regards,
Scan2Plan Technical Team`,
      },
      {
        id: "bp1-qc",
        name: "QC & Accuracy Report",
        type: "email",
        subject: `Quality Control Process - ${projectName}`,
        body: `Dear ${clientName},

Following up on the technical aspects of our quality control process:

VALIDATION STAGES:
1. A-Validation: Point cloud registration (RMS < 5mm)
2. B-Validation: Cross-scan alignment verification
3. C-Validation: Model-to-cloud deviation analysis

ACCURACY DELIVERABLES:
- Registration RMS report per scan position
- LoA certification documentation
- Deviation color maps where specified

Our engineering team maintains strict tolerances throughout the project lifecycle.

Best regards,
Scan2Plan QC Team`,
      },
    ],
    BP2: [
      {
        id: "bp2-roi",
        name: "Executive ROI Summary",
        type: "email",
        subject: `Project ROI & Timeline - ${clientName}`,
        body: `Dear ${clientName},

I wanted to provide a quick executive summary for your consideration:

INVESTMENT: $${value}
TIMELINE: Rapid turnaround with phased deliverables
ROI METRICS:
- 30-40% reduction in field verification visits
- Eliminate costly change orders from inaccurate documentation
- Accelerated design and construction schedules

KEY DIFFERENTIATORS:
- Guaranteed accuracy with LoA certification
- Production-grade QC with full validation
- Seamless integration with your existing workflows

I'm available for a 15-minute call to discuss how we can accelerate your project timeline.

Best regards,
Scan2Plan Team`,
      },
      {
        id: "bp2-speed",
        name: "Speed to Delivery",
        type: "email",
        subject: `Expedited Delivery Options - ${projectName}`,
        body: `Dear ${clientName},

Understanding that time is critical, here are our expedited delivery options:

STANDARD: 2-3 weeks from scan completion
EXPEDITED: 5-7 business days (+15% premium)
RUSH: 48-72 hours for critical phases (+30% premium)

We can phase deliverables by building/area to keep your team moving forward while we complete the full scope.

Ready to lock in your project schedule?

Best regards,
Scan2Plan Team`,
      },
    ],
    BP3: [
      {
        id: "bp3-schedule",
        name: "Project Schedule Overview",
        type: "email",
        subject: `Project Schedule & Milestones - ${projectName}`,
        body: `Dear ${clientName},

Here is a detailed schedule breakdown for ${projectAddress}:

PHASE 1: MOBILIZATION (Days 1-3)
- Site access coordination
- Safety review and scan planning
- Equipment deployment

PHASE 2: FIELD CAPTURE (Days 4-7)
- LiDAR scanning of ${sqft} SF
- Photography documentation
- Daily progress updates

PHASE 3: PROCESSING (Days 8-14)
- Point cloud registration
- QC validation (A/B)
- BIM modeling initiation

PHASE 4: DELIVERY (Days 15-21)
- Draft deliverables for review
- Revision window
- Final delivery

BUDGET: $${value} (all-inclusive)
PAYMENT: 50% retainer / 50% on delivery

I'm happy to adjust this timeline to align with your project milestones.

Best regards,
Scan2Plan PM Team`,
      },
      {
        id: "bp3-budget",
        name: "Budget Breakdown",
        type: "email",
        subject: `Detailed Cost Breakdown - ${projectName}`,
        body: `Dear ${clientName},

As requested, here is the itemized budget for your project:

PROJECT SCOPE: ${sqft} SF at ${projectAddress}

COST COMPONENTS:
- Field Capture (labor + equipment): Included
- Travel & Mobilization: Included
- Point Cloud Processing: Included
- BIM Modeling (per LOD spec): Included
- QC & Validation: Included
- Project Management: Included

TOTAL INVESTMENT: $${value}

PAYMENT TERMS:
- 50% retainer upon engagement
- 50% upon final delivery

This is a fixed-price proposal with no hidden fees or change orders for the defined scope.

Best regards,
Scan2Plan PM Team`,
      },
    ],
    BP4: [
      {
        id: "bp4-ops",
        name: "Operations Coordination",
        type: "email",
        subject: `Site Access & Coordination - ${projectName}`,
        body: `Dear ${clientName},

To ensure minimal disruption to your operations at ${projectAddress}, here's our coordination plan:

SITE ACCESS REQUIREMENTS:
- General access to scan areas
- Badge/escort if required (we accommodate security protocols)
- Power outlets for equipment charging (optional)

SCAN SCHEDULE OPTIONS:
- After-hours scanning (6pm-6am)
- Weekend scanning
- Phased scanning during low-activity periods

DISRUPTION MITIGATION:
- Non-intrusive LiDAR equipment (no drilling/mounting)
- Quiet operation (< 50dB)
- Clean-up after each scan session

We'll work around your operations schedule. Let me know your preferred timing and any restricted areas.

Best regards,
Scan2Plan Field Team`,
      },
    ],
    BP5: [
      {
        id: "bp5-design",
        name: "Design Documentation",
        type: "email",
        subject: `BIM Documentation & LOD Specifications - ${projectName}`,
        body: `Dear ${clientName},

For the architectural documentation at ${projectAddress}, here are our capabilities:

LOD SPECIFICATIONS:
- LOD 200: Basic mass and placeholder elements
- LOD 300: Design-level coordination geometry
- LOD 350: Contractor coordination elements
- LOD 400: Fabrication-ready modeling

DELIVERABLE FORMATS:
- Revit (.rvt) - Native families
- AutoCAD (.dwg) - 2D plans/sections
- Point Cloud (.rcp, .e57) - Registered scans
- PDF documentation sheets

ARCHITECTURAL ELEMENTS:
- Wall types and assemblies
- Door/window schedules
- Ceiling heights and MEP clearances
- Structural coordination

Our team includes HBIM specialists for historic preservation projects requiring enhanced documentation.

Best regards,
Scan2Plan Design Team`,
      },
      {
        id: "bp5-precision",
        name: "Precision & Accuracy",
        type: "email",
        subject: `Accuracy Standards & Tolerances - ${projectName}`,
        body: `Dear ${clientName},

Regarding precision requirements for your design work:

LEVEL OF ACCURACY (LoA):
- LoA 40: 0-1/4" (6mm) - Standard for renovation
- LoA 30: 1/4"-1/2" - Conceptual/planning
- LoA 50: 0-1/8" - Precision/fabrication (available)

VERIFICATION:
- Point-to-point deviation analysis
- Cross-section overlays
- Deviation heat maps

All deliverables come with accuracy certification documentation.

Best regards,
Scan2Plan Team`,
      },
    ],
    BP6: [
      {
        id: "bp6-value",
        name: "Investment Value Proposition",
        type: "email",
        subject: `Documentation Investment - ${projectAddress}`,
        body: `Dear ${clientName},

For your property at ${projectAddress}, here's the value proposition:

INVESTMENT: $${value}
PROPERTY SIZE: ${sqft} SF

VALUE DRIVERS:
- Accurate as-built for tenant improvements
- Documentation for insurance/compliance
- Foundation for future renovations
- Due diligence asset for transactions

LONG-TERM BENEFITS:
- Reduced design costs for future projects (30-40%)
- Faster permitting with accurate documentation
- Enhanced property valuation with BIM assets

This is a one-time investment that pays dividends throughout property ownership.

Best regards,
Scan2Plan Team`,
      },
    ],
    BP7: [
      {
        id: "bp7-coord",
        name: "Construction Coordination",
        type: "email",
        subject: `As-Built Coordination for ${projectName}`,
        body: `Dear ${clientName},

For your construction project at ${projectAddress}:

COORDINATION DELIVERABLES:
- Registered point clouds for field verification
- Clash detection with trade partners
- As-built vs. design deviation reports
- Progress documentation scans

SCHEDULE INTEGRATION:
- We align with your construction schedule
- Phased scanning as work progresses
- 48-72 hour turnaround for coordination models

FIELD SUPPORT:
- On-site scan technicians
- Real-time coordination with superintendent
- Direct upload to your CDE (ACC, Procore, etc.)

Let's schedule a coordination call with your project team.

Best regards,
Scan2Plan Construction Team`,
      },
    ],
  };
};

const getPersonaStarterText = (lead: Lead, persona: string): string => {
  const clientName = lead.clientName || "Valued Client";
  const projectAddress = lead.projectAddress || "your project location";
  const projectName = lead.projectName || "your project";
  
  const starters: Record<string, string> = {
    BP1: `Dear ${clientName},\n\nRegarding the technical specifications for ${projectName}...\n\n`,
    BP2: `Dear ${clientName},\n\nI wanted to follow up on our discussion about ${projectName} and highlight the key value drivers...\n\n`,
    BP3: `Dear ${clientName},\n\nHere's a quick update on the timeline and budget for ${projectName}...\n\n`,
    BP4: `Dear ${clientName},\n\nTo coordinate site access at ${projectAddress}, I wanted to confirm the following...\n\n`,
    BP5: `Dear ${clientName},\n\nFor the documentation at ${projectAddress}, I wanted to discuss our LOD specifications and deliverable formats...\n\n`,
    BP6: `Dear ${clientName},\n\nRegarding your investment in as-built documentation for ${projectAddress}...\n\n`,
    BP7: `Dear ${clientName},\n\nFor coordination on ${projectName}, here's our proposed approach...\n\n`,
  };
  
  return starters[persona] || starters.BP2;
};

export function CommunicationCenter({ lead, onClose }: CommunicationCenterProps) {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<"templates" | "compose">("templates");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const persona = lead.buyerPersona || "BP2";
  const personaLabel = BUYER_PERSONAS[persona as keyof typeof BUYER_PERSONAS] || "Executive (ROI/Speed)";
  
  const [customMessage, setCustomMessage] = useState(() => getPersonaStarterText(lead, persona));
  const templates = getPersonaTemplates(lead);
  const personaTemplates = templates[persona] || templates.BP2;

  const handleCopyTemplate = async (template: CommunicationTemplate) => {
    const text = template.subject 
      ? `Subject: ${template.subject}\n\n${template.body}`
      : template.body;
    
    await navigator.clipboard.writeText(text);
    setCopiedId(template.id);
    toast({
      title: "Copied to clipboard",
      description: `"${template.name}" template copied`,
    });
    
    setTimeout(() => setCopiedId(null), 2000);
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "email": return <Mail className="w-4 h-4" />;
      case "sms": return <MessageSquare className="w-4 h-4" />;
      case "proposal": return <FileText className="w-4 h-4" />;
      default: return <Mail className="w-4 h-4" />;
    }
  };

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="flex-shrink-0 pb-3">
        <div className="flex items-center justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="w-5 h-5" />
              Communication Center
            </CardTitle>
            <CardDescription className="flex items-center gap-2 mt-1">
              <UserCircle className="w-4 h-4" />
              <span>Persona:</span>
              <Badge variant="outline">{personaLabel}</Badge>
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex-1 overflow-hidden p-0">
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)} className="h-full flex flex-col">
          <TabsList className="mx-4 mb-2 w-auto self-start">
            <TabsTrigger value="templates" data-testid="tab-templates">
              Templates
            </TabsTrigger>
            <TabsTrigger value="compose" data-testid="tab-compose">
              Compose
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="templates" className="flex-1 overflow-hidden m-0 px-4 pb-4">
            <ScrollArea className="h-full">
              <div className="space-y-3 pr-4">
                {personaTemplates.map((template) => (
                  <Card key={template.id} className="hover-elevate">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div className="flex items-center gap-2 min-w-0">
                          {getTypeIcon(template.type)}
                          <span className="font-medium truncate">{template.name}</span>
                          <Badge variant="secondary" className="text-xs">
                            {template.type}
                          </Badge>
                        </div>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => handleCopyTemplate(template)}
                          data-testid={`button-copy-${template.id}`}
                        >
                          {copiedId === template.id ? (
                            <CheckCircle className="w-4 h-4 text-green-500" />
                          ) : (
                            <Copy className="w-4 h-4" />
                          )}
                        </Button>
                      </div>
                      {template.subject && (
                        <p className="text-sm text-muted-foreground mb-2">
                          <span className="font-medium">Subject:</span> {template.subject}
                        </p>
                      )}
                      <p className="text-sm text-muted-foreground line-clamp-3 whitespace-pre-line">
                        {template.body.substring(0, 200)}...
                      </p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </ScrollArea>
          </TabsContent>
          
          <TabsContent value="compose" className="flex-1 overflow-hidden m-0 px-4 pb-4">
            <div className="h-full flex flex-col gap-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span>Composing for:</span>
                  <Badge variant="outline">{lead.clientName}</Badge>
                  <Badge variant="secondary">{personaLabel}</Badge>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setCustomMessage(getPersonaStarterText(lead, persona))}
                  data-testid="button-reset-template"
                >
                  Reset to Template
                </Button>
              </div>
              <Textarea
                placeholder="Compose your custom message..."
                value={customMessage}
                onChange={(e) => setCustomMessage(e.target.value)}
                className="flex-1 resize-none"
                data-testid="textarea-compose"
              />
              <div className="flex items-center justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    navigator.clipboard.writeText(customMessage);
                    toast({ title: "Message copied to clipboard" });
                  }}
                  disabled={!customMessage.trim()}
                  data-testid="button-copy-compose"
                >
                  <Copy className="w-4 h-4 mr-2" />
                  Copy
                </Button>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
