import "dotenv/config";
import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { storage } from "./storage";
import bcrypt from "bcrypt";

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

// Initialize manager user
async function initializeManagerUser() {
  const managerEmail = process.env.MANAGER_EMAIL;
  const managerPassword = process.env.MANAGER_PASSWORD;
  
  if (!managerEmail || !managerPassword) {
    console.error("Manager credentials not found in environment variables");
    return;
  }
  
  try {
    // Check if manager user already exists
    const existingManager = await storage.getUserByEmail(managerEmail);
    
    if (!existingManager) {
      // Create new manager user
      const hashedPassword = await bcrypt.hash(managerPassword, 10);
      const managerUser = await storage.createUser({
        email: managerEmail,
        firstName: "Manager",
        lastName: "Admin",
        fullName: "Manager Admin",
        passwordHash: hashedPassword,
        role: "manager",
        isActive: true,
      });
      console.log(`Manager user created successfully: ${managerUser.email}`);
    } else {
      // Update existing manager user's password if needed
      const isPasswordValid = await bcrypt.compare(managerPassword, existingManager.passwordHash || '');
      if (!isPasswordValid) {
        const hashedPassword = await bcrypt.hash(managerPassword, 10);
        await storage.updateUser(existingManager.id, {
          passwordHash: hashedPassword,
          role: "manager",
          isActive: true,
        });
        console.log(`Manager user password updated: ${existingManager.email}`);
      } else {
        console.log(`Manager user already exists: ${existingManager.email}`);
      }
    }
  } catch (error) {
    console.error("Error initializing manager user:", error);
  }
}

(async () => {
  // Initialize manager user before starting the server
  await initializeManagerUser();
  
  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
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
