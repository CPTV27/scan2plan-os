import { useState, useCallback } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { FileText, Upload, Loader2, Check, X, AlertTriangle, Building2, DollarSign, MapPin, User, Mail, Phone } from "lucide-react";

interface ExtractedDeal {
  clientName: string;
  projectName: string | null;
  projectAddress: string | null;
  value: number;
  buildingType: string | null;
  sqft: number | null;
  scope: string | null;
  disciplines: string | null;
  bimDeliverable: string | null;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  notes: string | null;
  sourceFile: string;
  rawTextPreview: string;
  unmappedFields: { field: string; value: string }[];
  selected?: boolean;
}

interface PDFImportDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PDFImportDrawer({ open, onOpenChange }: PDFImportDrawerProps) {
  const { toast } = useToast();
  const [files, setFiles] = useState<File[]>([]);
  const [extractedDeals, setExtractedDeals] = useState<ExtractedDeal[]>([]);
  const [isExtracting, setIsExtracting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [step, setStep] = useState<"upload" | "review" | "complete">("upload");
  const [importResults, setImportResults] = useState<{ imported: number; errors: number } | null>(null);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []).filter(
      file => file.type === "application/pdf"
    );
    setFiles(prev => [...prev, ...selectedFiles]);
  }, []);

  const removeFile = useCallback((index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  }, []);

  const handleExtract = async () => {
    if (files.length === 0) return;

    setIsExtracting(true);
    try {
      const formData = new FormData();
      files.forEach(file => formData.append("pdfs", file));

      const response = await fetch("/api/pdf/extract", {
        method: "POST",
        body: formData,
        credentials: "include"
      });

      if (!response.ok) {
        throw new Error("Failed to extract PDF data");
      }

      const result = await response.json();
      const dealsWithSelection = result.deals.map((deal: ExtractedDeal) => ({
        ...deal,
        selected: true
      }));
      setExtractedDeals(dealsWithSelection);

      if (result.errors.length > 0) {
        toast({
          title: "Some PDFs failed to process",
          description: `${result.errorCount} of ${result.totalProcessed} files had errors`,
          variant: "destructive"
        });
      }

      setStep("review");
    } catch (error: any) {
      toast({
        title: "Extraction failed",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setIsExtracting(false);
    }
  };

  const toggleDealSelection = (index: number) => {
    setExtractedDeals(prev =>
      prev.map((deal, i) =>
        i === index ? { ...deal, selected: !deal.selected } : deal
      )
    );
  };

  const handleImport = async () => {
    const selectedDeals = extractedDeals.filter(deal => deal.selected);
    if (selectedDeals.length === 0) {
      toast({
        title: "No deals selected",
        description: "Please select at least one deal to import",
        variant: "destructive"
      });
      return;
    }

    setIsImporting(true);
    try {
      const res = await fetch("/api/pdf/import", {
        method: "POST",
        body: JSON.stringify({ deals: selectedDeals }),
        headers: { "Content-Type": "application/json" },
        credentials: "include"
      });

      if (!res.ok) {
        throw new Error("Failed to import deals");
      }

      const response = await res.json();

      setImportResults({
        imported: response.totalImported,
        errors: response.errorCount
      });

      queryClient.invalidateQueries({ queryKey: ["/api/leads"] });

      toast({
        title: "Import complete",
        description: `Successfully imported ${response.totalImported} deals`
      });

      setStep("complete");
    } catch (error: any) {
      toast({
        title: "Import failed",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setIsImporting(false);
    }
  };

  const resetDrawer = () => {
    setFiles([]);
    setExtractedDeals([]);
    setStep("upload");
    setImportResults(null);
  };

  const handleClose = () => {
    resetDrawer();
    onOpenChange(false);
  };

  const allUnmappedFields = extractedDeals.flatMap(deal =>
    deal.unmappedFields.map(f => ({ ...f, source: deal.sourceFile }))
  );

  return (
    <Sheet open={open} onOpenChange={handleClose}>
      <SheetContent side="right" className="w-full sm:max-w-2xl overflow-hidden flex flex-col">
        <SheetHeader className="flex-shrink-0">
          <SheetTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Import Proposals from PDFs
          </SheetTitle>
          <SheetDescription>
            Upload PandaDoc proposals to automatically extract deal information
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-hidden">
          {step === "upload" && (
            <div className="space-y-4 p-4">
              <div
                className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-8 text-center hover:border-primary/50 transition-colors cursor-pointer"
                onClick={() => document.getElementById("pdf-upload")?.click()}
                data-testid="dropzone-pdf-upload"
              >
                <Upload className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
                <p className="text-sm text-muted-foreground mb-2">
                  Click to upload or drag and drop
                </p>
                <p className="text-xs text-muted-foreground">
                  PDF files only (up to 20 files)
                </p>
                <Input
                  id="pdf-upload"
                  type="file"
                  accept="application/pdf"
                  multiple
                  className="hidden"
                  onChange={handleFileChange}
                  data-testid="input-pdf-files"
                />
              </div>

              {files.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium">{files.length} file(s) selected</p>
                  <ScrollArea className="h-48">
                    <div className="space-y-2">
                      {files.map((file, index) => (
                        <div
                          key={index}
                          className="flex items-center justify-between p-2 bg-muted rounded-md"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <FileText className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                            <span className="text-sm truncate">{file.name}</span>
                          </div>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => removeFile(index)}
                            data-testid={`button-remove-file-${index}`}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              )}

              <Button
                className="w-full"
                disabled={files.length === 0 || isExtracting}
                onClick={handleExtract}
                data-testid="button-extract-pdfs"
              >
                {isExtracting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Extracting data...
                  </>
                ) : (
                  <>
                    <FileText className="h-4 w-4 mr-2" />
                    Extract Deal Data
                  </>
                )}
              </Button>
            </div>
          )}

          {step === "review" && (
            <div className="flex flex-col h-full">
              <ScrollArea className="flex-1">
                <div className="space-y-4 p-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium">
                      {extractedDeals.length} deals extracted
                    </p>
                    <Badge variant="secondary">
                      {extractedDeals.filter(d => d.selected).length} selected
                    </Badge>
                  </div>

                  {extractedDeals.map((deal, index) => (
                    <Card
                      key={index}
                      className={`transition-opacity ${!deal.selected ? "opacity-50" : ""}`}
                      data-testid={`card-extracted-deal-${index}`}
                    >
                      <CardHeader className="flex flex-row items-start gap-3 pb-2">
                        <Checkbox
                          checked={deal.selected}
                          onCheckedChange={() => toggleDealSelection(index)}
                          className="mt-1"
                          data-testid={`checkbox-deal-${index}`}
                        />
                        <div className="flex-1 min-w-0">
                          <CardTitle className="text-base">{deal.clientName}</CardTitle>
                          <p className="text-xs text-muted-foreground truncate">
                            {deal.sourceFile}
                          </p>
                        </div>
                        {deal.value > 0 && (
                          <Badge className="flex-shrink-0">
                            <DollarSign className="h-3 w-3 mr-1" />
                            {deal.value.toLocaleString()}
                          </Badge>
                        )}
                      </CardHeader>
                      <CardContent className="space-y-2">
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          {deal.projectName && (
                            <div className="flex items-center gap-1 text-muted-foreground">
                              <Building2 className="h-3 w-3" />
                              <span className="truncate">{deal.projectName}</span>
                            </div>
                          )}
                          {deal.projectAddress && (
                            <div className="flex items-center gap-1 text-muted-foreground">
                              <MapPin className="h-3 w-3" />
                              <span className="truncate">{deal.projectAddress}</span>
                            </div>
                          )}
                          {deal.contactName && (
                            <div className="flex items-center gap-1 text-muted-foreground">
                              <User className="h-3 w-3" />
                              <span className="truncate">{deal.contactName}</span>
                            </div>
                          )}
                          {deal.contactEmail && (
                            <div className="flex items-center gap-1 text-muted-foreground">
                              <Mail className="h-3 w-3" />
                              <span className="truncate">{deal.contactEmail}</span>
                            </div>
                          )}
                        </div>

                        {deal.buildingType && (
                          <div className="flex flex-wrap gap-1">
                            <Badge variant="outline" className="text-xs">
                              {deal.buildingType}
                            </Badge>
                            {deal.sqft && (
                              <Badge variant="outline" className="text-xs">
                                {deal.sqft.toLocaleString()} sqft
                              </Badge>
                            )}
                            {deal.scope && (
                              <Badge variant="outline" className="text-xs">
                                {deal.scope}
                              </Badge>
                            )}
                          </div>
                        )}

                        {deal.unmappedFields.length > 0 && (
                          <div className="pt-2 border-t">
                            <p className="text-xs font-medium text-amber-600 dark:text-amber-400 flex items-center gap-1 mb-1">
                              <AlertTriangle className="h-3 w-3" />
                              Fields not in CRM schema:
                            </p>
                            <div className="flex flex-wrap gap-1">
                              {deal.unmappedFields.slice(0, 3).map((field, fi) => (
                                <Badge key={fi} variant="secondary" className="text-xs">
                                  {field.field}
                                </Badge>
                              ))}
                              {deal.unmappedFields.length > 3 && (
                                <Badge variant="secondary" className="text-xs">
                                  +{deal.unmappedFields.length - 3} more
                                </Badge>
                              )}
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}

                  {allUnmappedFields.length > 0 && (
                    <Card className="border-amber-500/50 bg-amber-500/5">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2 text-amber-600 dark:text-amber-400">
                          <AlertTriangle className="h-4 w-4" />
                          Schema Enhancement Opportunities
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-xs text-muted-foreground mb-2">
                          These fields from your proposals are not yet in the CRM:
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {Array.from(new Set(allUnmappedFields.map(f => f.field))).map((field, i) => (
                            <Badge key={i} variant="outline" className="text-xs">
                              {field}
                            </Badge>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </div>
              </ScrollArea>

              <div className="flex-shrink-0 p-4 border-t flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => setStep("upload")}
                  data-testid="button-back-to-upload"
                >
                  Back
                </Button>
                <Button
                  className="flex-1"
                  disabled={extractedDeals.filter(d => d.selected).length === 0 || isImporting}
                  onClick={handleImport}
                  data-testid="button-import-deals"
                >
                  {isImporting ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Importing...
                    </>
                  ) : (
                    <>
                      <Check className="h-4 w-4 mr-2" />
                      Import {extractedDeals.filter(d => d.selected).length} Deals
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}

          {step === "complete" && (
            <div className="flex flex-col items-center justify-center h-full p-8 text-center">
              <div className="h-16 w-16 rounded-full bg-green-500/10 flex items-center justify-center mb-4">
                <Check className="h-8 w-8 text-green-500" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Import Complete</h3>
              <p className="text-muted-foreground mb-4">
                Successfully imported {importResults?.imported || 0} deals into your CRM
              </p>
              {importResults?.errors && importResults.errors > 0 && (
                <Badge variant="destructive" className="mb-4">
                  {importResults.errors} errors occurred
                </Badge>
              )}
              <div className="flex gap-2">
                <Button variant="outline" onClick={resetDrawer} data-testid="button-import-more">
                  Import More
                </Button>
                <Button onClick={handleClose} data-testid="button-close-import">
                  Done
                </Button>
              </div>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
