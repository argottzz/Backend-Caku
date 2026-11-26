import bcrypt from "bcryptjs";
import pool from "../db/index.ts";
import type { AuthUser, UserRole } from "../types/auth.ts";
import { AppError } from "../utils/app-error.ts";
import { signToken } from "../utils/auth.ts";
import type {
  ChangePasswordInput,
  LoginInput,
  RegisterInput,
} from "../validations/auth.validation.ts";

interface UserRow {
  id_user: number;
  nama: string;
  email: string;
  role: UserRole;
  profile_image: string | null;
  phone_number: string | null;
}

interface UserWithPasswordRow extends UserRow {
  password_hash: string;
}

export interface AuthResult {
  user: AuthUser;
  token: string;
}

function toAuthUser(row: UserRow): AuthUser {
  return {
    id: row.id_user,
    nama: row.nama,
    email: row.email,
    role: row.role,
    profile_image: row.profile_image,
    phone_number: row.phone_number,
  };
}

async function findUserRecordByEmail(
  email: string,
): Promise<UserWithPasswordRow | null> {
  const { rows } = await pool.query<UserWithPasswordRow>(
    `SELECT id_user, nama, email, role, profile_image, phone_number, password_hash
     FROM users
     WHERE email = $1
     LIMIT 1`,
    [email],
  );

  return rows[0] ?? null;
}

export async function findUserById(id: number): Promise<AuthUser | null> {
  const { rows } = await pool.query<UserRow>(
    `SELECT id_user, nama, email, role, profile_image, phone_number
     FROM users
     WHERE id_user = $1
     LIMIT 1`,
    [id],
  );

  return rows[0] ? toAuthUser(rows[0]) : null;
}

export async function registerUser(
  input: RegisterInput,
): Promise<AuthResult> {
  const existing = await findUserRecordByEmail(input.email);

  if (existing) {
    throw new AppError("Email sudah terdaftar", 409);
  }

  // Cegah nomor telepon dipakai oleh akun lain.
  const existingPhone = await pool.query<{ id_user: number }>(
    `SELECT id_user FROM users WHERE phone_number = $1 LIMIT 1`,
    [input.phone_number],
  );

  if (existingPhone.rows[0]) {
    throw new AppError("Nomor telepon sudah terdaftar", 409);
  }

  const passwordHash = await bcrypt.hash(input.password, 10);

  const { rows } = await pool.query<UserRow>(
    `INSERT INTO users (nama, email, password_hash, role, phone_number)
     VALUES ($1, $2, $3, 'customer'::role_type, $4)
     RETURNING id_user, nama, email, role, profile_image, phone_number`,
    [input.nama, input.email, passwordHash, input.phone_number],
  );

  const user = toAuthUser(rows[0]);

  return { user, token: signToken(user) };
}

export async function loginUser(
  input: LoginInput,
): Promise<AuthResult | null> {
  const record = await findUserRecordByEmail(input.email);

  if (!record) {
    return null;
  }

  const isMatch = await bcrypt.compare(input.password, record.password_hash);

  if (!isMatch) {
    return null;
  }

  const user = toAuthUser(record);

  return { user, token: signToken(user) };
}

export async function findUserWithPasswordById(
  id: number,
): Promise<UserWithPasswordRow | null> {
  const { rows } = await pool.query<UserWithPasswordRow>(
    `SELECT id_user, nama, email, role, profile_image, phone_number, password_hash
     FROM users
     WHERE id_user = $1
     LIMIT 1`,
    [id],
  );

  return rows[0] ?? null;
}

export async function changePassword(
  userId: number,
  input: ChangePasswordInput,
): Promise<void> {
  const record = await findUserWithPasswordById(userId);

  if (!record) {
    throw new AppError("User tidak ditemukan", 404);
  }

  const isMatch = await bcrypt.compare(
    input.current_password,
    record.password_hash,
  );

  if (!isMatch) {
    throw new AppError("Password lama salah", 400);
  }

  const newHash = await bcrypt.hash(input.new_password, 10);

  await pool.query(
    `UPDATE users SET password_hash = $1 WHERE id_user = $2`,
    [newHash, userId],
  );
}
