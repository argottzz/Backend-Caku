-- ============================================================
-- 001: Kolom pengajuan menjadi admin pada tabel users
-- Tidak membuat tabel baru dan tidak mengubah enum role_type.
-- Aman dijalankan berulang (idempotent).
-- ============================================================

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS admin_application_status VARCHAR(20),
    ADD COLUMN IF NOT EXISTS admin_application_date TIMESTAMP,
    ADD COLUMN IF NOT EXISTS admin_reviewed_at TIMESTAMP,
    ADD COLUMN IF NOT EXISTS admin_reviewed_by INTEGER,
    ADD COLUMN IF NOT EXISTS admin_rejection_reason TEXT;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'chk_users_admin_application_status'
          AND conrelid = 'users'::regclass
    ) THEN
        ALTER TABLE users
            ADD CONSTRAINT chk_users_admin_application_status
            CHECK (
                admin_application_status IS NULL
                OR admin_application_status IN ('pending', 'approved', 'rejected')
            );
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'chk_users_admin_application_data'
          AND conrelid = 'users'::regclass
    ) THEN
        ALTER TABLE users
            ADD CONSTRAINT chk_users_admin_application_data
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
            );
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'fk_users_admin_reviewer'
          AND conrelid = 'users'::regclass
    ) THEN
        ALTER TABLE users
            ADD CONSTRAINT fk_users_admin_reviewer
            FOREIGN KEY (admin_reviewed_by)
            REFERENCES users (id_user)
            ON DELETE RESTRICT
            ON UPDATE CASCADE;
    END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_users_admin_application_status
    ON users (admin_application_status)
    WHERE admin_application_status IS NOT NULL;
