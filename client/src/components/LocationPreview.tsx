import { useState, useEffect, useCallback, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import {
  Map,
  Eye,
  Loader2,
  AlertCircle,
  Search,
  ExternalLink,
  Image as ImageIcon,
  Building2,
  Star,
  Phone,
  Globe,
  Clock,
  ChevronLeft,
  ChevronRight,
  Ruler,
  Video,
  Copy,
  Check,
  TriangleAlert,
  Layers,
  Move3d,
  PenTool
} from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { BoundaryDrawer } from "./BoundaryDrawer";

interface BoundaryCoordinate {
  lat: number;
  lng: number;
}

interface LocationPreviewProps {
  address: string;
  companyName?: string;
  buildingType?: string;
  onApplyToQuote?: (sqft: number) => void;
  onSiteNotesChange?: (notes: string) => void;
  onAddressUpdate?: (formattedAddress: string) => void;
  siteNotes?: string;
  boundary?: BoundaryCoordinate[];
  onBoundaryChange?: (boundary: BoundaryCoordinate[], areaAcres: number) => void;
}

interface LocationData {
  available: boolean;
  mapUrl?: string;
  satelliteUrl?: string;
  streetViewUrl?: string;
  staticMapUrl?: string;
  error?: string;
}

interface PlacePhoto {
  url: string;
  attribution?: string;
}

interface BusinessInfo {
  name?: string;
  address?: string;
  types?: string[];
  primaryType?: string;
  rating?: number;
  reviewCount?: number;
  website?: string;
  phone?: string;
  businessStatus?: string;
  openingHours?: string[];
  summary?: string;
}

interface PlaceDetailsData {
  available: boolean;
  found: boolean;
  placeId?: string;
  photos?: PlacePhoto[];
  businessInfo?: BusinessInfo;
  rawTypes?: string[];
  message?: string;
  error?: string;
}

interface ImageSearchResult {
  address: string;
  searchTerms: string[];
  note: string;
}

interface BuildingInsights {
  available: boolean;
  buildingArea?: {
    squareMeters: number;
    squareFeet: number;
  };
  roofStats?: {
    segments: number;
    pitchDegrees?: number;
    azimuthDegrees?: number;
  };
  height?: {
    maxRoofHeightMeters: number;
    maxRoofHeightFeet: number;
  };
  imagery?: {
    date?: string;
    quality?: string;
  };
  error?: string;
  message?: string;
}

interface AerialViewData {
  available: boolean;
  hasVideo: boolean;
  videoId?: string;
  videoUri?: string;
  landscapeUri?: string;
  canRequest?: boolean;
  message?: string;
  error?: string;
}

const BUILDING_TYPE_MAP: Record<string, string> = {
  "commercial": "Commercial",
  "office": "Office",
  "retail": "Retail",
  "restaurant": "Restaurant",
  "hospital": "Healthcare",
  "school": "Education",
  "university": "Education",
  "church": "Religious",
  "gym": "Fitness",
  "store": "Retail",
  "shopping_mall": "Retail",
  "warehouse": "Industrial",
  "factory": "Industrial",
  "apartment": "Residential",
  "lodging": "Hospitality",
  "hotel": "Hospitality",
};

function formatPlaceType(type: string): string {
  const formatted = type.replace(/_/g, " ");
  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
}

function inferBuildingCategory(types: string[]): string | null {
  for (const type of types) {
    const lowerType = type.toLowerCase();
    for (const [key, value] of Object.entries(BUILDING_TYPE_MAP)) {
      if (lowerType.includes(key)) {
        return value;
      }
    }
  }
  return null;
}

// Satellite Map with 45° tilt support
function SatelliteMap({ lat, lng }: { lat: number; lng: number }) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Load Google Maps script if not already loaded
    if (!window.google?.maps) {
      const script = document.createElement("script");
      script.src = `/api/maps/script?libraries=geometry&callback=initGoogleMaps`;
      script.async = true;
      script.defer = true;

      (window as any).initGoogleMaps = () => {
        setIsLoaded(true);
      };

      script.onerror = () => {
        setError("Failed to load Google Maps");
      };

      document.head.appendChild(script);
    } else {
      setIsLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (!isLoaded || !mapRef.current || !window.google?.maps) return;

    try {
      const map = new google.maps.Map(mapRef.current, {
        center: { lat, lng },
        zoom: 19,
        mapTypeId: google.maps.MapTypeId.SATELLITE,
        tilt: 45,
        heading: 0,
        mapTypeControl: true,
        mapTypeControlOptions: {
          style: google.maps.MapTypeControlStyle.HORIZONTAL_BAR,
          position: google.maps.ControlPosition.TOP_RIGHT,
          mapTypeIds: [
            google.maps.MapTypeId.SATELLITE,
            google.maps.MapTypeId.HYBRID,
          ],
        },
        rotateControl: true,
        fullscreenControl: true,
        streetViewControl: false,
        zoomControl: true,
      });

      mapInstanceRef.current = map;

      // Add a marker at the location
      new google.maps.Marker({
        position: { lat, lng },
        map,
        title: "Location",
      });

      // Try to enable 45° view if available
      map.addListener("tilesloaded", () => {
        // Tilt is automatically applied where available
        map.setTilt(45);
      });
    } catch (err) {
      setError("Failed to initialize map");
    }
  }, [isLoaded, lat, lng]);

  // Update center when coordinates change
  useEffect(() => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.setCenter({ lat, lng });
    }
  }, [lat, lng]);

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-80 bg-muted/30 rounded-md">
        <AlertCircle className="w-8 h-8 text-muted-foreground mb-2" />
        <p className="text-sm text-muted-foreground">{error}</p>
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center h-80 bg-muted/30 rounded-md">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div
      ref={mapRef}
      className="w-full h-80 rounded-md"
      style={{ minHeight: "320px" }}
    />
  );
}

