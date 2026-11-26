import assert from "node:assert/strict";
import { test } from "node:test";
import {
  createItemSchema,
  updateItemSchema,
} from "../src/validations/item.validation.ts";
import { updateReplacementSchema } from "../src/validations/replacement.validation.ts";

const baseItem = {
  id_kategori: 1,
  nama_item: "Tenda Camping",
  stok: 2,
  harga_sewa_harian: "25000",
  denda_harian: "10000",
};

test("original_price diterima dan dinormalkan menjadi dua desimal", () => {
  const result = createItemSchema.parse({
    ...baseItem,
    original_price: "500000",
  });

  assert.equal(result.original_price, "500000.00");
});

test("original_price boleh dikosongkan (barang lama)", () => {
  const result = createItemSchema.parse({ ...baseItem, original_price: "" });
  assert.equal(result.original_price, undefined);
});

test("original_price negatif ditolak", () => {
  const result = createItemSchema.safeParse({
    ...baseItem,
    original_price: "-1",
  });

  assert.equal(result.success, false);
});

test("original_price bukan angka ditolak", () => {
  const result = createItemSchema.safeParse({
    ...baseItem,
    original_price: "seratus ribu",
  });

  assert.equal(result.success, false);
});

test("original_price dengan lebih dari dua desimal ditolak", () => {
  const result = createItemSchema.safeParse({
    ...baseItem,
    original_price: "1000.999",
  });

  assert.equal(result.success, false);
});

test("update item memakai skema yang sama", () => {
  const result = updateItemSchema.parse({
    ...baseItem,
    original_price: 750000,
  });

  assert.equal(result.original_price, "750000.00");
});

test("status penggantian hanya menerima Completed", () => {
  assert.equal(updateReplacementSchema.safeParse({ status: "Completed" }).success, true);
  assert.equal(updateReplacementSchema.safeParse({ status: "Pending" }).success, false);
  assert.equal(updateReplacementSchema.safeParse({ status: "Lunas" }).success, false);
});
