/// <reference types="@types/google.maps" />
import { useState, useEffect, useRef, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Trash2, Save, PenTool, Square, Undo } from "lucide-react";

interface Coordinate {
  lat: number;
  lng: number;
}

interface BoundaryDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  coordinates: { lat: number; lng: number };
  address: string;
  initialBoundary?: Coordinate[];
  onSave: (boundary: Coordinate[], areaAcres: number, boundaryImageUrl: string) => void;
}

declare global {
  interface Window {
    google: typeof google;
    initBoundaryMap: () => void;
  }
}

const SQFT_PER_ACRE = 43560;

function generateBoundaryImageUrl(coords: Coordinate[]): string {
  if (coords.length < 3) return "";
  
  // Close the polygon by repeating the first coordinate at the end
  const closedCoords = [...coords, coords[0]];
  const pathCoords = closedCoords.map(c => `${c.lat.toFixed(6)},${c.lng.toFixed(6)}`).join("|");
  const center = coords.reduce(
    (acc, c) => ({ lat: acc.lat + c.lat / coords.length, lng: acc.lng + c.lng / coords.length }),
    { lat: 0, lng: 0 }
  );
  
  const pathParam = `fillcolor:0x4285F466|color:0x4285F4FF|weight:2|${pathCoords}`;
  
  return `/api/maps/static?center=${center.lat.toFixed(6)},${center.lng.toFixed(6)}&zoom=18&size=400x400&maptype=satellite&path=${encodeURIComponent(pathParam)}`;
}

function calculatePolygonArea(coords: Coordinate[]): number {
  if (coords.length < 3) return 0;
  
  if (window.google?.maps?.geometry?.spherical) {
    const path = coords.map(c => new window.google.maps.LatLng(c.lat, c.lng));
    const areaSqMeters = window.google.maps.geometry.spherical.computeArea(path);
    const areaSqFeet = areaSqMeters * 10.7639;
    return areaSqFeet / SQFT_PER_ACRE;
  }
  
  return 0;
}

