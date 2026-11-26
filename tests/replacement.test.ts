import assert from "node:assert/strict";
import { test } from "node:test";
import { computeReplacementTotalCents } from "../src/services/rental.service.ts";
import { formatCents } from "../src/utils/money.ts";

test("total penggantian = SUM(jumlah x snapshot harga asli)", () => {
  const total = computeReplacementTotalCents([
    { jumlah: 1, original_price_at_rental: "500000.00" },
    { jumlah: 2, original_price_at_rental: "150000.00" },
  ]);

  assert.equal(total, 80_000_000);
  assert.equal(formatCents(total as number), "800000.00");
});

test("total penggantian memperhitungkan quantity", () => {
  const total = computeReplacementTotalCents([
    { jumlah: 3, original_price_at_rental: "25000.50" },
  ]);

  assert.equal(formatCents(total as number), "75001.50");
});

test("snapshot yang tidak tersedia tidak memakai harga terbaru", () => {
  const total = computeReplacementTotalCents([
    { jumlah: 1, original_price_at_rental: "500000.00" },
    { jumlah: 2, original_price_at_rental: null },
  ]);

  assert.equal(total, null);
});

test("daftar detail kosong menghasilkan total nol", () => {
  assert.equal(computeReplacementTotalCents([]), 0);
});
