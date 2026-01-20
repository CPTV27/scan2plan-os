import { Router } from "express";
import { asyncHandler } from "../../middleware/errorHandler";
import { log } from "../../lib/logger";
import fetch from "node-fetch";

export const googleMapsRouter = Router();

// GET /api/maps/script
googleMapsRouter.get(
    "/api/maps/script",
    (req, res) => {
        const apiKey = process.env.GOOGLE_MAPS_API_KEY;
        if (!apiKey) {
            return res.status(503).send("// Google Maps API key not configured");
        }

        const libraries = req.query.libraries || "drawing,geometry";
        const callback = req.query.callback || "";

        const scriptUrl = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=${libraries}${callback ? `&callback=${callback}` : ""}`;
        res.redirect(scriptUrl);
    }
);

// GET /api/maps/static
googleMapsRouter.get(
    "/api/maps/static",
    asyncHandler(async (req, res) => {
        const apiKey = process.env.GOOGLE_MAPS_API_KEY;
        if (!apiKey) {
            return res.status(503).json({ error: "Google Maps API key not configured" });
        }

        const { center, zoom, size, maptype, path } = req.query;

        if (!center || !zoom || !size) {
            return res.status(400).json({ error: "center, zoom, and size are required" });
        }

        const centerStr = String(center);
        const zoomStr = String(zoom);
        const sizeStr = String(size);
        const maptypeStr = String(maptype || "satellite");

        if (!/^-?\d+\.?\d*,-?\d+\.?\d*$/.test(centerStr)) {
            return res.status(400).json({ error: "Invalid center format" });
        }

        const zoomNum = parseInt(zoomStr, 10);
        if (isNaN(zoomNum) || zoomNum < 1 || zoomNum > 21) {
            return res.status(400).json({ error: "Invalid zoom level" });
        }

        if (!/^\d+x\d+$/.test(sizeStr)) {
            return res.status(400).json({ error: "Invalid size format" });
        }

        const pathStr = path ? String(path) : "";
        if (pathStr.length > 5000) {
            return res.status(400).json({ error: "Path too long, max 100 points" });
        }

        try {
            let url = `https://maps.googleapis.com/maps/api/staticmap?center=${encodeURIComponent(centerStr)}&zoom=${zoomNum}&size=${encodeURIComponent(sizeStr)}&maptype=${encodeURIComponent(maptypeStr)}&key=${apiKey}`;

            if (pathStr) {
                url += `&path=${encodeURIComponent(pathStr)}`;
            }

            const response = await fetch(url);

            if (!response.ok) {
                return res.status(response.status).json({ error: "Failed to fetch static map" });
            }

            const contentType = response.headers.get("content-type");
            res.setHeader("Content-Type", contentType || "image/png");
            res.setHeader("Cache-Control", "public, max-age=86400");

            const buffer = await response.arrayBuffer();
            res.send(Buffer.from(buffer));
        } catch (error) {
            log("ERROR: Static map error - " + (error as any)?.message);
            res.status(500).json({ error: "Failed to generate static map" });
        }
    })
);

