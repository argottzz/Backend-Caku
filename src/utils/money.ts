const MONEY_PATTERN = /^-?\d+(\.\d{1,2})?$/;

/**
 * Mengubah nilai uang dari database menjadi satuan sen (integer).
 * Contoh: "50000.00" -> 5000000
 */
export function toCents(value: string | number): number {
  const text = String(value).trim();

  if (!MONEY_PATTERN.test(text)) {
    throw new Error(`Nilai uang tidak valid: ${text}`);
  }

  const negative = text.startsWith("-");
  const unsigned = negative ? text.slice(1) : text;
  const [whole, fraction = ""] = unsigned.split(".");
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));

  if (!Number.isSafeInteger(cents)) {
    throw new Error(`Nilai uang di luar batas aman: ${text}`);
  }

  return negative ? -cents : cents;
}

/**
 * Mengubah satuan sen menjadi string dua angka desimal.
 * Contoh: 5000000 -> "50000.00"
 */
export function formatCents(cents: number): string {
  if (!Number.isSafeInteger(cents)) {
    throw new Error("Nilai sen tidak valid");
  }

  const negative = cents < 0;
  const absolute = Math.abs(cents);
  const whole = Math.floor(absolute / 100);
  const fraction = absolute % 100;

  return `${negative ? "-" : ""}${whole}.${String(fraction).padStart(2, "0")}`;
}

export function sumCents(...values: number[]): number {
  const total = values.reduce((accumulator, value) => accumulator + value, 0);

  if (!Number.isSafeInteger(total)) {
    throw new Error("Total uang di luar batas aman");
  }

  return total;
}

export function multiplyCents(cents: number, ...factors: number[]): number {
  const result = factors.reduce(
    (accumulator, factor) => accumulator * factor,
    cents,
  );

  if (!Number.isSafeInteger(result)) {
    throw new Error("Hasil perhitungan uang di luar batas aman");
  }

  return result;
}
