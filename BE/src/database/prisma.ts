import { PrismaClient, Prisma } from "@prisma/client";
import { areSecretsInitialised } from "../clients/secretsClient";

const isDev = process.env.NODE_ENV === "development";

// Configure log levels for Prisma Client
const logLevels: Prisma.LogLevel[] = ["error", "warn"];

// In development mode, add a custom logger to track query performance
const logOptions: Prisma.LogDefinition[] = isDev
  ? [
      { level: "query", emit: "event" },
      { level: "info", emit: "stdout" },
      { level: "warn", emit: "stdout" },
      { level: "error", emit: "stdout" },
    ]
  : [
      { level: "error", emit: "stdout" },
      { level: "warn", emit: "stdout" },
    ];

let prismaInstance: PrismaClient | null = null;

export function updatePrismaClient(): void {
  if (prismaInstance) {
    prismaInstance
      .$disconnect()
      .catch((e: Error) => console.error("Error disconnecting Prisma:", e));
    prismaInstance = null;
  }
}

export function disconnectPrisma(): void {
  if (prismaInstance) {
    prismaInstance.$disconnect();
    prismaInstance = null;
  }
}

export function getPrismaClient(): PrismaClient {
  if (!areSecretsInitialised()) {
    throw new Error(
      "Attempting to access Prisma client before secrets are initialized"
    );
  }

  if (!prismaInstance) {
    const connectionOptions: Prisma.PrismaClientOptions = {
      log: logOptions,
      datasources: {
        db: {
          url: process.env.DATABASE_URL,
        },
      },
    };

    // Create a new Prisma Client instance
    prismaInstance = new PrismaClient(connectionOptions);

    // Add performance monitoring in development mode using events
    if (isDev) {
      (prismaInstance as any).$on("query", (e: Prisma.QueryEvent) => {
        // Use e.query (the SQL query) and e.duration
        console.log(
          `Query took ${e.duration}ms: ${e.query} | Params: ${e.params}`
        );
      });
    }
    process.on("beforeExit", async () => {
      if (prismaInstance) {
        await prismaInstance.$disconnect();
        console.log("Database connection closed gracefully");
      }
    });
  }

  return prismaInstance;
}

const prismaProxy = new Proxy({} as PrismaClient, {
  get(target, prop) {
    const prismaClient = getPrismaClient();
    return typeof prop === "symbol"
      ? (prismaClient as any)[prop]
      : prismaClient[prop as keyof PrismaClient];
  },
});

export default prismaProxy;
