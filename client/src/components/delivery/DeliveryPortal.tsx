import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { PotreeViewer } from "./PotreeViewer";
import { Loader2, Download, Box, FileText, Image as ImageIcon, Upload, CheckCircle, Clock, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface DeliveryPortalProps {
  projectId: number;
  universalProjectId?: string;
}

export function DeliveryPortal({ projectId, universalProjectId }: DeliveryPortalProps) {
  const [activeTab, setActiveTab] = useState("files");
  const [potreePathInput, setPotreePathInput] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: deliveryData, isLoading } = useQuery({
    queryKey: ["/api/delivery/files", projectId],
    queryFn: async () => {
      const res = await fetch(`/api/delivery/files/${projectId}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch delivery files");
      return res.json();
    },
    enabled: !!projectId,
  });

  const savePotreeConfig = useMutation({
    mutationFn: async (potreePath: string) => {
      const res = await apiRequest("POST", "/api/delivery/potree/config", { projectId, potreePath });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Potree path saved", description: "The 3D viewer URL has been configured." });
      queryClient.invalidateQueries({ queryKey: ["/api/delivery/files", projectId] });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to save Potree configuration", variant: "destructive" });
    },
  });

  const getFileIcon = (name: string) => {
    const lower = name.toLowerCase();
    if (lower.endsWith(".pdf")) return <FileText className="h-5 w-5 text-red-500" />;
    if (lower.endsWith(".jpg") || lower.endsWith(".png") || lower.endsWith(".jpeg")) 
      return <ImageIcon className="h-5 w-5 text-blue-500" />;
    if (lower.endsWith(".dwg") || lower.endsWith(".rvt") || lower.endsWith(".ifc"))
      return <Box className="h-5 w-5 text-orange-500" />;
    return <FileText className="h-5 w-5 text-gray-500" />;
  };

  const handleDownload = async (filePath: string) => {
    try {
      const res = await apiRequest("POST", "/api/delivery/sign-read", { filePath });
      const { url } = await res.json();
      window.open(url, "_blank");
    } catch (err) {
      toast({ title: "Download failed", description: "Could not generate download link", variant: "destructive" });
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "ready":
        return <Badge variant="default" className="bg-green-600"><CheckCircle className="h-3 w-3 mr-1" /> Ready</Badge>;
      case "processing":
        return <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" /> Processing</Badge>;
      case "failed":
        return <Badge variant="destructive"><AlertTriangle className="h-3 w-3 mr-1" /> Failed</Badge>;
      default:
        return <Badge variant="outline"><Clock className="h-3 w-3 mr-1" /> Pending</Badge>;
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Client Delivery Portal</h2>
          <p className="text-muted-foreground">Access final deliverables and 3D models.</p>
        </div>
        {deliveryData?.deliveryStatus && getStatusBadge(deliveryData.deliveryStatus)}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="files" className="flex items-center gap-2" data-testid="tab-files">
            <FileText className="h-4 w-4" /> Files & Docs
          </TabsTrigger>
          <TabsTrigger value="3d-model" className="flex items-center gap-2" data-testid="tab-3d-model">
            <Box className="h-4 w-4" /> 3D Model Viewer
          </TabsTrigger>
          <TabsTrigger value="config" className="flex items-center gap-2" data-testid="tab-config">
            <Upload className="h-4 w-4" /> Configuration
          </TabsTrigger>
        </TabsList>

        <TabsContent value="files">
          <Card>
            <CardHeader>
              <CardTitle>Project Files</CardTitle>
              <CardDescription>Download PDFs, CAD drawings, and other assets.</CardDescription>
            </CardHeader>
            <CardContent>
              {deliveryData?.files?.length > 0 ? (
                <div className="divide-y">
                  {deliveryData.files.map((fileName: string) => (
                    <div key={fileName} className="flex items-center justify-between py-4" data-testid={`file-row-${fileName}`}>
                      <div className="flex items-center gap-3">
                        {getFileIcon(fileName)}
                        <span className="font-medium text-sm">{fileName.split("/").pop()}</span>
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => handleDownload(fileName)} data-testid={`button-download-${fileName}`}>
                        <Download className="h-4 w-4 mr-2" /> Download
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <FileText className="h-12 w-12 text-muted-foreground/50 mb-4" />
                  <p className="text-muted-foreground font-medium">No files delivered yet</p>
                  <p className="text-muted-foreground text-sm mt-1">
                    Files will appear here once the production team uploads deliverables.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="3d-model">
          <Card>
            <CardContent className="p-0 overflow-hidden rounded-lg">
              {deliveryData?.potreePath ? (
                <PotreeViewer 
                  cloudUrl={`/api/delivery/potree/proxy/${projectId}/metadata.json`} 
                  height="500px" 
                />
              ) : (
                <div className="flex flex-col items-center justify-center h-[400px] bg-muted/30">
                  <Box className="h-12 w-12 text-muted-foreground/50 mb-4" />
                  <p className="text-muted-foreground font-medium">3D Model not yet available</p>
                  <p className="text-muted-foreground text-sm mt-1">
                    Our team is still processing your scan data.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="config">
          <Card>
            <CardHeader>
              <CardTitle>Potree Configuration</CardTitle>
              <CardDescription>
                Configure the GCS path to the Potree-converted point cloud data.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="potree-path">Potree GCS Path</Label>
                <div className="flex gap-2">
                  <Input
                    id="potree-path"
                    placeholder={`${universalProjectId || "project-" + projectId}/potree`}
                    value={potreePathInput || deliveryData?.potreePath || ""}
                    onChange={(e) => setPotreePathInput(e.target.value)}
                    data-testid="input-potree-path"
                  />
                  <Button
                    onClick={() => savePotreeConfig.mutate(potreePathInput)}
                    disabled={!potreePathInput || savePotreeConfig.isPending}
                    data-testid="button-save-potree"
                  >
                    {savePotreeConfig.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Path to the Potree folder in GCS (e.g., {universalProjectId || "UPID"}/potree)
                </p>
                <p className="text-xs text-amber-600">
                  Note: The GCS bucket must have public read access enabled for the Potree viewer to work.
                </p>
              </div>

              {deliveryData?.potreePath && (
                <div className="rounded-lg bg-muted p-4">
                  <p className="text-sm font-medium">Current Configuration</p>
                  <p className="text-xs text-muted-foreground mt-1">Path: {deliveryData.potreePath}</p>
                  {deliveryData.viewerUrl && (
                    <p className="text-xs text-green-600 mt-1">Viewer URL configured</p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
