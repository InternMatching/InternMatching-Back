import { type Request } from "express";
import { verifyToken } from "../utils/jwt.js";
import { type Context, type JWTPayload } from "../types/index.js";

/**
 * Extract user from JWT token in request headers
 */
export const getUser = (req: Request): JWTPayload | undefined => {
  const authHeader = req.headers.authorization || "";

  if (authHeader.startsWith("Bearer ")) {
    const token = authHeader.substring(7);
    const decoded = verifyToken(token);

    if (decoded) {
      return decoded;
    }
  }

  return undefined;
};

/**
 * Create GraphQL context with authenticated user
 */
export const createContext = ({ req }: { req: Request }): Context => {
  const user = getUser(req);
  return { user, req: req as any };
};

/**
 * Require authentication - throws error if not authenticated
 */
export const requireAuth = (context: Context): JWTPayload => {
  if (!context.user) {
    throw new Error("Authentication required");
  }
  return context.user;
};

/**
 * Require specific role
 */
export const requireRole = (
  context: Context,
  allowedRoles: string[],
): JWTPayload => {
  const user = requireAuth(context);

  if (!allowedRoles.includes(user.role)) {
    throw new Error("Insufficient permissions");
  }

  return user;
};
