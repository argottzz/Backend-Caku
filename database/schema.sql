-- ============================================================
-- Struktur database Caku (aplikasi_caku)
-- Salinan acuan DDL. Jangan mengubah tanpa persetujuan.
-- ============================================================

-- JENIS ROLE
CREATE TYPE role_type AS ENUM ('admin', 'customer');

-- STATUS PENYEWAAN
CREATE TYPE rental_status AS ENUM (
    'pending',
    'approved',
    'ongoing',
    'completed',
    'rejected'
);

-- KONDISI PENGEMBALIAN
CREATE TYPE return_condition AS ENUM (
    'Baik',
    'Rusak',
    'Hilang'
);

CREATE TABLE users (
    id_user INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    nama VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role role_type DEFAULT 'customer' NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    -- Status pengajuan menjadi admin. NULL berarti belum pernah mengajukan.
    admin_application_status VARCHAR(20),
    admin_application_date TIMESTAMP,
    admin_reviewed_at TIMESTAMP,
    admin_reviewed_by INTEGER,
    admin_rejection_reason TEXT,

    CONSTRAINT chk_users_admin_application_status
        CHECK (
            admin_application_status IS NULL
            OR admin_application_status IN ('pending', 'approved', 'rejected')
        ),

    -- Menjaga konsistensi antara status pengajuan, data pemeriksaan, dan role.
    CONSTRAINT chk_users_admin_application_data
        CHECK (
            (
                admin_application_status IS NULL
                AND admin_application_date IS NULL
                AND admin_reviewed_at IS NULL
                AND admin_reviewed_by IS NULL
                AND admin_rejection_reason IS NULL
            )
            OR (
                admin_application_status = 'pending'
                AND admin_application_date IS NOT NULL
                AND admin_reviewed_at IS NULL
                AND admin_reviewed_by IS NULL
                AND admin_rejection_reason IS NULL
                AND role = 'customer'::role_type
            )
            OR (
                admin_application_status = 'approved'
                AND admin_application_date IS NOT NULL
                AND admin_reviewed_at IS NOT NULL
                AND admin_reviewed_by IS NOT NULL
                AND role = 'admin'::role_type
            )
            OR (
                admin_application_status = 'rejected'
                AND admin_application_date IS NOT NULL
                AND admin_reviewed_at IS NOT NULL
                AND admin_reviewed_by IS NOT NULL
                AND role = 'customer'::role_type
            )
        ),

    CONSTRAINT fk_users_admin_reviewer
        FOREIGN KEY (admin_reviewed_by)
        REFERENCES users (id_user)
        ON DELETE RESTRICT
        ON UPDATE CASCADE
);

CREATE TABLE categories (
    id_kategori INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    nama VARCHAR(100) UNIQUE NOT NULL
);

CREATE TABLE items (
    id_items INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_kategori INTEGER NOT NULL,
    nama_item VARCHAR(100) NOT NULL,
    deskripsi TEXT,
    image VARCHAR(255),
    stok INTEGER DEFAULT 0 NOT NULL,
    harga_sewa_harian NUMERIC(12,2) NOT NULL,
    denda_harian NUMERIC(12,2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_items_categories
        FOREIGN KEY (id_kategori)
        REFERENCES categories (id_kategori)
        ON DELETE RESTRICT
        ON UPDATE CASCADE,

    CONSTRAINT chk_items_stok
        CHECK (stok >= 0),

    CONSTRAINT chk_items_harga
        CHECK (harga_sewa_harian >= 0),

    CONSTRAINT chk_items_denda
        CHECK (denda_harian >= 0)
);

CREATE TABLE rentals (
    id_rental INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_user INTEGER NOT NULL,
    tanggal_mulai DATE NOT NULL,
    tanggal_selesai DATE NOT NULL,
    tanggal_kembali_aktual DATE,
    bukti_transfer VARCHAR(255),
    status rental_status DEFAULT 'pending' NOT NULL,
    kondisi_pengembalian return_condition,
    catatan_pengembalian TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_rentals_users
        FOREIGN KEY (id_user)
        REFERENCES users (id_user)
        ON DELETE RESTRICT
        ON UPDATE CASCADE,

    CONSTRAINT chk_rentals_tanggal
        CHECK (tanggal_selesai >= tanggal_mulai)
);

CREATE TABLE rental_details (
    id_detail_penyewaan INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_rental INTEGER NOT NULL,
    id_items INTEGER NOT NULL,
    jumlah INTEGER NOT NULL,
    harga_perhari NUMERIC(12,2) NOT NULL,
    denda_perhari NUMERIC(12,2) NOT NULL,

    CONSTRAINT fk_rental_details_rentals
        FOREIGN KEY (id_rental)
        REFERENCES rentals (id_rental)
        ON DELETE CASCADE
        ON UPDATE CASCADE,

    CONSTRAINT fk_rental_details_items
        FOREIGN KEY (id_items)
        REFERENCES items (id_items)
        ON DELETE RESTRICT
        ON UPDATE CASCADE,

    CONSTRAINT uq_rental_details
        UNIQUE (id_rental, id_items),

    CONSTRAINT chk_rental_details_jumlah
        CHECK (jumlah > 0),

    CONSTRAINT chk_rental_details_harga
        CHECK (harga_perhari >= 0),

    CONSTRAINT chk_rental_details_denda
        CHECK (denda_perhari >= 0)
);

CREATE INDEX idx_items_kategori
ON items (id_kategori);

CREATE INDEX idx_users_admin_application_status
ON users (admin_application_status)
WHERE admin_application_status IS NOT NULL;

CREATE INDEX idx_rentals_user
ON rentals (id_user);

CREATE INDEX idx_rentals_status
ON rentals (status);

CREATE INDEX idx_rentals_tanggal
ON rentals (tanggal_mulai, tanggal_selesai);

CREATE INDEX idx_rental_details_rental
ON rental_details (id_rental);

CREATE INDEX idx_rental_details_items
ON rental_details (id_items);
