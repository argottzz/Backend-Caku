import bcrypt from "bcryptjs";
import pool from "../db/index.ts";
import type { AuthUser, UserRole } from "../types/auth.ts";
import { AppError } from "../utils/app-error.ts";
import { signToken } from "../utils/auth.ts";
import type {
  LoginInput,
  RegisterInput,
} from "../validations/auth.validation.ts";

interface UserRow {
  id_user: number;
  nama: string;
  email: string;
  role: UserRole;
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
  };
}

async function findUserRecordByEmail(
  email: string,
): Promise<UserWithPasswordRow | null> {
  const { rows } = await pool.query<UserWithPasswordRow>(
    `SELECT id_user, nama, email, role, password_hash
     FROM users
     WHERE email = $1
     LIMIT 1`,
    [email],
  );

  return rows[0] ?? null;
}

export async function findUserById(id: number): Promise<AuthUser | null> {
  const { rows } = await pool.query<UserRow>(
    `SELECT id_user, nama, email, role
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

  const passwordHash = await bcrypt.hash(input.password, 10);

  const { rows } = await pool.query<UserRow>(
    `INSERT INTO users (nama, email, password_hash, role)
     VALUES ($1, $2, $3, 'customer'::role_type)
     RETURNING id_user, nama, email, role`,
    [input.nama, input.email, passwordHash],
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