// GET /api/location/preview
googleMapsRouter.get(
    "/api/location/preview",
    asyncHandler(async (req, res) => {
        try {
            const address = req.query.address as string;
            if (!address || address.trim().length < 5) {
                return res.status(400).json({ error: "Address is required" });
            }

            const apiKey = process.env.GOOGLE_MAPS_API_KEY;
            if (!apiKey) {
                return res.status(503).json({
                    error: "Google Maps API key not configured",
                    available: false
                });
            }

            const encodedAddress = encodeURIComponent(address);

            let streetViewUrl = "";
            let lat: number | null = null;
            let lng: number | null = null;

            try {
                const geocodeResponse = await fetch(
                    `https://maps.googleapis.com/maps/api/geocode/json?address=${encodedAddress}&key=${apiKey}`
                );
                const geocodeData = await geocodeResponse.json();

                if (geocodeData.status === "OK" && geocodeData.results?.[0]) {
                    const location = geocodeData.results[0].geometry?.location;
                    if (location) {
                        lat = location.lat;
                        lng = location.lng;
                        // Use Embed API for iframe-compatible Street View
                        streetViewUrl = `https://www.google.com/maps/embed/v1/streetview?key=${apiKey}&location=${lat},${lng}&heading=0&pitch=0&fov=90`;
                    }
                }
            } catch (geoErr) {
                log("WARN: Geocoding failed for location preview - " + (geoErr as any)?.message);
            }

            const mapUrl = `https://www.google.com/maps/embed/v1/place?key=${apiKey}&q=${encodedAddress}`;
            const satelliteUrl = `https://www.google.com/maps/embed/v1/view?key=${apiKey}&center=${lat || 40.7},${lng || -74}&zoom=18&maptype=satellite`;

            res.json({
                available: true,
                mapUrl,
                satelliteUrl,
                streetViewUrl,
                geocoded: {
                    lat,
                    lng,
                    formattedAddress: address
                },
                coordinates: lat && lng ? { lat, lng } : undefined
            });
        } catch (error) {
            log("ERROR: Location preview error - " + (error as any)?.message);
            res.status(500).json({ error: "Failed to generate location preview" });
        }
    })
);

// GET /api/location/static-map (Proxy for thumbnails)
googleMapsRouter.get(
    "/api/location/static-map",
    asyncHandler(async (req, res) => {
        try {
            const address = req.query.address as string;
            const lat = req.query.lat as string;
            const lng = req.query.lng as string;
            const zoom = parseInt(req.query.zoom as string) || 17;
            const size = (req.query.size as string) || "400x300";
            const maptype = (req.query.maptype as string) || "satellite";

            const apiKey = process.env.GOOGLE_MAPS_API_KEY;
            if (!apiKey) {
                return res.status(503).json({
                    error: "Google Maps API key not configured"
                });
            }

            let center = "";
            if (lat && lng) {
                center = `${lat},${lng}`;
            } else if (address) {
                center = encodeURIComponent(address);
            } else {
                return res.status(400).json({ error: "Address or coordinates required" });
            }

            const staticMapUrl = `https://maps.googleapis.com/maps/api/staticmap?center=${center}&zoom=${zoom}&size=${size}&maptype=${maptype}&key=${apiKey}`;

            const response = await fetch(staticMapUrl);

            if (!response.ok) {
                return res.status(response.status).json({ error: "Failed to fetch static map from Google" });
            }

            const contentType = response.headers.get("content-type");
            res.setHeader("Content-Type", contentType || "image/png");
            res.setHeader("Cache-Control", "public, max-age=86400");

            const buffer = await response.arrayBuffer();
            res.send(Buffer.from(buffer));
        } catch (error) {
            log("ERROR: Static map error - " + (error as any)?.message);
            res.status(500).json({ error: "Failed to generate static map" });
        }
    })
);

// GET /api/location/place-details
googleMapsRouter.get(
    "/api/location/place-details",
    asyncHandler(async (req, res) => {
        try {
            const address = req.query.address as string;
            if (!address || address.trim().length < 5) {
                return res.status(400).json({ error: "Address is required" });
            }

            const apiKey = process.env.GOOGLE_MAPS_API_KEY;
            if (!apiKey) {
                return res.status(503).json({ error: "Google Maps API key not configured" });
            }

            const encodedAddress = encodeURIComponent(address);
            const geocodeResponse = await fetch(
                `https://maps.googleapis.com/maps/api/geocode/json?address=${encodedAddress}&key=${apiKey}`
            );
            const geocodeData = await geocodeResponse.json();

            if (geocodeData.status !== "OK" || !geocodeData.results?.[0]) {
                return res.status(404).json({ error: "Location not found" });
            }

            const place = geocodeData.results[0];
            const addressComponents = place.address_components || [];

            const getComponent = (type: string) =>
                addressComponents.find((c: any) => c.types.includes(type))?.long_name;

            const state = getComponent("administrative_area_level_1");
            const zip = getComponent("postal_code");

            res.json({
                formattedAddress: place.formatted_address,
                location: place.geometry.location,
                state,
                zip,
                placeId: place.place_id,
                available: true
            });
        } catch (error) {
            log("ERROR: Place details error - " + (error as any)?.message);
            res.status(500).json({ error: "Failed to fetch place details" });
        }
    })
);

