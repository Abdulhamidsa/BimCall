import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { Request, Response, NextFunction } from "express";
import { storage } from "./storage";
import { 
  CurrentUser, 
  hasPermission, 
  hasProjectPermission, 
  canEditPoint,
  canAccessProject,
  isBimManager,
  getPermissionSummary,
  PermissionAction
} from "./permissions";
import { Role, User } from "@shared/schema";

declare global {
  namespace Express {
    interface Request {
      currentUser?: CurrentUser;
    }
  }
}

// JWT Configuration
function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret && process.env.NODE_ENV === "production") {
    throw new Error("JWT_SECRET environment variable is required in production");
  }
  return secret || "dev-jwt-secret-not-for-production";
}

const JWT_EXPIRES_IN = "7d";
const SALT_ROUNDS = 10;

const DEV_USER_HEADER = "x-dev-user-id";
const DEV_USER_EMAIL_HEADER = "x-dev-user-email";

// JWT Payload interface
export interface JWTPayload {
  userId: string;
  email: string;
  iat?: number;
  exp?: number;
}

// Password hashing utilities
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// JWT utilities
export function generateToken(payload: { userId: string; email: string }): string {
  return jwt.sign(payload, getJwtSecret(), { expiresIn: JWT_EXPIRES_IN });
}

export function verifyToken(token: string): JWTPayload | null {
  try {
    return jwt.verify(token, getJwtSecret()) as JWTPayload;
  } catch {
    return null;
  }
}

// Cookie utilities
export function setAuthCookie(res: Response, token: string): void {
  res.cookie("auth_token", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    path: "/",
  });
}

export function clearAuthCookie(res: Response): void {
  res.cookie("auth_token", "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 0,
    path: "/",
  });
}

export function getTokenFromRequest(req: Request): string | null {
  // Check cookie first
  if (req.cookies?.auth_token) {
    return req.cookies.auth_token;
  }
  // Then check Authorization header
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) {
    return authHeader.substring(7);
  }
  return null;
}

export async function getCurrentUserFromToken(token: string): Promise<CurrentUser | null> {
  const payload = verifyToken(token);
  if (!payload) return null;

  const userContext = await storage.getUserWithContext(payload.userId);
  if (!userContext || !userContext.user.isActive) return null;

  return {
    id: userContext.user.id,
    email: userContext.user.email,
    name: userContext.user.name,
    roles: userContext.roles,
    companyId: userContext.company?.id ?? null,
    projectIds: userContext.projectIds,
    projectRoles: userContext.projectRoles,
  };
}

// Auth middleware supporting both JWT and dev headers
export async function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    // First, try to get user from JWT token
    const token = getTokenFromRequest(req);
    if (token) {
      const currentUser = await getCurrentUserFromToken(token);
      if (currentUser) {
        req.currentUser = currentUser;
        return next();
      }
    }

    // In development, allow setting user via headers for testing
    if (process.env.NODE_ENV !== "production") {
      let userId: string | undefined;
      userId = req.headers[DEV_USER_HEADER] as string | undefined;
      
      // Also support resolving by email
      const email = req.headers[DEV_USER_EMAIL_HEADER] as string | undefined;
      
      if (!userId && email) {
        const user = await storage.getUserByEmail(email);
        if (user) {
          userId = user.id;
        }
      }
      
      if (userId) {
        const userContext = await storage.getUserWithContext(userId);
        
        if (userContext) {
          req.currentUser = {
            id: userContext.user.id,
            email: userContext.user.email,
            name: userContext.user.name,
            roles: userContext.roles,
            companyId: userContext.company?.id ?? null,
            projectIds: userContext.projectIds,
            projectRoles: userContext.projectRoles,
          };
        }
      }
    }
    
    next();
  } catch (error) {
    console.error("Auth middleware error:", error);
    next();
  }
}

export function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  if (!req.currentUser) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  next();
}

