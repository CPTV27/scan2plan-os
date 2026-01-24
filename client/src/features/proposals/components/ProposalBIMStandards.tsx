/**
 * ProposalBIMStandards Component
 *
 * Pages 10-12 of the proposal - BIM Modeling Standards.
 * Displays 3 full-page images from the official S2P modelling standards.
 */

interface ProposalBIMStandardsProps {
  disabled?: boolean;
}

const MODELLING_STANDARDS_IMAGES = [
  "/2024-modelling-standards-1.jpg",
  "/2024-modelling-standards-2.jpg",
  "/2024-modelling-standards-3.jpg",
];

export function ProposalBIMStandards({
  disabled = false,
}: ProposalBIMStandardsProps) {
  return (
    <>
      {MODELLING_STANDARDS_IMAGES.map((imageSrc, index) => (
        <div
          key={index}
          className="proposal-page min-h-[11in] bg-white relative overflow-hidden"
        >
          <img
            src={imageSrc}
            alt={`BIM Modeling Standards - Page ${index + 1}`}
            className="w-full h-full object-contain"
          />
        </div>
      ))}
    </>
  );
}
