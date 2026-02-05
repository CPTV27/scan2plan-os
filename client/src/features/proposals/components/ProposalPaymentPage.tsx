/**
 * ProposalPaymentPage Component
 *
 * Page 7 of the proposal - Payment Terms section.
 * Contains payment terms, accepted methods, and acknowledgement.
 */

import { EditableText, EditableList } from "./EditableText";
import type { ProposalPaymentData } from "@shared/schema/types";

interface ProposalPaymentPageProps {
  data: ProposalPaymentData;
  onChange: (field: keyof ProposalPaymentData, value: any) => void;
  onBlur?: () => void;
  disabled?: boolean;
}

export function ProposalPaymentPage({
  data,
  onChange,
  onBlur,
  disabled = false,
}: ProposalPaymentPageProps) {
  return (
    <div className="proposal-page min-h-[11in] p-16 bg-white relative">
      {/* Section Title */}
      <h1 className="text-3xl font-bold text-[#123ea8] mb-8">Payment</h1>

      {/* Payment Terms */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold text-[#123ea8] mb-4">
          Payment Terms
        </h2>
        <EditableList
          items={data.terms}
          onChange={(items) => onChange("terms", items)}
          onBlur={onBlur}
          placeholder="Payment term..."
          disabled={disabled}
          itemClassName="text-[#49494b]"
        />
      </div>

      {/* Payment Methods */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold text-[#123ea8] mb-4">
          Accepted Payment Methods
        </h2>
        <EditableList
          items={data.paymentMethods}
          onChange={(items) => onChange("paymentMethods", items)}
          onBlur={onBlur}
          placeholder="Payment method..."
          disabled={disabled}
          itemClassName="text-[#49494b]"
        />
      </div>

      {/* Acknowledgement Section */}
      <div className="mt-12 border-t border-gray-200 pt-8">
        <h2 className="text-xl font-semibold text-[#123ea8] mb-4">
          Acknowledgement
        </h2>
        <p className="text-[#49494b] mb-6 leading-relaxed">
          Client acknowledges receipt of and agrees to be bound by S2P's{" "}
          <a
            href="https://www.scan2plan.io/scan2plan-terms-conditions"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#123ea8] underline hover:text-[#0f2d7a]"
          >
            General Terms and Conditions
          </a>{" "}
          which are incorporated herein by reference.
        </p>
        <p className="text-[#49494b] mb-6 leading-relaxed">
          In witness whereof the parties hereto have caused this agreement to be
          executed as of the date(s) written below.
        </p>

        {/* Signature Lines */}
        <div className="grid grid-cols-2 gap-8 mt-8">
          <div>
            <div className="border-b border-gray-400 h-10 mb-2"></div>
            <div className="text-sm text-gray-600">Client Signature</div>
          </div>
          <div>
            <div className="border-b border-gray-400 h-10 mb-2"></div>
            <div className="text-sm text-gray-600">Date</div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-8 mt-6">
          <div>
            <div className="border-b border-gray-400 h-10 mb-2"></div>
            <div className="text-sm text-gray-600">Print Name</div>
          </div>
          <div>
            <div className="border-b border-gray-400 h-10 mb-2"></div>
            <div className="text-sm text-gray-600">Title</div>
          </div>
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