// GET /api/location/building-insights - Google Solar API Building Insights
googleMapsRouter.get(
    "/api/location/building-insights",
    asyncHandler(async (req, res) => {
        try {
            const lat = parseFloat(req.query.lat as string);
            const lng = parseFloat(req.query.lng as string);

            if (isNaN(lat) || isNaN(lng)) {
                return res.status(400).json({ 
                    available: false,
                    error: "Valid latitude and longitude are required" 
                });
            }

            const apiKey = process.env.GOOGLE_MAPS_API_KEY;
            if (!apiKey) {
                return res.status(503).json({
                    available: false,
                    error: "Google Maps API key not configured"
                });
            }

            // Call Google Solar API buildingInsights endpoint
            const solarUrl = `https://solar.googleapis.com/v1/buildingInsights:findClosest?location.latitude=${lat}&location.longitude=${lng}&requiredQuality=MEDIUM&key=${apiKey}`;
            
            const response = await fetch(solarUrl);
            const data = await response.json();

            if (!response.ok) {
                // Solar API may return 404 for locations without data
                if (response.status === 404 || data.error?.status === "NOT_FOUND") {
                    return res.json({
                        available: false,
                        message: "Solar data not available for this location"
                    });
                }
                log("WARN: Solar API error - " + JSON.stringify(data.error || data));
                return res.json({
                    available: false,
                    message: data.error?.message || "Building insights not available"
                });
            }

            // Extract relevant building insights
            const solarPotential = data.solarPotential;
            const roofSegments = solarPotential?.roofSegmentStats || [];
            
            // Calculate building area from roof segments
            let totalRoofAreaMeters2 = 0;
            roofSegments.forEach((segment: any) => {
                totalRoofAreaMeters2 += segment.stats?.areaMeters2 || 0;
            });

            // Get max roof height from segments
            let maxPitchDegrees = 0;
            let avgAzimuthDegrees = 0;
            if (roofSegments.length > 0) {
                roofSegments.forEach((segment: any) => {
                    if (segment.pitchDegrees > maxPitchDegrees) {
                        maxPitchDegrees = segment.pitchDegrees;
                    }
                    avgAzimuthDegrees += segment.azimuthDegrees || 0;
                });
                avgAzimuthDegrees = avgAzimuthDegrees / roofSegments.length;
            }

            // Use whole roof stats if available
            const wholeRoofStats = solarPotential?.wholeRoofStats;
            if (wholeRoofStats?.areaMeters2) {
                totalRoofAreaMeters2 = wholeRoofStats.areaMeters2;
            }

            const squareMeters = Math.round(totalRoofAreaMeters2);
            const squareFeet = Math.round(totalRoofAreaMeters2 * 10.764);

            // Get building height from solar potential if available
            const buildingHeight = solarPotential?.buildingStats?.buildingHeightMeters;

            res.json({
                available: true,
                buildingArea: {
                    squareMeters,
                    squareFeet
                },
                roofStats: {
                    segments: roofSegments.length,
                    pitchDegrees: Math.round(maxPitchDegrees),
                    azimuthDegrees: Math.round(avgAzimuthDegrees)
                },
                height: buildingHeight ? {
                    maxRoofHeightMeters: Math.round(buildingHeight * 10) / 10,
                    maxRoofHeightFeet: Math.round(buildingHeight * 3.281)
                } : undefined,
                imagery: {
                    date: data.imageryDate ? 
                        `${data.imageryDate.year}-${String(data.imageryDate.month).padStart(2, '0')}-${String(data.imageryDate.day).padStart(2, '0')}` 
                        : undefined,
                    quality: data.imageryQuality || "MEDIUM"
                },
                solarPotential: solarPotential ? {
                    maxPanels: solarPotential.maxArrayPanelsCount,
                    maxSunshineHours: Math.round(solarPotential.maxSunshineHoursPerYear || 0)
                } : undefined
            });
        } catch (error) {
            log("ERROR: Building insights error - " + (error as any)?.message);
            res.json({
                available: false,
                error: "Failed to fetch building insights"
            });
        }
    })
);