export function requireRole(allowedRoles: Role[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.currentUser) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }
    
    // BIM_MANAGER always has access
    if (isBimManager(req.currentUser)) {
      next();
      return;
    }
    
    const hasRequiredRole = req.currentUser.roles.some(role => 
      allowedRoles.includes(role)
    );
    
    if (!hasRequiredRole) {
      res.status(403).json({ error: "Insufficient permissions" });
      return;
    }
    
    next();
  };
}

export function requirePermission(action: PermissionAction) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.currentUser) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }
    
    if (!hasPermission(req.currentUser, action)) {
      res.status(403).json({ error: "Insufficient permissions for this action" });
      return;
    }
    
    next();
  };
}

export function requireProjectAccess(getProjectId: (req: Request) => string | null) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (!req.currentUser) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }
    
    const projectId = getProjectId(req);
    
    if (projectId && !canAccessProject(req.currentUser, projectId)) {
      res.status(403).json({ error: "Access to this project is not allowed" });
      return;
    }
    
    next();
  };
}

export function requireProjectPermission(
  action: PermissionAction,
  getProjectId: (req: Request) => string | null
) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (!req.currentUser) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }
    
    const projectId = getProjectId(req);
    
    if (!hasProjectPermission(req.currentUser, action, projectId)) {
      res.status(403).json({ error: "Insufficient permissions for this action" });
      return;
    }
    
    next();
  };
}

export async function checkPointEditPermission(
  req: Request,
  res: Response,
  pointId: string
): Promise<boolean> {
  if (!req.currentUser) {
    res.status(401).json({ error: "Authentication required" });
    return false;
  }
  
  const point = await storage.getPoint(pointId);
  if (!point) {
    res.status(404).json({ error: "Point not found" });
    return false;
  }
  
  // Determine projectId from point's meeting or series
  let projectId: string | null = null;
  if (point.meetingId) {
    const meeting = await storage.getMeeting(point.meetingId);
    projectId = meeting?.projectId ?? null;
  } else if (point.seriesId) {
    const series = await storage.getMeetingSeries(point.seriesId);
    projectId = series?.projectId ?? null;
  }
  
  if (!canEditPoint(req.currentUser, point.assignedToRef, projectId)) {
    res.status(403).json({ error: "You can only edit points assigned to you" });
    return false;
  }
  
  return true;
}

export function getCurrentUser(req: Request): CurrentUser | undefined {
  return req.currentUser;
}

export function getCurrentUserPermissions(req: Request): Record<string, boolean> | null {
  if (!req.currentUser) return null;
  return getPermissionSummary(req.currentUser);
}

// Helper to get projectId from various sources
export async function resolveProjectIdFromMeeting(meetingId: string): Promise<string | null> {
  const meeting = await storage.getMeeting(meetingId);
  return meeting?.projectId ?? null;
}

export async function resolveProjectIdFromSeries(seriesId: string): Promise<string | null> {
  const series = await storage.getMeetingSeries(seriesId);
  return series?.projectId ?? null;
}

export async function resolveProjectIdFromPoint(pointId: string): Promise<string | null> {
  const point = await storage.getPoint(pointId);
  if (!point) return null;
  
  if (point.meetingId) {
    return resolveProjectIdFromMeeting(point.meetingId);
  } else if (point.seriesId) {
    return resolveProjectIdFromSeries(point.seriesId);
  }
  
  return null;
}

// ===== Authentication Functions =====

// Extract email domain from email address (e.g., "john@acme.com" -> "acme.com")
export function extractEmailDomain(email: string): string {
  const parts = email.toLowerCase().split('@');
  return parts.length === 2 ? parts[1] : '';
}

// Common public email domains that should not be used for company matching
const PUBLIC_EMAIL_DOMAINS = [
  'gmail.com', 'googlemail.com', 'yahoo.com', 'yahoo.co.uk', 'outlook.com', 
  'hotmail.com', 'live.com', 'msn.com', 'icloud.com', 'me.com', 'mac.com',
  'aol.com', 'protonmail.com', 'proton.me', 'mail.com', 'zoho.com',
  'yandex.com', 'gmx.com', 'gmx.de', 'web.de', 'email.com'
];

