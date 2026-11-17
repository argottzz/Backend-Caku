import pool, { withTransaction } from "../db/index.ts";
import type { AuthUser } from "../types/auth.ts";
import type { RentalStatus, ReturnCondition } from "../types/rental.ts";
import { AppError } from "../utils/app-error.ts";
import {
  differenceInDays,
  rentalDurationDays,
} from "../utils/date.ts";
import { buildFileUrl } from "../utils/file.ts";
import {
  formatCents,
  formatMoney,
  multiplyCents,
  sumCents,
  toCents,
} from "../utils/money.ts";
import type {
  CreateRentalInput,
  RentalQueryInput,
  UpdateRentalStatusInput,
} from "../validations/rental.validation.ts";

interface RentalRow {
  id_rental: number;
  id_user: number;
  nama_user: string;
  email_user: string;
  tanggal_mulai: string;
  tanggal_selesai: string;
  tanggal_kembali_aktual: string | null;
  bukti_transfer: string | null;
  status: RentalStatus;
  kondisi_pengembalian: ReturnCondition | null;
  catatan_pengembalian: string | null;
  created_at: Date;
}

interface RentalListRow extends RentalRow {
  jumlah_item: number;
  total_sewa_dasar: string;
  denda_per_hari_total: string;
}

interface RentalDetailRow {
  id_detail_penyewaan: number;
  id_items: number;
  nama_item: string;
  jumlah: number;
  harga_perhari: string;
  denda_perhari: string;
}

interface StockRow {
  id_items: number;
  nama_item: string;
  stok: number;
  harga_sewa_harian: string;
  denda_harian: string;
}

export interface RentalItemDetail {
  id_detail_penyewaan: number;
  id_items: number;
  nama_item: string;
  jumlah: number;
  harga_perhari: string;
  denda_perhari: string;
  subtotal: string;
}

export interface RentalSummary {
  id_rental: number;
  id_user: number;
  nama_user: string;
  email_user: string;
  tanggal_mulai: string;
  tanggal_selesai: string;
  tanggal_kembali_aktual: string | null;
  durasi_hari: number;
  bukti_transfer: string | null;
  bukti_transfer_url: string | null;
  status: RentalStatus;
  kondisi_pengembalian: ReturnCondition | null;
  catatan_pengembalian: string | null;
  jumlah_item: number;
  total_sewa: string;
  hari_terlambat: number;
  total_denda: string;
  total_bayar: string;
  created_at: Date;
}