// GET /api/location/aerial-view - Google Aerial View API (3D flyover videos)
googleMapsRouter.get(
    "/api/location/aerial-view",
    asyncHandler(async (req, res) => {
        try {
            const address = req.query.address as string;
            const videoId = req.query.videoId as string;

            if (!address && !videoId) {
                return res.status(400).json({ 
                    available: false,
                    hasVideo: false,
                    error: "Address or videoId is required" 
                });
            }

            const apiKey = process.env.GOOGLE_MAPS_API_KEY;
            if (!apiKey) {
                return res.status(503).json({
                    available: false,
                    hasVideo: false,
                    error: "Google Maps API key not configured"
                });
            }

            // Aerial View API uses GET with query parameters
            // It only works with US addresses
            let aerialUrl = `https://aerialview.googleapis.com/v1/videos:lookupVideo?key=${apiKey}`;
            
            if (videoId) {
                aerialUrl += `&videoId=${encodeURIComponent(videoId)}`;
            } else if (address) {
                aerialUrl += `&address=${encodeURIComponent(address)}`;
            }
            
            try {
                const response = await fetch(aerialUrl, {
                    method: 'GET',
                    headers: { 'Accept': 'application/json' }
                });

                if (!response.ok) {
                    const errorData = await response.json();
                    // Most locations won't have aerial view videos
                    if (response.status === 404 || errorData.error?.status === "NOT_FOUND") {
                        return res.json({
                            available: true,
                            hasVideo: false,
                            canRequest: true,
                            message: "No aerial video available for this location. You can request one."
                        });
                    }
                    
                    // API might not be enabled
                    if (response.status === 403) {
                        return res.json({
                            available: false,
                            hasVideo: false,
                            message: "Aerial View API not enabled for this project"
                        });
                    }

                    // Invalid address format or non-US address
                    if (response.status === 400) {
                        return res.json({
                            available: false,
                            hasVideo: false,
                            message: "Aerial View only supports US addresses"
                        });
                    }

                    return res.json({
                        available: false,
                        hasVideo: false,
                        message: "Aerial view not available"
                    });
                }

                const data = await response.json();
                
                // Check video state
                if (data.state === "ACTIVE" && data.uris) {
                    return res.json({
                        available: true,
                        hasVideo: true,
                        videoId: data.metadata?.videoId,
                        landscapeUri: data.uris?.landscapeUri,
                        portraitUri: data.uris?.portraitUri,
                        captureDate: data.metadata?.captureDate,
                        duration: data.metadata?.duration
                    });
                }

                if (data.state === "PROCESSING") {
                    return res.json({
                        available: true,
                        hasVideo: false,
                        canRequest: false,
                        videoId: data.metadata?.videoId,
                        message: "Aerial video is being generated"
                    });
                }

                return res.json({
                    available: true,
                    hasVideo: false,
                    canRequest: true,
                    message: "No aerial video available"
                });
            } catch (aerialErr) {
                log("WARN: Aerial View API error - " + (aerialErr as any)?.message);
                return res.json({
                    available: false,
                    hasVideo: false,
                    message: "Aerial View API not available"
                });
            }
        } catch (error) {
            log("ERROR: Aerial view error - " + (error as any)?.message);
            res.json({
                available: false,
                hasVideo: false,
                error: "Failed to fetch aerial view"
            });
        }
    })
);

