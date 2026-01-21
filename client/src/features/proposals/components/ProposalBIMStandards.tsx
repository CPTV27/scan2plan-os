/**
 * ProposalBIMStandards Component
 *
 * Pages 10-12 of the proposal - BIM Modeling Standards table.
 * Static reference table showing LoD specifications.
 */

interface ProposalBIMStandardsProps {
  disabled?: boolean;
}

const BIM_STANDARDS = [
  {
    lod: "100",
    description: "Conceptual",
    content:
      "Overall building mass, basic geometric shapes. Used for area analysis and preliminary studies.",
    accuracy: "±1'-0\"",
    useCase: "Early feasibility studies",
  },
  {
    lod: "200",
    description: "Schematic",
    content:
      "Generic placeholders with approximate quantities, size, shape, location, and orientation.",
    accuracy: "±6\"",
    useCase: "Schematic design, planning",
  },
  {
    lod: "300",
    description: "Design Development",
    content:
      "Specific elements with accurate geometry. Suitable for design coordination and clash detection.",
    accuracy: "±1\"",
    useCase: "Design coordination, permits",
  },
  {
    lod: "350",
    description: "Construction Documentation",
    content:
      "Elements with connections, supports, and interfaces. Ready for construction document production.",
    accuracy: "±1/2\"",
    useCase: "Construction documents",
  },
  {
    lod: "400",
    description: "Fabrication",
    content:
      "Elements modeled at fabrication level with complete detailing for manufacturing.",
    accuracy: "±1/4\"",
    useCase: "Fabrication, shop drawings",
  },
];

const DISCIPLINES = [
  {
    name: "Architectural",
    elements: [
      "Walls (interior/exterior)",
      "Doors and windows",
      "Floors and ceilings",
      "Stairs and ramps",
      "Roof structures",
      "Curtain walls",
    ],
  },
  {
    name: "Structural",
    elements: [
      "Columns and beams",
      "Foundations",
      "Bracing and connections",
      "Decking",
      "Structural walls",
      "Load paths",
    ],
  },
  {
    name: "MEP",
    elements: [
      "HVAC ductwork",
      "Piping systems",
      "Electrical conduit",
      "Equipment",
      "Plumbing fixtures",
      "Fire protection",
    ],
  },
];

export function ProposalBIMStandards({
  disabled = false,
}: ProposalBIMStandardsProps) {
  return (
    <>
      {/* Page 1: LoD Table */}
      <div className="proposal-page min-h-[11in] p-16 bg-white relative">
        {/* Section Title */}
        <h1 className="text-3xl font-bold text-[#4285f4] mb-6">
          BIM Modeling Standards
        </h1>

        <p className="text-gray-600 mb-6 leading-relaxed">
          Our BIM deliverables follow USIBD (U.S. Institute of Building
          Documentation) Level of Development specifications. The table below
          outlines what is included at each LoD level.
        </p>

        {/* LoD Standards Table */}
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-[#e8f0fe]">
              <th className="p-3 text-left text-[#4285f4] font-medium border-b">
                LoD
              </th>
              <th className="p-3 text-left text-[#4285f4] font-medium border-b">
                Description
              </th>
              <th className="p-3 text-left text-[#4285f4] font-medium border-b">
                Content
              </th>
              <th className="p-3 text-left text-[#4285f4] font-medium border-b">
                Accuracy
              </th>
            </tr>
          </thead>
          <tbody>
            {BIM_STANDARDS.map((std) => (
              <tr key={std.lod} className="border-b border-gray-100">
                <td className="p-3 font-semibold text-[#4285f4]">{std.lod}</td>
                <td className="p-3 font-medium">{std.description}</td>
                <td className="p-3 text-gray-600">{std.content}</td>
                <td className="p-3 text-gray-600">{std.accuracy}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="mt-6 p-4 bg-gray-50 rounded-lg text-sm text-gray-600">
          <strong>Note:</strong> LoD levels are cumulative. Higher LoD levels
          include all content from lower levels plus additional detail.
        </div>

        {/* Page Footer */}
        <div className="absolute bottom-8 left-16 right-16 border-t border-gray-300 pt-3 text-center text-xs text-gray-500">
          Scan2Plan, Inc • 188 1st St, Troy NY, 12180 • (518) 362-2403 •
          admin@scan2plan.io • scan2plan.io
        </div>
      </div>

      {/* Page 2: Discipline Breakdown */}
      <div className="proposal-page min-h-[11in] p-16 bg-white relative">
        <h1 className="text-3xl font-bold text-[#4285f4] mb-6">
          Discipline Coverage
        </h1>

        <p className="text-gray-600 mb-8 leading-relaxed">
          We provide BIM modeling across all major building disciplines. Below
          is a summary of typical elements modeled in each discipline.
        </p>

        <div className="grid grid-cols-3 gap-8">
          {DISCIPLINES.map((disc) => (
            <div key={disc.name}>
              <h2 className="text-xl font-semibold text-[#4285f4] mb-4 border-b border-[#4285f4] pb-2">
                {disc.name}
              </h2>
              <ul className="space-y-2">
                {disc.elements.map((elem, index) => (
                  <li key={index} className="flex items-start gap-2 text-sm">
                    <span className="text-[#4285f4] mt-0.5">•</span>
                    <span className="text-gray-700">{elem}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Accuracy Standards */}
        <div className="mt-12">
          <h2 className="text-xl font-semibold text-[#4285f4] mb-4">
            Quality Assurance
          </h2>
          <div className="grid grid-cols-2 gap-8">
            <div className="p-4 border border-gray-200 rounded-lg">
              <h3 className="font-semibold text-gray-800 mb-2">
                Scan Registration
              </h3>
              <p className="text-sm text-gray-600">
                All point clouds are registered to a unified coordinate system
                with overlap verification and RMS error reporting.
              </p>
            </div>
            <div className="p-4 border border-gray-200 rounded-lg">
              <h3 className="font-semibold text-gray-800 mb-2">
                Model Verification
              </h3>
              <p className="text-sm text-gray-600">
                Models are verified against source point cloud data with
                documented deviation analysis at critical points.
              </p>
            </div>
          </div>
        </div>

        {/* Page Footer */}
        <div className="absolute bottom-8 left-16 right-16 border-t border-gray-300 pt-3 text-center text-xs text-gray-500">
          Scan2Plan, Inc • 188 1st St, Troy NY, 12180 • (518) 362-2403 •
          admin@scan2plan.io • scan2plan.io
        </div>
      </div>
    </>
  );
}
