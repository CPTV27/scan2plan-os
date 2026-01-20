import { Router } from "express";
import { cpqStorage } from "../storage/cpq";
import { storage } from "../storage";
import { insertQuoteSchema } from "@shared/schema";
import { z } from "zod";

export async function registerCpqRoutes(router: Router) {
  // Quote routes
  router.get("/api/quotes", async (req, res) => {
    try {
      const allQuotes = await cpqStorage.getAllQuotes();
      res.json(allQuotes);
    } catch (error) {
      console.error("Error fetching quotes:", error);
      res.status(500).json({ error: "Failed to fetch quotes" });
    }
  });

  router.get("/api/quotes/:id", async (req, res) => {
    try {
      const quote = await cpqStorage.getQuote(req.params.id);
      if (!quote) {
        return res.status(404).json({ error: "Quote not found" });
      }
      res.json(quote);
    } catch (error) {
      console.error("Error fetching quote:", error);
      res.status(500).json({ error: "Failed to fetch quote" });
    }
  });

  router.post("/api/quotes", async (req, res) => {
    try {
      const validatedData = insertQuoteSchema.parse(req.body);
      const newQuote = await cpqStorage.createQuote(validatedData);

      // If linked to a lead, update the lead's value and CPQ data
      if (validatedData.leadId) {
        const leadUpdates: any = {};

        // Update value if present
        if (validatedData.totalPrice) {
          leadUpdates.value = validatedData.totalPrice;
        }

        // Map CPQ fields to Lead schema fields
        // The CPQ quote has 'areas', 'risks', 'services', etc.
        // We need to map them to cpqAreas, cpqRisks, etc. in the lead
        if (validatedData.areas) leadUpdates.cpqAreas = validatedData.areas;
        if (validatedData.risks) leadUpdates.cpqRisks = validatedData.risks;
        if (validatedData.services) leadUpdates.cpqServices = validatedData.services;
        if (validatedData.dispatchLocation && validatedData.distance) {
          leadUpdates.cpqTravel = {
            dispatchLocation: validatedData.dispatchLocation,
            distance: validatedData.distance,
            customTravelCost: validatedData.customTravelCost
          };
        }

        // Update extended scoping data
        if (validatedData.scopingData) {
          leadUpdates.cpqScopingData = validatedData.scopingData;
        }

        // Sync project details back to lead if they are generic
        if (validatedData.projectName) leadUpdates.projectName = validatedData.projectName;
        if (validatedData.projectAddress) leadUpdates.projectAddress = validatedData.projectAddress;
        if (validatedData.typeOfBuilding) leadUpdates.buildingType = validatedData.typeOfBuilding;

        if (Object.keys(leadUpdates).length > 0) {
          console.log(`Syncing CPQ data to Lead ${validatedData.leadId}:`, leadUpdates);
          await storage.updateLead(validatedData.leadId, leadUpdates);
        }
      }

      res.status(201).json(newQuote);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid quote data", details: error.errors });
      }
      console.error("Error creating quote:", error);
      res.status(500).json({ error: "Failed to create quote" });
    }
  });

  router.patch("/api/quotes/:id", async (req, res) => {
    try {
      const validatedData = insertQuoteSchema.partial().parse(req.body);
      const updatedQuote = await cpqStorage.updateQuote(req.params.id, validatedData);

      if (!updatedQuote) {
        return res.status(404).json({ error: "Quote not found" });
      }

      // If linked to a lead, update the lead's value and CPQ data
      // We need to fetch the quote *after* update to ensure we have the leadId (if it wasn't in the patch)
      // Or rely on what's in the patch if we are sure leadId is passed or was previously associated
      // The updateQuote result 'updatedQuote' has the full object including leadId
      if (updatedQuote.leadId) {
        const leadUpdates: any = {};

        if (validatedData.totalPrice) {
          leadUpdates.value = validatedData.totalPrice.toString();
        }

        if (validatedData.areas) leadUpdates.cpqAreas = validatedData.areas;
        if (validatedData.risks) leadUpdates.cpqRisks = validatedData.risks;
        if (validatedData.services) leadUpdates.cpqServices = validatedData.services;

        // Construct travel object if components are present, merging with existing if possible or just overwriting
        // For simplicity, we create a new object if dispatch is present
        if (validatedData.dispatchLocation) {
          leadUpdates.cpqTravel = {
            dispatchLocation: validatedData.dispatchLocation,
            distance: validatedData.distance ?? updatedQuote.distance,
            customTravelCost: validatedData.customTravelCost ?? updatedQuote.customTravelCost
          };
        }

        if (validatedData.scopingData) {
          leadUpdates.cpqScopingData = validatedData.scopingData;
        }

        if (Object.keys(leadUpdates).length > 0) {
          console.log(`Syncing CPQ data to Lead ${updatedQuote.leadId}:`, leadUpdates);
          await storage.updateLead(updatedQuote.leadId, leadUpdates);
        }
      }

      res.json(updatedQuote);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid quote data", details: error.errors });
      }
      console.error("Error updating quote:", error);
      res.status(500).json({ error: "Failed to update quote" });
    }
  });

  router.delete("/api/quotes/:id", async (req, res) => {
    try {
      const deleted = await cpqStorage.deleteQuote(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Quote not found" });
      }
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting quote:", error);
      res.status(500).json({ error: "Failed to delete quote" });
    }
  });

  // Quote version routes
  router.get("/api/quotes/:id/versions", async (req, res) => {
    try {
      const versions = await cpqStorage.getQuoteVersions(req.params.id);
      res.json(versions);
    } catch (error) {
      console.error("Error fetching quote versions:", error);
      res.status(500).json({ error: "Failed to fetch quote versions" });
    }
  });

  router.post("/api/quotes/:id/versions", async (req, res) => {
    try {
      const { versionName } = req.body;
      const newVersion = await cpqStorage.createQuoteVersion(req.params.id, versionName);
      res.status(201).json(newVersion);
    } catch (error) {
      console.error("Error creating quote version:", error);
      res.status(500).json({ error: "Failed to create quote version" });
    }
  });

  router.post("/api/calculate-distance", async (req, res) => {
    try {
      const { origin, destination } = req.body;

      if (!origin || !destination) {
        return res.status(400).json({ error: "Origin and destination are required" });
      }

      const MAPBOX_TOKEN = process.env.MAPBOX_ACCESS_TOKEN;
      if (!MAPBOX_TOKEN) {
        return res.status(500).json({ error: "Mapbox API token not configured" });
      }

      const DISPATCH_COORDS: Record<string, [number, number]> = {
        troy: [-73.6918, 42.7284],
        woodstock: [-74.1182, 42.0409],
        brooklyn: [-73.9442, 40.6782],
      };

      const originCoords = DISPATCH_COORDS[origin.toLowerCase()];
      if (!originCoords) {
        return res.status(400).json({ error: "Invalid dispatch location" });
      }

      const geocodeUrl = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(destination)}.json?access_token=${MAPBOX_TOKEN}&limit=1`;
      const geocodeResponse = await fetch(geocodeUrl);

      if (!geocodeResponse.ok) {
        throw new Error("Failed to geocode destination address");
      }

      const geocodeData = await geocodeResponse.json();

      if (!geocodeData.features || geocodeData.features.length === 0) {
        return res.status(404).json({ error: "Address not found" });
      }

      const destCoords = geocodeData.features[0].geometry.coordinates;

      const directionsUrl = `https://api.mapbox.com/directions/v5/mapbox/driving/${originCoords[0]},${originCoords[1]};${destCoords[0]},${destCoords[1]}?access_token=${MAPBOX_TOKEN}`;
      const directionsResponse = await fetch(directionsUrl);

      if (!directionsResponse.ok) {
        throw new Error("Failed to calculate route");
      }

      const directionsData = await directionsResponse.json();

      if (!directionsData.routes || directionsData.routes.length === 0) {
        return res.status(404).json({ error: "No route found" });
      }

      const distanceMeters = directionsData.routes[0].distance;
      const distanceMiles = Math.round(distanceMeters / 1609.34);

      res.json({
        distance: distanceMiles,
        origin: origin,
        destination: destination,
        formattedAddress: geocodeData.features[0].place_name
      });
    } catch (error) {
      console.error("Error calculating distance:", error);
      res.status(500).json({ error: "Failed to calculate distance" });
    }
  });

  // Pricing matrix routes
  router.get("/api/pricing-matrix", async (req, res) => {
    try {
      const allRates = await cpqStorage.getAllPricingRates();
      res.json(allRates);
    } catch (error) {
      console.error("Error fetching pricing rates:", error);
      res.status(500).json({ error: "Failed to fetch pricing rates" });
    }
  });

  router.patch("/api/pricing-matrix/:id", async (req, res) => {
    try {
      const { ratePerSqFt } = req.body;
      if (!ratePerSqFt) {
        return res.status(400).json({ error: "ratePerSqFt is required" });
      }

      const updated = await cpqStorage.updatePricingRate(parseInt(req.params.id), ratePerSqFt);
      if (!updated) {
        return res.status(404).json({ error: "Pricing rate not found" });
      }

      res.json(updated);
    } catch (error) {
      console.error("Error updating pricing rate:", error);
      res.status(500).json({ error: "Failed to update pricing rate" });
    }
  });

  // Upteam pricing matrix routes
  router.get("/api/upteam-pricing-matrix", async (req, res) => {
    try {
      const allRates = await cpqStorage.getAllUpteamPricingRates();
      res.json(allRates);
    } catch (error) {
      console.error("Error fetching upteam pricing rates:", error);
      res.status(500).json({ error: "Failed to fetch upteam pricing rates" });
    }
  });

  router.patch("/api/upteam-pricing-matrix/:id", async (req, res) => {
    try {
      const { ratePerSqFt } = req.body;
      if (!ratePerSqFt) {
        return res.status(400).json({ error: "ratePerSqFt is required" });
      }

      const updated = await cpqStorage.updateUpteamPricingRate(parseInt(req.params.id), ratePerSqFt);
      if (!updated) {
        return res.status(404).json({ error: "Upteam pricing rate not found" });
      }

      res.json(updated);
    } catch (error) {
      console.error("Error updating upteam pricing rate:", error);
      res.status(500).json({ error: "Failed to update upteam pricing rate" });
    }
  });

  // CAD pricing matrix routes
  router.get("/api/cad-pricing-matrix", async (req, res) => {
    try {
      const allRates = await cpqStorage.getAllCadPricingRates();
      res.json(allRates);
    } catch (error) {
      console.error("Error fetching CAD pricing rates:", error);
      res.status(500).json({ error: "Failed to fetch CAD pricing rates" });
    }
  });

  // Pricing parameters routes
  router.get("/api/pricing-parameters", async (req, res) => {
    try {
      const allParameters = await cpqStorage.getAllPricingParameters();
      res.json(allParameters);
    } catch (error) {
      console.error("Error fetching pricing parameters:", error);
      res.status(500).json({ error: "Failed to fetch pricing parameters" });
    }
  });

  router.patch("/api/pricing-parameters/:id", async (req, res) => {
    try {
      const { parameterValue } = req.body;
      const updated = await cpqStorage.updatePricingParameter(parseInt(req.params.id), String(parameterValue));
      if (!updated) {
        return res.status(404).json({ error: "Pricing parameter not found" });
      }
      res.json(updated);
    } catch (error) {
      console.error("Error updating pricing parameter:", error);
      res.status(500).json({ error: "Failed to update pricing parameter" });
    }
  });
}