export function BoundaryDrawer({
  open,
  onOpenChange,
  coordinates,
  address,
  initialBoundary,
  onSave,
}: BoundaryDrawerProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const drawingManagerRef = useRef<google.maps.drawing.DrawingManager | null>(null);
  const polygonRef = useRef<google.maps.Polygon | null>(null);
  
  const [isLoaded, setIsLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [boundary, setBoundary] = useState<Coordinate[]>(initialBoundary || []);
  const [calculatedAcres, setCalculatedAcres] = useState(0);
  const [drawingMode, setDrawingMode] = useState<"polygon" | "rectangle" | null>(null);

  const loadGoogleMapsScript = useCallback(() => {
    if (window.google?.maps?.drawing) {
      setIsLoaded(true);
      setIsLoading(false);
      return;
    }

    const existingScript = document.querySelector('script[src*="maps.googleapis.com"]');
    if (existingScript) {
      const checkLoaded = setInterval(() => {
        if (window.google?.maps?.drawing) {
          clearInterval(checkLoaded);
          setIsLoaded(true);
          setIsLoading(false);
        }
      }, 100);
      return;
    }

    window.initBoundaryMap = () => {
      setIsLoaded(true);
      setIsLoading(false);
    };

    const script = document.createElement("script");
    script.src = `/api/maps/script?libraries=drawing,geometry&callback=initBoundaryMap`;
    script.async = true;
    script.defer = true;
    document.head.appendChild(script);
  }, []);

  useEffect(() => {
    if (open) {
      loadGoogleMapsScript();
    }
  }, [open, loadGoogleMapsScript]);

  useEffect(() => {
    if (!open || !isLoaded || !mapRef.current || !coordinates.lat) return;

    const map = new window.google.maps.Map(mapRef.current, {
      center: coordinates,
      zoom: 18,
      mapTypeId: "satellite",
      mapTypeControl: true,
      mapTypeControlOptions: {
        style: window.google.maps.MapTypeControlStyle.HORIZONTAL_BAR,
        position: window.google.maps.ControlPosition.TOP_RIGHT,
      },
    });
    mapInstanceRef.current = map;

    const drawingManager = new window.google.maps.drawing.DrawingManager({
      drawingMode: null,
      drawingControl: false,
      polygonOptions: {
        fillColor: "#4285F4",
        fillOpacity: 0.3,
        strokeColor: "#4285F4",
        strokeWeight: 2,
        editable: true,
        draggable: true,
      },
      rectangleOptions: {
        fillColor: "#4285F4",
        fillOpacity: 0.3,
        strokeColor: "#4285F4",
        strokeWeight: 2,
        editable: true,
        draggable: true,
      },
    });
    drawingManager.setMap(map);
    drawingManagerRef.current = drawingManager;

    window.google.maps.event.addListener(drawingManager, "polygoncomplete", (polygon: google.maps.Polygon) => {
      if (polygonRef.current) {
        polygonRef.current.setMap(null);
      }
      polygonRef.current = polygon;
      drawingManager.setDrawingMode(null);
      setDrawingMode(null);
      
      updateBoundaryFromPolygon(polygon);
      
      polygon.getPath().addListener("set_at", () => updateBoundaryFromPolygon(polygon));
      polygon.getPath().addListener("insert_at", () => updateBoundaryFromPolygon(polygon));
      polygon.getPath().addListener("remove_at", () => updateBoundaryFromPolygon(polygon));
    });

    window.google.maps.event.addListener(drawingManager, "rectanglecomplete", (rectangle: google.maps.Rectangle) => {
      if (polygonRef.current) {
        polygonRef.current.setMap(null);
      }
      
      const bounds = rectangle.getBounds();
      if (bounds) {
        const ne = bounds.getNorthEast();
        const sw = bounds.getSouthWest();
        const coords = [
          { lat: ne.lat(), lng: sw.lng() },
          { lat: ne.lat(), lng: ne.lng() },
          { lat: sw.lat(), lng: ne.lng() },
          { lat: sw.lat(), lng: sw.lng() },
        ];
        
        rectangle.setMap(null);
        
        const polygon = new window.google.maps.Polygon({
          paths: coords,
          fillColor: "#4285F4",
          fillOpacity: 0.3,
          strokeColor: "#4285F4",
          strokeWeight: 2,
          editable: true,
          draggable: true,
        });
        polygon.setMap(map);
        polygonRef.current = polygon;
        
        updateBoundaryFromPolygon(polygon);
        
        polygon.getPath().addListener("set_at", () => updateBoundaryFromPolygon(polygon));
        polygon.getPath().addListener("insert_at", () => updateBoundaryFromPolygon(polygon));
        polygon.getPath().addListener("remove_at", () => updateBoundaryFromPolygon(polygon));
      }
      
      drawingManager.setDrawingMode(null);
      setDrawingMode(null);
    });

    if (initialBoundary && initialBoundary.length >= 3) {
      const polygon = new window.google.maps.Polygon({
        paths: initialBoundary,
        fillColor: "#4285F4",
        fillOpacity: 0.3,
        strokeColor: "#4285F4",
        strokeWeight: 2,
        editable: true,
        draggable: true,
      });
      polygon.setMap(map);
      polygonRef.current = polygon;
      
      updateBoundaryFromPolygon(polygon);
      
      polygon.getPath().addListener("set_at", () => updateBoundaryFromPolygon(polygon));
      polygon.getPath().addListener("insert_at", () => updateBoundaryFromPolygon(polygon));
      polygon.getPath().addListener("remove_at", () => updateBoundaryFromPolygon(polygon));

      const bounds = new window.google.maps.LatLngBounds();
      initialBoundary.forEach(coord => bounds.extend(coord));
      map.fitBounds(bounds);
    }

    return () => {
      if (polygonRef.current) {
        polygonRef.current.setMap(null);
        polygonRef.current = null;
      }
      if (drawingManagerRef.current) {
        drawingManagerRef.current.setMap(null);
        drawingManagerRef.current = null;
      }
      mapInstanceRef.current = null;
    };
  }, [open, isLoaded, coordinates, initialBoundary]);

  const updateBoundaryFromPolygon = (polygon: google.maps.Polygon) => {
    const path = polygon.getPath();
    const coords: Coordinate[] = [];
    for (let i = 0; i < path.getLength(); i++) {
      const point = path.getAt(i);
      coords.push({ lat: point.lat(), lng: point.lng() });
    }
    setBoundary(coords);
    setCalculatedAcres(calculatePolygonArea(coords));
  };

  const handleDrawPolygon = () => {
    if (drawingManagerRef.current) {
      drawingManagerRef.current.setDrawingMode(window.google.maps.drawing.OverlayType.POLYGON);
      setDrawingMode("polygon");
    }
  };

  const handleDrawRectangle = () => {
    if (drawingManagerRef.current) {
      drawingManagerRef.current.setDrawingMode(window.google.maps.drawing.OverlayType.RECTANGLE);
      setDrawingMode("rectangle");
    }
  };

  const handleClear = () => {
    if (polygonRef.current) {
      polygonRef.current.setMap(null);
      polygonRef.current = null;
    }
    setBoundary([]);
    setCalculatedAcres(0);
    if (drawingManagerRef.current) {
      drawingManagerRef.current.setDrawingMode(null);
    }
    setDrawingMode(null);
  };

  const handleSave = () => {
    const boundaryImageUrl = generateBoundaryImageUrl(boundary);
    onSave(boundary, calculatedAcres, boundaryImageUrl);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PenTool className="w-5 h-5" />
            Draw Boundary
            {calculatedAcres > 0 && (
              <Badge variant="secondary">
                {calculatedAcres.toFixed(2)} acres
              </Badge>
            )}
          </DialogTitle>
          <p className="text-sm text-muted-foreground">{address}</p>
        </DialogHeader>
        
        <div className="flex gap-2 mb-2">
          <Button
            variant={drawingMode === "polygon" ? "default" : "outline"}
            size="sm"
            onClick={handleDrawPolygon}
            data-testid="button-draw-polygon"
          >
            <PenTool className="w-4 h-4 mr-1" />
            Draw Polygon
          </Button>
          <Button
            variant={drawingMode === "rectangle" ? "default" : "outline"}
            size="sm"
            onClick={handleDrawRectangle}
            data-testid="button-draw-rectangle"
          >
            <Square className="w-4 h-4 mr-1" />
            Draw Rectangle
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleClear}
            disabled={boundary.length === 0}
            data-testid="button-clear-boundary"
          >
            <Trash2 className="w-4 h-4 mr-1" />
            Clear
          </Button>
        </div>

        <div className="flex-1 relative rounded-md overflow-hidden border">
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-muted/50 z-10">
              <Loader2 className="w-8 h-8 animate-spin" />
            </div>
          )}
          <div ref={mapRef} className="w-full h-full" data-testid="div-boundary-map" />
        </div>

        {boundary.length > 0 && (
          <div className="text-sm text-muted-foreground">
            {boundary.length} points defined
            {calculatedAcres > 0 && (
              <span className="ml-2">
                ({(calculatedAcres * SQFT_PER_ACRE).toLocaleString()} sqft)
              </span>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={boundary.length < 3}
            data-testid="button-save-boundary"
          >
            <Save className="w-4 h-4 mr-1" />
            Save Boundary
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
