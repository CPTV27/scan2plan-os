/**
 * SignatureCapture - Open-source signature capture component
 *
 * Provides a canvas-based signature pad for capturing client signatures
 * on proposals without requiring PandaDoc subscription.
 * Supports both drawn and typed signatures.
 */

import { useRef, useState, useEffect } from "react";
import SignatureCanvas from "react-signature-canvas";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Check, Eraser, Download, X, Pencil, Type } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface SignatureCaptureProps {
    onSignatureComplete: (signatureData: {
        signatureImage: string;
        signerName: string;
        signerEmail: string;
        signerTitle: string;
        signedAt: Date;
        agreedToTerms: boolean;
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
    const typedCanvas = useRef<HTMLCanvasElement>(null);
    const { toast } = useToast();

    const [signerName, setSignerName] = useState(clientName || "");
    const [signerEmail, setSignerEmail] = useState("");
    const [signerTitle, setSignerTitle] = useState("");
    const [isEmpty, setIsEmpty] = useState(true);
    const [agreedToTerms, setAgreedToTerms] = useState(false);
    const [signatureMode, setSignatureMode] = useState<"draw" | "type">("draw");
    const [typedSignature, setTypedSignature] = useState("");

    // Generate typed signature image on canvas
    useEffect(() => {
        if (signatureMode === "type" && typedCanvas.current && typedSignature) {
            const canvas = typedCanvas.current;
            const ctx = canvas.getContext("2d");
            if (!ctx) return;

            // Clear canvas with transparency (not white)
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            // Draw signature text in cursive style
            ctx.fillStyle = "#1a365d";
            ctx.font = "italic 48px 'Brush Script MT', 'Segoe Script', 'Dancing Script', cursive";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(typedSignature, canvas.width / 2, canvas.height / 2);
        }
    }, [typedSignature, signatureMode]);

    const getTypedSignatureImage = (): string | null => {
        if (!typedCanvas.current || !typedSignature.trim()) return null;
        return typedCanvas.current.toDataURL("image/png");
    };

    const handleClear = () => {
        sigCanvas.current?.clear();
        setIsEmpty(true);
    };

    const handleEnd = () => {
        setIsEmpty(sigCanvas.current?.isEmpty() ?? true);
    };

    const handleSave = () => {
        let signatureImage: string | null = null;

        if (signatureMode === "draw") {
            if (!sigCanvas.current || sigCanvas.current.isEmpty()) {
                toast({
                    title: "Signature required",
                    description: "Please draw your signature before submitting.",
                    variant: "destructive",
                });
                return;
            }
            signatureImage = sigCanvas.current.toDataURL("image/png");
        } else {
            if (!typedSignature.trim()) {
                toast({
                    title: "Signature required",
                    description: "Please type your signature before submitting.",
                    variant: "destructive",
                });
                return;
            }
            signatureImage = getTypedSignatureImage();
        }

        if (!signatureImage) {
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

        if (!signerTitle.trim()) {
            toast({
                title: "Company required",
                description: "Please enter your company name.",
                variant: "destructive",
            });
            return;
        }

        if (!agreedToTerms) {
            toast({
                title: "Agreement required",
                description: "Please agree to the terms and conditions before signing.",
                variant: "destructive",
            });
            return;
        }

        onSignatureComplete({
            signatureImage,
            signerName: signerName.trim(),
            signerEmail: signerEmail.trim(),
            signerTitle: signerTitle.trim(),
            signedAt: new Date(),
            agreedToTerms: true,
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
                    <div className="space-y-2 col-span-2 sm:col-span-1">
                        <Label htmlFor="signerTitle">Company *</Label>
                        <Input
                            id="signerTitle"
                            placeholder="Your company name"
                            value={signerTitle}
                            onChange={(e) => setSignerTitle(e.target.value)}
                        />
                    </div>
                </div>

                <Separator />

                {/* Signature Mode Tabs */}
                <div className="space-y-2">
                    <Label>Signature *</Label>
                    <Tabs value={signatureMode} onValueChange={(v) => setSignatureMode(v as "draw" | "type")}>
                        <TabsList className="grid w-full grid-cols-2">
                            <TabsTrigger value="draw" className="gap-2">
                                <Pencil className="w-4 h-4" />
                                Draw
                            </TabsTrigger>
                            <TabsTrigger value="type" className="gap-2">
                                <Type className="w-4 h-4" />
                                Type
                            </TabsTrigger>
                        </TabsList>

                        <TabsContent value="draw" className="mt-3">
                            <div className="border-2 border-dashed rounded-lg p-1 bg-white">
                                <SignatureCanvas
                                    ref={sigCanvas}
                                    backgroundColor="rgba(255,255,255,0)"
                                    canvasProps={{
                                        className: "w-full h-40 rounded cursor-crosshair",
                                        style: { touchAction: "none" }
                                    }}
                                    onEnd={handleEnd}
                                />
                            </div>
                            <p className="text-xs text-muted-foreground mt-2">
                                Sign above using your mouse, trackpad, or touch screen
                            </p>
                        </TabsContent>

                        <TabsContent value="type" className="mt-3 space-y-3">
                            <Input
                                placeholder="Type your full name as signature"
                                value={typedSignature}
                                onChange={(e) => setTypedSignature(e.target.value)}
                                className="text-lg"
                            />
                            <div className="border-2 border-dashed rounded-lg p-1 bg-white">
                                <canvas
                                    ref={typedCanvas}
                                    width={600}
                                    height={160}
                                    className="w-full h-40 rounded"
                                />
                            </div>
                            <p className="text-xs text-muted-foreground">
                                Your typed name will appear as a signature above
                            </p>
                        </TabsContent>
                    </Tabs>
                </div>

                {/* E-Signature Consent Checkbox - Required for legal compliance */}
                <div className="flex items-start space-x-3 p-4 border border-gray-300 rounded-lg bg-gray-50">
                    <Checkbox
                        id="agreedToTerms"
                        checked={agreedToTerms}
                        onCheckedChange={(checked) => setAgreedToTerms(checked === true)}
                        className="mt-0.5 h-5 w-5 border-2 border-gray-400 data-[state=checked]:border-primary"
                    />
                    <div className="space-y-2">
                        <Label
                            htmlFor="agreedToTerms"
                            className="text-sm font-semibold text-gray-900 cursor-pointer"
                        >
                            I agree to sign this document electronically *
                        </Label>
                        <p className="text-sm text-gray-600 leading-relaxed">
                            By checking this box, I consent to conduct business electronically and agree that my
                            electronic signature is legally binding under the ESIGN Act and UETA. I acknowledge
                            receipt of this proposal and agree to the terms and conditions outlined in the document.
                        </p>
                    </div>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center justify-between pt-4">
                    <div className="flex gap-2">
                        {signatureMode === "draw" && (
                            <>
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
                            </>
                        )}
                        {signatureMode === "type" && (
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setTypedSignature("")}
                                disabled={!typedSignature}
                            >
                                <Eraser className="w-4 h-4 mr-2" />
                                Clear
                            </Button>
                        )}
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
