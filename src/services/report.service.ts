import pool from "../db/index.ts";
import type { RentalStatus } from "../types/rental.ts";
import {
  formatCents,
  sumCents,
  toCents,
} from "../utils/money.ts";
import {
  findRentalSummaries,
  type Pagination,
  type RentalSummary,
} from "./rental.service.ts";
import type { ReportQueryInput } from "../validations/report.validation.ts";

interface CountRow {
  total_transaksi: number;
  transaksi_pending: number;
  transaksi_approved: number;
  transaksi_ongoing: number;
  transaksi_completed: number;
  transaksi_rejected: number;
}

interface RevenueRow {
  total_sewa: string;
  total_denda: string;
}

export interface ReportSummaryData {
  total_transaksi: number;
  transaksi_pending: number;
  transaksi_approved: number;
  transaksi_ongoing: number;
  transaksi_completed: number;
  transaksi_rejected: number;
  total_sewa: string;
  total_denda: string;
  total_pendapatan: string;
}

export interface ReportResult {
  ringkasan: ReportSummaryData;
  rentals: RentalSummary[];
  pagination: Pagination;
}

function buildFilters(query: ReportQueryInput): {
  conditions: string[];
  values: unknown[];
} {
  const conditions: string[] = [];
  const values: unknown[] = [];

  if (query.start_date) {
    values.push(query.start_date);
    conditions.push(`r.tanggal_mulai >= $${values.length}`);
  }

  if (query.end_date) {
    values.push(query.end_date);
    conditions.push(`r.tanggal_mulai <= $${values.length}`);
  }

  if (query.status) {
    values.push(query.status);
    conditions.push(`r.status = $${values.length}::rental_status`);
  }

  return { conditions, values };
}

export async function getReportSummary(
  query: ReportQueryInput,
): Promise<ReportResult> {
  const { conditions, values } = buildFilters(query);
  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const countResult = await pool.query<CountRow>(
    `SELECT
       COUNT(*)::int AS total_transaksi,
       COUNT(*) FILTER (WHERE r.status = 'pending')::int AS transaksi_pending,
       COUNT(*) FILTER (WHERE r.status = 'approved')::int AS transaksi_approved,
       COUNT(*) FILTER (WHERE r.status = 'ongoing')::int AS transaksi_ongoing,
       COUNT(*) FILTER (WHERE r.status = 'completed')::int AS transaksi_completed,
       COUNT(*) FILTER (WHERE r.status = 'rejected')::int AS transaksi_rejected
     FROM rentals r
     ${where}`,
    values,
  );

  const revenueResult = await pool.query<RevenueRow>(
    `SELECT
       COALESCE(SUM(
         CASE
           WHEN r.status IN ('approved', 'ongoing', 'completed')
           THEN rd.harga_perhari * rd.jumlah
                * (r.tanggal_selesai - r.tanggal_mulai + 1)
           ELSE 0
         END
       ), 0)::text AS total_sewa,
       COALESCE(SUM(
         CASE
           WHEN r.status = 'completed'
                AND r.tanggal_kembali_aktual IS NOT NULL
                AND r.tanggal_kembali_aktual > r.tanggal_selesai
           THEN rd.denda_perhari * rd.jumlah
                * (r.tanggal_kembali_aktual - r.tanggal_selesai)
           ELSE 0
         END
       ), 0)::text AS total_denda
     FROM rentals r
     INNER JOIN rental_details rd ON rd.id_rental = r.id_rental
     ${where}`,
    values,
  );

  const counts = countResult.rows[0] ?? {
    total_transaksi: 0,
    transaksi_pending: 0,
    transaksi_approved: 0,
    transaksi_ongoing: 0,
    transaksi_completed: 0,
    transaksi_rejected: 0,
  };

  const revenue = revenueResult.rows[0] ?? {
    total_sewa: "0",
    total_denda: "0",
  };

  const totalSewaCents = toCents(revenue.total_sewa);
  const totalDendaCents = toCents(revenue.total_denda);

  const list = await findRentalSummaries({
    startDate: query.start_date,
    endDate: query.end_date,
    status: query.status as RentalStatus | undefined,
    page: query.page,
    limit: query.limit,
  });

  return {
    ringkasan: {
      total_transaksi: counts.total_transaksi,
      transaksi_pending: counts.transaksi_pending,
      transaksi_approved: counts.transaksi_approved,
      transaksi_ongoing: counts.transaksi_ongoing,
      transaksi_completed: counts.transaksi_completed,
      transaksi_rejected: counts.transaksi_rejected,
      total_sewa: formatCents(totalSewaCents),
      total_denda: formatCents(totalDendaCents),
      total_pendapatan: formatCents(sumCents(totalSewaCents, totalDendaCents)),
    },
    rentals: list.rentals,
    pagination: list.pagination,
  };
}
