/**
 * ProposalDifferencePage Component
 *
 * Page 9 of the proposal - "The Scan2Plan Difference" section.
 * Two-column layout highlighting unique value propositions.
 */

interface ProposalDifferencePageProps {
  disabled?: boolean;
}

const DIFFERENCE_POINTS = [
  {
    title: "Quality First",
    description:
      "Every project goes through our rigorous QC process. We don't just deliver data—we deliver verified, accurate documentation you can trust.",
    icon: "✓",
  },
  {
    title: "Expert Team",
    description:
      "Our team includes licensed architects, engineers, and certified scanning professionals who understand your project needs.",
    icon: "★",
  },
  {
    title: "Fast Turnaround",
    description:
      "We understand project timelines. Our streamlined workflows enable rapid delivery without compromising quality.",
    icon: "⚡",
  },
  {
    title: "Clear Communication",
    description:
      "Dedicated project managers keep you informed at every stage. No surprises, no delays, just results.",
    icon: "💬",
  },
  {
    title: "Transparent Pricing",
    description:
      "Detailed proposals with clear scope. You know exactly what you're getting and what it costs upfront.",
    icon: "💲",
  },
  {
    title: "Post-Delivery Support",
    description:
      "Questions after delivery? We're here to help. Revisions and clarifications are part of our commitment to your success.",
    icon: "🛠",
  },
];

export function ProposalDifferencePage({
  disabled = false,
}: ProposalDifferencePageProps) {
  return (
    <div className="proposal-page min-h-[11in] p-16 bg-white relative">
      {/* Section Title */}
      <h1 className="text-3xl font-bold text-[#4285f4] mb-4">
        The Scan2Plan Difference
      </h1>

      <p className="text-gray-600 mb-8 leading-relaxed text-lg">
        What sets us apart isn't just our technology—it's our commitment to
        your project's success from first scan to final delivery.
      </p>

      {/* Two Column Grid of Difference Points */}
      <div className="grid grid-cols-2 gap-x-12 gap-y-6">
        {DIFFERENCE_POINTS.map((point, index) => (
          <div key={index} className="flex gap-4">
            <div className="flex-shrink-0 w-10 h-10 bg-[#e8f0fe] rounded-full flex items-center justify-center text-[#4285f4] text-lg">
              {point.icon}
            </div>
            <div>
              <h3 className="font-semibold text-gray-800 mb-1">{point.title}</h3>
              <p className="text-sm text-gray-600">{point.description}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Testimonial Section */}
      <div className="mt-12 border-l-4 border-[#4285f4] pl-6 py-2">
        <blockquote className="text-lg italic text-gray-700 mb-2">
          "Scan2Plan delivered exactly what we needed, on time and on budget.
          Their attention to detail and communication throughout the project
          made them a pleasure to work with."
        </blockquote>
        <p className="text-sm text-gray-500">
          — Architecture Firm, Manhattan
        </p>
      </div>

      {/* CTA Section */}
      <div className="mt-8 text-center">
        <p className="text-gray-600 mb-2">
          Ready to experience the Scan2Plan difference?
        </p>
        <p className="text-[#4285f4] font-semibold">
          Contact us today: (518) 362-2403 | admin@scan2plan.io
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
