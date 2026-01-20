/**
 * CPQ Import Modal
 * 
 * Modal component for importing JSON exports from the external CPQ.
 * Supports file upload, validation, preview, and import to configurator.
 */

import { useState, useCallback } from "react";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
    Upload,
    FileJson,
    CheckCircle,
    AlertCircle,
    Building2,
    MapPin,
    DollarSign,
    Users,
    TreeDeciduous,
} from "lucide-react";
import {
    parseCpqJsonFile,
    type MappedConfiguratorData,
    type CpqExportData,
} from "./cpqImportUtils";

interface CpqImportModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onImport: (data: MappedConfiguratorData, rawData: CpqExportData) => void;
}

export function CpqImportModal({
    open,
    onOpenChange,
    onImport,
}: CpqImportModalProps) {
    const [isDragging, setIsDragging] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [parsedData, setParsedData] = useState<MappedConfiguratorData | null>(null);
    const [rawData, setRawData] = useState<CpqExportData | null>(null);

    const handleFileSelect = async (file: File) => {
        if (!file.name.endsWith(".json")) {
            setError("Please select a JSON file");
            return;
        }

        setIsLoading(true);
        setError(null);

        const result = await parseCpqJsonFile(file);

        setIsLoading(false);

        if (result.success && result.data && result.rawData) {
            setParsedData(result.data);
            setRawData(result.rawData);
        } else {
            setError(result.error || "Failed to parse file");
        }
    };

    const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        setIsDragging(false);

        const file = e.dataTransfer.files[0];
        if (file) {
            handleFileSelect(file);
        }
    }, []);

    const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        setIsDragging(true);
    }, []);

    const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        setIsDragging(false);
    }, []);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            handleFileSelect(file);
        }
    };

    const handleImport = () => {
        if (parsedData && rawData) {
            onImport(parsedData, rawData);
            handleClose();
        }
    };

    const handleClose = () => {
        setParsedData(null);
        setRawData(null);
        setError(null);
        onOpenChange(false);
    };

    return (
        <Dialog open={open} onOpenChange={handleClose}>
            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <FileJson className="h-5 w-5" />
                        Import Quote from CPQ
                    </DialogTitle>
                    <DialogDescription>
                        Upload a JSON export from the CPQ calculator to pre-populate the configurator.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    {/* File Upload Area */}
                    {!parsedData && (
                        <div
                            onDrop={handleDrop}
                            onDragOver={handleDragOver}
                            onDragLeave={handleDragLeave}
                            className={`
                border-2 border-dashed rounded-lg p-8 text-center transition-colors
                ${isDragging ? "border-primary bg-primary/5" : "border-muted-foreground/25"}
                ${isLoading ? "opacity-50 pointer-events-none" : "cursor-pointer hover:border-primary/50"}
              `}
                        >
                            <input
                                type="file"
                                accept=".json"
                                onChange={handleInputChange}
                                className="hidden"
                                id="cpq-file-input"
                            />
                            <label htmlFor="cpq-file-input" className="cursor-pointer">
                                <Upload className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
                                <p className="text-sm font-medium">
                                    {isLoading ? "Parsing..." : "Drop JSON file here or click to browse"}
                                </p>
                                <p className="text-xs text-muted-foreground mt-1">
                                    Supports quote-*.json exports from CPQ
                                </p>
                            </label>
                        </div>
                    )}

                    {/* Error Display */}
                    {error && (
                        <Alert variant="destructive">
                            <AlertCircle className="h-4 w-4" />
                            <AlertDescription>{error}</AlertDescription>
                        </Alert>
                    )}

                    {/* Preview */}
                    {parsedData && rawData && (
                        <div className="space-y-4">
                            <Alert variant="default" className="border-green-500 bg-green-50 dark:bg-green-950/20">
                                <CheckCircle className="h-4 w-4 text-green-600" />
                                <AlertDescription className="text-green-700 dark:text-green-400">
                                    Successfully parsed CPQ export
                                </AlertDescription>
                            </Alert>

                            <Card>
                                <CardContent className="pt-4 space-y-3">
                                    {/* Project Name */}
                                    <div className="flex items-center gap-2">
                                        <Building2 className="h-4 w-4 text-muted-foreground" />
                                        <span className="font-medium">{parsedData.projectName || "Untitled Project"}</span>
                                    </div>

                                    {/* Client */}
                                    {parsedData.clientName && (
                                        <div className="flex items-center gap-2">
                                            <Users className="h-4 w-4 text-muted-foreground" />
                                            <span>{parsedData.clientName}</span>
                                        </div>
                                    )}

                                    {/* Location */}
                                    {parsedData.projectLocation && (
                                        <div className="flex items-center gap-2">
                                            <MapPin className="h-4 w-4 text-muted-foreground" />
                                            <span className="text-sm">{parsedData.projectLocation}</span>
                                        </div>
                                    )}

                                    {/* Areas */}
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <span className="text-sm text-muted-foreground">Areas:</span>
                                        {parsedData.areas.map((area) => (
                                            <Badge key={area.id} variant="secondary" className="text-xs">
                                                {area.name} ({parseInt(area.squareFeet || "0").toLocaleString()} sqft)
                                            </Badge>
                                        ))}
                                    </div>

                                    {/* Landscape */}
                                    {parsedData.landscape && (
                                        <div className="flex items-center gap-2">
                                            <TreeDeciduous className="h-4 w-4 text-muted-foreground" />
                                            <span className="text-sm">
                                                Landscape: {parsedData.landscape.acres} acre(s) - {parsedData.landscape.type}
                                            </span>
                                        </div>
                                    )}

                                    {/* Original Price */}
                                    {parsedData.originalPricing && (
                                        <div className="flex items-center gap-2">
                                            <DollarSign className="h-4 w-4 text-muted-foreground" />
                                            <span className="font-semibold text-green-600">
                                                Original Total: ${parsedData.originalPricing.totalClientPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                            </span>
                                        </div>
                                    )}

                                    {/* Quote Number */}
                                    {parsedData.quoteNumber && (
                                        <div className="text-xs text-muted-foreground">
                                            Quote #: {parsedData.quoteNumber}
                                        </div>
                                    )}
                                </CardContent>
                            </Card>

                            {/* Change File Button */}
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                    setParsedData(null);
                                    setRawData(null);
                                }}
                            >
                                Choose Different File
                            </Button>
                        </div>
                    )}
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={handleClose}>
                        Cancel
                    </Button>
                    <Button
                        onClick={handleImport}
                        disabled={!parsedData}
                    >
                        <Upload className="h-4 w-4 mr-2" />
                        Import & Configure
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

export default CpqImportModal;
