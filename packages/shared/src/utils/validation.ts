import { z } from "zod";

export const indianPhoneSchema = z
  .string()
  .regex(/^\+91[6-9]\d{9}$/, "Enter a valid 10-digit Indian mobile number");

export const signupSchema = z.object({
  fullName: z
    .string()
    .min(2, "Name must be at least 2 characters")
    .max(100, "Name too long")
    .regex(/^[\w\s\-'.]+$/u, "Name contains invalid characters"),
  phone: indianPhoneSchema,
  email: z.string().email("Enter a valid email address"),
  companyName: z
    .string()
    .min(2, "Company name must be at least 2 characters")
    .max(100, "Company name too long"),
  agreedToTerms: z.literal(true, {
    errorMap: () => ({ message: "You must agree to the Terms & Privacy Policy" }),
  }),
});

export const loginSchema = z.object({
  phone: indianPhoneSchema,
});

export const otpSchema = z.object({
  challengeId: z.string().uuid(),
  code: z.string().length(6, "Enter the 6-digit code"),
});

export const createWarehouseSchema = z.object({
  warehouseName: z
    .string()
    .min(2, "Name must be at least 2 characters")
    .max(100, "Name too long"),
  location: z.string().max(200).optional(),
  capacityTonnes: z.number().int().min(1).max(1_000_000).optional(),
});

export const tenantStaffRoleSchema = z.enum(["MANAGER", "STAFF"]);

export const createTenantUserInputSchema = z.object({
  tenantId: z.string().uuid(),
  fullName: z
    .string()
    .min(2, "Name must be at least 2 characters")
    .max(100, "Name too long")
    .regex(/^[\w\s\-'.]+$/u, "Name contains invalid characters"),
  phone: indianPhoneSchema,
  email: z.string().email("Enter a valid email address"),
  warehouseIds: z.array(z.string().uuid()).min(1, "Select at least one warehouse"),
  role: tenantStaffRoleSchema.default("STAFF"),
});

export const updateTenantUserInputSchema = z
  .object({
    tenantId: z.string().uuid(),
    userId: z.string().uuid(),
    fullName: z
      .string()
      .min(2, "Name must be at least 2 characters")
      .max(100, "Name too long")
      .regex(/^[\w\s\-'.]+$/u, "Name contains invalid characters")
      .optional(),
    phone: indianPhoneSchema.optional(),
    email: z.string().email("Enter a valid email address").optional(),
    isActive: z.boolean().optional(),
    role: tenantStaffRoleSchema.optional(),
    warehouseIds: z.array(z.string().uuid()).min(1).optional(),
  })
  .refine(
    (v) =>
      v.fullName !== undefined ||
      v.phone !== undefined ||
      v.email !== undefined ||
      v.isActive !== undefined ||
      v.role !== undefined ||
      v.warehouseIds !== undefined,
    { message: "Nothing to update", path: ["tenantId"] }
  );

export type SignupInput = z.infer<typeof signupSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type OtpInput = z.infer<typeof otpSchema>;
export type CreateWarehouseInput = z.infer<typeof createWarehouseSchema>;
export type CreateTenantUserInput = z.infer<typeof createTenantUserInputSchema>;
export type UpdateTenantUserInput = z.infer<typeof updateTenantUserInputSchema>;
