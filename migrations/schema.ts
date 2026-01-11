import { mysqlTable, mysqlSchema, AnyMySqlColumn, index, foreignKey, int, varchar, float, text, datetime, mediumtext, unique } from "drizzle-orm/mysql-core"
import { sql } from "drizzle-orm"

export const report = mysqlTable("report", {
	id: int().autoincrement().notNull(),
	userId: int("user_id").default('NULL').references(() => user.id, { onDelete: "restrict", onUpdate: "restrict" } ),
	symbol: varchar({ length: 20 }).default('NULL'),
	strategy: varchar({ length: 50 }).default('NULL'),
	tradingType: varchar("trading_type", { length: 50 }).default('NULL'),
	capital: float().default('NULL'),
	risk: float().default('NULL'),
	confirmation: varchar({ length: 100 }).default('NULL'),
	resultSummary: varchar("result_summary", { length: 200 }).default('NULL'),
	reportText: text("report_text").default('NULL'),
	rrLong: float("rr_long").default('NULL'),
	rrShort: float("rr_short").default('NULL'),
	trend: varchar({ length: 20 }).default('NULL'),
	timestamp: datetime({ mode: 'string'}).default('NULL'),
},
(table) => [		userId: index("user_id").on(table.userId),
]);

export const reportOld = mysqlTable("report_old", {
	id: int().autoincrement().notNull(),
	userId: int("user_id").default('NULL').references(() => user.id, { onDelete: "restrict", onUpdate: "restrict" } ),
	symbol: varchar({ length: 20 }).default('NULL'),
	strategy: varchar({ length: 50 }).default('NULL'),
	tradingType: varchar("trading_type", { length: 50 }).default('NULL'),
	capital: float().default('NULL'),
	risk: float().default('NULL'),
	confirmation: varchar({ length: 100 }).default('NULL'),
	resultSummary: varchar("result_summary", { length: 200 }).default('NULL'),
	reportText: text("report_text").default('NULL'),
	rrLong: float("rr_long").default('NULL'),
	rrShort: float("rr_short").default('NULL'),
	trend: varchar({ length: 20 }).default('NULL'),
	timestamp: datetime({ mode: 'string'}).default('NULL'),
},
(table) => [		userId: index("user_id").on(table.userId),
]);

export const reportV2 = mysqlTable("report_v2", {
	id: int().autoincrement().notNull(),
	userId: int("user_id").default('NULL'),
	symbol: varchar({ length: 20 }).notNull(),
	strategy: varchar({ length: 50 }).default('NULL'),
	tradingType: varchar("trading_type", { length: 50 }).default('NULL'),
	capital: float().default('NULL'),
	risk: float().default('NULL'),
	confirmation: varchar({ length: 200 }).default('NULL'),
	reportText: text("report_text").default('NULL'),
	resultSummary: varchar("result_summary", { length: 200 }).default('NULL'),
	rrLong: float("rr_long").default('NULL'),
	rrShort: float("rr_short").default('NULL'),
	entryPrice: float("entry_price").default('NULL'),
	exitPrice: float("exit_price").default('NULL'),
	direction: varchar({ length: 10 }).default('NULL'),
	trend: varchar({ length: 20 }).default('NULL'),
	timestamp: datetime({ mode: 'string'}).default('current_timestamp()'),
	profitLoss: float("profit_loss").default('NULL'),
	profitLossPercent: float("profit_loss_percent").default('NULL'),
	success: tinyint().default('NULL'),
	stopLoss: float("stop_loss").default('NULL'),
	takeProfit: float("take_profit").default('NULL'),
});

export const sessions = mysqlTable("sessions", {
	sessionId: varchar("session_id", { length: 128 }).notNull(),
	expires: int().notNull(),
	data: mediumtext().default('NULL'),
});

export const user = mysqlTable("user", {
	id: int().autoincrement().notNull(),
	email: varchar({ length: 120 }).notNull(),
	passwordHash: varchar("password_hash", { length: 256 }).notNull(),
	createdAt: datetime("created_at", { mode: 'string'}).default('NULL'),
	plan: varchar({ length: 20 }).default('NULL'),
},
(table) => [
	unique("email").on(table.email),
]);
