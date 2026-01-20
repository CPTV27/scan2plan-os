import swaggerJsdoc from "swagger-jsdoc";

const options: swaggerJsdoc.Options = {
    definition: {
        openapi: "3.0.0",
        info: {
            title: "Scan2Plan OS API",
            version: "1.0.0",
            description: `
# Scan2Plan OS API Documentation

End-to-end operating system for laser scanning and BIM services.

## Authentication
Most endpoints require authentication via session cookie. Use the \`/api/test-login\` endpoint in development to authenticate.

## Rate Limits
- Standard endpoints: 100 requests/minute
- AI endpoints: 10 requests/minute

## Modules
- **Leads & CPQ** - Sales pipeline and quoting
- **Projects** - Project management and delivery
- **Intelligence** - AI-powered content generation
- **Brand Engine** - Brand-compliant content
- **Signatures** - E-signature via DocuSeal
- **RFP Automation** - Automated proposal generation
      `,
            contact: {
                name: "Scan2Plan Support",
                email: "support@scan2plan.io",
            },
        },
        servers: [
            {
                url: "/api",
                description: "API Base URL",
            },
        ],
        tags: [
            { name: "Auth", description: "Authentication endpoints" },
            { name: "Leads", description: "Lead and prospect management" },
            { name: "CPQ", description: "Configure, Price, Quote" },
            { name: "Projects", description: "Project delivery management" },
            { name: "Intelligence", description: "AI-powered features" },
            { name: "Brand", description: "Brand Engine endpoints" },
            { name: "Signatures", description: "E-signature (DocuSeal)" },
            { name: "RFP", description: "RFP Automation" },
            { name: "Health", description: "System health checks" },
        ],
        components: {
            securitySchemes: {
                cookieAuth: {
                    type: "apiKey",
                    in: "cookie",
                    name: "connect.sid",
                },
            },
            schemas: {
                Lead: {
                    type: "object",
                    properties: {
                        id: { type: "integer" },
                        clientName: { type: "string" },
                        projectName: { type: "string" },
                        projectAddress: { type: "string" },
                        buildingType: { type: "string" },
                        sqft: { type: "integer" },
                        dealStage: { type: "string" },
                        contactName: { type: "string" },
                        contactEmail: { type: "string" },
                        contactPhone: { type: "string" },
                        createdAt: { type: "string", format: "date-time" },
                    },
                },
                Quote: {
                    type: "object",
                    properties: {
                        id: { type: "integer" },
                        leadId: { type: "integer" },
                        totalPrice: { type: "number" },
                        status: { type: "string", enum: ["draft", "sent", "accepted", "rejected"] },
                        validUntil: { type: "string", format: "date-time" },
                    },
                },
                Project: {
                    type: "object",
                    properties: {
                        id: { type: "integer" },
                        name: { type: "string" },
                        status: { type: "string" },
                        projectManager: { type: "string" },
                        startDate: { type: "string", format: "date-time" },
                        deliveryDate: { type: "string", format: "date-time" },
                    },
                },
                RfpSubmission: {
                    type: "object",
                    properties: {
                        id: { type: "integer" },
                        status: {
                            type: "string",
                            enum: ["pending", "extracting", "extracted", "generating", "proposal_ready", "approved", "sent", "rejected"]
                        },
                        originalFileName: { type: "string" },
                        extractedData: { type: "object" },
                        createdAt: { type: "string", format: "date-time" },
                    },
                },
                Error: {
                    type: "object",
                    properties: {
                        error: { type: "string" },
                        message: { type: "string" },
                    },
                },
                Success: {
                    type: "object",
                    properties: {
                        success: { type: "boolean" },
                        message: { type: "string" },
                    },
                },
            },
        },
        paths: {
            // Health
            "/health": {
                get: {
                    tags: ["Health"],
                    summary: "System health check",
                    responses: {
                        "200": { description: "System is healthy" },
                    },
                },
            },
            // Auth
            "/auth/user": {
                get: {
                    tags: ["Auth"],
                    summary: "Get current user",
                    security: [{ cookieAuth: [] }],
                    responses: {
                        "200": { description: "Current user info" },
                        "401": { description: "Not authenticated" },
                    },
                },
            },
            // Leads
            "/leads": {
                get: {
                    tags: ["Leads"],
                    summary: "List all leads",
                    security: [{ cookieAuth: [] }],
                    parameters: [
                        { name: "limit", in: "query", schema: { type: "integer", default: 50 } },
                        { name: "dealStage", in: "query", schema: { type: "string" } },
                    ],
                    responses: {
                        "200": { description: "Array of leads" },
                    },
                },
                post: {
                    tags: ["Leads"],
                    summary: "Create a new lead",
                    security: [{ cookieAuth: [] }],
                    requestBody: {
                        content: {
                            "application/json": {
                                schema: { $ref: "#/components/schemas/Lead" },
                            },
                        },
                    },
                    responses: {
                        "201": { description: "Lead created" },
                    },
                },
            },
            "/leads/{id}": {
                get: {
                    tags: ["Leads"],
                    summary: "Get lead by ID",
                    security: [{ cookieAuth: [] }],
                    parameters: [
                        { name: "id", in: "path", required: true, schema: { type: "integer" } },
                    ],
                    responses: {
                        "200": { description: "Lead details" },
                        "404": { description: "Lead not found" },
                    },
                },
            },
            // CPQ
            "/cpq-quotes": {
                get: {
                    tags: ["CPQ"],
                    summary: "List quotes",
                    security: [{ cookieAuth: [] }],
                    responses: {
                        "200": { description: "Array of quotes" },
                    },
                },
            },
            "/cpq-quotes/{id}": {
                get: {
                    tags: ["CPQ"],
                    summary: "Get quote by ID",
                    security: [{ cookieAuth: [] }],
                    parameters: [
                        { name: "id", in: "path", required: true, schema: { type: "integer" } },
                    ],
                    responses: {
                        "200": { description: "Quote details" },
                    },
                },
            },
            // Signatures
            "/signatures/send": {
                post: {
                    tags: ["Signatures"],
                    summary: "Send document for signature",
                    security: [{ cookieAuth: [] }],
                    requestBody: {
                        content: {
                            "application/json": {
                                schema: {
                                    type: "object",
                                    required: ["recipientEmail", "pdfBase64"],
                                    properties: {
                                        quoteId: { type: "integer" },
                                        recipientEmail: { type: "string" },
                                        recipientName: { type: "string" },
                                        pdfBase64: { type: "string" },
                                        documentName: { type: "string" },
                                    },
                                },
                            },
                        },
                    },
                    responses: {
                        "201": { description: "Signature request sent" },
                        "503": { description: "DocuSeal not configured" },
                    },
                },
            },
            "/signatures/{id}/status": {
                get: {
                    tags: ["Signatures"],
                    summary: "Check signature status",
                    security: [{ cookieAuth: [] }],
                    parameters: [
                        { name: "id", in: "path", required: true, schema: { type: "string" } },
                    ],
                    responses: {
                        "200": { description: "Signature status" },
                    },
                },
            },
            // RFP Automation
            "/rfp/upload": {
                post: {
                    tags: ["RFP"],
                    summary: "Upload RFP for processing",
                    security: [{ cookieAuth: [] }],
                    requestBody: {
                        content: {
                            "application/json": {
                                schema: {
                                    type: "object",
                                    required: ["fileName"],
                                    properties: {
                                        fileName: { type: "string" },
                                        fileUrl: { type: "string" },
                                        fileType: { type: "string" },
                                        fileContent: { type: "string" },
                                    },
                                },
                            },
                        },
                    },
                    responses: {
                        "201": { description: "RFP uploaded" },
                    },
                },
            },
            "/rfp/queue": {
                get: {
                    tags: ["RFP"],
                    summary: "CEO review queue",
                    security: [{ cookieAuth: [] }],
                    responses: {
                        "200": { description: "Array of RFPs pending review" },
                    },
                },
            },
            "/rfp/{id}/approve": {
                post: {
                    tags: ["RFP"],
                    summary: "Approve RFP proposal",
                    security: [{ cookieAuth: [] }],
                    parameters: [
                        { name: "id", in: "path", required: true, schema: { type: "integer" } },
                    ],
                    responses: {
                        "200": { description: "RFP approved" },
                    },
                },
            },
            // Brand Engine
            "/brand/personas": {
                get: {
                    tags: ["Brand"],
                    summary: "List brand personas",
                    security: [{ cookieAuth: [] }],
                    responses: {
                        "200": { description: "Array of personas" },
                    },
                },
            },
            "/brand/standards": {
                get: {
                    tags: ["Brand"],
                    summary: "List standard definitions",
                    security: [{ cookieAuth: [] }],
                    responses: {
                        "200": { description: "Array of standards" },
                    },
                },
            },
            "/brand/capabilities": {
                get: {
                    tags: ["Brand"],
                    summary: "List company capabilities",
                    security: [{ cookieAuth: [] }],
                    parameters: [
                        { name: "category", in: "query", schema: { type: "string", enum: ["core", "service", "unique", "differentiator", "risk"] } },
                    ],
                    responses: {
                        "200": { description: "Array of capabilities" },
                    },
                },
            },
            "/brand/ai-expand": {
                post: {
                    tags: ["Brand"],
                    summary: "AI-generate brand content",
                    security: [{ cookieAuth: [] }],
                    requestBody: {
                        content: {
                            "application/json": {
                                schema: {
                                    type: "object",
                                    required: ["type"],
                                    properties: {
                                        type: { type: "string", enum: ["persona", "redline", "standard"] },
                                        context: { type: "string" },
                                        count: { type: "integer", default: 3 },
                                    },
                                },
                            },
                        },
                    },
                    responses: {
                        "200": { description: "AI suggestions generated" },
                    },
                },
            },
        },
    },
    apis: [], // Using inline definitions above
};

export const swaggerSpec = swaggerJsdoc(options);
