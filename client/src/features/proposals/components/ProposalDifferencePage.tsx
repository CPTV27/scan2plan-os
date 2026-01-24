/**
 * ProposalDifferencePage Component
 *
 * Page 9 of the proposal - "The Scan2Plan Difference" section.
 * Matches the official S2P proposal PDF format exactly.
 */

interface ProposalDifferencePageProps {
  disabled?: boolean;
}

const DIFFERENCE_POINTS = [
  {
    title: "High-Quality Data for Superior Results",
    description:
      "The accuracy of your models and drawings hinges on the quality of the underlying data. We capture all our point cloud data sets in full color, with significant overlap and redundancy. This meticulous approach maximizes point cloud density, leading to more accurate and detailed models.",
  },
  {
    title: "Precision with Terrestrial LiDAR",
    description:
      'Different technologies like Drones, SLAM scanners, Solid State LiDAR, or Photogrammetry offer varied results. We have chosen high-end terrestrial LiDAR for its unparalleled accuracy. Using the Trimble X7 scanner for every project, we guarantee consistent millimeter accuracy. Our process includes thorough validation of the Point Cloud, ensuring precision from 0" to 1/8".',
  },
  {
    title: "Setting High Standards in BIM & CAD",
    description:
      "Transparency in BIM & CAD standards is vital. Providers may offer different levels of detail (LoD) standards. We offer the highest standard of Levels of Development (LoD) 200, 300, and 350, for schematic and construction-ready documentation. Our Mechanical, Electrical, Plumbing, and Fire (MEPF) documentation consistently meets the highest standards.",
  },
  {
    title: "The Human Touch in Modeling and Drafting",
    description:
      "In an era where AI is prevalent, we take pride in our 100% manual approach to modeling and drafting. Our expert team meticulously translates data into detailed models and drawings, ensuring that every element is captured accurately.",
  },
  {
    title: "Rigorous Quality Control for Trusted Accuracy",
    description:
      "Earning your trust means delivering impeccably accurate documents. Our dedicated Quality Control team conducts multiple checks on every deliverable, ensuring they meet our high standards. This thorough process is our commitment to saving you time and resources in the long run.",
  },
  {
    title: "Customized to Your Standards",
    description:
      "We adapt to your specific needs from the start. Whether it's integrating your Revit Templates or CAD Standards, we ensure a seamless transition from our delivery to your design phase.",
  },
  {
    title: "Dedicated Support & Revisions",
    description:
      "Our commitment to your satisfaction extends beyond delivery. We offer comprehensive support, including demonstrations on using Point Cloud in Revit or AutoCAD, and we're always ready to make revisions until you're completely satisfied.",
  },
  {
    title: "A Small, Specialized Team",
    description:
      "Our small, dedicated team ensures consistent quality and personalized service. We focus on building strong client relationships, ensuring familiarity and consistency across projects.",
  },
  {
    title: "Ready When You Are",
    description:
      "The best ability is availability. Our scanning techs are typically available to be on-site within a week of a signed contract, offering flexible and responsive service across the Northeast and the Nation.",
  },
];

export function ProposalDifferencePage({
  disabled = false,
}: ProposalDifferencePageProps) {
  // Split points into two columns (5 left, 4 right to match PDF layout)
  const leftColumn = DIFFERENCE_POINTS.slice(0, 5);
  const rightColumn = DIFFERENCE_POINTS.slice(5);

  return (
    <div className="proposal-page min-h-[11in] p-16 bg-white relative">
      {/* Section Title */}
      <h1 className="text-3xl font-bold text-[#123da7] mb-2">
        The Scan2Plan Difference
      </h1>

      {/* Subtitle */}
      <h2 className="text-xl font-semibold text-[#123da7] mb-4">
        What to look for in a Scan-to-BIM partner.
      </h2>

      {/* Intro Paragraph */}
      <p className="text-sm text-gray-700 mb-6 leading-relaxed">
        In the evolving landscape of scanning and modeling, it's important to consider your options to find a service that aligns with your specific needs. Scan2Plan is committed to delivering quality and precision in this field. Here's a closer look at what sets us apart:
      </p>

      {/* Two Column Layout */}
      <div className="grid grid-cols-2 gap-x-10 gap-y-4">
        {/* Left Column */}
        <div className="space-y-4">
          {leftColumn.map((point, index) => (
            <div key={index}>
              <h3 className="text-sm font-semibold text-gray-900 mb-1">
                • {point.title}
              </h3>
              <p className="text-xs text-gray-600 leading-relaxed pl-3">
                {point.description}
              </p>
            </div>
          ))}
        </div>

        {/* Right Column */}
        <div className="space-y-4">
          {rightColumn.map((point, index) => (
            <div key={index}>
              <h3 className="text-sm font-semibold text-gray-900 mb-1">
                • {point.title}
              </h3>
              <p className="text-xs text-gray-600 leading-relaxed pl-3">
                {point.description}
              </p>
            </div>
          ))}
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
