import type { Express } from "express";
import { createServer, type Server } from "http";
import session from "express-session";
import MySQLStoreFactory from "express-mysql-session";
import MemoryStore from "memorystore";
import { storage } from "./storage";
import { 
  insertUserSchema, 
  loginSchema, 
  resetPasswordRequestSchema,
  resetPasswordSchema,
  verifyEmailSchema 
} from "@shared/schema";
import bcrypt from "bcrypt";
import { pool } from "./db";
import crypto from "crypto";
import { sendEmail, generateVerificationEmail, generatePasswordResetEmail } from "./email";

const MySQLStore = MySQLStoreFactory(session);
const MemoryStoreSession = MemoryStore(session);

declare module "express-session" {
  interface SessionData {
    userId?: string;
  }
}

export async function registerRoutes(app: Express): Promise<Server> {
  const sessionStore = pool
    ? new MySQLStore({}, pool as any)
    : new MemoryStoreSession({
        checkPeriod: 86400000,
      });

  app.use(
    session({
      secret: process.env.SESSION_SECRET || "crypto-analyzer-secret-key-change-in-production",
      store: sessionStore,
      resave: false,
      saveUninitialized: false,
      cookie: {
        secure: process.env.NODE_ENV === "production",
        httpOnly: true,
        maxAge: 1000 * 60 * 60 * 24 * 7,
      },
    })
  );

  // --- Register ---
  app.post("/api/auth/register", async (req, res) => {
    try {
      const validatedData = insertUserSchema.parse(req.body);

      const existingUser = await storage.getUserByEmail(validatedData.email);
      if (existingUser) return res.status(400).json({ error: "User with this email already exists" });

      const hashedPassword = await bcrypt.hash(validatedData.password, 10);
      const verificationToken = crypto.randomBytes(32).toString('hex');

      const user = await storage.createUser({
        email: validatedData.email,
        password_hash: hashedPassword,
        plan: validatedData.plan || undefined,
      });

      await storage.setVerificationToken(user.email, verificationToken);

      const language = (req.headers['accept-language']?.split(',')[0]?.split('-')[0] as 'en' | 'uk' | 'ru') || 'en';
      
      // Проверяем BASE_URL перед генерацией email
      if (!process.env.BASE_URL) {
        console.error('BASE_URL is not set, email link will be incorrect');
      }
      
      const emailData = generateVerificationEmail(verificationToken, language);
      
      try {
        await sendEmail({
          to: user.email,
          ...emailData,
        });
        console.log('Verification email sent successfully to:', user.email);
      } catch (emailError) {
        console.error('Failed to send verification email:', emailError);
        if (emailError instanceof Error) {
          console.error('Email error details:', {
            message: emailError.message,
            code: (emailError as any).code,
            response: (emailError as any).response,
            stack: emailError.stack,
          });
        }
        // Продолжаем выполнение - пользователь все равно создан
        // НЕ возвращаем ошибку, чтобы регистрация прошла успешно
      }

      // НЕ устанавливаем сессию сразу - требуется верификация
      // req.session.userId = user.id;

      const { password_hash, ...userWithoutPassword } = user;
      res.json(userWithoutPassword);
    } catch (error) {
      console.error("Registration error:", error);
      if (error instanceof Error) {
        console.error("Registration error details:", {
          message: error.message,
          stack: error.stack,
        });
      }
      // Возвращаем 400 для ошибок валидации, 500 для остальных
      if (error && typeof error === 'object' && 'issues' in error) {
        return res.status(400).json({ error: "Invalid registration data" });
      }
      return res.status(500).json({ 
        error: "Registration failed. Please try again later.",
        details: process.env.NODE_ENV === 'development' && error instanceof Error 
          ? error.message 
          : undefined
      });
    }
  });

  // --- Login ---
  app.post("/api/auth/login", async (req, res) => {
    try {
      const validatedData = loginSchema.parse(req.body);
      const user = await storage.getUserByEmail(validatedData.email);
      if (!user) return res.status(401).json({ error: "Invalid email or password" });

      const isValidPassword = await bcrypt.compare(validatedData.password, user.password_hash);
      if (!isValidPassword) return res.status(401).json({ error: "Invalid email or password" });

      if (!user.email_verified) {
        return res.status(403).json({ 
          error: "Email not verified", 
          code: "EMAIL_NOT_VERIFIED",
          email: user.email 
        });
      }

      req.session.userId = user.id;

      const { password_hash, ...userWithoutPassword } = user;
      res.json(userWithoutPassword);
    } catch (error) {
      console.error("Login error:", error);
      res.status(400).json({ error: "Invalid login data" });
    }
  });

  // --- Logout ---
  app.post("/api/auth/logout", (req, res) => {
    req.session.destroy((err) => {
      if (err) return res.status(500).json({ error: "Failed to logout" });
      res.json({ message: "Logged out successfully" });
    });
  });

  // --- Current user ---
  app.get("/api/auth/me", async (req, res) => {
    if (!req.session.userId) return res.status(401).json({ error: "Not authenticated" });

    const user = await storage.getUser(req.session.userId);
    if (!user) return res.status(401).json({ error: "User not found" });

    const { password_hash, ...userWithoutPassword } = user;
    res.json(userWithoutPassword);
  });

  // --- Update user plan ---
  app.patch("/api/user/plan", async (req, res) => {
    if (!req.session.userId) return res.status(401).json({ error: "Not authenticated" });

    const { plan } = req.body;
    if (!plan || !['free', 'pro', 'pro_plus'].includes(plan)) {
      return res.status(400).json({ error: "Invalid plan" });
    }

    try {
      const updated = await storage.updateUserPlan(req.session.userId, plan);
      if (!updated) return res.status(404).json({ error: "User not found" });

      const { password_hash, ...userWithoutPassword } = updated;
      res.json(userWithoutPassword);
    } catch (error) {
      console.error("Error updating user plan:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // --- Verify Email ---
  app.post("/api/auth/verify-email", async (req, res) => {
    try {
      const { token } = verifyEmailSchema.parse(req.body);
      
      const user = await storage.verifyEmail(token);
      if (!user) {
        return res.status(400).json({ error: "Invalid or expired verification token" });
      }

      req.session.userId = user.id;

      const { password_hash, ...userWithoutPassword } = user;
      res.json(userWithoutPassword);
    } catch (error) {
      console.error("Email verification error:", error);
      res.status(400).json({ error: "Invalid verification request" });
    }
  });

  // --- Resend Verification Email ---
  app.post("/api/auth/resend-verification", async (req, res) => {
    try {
      // Проверяем переменные окружения в начале
      const missingVars = [];
      if (!process.env.SMTP_HOST) missingVars.push('SMTP_HOST');
      if (!process.env.SMTP_USER) missingVars.push('SMTP_USER');
      if (!process.env.SMTP_PASS) missingVars.push('SMTP_PASS');
      
      if (missingVars.length > 0) {
        console.error('SMTP configuration missing:', missingVars);
        return res.status(500).json({ 
          error: "Email service is not configured. Please contact support.",
        });
      }

      const { email } = req.body;
      if (!email) return res.status(400).json({ error: "Email is required" });

      const user = await storage.getUserByEmail(email);
      if (!user) return res.status(404).json({ error: "User not found" });

      if (user.email_verified) {
        return res.status(400).json({ error: "Email already verified" });
      }

      const verificationToken = crypto.randomBytes(32).toString('hex');
      await storage.setVerificationToken(user.email, verificationToken);

      const language = (req.headers['accept-language']?.split(',')[0]?.split('-')[0] as 'en' | 'uk' | 'ru') || 'en';
      const emailData = generateVerificationEmail(verificationToken, language);

      try {
        await sendEmail({
          to: user.email,
          ...emailData,
        });
        console.log('Verification email resent successfully to:', user.email);
      } catch (emailError) {
        console.error('Failed to resend verification email:', emailError);
        if (emailError instanceof Error) {
          console.error('Email error details:', {
            message: emailError.message,
            code: (emailError as any).code,
            response: (emailError as any).response,
            stack: emailError.stack,
          });
        }
        const errorMessage = emailError instanceof Error 
          ? emailError.message 
          : 'Unknown error';
        
        // Проверяем, не связана ли ошибка с конфигурацией
        if (errorMessage.includes('SMTP configuration')) {
          return res.status(500).json({ 
            error: "Email service is not configured. Please contact support.",
          });
        }
        
        return res.status(500).json({ 
          error: "Failed to send verification email. Please try again later or contact support.",
        });
      }

      res.json({ message: "Verification email sent" });
    } catch (error) {
      console.error("Resend verification error:", error);
      if (error instanceof Error) {
        console.error("Error details:", error.message, error.stack);
      }
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  // --- Request Password Reset ---
  app.post("/api/auth/reset-password-request", async (req, res) => {
    try {
      // Проверяем переменные окружения в начале
      const missingVars = [];
      if (!process.env.SMTP_HOST) missingVars.push('SMTP_HOST');
      if (!process.env.SMTP_USER) missingVars.push('SMTP_USER');
      if (!process.env.SMTP_PASS) missingVars.push('SMTP_PASS');
      
      if (missingVars.length > 0) {
        console.error('SMTP configuration missing:', missingVars);
        return res.status(500).json({ 
          error: "Email service is not configured. Please contact support.",
        });
      }

      const { email } = resetPasswordRequestSchema.parse(req.body);
      
      const user = await storage.getUserByEmail(email);
      if (!user) {
        // Возвращаем успех для безопасности (не раскрываем существование email)
        return res.json({ message: "If the email exists, a password reset link has been sent" });
      }

      const resetToken = crypto.randomBytes(32).toString('hex');
      const expires = new Date(Date.now() + 60 * 60 * 1000);

      await storage.setResetToken(email, resetToken, expires);

      const language = (req.headers['accept-language']?.split(',')[0]?.split('-')[0] as 'en' | 'uk' | 'ru') || 'en';
      const emailData = generatePasswordResetEmail(resetToken, language);

      try {
        await sendEmail({
          to: user.email,
          ...emailData,
        });
        console.log('Password reset email sent successfully to:', user.email);
      } catch (emailError) {
        console.error('Failed to send password reset email:', emailError);
        // Логируем детали для отладки
        if (emailError instanceof Error) {
          console.error('Email error details:', {
            message: emailError.message,
            code: (emailError as any).code,
            response: (emailError as any).response,
            stack: emailError.stack
          });
        }
        // Возвращаем ошибку с более информативным сообщением
        const errorMessage = emailError instanceof Error 
          ? emailError.message 
          : 'Unknown error';
        
        // Проверяем, не связана ли ошибка с конфигурацией
        if (errorMessage.includes('SMTP configuration')) {
          return res.status(500).json({ 
            error: "Email service is not configured. Please contact support.",
          });
        }
        
        return res.status(500).json({ 
          error: "Failed to send email. Please try again later or contact support.",
          details: process.env.NODE_ENV === 'development' ? errorMessage : undefined
        });
      }

      res.json({ message: "If the email exists, a password reset link has been sent" });
    } catch (error) {
      console.error("Password reset request error:", error);
      if (error instanceof Error) {
        console.error("Error details:", error.message, error.stack);
      }
      // Возвращаем 500 для неожиданных ошибок, 400 для ошибок валидации
      if (error && typeof error === 'object' && 'issues' in error) {
        return res.status(400).json({ error: "Invalid request" });
      }
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  // --- Reset Password ---
  app.post("/api/auth/reset-password", async (req, res) => {
    try {
      const { token, password } = resetPasswordSchema.parse(req.body);
      
      const hashedPassword = await bcrypt.hash(password, 10);
      const user = await storage.resetPassword(token, hashedPassword);

      if (!user) {
        return res.status(400).json({ error: "Invalid or expired reset token" });
      }

      req.session.userId = user.id;

      const { password_hash, ...userWithoutPassword } = user;
      res.json(userWithoutPassword);
    } catch (error) {
      console.error("Password reset error:", error);
      res.status(400).json({ error: "Invalid password reset request" });
    }
  });

  return createServer(app);
}
