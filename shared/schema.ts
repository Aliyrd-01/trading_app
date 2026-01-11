import { sql } from "drizzle-orm";
import { pgTable, varchar, text, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("user", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  email: text("email").notNull().unique(),
  password_hash: text("password_hash").notNull(),
  created_at: timestamp("created_at").notNull().defaultNow(),
  plan: text("plan").default("free"),
  email_verified: boolean("email_verified").notNull().default(false),
  verification_token: varchar("verification_token", { length: 64 }),
  reset_token: varchar("reset_token", { length: 64 }),
  reset_token_expires: timestamp("reset_token_expires"),
});

// --- Важно: исключаем system-поля и password_hash ---
export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  created_at: true,
  password_hash: true,
}).extend({
  password: z.string().min(6, "Password must be at least 6 characters long"),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6, "Password must be at least 6 characters long"),
});

export const resetPasswordRequestSchema = z.object({
  email: z.string().email(),
});

export const resetPasswordSchema = z.object({
  token: z.string(),
  password: z.string().min(6, "Password must be at least 6 characters long"),
});

export const verifyEmailSchema = z.object({
  token: z.string(),
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type LoginData = z.infer<typeof loginSchema>;
export type ResetPasswordRequest = z.infer<typeof resetPasswordRequestSchema>;
export type ResetPassword = z.infer<typeof resetPasswordSchema>;
export type VerifyEmail = z.infer<typeof verifyEmailSchema>;
