import type { Request } from "express";
import jwt, { type JwtPayload, type SignOptions } from "jsonwebtoken";
import { env } from "../config/env.ts";
import type { AuthUser, UserRole } from "../types/auth.ts";

const ROLES: UserRole[] = ["admin", "customer"];

export function extractToken(req: Request): string | null {
  const authorization = req.headers.authorization;

  if (!authorization?.startsWith("Bearer ")) {
    return null;
  }

  const token = authorization.slice("Bearer ".length).trim();
  return token || null;
}

function toAuthUser(payload: JwtPayload): AuthUser | null {
  const { id, nama, email, role } = payload;

  if (
    typeof id !== "number" ||
    typeof nama !== "string" ||
    typeof email !== "string" ||
    typeof role !== "string" ||
    !ROLES.includes(role as UserRole)
  ) {
    return null;
  }

  return { id, nama, email, role: role as UserRole };
}

export function decodeToken(token: string): AuthUser | null {
  try {
    const payload = jwt.verify(token, env.jwtSecret);

    if (typeof payload === "string") {
      return null;
    }

    return toAuthUser(payload);
  } catch {
    return null;
  }
}

export function signToken(user: AuthUser): string {
  const options: SignOptions = {
    expiresIn: env.jwtExpiresIn as SignOptions["expiresIn"],
  };

  return jwt.sign(
    {
      id: user.id,
      nama: user.nama,
      email: user.email,
      role: user.role,
    },
    env.jwtSecret,
    options,
  );
}
