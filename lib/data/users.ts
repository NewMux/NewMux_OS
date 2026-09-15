import { store } from "./store";
import type { User } from "./types";

export async function findUserByEmail(email: string): Promise<User | undefined> {
  return store.users.find((u) => u.email.toLowerCase() === email.toLowerCase() && u.isActive);
}

export async function findUserById(id: string): Promise<User | undefined> {
  return store.users.find((u) => u.id === id);
}
