import { db } from "./db";
import { users } from "@shared/schema";
import { eq } from "drizzle-orm";
import type { User } from "@shared/schema";

export const storage = {
  async getUser(id: string): Promise<User | undefined> {
    const result = await db
      ?.select()
      .from(users)
      .where(eq(users.id, id))
      .limit(1);

    return result?.[0];
  },

  async getUserByEmail(email: string): Promise<User | undefined> {
    const result = await db
      ?.select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    return result?.[0];
  },

  async createUser(data: {
    email: string;
    password_hash: string;
    plan?: string;
  }): Promise<User> {
    // Вставляем пользователя
    const insertResult = await db
      ?.insert(users)
      .values({
        email: data.email,
        password_hash: data.password_hash,
        plan: data.plan ?? "free",
      });

    // Получаем ID вставленного пользователя (для MySQL Drizzle возвращает insertId)
    const result = await db
      ?.select()
      .from(users)
      .where(eq(users.email, data.email))
      .limit(1);

    return result![0];
  },

  async updateUserPlan(id: string, plan: string): Promise<User | undefined> {
    await db?.update(users)
      .set({ plan })
      .where(eq(users.id, id));

    return this.getUser(id);
  },

  async setVerificationToken(email: string, token: string): Promise<void> {
    await db?.update(users)
      .set({ verification_token: token })
      .where(eq(users.email, email));
  },

  async verifyEmail(token: string): Promise<User | undefined> {
    const result = await db
      ?.select()
      .from(users)
      .where(eq(users.verification_token, token))
      .limit(1);

    const user = result?.[0];
    if (!user) return undefined;

    await db?.update(users)
      .set({
        email_verified: true,
        verification_token: null,
      })
      .where(eq(users.id, user.id));

    return this.getUser(user.id);
  },

  async getUserByVerificationToken(token: string): Promise<User | undefined> {
    const result = await db
      ?.select()
      .from(users)
      .where(eq(users.verification_token, token))
      .limit(1);

    return result?.[0];
  },

  async setResetToken(email: string, token: string, expires: Date): Promise<void> {
    await db?.update(users)
      .set({
        reset_token: token,
        reset_token_expires: expires,
      })
      .where(eq(users.email, email));
  },

  async getUserByResetToken(token: string): Promise<User | undefined> {
    const result = await db
      ?.select()
      .from(users)
      .where(eq(users.reset_token, token))
      .limit(1);

    return result?.[0];
  },

  async resetPassword(token: string, password_hash: string): Promise<User | undefined> {
    const result = await db
      ?.select()
      .from(users)
      .where(eq(users.reset_token, token))
      .limit(1);

    const user = result?.[0];
    if (!user) return undefined;

    if (user.reset_token_expires && user.reset_token_expires < new Date()) {
      return undefined;
    }

    await db?.update(users)
      .set({
        password_hash,
        reset_token: null,
        reset_token_expires: null,
      })
      .where(eq(users.id, user.id));

    return this.getUser(user.id);
  },
};