export function LocationPreview({
  address,
  companyName,
  buildingType,
  onApplyToQuote,
  onSiteNotesChange,
  onAddressUpdate,
  siteNotes = "",
  boundary,
  onBoundaryChange
}: LocationPreviewProps) {
  const [activeView, setActiveView] = useState<"map" | "streetview" | "photos">("map");
  const [debouncedAddress, setDebouncedAddress] = useState(address);
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState(0);
  const [copiedLink, setCopiedLink] = useState(false);
  const [localSiteNotes, setLocalSiteNotes] = useState(siteNotes);
  const [hasAutoPopulated, setHasAutoPopulated] = useState(false);
  const [boundaryDrawerOpen, setBoundaryDrawerOpen] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (address && address.trim().length >= 5) {
        setDebouncedAddress(address);
      }
    }, 800);
    return () => clearTimeout(timer);
  }, [address]);

  // Update local notes when prop changes
  useEffect(() => {
    setLocalSiteNotes(siteNotes);
  }, [siteNotes]);

  const { data: locationData, isLoading, error } = useQuery<LocationData & { coordinates?: { lat: number; lng: number } }>({
    queryKey: ["/api/location/preview", debouncedAddress],
    queryFn: async () => {
      const response = await fetch(`/api/location/preview?address=${encodeURIComponent(debouncedAddress)}`);
      return response.json();
    },
    enabled: debouncedAddress.length >= 5,
    staleTime: 1000 * 60 * 5,
  });

  const { data: placeDetails, isLoading: isLoadingPlace } = useQuery<PlaceDetailsData>({
    queryKey: ["/api/location/place-details", debouncedAddress],
    queryFn: async () => {
      const response = await fetch(`/api/location/place-details?address=${encodeURIComponent(debouncedAddress)}`);
      return response.json();
    },
    enabled: debouncedAddress.length >= 5,
    staleTime: 1000 * 60 * 10,
  });

  // Auto-populate full address when place is identified
  useEffect(() => {
    if (
      placeDetails?.found &&
      placeDetails.businessInfo?.address &&
      onAddressUpdate &&
      !hasAutoPopulated
    ) {
      const formattedAddress = placeDetails.businessInfo.address;
      // Only update if the formatted address is different and more complete
      if (formattedAddress !== address && formattedAddress.length > address.length) {
        onAddressUpdate(formattedAddress);
        setHasAutoPopulated(true);
      }
    }
  }, [placeDetails, onAddressUpdate, hasAutoPopulated, address]);

  // Reset auto-populate flag when user types a new address
  useEffect(() => {
    setHasAutoPopulated(false);
  }, [address]);

  // Building Insights from Solar API
  const { data: buildingInsights, isLoading: isLoadingInsights } = useQuery<BuildingInsights>({
    queryKey: ["/api/location/building-insights", locationData?.coordinates?.lat, locationData?.coordinates?.lng],
    queryFn: async () => {
      if (!locationData?.coordinates) return { available: false };
      const response = await apiRequest("GET", `/api/location/building-insights?lat=${locationData.coordinates.lat}&lng=${locationData.coordinates.lng}`);
      return response.json();
    },
    enabled: !!locationData?.coordinates,
    staleTime: 1000 * 60 * 30,
  });

  // Aerial View from Google Aerial View API (US addresses only)
  const { data: aerialView, isLoading: isLoadingAerial } = useQuery<AerialViewData>({
    queryKey: ["/api/location/aerial-view", debouncedAddress],
    queryFn: async () => {
      if (!debouncedAddress || debouncedAddress.length < 5) return { available: false, hasVideo: false };
      const response = await apiRequest("GET", `/api/location/aerial-view?address=${encodeURIComponent(debouncedAddress)}`);
      return response.json();
    },
    enabled: debouncedAddress.length >= 5,
    staleTime: 1000 * 60 * 30,
  });

  const imageSearchMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/location/building-images", {
        address: debouncedAddress,
        companyName,
        buildingType,
      });
      return res.json() as Promise<ImageSearchResult>;
    },
  });

  const aerialRequestMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/location/aerial-view/request", {
        address: debouncedAddress
      });
      return res.json();
    },
  });

  const handleImageSearch = useCallback(() => {
    imageSearchMutation.mutate();
  }, [imageSearchMutation]);

  const handleCopyVideoLink = useCallback(() => {
    const link = aerialView?.landscapeUri || aerialView?.videoUri;
    if (link) {
      navigator.clipboard.writeText(link);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    }
  }, [aerialView]);

  const handleApplyToQuote = useCallback(() => {
    if (buildingInsights?.buildingArea?.squareFeet && onApplyToQuote) {
      onApplyToQuote(buildingInsights.buildingArea.squareFeet);
    }
  }, [buildingInsights, onApplyToQuote]);

  const handleSiteNotesChange = useCallback((value: string) => {
    setLocalSiteNotes(value);
    onSiteNotesChange?.(value);
  }, [onSiteNotesChange]);

  const handleBoundarySave = useCallback((newBoundary: BoundaryCoordinate[], areaAcres: number) => {
    onBoundaryChange?.(newBoundary, areaAcres);
  }, [onBoundaryChange]);

  const photos = placeDetails?.photos || [];
  const businessInfo = placeDetails?.businessInfo;
  const inferredCategory = businessInfo?.types ? inferBuildingCategory(businessInfo.types) : null;

  const handlePrevPhoto = () => {
    setSelectedPhotoIndex((prev) => (prev > 0 ? prev - 1 : photos.length - 1));
  };

  const handleNextPhoto = () => {
    setSelectedPhotoIndex((prev) => (prev < photos.length - 1 ? prev + 1 : 0));
  };

  if (!address || address.trim().length < 5) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-8 text-center">
          <Map className="w-8 h-8 text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">
            Enter an address to see location preview
          </p>
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" />
            Loading Location...
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="w-full h-80 rounded-md" />
        </CardContent>
      </Card>
    );
  }

  if (error || (locationData && !locationData.available)) {
    const errorMsg = locationData?.error || "Location preview unavailable";
    const isConfigError = errorMsg.includes("API key") || errorMsg.includes("configured");

    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-8 text-center">
          <AlertCircle className="w-8 h-8 text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">
            {errorMsg}
          </p>
          {isConfigError && (
            <p className="text-xs text-muted-foreground mt-1">
              Add GOOGLE_MAPS_API_KEY to enable location preview
            </p>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <CardTitle className="text-sm flex items-center gap-2">
            <Map className="w-4 h-4" />
            Location Preview
            {photos.length > 0 && (
              <Badge variant="secondary" className="text-xs">
                {photos.length} photos
              </Badge>
            )}
          </CardTitle>
          <div className="flex items-center gap-2 flex-wrap">
            {onBoundaryChange && locationData?.coordinates && (
              <Button
                type="button"
                variant={boundary && boundary.length > 0 ? "default" : "outline"}
                size="sm"
                onClick={() => setBoundaryDrawerOpen(true)}
                data-testid="button-draw-boundary"
              >
                <PenTool className="w-3 h-3 mr-1" />
                {boundary && boundary.length > 0 ? "Edit Boundary" : "Draw Boundary"}
              </Button>
            )}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleImageSearch}
              disabled={imageSearchMutation.isPending}
              data-testid="button-ai-image-search"
            >
              {imageSearchMutation.isPending ? (
                <Loader2 className="w-3 h-3 mr-1 animate-spin" />
              ) : (
                <Search className="w-3 h-3 mr-1" />
              )}
              AI Search
            </Button>
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(debouncedAddress)}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Button variant="ghost" size="sm" data-testid="link-open-google-maps">
                <ExternalLink className="w-3 h-3 mr-1" />
                Maps
              </Button>
            </a>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {businessInfo && placeDetails?.found && (
          <div className="p-3 rounded-md bg-muted/50 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <Building2 className="w-4 h-4 text-muted-foreground shrink-0" />
                  <span className="font-medium text-sm truncate">
                    {businessInfo.name || "Unknown Business"}
                  </span>
                  {businessInfo.businessStatus === "OPERATIONAL" && (
                    <Badge variant="outline" className="text-xs bg-green-500/10 text-green-600 border-green-500/30">
                      Open
                    </Badge>
                  )}
                </div>
                {inferredCategory && (
                  <Badge variant="secondary" className="mt-1 text-xs">
                    {inferredCategory}
                  </Badge>
                )}
              </div>
              {businessInfo.rating && (
                <div className="flex items-center gap-1 shrink-0">
                  <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                  <span className="text-sm font-medium">{businessInfo.rating}</span>
                  {businessInfo.reviewCount && (
                    <span className="text-xs text-muted-foreground">
                      ({businessInfo.reviewCount})
                    </span>
                  )}
                </div>
              )}
            </div>

            <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
              {businessInfo.phone && (
                <a href={`tel:${businessInfo.phone}`} className="flex items-center gap-1 hover:text-foreground">
                  <Phone className="w-3 h-3" />
                  {businessInfo.phone}
                </a>
              )}
              {businessInfo.website && (
                <a
                  href={businessInfo.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 hover:text-foreground"
                >
                  <Globe className="w-3 h-3" />
                  Website
                </a>
              )}
            </div>

            {businessInfo.summary && (
              <p className="text-xs text-muted-foreground italic">
                {businessInfo.summary}
              </p>
            )}

            {businessInfo.types && businessInfo.types.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {businessInfo.types.slice(0, 5).map((type, idx) => (
                  <Badge key={idx} variant="outline" className="text-xs">
                    {formatPlaceType(type)}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Building Stats Card */}
        {(buildingInsights?.available || isLoadingInsights) && (
          <div className="p-3 rounded-md bg-muted/50 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Ruler className="w-4 h-4 text-muted-foreground" />
                <span className="font-medium text-sm">Building Stats</span>
                {buildingInsights?.imagery?.quality && (
                  <Badge variant="outline" className="text-xs">
                    {buildingInsights.imagery.quality} Quality
                  </Badge>
                )}
              </div>
              {onApplyToQuote && buildingInsights?.buildingArea?.squareFeet && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleApplyToQuote}
                  data-testid="button-apply-to-quote"
                >
                  Apply to Quote
                </Button>
              )}
            </div>

            {isLoadingInsights ? (
              <div className="grid grid-cols-3 gap-2">
                <Skeleton className="h-12" />
                <Skeleton className="h-12" />
                <Skeleton className="h-12" />
              </div>
            ) : buildingInsights?.available ? (
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="p-2 rounded bg-background">
                  <div className="text-lg font-semibold">
                    {buildingInsights.buildingArea?.squareFeet?.toLocaleString() || "-"}
                  </div>
                  <div className="text-xs text-muted-foreground">Footprint (sqft)</div>
                </div>
                <div className="p-2 rounded bg-background">
                  <div className="text-lg font-semibold">
                    {buildingInsights.height?.maxRoofHeightFeet || "-"}
                  </div>
                  <div className="text-xs text-muted-foreground">Elevation (ft)</div>
                </div>
                <div className="p-2 rounded bg-background">
                  <div className="text-lg font-semibold">
                    {buildingInsights.roofStats?.segments || "-"}
                  </div>
                  <div className="text-xs text-muted-foreground">Roof Segments</div>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <TriangleAlert className="w-3 h-3" />
                {buildingInsights?.message || "Building data not available for this location"}
              </div>
            )}
          </div>
        )}

        <Tabs value={activeView} onValueChange={(v) => setActiveView(v as any)}>
          <TabsList className="w-full grid grid-cols-4">
            <TabsTrigger value="map" data-testid="tab-map-view">
              <Layers className="w-3 h-3 mr-1" />
              Satellite
            </TabsTrigger>
            <TabsTrigger value="streetview" data-testid="tab-streetview">
              <Eye className="w-3 h-3 mr-1" />
              Street
            </TabsTrigger>
            <TabsTrigger value="flyover" data-testid="tab-flyover">
              <Video className="w-3 h-3 mr-1" />
              3D
            </TabsTrigger>
            <TabsTrigger value="photos" data-testid="tab-photos">
              <ImageIcon className="w-3 h-3 mr-1" />
              {photos.length > 0 ? photos.length : ""}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="map" className="mt-2">
            {locationData?.coordinates ? (
              <SatelliteMap
                lat={locationData.coordinates.lat}
                lng={locationData.coordinates.lng}
              />
            ) : locationData?.satelliteUrl ? (
              <iframe
                src={locationData.satelliteUrl}
                width="100%"
                height="320"
                style={{ border: 0, borderRadius: "0.375rem" }}
                allowFullScreen
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                title="Google Maps Location"
                data-testid="iframe-map-embed"
              />
            ) : null}
          </TabsContent>

          <TabsContent value="streetview" className="mt-2">
            {locationData?.streetViewUrl ? (
              <iframe
                src={locationData.streetViewUrl}
                width="100%"
                height="320"
                style={{ border: 0, borderRadius: "0.375rem" }}
                allowFullScreen
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                title="Google Street View"
                data-testid="iframe-streetview-embed"
              />
            ) : (
              <div className="flex flex-col items-center justify-center h-80 text-center bg-muted/30 rounded-md">
                <Eye className="w-8 h-8 text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">
                  Street View not available for this location
                </p>
                <a
                  href={`https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${encodeURIComponent(debouncedAddress)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2"
                >
                  <Button type="button" variant="outline" size="sm">
                    <ExternalLink className="w-3 h-3 mr-1" />
                    Try Google Maps
                  </Button>
                </a>
              </div>
            )}
          </TabsContent>

          <TabsContent value="flyover" className="mt-2">
            {isLoadingAerial ? (
              <Skeleton className="w-full h-80 rounded-md" />
            ) : aerialView?.hasVideo && aerialView.landscapeUri ? (
              <div className="space-y-2">
                <video
                  src={aerialView.landscapeUri}
                  controls
                  className="w-full h-80 rounded-md bg-black"
                  data-testid="video-aerial-flyover"
                >
                  Your browser does not support video playback.
                </video>
                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleCopyVideoLink}
                    data-testid="button-copy-video-link"
                  >
                    {copiedLink ? (
                      <>
                        <Check className="w-3 h-3 mr-1" />
                        Copied
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3 mr-1" />
                        Copy Link
                      </>
                    )}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-80 text-center bg-muted/30 rounded-md">
                <Move3d className="w-8 h-8 text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">
                  3D flyover video not available
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {aerialView?.message || "This location doesn't have aerial coverage yet"}
                </p>
                {aerialView?.canRequest && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="mt-2"
                    onClick={() => aerialRequestMutation.mutate()}
                    disabled={aerialRequestMutation.isPending}
                    data-testid="button-request-3d-render"
                  >
                    {aerialRequestMutation.isPending ? (
                      <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                    ) : (
                      <Video className="w-3 h-3 mr-1" />
                    )}
                    Request 3D Rendering
                  </Button>
                )}
              </div>
            )}
          </TabsContent>

          <TabsContent value="photos" className="mt-2">
            {isLoadingPlace ? (
              <Skeleton className="w-full h-80 rounded-md" />
            ) : photos.length > 0 ? (
              <div className="space-y-2">
                <div className="relative">
                  <img
                    src={photos[selectedPhotoIndex]?.url}
                    alt={`Building photo ${selectedPhotoIndex + 1}`}
                    className="w-full h-80 object-cover rounded-md"
                    data-testid={`img-building-photo-${selectedPhotoIndex}`}
                  />
                  {photos.length > 1 && (
                    <>
                      <Button
                        type="button"
                        variant="secondary"
                        size="icon"
                        className="absolute left-2 top-1/2 -translate-y-1/2 opacity-80"
                        onClick={handlePrevPhoto}
                        data-testid="button-prev-photo"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        size="icon"
                        className="absolute right-2 top-1/2 -translate-y-1/2 opacity-80"
                        onClick={handleNextPhoto}
                        data-testid="button-next-photo"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </Button>
                      <div className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-black/50 text-white text-xs px-2 py-1 rounded">
                        {selectedPhotoIndex + 1} / {photos.length}
                      </div>
                    </>
                  )}
                </div>
                {photos[selectedPhotoIndex]?.attribution && (
                  <p className="text-xs text-muted-foreground text-center">
                    Photo by {photos[selectedPhotoIndex].attribution}
                  </p>
                )}
                <ScrollArea className="w-full">
                  <div className="flex gap-2 pb-2">
                    {photos.map((photo, idx) => (
                      <button
                        type="button"
                        key={idx}
                        onClick={() => setSelectedPhotoIndex(idx)}
                        className={`shrink-0 rounded-md overflow-hidden border-2 transition-colors ${idx === selectedPhotoIndex ? "border-primary" : "border-transparent"
                          }`}
                        data-testid={`button-photo-thumb-${idx}`}
                      >
                        <img
                          src={photo.url}
                          alt={`Thumbnail ${idx + 1}`}
                          className="w-16 h-12 object-cover"
                        />
                      </button>
                    ))}
                  </div>
                  <ScrollBar orientation="horizontal" />
                </ScrollArea>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-80 text-center">
                <ImageIcon className="w-8 h-8 text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">
                  No photos available for this location
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-2"
                  onClick={handleImageSearch}
                  disabled={imageSearchMutation.isPending}
                >
                  <Search className="w-3 h-3 mr-1" />
                  Try AI Image Search
                </Button>
              </div>
            )}
          </TabsContent>
        </Tabs>

        {imageSearchMutation.data && (
          <div className="space-y-2 pt-2 border-t">
            <p className="text-xs font-medium text-muted-foreground">
              AI-suggested search terms:
            </p>
            <div className="flex flex-wrap gap-1">
              {imageSearchMutation.data.searchTerms.map((term, idx) => (
                <a
                  key={idx}
                  href={`https://www.google.com/search?tbm=isch&q=${encodeURIComponent(term)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Badge
                    variant="secondary"
                    className="cursor-pointer"
                    data-testid={`badge-search-term-${idx}`}
                  >
                    {term}
                  </Badge>
                </a>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              Click a term to search for building images. Verify images match the actual property.
            </p>
          </div>
        )}

        {/* Site Obstruction Notes */}
        {onSiteNotesChange && (
          <div className="space-y-2 pt-2 border-t">
            <div className="flex items-center gap-2">
              <TriangleAlert className="w-4 h-4 text-amber-500" />
              <span className="text-sm font-medium">Site Obstruction Notes</span>
            </div>
            <Textarea
              placeholder="Note any trees, power lines, narrow alleys, or access challenges visible in the 3D view..."
              value={localSiteNotes}
              onChange={(e) => handleSiteNotesChange(e.target.value)}
              className="text-sm min-h-[80px]"
              data-testid="textarea-site-notes"
            />
            <p className="text-xs text-muted-foreground">
              Use the 3D views above to identify potential scanning obstacles
            </p>
          </div>
        )}
      </CardContent>

      {locationData?.coordinates && onBoundaryChange && (
        <BoundaryDrawer
          open={boundaryDrawerOpen}
          onOpenChange={setBoundaryDrawerOpen}
          coordinates={locationData.coordinates}
          address={debouncedAddress}
          initialBoundary={boundary}
          onSave={handleBoundarySave}
        />
      )}
    </Card>
  );
}
