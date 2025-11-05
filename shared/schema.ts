import { sql, relations } from 'drizzle-orm';
import {
  index,
  jsonb,
  pgTable,
  timestamp,
  varchar,
  text,
  integer,
  boolean,
  date,
  time,
  decimal
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Session storage table (required for Replit Auth)
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// User storage table (required for Replit Auth)
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  username: text("username").unique(),
  passwordHash: text("password_hash"),
  role: text("role").notNull().$type<'manager' | 'hr' | 'accounts' | 'admin'>(),
  fullName: text("full_name"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const leads = pgTable("leads", {
  id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
  name: text("name"),
  email: text("email"),
  phone: text("phone"),
  location: text("location"),
  degree: text("degree"),
  domain: text("domain"),
  sessionDays: text("session_days"),
  walkinDate: date("walkin_date"),
  walkinTime: time("walkin_time"),
  timing: text("timing"),
  currentOwnerId: varchar("current_owner_id").references(() => users.id),
  sourceManagerId: varchar("source_manager_id").references(() => users.id),
  status: text("status").notNull().default('new'),
  isActive: boolean("is_active").default(true),
  notes: text("notes"),
  // Dynamic columns for bulk import
  yearOfPassing: text("year_of_passing"),
  collegeName: text("college_name"),
  // HR workflow fields
  registrationAmount: decimal("registration_amount", { precision: 10, scale: 2 }),
  pendingAmount: decimal("pending_amount", { precision: 10, scale: 2 }),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const leadHistory = pgTable("lead_history", {
  id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
  leadId: integer("lead_id").references(() => leads.id).notNull(),
  fromUserId: varchar("from_user_id").references(() => users.id),
  toUserId: varchar("to_user_id").references(() => users.id),
  previousStatus: text("previous_status"),
  newStatus: text("new_status"),
  changeReason: text("change_reason"),
  changeData: jsonb("change_data"),
  changedByUserId: varchar("changed_by_user_id").references(() => users.id).notNull(),
  changedAt: timestamp("changed_at").defaultNow(),
});

export const uploads = pgTable("uploads", {
  id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
  uploaderId: varchar("uploader_id").references(() => users.id).notNull(),
  fileName: text("file_name").notNull(),
  uploadedAt: timestamp("uploaded_at").defaultNow(),
  rowCount: integer("row_count"),
  processedCount: integer("processed_count"),
  failedCount: integer("failed_count"),
  status: text("status").default('processing'),
  errors: jsonb("errors"),
});

export const notifications = pgTable("notifications", {
  id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  title: text("title").notNull(),
  message: text("message").notNull(),
  type: text("type").notNull(),
  isRead: boolean("is_read").default(false),
  relatedLeadId: integer("related_lead_id").references(() => leads.id),
  createdAt: timestamp("created_at").defaultNow(),
});

// Relations
export const userRelations = relations(users, ({ many }) => ({
  ownedLeads: many(leads, { relationName: "currentOwner" }),
  managedLeads: many(leads, { relationName: "sourceManager" }),
  uploads: many(uploads),
  notifications: many(notifications),
  historyEntries: many(leadHistory),
}));

export const leadRelations = relations(leads, ({ one, many }) => ({
  currentOwner: one(users, {
    fields: [leads.currentOwnerId],
    references: [users.id],
    relationName: "currentOwner",
  }),
  sourceManager: one(users, {
    fields: [leads.sourceManagerId],
    references: [users.id],
    relationName: "sourceManager",
  }),
  history: many(leadHistory),
}));

export const leadHistoryRelations = relations(leadHistory, ({ one }) => ({
  lead: one(leads, {
    fields: [leadHistory.leadId],
    references: [leads.id],
  }),
  fromUser: one(users, {
    fields: [leadHistory.fromUserId],
    references: [users.id],
  }),
  toUser: one(users, {
    fields: [leadHistory.toUserId],
    references: [users.id],
  }),
  changedBy: one(users, {
    fields: [leadHistory.changedByUserId],
    references: [users.id],
  }),
}));

// Schemas
export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertLeadSchema = createInsertSchema(leads).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  sessionDays: z.enum(["M,W,F", "T,T,S", "daily", "weekend", "custom"]).nullable().optional(),
  yearOfPassing: z.string().nullable().optional(),
  collegeName: z.string().nullable().optional(),
  registrationAmount: z.string().nullable().optional(), // Will be parsed as decimal in backend
  pendingAmount: z.string().nullable().optional(), // Will be parsed as decimal in backend
});

export const insertLeadHistorySchema = createInsertSchema(leadHistory).omit({
  id: true,
  changedAt: true,
});

export const insertUploadSchema = createInsertSchema(uploads).omit({
  id: true,
  uploadedAt: true,
});

export const insertNotificationSchema = createInsertSchema(notifications).omit({
  id: true,
  createdAt: true,
});

// Types
export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type Lead = typeof leads.$inferSelect;
export type InsertLead = z.infer<typeof insertLeadSchema>;
export type LeadHistory = typeof leadHistory.$inferSelect;
export type InsertLeadHistory = z.infer<typeof insertLeadHistorySchema>;
export type Upload = typeof uploads.$inferSelect;
export type InsertUpload = z.infer<typeof insertUploadSchema>;
export type Notification = typeof notifications.$inferSelect;
export type InsertNotification = z.infer<typeof insertNotificationSchema>;
