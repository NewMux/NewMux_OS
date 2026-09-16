import { z } from "zod";

export const setupVaultSchema = z
  .object({
    passphrase: z.string().min(12, "Passphrase must be at least 12 characters"),
    confirmPassphrase: z.string(),
  })
  .refine((data) => data.passphrase === data.confirmPassphrase, {
    message: "Passphrases do not match",
    path: ["confirmPassphrase"],
  });

export const unlockVaultSchema = z.object({
  passphrase: z.string().min(1),
});

export const createSecretSchema = z.object({
  label: z.string().min(1),
  secretType: z.enum([
    "api_token",
    "db_connection",
    "deploy_key",
    "ssh_login",
    "other",
  ]),
  value: z.string().min(1),
  clientId: z.string().uuid().nullable().optional(),
  projectId: z.string().uuid().nullable().optional(),
});

/** Only the label is editable: changing a value means storing a new credential. */
export const updateSecretSchema = z.object({
  label: z.string().min(1),
});