// Check if email domain is a public email provider
export function isPublicEmailDomain(domain: string): boolean {
  return PUBLIC_EMAIL_DOMAINS.includes(domain.toLowerCase());
}

// Register a new user with email/password
export async function registerUser(
  email: string,
  password: string,
  name: string
): Promise<{ user: User; token: string }> {
  // Check if user already exists
  const existingUser = await storage.getUserByEmail(email);
  if (existingUser) {
    throw new Error("A user with this email already exists");
  }

  // Validate password
  if (password.length < 8) {
    throw new Error("Password must be at least 8 characters long");
  }

  // Hash password
  const passwordHash = await hashPassword(password);

  // Auto-detect company by email domain
  const emailDomain = extractEmailDomain(email);
  let companyId: string | null = null;
  
  if (emailDomain && !isPublicEmailDomain(emailDomain)) {
    const company = await storage.getCompanyByEmailDomain(emailDomain);
    if (company) {
      companyId = company.id;
    }
  }

  // Create user with VIEWER role by default
  const user = await storage.createUser({
    email: email.toLowerCase(),
    name,
    passwordHash,
    authProvider: "email",
    emailVerified: false,
    isActive: true,
    companyId,
  });

  // Assign default VIEWER role
  await storage.addUserRole(user.id, "VIEWER");

  // Generate token
  const token = generateToken({ userId: user.id, email: user.email });

  return { user, token };
}

// Login with email/password
export async function loginWithEmail(
  email: string,
  password: string
): Promise<{ user: User; token: string }> {
  const user = await storage.getUserByEmail(email.toLowerCase());
  if (!user) {
    throw new Error("Invalid email or password");
  }

  if (!user.isActive) {
    throw new Error("This account has been deactivated");
  }

  if (!user.passwordHash) {
    throw new Error("This account uses social login. Please sign in with Google or Microsoft.");
  }

  const isValid = await verifyPassword(password, user.passwordHash);
  if (!isValid) {
    throw new Error("Invalid email or password");
  }

  // Generate token
  const token = generateToken({ userId: user.id, email: user.email });

  return { user, token };
}

// Login or register with social provider
export async function loginWithSocial(
  provider: "google" | "microsoft",
  providerId: string,
  email: string,
  name: string,
  avatar?: string
): Promise<{ user: User; token: string; isNewUser: boolean }> {
  let user: User | undefined;
  let isNewUser = false;

  // Try to find by provider ID first
  if (provider === "google") {
    user = await storage.getUserByGoogleId(providerId);
  } else {
    user = await storage.getUserByMicrosoftId(providerId);
  }

  // If not found by provider ID, try by email
  if (!user) {
    user = await storage.getUserByEmail(email.toLowerCase());
    
    if (user) {
      // Link the social account to existing user
      const updates: any = {};
      if (provider === "google") {
        updates.googleId = providerId;
      } else {
        updates.microsoftId = providerId;
      }
      if (avatar && !user.avatar) {
        updates.avatar = avatar;
      }
      await storage.updateUser(user.id, updates);
    } else {
      // Create new user
      isNewUser = true;
      
      // Auto-detect company by email domain
      const emailDomain = extractEmailDomain(email);
      let companyId: string | null = null;
      
      if (emailDomain && !isPublicEmailDomain(emailDomain)) {
        const company = await storage.getCompanyByEmailDomain(emailDomain);
        if (company) {
          companyId = company.id;
        }
      }
      
      const userData: any = {
        email: email.toLowerCase(),
        name,
        avatar,
        authProvider: provider,
        emailVerified: true,
        isActive: true,
        companyId,
      };
      
      if (provider === "google") {
        userData.googleId = providerId;
      } else {
        userData.microsoftId = providerId;
      }

      user = await storage.createUser(userData);
      
      // Assign default VIEWER role
      await storage.addUserRole(user.id, "VIEWER");
    }
  }

  if (!user!.isActive) {
    throw new Error("This account has been deactivated");
  }

  // Generate token
  const token = generateToken({ userId: user!.id, email: user!.email });

  return { user: user!, token, isNewUser };
}
