/**
 * ProposalAboutPage Component
 *
 * Page 2 of the proposal - "About Scan2Plan" and "Why Scan2Plan" sections.
 * Matches the official S2P proposal PDF layout exactly.
 */

interface ProposalAboutPageProps {
  disabled?: boolean;
}

const WHY_POINTS_LEFT = [
  "Experienced, dedicated team of field techs, drafters (AutoCAD and Revit) and licensed engineers.",
  "We take the time to scope each project to suit your priorities.",
  "We use the finest precision tools to capture a point cloud with extreme accuracy.",
  "Drafted to Scan2Plan's rigorous design standards - your design phase begins upon delivery.",
];

const WHY_POINTS_RIGHT = [
  "We take a process driven approach with extensive quality control and team review.",
  "Exceptional support from real professionals.",
  "Scan2Plan has national and international coverage.",
  "We work on a wide range of projects from single family homes to large-scale commercial, industrial and infrastructure.",
];

export function ProposalAboutPage({ disabled = false }: ProposalAboutPageProps) {
  return (
    <div className="proposal-page min-h-[11in] p-16 bg-white relative">
      {/* About Scan2Plan Section */}
      <div className="mb-6">
        <h2 className="text-3xl font-bold text-[#123ea8] mb-6">
          About Scan2Plan<sup className="text-lg">®</sup>
        </h2>

        <p className="text-[#49494b] mb-4 text-base leading-relaxed">
          We began in 2018 with a simple goal of helping firms <span className="font-bold underline">focus on design</span>.
        </p>

        <p className="text-[#49494b] mb-4 text-base leading-relaxed">
          We're an on-demand LiDAR to BIM/CAD team that can model any building in weeks. This can be done
          within any scope, budget or schedule. We've scanned over 1,000 buildings (~10M sqft).
        </p>

        <p className="text-[#49494b] mb-8 text-base leading-relaxed">
          We use LiDAR scanners for 3D mapping with extreme accuracy. We deliver professionally drafted 3D
          BIM and 2D CAD for comprehensive existing conditions documentation. Our Point Cloud datasets
          serve as a verifiable single-source-of-truth for coordination and risk-mitigation across projects.
        </p>
      </div>

      {/* Point Cloud Image */}
      <div className="mb-8 flex justify-center">
        <img
          src="/point-cloud-building.jpg"
          alt="Point Cloud Building Visualization"
          className="max-w-full h-auto max-h-64 object-contain"
          onError={(e) => {
            // Fallback placeholder if image doesn't exist
            const target = e.target as HTMLImageElement;
            target.style.backgroundColor = '#f3f4f6';
            target.style.minHeight = '200px';
            target.style.minWidth = '400px';
            target.alt = 'Point Cloud Visualization';
          }}
        />
      </div>

      {/* Why Scan2Plan Section */}
      <div>
        <h2 className="text-3xl font-bold text-[#123ea8] mb-6">
          Why Scan2Plan?
        </h2>

        {/* Two Column Bullet List */}
        <div className="grid grid-cols-2 gap-8">
          {/* Left Column */}
          <ul className="space-y-4">
            {WHY_POINTS_LEFT.map((point, index) => (
              <li key={index} className="flex items-start gap-3 text-base">
                <span className="text-[#49494b] mt-0.5">•</span>
                <span className="text-[#49494b] leading-relaxed">{point}</span>
              </li>
            ))}
          </ul>

          {/* Right Column */}
          <ul className="space-y-4">
            {WHY_POINTS_RIGHT.map((point, index) => (
              <li key={index} className="flex items-start gap-3 text-base">
                <span className="text-[#49494b] mt-0.5">•</span>
                <span className="text-[#49494b] leading-relaxed">{point}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Page Footer */}
      <div className="absolute bottom-8 left-16 right-16 border-t border-[#d1d5db] pt-3 text-center text-xs text-[#616161]">
        Scan2Plan, Inc • 188 1st St, Troy NY, 12180 • (518) 362-2403 •
        admin@scan2plan.io • <span className="text-[#123ea8] underline">scan2plan.io</span>
      </div>
    </div>
  );
}
