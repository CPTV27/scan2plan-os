/**
 * ProposalProjectPage Component
 *
 * Page 3 of the proposal - "The Project" section.
 * Contains Overview, Scope of Work, Deliverables, and Timeline.
 */

import { EditableText, EditableList } from "./EditableText";
import type { ProposalProjectData } from "@shared/schema/types";

interface ProposalProjectPageProps {
  data: ProposalProjectData;
  onChange: (field: keyof ProposalProjectData, value: any) => void;
  onBlur?: () => void;
  disabled?: boolean;
}

export function ProposalProjectPage({
  data,
  onChange,
  onBlur,
  disabled = false,
}: ProposalProjectPageProps) {
  const serviceType = data.serviceType || "Commercial";
  const hasMatterport = data.hasMatterport || false;

  // Check if Matterport item already exists in scope
  const matterportText = serviceType === "Residential"
    ? "Matterport Scan - A scanning technician will capture the interior of the residence."
    : "Matterport Scan - A scanning technician will capture the interior of the property.";

  const hasMatterportInScope = (data.scopeItems || []).some(
    item => item.toLowerCase().includes("matterport")
  );

  return (
    <div className="proposal-page min-h-[11in] p-16 bg-white relative">
      {/* Section Title */}
      <h1 className="text-3xl font-bold text-[#123ea8] mb-8">The Project</h1>

      {/* Overview */}
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-[#123ea8] mb-3">Overview</h2>
        <EditableText
          value={data.overviewLine || `Service for ${data.overview || "Project Name, Address"}`}
          onChange={(v) => onChange("overviewLine", v)}
          onBlur={onBlur}
          className="text-[#49494b] leading-relaxed"
          placeholder="Service for Project Name, Address..."
          disabled={disabled}
        />
      </div>

      {/* Scope of Work */}
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-[#123ea8] mb-3">
          Scope of Work
        </h2>
        <EditableList
          items={data.scopeItems}
          onChange={(items) => onChange("scopeItems", items)}
          onBlur={onBlur}
          placeholder="Scope item..."
          disabled={disabled}
          itemClassName="text-[#49494b]"
        />
        {/* Show Matterport item if enabled and not already in list */}
        {hasMatterport && !hasMatterportInScope && (
          <div className="flex items-start gap-2 mt-2">
            <span className="text-[#49494b]">•</span>
            <span className="text-[#49494b]">{matterportText}</span>
          </div>
        )}
      </div>

      {/* Deliverables */}
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-[#123ea8] mb-3">
          Deliverables
        </h2>
        <EditableList
          items={data.deliverables}
          onChange={(items) => onChange("deliverables", items)}
          onBlur={onBlur}
          placeholder="Deliverable item..."
          disabled={disabled}
          itemClassName="text-[#49494b]"
        />
      </div>

      {/* Timeline */}
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-[#123ea8] mb-3">Timeline</h2>
        <EditableText
          value={data.timelineIntro}
          onChange={(v) => onChange("timelineIntro", v)}
          onBlur={onBlur}
          className="text-[#49494b] mb-3"
          placeholder="Timeline introduction..."
          disabled={disabled}
        />
        <EditableList
          items={data.milestones}
          onChange={(items) => onChange("milestones", items)}
          onBlur={onBlur}
          placeholder="Milestone..."
          disabled={disabled}
          itemClassName="text-[#49494b]"
        />
      </div>

      {/* Page Footer */}
      <div className="absolute bottom-8 left-16 right-16 border-t border-[#d1d5db] pt-3 text-center text-xs text-[#616161]">
        Scan2Plan, Inc • 188 1st St, Troy NY, 12180 • (518) 362-2403 •
        admin@scan2plan.io • <span className="text-[#123ea8] underline">scan2plan.io</span>
      </div>
    </div>
  );
}
