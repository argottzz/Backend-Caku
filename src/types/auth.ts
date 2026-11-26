import type { Request } from "express";

export type UserRole = "admin" | "customer";

export interface AuthUser {
  id: number;
  nama: string;
  email: string;
  role: UserRole;
  profile_image: string | null;
}

export interface AuthenticatedRequest extends Request {
  user: AuthUser;
}
