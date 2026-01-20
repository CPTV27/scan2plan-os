/**
 * SignatureCapture - Open-source signature capture component
 * 
 * Provides a canvas-based signature pad for capturing client signatures
 * on proposals without requiring PandaDoc subscription.
 */

import { useRef, useState } from "react";
import SignatureCanvas from "react-signature-canvas";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Check, Eraser, Download, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface SignatureCaptureProps {
    onSignatureComplete: (signatureData: {
        signatureImage: string;
        signerName: string;
        signerEmail: string;
        signedAt: Date;
    }) => void;
    onCancel?: () => void;
    proposalTitle?: string;
    clientName?: string;
}

export function SignatureCapture({
    onSignatureComplete,
    onCancel,
    proposalTitle,
    clientName,
}: SignatureCaptureProps) {
    const sigCanvas = useRef<SignatureCanvas>(null);
    const { toast } = useToast();

    const [signerName, setSignerName] = useState(clientName || "");
    const [signerEmail, setSignerEmail] = useState("");
    const [isEmpty, setIsEmpty] = useState(true);

    const handleClear = () => {
        sigCanvas.current?.clear();
        setIsEmpty(true);
    };

    const handleEnd = () => {
        setIsEmpty(sigCanvas.current?.isEmpty() ?? true);
    };

    const handleSave = () => {
        if (!sigCanvas.current || sigCanvas.current.isEmpty()) {
            toast({
                title: "Signature required",
                description: "Please provide a signature before submitting.",
                variant: "destructive",
            });
            return;
        }

        if (!signerName.trim()) {
            toast({
                title: "Name required",
                description: "Please enter the signer's name.",
                variant: "destructive",
            });
            return;
        }

        if (!signerEmail.trim()) {
            toast({
                title: "Email required",
                description: "Please enter the signer's email address.",
                variant: "destructive",
            });
            return;
        }

        const signatureImage = sigCanvas.current.toDataURL("image/png");

        onSignatureComplete({
            signatureImage,
            signerName: signerName.trim(),
            signerEmail: signerEmail.trim(),
            signedAt: new Date(),
        });

        toast({
            title: "Signature captured",
            description: "The proposal has been signed successfully.",
        });
    };

    const handleDownload = () => {
        if (!sigCanvas.current || sigCanvas.current.isEmpty()) {
            toast({
                title: "No signature",
                description: "Please provide a signature first.",
                variant: "destructive",
            });
            return;
        }

        const dataURL = sigCanvas.current.toDataURL("image/png");
        const link = document.createElement("a");
        link.download = `signature-${Date.now()}.png`;
        link.href = dataURL;
        link.click();
    };

    return (
        <Card className="w-full max-w-2xl mx-auto">
            <CardHeader>
                <CardTitle>Sign Proposal</CardTitle>
                <CardDescription>
                    {proposalTitle ? `Please sign to accept: ${proposalTitle}` : "Please sign below to accept this proposal"}
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                {/* Signer Information */}
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label htmlFor="signerName">Full Name *</Label>
                        <Input
                            id="signerName"
                            placeholder="John Doe"
                            value={signerName}
                            onChange={(e) => setSignerName(e.target.value)}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="signerEmail">Email Address *</Label>
                        <Input
                            id="signerEmail"
                            type="email"
                            placeholder="john@example.com"
                            value={signerEmail}
                            onChange={(e) => setSignerEmail(e.target.value)}
                        />
                    </div>
                </div>

                <Separator />

                {/* Signature Canvas */}
                <div className="space-y-2">
                    <Label>Signature *</Label>
                    <div className="border-2 border-dashed rounded-lg p-1 bg-white">
                        <SignatureCanvas
                            ref={sigCanvas}
                            canvasProps={{
                                className: "w-full h-40 rounded cursor-crosshair",
                                style: { touchAction: "none" }
                            }}
                            onEnd={handleEnd}
                        />
                    </div>
                    <p className="text-xs text-muted-foreground">
                        Sign above using your mouse, trackpad, or touch screen
                    </p>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center justify-between pt-4">
                    <div className="flex gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handleClear}
                            disabled={isEmpty}
                        >
                            <Eraser className="w-4 h-4 mr-2" />
                            Clear
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handleDownload}
                            disabled={isEmpty}
                        >
                            <Download className="w-4 h-4 mr-2" />
                            Download
                        </Button>
                    </div>
                    <div className="flex gap-2">
                        {onCancel && (
                            <Button variant="outline" onClick={onCancel}>
                                <X className="w-4 h-4 mr-2" />
                                Cancel
                            </Button>
                        )}
                        <Button onClick={handleSave}>
                            <Check className="w-4 h-4 mr-2" />
                            Sign & Submit
                        </Button>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
