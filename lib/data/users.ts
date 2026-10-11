import { query } from "@/lib/db";
import { many, one } from "./sql";
import type { User } from "./types";

export async function findUserByEmail(email: string): Promise<User | undefined> {
  return one<User>("select * from users where lower(email) = lower($1) and is_active", [email]);
}

export async function findUserById(id: string): Promise<User | undefined> {
  return one<User>("select * from users where id = $1", [id]);
}

/** Active users, without password hashes — for assignee/owner pickers. */
export async function listUsers(): Promise<Pick<User, "id" | "fullName" | "email" | "role">[]> {
  return many("select id, full_name, email, role from users where is_active order by full_name");
}

export async function updatePasswordHash(userId: string, passwordHash: string): Promise<void> {
  await query("update users set password_hash = $2, updated_at = now() where id = $1", [userId, passwordHash]);
}

/** Everyone with a login, active or not, for Settings → Team. */
export async function listTeam(): Promise<Pick<User, "id" | "fullName" | "email" | "role" | "isActive">[]> {
  return many("select id, full_name, email, role, is_active from users order by is_active desc, full_name");
}
