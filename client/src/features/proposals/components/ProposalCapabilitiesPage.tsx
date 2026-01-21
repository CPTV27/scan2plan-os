/**
 * ProposalCapabilitiesPage Component
 *
 * Page 8 of the proposal - Capabilities section.
 * Two-column layout showcasing Scan2Plan's capabilities.
 */

interface ProposalCapabilitiesPageProps {
  disabled?: boolean;
}

const SCANNING_CAPABILITIES = [
  {
    title: "Laser Scanning",
    description:
      "High-precision 3D laser scanning with survey-grade accuracy for any building type or size.",
  },
  {
    title: "Matterport Virtual Tours",
    description:
      "Immersive 3D virtual tours for remote viewing, marketing, and documentation purposes.",
  },
  {
    title: "Drone Photogrammetry",
    description:
      "Aerial scanning and imaging for roofs, facades, and large-scale site documentation.",
  },
  {
    title: "Point Cloud Processing",
    description:
      "Advanced registration and processing of scan data into clean, aligned point clouds.",
  },
];

const MODELING_CAPABILITIES = [
  {
    title: "Revit BIM Modeling",
    description:
      "Accurate BIM models in Autodesk Revit at LoD 100-400 for all building disciplines.",
  },
  {
    title: "AutoCAD Drawings",
    description:
      "Traditional 2D floor plans, elevations, and sections from scan data.",
  },
  {
    title: "Clash Detection",
    description:
      "Identification of conflicts between existing conditions and proposed designs.",
  },
  {
    title: "As-Built Documentation",
    description:
      "Complete existing conditions documentation for renovation and retrofit projects.",
  },
];

export function ProposalCapabilitiesPage({
  disabled = false,
}: ProposalCapabilitiesPageProps) {
  return (
    <div className="proposal-page min-h-[11in] p-16 bg-white relative">
      {/* Section Title */}
      <h1 className="text-3xl font-bold text-[#4285f4] mb-8">
        Our Capabilities
      </h1>

      <p className="text-gray-600 mb-8 leading-relaxed">
        Scan2Plan offers a comprehensive suite of building documentation
        services, combining cutting-edge scanning technology with expert BIM
        modeling to deliver accurate, actionable data for your projects.
      </p>

      {/* Two Column Layout */}
      <div className="grid grid-cols-2 gap-12">
        {/* Left Column: Scanning Services */}
        <div>
          <h2 className="text-xl font-semibold text-[#4285f4] mb-4 border-b border-[#4285f4] pb-2">
            Scanning Services
          </h2>
          <div className="space-y-4">
            {SCANNING_CAPABILITIES.map((cap, index) => (
              <div key={index}>
                <h3 className="font-semibold text-gray-800">{cap.title}</h3>
                <p className="text-sm text-gray-600">{cap.description}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Right Column: Modeling Services */}
        <div>
          <h2 className="text-xl font-semibold text-[#4285f4] mb-4 border-b border-[#4285f4] pb-2">
            Modeling Services
          </h2>
          <div className="space-y-4">
            {MODELING_CAPABILITIES.map((cap, index) => (
              <div key={index}>
                <h3 className="font-semibold text-gray-800">{cap.title}</h3>
                <p className="text-sm text-gray-600">{cap.description}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom callout */}
      <div className="mt-8 p-6 bg-[#e8f0fe] rounded-lg">
        <h3 className="font-semibold text-[#4285f4] mb-2">
          Industry Standards Compliance
        </h3>
        <p className="text-sm text-gray-700">
          All deliverables meet or exceed USIBD Level of Development (LoD)
          specifications and BOMA measurement standards. Our QC processes
          ensure consistent accuracy across all projects.
        </p>
      </div>

      {/* Page Footer */}
      <div className="absolute bottom-8 left-16 right-16 border-t border-gray-300 pt-3 text-center text-xs text-gray-500">
        Scan2Plan, Inc • 188 1st St, Troy NY, 12180 • (518) 362-2403 •
        admin@scan2plan.io • scan2plan.io
      </div>
    </div>
  );
}
