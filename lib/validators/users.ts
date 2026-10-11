import { z } from "zod";

export const userRole = z.enum(["partner_admin", "marketing", "lead_dev"]);

export const newPasswordField = z.string().min(10, "Use at least 10 characters").max(200);

export const createUserSchema = z.object({
  fullName: z.string().trim().min(1, "Required").max(120),
  email: z.string().trim().email("Enter a valid email").max(200),
  role: userRole,
  password: newPasswordField,
});

export const updateUserSchema = z.object({
  fullName: z.string().trim().min(1, "Required").max(120).optional(),
  role: userRole.optional(),
  isActive: z.boolean().optional(),
});
