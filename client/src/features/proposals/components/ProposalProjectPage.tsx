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
  return (
    <div className="proposal-page min-h-[11in] p-16 bg-white relative">
      {/* Section Title */}
      <h1 className="text-3xl font-bold text-[#4285f4] mb-8">The Project</h1>

      {/* Overview */}
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-[#4285f4] mb-3">Overview</h2>
        <EditableText
          value={data.overview}
          onChange={(v) => onChange("overview", v)}
          onBlur={onBlur}
          className="text-gray-700 leading-relaxed"
          placeholder="Project overview description..."
          multiline
          disabled={disabled}
        />
      </div>

      {/* Scope of Work */}
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-[#4285f4] mb-3">
          Scope of Work
        </h2>
        <EditableList
          items={data.scopeItems}
          onChange={(items) => onChange("scopeItems", items)}
          onBlur={onBlur}
          placeholder="Scope item..."
          disabled={disabled}
          itemClassName="text-gray-700"
        />
      </div>

      {/* Deliverables */}
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-[#4285f4] mb-3">
          Deliverables
        </h2>
        <EditableList
          items={data.deliverables}
          onChange={(items) => onChange("deliverables", items)}
          onBlur={onBlur}
          placeholder="Deliverable item..."
          disabled={disabled}
          itemClassName="text-gray-700"
        />
      </div>

      {/* Timeline */}
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-[#4285f4] mb-3">Timeline</h2>
        <EditableText
          value={data.timelineIntro}
          onChange={(v) => onChange("timelineIntro", v)}
          onBlur={onBlur}
          className="text-gray-700 mb-3"
          placeholder="Timeline introduction..."
          disabled={disabled}
        />
        <EditableList
          items={data.milestones}
          onChange={(items) => onChange("milestones", items)}
          onBlur={onBlur}
          placeholder="Milestone..."
          disabled={disabled}
          itemClassName="text-gray-700"
        />
      </div>

      {/* Page Footer */}
      <div className="absolute bottom-8 left-16 right-16 border-t border-gray-300 pt-3 text-center text-xs text-gray-500">
        Scan2Plan, Inc • 188 1st St, Troy NY, 12180 • (518) 362-2403 •
        admin@scan2plan.io • scan2plan.io
      </div>
    </div>
  );
}
