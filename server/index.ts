import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { logError, scheduleLogCleanup } from "./logger";
import { initializeJobScheduler } from "./jobScheduler";
import { storage } from "./storage";
import { migrateDescriptionsToPlainText } from "./migrate-descriptions";
import { seedPlatformHeaders } from "./seedPlatformHeaders";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  // Initialize log cleanup scheduler
  scheduleLogCleanup();
  
  // Initialize job scheduler for event archiving
  await initializeJobScheduler();
  
  // Initialize currency system accounts
  await storage.initializeSystemAccounts();
  
  // Initialize roles and permissions
  await storage.initializeRolesAndPermissions();
  
  // Migrate existing admin users to super_admin role
  await storage.migrateExistingAdmins();
  
  // Initialize special codes
  try {
    const nerdCode = await storage.validateSecretCode("NERRRRRD!");
    if (!nerdCode) {
      await storage.createSecretCode({
        code: "NERRRRRD!",
        ticketAmount: 3,
        maxUses: null, // Unlimited uses (one per user)
        codeType: "special"
      });
      console.log("[INIT] Created NERRRRRD! special code");
    }
    
    const missionCode = await storage.validateSecretCode("URM1550N");
    if (!missionCode) {
      await storage.createSecretCode({
        code: "URM1550N",
        ticketAmount: 3,
        maxUses: null, // Unlimited uses (one per user)
        codeType: "special"
      });
      console.log("[INIT] Created URM1550N special code");
    }
  } catch (error) {
    console.error("[INIT] Failed to create special codes:", error);
  }
  
  // Migrate HTML descriptions to plain text
  try {
    await migrateDescriptionsToPlainText();
  } catch (error) {
    console.error("[MIGRATION] Failed to convert descriptions:", error);
    // Don't stop server startup if migration fails
  }
  
  // Seed platform headers if needed
  try {
    await seedPlatformHeaders();
  } catch (error) {
    console.error("[SEED] Failed to seed platform headers:", error);
    // Don't stop server startup if seeding fails
  }
  
  const server = await registerRoutes(app);

  app.use(async (err: any, req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    // Log the error to system logs
    await logError(err, `${req.method} ${req.path}`, {
      request: req,
      metadata: {
        statusCode: status,
        query: req.query,
        body: req.body,
        params: req.params,
      }
    });

    res.status(status).json({ message });
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || '5000', 10);
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`serving on port ${port}`);
  });
})();
