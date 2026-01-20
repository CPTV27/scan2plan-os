import { useEffect, useRef, useState } from "react";
import { Loader2, AlertCircle, Box } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Proposal3DViewerProps {
    token: string;
    height?: string;
}

declare global {
    interface Window {
        Potree: any;
        THREE: any;
    }
}

export function Proposal3DViewer({ token, height = "600px" }: Proposal3DViewerProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const [loading, setLoading] = useState(false); // Start false, user initiates load
    const [active, setActive] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const viewerRef = useRef<any>(null);

    const cloudUrl = `/api/proposals/public/${token}/potree/metadata.json`;

    useEffect(() => {
        if (!active) return;

        let mounted = true;
        setLoading(true);

        async function loadPotree() {
            try {
                if (!window.Potree) {
                    await loadScript("https://cdn.jsdelivr.net/npm/potree-core@1.6.0/build/potree.min.js");
                }

                if (!mounted || !containerRef.current) return;

                // Cleanup previous viewer if any
                if (containerRef.current.innerHTML !== "") {
                    containerRef.current.innerHTML = "";
                }

                const viewer = new window.Potree.Viewer(containerRef.current);
                viewerRef.current = viewer;

                viewer.setEDLEnabled(true);
                viewer.setFOV(60);
                viewer.setPointBudget(1_000_000);
                viewer.loadSettingsFromURL();
                viewer.setBackground("gradient");
                viewer.setDescription("");

                window.Potree.loadPointCloud(cloudUrl, "pointcloud", (e: any) => {
                    if (!mounted) return;

                    const pointcloud = e.pointcloud;
                    const material = pointcloud.material;

                    material.size = 1;
                    material.pointSizeType = window.Potree.PointSizeType.ADAPTIVE;
                    material.shape = window.Potree.PointShape.SQUARE;

                    viewer.scene.addPointCloud(pointcloud);
                    viewer.fitToScreen();
                    setLoading(false);
                });
            } catch (err) {
                if (mounted) {
                    console.error("Potree load error:", err);
                    // Fallback to older version if 1.6.0 fails or try different URL logic
                    setError("Could not load 3D Model. It may not be ready yet.");
                    setLoading(false);
                }
            }
        }

        loadPotree();

        return () => {
            mounted = false;
            // Cleanup
            if (viewerRef.current) {
                // Potree doesn't have a clean destroy method in all versions, but we can try
                try {
                    viewerRef.current = null;
                } catch (e) { }
            }
        };
    }, [active, cloudUrl]);

    if (error) {
        return (
            <div
                className="flex flex-col items-center justify-center bg-muted/50 rounded-lg border border-dashed"
                style={{ height }}
            >
                <AlertCircle className="h-10 w-10 text-muted-foreground mb-4" />
                <p className="text-muted-foreground font-medium">3D Model Unavailable</p>
                <p className="text-xs text-muted-foreground mt-1">{error}</p>
            </div>
        );
    }

    if (!active) {
        return (
            <div
                className="flex flex-col items-center justify-center bg-black/5 rounded-lg border border-dashed hover:bg-black/10 transition-colors cursor-pointer group"
                style={{ height }}
                onClick={() => setActive(true)}
            >
                <div className="h-16 w-16 bg-primary/10 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform mb-4">
                    <Box className="h-8 w-8 text-primary" />
                </div>
                <h3 className="font-semibold text-lg text-foreground">Interactive 3D Model</h3>
                <p className="text-sm text-muted-foreground mt-2 max-w-xs text-center">
                    Click to load the interactive point cloud viewer. (Requires WebGL)
                </p>
                <Button variant="outline" className="mt-6 pointer-events-none">
                    Load 3D Viewer
                </Button>
            </div>
        );
    }

    return (
        <div className="relative rounded-lg overflow-hidden border bg-background" style={{ height }}>
            {loading && (
                <div className="absolute inset-0 flex items-center justify-center bg-background/80 z-20">
                    <div className="flex flex-col items-center">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        <p className="text-sm text-muted-foreground mt-2">Loading Point Cloud...</p>
                    </div>
                </div>
            )}
            <div
                ref={containerRef}
                className="w-full h-full"
                style={{ height }}
            />
            <div className="absolute bottom-4 right-4 z-10 bg-background/80 backdrop-blur px-2 py-1 rounded text-[10px] text-muted-foreground">
                Powered by Potree
            </div>
        </div>
    );
}

// Reuse loadScript helper
const loadedScripts = new Set<string>();
function loadScript(src: string): Promise<void> {
    if (loadedScripts.has(src)) return Promise.resolve();

    return new Promise((resolve, reject) => {
        const existing = document.querySelector(`script[src="${src}"]`);
        if (existing) {
            loadedScripts.add(src);
            resolve();
            return;
        }

        const script = document.createElement("script");
        script.src = src;
        script.async = true;
        script.onload = () => {
            loadedScripts.add(src);
            resolve();
        };
        script.onerror = () => reject(new Error(`Failed to load script: ${src}`));
        document.head.appendChild(script);
    });
}