export interface RentalDetail extends RentalSummary {
  items: RentalItemDetail[];
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface RentalListResult {
  rentals: RentalSummary[];
  pagination: Pagination;
}

const RENTAL_LIST_SELECT = `
  SELECT
    r.id_rental,
    r.id_user,
    u.nama AS nama_user,
    u.email AS email_user,
    r.tanggal_mulai,
    r.tanggal_selesai,
    r.tanggal_kembali_aktual,
    r.bukti_transfer,
    r.status,
    r.kondisi_pengembalian,
    r.catatan_pengembalian,
    r.created_at,
    (SELECT COUNT(*)::int FROM rental_details rd WHERE rd.id_rental = r.id_rental) AS jumlah_item,
    (SELECT COALESCE(SUM(rd.harga_perhari * rd.jumlah), 0)::text
       FROM rental_details rd WHERE rd.id_rental = r.id_rental) AS total_sewa_dasar,
    (SELECT COALESCE(SUM(rd.denda_perhari * rd.jumlah), 0)::text
       FROM rental_details rd WHERE rd.id_rental = r.id_rental) AS denda_per_hari_total
  FROM rentals r
  INNER JOIN users u ON u.id_user = r.id_user
`;

function lateDays(row: {
  tanggal_selesai: string;
  tanggal_kembali_aktual: string | null;
}): number {
  if (!row.tanggal_kembali_aktual) {
    return 0;
  }

  return Math.max(
    0,
    differenceInDays(row.tanggal_selesai, row.tanggal_kembali_aktual),
  );
}

function toSummary(row: RentalListRow): RentalSummary {
  const durasi = rentalDurationDays(row.tanggal_mulai, row.tanggal_selesai);
  const totalSewa = multiplyCents(toCents(row.total_sewa_dasar), durasi);
  const hariTerlambat = lateDays(row);
  const totalDenda = multiplyCents(
    toCents(row.denda_per_hari_total),
    hariTerlambat,
  );

  return {
    id_rental: row.id_rental,
    id_user: row.id_user,
    nama_user: row.nama_user,
    email_user: row.email_user,
    tanggal_mulai: row.tanggal_mulai,
    tanggal_selesai: row.tanggal_selesai,
    tanggal_kembali_aktual: row.tanggal_kembali_aktual,
    durasi_hari: durasi,
    bukti_transfer: row.bukti_transfer,
    bukti_transfer_url: buildFileUrl(row.bukti_transfer),
    status: row.status,
    kondisi_pengembalian: row.kondisi_pengembalian,
    catatan_pengembalian: row.catatan_pengembalian,
    jumlah_item: row.jumlah_item,
    total_sewa: formatCents(totalSewa),
    hari_terlambat: hariTerlambat,
    total_denda: formatCents(totalDenda),
    total_bayar: formatCents(sumCents(totalSewa, totalDenda)),
    created_at: row.created_at,
  };
}

function toDetail(
  row: RentalRow,
  details: RentalDetailRow[],
): RentalDetail {
  const durasi = rentalDurationDays(row.tanggal_mulai, row.tanggal_selesai);

  const items = details.map((detail) => ({
    id_detail_penyewaan: detail.id_detail_penyewaan,
    id_items: detail.id_items,
    nama_item: detail.nama_item,
    jumlah: detail.jumlah,
    harga_perhari: formatMoney(detail.harga_perhari),
    denda_perhari: formatMoney(detail.denda_perhari),
    subtotal: formatCents(
      multiplyCents(toCents(detail.harga_perhari), detail.jumlah, durasi),
    ),
  }));

  const totalSewa = sumCents(...items.map((item) => toCents(item.subtotal)));
  const hariTerlambat = lateDays(row);
  const totalDenda = multiplyCents(
    sumCents(
      ...details.map((detail) =>
        multiplyCents(toCents(detail.denda_perhari), detail.jumlah),
      ),
    ),
    hariTerlambat,
  );

  return {
    id_rental: row.id_rental,
    id_user: row.id_user,
    nama_user: row.nama_user,
    email_user: row.email_user,
    tanggal_mulai: row.tanggal_mulai,
    tanggal_selesai: row.tanggal_selesai,
    tanggal_kembali_aktual: row.tanggal_kembali_aktual,
    durasi_hari: durasi,
    bukti_transfer: row.bukti_transfer,
    bukti_transfer_url: buildFileUrl(row.bukti_transfer),
    status: row.status,
    kondisi_pengembalian: row.kondisi_pengembalian,
    catatan_pengembalian: row.catatan_pengembalian,
    jumlah_item: items.length,
    total_sewa: formatCents(totalSewa),
    hari_terlambat: hariTerlambat,
    total_denda: formatCents(totalDenda),
    total_bayar: formatCents(sumCents(totalSewa, totalDenda)),
    created_at: row.created_at,
    items,
  };
}

export async function findRentals(
  requester: AuthUser,
  query: RentalQueryInput,
): Promise<RentalListResult> {
  const values: unknown[] = [];
  const conditions: string[] = [];

  if (requester.role === "customer") {
    values.push(requester.id);
    conditions.push(`r.id_user = $${values.length}`);
  }

  if (query.status) {
    values.push(query.status);
    conditions.push(`r.status = $${values.length}::rental_status`);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const countResult = await pool.query<{ total: number }>(
    `SELECT COUNT(*)::int AS total FROM rentals r ${where}`,
    values,
  );

  const total = countResult.rows[0]?.total ?? 0;
  const offset = (query.page - 1) * query.limit;

  const { rows } = await pool.query<RentalListRow>(
    `${RENTAL_LIST_SELECT}
     ${where}
     ORDER BY r.created_at DESC, r.id_rental DESC
     LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
    [...values, query.limit, offset],
  );

  return {
    rentals: rows.map(toSummary),
    pagination: {
      page: query.page,
      limit: query.limit,
      total,
      totalPages: total === 0 ? 0 : Math.ceil(total / query.limit),
    },
  };
}

export async function findRentalById(
  id: number,
): Promise<RentalDetail | null> {
  const rentalResult = await pool.query<RentalRow>(
    `SELECT
       r.id_rental,
       r.id_user,
       u.nama AS nama_user,
       u.email AS email_user,
       r.tanggal_mulai,
       r.tanggal_selesai,
       r.tanggal_kembali_aktual,
       r.bukti_transfer,
       r.status,
       r.kondisi_pengembalian,
       r.catatan_pengembalian,
       r.created_at
     FROM rentals r
     INNER JOIN users u ON u.id_user = r.id_user
     WHERE r.id_rental = $1
     LIMIT 1`,
    [id],
  );

  const rental = rentalResult.rows[0];

  if (!rental) {
    return null;
  }

  const detailResult = await pool.query<RentalDetailRow>(
    `SELECT
       rd.id_detail_penyewaan,
       rd.id_items,
       i.nama_item,
       rd.jumlah,
       rd.harga_perhari,
       rd.denda_perhari
     FROM rental_details rd
     INNER JOIN items i ON i.id_items = rd.id_items
     WHERE rd.id_rental = $1
     ORDER BY rd.id_detail_penyewaan ASC`,
    [id],
  );

  return toDetail(rental, detailResult.rows);
}

export async function getRentalForUser(
  id: number,
  requester: AuthUser,
): Promise<RentalDetail> {
  const rental = await findRentalById(id);

  if (!rental) {
    throw new AppError("Rental tidak ditemukan", 404);
  }

  if (requester.role === "customer" && rental.id_user !== requester.id) {
    throw new AppError("Anda tidak berhak melihat rental ini", 403);
  }

  return rental;
}

export async function createRental(
  userId: number,
  input: CreateRentalInput,
  buktiTransfer: string,
): Promise<RentalDetail> {
  const rentalId = await withTransaction(async (client) => {
    const itemIds = input.items.map((item) => item.id_items);

    const stockResult = await client.query<StockRow>(
      `SELECT id_items, nama_item, stok, harga_sewa_harian, denda_harian
       FROM items
       WHERE id_items = ANY($1::int[])
       ORDER BY id_items
       FOR UPDATE`,
      [itemIds],
    );

    const itemsById = new Map(
      stockResult.rows.map((row) => [row.id_items, row]),
    );

    for (const item of input.items) {
      const record = itemsById.get(item.id_items);

      if (!record) {
        throw new AppError(
          `Item dengan id ${item.id_items} tidak ditemukan`,
          400,
        );
      }

      if (item.jumlah > record.stok) {
        throw new AppError(
          `Stok ${record.nama_item} tidak mencukupi (tersedia ${record.stok})`,
          409,
        );
      }
    }

    const rentalResult = await client.query<{ id_rental: number }>(
      `INSERT INTO rentals
         (id_user, tanggal_mulai, tanggal_selesai, bukti_transfer, status)
       VALUES ($1, $2, $3, $4, 'pending'::rental_status)
       RETURNING id_rental`,
      [userId, input.tanggal_mulai, input.tanggal_selesai, buktiTransfer],
    );

    const newRentalId = rentalResult.rows[0].id_rental;

    for (const item of input.items) {
      const record = itemsById.get(item.id_items);

      if (!record) {
        throw new AppError(
          `Item dengan id ${item.id_items} tidak ditemukan`,
          400,
        );
      }

      await client.query(
        `INSERT INTO rental_details
           (id_rental, id_items, jumlah, harga_perhari, denda_perhari)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          newRentalId,
          item.id_items,
          item.jumlah,
          record.harga_sewa_harian,
          record.denda_harian,
        ],
      );
    }

