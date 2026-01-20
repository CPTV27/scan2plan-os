/**
 * Client Signature Page - Public route for clients to sign proposals
 * 
 * Accessible via unique token link sent to client email
 * No authentication required - secured by token
 */

import { useEffect, useState } from "react";
import { useRoute } from "wouter";
import { SignatureCapture } from "@/components/SignatureCapture";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Loader2, CheckCircle, AlertCircle, Building2 } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

interface ProposalData {
    id: number;
    projectName: string;
    clientName: string;
    projectAddress: string;
    value: string;
    isSigned: boolean;
    signerName?: string;
    signedAt?: string;
}

export function ClientSignaturePage() {
    const [, params] = useRoute("/sign/:token");
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

        // Fetch proposal data using token
        apiRequest("GET", `/api/public/proposals/${token}`)
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
        signedAt: Date;
    }) => {
        if (!token) return;

        try {
            await apiRequest("POST", `/api/public/proposals/${token}/sign`, signatureData);
            setSigned(true);
        } catch (error) {
            setError("Failed to save signature. Please try again.");
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
                <div className="text-center">
                    <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-primary" />
                    <p className="text-muted-foreground">Loading proposal...</p>
                </div>
            </div>
        );
    }

    if (error || !proposal) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 p-4">
                <Card className="max-w-md w-full">
                    <CardHeader>
                        <div className="flex items-center gap-2 text-destructive">
                            <AlertCircle className="w-5 h-5" />
                            <CardTitle>Unable to Load Proposal</CardTitle>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <p className="text-muted-foreground">{error || "Proposal not found"}</p>
                    </CardContent>
                </Card>
            </div>
        );
    }

    if (proposal.isSigned || signed) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 p-4">
                <Card className="max-w-md w-full">
                    <CardHeader>
                        <div className="flex items-center gap-2 text-green-600">
                            <CheckCircle className="w-5 h-5" />
                            <CardTitle>Proposal Already Signed</CardTitle>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        <p className="text-muted-foreground">
                            This proposal has already been signed.
                        </p>
                        {proposal.signerName && (
                            <div className="p-3 bg-muted rounded-lg text-sm">
                                <p><strong>Signed by:</strong> {proposal.signerName}</p>
                                {proposal.signedAt && (
                                    <p><strong>Date:</strong> {new Date(proposal.signedAt).toLocaleString()}</p>
                                )}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 py-12 px-4">
            <div className="max-w-4xl mx-auto space-y-6">
                {/* Header */}
                <div className="text-center space-y-2">
                    <div className="flex items-center justify-center gap-2 mb-4">
                        <Building2 className="w-8 h-8 text-primary" />
                        <h1 className="text-3xl font-bold">Scan2Plan</h1>
                    </div>
                    <h2 className="text-2xl font-semibold text-slate-800">Sign Your Proposal</h2>
                    <p className="text-muted-foreground">
                        Please review and sign the proposal below
                    </p>
                </div>

                {/* Proposal Summary */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center justify-between">
                            <span>Proposal Details</span>
                            <Badge variant="outline">{proposal.value}</Badge>
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                        <div className="grid grid-cols-2 gap-3 text-sm">
                            <div>
                                <span className="text-muted-foreground">Project:</span>
                                <p className="font-medium">{proposal.projectName}</p>
                            </div>
                            <div>
                                <span className="text-muted-foreground">Client:</span>
                                <p className="font-medium">{proposal.clientName}</p>
                            </div>
                            <div className="col-span-2">
                                <span className="text-muted-foreground">Location:</span>
                                <p className="font-medium">{proposal.projectAddress}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Important Notice */}
                <Alert>
                    <AlertDescription>
                        By signing this proposal, you agree to the terms and conditions outlined in the attached documents.
                        Your signature will be legally binding.
                    </AlertDescription>
                </Alert>

                {/* Signature Capture */}
                <SignatureCapture
                    onSignatureComplete={handleSignatureComplete}
                    proposalTitle={proposal.projectName}
                    clientName={proposal.clientName}
                />

                {/* Footer */}
                <div className="text-center text-sm text-muted-foreground pt-6">
                    <p>© {new Date().getFullYear()} Scan2Plan. All rights reserved.</p>
                    <p className="mt-1">Questions? Contact us at support@scan2plan.com</p>
                </div>
            </div>
        </div>
    );
}
