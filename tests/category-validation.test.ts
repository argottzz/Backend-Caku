import assert from "node:assert/strict";
import { test } from "node:test";
import {
  createCategorySchema,
  updateCategorySchema,
} from "../src/validations/category.validation.ts";

test("nama kategori valid diterima dan spasinya di-trim", () => {
  const result = createCategorySchema.parse({ nama: "  Tenda dan Shelter  " });
  assert.equal(result.nama, "Tenda dan Shelter");
});

test("nama kategori kosong ditolak", () => {
  assert.equal(createCategorySchema.safeParse({ nama: "" }).success, false);
});

test("nama kategori hanya spasi ditolak", () => {
  assert.equal(createCategorySchema.safeParse({ nama: "    " }).success, false);
});

test("field nama tidak dikirim ditolak", () => {
  const result = createCategorySchema.safeParse({});
  assert.equal(result.success, false);

  if (!result.success) {
    assert.equal(result.error.issues[0].message, "Nama kategori wajib diisi");
  }
});

test("nama kategori bukan teks ditolak", () => {
  assert.equal(createCategorySchema.safeParse({ nama: 12 }).success, false);
});

test("nama kategori lebih dari 100 karakter ditolak", () => {
  const result = createCategorySchema.safeParse({ nama: "a".repeat(101) });
  assert.equal(result.success, false);
});

test("nama kategori tepat 100 karakter diterima", () => {
  assert.equal(
    createCategorySchema.safeParse({ nama: "a".repeat(100) }).success,
    true,
  );
});

test("ubah kategori memakai aturan validasi yang sama", () => {
  assert.equal(updateCategorySchema.parse({ nama: " Penerangan " }).nama, "Penerangan");
  assert.equal(updateCategorySchema.safeParse({ nama: "   " }).success, false);
  assert.equal(updateCategorySchema.safeParse({}).success, false);
});
