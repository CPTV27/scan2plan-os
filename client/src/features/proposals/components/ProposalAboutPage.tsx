/**
 * ProposalAboutPage Component
 *
 * Page 2 of the proposal - "About Scan2Plan" and "Why Scan2Plan" sections.
 * Two-column layout with image.
 */

interface ProposalAboutPageProps {
  disabled?: boolean;
}

const ABOUT_POINTS = [
  "Leading provider of building documentation services in the Tri-State Area",
  "Full lifecycle scanning solutions from pre-construction through facilities management",
  "Streamlined workflow integration with major BIM platforms",
  "Quality assurance protocols ensuring accuracy and completeness",
];

const WHY_POINTS = [
  "Certified scanning professionals with architectural and engineering expertise",
  "Fast turnaround times without compromising quality",
  "Competitive pricing with transparent project scoping",
  "Dedicated project management and client communication",
  "Post-delivery support and revisions as needed",
];

export function ProposalAboutPage({ disabled = false }: ProposalAboutPageProps) {
  return (
    <div className="proposal-page min-h-[11in] p-16 bg-white relative">
      {/* Header Image */}
      <div className="mb-8">
        <img
          src="/proposal-header.jpg"
          alt="Scan2Plan Office"
          className="w-full h-48 object-cover rounded-lg"
          onError={(e) => {
            // Fallback if image doesn't exist
            (e.target as HTMLImageElement).style.display = 'none';
          }}
        />
      </div>

      {/* Two Column Layout */}
      <div className="grid grid-cols-2 gap-12">
        {/* Left Column: About Scan2Plan */}
        <div>
          <h2 className="text-2xl font-bold text-[#4285f4] mb-4">
            About Scan2Plan
          </h2>
          <p className="text-gray-600 mb-4 text-sm leading-relaxed">
            Scan2Plan is a premier building documentation company specializing in
            laser scanning and BIM modeling services. Our team of certified
            professionals delivers accurate, high-quality documentation for
            renovation, construction, and facilities management projects.
          </p>
          <ul className="space-y-2">
            {ABOUT_POINTS.map((point, index) => (
              <li key={index} className="flex items-start gap-2 text-sm">
                <span className="text-[#4285f4] mt-1">•</span>
                <span className="text-gray-700">{point}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Right Column: Why Scan2Plan */}
        <div>
          <h2 className="text-2xl font-bold text-[#4285f4] mb-4">
            Why Scan2Plan?
          </h2>
          <p className="text-gray-600 mb-4 text-sm leading-relaxed">
            Choosing the right documentation partner is critical to project
            success. Scan2Plan brings together technical expertise, proven
            processes, and a commitment to client satisfaction.
          </p>
          <ul className="space-y-2">
            {WHY_POINTS.map((point, index) => (
              <li key={index} className="flex items-start gap-2 text-sm">
                <span className="text-[#4285f4] mt-1">•</span>
                <span className="text-gray-700">{point}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Page Footer */}
      <div className="absolute bottom-8 left-16 right-16 border-t border-gray-300 pt-3 text-center text-xs text-gray-500">
        Scan2Plan, Inc • 188 1st St, Troy NY, 12180 • (518) 362-2403 •
        admin@scan2plan.io • scan2plan.io
      </div>
    </div>
  );
}
