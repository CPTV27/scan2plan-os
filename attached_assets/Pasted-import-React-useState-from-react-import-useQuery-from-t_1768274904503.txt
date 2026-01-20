import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PotreeViewer } from "./PotreeViewer";
import { Loader2, Download, Box, FileText, Image as ImageIcon } from "lucide-react";

interface DeliveryPortalProps {
    projectId: number;
}

export function DeliveryPortal({ projectId }: DeliveryPortalProps) {
    const [activeTab, setActiveTab] = useState("files");

    // Fetch project details for Potree config
    const { data: project } = useQuery({
        queryKey: ["project", projectId],
        queryFn: async () => {
            const res = await fetch(`/api/storage/projects/${projectId}`);
            return res.json();
        },
    });

    // Fetch file list
    const { data: files, isLoading: isLoadingFiles } = useQuery({
        queryKey: ["delivery-files", projectId],
        queryFn: async () => {
            const res = await fetch(`/api/delivery/files/${projectId}`);
            if (!res.ok) throw new Error("Failed to fetch files");
            return res.json();
        },
        enabled: !!projectId,
    });

    // Helper to get icon
    const getFileIcon = (name: string) => {
        if (name.endsWith(".pdf")) return <FileText className="h-5 w-5 text-red-500" />;
        if (name.endsWith(".jpg") || name.endsWith(".png")) return <ImageIcon className="h-5 w-5 text-blue-500" />;
        return <Box className="h-5 w-5 text-gray-500" />;
    };

    const handleDownload = async (filePath: string) => {
        try {
            const res = await fetch("/api/delivery/sign-read", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ filePath })
            });
            const { url } = await res.json();
            window.open(url, "_blank");
        } catch (err) {
            console.error("Download failed", err);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight">Client Delivery Portal</h2>
                    <p className="text-muted-foreground">Access your final deliverables and 3D models.</p>
                </div>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
                <TabsList>
                    <TabsTrigger value="files" className="flex items-center gap-2"><FileText className="h-4 w-4" /> Files & Docs</TabsTrigger>
                    <TabsTrigger value="3d-model" className="flex items-center gap-2"><Box className="h-4 w-4" /> 3D Model Viewer</TabsTrigger>
                </TabsList>

                <TabsContent value="files">
                    <Card>
                        <CardHeader>
                            <CardTitle>Project Files</CardTitle>
                            <CardDescription>Download PDFs, CAD drawings, and other assets.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            {isLoadingFiles ? (
                                <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin" /></div>
                            ) : (
                                <div className="divide-y">
                                    {files?.files?.map((fileName: string) => (
                                        <div key={fileName} className="flex items-center justify-between py-4">
                                            <div className="flex items-center gap-3">
                                                {getFileIcon(fileName)}
                                                <span className="font-medium text-sm">{fileName.split('/').pop()}</span>
                                            </div>
                                            <Button variant="ghost" size="sm" onClick={() => handleDownload(fileName)}>
                                                <Download className="h-4 w-4 mr-2" /> Download
                                            </Button>
                                        </div>
                                    ))}
                                    {files?.files?.length === 0 && (
                                        <p className="text-center py-8 text-muted-foreground">No files delivered yet.</p>
                                    )}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="3d-model">
                    <Card>
                        <CardContent className="p-0 overflow-hidden rounded-lg">
                            {project?.potreePath ? (
                                <PotreeViewer cloudUrl={project.viewerUrl || project.potreePath} />
                            ) : (
                                <div className="flex flex-col items-center justify-center h-[400px] bg-slate-50">
                                    <Box className="h-12 w-12 text-gray-300 mb-4" />
                                    <p className="text-gray-500 font-medium">3D Model not yet available</p>
                                    <p className="text-gray-400 text-sm">Our team is still processing your scan data.</p>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}
