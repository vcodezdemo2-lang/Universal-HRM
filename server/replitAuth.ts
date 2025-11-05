import * as client from "openid-client";
import { Strategy, type VerifyFunction } from "openid-client/passport";

import passport from "passport";
import session from "express-session";
import type { Express, RequestHandler } from "express";
import memoize from "memoizee";
import connectPg from "connect-pg-simple";
import { storage } from "./storage";

if (!process.env.REPLIT_DOMAINS) {
  throw new Error("Environment variable REPLIT_DOMAINS not provided");
}

const getOidcConfig = memoize(
  async () => {
    try {
      console.log("Attempting OAuth discovery...");
      
      // Add timeout to the discovery call
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error("OAuth discovery timeout")), 10000); // 10 second timeout
      });
      
      const discoveryPromise = client.discovery(
        new URL(process.env.ISSUER_URL ?? "https://replit.com/oidc"),
        process.env.REPL_ID!
      );
      
      const config = await Promise.race([discoveryPromise, timeoutPromise]);
      console.log("OAuth discovery successful");
      return config;
    } catch (error) {
      console.error("OAuth discovery failed:", error);
      // Return null to indicate OAuth is not available
      return null;
    }
  },
  { maxAge: 3600 * 1000 }
);

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
      secure: true,
      maxAge: sessionTtl,
    },
  });
}

function updateUserSession(
  user: any,
  tokens: client.TokenEndpointResponse & client.TokenEndpointResponseHelpers
) {
  user.claims = tokens.claims();
  user.access_token = tokens.access_token;
  user.refresh_token = tokens.refresh_token;
  user.expires_at = user.claims?.exp;
}

async function upsertUser(
  claims: any,
) {
  const userEmail = claims["email"] as string;
  const userId = claims["sub"] as string;
  
  // Check if user already exists by email first (more reliable than ID)
  const existingUserByEmail = await storage.getUserByEmail(userEmail);
  
  // For the authorized manager email, always set as manager
  let userRole: 'manager' | 'hr' | 'accounts' | 'admin';
  if (userEmail === "vcinnovatingideas@gmail.com") {
    userRole = 'manager'; // Always set as manager for authorized email
    console.log(`Setting role as manager for authorized user: ${userEmail}`);
  } else if (existingUserByEmail) {
    // Preserve existing role for returning users
    userRole = existingUserByEmail.role as 'manager' | 'hr' | 'accounts' | 'admin';
    console.log(`Preserving existing role ${userRole} for user: ${userEmail}`);
  } else {
    // Default role for new users
    userRole = 'hr';
    console.log(`Setting default role hr for new user: ${userEmail}`);
  }
  
  console.log(`Upserting user ${userEmail} with role: ${userRole}`);
  
  if (existingUserByEmail) {
    // Update existing user, preserving their database ID
    await storage.updateUser(existingUserByEmail.id, {
      firstName: claims["first_name"] as string,
      lastName: claims["last_name"] as string,
      profileImageUrl: claims["profile_image_url"] as string,
      role: userRole,
    });
    console.log(`Updated existing user ${userEmail} (ID: ${existingUserByEmail.id})`);
  } else {
    // Create new user with OAuth ID
    await storage.upsertUser({
      id: userId,
      email: userEmail,
      firstName: claims["first_name"] as string,
      lastName: claims["last_name"] as string,
      profileImageUrl: claims["profile_image_url"] as string,
      role: userRole,
    });
    console.log(`Created new user ${userEmail} (ID: ${userId})`);
  }
  
  // Verify the role was set correctly
  const updatedUser = await storage.getUserByEmail(userEmail);
  console.log(`User ${userEmail} role after upsert: ${updatedUser?.role}`);
}

