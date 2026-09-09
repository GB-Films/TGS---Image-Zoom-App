import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const maskVersions = sqliteTable("mask_versions", {
  version: integer("version").primaryKey({ autoIncrement: true }),
  requestId: text("request_id").notNull().unique(),
  payload: text("payload").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const maskSessions = sqliteTable("mask_sessions", {
  tokenHash: text("token_hash").primaryKey(),
  expiresAt: integer("expires_at").notNull(),
});

export const maskLoginLimits = sqliteTable("mask_login_limits", {
  key: text("key").primaryKey(),
  attempts: integer("attempts").notNull(),
  expiresAt: integer("expires_at").notNull(),
});
