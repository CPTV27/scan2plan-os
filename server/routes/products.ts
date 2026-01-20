import { Router } from "express";
import { asyncHandler } from "../middleware/errorHandler";
import { db } from "../db";
import { products } from "@shared/schema";
import { eq, like, or, and, isNull, not } from "drizzle-orm";
import skuMapper from "../lib/skuMapper";
import { log } from "../lib/logger";

export const productsRouter = Router();

// GET /api/products - List all products with optional filtering
productsRouter.get(
  "/api/products",
  asyncHandler(async (req, res) => {
    const { category, search, active } = req.query;

    let query = db.query.products.findMany({
      orderBy: (p, { asc }) => [asc(p.category), asc(p.name)],
    });

    const allProducts = await db.query.products.findMany({
      orderBy: (p, { asc }) => [asc(p.category), asc(p.name)],
    });

    let filtered = allProducts;

    if (category && typeof category === "string") {
      filtered = filtered.filter((p) => p.category === category);
    }

    if (search && typeof search === "string") {
      const searchLower = search.toLowerCase();
      filtered = filtered.filter(
        (p) =>
          p.sku.toLowerCase().includes(searchLower) ||
          p.name.toLowerCase().includes(searchLower)
      );
    }

    if (active === "true") {
      filtered = filtered.filter((p) => p.active);
    }

    res.json(filtered);
  })
);

// GET /api/products/categories - List unique categories
productsRouter.get(
  "/api/products/categories",
  asyncHandler(async (req, res) => {
    const allProducts = await db.query.products.findMany();
    const categoriesSet = new Set(allProducts.map((p) => p.category));
    const categories = Array.from(categoriesSet).sort();
    res.json(categories);
  })
);

// GET /api/products/sku/:sku - Get product by SKU
productsRouter.get(
  "/api/products/sku/:sku",
  asyncHandler(async (req, res) => {
    const { sku } = req.params;
    const product = await skuMapper.lookupProductBySku(sku);

    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }

    res.json(product);
  })
);

// GET /api/products/:id - Get product by ID
productsRouter.get(
  "/api/products/:id",
  asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ error: "Invalid product ID" });
    }

    const product = await db.query.products.findFirst({
      where: eq(products.id, id),
    });

    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }

    res.json(product);
  })
);

// POST /api/products/resolve-sku - Resolve CPQ config to official SKU
productsRouter.post(
  "/api/products/resolve-sku",
  asyncHandler(async (req, res) => {
    const { buildingType, discipline, lod, scope, service, modifier } =
      req.body;

    let sku: string;

    if (service) {
      sku = skuMapper.getServiceSku(service);
    } else if (modifier) {
      sku = skuMapper.getPriceModSku(modifier);
    } else if (
      discipline === "architecture" ||
      discipline === "arch" ||
      !discipline
    ) {
      sku = skuMapper.getPrimaryServiceSku(
        buildingType || "1",
        lod || "300",
        scope || "full"
      );
    } else {
      sku = skuMapper.getAddedDisciplineSku(discipline, lod || "300");
    }

    const product = await skuMapper.lookupProductBySku(sku);

    res.json({
      sku,
      found: !!product,
      product: product || null,
    });
  })
);

// POST /api/products/generate-quote-skus - Generate SKUs for a quote configuration
productsRouter.post(
  "/api/products/generate-quote-skus",
  asyncHandler(async (req, res) => {
    const { areas, services, risks, paymentTerms } = req.body;

    if (!areas || !Array.isArray(areas)) {
      return res.status(400).json({ error: "Areas array is required" });
    }

    const lineItems = await skuMapper.generateQuoteSkus(
      areas,
      services || {},
      risks || [],
      paymentTerms
    );

    res.json({ lineItems });
  })
);