// POST /api/location/aerial-view/request - Request aerial view video generation
googleMapsRouter.post(
    "/api/location/aerial-view/request",
    asyncHandler(async (req, res) => {
        try {
            const { address } = req.body;

            if (!address) {
                return res.status(400).json({ 
                    success: false,
                    error: "Address is required" 
                });
            }

            const apiKey = process.env.GOOGLE_MAPS_API_KEY;
            if (!apiKey) {
                return res.status(503).json({
                    success: false,
                    error: "Google Maps API key not configured"
                });
            }

            // Request video generation from Aerial View API
            // Uses POST with address in JSON body
            const requestUrl = `https://aerialview.googleapis.com/v1/videos:renderVideo?key=${apiKey}`;
            
            const response = await fetch(requestUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ address })
            });

            if (!response.ok) {
                const errorData = await response.json();
                
                // Check for specific errors
                if (response.status === 400) {
                    return res.json({
                        success: false,
                        message: "Aerial View only supports US addresses"
                    });
                }
                
                return res.json({
                    success: false,
                    message: errorData.error?.message || "Could not request aerial video"
                });
            }

            const data = await response.json();
            
            res.json({
                success: true,
                state: data.state || "PROCESSING",
                videoId: data.metadata?.videoId,
                message: "Aerial video generation requested. Check back in a few minutes."
            });
        } catch (error) {
            log("ERROR: Aerial view request error - " + (error as any)?.message);
            res.status(500).json({
                success: false,
                error: "Failed to request aerial view"
            });
        }
    })
);

// Dispatch location addresses mapping
const DISPATCH_LOCATION_ADDRESSES: Record<string, string> = {
    woodstock: "3272 Rt 212, Bearsville, NY 12409",
    brooklyn: "176 Borinquen Place, Brooklyn, NY 11211",
    troy: "188 1st St, Troy, NY 12180",
};

// GET /api/location/travel-distance - Calculate distance from dispatch location to destination
googleMapsRouter.get(
    "/api/location/travel-distance",
    asyncHandler(async (req, res) => {
        try {
            const destination = req.query.destination as string;
            const dispatchLocation = (req.query.dispatchLocation as string)?.toLowerCase() || "woodstock";

            if (!destination || destination.trim().length < 5) {
                return res.status(400).json({ error: "Destination address is required" });
            }

            const apiKey = process.env.GOOGLE_MAPS_API_KEY;
            if (!apiKey) {
                return res.status(503).json({
                    available: false,
                    error: "Google Maps API key not configured"
                });
            }

            const origin = DISPATCH_LOCATION_ADDRESSES[dispatchLocation] || DISPATCH_LOCATION_ADDRESSES.woodstock;

            log(`[Distance Matrix] Calculating: from=${origin} destination=${destination}`);

            const url = new URL("https://maps.googleapis.com/maps/api/distancematrix/json");
            url.searchParams.set("origins", origin);
            url.searchParams.set("destinations", destination);
            url.searchParams.set("units", "imperial");
            url.searchParams.set("key", apiKey);

            const response = await fetch(url.toString());
            const data = await response.json() as any;

            if (data.status !== "OK" || !data.rows?.[0]?.elements?.[0]) {
                return res.json({
                    available: false,
                    error: "Could not calculate distance"
                });
            }

            const element = data.rows[0].elements[0];
            if (element.status !== "OK") {
                return res.json({
                    available: false,
                    error: element.status
                });
            }

            const distanceMeters = element.distance?.value || 0;
            const durationSeconds = element.duration?.value || 0;
            const distanceMiles = Math.round(distanceMeters / 1609.34);
            const durationMinutes = Math.round(durationSeconds / 60);

            res.json({
                available: true,
                distanceMiles,
                durationMinutes,
                distanceText: element.distance?.text,
                durationText: element.duration?.text,
                origin,
                destination
            });
        } catch (error) {
            log("ERROR: Travel distance calculation error - " + (error as any)?.message);
            res.status(500).json({
                available: false,
                error: "Failed to calculate distance"
            });
        }
    })
);
