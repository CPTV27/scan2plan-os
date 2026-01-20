export interface SiteReadinessQuestion {
  id: string;
  question: string;
  type: "boolean" | "select" | "text" | "number";
  options?: string[];
  mapsTo?: string;
  pricingImpact?: string;
}

export const SITE_READINESS_QUESTIONS: SiteReadinessQuestion[] = [
  {
    id: "occupied",
    question: "Is the building currently occupied?",
    type: "boolean",
    pricingImpact: "May require after-hours scanning"
  },
  {
    id: "accessRestrictions",
    question: "Are there access restrictions? (security badges, escorts, limited hours)",
    type: "text",
    pricingImpact: "Affects scheduling and site time"
  },
  {
    id: "separateStructures",
    question: "How many separate buildings/structures need to be scanned?",
    type: "number",
    pricingImpact: "Each structure is priced separately"
  },
  {
    id: "hasBasement",
    question: "Does the building have a basement?",
    type: "boolean",
    mapsTo: "hasBasement"
  },
  {
    id: "hasAttic",
    question: "Does the building have an attic or crawl space that needs scanning?",
    type: "boolean",
    mapsTo: "hasAttic"
  },
  {
    id: "dropCeilings",
    question: "Are there drop ceilings/ceiling tiles?",
    type: "select",
    options: ["No drop ceilings", "Yes - tiles can be moved", "Yes - tiles cannot be moved", "Unknown"],
    pricingImpact: "Above-ceiling scanning is additional scope"
  },
  {
    id: "hazardousMaterials",
    question: "Are there any known hazardous materials? (asbestos, lead paint, etc.)",
    type: "select",
    options: ["None known", "Yes - remediated", "Yes - still present", "Unknown"]
  },
  {
    id: "activeConstruction",
    question: "Is there active construction happening on-site?",
    type: "boolean",
    pricingImpact: "May affect site access and safety protocols"
  },
  {
    id: "parkingAccess",
    question: "Is there parking available near the building for our equipment vehicle?",
    type: "select",
    options: ["Yes - on-site parking", "Street parking nearby", "Limited/difficult parking", "Unknown"]
  },
  {
    id: "existingDrawings",
    question: "Do you have any existing drawings or floor plans you can share?",
    type: "select",
    options: ["Yes - CAD/BIM files", "Yes - PDF drawings", "Yes - paper only", "No existing drawings"]
  },
  {
    id: "additionalNotes",
    question: "Anything else we should know about the site?",
    type: "text"
  }
];
