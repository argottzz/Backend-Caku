import type { UserRole } from "./auth.ts";

export type AdminApplicationStatus = "pending" | "approved" | "rejected";

export interface AdminApplication {
  id_user: number;
  nama: string;
  email: string;
  role: UserRole;
  admin_application_status: AdminApplicationStatus | null;
  admin_application_date: Date | null;
  admin_reviewed_at: Date | null;
  admin_reviewed_by: number | null;
  admin_rejection_reason: string | null;
  admin_reviewer_nama: string | null;
}

export type AdminApplicationDecision = "approve" | "reject";
