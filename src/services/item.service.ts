import pool from "../db/index.ts";
import { buildFileUrl } from "../utils/file.ts";
import { formatMoney } from "../utils/money.ts";
import type {
  CreateItemInput,
  ItemQueryInput,
  UpdateItemInput,
} from "../validations/item.validation.ts";

interface ItemRow {
  id_items: number;
  id_kategori: number;
  nama_kategori: string;
  nama_item: string;
  deskripsi: string | null;
  image: string | null;
  stok: number;
  harga_sewa_harian: string;
  denda_harian: string;
  original_price: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface ItemRecord {
  id_items: number;
  id_kategori: number;
  nama_kategori: string;
  nama_item: string;
  deskripsi: string | null;
  image: string | null;
  image_url: string | null;
  stok: number;
  harga_sewa_harian: string;
  denda_harian: string;
  original_price: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface ItemListResult {
  items: ItemRecord[];
  pagination: Pagination;
}

const ITEM_SELECT = `
  SELECT
    i.id_items,
    i.id_kategori,
    c.nama AS nama_kategori,
    i.nama_item,
    i.deskripsi,
    i.image,
    i.stok,
    i.harga_sewa_harian,
    i.denda_harian,
    i.original_price,
    i.created_at,
    i.updated_at
  FROM items i
  INNER JOIN categories c ON c.id_kategori = i.id_kategori
`;

function toItemRecord(row: ItemRow): ItemRecord {
  return {
    id_items: row.id_items,
    id_kategori: row.id_kategori,
    nama_kategori: row.nama_kategori,
    nama_item: row.nama_item,
    deskripsi: row.deskripsi,
    image: row.image,
    image_url: buildFileUrl(row.image),
    stok: row.stok,
    harga_sewa_harian: formatMoney(row.harga_sewa_harian),
    denda_harian: formatMoney(row.denda_harian),
    original_price:
      row.original_price === null ? null : formatMoney(row.original_price),
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export async function findItems(query: ItemQueryInput): Promise<ItemListResult> {
  const values: unknown[] = [];
  const conditions: string[] = [];

  if (query.search) {
    values.push(`%${query.search}%`);
    const index = values.length;
    conditions.push(
      `(i.nama_item ILIKE $${index} OR i.deskripsi ILIKE $${index})`,
    );
  }

  if (query.id_kategori) {
    values.push(query.id_kategori);
    conditions.push(`i.id_kategori = $${values.length}`);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const countResult = await pool.query<{ total: number }>(
    `SELECT COUNT(*)::int AS total FROM items i ${where}`,
    values,
  );

  const total = countResult.rows[0]?.total ?? 0;
  const offset = (query.page - 1) * query.limit;

  const { rows } = await pool.query<ItemRow>(
    `${ITEM_SELECT}
     ${where}
     ORDER BY i.id_items ASC
     LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
    [...values, query.limit, offset],
  );

  return {
    items: rows.map(toItemRecord),
    pagination: {
      page: query.page,
      limit: query.limit,
      total,
      totalPages: total === 0 ? 0 : Math.ceil(total / query.limit),
    },
  };
}

export async function findItemById(id: number): Promise<ItemRecord | null> {
  const { rows } = await pool.query<ItemRow>(
    `${ITEM_SELECT} WHERE i.id_items = $1 LIMIT 1`,
    [id],
  );

  return rows[0] ? toItemRecord(rows[0]) : null;
}

export async function createItem(
  input: CreateItemInput,
  image: string | null,
): Promise<ItemRecord> {
  const { rows } = await pool.query<{ id_items: number }>(
    `INSERT INTO items
       (id_kategori, nama_item, deskripsi, image, stok, harga_sewa_harian, denda_harian, original_price)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING id_items`,
    [
      input.id_kategori,
      input.nama_item,
      input.deskripsi ?? null,
      image,
      input.stok,
      input.harga_sewa_harian,
      input.denda_harian,
      input.original_price ?? null,
    ],
  );

  const created = await findItemById(rows[0].id_items);

  if (!created) {
    throw new Error("Gagal mengambil item yang baru dibuat");
  }

  return created;
}

export async function updateItem(
  id: number,
  input: UpdateItemInput,
  image: string | null,
): Promise<ItemRecord | null> {
  const { rows } = await pool.query<{ id_items: number }>(
    `UPDATE items
     SET
       id_kategori = $1,
       nama_item = $2,
       deskripsi = $3,
       stok = $4,
       harga_sewa_harian = $5,
       denda_harian = $6,
       original_price = COALESCE($7, original_price),
       image = COALESCE($8, image),
       updated_at = CURRENT_TIMESTAMP
     WHERE id_items = $9
     RETURNING id_items`,
    [
      input.id_kategori,
      input.nama_item,
      input.deskripsi ?? null,
      input.stok,
      input.harga_sewa_harian,
      input.denda_harian,
      input.original_price ?? null,
      image,
      id,
    ],
  );

  if (rows.length === 0) {
    return null;
  }

  return findItemById(id);
}

export async function deleteItem(id: number): Promise<boolean> {
  const { rowCount } = await pool.query(
    "DELETE FROM items WHERE id_items = $1",
    [id],
  );

  return (rowCount ?? 0) > 0;
}
