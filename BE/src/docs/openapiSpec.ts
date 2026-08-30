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
          archived: { type: "boolean" },
          senderId: { type: "string" },
          sender: { $ref: "#/components/schemas/MailUser" },
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
        summary: "The caller's current delivery window (received, not archived), oldest first",
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
            description: "Missing recipient, empty body, or the recipient is the sender",
            content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
          },
          "401": {
            description: "Unauthorized",
            content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
          },
          "409": {
            description:
              "An earlier letter to this recipient is still in flight (`received` is false). " +
              "One letter at a time per direction, so the recipient never holds two live " +
              "letters from the same sender.",
            content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
          },
        },
      },
    },
    "/mail/{id}": {
      get: {
        summary: "Download the gzipped recording bytes for a mail's attachment",
        description:
          "`id` is the Recording id (Mail.recordingId), not the mail's own id. " +
          "The caller must be the sender, or the recipient of a letter in their current " +
          "delivery window (`received` and not `archived`); anyone else — including the " +
          "recipient before delivery, or after the letter has been retired — gets 404.",
        tags: ["Mail"],
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string" } },
        ],
        responses: {
          "200": {
            description: "Gzipped recording bytes",
            content: { "application/octet-stream": { schema: { type: "string", format: "binary" } } },
          },
          "404": {
            description: "Recording not found, or not the caller's to read",
            content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
          },
        },
      },
    },
    "/mail/{id}/read": {
      put: {
        summary: "Mark one delivered letter read (recipient only)",
        tags: ["Mail"],
        security: [{ bearerAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }],
        responses: {
          "200": {
            description: "Updated",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: { id: { type: "integer" }, read: { type: "boolean" } },
                },
              },
            },
          },
          "403": {
            description: "Not the recipient",
            content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
          },
          "404": {
            description: "Mail not found",
            content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
          },
        },
      },
    },
    "/delivery/run": {
      post: {
        summary: "Run a mail delivery pass now",
        description:
          "Delivers to every user whose scheduledMail has passed: archives their current " +
          "window, marks pending letters received, and rolls scheduledMail to a random time " +
          "the next day. The same service runs on a cron every minute. Guarded by the " +
          "DELIVERY_SECRET shared secret, and disabled when that is unset.",
        tags: ["Delivery"],
        parameters: [
          { name: "x-delivery-secret", in: "header", required: true, schema: { type: "string" } },
        ],
        responses: {
          "200": {
            description: "Delivery report",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    users: { type: "integer" },
                    delivered: { type: "integer" },
                    archived: { type: "integer" },
                  },
                },
              },
            },
          },
          "401": {
            description: "Invalid delivery secret",
            content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
          },
          "503": {
            description: "DELIVERY_SECRET is not configured",
            content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
          },
        },
      },
    },
    "/sendNow": {
      post: {
        summary: "Deliver everyone's mail immediately",
        description:
          "Delivers to every user regardless of scheduledMail: archives their current " +
          "window, marks pending letters received, and rolls scheduledMail to a random time " +
          "the next day. Unlike POST /delivery/run, which only covers users already due, " +
          "this forces a pass for everyone. Guarded by the DELIVERY_SECRET shared secret, " +
          "and disabled when that is unset.",
        tags: ["Delivery"],
        parameters: [
          { name: "x-delivery-secret", in: "header", required: true, schema: { type: "string" } },
        ],
        responses: {
          "200": {
            description: "Delivery report",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    users: { type: "integer" },
                    delivered: { type: "integer" },
                    archived: { type: "integer" },
                  },
                },
              },
            },
          },
          "401": {
            description: "Invalid delivery secret",
            content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
          },
          "503": {
            description: "DELIVERY_SECRET is not configured",
            content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
          },
        },
      },
    },
    "/user/by-username/{username}": {
      get: {
        summary: "Resolve a username to the id required by POST /mail/{recipientId}",
        tags: ["MailUser"],
        parameters: [
          { name: "username", in: "path", required: true, schema: { type: "string" } },
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
    "/user/me/friends": {
      get: {
        summary: "The authenticated user's friends (both sides of the relation, deduplicated)",
        tags: ["MailUser"],
        security: [{ bearerAuth: [] }],
        responses: {
          "200": {
            description: "Friends",
            content: {
              "application/json": {
                schema: { type: "array", items: { $ref: "#/components/schemas/MailUser" } },
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
                properties: {
                  username: {
                    type: "string",
                    description:
                      "3–24 characters after trimming; letters, numbers, dots, dashes and " +
                      "underscores only. Stored trimmed.",
                    minLength: 3,
                    maxLength: 24,
                    pattern: "^[a-zA-Z0-9._-]+$",
                  },
                },
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
            description: "Missing username, or one that breaks the length/character rule",
            content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
          },
          "404": {
            description: "No MailUser with that id",
            content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
          },
          "409": {
            description: "That username is already taken by another account",
            content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
          },
        },
      },
    },
  },
} as const;
