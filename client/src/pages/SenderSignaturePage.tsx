/**
 * Sender Signature Page - For Scan2Plan representatives to sign proposals
 *
 * Features:
 * - Accessible via unique token link generated for the proposal maker
 * - No authentication required - secured by token
 * - PDF viewer for proposal review before signing
 * - Signature capture with signer details
 * - Must be signed before client can sign
 */

import { useEffect, useState } from "react";
import { useRoute } from "wouter";
import { SignatureCapture } from "@/components/SignatureCapture";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle, AlertCircle, Building2, FileText, Download, Send } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

interface ProposalData {
    id: number;
    projectName: string;
    clientName: string;
    projectAddress: string;
    value: string;
    isSenderSigned: boolean;
    senderSignerName?: string;
    senderSignedAt?: string;
    pdfUrl?: string;
}

export function SenderSignaturePage() {
    const [, params] = useRoute("/sender-sign/:token");
    const token = params?.token;

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [proposal, setProposal] = useState<ProposalData | null>(null);
    const [signed, setSigned] = useState(false);

    useEffect(() => {
        if (!token) {
            setError("Invalid signature link");
            setLoading(false);
            return;
        }

        // Fetch proposal data using sender token
        apiRequest("GET", `/api/sender-sign/${token}`)
            .then(res => res.json())
            .then(data => {
                setProposal(data);
                setLoading(false);
            })
            .catch(err => {
                setError("This signature link is invalid or has expired");
                setLoading(false);
            });
    }, [token]);

    const handleSignatureComplete = async (signatureData: {
        signatureImage: string;
        signerName: string;
        signerEmail: string;
        signerTitle: string;
        signedAt: Date;
    }) => {
        if (!token) return;

        try {
            const response = await apiRequest("POST", `/api/sender-sign/${token}/sign`, signatureData);
            const data = await response.json();

            setSigned(true);
        } catch (error) {
            setError("Failed to save signature. Please try again.");
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-white">
                <div className="text-center">
                    <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-blue-600" />
                    <p className="text-gray-600">Loading proposal...</p>
                </div>
            </div>
        );
    }

    if (error || !proposal) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-white p-4">
                <Card className="max-w-md w-full border-gray-200">
                    <CardHeader>
                        <div className="flex items-center gap-2 text-red-600">
                            <AlertCircle className="w-5 h-5" />
                            <CardTitle className="text-gray-900">Unable to Load Proposal</CardTitle>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <p className="text-gray-600">{error || "Proposal not found"}</p>
                    </CardContent>
                </Card>
            </div>
        );
    }

    // Success state after signing
    if (signed) {
        return (
            <div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: '#ffffff' }}>
                <Card className="max-w-lg w-full shadow-lg" style={{ backgroundColor: '#ffffff', borderColor: '#e5e7eb' }}>
                    <CardHeader>
                        <div className="flex items-center gap-2" style={{ color: '#16a34a' }}>
                            <CheckCircle className="w-6 h-6" />
                            <CardTitle style={{ color: '#111827' }}>Proposal Signed Successfully!</CardTitle>
                        </div>
                        <CardDescription style={{ color: '#4b5563' }}>
                            Your signature has been recorded. The proposal is now ready to be sent to the client for their signature.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="p-4 rounded-lg text-sm space-y-2" style={{ backgroundColor: '#f9fafb', border: '1px solid #e5e7eb' }}>
                            <p style={{ color: '#111827' }}><strong>Project:</strong> {proposal.projectName}</p>
                            <p style={{ color: '#111827' }}><strong>Client:</strong> {proposal.clientName}</p>
                            <p style={{ color: '#111827' }}><strong>Date:</strong> {new Date().toLocaleString()}</p>
                        </div>

                        <Alert className="border-blue-300 bg-blue-50">
                            <Send className="w-4 h-4 text-blue-600" />
                            <AlertDescription className="text-blue-900">
                                <strong>Next Step:</strong> Go to the deal page in the CRM to generate and send the client signature link.
                            </AlertDescription>
                        </Alert>

                        <p className="text-sm text-center" style={{ color: '#4b5563' }}>
                            You can close this window. The proposal will be available in the CRM.
                        </p>
                    </CardContent>
                </Card>
            </div>
        );
    }

    // Already signed state
    if (proposal.isSenderSigned) {
        return (
            <div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: '#ffffff' }}>
                <Card className="max-w-md w-full shadow-lg" style={{ backgroundColor: '#ffffff', borderColor: '#e5e7eb' }}>
                    <CardHeader>
                        <div className="flex items-center gap-2" style={{ color: '#16a34a' }}>
                            <CheckCircle className="w-5 h-5" />
                            <CardTitle style={{ color: '#111827' }}>Proposal Already Signed</CardTitle>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        <p style={{ color: '#4b5563' }}>
                            This proposal has already been signed by a Scan2Plan representative.
                        </p>
                        {proposal.senderSignerName && (
                            <div className="p-3 rounded-lg text-sm" style={{ backgroundColor: '#f9fafb', border: '1px solid #e5e7eb' }}>
                                <p style={{ color: '#111827' }}><strong>Signed by:</strong> {proposal.senderSignerName}</p>
                                {proposal.senderSignedAt && (
                                    <p style={{ color: '#111827' }}><strong>Date:</strong> {new Date(proposal.senderSignedAt).toLocaleString()}</p>
                                )}
                            </div>
                        )}

                        <Alert className="border-blue-300 bg-blue-50">
                            <AlertDescription className="text-blue-900">
                                The proposal is ready to be sent to the client. Generate a client signature link from the deal page.
                            </AlertDescription>
                        </Alert>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-white py-8 px-4">
            <div className="max-w-5xl mx-auto space-y-6">
                {/* Header */}
                <div className="text-center space-y-2">
                    <div className="flex items-center justify-center gap-2 mb-4">
                        <Building2 className="w-8 h-8 text-blue-600" />
                        <h1 className="text-3xl font-bold text-gray-900">Scan2Plan</h1>
                    </div>
                    <h2 className="text-2xl font-semibold text-gray-900">Review & Sign Proposal</h2>
                    <p className="text-gray-600">
                        As the proposal maker, please review the proposal and sign before sending to the client
                    </p>
                </div>

                {/* Proposal Summary */}
                <Card className="border-gray-200 bg-white">
                    <CardHeader className="pb-4">
                        <CardTitle className="flex items-center justify-between text-gray-900">
                            <span>Proposal Details</span>
                            <Badge variant="outline" className="text-lg px-3 py-1 border-gray-300 text-gray-900 bg-white">
                                ${Number(proposal.value).toLocaleString()}
                            </Badge>
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                            <div>
                                <span className="text-gray-500">Project:</span>
                                <p className="font-medium text-gray-900">{proposal.projectName}</p>
                            </div>
                            <div>
                                <span className="text-gray-500">Client:</span>
                                <p className="font-medium text-gray-900">{proposal.clientName}</p>
                            </div>
                            <div>
                                <span className="text-gray-500">Location:</span>
                                <p className="font-medium text-gray-900">{proposal.projectAddress}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* PDF Viewer - Always visible and enlarged */}
                {proposal.pdfUrl && (
                    <Card className="overflow-hidden border-gray-200 bg-white">
                        <CardHeader className="py-3 bg-gray-50 border-b border-gray-200">
                            <div className="flex items-center justify-between">
                                <CardTitle className="text-base flex items-center gap-2 text-gray-900">
                                    <FileText className="w-4 h-4" />
                                    Proposal Document
                                </CardTitle>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => window.open(proposal.pdfUrl, '_blank')}
                                    className="gap-2 border-gray-300 text-gray-900 hover:bg-gray-100"
                                >
                                    <Download className="w-4 h-4" />
                                    Download PDF
                                </Button>
                            </div>
                        </CardHeader>
                        <CardContent className="p-0">
                            <iframe
                                src={proposal.pdfUrl}
                                className="w-full border-0 bg-white"
                                style={{ height: '80vh', minHeight: '600px' }}
                                title="Proposal PDF"
                            />
                        </CardContent>
                    </Card>
                )}

                {/* Important Notice */}
                <Alert className="border-blue-300 bg-blue-50">
                    <AlertDescription className="text-blue-900">
                        <strong>Sender Signature Required:</strong> As the Scan2Plan representative, your signature is required before this proposal can be sent to the client.
                        Your electronic signature will be legally binding.
                    </AlertDescription>
                </Alert>

                {/* Signature Capture */}
                <SignatureCapture
                    onSignatureComplete={handleSignatureComplete}
                    proposalTitle={proposal.projectName}
                    clientName="Scan2Plan, Inc."
                />

                {/* Footer */}
                <div className="text-center text-sm text-gray-500 pt-6 border-t border-gray-200">
                    <p>&copy; {new Date().getFullYear()} Scan2Plan. All rights reserved.</p>
                    <p className="mt-1">
                        Questions? Contact us at{" "}
                        <a href="mailto:admin@scan2plan.io" className="text-blue-600 hover:underline">
                            admin@scan2plan.io
                        </a>{" "}
                        or call (518) 362-2403
                    </p>
                </div>
            </div>
        </div>
    );
}
