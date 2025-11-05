import type { Express, RequestHandler } from "express";
import session from "express-session";
import connectPg from "connect-pg-simple";
import { storage } from "./storage";

export function getSession() {
  const sessionTtl = 7 * 24 * 60 * 60 * 1000; // 1 week
  const pgStore = connectPg(session);
  const sessionStore = new pgStore({
    conString: process.env.DATABASE_URL,
    createTableIfMissing: false,
    ttl: sessionTtl,
    tableName: "sessions",
  });
  return session({
    secret: process.env.SESSION_SECRET!,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: false, // Changed to false for local development
      maxAge: sessionTtl,
    },
  });
}

export async function setupAuth(app: Express) {
  app.set("trust proxy", 1);
  app.use(getSession());
  
  // Simple logout routes (both GET and POST for compatibility)
  app.get("/api/logout", (req, res) => {
    const session = (req as any).session;
    if (session?.user) {
      delete session.user;
    }
    res.redirect("/login");
  });
  
  app.post("/api/logout", (req, res) => {
    const session = (req as any).session;
    if (session?.user) {
      delete session.user;
    }
    res.json({ success: true, message: "Logged out successfully" });
  });
  
  console.log("Password-based authentication system initialized");
}

export const isAuthenticated: RequestHandler = async (req, res, next) => {
  const session = (req as any).session;

  // Check for password-based session
  if (session?.user?.loginType === 'password') {
    // Handle hardcoded manager login
    if (session.user.id === 'hardcoded-manager-id') {
      (req as any).user = {
        claims: {
          sub: session.user.id,
          email: session.user.email,
        },
        role: 'manager',
        loginType: 'password'
      };
      return next();
    }

    // Verify the user still exists and is active
    try {
      const dbUser = await storage.getUser(session.user.id);
      if (!dbUser || !dbUser.isActive) {
        delete session.user;
        return res.status(401).json({ message: "Unauthorized" });
      }
      
      // Attach user info to request for route handlers
      (req as any).user = {
        claims: {
          sub: dbUser.id,
          email: dbUser.email,
        },
        role: dbUser.role,
        loginType: 'password'
      };
      
      return next();
    } catch (error) {
      delete session.user;
      return res.status(401).json({ message: "Unauthorized" });
    }
  }

  // No valid session found
  return res.status(401).json({ message: "Unauthorized" });
};