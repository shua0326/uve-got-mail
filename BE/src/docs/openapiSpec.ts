export const openapiSpec = {
  openapi: "3.0.3",
  info: {
    title: "U've Got Mail API",
    version: "1.0.0",
    description: "Replayable tldraw moodboard — backend API.",
  },
  servers: [{ url: "/" }],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: "http",
        scheme: "bearer",
        description: "Supabase access token, e.g. from `session.access_token`.",
      },
    },
    schemas: {
      MailUser: {
        type: "object",
        properties: {
          id: { type: "string" },
          email: { type: "string", format: "email" },
          username: { type: "string" },
          scheduledMail: { type: "string", format: "date-time", nullable: true },
        },
      },
      Mail: {
        type: "object",
        properties: {
          id: { type: "integer" },
          sentAt: { type: "string", format: "date-time" },
          read: { type: "boolean" },
          received: { type: "boolean" },
          senderId: { type: "string" },
          recipientId: { type: "string" },
          historyId: { type: "string" },
          recordingId: { type: "string" },
        },
      },
      Error: {
        type: "object",
        properties: {
          error: { type: "string" },
          message: { type: "string" },
        },
      },
    },
  },
  paths: {
    "/health": {
      get: {
        summary: "Health check",
        tags: ["Health"],
        responses: {
          "200": {
            description: "Server is up",
            content: {
              "application/json": {
                schema: { type: "object", properties: { status: { type: "string" } } },
              },
            },
          },
        },
      },
    },
    "/auth/callback": {
      post: {
        summary: "Verify a Supabase session and provision the MailUser row",
        tags: ["Auth"],
        security: [{ bearerAuth: [] }],
        responses: {
          "200": {
            description: "Authenticated",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    message: { type: "string" },
                    user: {
                      type: "object",
                      properties: { id: { type: "string" }, email: { type: "string" } },
                    },
                  },
                },
              },
            },
          },
          "401": {
            description: "Missing/invalid token",
            content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
          },
        },
      },
    },
    "/giphy/search": {
      get: {
        summary: "Search Giphy (proxied, cached 1h server-side)",
        tags: ["Giphy"],
        parameters: [
          { name: "q", in: "query", required: true, schema: { type: "string" } },
          {
            name: "type",
            in: "query",
            schema: { type: "string", enum: ["gifs", "stickers"], default: "gifs" },
          },
          { name: "offset", in: "query", schema: { type: "string", default: "0" } },
        ],
        responses: {
          "200": { description: "Giphy API response, passed through" },
          "502": {
            description: "Upstream Giphy failure",
            content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
          },
        },
      },
    },
    "/mail": {
      get: {
        summary: "Get unread, delivered mail for the authenticated user",
        tags: ["Mail"],
        security: [{ bearerAuth: [] }],
        responses: {
          "200": {
            description: "List of mail",
            content: {
              "application/json": {
                schema: { type: "array", items: { $ref: "#/components/schemas/Mail" } },
              },
            },
          },
          "401": {
            description: "Unauthorized",
            content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
          },
        },
      },
    },
    "/mail/{recipientId}": {
      post: {
        summary: "Send a letter (uploads the gzipped recording, creates the Mail row)",
        tags: ["Mail"],
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: "recipientId", in: "path", required: true, schema: { type: "string" } },
        ],
        requestBody: {
          required: true,
          content: {
            "application/octet-stream": {
              schema: { type: "string", format: "binary" },
            },
          },
        },
        responses: {
          "200": {
            description: "Created",
            content: {
              "application/json": {
                schema: { type: "object", properties: { id: { type: "integer" } } },
              },
            },
          },
          "400": {
            description: "Missing recipient or empty body",
            content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
          },
          "401": {
            description: "Unauthorized",
            content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
          },
        },
      },
    },
    "/mail/{id}": {
      get: {
        summary: "Download the gzipped recording bytes for a mail's attachment",
        tags: ["Mail"],
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string" } },
        ],
        responses: {
          "200": {
            description: "Gzipped recording bytes",
            content: { "application/octet-stream": { schema: { type: "string", format: "binary" } } },
          },
          "404": {
            description: "Recording not found",
            content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
          },
        },
      },
    },
    "/user/{id}": {
      get: {
        summary: "Get a MailUser by id",
        tags: ["User"],
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string" } },
        ],
        responses: {
          "200": {
            description: "The MailUser",
            content: { "application/json": { schema: { $ref: "#/components/schemas/MailUser" } } },
          },
          "404": {
            description: "Not found",
            content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
          },
        },
      },
    },
    "/user/{id}/username": {
      post: {
        summary: "Set a MailUser's username",
        tags: ["User"],
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string" } },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["username"],
                properties: { username: { type: "string" } },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Updated MailUser",
            content: { "application/json": { schema: { $ref: "#/components/schemas/MailUser" } } },
          },
          "400": {
            description: "Missing username",
            content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
          },
        },
      },
    },
  },
} as const;
