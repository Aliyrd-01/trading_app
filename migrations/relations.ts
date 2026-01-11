import { relations } from "drizzle-orm/relations";
import { user, report, reportOld } from "./schema";

export const reportRelations = relations(report, ({one}) => ({
	user: one(user, {
		fields: [report.userId],
		references: [user.id]
	}),
}));

export const userRelations = relations(user, ({many}) => ({
	reports: many(report),
	reportOlds: many(reportOld),
}));

export const reportOldRelations = relations(reportOld, ({one}) => ({
	user: one(user, {
		fields: [reportOld.userId],
		references: [user.id]
	}),
}));