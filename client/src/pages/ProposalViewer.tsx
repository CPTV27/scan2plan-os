import { useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { FileText, Download, Calendar, Mail, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Proposal3DViewer } from "@/features/proposals/components/Proposal3DViewer";

interface ProposalData {
  lead: {
    id: number;
    clientName: string;
    projectName: string;
    projectAddress: string;
    contactName: string | null;
  };
  quote: {
    id: number;
    quoteNumber: string;
    totalPrice: string;
    createdAt: string;
    paymentTerms: string | null;
    areas: any[];
    pricingBreakdown: any;
  } | null;
  sentAt: string;
  recipientEmail: string;
  recipientName: string | null;
  has3DModel?: boolean;
}

const PAYMENT_TERMS_NAMES: Record<string, string> = {
  "standard": "Net 30",
  "net_15": "Net 15",
  "net_45": "Net 45",
  "50_50": "50% Upfront / 50% on Completion",
  "30_30_40": "30% Upfront / 30% Midpoint / 40% Completion",
  "100_upfront": "100% Upfront",
  "on_completion": "Due on Completion",
};

function formatCurrency(amount: number | string): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(num);
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export default function ProposalViewer() {
  const { token } = useParams<{ token: string }>();

  const { data: proposal, isLoading, error } = useQuery<ProposalData>({
    queryKey: ['/api/proposals', token],
    enabled: !!token,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center">
        <div className="animate-pulse text-white/60">Loading proposal...</div>
      </div>
    );
  }

  if (error || !proposal) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center">
        <Card className="max-w-md mx-4">
          <CardContent className="p-8 text-center">
            <FileText className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
            <h2 className="text-xl font-semibold mb-2">Proposal Not Found</h2>
            <p className="text-muted-foreground">
              This proposal link may have expired or is no longer available.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { lead, quote } = proposal;
  const totalPrice = quote?.totalPrice ? formatCurrency(quote.totalPrice) : null;
  const paymentTermsDisplay = quote?.paymentTerms
    ? PAYMENT_TERMS_NAMES[quote.paymentTerms] || quote.paymentTerms
    : null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800">
      <div className="bg-gradient-to-r from-slate-900 to-blue-900 text-white py-12 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-3 mb-2">
            <div className="bg-white/10 backdrop-blur p-2 rounded-lg">
              <FileText className="w-6 h-6" />
            </div>
            <span className="text-white/60 text-sm uppercase tracking-wider">Proposal</span>
          </div>
          <h1 className="text-3xl font-bold mb-2">{lead.projectName}</h1>
          <p className="text-white/70 flex items-center gap-2">
            <Building2 className="w-4 h-4" />
            {lead.clientName}
          </p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 -mt-6">
        <Card className="shadow-xl">
          <CardContent className="p-0">
            <div className="bg-primary text-primary-foreground p-6 rounded-t-lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm opacity-80">Total Investment</p>
                  <p className="text-4xl font-bold">{totalPrice || 'Contact for pricing'}</p>
                </div>
                <Button
                  variant="secondary"
                  size="lg"
                  asChild
                  data-testid="button-download-pdf"
                >
                  <a href={`/api/proposals/${token}/pdf`} target="_blank" rel="noopener noreferrer">
                    <Download className="w-4 h-4 mr-2" />
                    Download PDF
                  </a>
                </Button>
              </div>
            </div>

            <div className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground mb-1">Project Address</h3>
                  <p className="font-medium">{lead.projectAddress || 'Not specified'}</p>
                </div>
                {quote?.quoteNumber && (
                  <div>
                    <h3 className="text-sm font-medium text-muted-foreground mb-1">Quote Number</h3>
                    <p className="font-medium">{quote.quoteNumber}</p>
                  </div>
                )}
                {quote?.createdAt && (
                  <div>
                    <h3 className="text-sm font-medium text-muted-foreground mb-1">Date</h3>
                    <p className="font-medium flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-muted-foreground" />
                      {formatDate(quote.createdAt)}
                    </p>
                  </div>
                )}
                {paymentTermsDisplay && (
                  <div>
                    <h3 className="text-sm font-medium text-muted-foreground mb-1">Payment Terms</h3>
                    <p className="font-medium">{paymentTermsDisplay}</p>
                  </div>
                )}
              </div>

              {proposal.has3DModel && token && (
                <>
                  <Separator />
                  <div>
                    <h3 className="text-lg font-semibold mb-3">Interactive 3D Model</h3>
                    <Proposal3DViewer token={token} height="400px" />
                  </div>
                </>
              )}

              <Separator />

              <div className="bg-muted/30 rounded-lg p-6 text-center">
                <h3 className="text-lg font-semibold mb-2">Ready to Proceed?</h3>
                <p className="text-muted-foreground mb-4">
                  Contact us to discuss your project or approve this proposal.
                </p>
                <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                  <Button variant="outline" asChild data-testid="button-email-contact">
                    <a href="mailto:admin@scan2plan.io">
                      <Mail className="w-4 h-4 mr-2" />
                      Email Us
                    </a>
                  </Button>
                  <Button variant="outline" asChild data-testid="button-call-contact">
                    <a href="tel:+15183622403">
                      Call (518) 362-2403
                    </a>
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="text-center py-8 text-white/40 text-sm">
          <p>SCAN2PLAN | Laser Scanning & BIM Documentation</p>
          <p>Troy, NY | admin@scan2plan.io</p>
        </div>
      </div>
    </div>
  );
}
