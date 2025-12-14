import { sql } from "drizzle-orm";
import { pgTable, pgEnum, text, varchar, timestamp, integer, numeric, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// ===== RBAC (Role-Based Access Control) =====

// App-level Role enum (for project permissions)
export const roleEnum = pgEnum("role", [
  "BIM_MANAGER",
  "BIM_PROJECT_MANAGER", 
  "BIM_COORDINATOR",
  "BIM_DESIGNER",
  "ENGINEER",
  "PROJECT_MANAGER",
  "DESIGN_MANAGER",
  "VIEWER"
]);

export type Role = (typeof roleEnum.enumValues)[number];

// Company Role enum (user's role within their company)
export const companyRoleEnum = pgEnum("company_role", [
  "OWNER",
  "ADMIN",
  "DEPARTMENT_MANAGER",
  "EMPLOYEE",
  "GUEST"
]);

export type CompanyRole = (typeof companyRoleEnum.enumValues)[number];

// Company role display names
export const COMPANY_ROLE_DISPLAY_NAMES: Record<CompanyRole, string> = {
  OWNER: "Owner",
  ADMIN: "Admin",
  DEPARTMENT_MANAGER: "Department Manager",
  EMPLOYEE: "Employee",
  GUEST: "Guest"
};

// Company role descriptions
export const COMPANY_ROLE_DESCRIPTIONS: Record<CompanyRole, string> = {
  OWNER: "Company founder with full control over company settings and all employees",
  ADMIN: "Can manage company settings, employees, and projects",
  DEPARTMENT_MANAGER: "Manages a department and its team members",
  EMPLOYEE: "Regular company employee with standard access",
  GUEST: "External collaborator with limited access"
};

// Project Role enum (user's role within a specific project)
export const projectRoleEnum = pgEnum("project_role", [
  "PROJECT_LEADER",
  "BIM_MANAGER",
  "BIM_COORDINATOR",
  "DESIGN_LEAD",
  "DESIGN_MANAGER",
  "DESIGN_TEAM_MEMBER",
  "ENGINEER",
  "EXTERNAL_CONSULTANT",
  "PROJECT_VIEWER"
]);

export type ProjectRole = (typeof projectRoleEnum.enumValues)[number];

// Project role display names
export const PROJECT_ROLE_DISPLAY_NAMES: Record<ProjectRole, string> = {
  PROJECT_LEADER: "Project Leader",
  BIM_MANAGER: "BIM Manager",
  BIM_COORDINATOR: "BIM Coordinator",
  DESIGN_LEAD: "Design Lead",
  DESIGN_MANAGER: "Design Manager",
  DESIGN_TEAM_MEMBER: "Design Team Member",
  ENGINEER: "Engineer",
  EXTERNAL_CONSULTANT: "External Consultant",
  PROJECT_VIEWER: "Project Viewer"
};

// Project role descriptions
export const PROJECT_ROLE_DESCRIPTIONS: Record<ProjectRole, string> = {
  PROJECT_LEADER: "Overall project leadership and decision-making authority",
  BIM_MANAGER: "Manages BIM processes, standards, and coordination",
  BIM_COORDINATOR: "Coordinates BIM models and clash detection",
  DESIGN_LEAD: "Leads design direction and reviews",
  DESIGN_MANAGER: "Manages design team and deliverables",
  DESIGN_TEAM_MEMBER: "Creates and updates design documentation",
  ENGINEER: "Technical engineering role",
  EXTERNAL_CONSULTANT: "External advisor or specialist",
  PROJECT_VIEWER: "View-only access to project resources"
};

// Companies table
export const companies = pgTable("companies", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  code: text("code"),
  description: text("description"),
  logo: text("logo"),
  website: text("website"),
  email: text("email"),
  emailDomain: text("email_domain"), // Auto-detected email domain for user matching (e.g., "acme.com")
  phone: text("phone"),
  address: text("address"),
  city: text("city"),
  country: text("country"),
  industry: text("industry"), // 'construction' | 'architecture' | 'engineering' | 'consulting' | 'other'
  size: text("size"), // 'small' | 'medium' | 'large' | 'enterprise'
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertCompanySchema = createInsertSchema(companies).omit({
  id: true,
  createdAt: true,
});

export type InsertCompany = z.infer<typeof insertCompanySchema>;
export type Company = typeof companies.$inferSelect;

// Invitation status enum
export const invitationStatusEnum = pgEnum("invitation_status", [
  "pending",
  "accepted",
  "declined",
  "expired"
]);

export type InvitationStatus = (typeof invitationStatusEnum.enumValues)[number];

// Company Invitations table (for inviting team members to a company)
export const companyInvitations = pgTable("company_invitations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id").notNull().references(() => companies.id, { onDelete: 'cascade' }),
  inviterId: varchar("inviter_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  email: text("email").notNull(),
  inviteeId: varchar("invitee_id").references(() => users.id, { onDelete: 'set null' }),
  token: text("token").notNull().unique(),
  companyRole: companyRoleEnum("company_role").default("EMPLOYEE"),
  status: invitationStatusEnum("status").default("pending").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  respondedAt: timestamp("responded_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertCompanyInvitationSchema = createInsertSchema(companyInvitations).omit({
  id: true,
  createdAt: true,
});

export type InsertCompanyInvitation = z.infer<typeof insertCompanyInvitationSchema>;
export type CompanyInvitation = typeof companyInvitations.$inferSelect;

// Auth provider enum
export const authProviderEnum = pgEnum("auth_provider", [
  "email",
  "google", 
  "microsoft"
]);

export type AuthProvider = (typeof authProviderEnum.enumValues)[number];

// Users table
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  companyId: varchar("company_id").references(() => companies.id, { onDelete: 'set null' }),
  companyRole: companyRoleEnum("company_role").default("EMPLOYEE"), // Role within their company
  avatar: text("avatar"),
  isActive: boolean("is_active").default(true).notNull(),
  passwordHash: text("password_hash"),
  googleId: text("google_id").unique(),
  microsoftId: text("microsoft_id").unique(),
  authProvider: authProviderEnum("auth_provider").default("email"),
  emailVerified: boolean("email_verified").default(false),
  lastLoginAt: timestamp("last_login_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

// User Roles table (links users to their roles)
export const userRoles = pgTable("user_roles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  role: roleEnum("role").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertUserRoleSchema = createInsertSchema(userRoles).omit({
  id: true,
  createdAt: true,
});

export type InsertUserRole = z.infer<typeof insertUserRoleSchema>;
export type UserRole = typeof userRoles.$inferSelect;

// Project Users table (links users to projects they can access)
export const projectUsers = pgTable("project_users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  projectId: varchar("project_id").notNull().references(() => projects.id, { onDelete: 'cascade' }),
  projectRole: projectRoleEnum("project_role").default("PROJECT_VIEWER"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertProjectUserSchema = createInsertSchema(projectUsers).omit({
  id: true,
  createdAt: true,
});

export type InsertProjectUser = z.infer<typeof insertProjectUserSchema>;
export type ProjectUser = typeof projectUsers.$inferSelect;

// Role Permissions table (configurable permission matrix)
export const rolePermissions = pgTable("role_permissions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  role: roleEnum("role").notNull(),
  action: text("action").notNull(), // Permission action like "meetings:create", "points:edit:any"
  isEnabled: boolean("is_enabled").notNull().default(true),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertRolePermissionSchema = createInsertSchema(rolePermissions).omit({
  id: true,
  updatedAt: true,
});

export type InsertRolePermission = z.infer<typeof insertRolePermissionSchema>;
export type RolePermission = typeof rolePermissions.$inferSelect;

// Projects table
export const projects = pgTable("projects", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  code: text("code").notNull(),
  description: text("description"),
  street: text("street"),
  city: text("city").notNull(),
  country: text("country").notNull(),
  status: text("status").notNull(), // 'planning' | 'active' | 'on_hold' | 'completed'
  client: text("client"),
  startDate: text("start_date"),
  endDate: text("end_date"),
  constructionType: text("construction_type"), // 'commercial' | 'residential' | 'infrastructure' | 'healthcare' | 'industrial'
  contractValue: numeric("contract_value"),
  ownerCompanyId: varchar("owner_company_id").references(() => companies.id, { onDelete: 'set null' }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertProjectSchema = createInsertSchema(projects).omit({
  id: true,
  createdAt: true,
});

export type InsertProject = z.infer<typeof insertProjectSchema>;
export type Project = typeof projects.$inferSelect;

// Meeting Series table (for recurring meetings)
export const meetingSeries = pgTable("meeting_series", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").references(() => projects.id, { onDelete: 'cascade' }),
  title: text("title").notNull(),
  recurrenceRule: text("recurrence_rule").notNull(), // e.g., 'weekly', 'biweekly', 'monthly'
  startTime: text("start_time").notNull(),
  endTime: text("end_time").notNull(),
  location: text("location").notNull(),
  platform: text("platform").notNull(), // 'outlook' | 'gmail'
  agenda: text("agenda"),
  meetingLink: text("meeting_link"),
  // Status fields
  status: text("status").notNull().default('active'), // 'active' | 'closed'
  closedAt: timestamp("closed_at"),
  // Calendar sync fields
  calendarProvider: text("calendar_provider"), // 'google' | 'outlook' - which calendar this was imported from
  calendarEventId: text("calendar_event_id"), // Original calendar event ID for syncing
  calendarLastSynced: timestamp("calendar_last_synced"), // Last sync timestamp
  removedFromCalendar: boolean("removed_from_calendar").default(false), // Flag if deleted from calendar
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertMeetingSeriesSchema = createInsertSchema(meetingSeries).omit({
  id: true,
  createdAt: true,
});

export type InsertMeetingSeries = z.infer<typeof insertMeetingSeriesSchema>;
export type MeetingSeries = typeof meetingSeries.$inferSelect;

// Meeting Occurrences table (individual dates within a recurring series)
export const meetingOccurrences = pgTable("meeting_occurrences", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  seriesId: varchar("series_id").notNull().references(() => meetingSeries.id, { onDelete: 'cascade' }),
  date: text("date").notNull(),
  startTimeOverride: text("start_time_override"),
  endTimeOverride: text("end_time_override"),
  locationOverride: text("location_override"),
  status: text("status").notNull().default('scheduled'), // 'scheduled' | 'completed' | 'cancelled'
  notes: text("notes"),
  // Calendar sync field
  calendarOccurrenceId: text("calendar_occurrence_id"), // Original calendar occurrence ID for syncing
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertMeetingOccurrenceSchema = createInsertSchema(meetingOccurrences).omit({
  id: true,
  createdAt: true,
});

export type InsertMeetingOccurrence = z.infer<typeof insertMeetingOccurrenceSchema>;
export type MeetingOccurrence = typeof meetingOccurrences.$inferSelect;

// Meetings table
export const meetings = pgTable("meetings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").references(() => projects.id, { onDelete: 'cascade' }),
  title: text("title").notNull(),
  date: text("date").notNull(),
  startTime: text("start_time").notNull(),
  endTime: text("end_time").notNull(),
  location: text("location").notNull(),
  platform: text("platform").notNull(), // 'outlook' | 'gmail'
  project: text("project").notNull(), // Legacy field - project name for display
  agenda: text("agenda"), // Meeting agenda notes
  meetingLink: text("meeting_link"), // Video call link (Teams, Zoom, etc.)
  // Status fields
  status: text("status").notNull().default('scheduled'), // 'scheduled' | 'closed'
  closedAt: timestamp("closed_at"),
  // Calendar sync fields
  calendarProvider: text("calendar_provider"), // 'google' | 'outlook' - which calendar this was imported from
  calendarEventId: text("calendar_event_id"), // Original calendar event ID for syncing
  calendarLastSynced: timestamp("calendar_last_synced"), // Last sync timestamp
  removedFromCalendar: boolean("removed_from_calendar").default(false), // Flag if deleted from calendar
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertMeetingSchema = createInsertSchema(meetings).omit({
  id: true,
  createdAt: true,
});

export type InsertMeeting = z.infer<typeof insertMeetingSchema>;
export type Meeting = typeof meetings.$inferSelect;

// Attendees table (for meetings)
export const attendees = pgTable("attendees", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  meetingId: varchar("meeting_id").notNull().references(() => meetings.id, { onDelete: 'cascade' }),
  userId: varchar("user_id").references(() => users.id, { onDelete: 'set null' }), // Link to user account
  name: text("name").notNull(),
  email: text("email"),
  role: text("role").notNull(), // Meeting role (e.g., "Presenter", "Attendee")
  company: text("company"),
  avatar: text("avatar"),
  status: text("status").notNull().default('pending'), // Legacy field: 'pending' | 'accepted' | 'declined'
});

export const insertAttendeeSchema = createInsertSchema(attendees).omit({
  id: true,
});

export type InsertAttendee = z.infer<typeof insertAttendeeSchema>;
export type Attendee = typeof attendees.$inferSelect;

// Series Attendees table (for recurring meeting series)
export const seriesAttendees = pgTable("series_attendees", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  seriesId: varchar("series_id").notNull().references(() => meetingSeries.id, { onDelete: 'cascade' }),
  userId: varchar("user_id").references(() => users.id, { onDelete: 'set null' }), // Link to user account
  name: text("name").notNull(),
  email: text("email"),
  role: text("role").notNull(), // Meeting role (e.g., "Presenter", "Attendee")
  company: text("company"),
  avatar: text("avatar"),
});

export const insertSeriesAttendeeSchema = createInsertSchema(seriesAttendees).omit({
  id: true,
});

export type InsertSeriesAttendee = z.infer<typeof insertSeriesAttendeeSchema>;
export type SeriesAttendee = typeof seriesAttendees.$inferSelect;

// Attendance Records table (tracks who attended each meeting/occurrence)
export const attendanceRecords = pgTable("attendance_records", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  meetingId: varchar("meeting_id").references(() => meetings.id, { onDelete: 'cascade' }),
  occurrenceId: varchar("occurrence_id").references(() => meetingOccurrences.id, { onDelete: 'cascade' }),
  attendeeId: varchar("attendee_id").references(() => attendees.id, { onDelete: 'cascade' }),
  seriesAttendeeId: varchar("series_attendee_id").references(() => seriesAttendees.id, { onDelete: 'cascade' }),
  present: boolean("present").notNull().default(false),
  recordedAt: timestamp("recorded_at").defaultNow().notNull(),
});

export const insertAttendanceRecordSchema = createInsertSchema(attendanceRecords).omit({
  id: true,
  recordedAt: true,
});

export type InsertAttendanceRecord = z.infer<typeof insertAttendanceRecordSchema>;
export type AttendanceRecord = typeof attendanceRecords.$inferSelect;

// Points table (discussion points/issues)
// Points can belong to either a single meeting OR a recurring series (not both)
export const points = pgTable("points", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  meetingId: varchar("meeting_id").references(() => meetings.id, { onDelete: 'cascade' }),
  seriesId: varchar("series_id").references(() => meetingSeries.id, { onDelete: 'cascade' }),
  title: text("title").notNull(),
  description: text("description").notNull(),
  image: text("image"), // URL or path to image
  status: text("status").notNull(), // 'open' | 'new' | 'ongoing' | 'closed' | 'postponed'
  assignedTo: text("assigned_to").notNull(), // Display name for backward compatibility
  assignedToRef: text("assigned_to_ref"), // Canonical identifier: "attendee:{id}" or "company:{name}"
  dueDate: text("due_date").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertPointSchema = createInsertSchema(points).omit({
  id: true,
  createdAt: true,
});

export type InsertPoint = z.infer<typeof insertPointSchema>;
export type Point = typeof points.$inferSelect;

// Status Updates table (history for each point)
export const statusUpdates = pgTable("status_updates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  pointId: varchar("point_id").notNull().references(() => points.id, { onDelete: 'cascade' }),
  date: text("date").notNull(),
  status: text("status").notNull(), // The status comment text
  actionOn: text("action_on").notNull(), // Person responsible
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertStatusUpdateSchema = createInsertSchema(statusUpdates).omit({
  id: true,
  createdAt: true,
});

export type InsertStatusUpdate = z.infer<typeof insertStatusUpdateSchema>;
export type StatusUpdate = typeof statusUpdates.$inferSelect;

// Attachments table
export const attachments = pgTable("attachments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  pointId: varchar("point_id").notNull().references(() => points.id, { onDelete: 'cascade' }),
  name: text("name").notNull(),
  type: text("type").notNull(), // 'pdf' | 'img' | 'dwg'
  size: text("size").notNull(),
  url: text("url").notNull(), // Storage URL
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertAttachmentSchema = createInsertSchema(attachments).omit({
  id: true,
  createdAt: true,
});

export type InsertAttachment = z.infer<typeof insertAttachmentSchema>;
export type Attachment = typeof attachments.$inferSelect;

// ===== DISCIPLINES =====

// Disciplines table (pre-seeded with MVP disciplines)
export const disciplines = pgTable("disciplines", {
  code: varchar("code", { length: 10 }).primaryKey(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertDisciplineSchema = createInsertSchema(disciplines).omit({
  createdAt: true,
});

export type InsertDiscipline = z.infer<typeof insertDisciplineSchema>;
export type Discipline = typeof disciplines.$inferSelect;

// MVP Discipline codes for validation
export const DISCIPLINE_CODES = [
  "GEN", "ARCH", "STR", "MEP", "EL", "MECH", "PL", "FIRE", "ICT", "CIVIL", "QA"
] as const;
export type DisciplineCode = typeof DISCIPLINE_CODES[number];

// Point Disciplines junction table
export const pointDisciplines = pgTable("point_disciplines", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  pointId: varchar("point_id").notNull().references(() => points.id, { onDelete: 'cascade' }),
  disciplineCode: varchar("discipline_code", { length: 10 }).notNull().references(() => disciplines.code, { onDelete: 'cascade' }),
});

export const insertPointDisciplineSchema = createInsertSchema(pointDisciplines).omit({
  id: true,
});

export type InsertPointDiscipline = z.infer<typeof insertPointDisciplineSchema>;
export type PointDiscipline = typeof pointDisciplines.$inferSelect;

// Meeting Disciplines junction table
export const meetingDisciplines = pgTable("meeting_disciplines", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  meetingId: varchar("meeting_id").notNull().references(() => meetings.id, { onDelete: 'cascade' }),
  disciplineCode: varchar("discipline_code", { length: 10 }).notNull().references(() => disciplines.code, { onDelete: 'cascade' }),
});

export const insertMeetingDisciplineSchema = createInsertSchema(meetingDisciplines).omit({
  id: true,
});

export type InsertMeetingDiscipline = z.infer<typeof insertMeetingDisciplineSchema>;
export type MeetingDiscipline = typeof meetingDisciplines.$inferSelect;

// Series Disciplines junction table
export const seriesDisciplines = pgTable("series_disciplines", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  seriesId: varchar("series_id").notNull().references(() => meetingSeries.id, { onDelete: 'cascade' }),
  disciplineCode: varchar("discipline_code", { length: 10 }).notNull().references(() => disciplines.code, { onDelete: 'cascade' }),
});

export const insertSeriesDisciplineSchema = createInsertSchema(seriesDisciplines).omit({
  id: true,
});

export type InsertSeriesDiscipline = z.infer<typeof insertSeriesDisciplineSchema>;
export type SeriesDiscipline = typeof seriesDisciplines.$inferSelect;
