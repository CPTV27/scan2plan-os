/**
 * ProposalCoverPage Component
 *
 * Page 1 of the proposal - Cover page with logo, project info, and legal text.
 * Matches PandaDoc cover page layout.
 */

import { EditableText } from "./EditableText";
import type { ProposalCoverData } from "@shared/schema/types";

interface ProposalCoverPageProps {
  data: ProposalCoverData;
  onChange: (field: keyof ProposalCoverData, value: string) => void;
  onBlur?: () => void;
  disabled?: boolean;
}

export function ProposalCoverPage({
  data,
  onChange,
  onBlur,
  disabled = false,
}: ProposalCoverPageProps) {
  return (
    <div className="proposal-page cover-page flex flex-col justify-between min-h-[11in] p-16 bg-white relative">
      {/* Top Section: Logo and Company Info */}
      <div className="text-center">
        <img
          src="/logo-cover.png"
          alt="Scan2Plan"
          className="w-48 mx-auto mb-6"
        />
        <div className="text-sm text-gray-600 space-y-0.5">
          <div>188 1st St, Troy, NY 12180</div>
          <div>(518) 362-2403 / admin@scan2plan.io</div>
          <div>www.scan2plan.io</div>
        </div>
      </div>

      {/* Middle Section: Proposal Title and Project Info */}
      <div className="text-center space-y-8 flex-1 flex flex-col justify-center">
        <h1 className="text-5xl font-bold tracking-wider">- PROPOSAL -</h1>

        <div className="space-y-4">
          <h2 className="text-2xl font-semibold">
            Laser Scanning & Building Documentation
          </h2>

          <EditableText
            value={data.projectTitle}
            onChange={(v) => onChange("projectTitle", v)}
            onBlur={onBlur}
            as="h2"
            className="text-xl font-medium"
            placeholder="Project Title"
            disabled={disabled}
          />

          <EditableText
            value={data.projectAddress}
            onChange={(v) => onChange("projectAddress", v)}
            onBlur={onBlur}
            className="text-lg text-gray-600"
            placeholder="Project Address"
            disabled={disabled}
          />

          <EditableText
            value={data.servicesLine}
            onChange={(v) => onChange("servicesLine", v)}
            onBlur={onBlur}
            className="text-lg text-gray-500 italic"
            placeholder="Services (e.g., LoD 350 + MEPF + Structure)"
            disabled={disabled}
          />
        </div>
      </div>

      {/* Bottom Section: Legal Text */}
      <div className="space-y-6">
        <div className="text-sm leading-relaxed text-gray-700">
          <p>
            Scan2Plan, Inc., a Delaware corporation ("S2P") hereby proposes to
            provide the services set forth below to{" "}
            <EditableText
              value={data.clientName}
              onChange={(v) => onChange("clientName", v)}
              onBlur={onBlur}
              as="span"
              className="font-bold text-black"
              placeholder="Client Name"
              disabled={disabled}
            />
            . Use of the services or the project deliverables described herein
            constitutes acceptance by the client. This Proposal is dated{" "}
            <EditableText
              value={data.date}
              onChange={(v) => onChange("date", v)}
              onBlur={onBlur}
              as="span"
              className="font-bold text-black"
              placeholder="MM/DD/YY"
              disabled={disabled}
            />
            .
          </p>
        </div>

        {/* Page Footer */}
        <div className="border-t border-gray-300 pt-3 text-center text-xs text-gray-500">
          Scan2Plan, Inc • 188 1st St, Troy NY, 12180 • (518) 362-2403 •
          admin@scan2plan.io • scan2plan.io
        </div>
      </div>
    </div>
  );
}
