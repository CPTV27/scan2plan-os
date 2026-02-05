/**
 * ProposalCapabilitiesPage Component
 *
 * Page 8 of the proposal - Scan2Plan Capabilities section.
 * Matches the official S2P proposal PDF format exactly.
 */

interface ProposalCapabilitiesPageProps {
  disabled?: boolean;
}

export function ProposalCapabilitiesPage({
  disabled = false,
}: ProposalCapabilitiesPageProps) {
  return (
    <div className="proposal-page min-h-[11in] p-16 bg-white relative">
      {/* Section Title */}
      <h1 className="text-3xl font-bold text-[#123ea8] mb-4">
        Scan2Plan Capabilities
      </h1>

      {/* Target Audience */}
      <p className="text-[#123ea8] font-semibold mb-8">
        Scan2Plan is for: Architects, Structural Engineers, MEP Engineers, Interior Designers, Property Managers, Owner/Operators, Landscape Architects, Civil Engineers.
      </p>

      {/* Two Column Layout */}
      <div className="grid grid-cols-2 gap-x-12 gap-y-6">
        {/* Left Column */}
        <div className="space-y-6">
          {/* Scan-to-BIM */}
          <div>
            <h2 className="text-lg font-semibold text-[#49494b] mb-2">Scan-to-BIM</h2>
            <ul className="text-sm text-[#49494b] space-y-1.5 ml-4">
              <li className="flex items-start gap-2">
                <span className="mt-1.5">•</span>
                <span>Architectural & Structural Existing Conditions Documentation.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1.5">•</span>
                <span>Deliverables:</span>
              </li>
              <ul className="ml-6 space-y-1">
                <li className="flex items-start gap-2">
                  <span className="mt-1.5">•</span>
                  <span>Revit Model</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-1.5">•</span>
                  <span>Colorized Point Cloud</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-1.5">•</span>
                  <span>360 Photo documentation</span>
                </li>
              </ul>
              <li className="flex items-start gap-2">
                <span className="mt-1.5">•</span>
                <span>Standard Options:</span>
              </li>
              <ul className="ml-6 space-y-1">
                <li className="flex items-start gap-2">
                  <span className="mt-1.5">•</span>
                  <span><span className="text-[#123ea8] underline">LoD 200</span> (Approximate Geometry)</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-1.5">•</span>
                  <span><span className="text-[#123ea8] underline">LoD 300</span> (Accurate Geometry)</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-1.5">•</span>
                  <span><span className="text-[#123ea8] underline">LoD 350</span> (Precise Geometry)</span>
                </li>
              </ul>
              <li className="flex items-start gap-2">
                <span className="mt-1.5">•</span>
                <span>Level of Accuracy:</span>
              </li>
              <ul className="ml-6 space-y-1">
                <li className="flex items-start gap-2">
                  <span className="mt-1.5">•</span>
                  <span>Point Cloud - 0" to 1/8"</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-1.5">•</span>
                  <span>Model - 0" to 1/2"</span>
                </li>
              </ul>
              <li className="flex items-start gap-2">
                <span className="mt-1.5">•</span>
                <span>Turnaround: 2-5 weeks (depending on scope)</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1.5">•</span>
                <span>Pricing: is based on:</span>
              </li>
              <ul className="ml-6 space-y-1">
                <li className="flex items-start gap-2">
                  <span className="mt-1.5">•</span>
                  <span>A) Type of Building/Structure</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-1.5">•</span>
                  <span>B) LoD Standard</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-1.5">•</span>
                  <span>C) Square Footage</span>
                </li>
              </ul>
            </ul>
          </div>

          {/* BIM to CAD Conversion */}
          <div>
            <h2 className="text-lg font-semibold text-[#49494b] mb-2">BIM to CAD Conversion</h2>
            <ul className="text-sm text-[#49494b] space-y-1.5 ml-4">
              <li className="flex items-start gap-2">
                <span className="mt-1.5">•</span>
                <span>Pristine CAD drawings converted from Revit Model.</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Right Column */}
        <div className="space-y-6">
          {/* MEPF Modeling */}
          <div>
            <h2 className="text-lg font-semibold text-[#49494b] mb-2">MEPF Modeling</h2>
            <ul className="text-sm text-[#49494b] space-y-1.5 ml-4">
              <li className="flex items-start gap-2">
                <span className="mt-1.5">•</span>
                <span>Any exposed Mechanical, Electrical, Plumbing and Fire Safety elements documented in BIM or CAD.</span>
              </li>
            </ul>
          </div>

          {/* Landscape */}
          <div>
            <h2 className="text-lg font-semibold text-[#49494b] mb-2">Landscape</h2>
            <ul className="text-sm text-[#49494b] space-y-1.5 ml-4">
              <li className="flex items-start gap-2">
                <span className="mt-1.5">•</span>
                <span>Landscape, grounds, and urban spaces documented in BIM or CAD.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1.5">•</span>
                <span>Georeferencing and forestry optional.</span>
              </li>
            </ul>
          </div>

          {/* Matterport 3D Tour */}
          <div>
            <h2 className="text-lg font-semibold text-[#49494b] mb-2">Matterport 3D Tour</h2>
            <ul className="text-sm text-[#49494b] space-y-1.5 ml-4">
              <li className="flex items-start gap-2">
                <span className="mt-1.5">•</span>
                <span>High resolution 360 photo documentation and virtual tour walkthrough. An excellent remote collaboration tool, easily shared and viewed on any mobile or desktop device.</span>
              </li>
            </ul>
          </div>

          {/* Paper to BIM or CAD */}
          <div>
            <h2 className="text-lg font-semibold text-[#49494b] mb-2">Paper to BIM or CAD</h2>
            <ul className="text-sm text-[#49494b] space-y-1.5 ml-4">
              <li className="flex items-start gap-2">
                <span className="mt-1.5">•</span>
                <span>Legacy 2D paper drawings converted to functional BIM or CAD documentation.</span>
              </li>
            </ul>
          </div>

          {/* Model Only / Point Cloud Only */}
          <div>
            <h2 className="text-lg font-semibold text-[#49494b] mb-2">Model Only / Point Cloud Only</h2>
            <ul className="text-sm text-[#49494b] space-y-1.5 ml-4">
              <li className="flex items-start gap-2">
                <span className="mt-1.5">•</span>
                <span>You work with our point cloud or we'll model from yours.</span>
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Software Support */}
      <div className="mt-8">
        <p className="text-sm text-[#49494b]">
          We support: <span className="font-semibold text-[#123ea8]">Revit, AutoCAD, Sketchup, Rhino, Vectorworks, Solidworks, Chief Architect, ArchiCAD, Civil 3D</span>, and others....
        </p>
      </div>

      {/* Page Footer */}
      <div className="absolute bottom-8 left-16 right-16 border-t border-[#d1d5db] pt-3 text-center text-xs text-[#616161]">
        Scan2Plan, Inc • 188 1st St, Troy NY, 12180 • (518) 362-2403 •
        admin@scan2plan.io • <span className="text-[#123ea8] underline">scan2plan.io</span>
      </div>
    </div>
  );
}
