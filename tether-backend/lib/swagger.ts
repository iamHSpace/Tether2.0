/**
 * lib/swagger.ts
 *
 * Public developer-facing OpenAPI spec. Only GET /api/v1/* endpoints are
 * documented here. Internal routes (auth, admin, webhooks, etc.) are omitted.
 *
 * Served by GET /api/docs  →  rendered at /docs (Swagger UI)
 */

const BACKEND_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://statvora-backend.vercel.app";

export function getSwaggerSpec() {
  return {
    openapi: "3.0.3",

    info: {
      title: "Statvora API",
      version: "1.0.0",
      description: `
## Overview

The Statvora v1 API lets business accounts query creator profiles and their own saved-creator data programmatically.

## Authentication

All v1 endpoints require an API key in the \`Authorization\` header:

\`\`\`
Authorization: Bearer stv_your_key_here
\`\`\`

Generate a key in the **Developer** tab of your [Settings](https://statvora.in/settings) page.

## Base URL

\`${BACKEND_URL}\`

## Errors

All errors follow the shape:
\`\`\`json
{ "error": "Human-readable message" }
\`\`\`
      `.trim(),
    },

    servers: [{ url: BACKEND_URL }],

    tags: [
      { name: "Creators", description: "Search and browse creator profiles" },
      { name: "My Account", description: "Your own business profile and saved creators" },
    ],

    paths: {

      "/api/v1/creators": {
        get: {
          tags: ["Creators"],
          summary: "Search creators",
          description: "Returns paginated creator profiles with their latest YouTube metrics. Sorted by subscriber count by default.",
          security: [{ apiKey: [] }],
          parameters: [
            { name: "q",             in: "query", schema: { type: "string" },  description: "Text search on username or full name" },
            { name: "category",      in: "query", schema: { type: "string" },  description: "Filter by creator category (e.g. `Tech & Science`, `Gaming`)" },
            { name: "creator_stage", in: "query", schema: { type: "string", enum: ["just_starting", "growing", "established", "pro"] }, description: "Filter by creator stage" },
            { name: "sort_by",       in: "query", schema: { type: "string", enum: ["subscribers", "avg_views", "total_views", "video_count"], default: "subscribers" }, description: "Sort field" },
            { name: "limit",         in: "query", schema: { type: "integer", default: 20, maximum: 50 }, description: "Results per page (max 50)" },
            { name: "offset",        in: "query", schema: { type: "integer", default: 0 },  description: "Pagination offset" },
            { name: "min_subs",      in: "query", schema: { type: "integer" }, description: "Minimum subscriber count" },
            { name: "max_subs",      in: "query", schema: { type: "integer" }, description: "Maximum subscriber count" },
            { name: "min_avg_views", in: "query", schema: { type: "integer" }, description: "Minimum average views per video" },
            { name: "max_avg_views", in: "query", schema: { type: "integer" }, description: "Maximum average views per video" },
          ],
          responses: {
            "200": {
              description: "Paginated list of creators",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      creators: { type: "array", items: { $ref: "#/components/schemas/Creator" } },
                      total:    { type: "integer", description: "Total matching results (before pagination)", example: 142 },
                    },
                    required: ["creators", "total"],
                  },
                  example: {
                    creators: [
                      { id: "a1b2c3d4-...", username: "anshulsingh", full_name: "Anshul Singh", category: "Tech & Science", subscribers: 124500, total_views: 8320000, video_count: 312, avg_views: 26666 },
                    ],
                    total: 142,
                  },
                },
              },
            },
            "401": { $ref: "#/components/responses/Unauthorized" },
            "403": { $ref: "#/components/responses/Forbidden" },
          },
        },
      },

      "/api/v1/me": {
        get: {
          tags: ["My Account"],
          summary: "Get your business profile",
          description: "Returns your organisation's profile.",
          security: [{ apiKey: [] }],
          responses: {
            "200": {
              description: "Your business profile",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: { profile: { $ref: "#/components/schemas/BusinessProfile" } },
                    required: ["profile"],
                  },
                },
              },
            },
            "401": { $ref: "#/components/responses/Unauthorized" },
            "403": { $ref: "#/components/responses/Forbidden" },
          },
        },
      },

      "/api/v1/saved": {
        get: {
          tags: ["My Account"],
          summary: "List saved creators",
          description: "Returns the list of creators your organisation has saved.",
          security: [{ apiKey: [] }],
          responses: {
            "200": {
              description: "Saved creator list",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      saved: {
                        type: "array",
                        items: {
                          type: "object",
                          properties: {
                            creator_username: { type: "string", example: "anshulsingh" },
                            saved_at:         { type: "string", format: "date-time" },
                          },
                          required: ["creator_username", "saved_at"],
                        },
                      },
                    },
                    required: ["saved"],
                  },
                },
              },
            },
            "401": { $ref: "#/components/responses/Unauthorized" },
            "403": { $ref: "#/components/responses/Forbidden" },
          },
        },
      },
    },

    components: {
      securitySchemes: {
        apiKey: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "stv_<key>",
          description: "API key generated from the Developer tab in Settings. Format: `stv_<64-hex-chars>`.",
        },
      },

      responses: {
        Unauthorized: {
          description: "Missing or invalid API key",
          content: { "application/json": { schema: { $ref: "#/components/schemas/Error" }, example: { error: "Missing or invalid API key. Expected Authorization: Bearer stv_<key>" } } },
        },
        Forbidden: {
          description: "API key revoked or expired",
          content: { "application/json": { schema: { $ref: "#/components/schemas/Error" }, example: { error: "API key has been revoked" } } },
        },
      },

      schemas: {

        Creator: {
          type: "object",
          description: "Creator profile with latest YouTube metrics",
          properties: {
            id:            { type: "string", format: "uuid" },
            username:      { type: "string", example: "anshulsingh" },
            full_name:     { type: "string", nullable: true, example: "Anshul Singh" },
            bio:           { type: "string", nullable: true },
            category:      { type: "string", nullable: true, example: "Tech & Science" },
            creator_stage: { type: "string", nullable: true, example: "micro" },
            avatar_url:    { type: "string", nullable: true },
            updated_at:    { type: "string", format: "date-time" },
            subscribers:   { type: "integer", example: 124500 },
            total_views:   { type: "integer", example: 8320000 },
            video_count:   { type: "integer", example: 312 },
            avg_views:     { type: "integer", example: 26666 },
          },
          required: ["id", "username", "subscribers", "total_views", "video_count", "avg_views"],
        },

        BusinessProfile: {
          type: "object",
          properties: {
            id:           { type: "string", format: "uuid" },
            username:     { type: "string", nullable: true },
            company_name: { type: "string", nullable: true, example: "Acme Corp" },
            full_name:    { type: "string", nullable: true },
            bio:          { type: "string", nullable: true },
            website:      { type: "string", nullable: true, example: "https://acme.com" },
            avatar_url:   { type: "string", nullable: true },
            user_type:    { type: "string", example: "business" },
            updated_at:   { type: "string", format: "date-time" },
          },
          required: ["id", "user_type"],
        },

        Error: {
          type: "object",
          properties: { error: { type: "string" } },
          required: ["error"],
        },
      },
    },
  };
}
