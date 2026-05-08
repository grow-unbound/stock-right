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

export type SignupInput = z.infer<typeof signupSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type OtpInput = z.infer<typeof otpSchema>;
export type CreateWarehouseInput = z.infer<typeof createWarehouseSchema>;
