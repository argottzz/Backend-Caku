-- ============================================================
-- 002: Foto profil pengguna, harga asli barang, snapshot harga
--      asli pada detail rental, dan pencatatan penggantian
--      barang hilang.
--
-- Catatan penting:
-- - Tabel detail rental pada database ini bernama `rental_details`
--   (bukan `rental_items`). Kolom snapshot ditambahkan di sana.
-- - Aman dijalankan berulang (idempotent).
-- - Tidak mengubah data lama dan tidak mengisi harga asli secara
--   otomatis.
-- ============================================================

-- Foto profil (customer maupun admin, keduanya di tabel users)
ALTER TABLE users
    ADD COLUMN IF NOT EXISTS profile_image TEXT,
    ADD COLUMN IF NOT EXISTS profile_image_public_id VARCHAR(255);

-- Harga asli barang. NULL berarti Admin belum mengisi; barang
-- tersebut belum boleh dipakai pada transaksi baru.
ALTER TABLE items
    ADD COLUMN IF NOT EXISTS original_price NUMERIC(12,2);

-- Snapshot harga asli saat rental dibuat.
ALTER TABLE rental_details
    ADD COLUMN IF NOT EXISTS original_price_at_rental NUMERIC(12,2);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'chk_items_original_price'
          AND conrelid = 'items'::regclass
    ) THEN
        ALTER TABLE items
            ADD CONSTRAINT chk_items_original_price
            CHECK (original_price IS NULL OR original_price >= 0);
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'chk_rental_details_original_price'
          AND conrelid = 'rental_details'::regclass
    ) THEN
        ALTER TABLE rental_details
            ADD CONSTRAINT chk_rental_details_original_price
            CHECK (
                original_price_at_rental IS NULL
                OR original_price_at_rental >= 0
            );
    END IF;
END
$$;

-- Satu rental hanya boleh memiliki satu catatan penggantian.
CREATE TABLE IF NOT EXISTS rental_replacements (
    id_replacement INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_rental INTEGER NOT NULL,
    total_amount NUMERIC(12,2) NOT NULL,
    status VARCHAR(20) DEFAULT 'Pending' NOT NULL,
    recorded_by INTEGER,
    completed_by INTEGER,
    completed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT uq_rental_replacements_rental
        UNIQUE (id_rental),

    CONSTRAINT fk_rental_replacements_rental
        FOREIGN KEY (id_rental)
        REFERENCES rentals (id_rental)
        ON DELETE CASCADE
        ON UPDATE CASCADE,

    CONSTRAINT fk_rental_replacements_recorded_by
        FOREIGN KEY (recorded_by)
        REFERENCES users (id_user)
        ON DELETE RESTRICT
        ON UPDATE CASCADE,

    CONSTRAINT fk_rental_replacements_completed_by
        FOREIGN KEY (completed_by)
        REFERENCES users (id_user)
        ON DELETE RESTRICT
        ON UPDATE CASCADE,

    CONSTRAINT chk_rental_replacements_total
        CHECK (total_amount >= 0),

    CONSTRAINT chk_rental_replacements_status
        CHECK (status IN ('Pending', 'Completed'))
);

CREATE INDEX IF NOT EXISTS idx_rental_replacements_status
    ON rental_replacements (status);
