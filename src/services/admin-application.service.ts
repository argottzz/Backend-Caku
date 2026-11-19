import pool, { withTransaction } from "../db/index.ts";
import type { AuthUser, UserRole } from "../types/auth.ts";
import type {
  AdminApplication,
  AdminApplicationDecision,
  AdminApplicationStatus,
} from "../types/admin-application.ts";
import { AppError } from "../utils/app-error.ts";
import type { AdminApplicationQueryInput } from "../validations/admin-application.validation.ts";

interface AdminApplicationRow {
  id_user: number;
  nama: string;
  email: string;
  role: UserRole;
  admin_application_status: AdminApplicationStatus | null;
  admin_application_date: Date | null;
  admin_reviewed_at: Date | null;
  admin_reviewed_by: number | null;
  admin_rejection_reason: string | null;
  admin_reviewer_nama?: string | null;
}

interface ApplicantRow {
  id_user: number;
  role: UserRole;
  admin_application_status: AdminApplicationStatus | null;
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface AdminApplicationListResult {
  applications: AdminApplication[];
  pagination: Pagination;
}

const APPLICATION_SELECT = `
  SELECT
    u.id_user,
    u.nama,
    u.email,
    u.role,
    u.admin_application_status,
    u.admin_application_date,
    u.admin_reviewed_at,
    u.admin_reviewed_by,
    u.admin_rejection_reason,
    reviewer.nama AS admin_reviewer_nama
  FROM users u
  LEFT JOIN users reviewer ON reviewer.id_user = u.admin_reviewed_by
`;

const APPLICATION_RETURNING = `
  RETURNING
    id_user,
    nama,
    email,
    role,
    admin_application_status,
    admin_application_date,
    admin_reviewed_at,
    admin_reviewed_by,
    admin_rejection_reason
`;

function toApplication(row: AdminApplicationRow): AdminApplication {
  return {
    id_user: row.id_user,
    nama: row.nama,
    email: row.email,
    role: row.role,
    admin_application_status: row.admin_application_status,
    admin_application_date: row.admin_application_date,
    admin_reviewed_at: row.admin_reviewed_at,
    admin_reviewed_by: row.admin_reviewed_by,
    admin_rejection_reason: row.admin_rejection_reason,
    admin_reviewer_nama: row.admin_reviewer_nama ?? null,
  };
}

async function findApplicationRow(
  id: number,
): Promise<AdminApplication | null> {
  const { rows } = await pool.query<AdminApplicationRow>(
    `${APPLICATION_SELECT}
     WHERE u.id_user = $1
       AND u.admin_application_status IS NOT NULL
     LIMIT 1`,
    [id],
  );

  return rows[0] ? toApplication(rows[0]) : null;
}

/**
 * Mengambil data pengajuan milik pengguna yang sedang login.
 * Mengembalikan null jika pengguna tidak ditemukan.
 */
export async function getMyApplication(
  userId: number,
): Promise<AdminApplication | null> {
  const { rows } = await pool.query<AdminApplicationRow>(
    `${APPLICATION_SELECT}
     WHERE u.id_user = $1
     LIMIT 1`,
    [userId],
  );

  return rows[0] ? toApplication(rows[0]) : null;
}

/**
 * Membuat pengajuan menjadi admin.
 * Hanya customer yang belum pernah mengajukan atau pernah ditolak.
 */
export async function applyForAdmin(
  userId: number,
): Promise<AdminApplication> {
  const application = await withTransaction(async (client) => {
    const { rows } = await client.query<ApplicantRow>(
      `SELECT id_user, role, admin_application_status
       FROM users
       WHERE id_user = $1
       FOR UPDATE`,
      [userId],
    );

    const applicant = rows[0];

    if (!applicant) {
      throw new AppError("User tidak ditemukan", 404);
    }

    if (applicant.role === "admin") {
      throw new AppError("Anda sudah memiliki akses admin", 409);
    }

    if (applicant.admin_application_status === "pending") {
      throw new AppError(
        "Pengajuan Anda masih menunggu pemeriksaan admin",
        409,
      );
    }

    if (applicant.admin_application_status === "approved") {
      throw new AppError("Pengajuan Anda sudah disetujui", 409);
    }

    const updated = await client.query<AdminApplicationRow>(
      `UPDATE users
       SET
         admin_application_status = 'pending',
         admin_application_date = CURRENT_TIMESTAMP,
         admin_reviewed_at = NULL,
         admin_reviewed_by = NULL,
         admin_rejection_reason = NULL
       WHERE id_user = $1
       ${APPLICATION_RETURNING}`,
      [userId],
    );

    return updated.rows[0];
  });

  return toApplication(application);
}

/**
 * Daftar seluruh pengajuan (khusus admin), dengan filter status dan pagination.
 */
export async function findApplications(
  query: AdminApplicationQueryInput,
): Promise<AdminApplicationListResult> {
  const values: unknown[] = [];
  const conditions = ["u.admin_application_status IS NOT NULL"];

  if (query.status) {
    values.push(query.status);
    conditions.push(`u.admin_application_status = $${values.length}`);
  }

  const where = `WHERE ${conditions.join(" AND ")}`;

  const countResult = await pool.query<{ total: number }>(
    `SELECT COUNT(*)::int AS total FROM users u ${where}`,
    values,
  );

  const total = countResult.rows[0]?.total ?? 0;
  const offset = (query.page - 1) * query.limit;

  const { rows } = await pool.query<AdminApplicationRow>(
    `${APPLICATION_SELECT}
     ${where}
     ORDER BY u.admin_application_date DESC NULLS LAST, u.id_user DESC
     LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
    [...values, query.limit, offset],
  );

  return {
    applications: rows.map(toApplication),
    pagination: {
      page: query.page,
      limit: query.limit,
      total,
      totalPages: total === 0 ? 0 : Math.ceil(total / query.limit),
    },
  };
}

/**
 * Detail pengajuan berdasarkan id_user pemohon.
 * Mengembalikan null jika pengguna belum pernah mengajukan.
 */
export async function findApplicationById(
  id: number,
): Promise<AdminApplication | null> {
  return findApplicationRow(id);
}

/**
 * Memproses keputusan admin (setujui/tolak) dalam satu transaksi
 * dengan row locking agar dua admin tidak dapat memproses bersamaan.
 */
export async function reviewApplication(
  applicantId: number,
  reviewer: AuthUser,
  decision: AdminApplicationDecision,
  rejectionReason?: string,
): Promise<AdminApplication> {
  await withTransaction(async (client) => {
    const { rows } = await client.query<ApplicantRow>(
      `SELECT id_user, role, admin_application_status
       FROM users
       WHERE id_user = $1
       FOR UPDATE`,
      [applicantId],
    );

    const applicant = rows[0];

    if (!applicant || applicant.admin_application_status === null) {
      throw new AppError("Pengajuan tidak ditemukan", 404);
    }

    if (applicant.admin_application_status !== "pending") {
      throw new AppError(
        `Pengajuan sudah diproses dengan status ${applicant.admin_application_status}`,
        409,
      );
    }

    if (applicant.role !== "customer") {
      throw new AppError(
        "Pengajuan tidak dapat diproses karena pemohon bukan customer",
        409,
      );
    }

    if (decision === "approve") {
      await client.query(
        `UPDATE users
         SET
           role = 'admin'::role_type,
           admin_application_status = 'approved',
           admin_reviewed_at = CURRENT_TIMESTAMP,
           admin_reviewed_by = $1,
           admin_rejection_reason = NULL
         WHERE id_user = $2`,
        [reviewer.id, applicantId],
      );

      return;
    }

    await client.query(
      `UPDATE users
       SET
         role = 'customer'::role_type,
         admin_application_status = 'rejected',
         admin_reviewed_at = CURRENT_TIMESTAMP,
         admin_reviewed_by = $1,
         admin_rejection_reason = $2
       WHERE id_user = $3`,
      [reviewer.id, rejectionReason ?? null, applicantId],
    );
  });

  const application = await findApplicationById(applicantId);

  if (!application) {
    throw new Error("Gagal mengambil pengajuan yang sudah diproses");
  }

  return application;
}
