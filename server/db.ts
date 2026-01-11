import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import * as schema from "@shared/schema";

function buildDb() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    console.error("DATABASE_URL is not set. Database connection was not created.");
    return null;
  }

  try {
    const sql = neon(databaseUrl);
    return drizzle(sql, { schema });
  } catch (err) {
    console.error("Failed to initialize database connection:", err);
    return null;
  }
}

// Create Drizzle instance with PostgreSQL connection
export const db = buildDb();

// For compatibility with existing code that uses pool
export const pool = db ? {} : null;