export async function setupAuth(app: Express) {
  app.set("trust proxy", 1);
  app.use(getSession());
  app.use(passport.initialize());
  app.use(passport.session());

  const config = await getOidcConfig();

  // If OAuth config failed, skip OAuth setup but continue with basic auth
  if (!config) {
    console.warn("OAuth configuration failed - OAuth login will not be available");
    console.log("App will start with password-based authentication only");
    
    passport.serializeUser((user: Express.User, cb) => cb(null, user));
    passport.deserializeUser((user: Express.User, cb) => cb(null, user));
    
    // Provide fallback routes for OAuth endpoints
    app.get("/api/login", (req, res) => {
      res.status(503).json({ 
        message: "OAuth login is currently unavailable. Please use password login at /login" 
      });
    });

    app.get("/api/callback", (req, res) => {
      res.redirect("/login?error=oauth_unavailable");
    });

    app.get("/api/logout", (req, res) => {
      req.logout(() => {
        res.redirect("/");
      });
    });
    
    return;
  }

  console.log("OAuth configuration successful - setting up OAuth authentication");

  const verify: VerifyFunction = async (
    tokens: client.TokenEndpointResponse & client.TokenEndpointResponseHelpers,
    verified: passport.AuthenticateCallback
  ) => {
    const claims = tokens.claims();
    
    if (!claims) {
      console.log("Login attempt blocked - no claims provided");
      return verified(new Error("Invalid login - authentication failed"), null);
    }
    
    const userEmail = claims["email"] as string;
    
    // Check if user exists in database or is the manager
    if (userEmail === "vcinnovatingideas@gmail.com") {
      // Manager account - always allowed
      console.log(`Manager login: ${userEmail}`);
    } else {
      // Check if user exists in database by email (more reliable than ID)
      const userByEmail = await storage.getUserByEmail(userEmail);
      if (!userByEmail) {
        console.log(`Login attempt blocked for unauthorized email: ${userEmail}`);
        return verified(null, false);
      }
      console.log(`Authorized user login: ${userEmail}`);
    }
    
    const user = {};
    updateUserSession(user, tokens);
    await upsertUser(claims);
    verified(null, user);
  };

  for (const domain of process.env
    .REPLIT_DOMAINS!.split(",")) {
    const strategy = new Strategy(
      {
        name: `replitauth:${domain}`,
        config: config!,
        scope: "openid email profile offline_access",
        callbackURL: `https://${domain}/api/callback`,
      },
      verify,
    );
    passport.use(strategy);
  }

  passport.serializeUser((user: Express.User, cb) => cb(null, user));
  passport.deserializeUser((user: Express.User, cb) => cb(null, user));

  app.get("/api/login", (req, res, next) => {
    passport.authenticate(`replitauth:${req.hostname}`, {
      prompt: "login consent",
      scope: ["openid", "email", "profile", "offline_access"],
    })(req, res, next);
  });

  app.get("/api/callback", (req, res, next) => {
    passport.authenticate(`replitauth:${req.hostname}`, {
      successReturnToOrRedirect: "/",
      failureRedirect: "/api/login",
    })(req, res, next);
  });

  app.get("/api/logout", (req, res) => {
    req.logout(() => {
      res.redirect(
        client.buildEndSessionUrl(config!, {
          client_id: process.env.REPL_ID!,
          post_logout_redirect_uri: `${req.protocol}://${req.hostname}`,
        }).href
      );
    });
  });
}

export const isAuthenticated: RequestHandler = async (req, res, next) => {
  const session = (req as any).session;
  const user = req.user as any;

  // Check for password-based session first
  if (session?.user?.loginType === 'password') {
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

  // Handle OAuth authentication
  if (!req.isAuthenticated() || !user?.expires_at) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const now = Math.floor(Date.now() / 1000);
  if (now <= user.expires_at) {
    return next();
  }

  const refreshToken = user.refresh_token;
  if (!refreshToken) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  try {
    const config = await getOidcConfig();
    if (!config) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }
    const tokenResponse = await client.refreshTokenGrant(config, refreshToken);
    updateUserSession(user, tokenResponse);
    return next();
  } catch (error) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }
};