    return newRentalId;
  });

  const rental = await findRentalById(rentalId);

  if (!rental) {
    throw new Error("Gagal mengambil rental yang baru dibuat");
  }

  return rental;
}

const PREVIOUS_STATUS: Record<
  UpdateRentalStatusInput["status"],
  RentalStatus
> = {
  approved: "pending",
  ongoing: "approved",
  rejected: "pending",
};

export async function updateRentalStatus(
  id: number,
  nextStatus: UpdateRentalStatusInput["status"],
): Promise<RentalDetail> {
  await withTransaction(async (client) => {
    const rentalResult = await client.query<{
      id_rental: number;
      status: RentalStatus;
    }>(
      `SELECT id_rental, status
       FROM rentals
       WHERE id_rental = $1
       FOR UPDATE`,
      [id],
    );

    const rental = rentalResult.rows[0];

    if (!rental) {
      throw new AppError("Rental tidak ditemukan", 404);
    }

    if (rental.status !== PREVIOUS_STATUS[nextStatus]) {
      throw new AppError(
        `Status tidak dapat diubah dari ${rental.status} ke ${nextStatus}`,
        409,
      );
    }

    if (nextStatus === "approved") {
      const detailResult = await client.query<{
        id_items: number;
        jumlah: number;
        nama_item: string;
      }>(
        `SELECT rd.id_items, rd.jumlah, i.nama_item
         FROM rental_details rd
         INNER JOIN items i ON i.id_items = rd.id_items
         WHERE rd.id_rental = $1
         ORDER BY rd.id_items`,
        [id],
      );

      const itemIds = detailResult.rows.map((row) => row.id_items);

      const stockResult = await client.query<{
        id_items: number;
        stok: number;
        nama_item: string;
      }>(
        `SELECT id_items, stok, nama_item
         FROM items
         WHERE id_items = ANY($1::int[])
         ORDER BY id_items
         FOR UPDATE`,
        [itemIds],
      );

      const stockById = new Map(
        stockResult.rows.map((row) => [row.id_items, row]),
      );

      for (const detail of detailResult.rows) {
        const stock = stockById.get(detail.id_items);

        if (!stock) {
          throw new AppError(
            `Item ${detail.nama_item} tidak ditemukan`,
            409,
          );
        }

        if (stock.stok < detail.jumlah) {
          throw new AppError(
            `Stok ${detail.nama_item} tidak mencukupi (tersedia ${stock.stok})`,
            409,
          );
        }
      }

      for (const detail of detailResult.rows) {
        await client.query(
          `UPDATE items
           SET stok = stok - $1, updated_at = CURRENT_TIMESTAMP
           WHERE id_items = $2`,
          [detail.jumlah, detail.id_items],
        );
      }
    }

    await client.query(
      `UPDATE rentals
       SET status = $1::rental_status
       WHERE id_rental = $2`,
      [nextStatus, id],
    );
  });

  const rental = await findRentalById(id);

  if (!rental) {
    throw new Error("Gagal mengambil rental yang diperbarui");
  }

  return rental;
}

/**
 * Membatalkan pengajuan pending milik customer dengan menghapus baris rental.
 * Mengembalikan path bukti transfer agar file dapat dihapus setelah DB sukses.
 */
export async function deleteRental(
  id: number,
  userId: number,
): Promise<string | null> {
  const { rows } = await pool.query<{
    id_user: number;
    status: RentalStatus;
    bukti_transfer: string | null;
  }>(
    `SELECT id_user, status, bukti_transfer
     FROM rentals
     WHERE id_rental = $1`,
    [id],
  );

  const rental = rows[0];

  if (!rental) {
    throw new AppError("Rental tidak ditemukan", 404);
  }

  if (rental.id_user !== userId) {
    throw new AppError("Anda tidak berhak menghapus rental ini", 403);
  }

  if (rental.status !== "pending") {
    throw new AppError(
      "Hanya pengajuan dengan status pending yang dapat dibatalkan",
      409,
    );
  }

  const deleted = await pool.query(
    `DELETE FROM rentals
     WHERE id_rental = $1 AND status = 'pending'::rental_status`,
    [id],
  );

  if ((deleted.rowCount ?? 0) === 0) {
    throw new AppError("Pengajuan tidak dapat dibatalkan", 409);
  }

  return rental.bukti_transfer;
}
