CREATE TYPE "public"."auth_provider" AS ENUM('email', 'google', 'microsoft');--> statement-breakpoint
CREATE TYPE "public"."company_role" AS ENUM('OWNER', 'ADMIN', 'DEPARTMENT_MANAGER', 'EMPLOYEE', 'GUEST');--> statement-breakpoint
CREATE TYPE "public"."invitation_status" AS ENUM('pending', 'accepted', 'declined', 'expired');--> statement-breakpoint
CREATE TYPE "public"."project_role" AS ENUM('PROJECT_LEADER', 'BIM_MANAGER', 'BIM_COORDINATOR', 'DESIGN_LEAD', 'DESIGN_MANAGER', 'DESIGN_TEAM_MEMBER', 'ENGINEER', 'EXTERNAL_CONSULTANT', 'PROJECT_VIEWER');--> statement-breakpoint
CREATE TYPE "public"."role" AS ENUM('BIM_MANAGER', 'BIM_PROJECT_MANAGER', 'BIM_COORDINATOR', 'BIM_DESIGNER', 'ENGINEER', 'PROJECT_MANAGER', 'DESIGN_MANAGER', 'VIEWER');--> statement-breakpoint
CREATE TABLE "attachments" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"point_id" varchar NOT NULL,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"size" text NOT NULL,
	"url" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "attendance_records" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"meeting_id" varchar,
	"occurrence_id" varchar,
	"attendee_id" varchar,
	"series_attendee_id" varchar,
	"present" boolean DEFAULT false NOT NULL,
	"recorded_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "attendees" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"meeting_id" varchar NOT NULL,
	"user_id" varchar,
	"name" text NOT NULL,
	"email" text,
	"role" text NOT NULL,
	"company" text,
	"avatar" text,
	"status" text DEFAULT 'pending' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "companies" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"code" text,
	"description" text,
	"logo" text,
	"website" text,
	"email" text,
	"email_domain" text,
	"phone" text,
	"address" text,
	"city" text,
	"country" text,
	"industry" text,
	"size" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "company_invitations" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" varchar NOT NULL,
	"inviter_id" varchar NOT NULL,
	"email" text NOT NULL,
	"invitee_id" varchar,
	"token" text NOT NULL,
	"company_role" "company_role" DEFAULT 'EMPLOYEE',
	"status" "invitation_status" DEFAULT 'pending' NOT NULL,
	"expires_at" timestamp NOT NULL,
	"responded_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "company_invitations_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "disciplines" (
	"code" varchar(10) PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "meeting_disciplines" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"meeting_id" varchar NOT NULL,
	"discipline_code" varchar(10) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "meeting_occurrences" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"series_id" varchar NOT NULL,
	"date" text NOT NULL,
	"start_time_override" text,
	"end_time_override" text,
	"location_override" text,
	"status" text DEFAULT 'scheduled' NOT NULL,
	"notes" text,
	"calendar_occurrence_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "meeting_series" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" varchar,
	"title" text NOT NULL,
	"recurrence_rule" text NOT NULL,
	"start_time" text NOT NULL,
	"end_time" text NOT NULL,
	"location" text NOT NULL,
	"platform" text NOT NULL,
	"agenda" text,
	"meeting_link" text,
	"status" text DEFAULT 'active' NOT NULL,
	"closed_at" timestamp,
	"calendar_provider" text,
	"calendar_event_id" text,
	"calendar_last_synced" timestamp,
	"removed_from_calendar" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "meetings" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" varchar,
	"title" text NOT NULL,
	"date" text NOT NULL,
	"start_time" text NOT NULL,
	"end_time" text NOT NULL,
	"location" text NOT NULL,
	"platform" text NOT NULL,
	"project" text NOT NULL,
	"agenda" text,
	"meeting_link" text,
	"status" text DEFAULT 'scheduled' NOT NULL,
	"closed_at" timestamp,
	"calendar_provider" text,
	"calendar_event_id" text,
	"calendar_last_synced" timestamp,
	"removed_from_calendar" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "point_disciplines" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"point_id" varchar NOT NULL,
	"discipline_code" varchar(10) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "points" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"meeting_id" varchar,
	"series_id" varchar,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"image" text,
	"status" text NOT NULL,
	"assigned_to" text NOT NULL,
	"assigned_to_ref" text,
	"due_date" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_users" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"project_id" varchar NOT NULL,
	"project_role" "project_role" DEFAULT 'PROJECT_VIEWER',
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"code" text NOT NULL,
	"description" text,
	"street" text,
	"city" text NOT NULL,
	"country" text NOT NULL,
	"status" text NOT NULL,
	"client" text,
	"start_date" text,
	"end_date" text,
	"construction_type" text,
	"contract_value" numeric,
	"owner_company_id" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "role_permissions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"role" "role" NOT NULL,
	"action" text NOT NULL,
	"is_enabled" boolean DEFAULT true NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "series_attendees" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"series_id" varchar NOT NULL,
	"user_id" varchar,
	"name" text NOT NULL,
	"email" text,
	"role" text NOT NULL,
	"company" text,
	"avatar" text
);
--> statement-breakpoint
CREATE TABLE "series_disciplines" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"series_id" varchar NOT NULL,
	"discipline_code" varchar(10) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "status_updates" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"point_id" varchar NOT NULL,
	"date" text NOT NULL,
	"status" text NOT NULL,
	"action_on" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_roles" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"role" "role" NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"company_id" varchar,
	"company_role" "company_role" DEFAULT 'EMPLOYEE',
	"avatar" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"password_hash" text,
	"google_id" text,
	"microsoft_id" text,
	"auth_provider" "auth_provider" DEFAULT 'email',
	"email_verified" boolean DEFAULT false,
	"last_login_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email"),
	CONSTRAINT "users_google_id_unique" UNIQUE("google_id"),
	CONSTRAINT "users_microsoft_id_unique" UNIQUE("microsoft_id")
);
--> statement-breakpoint
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_point_id_points_id_fk" FOREIGN KEY ("point_id") REFERENCES "public"."points"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_meeting_id_meetings_id_fk" FOREIGN KEY ("meeting_id") REFERENCES "public"."meetings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_occurrence_id_meeting_occurrences_id_fk" FOREIGN KEY ("occurrence_id") REFERENCES "public"."meeting_occurrences"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_attendee_id_attendees_id_fk" FOREIGN KEY ("attendee_id") REFERENCES "public"."attendees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_series_attendee_id_series_attendees_id_fk" FOREIGN KEY ("series_attendee_id") REFERENCES "public"."series_attendees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendees" ADD CONSTRAINT "attendees_meeting_id_meetings_id_fk" FOREIGN KEY ("meeting_id") REFERENCES "public"."meetings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendees" ADD CONSTRAINT "attendees_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_invitations" ADD CONSTRAINT "company_invitations_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_invitations" ADD CONSTRAINT "company_invitations_inviter_id_users_id_fk" FOREIGN KEY ("inviter_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_invitations" ADD CONSTRAINT "company_invitations_invitee_id_users_id_fk" FOREIGN KEY ("invitee_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meeting_disciplines" ADD CONSTRAINT "meeting_disciplines_meeting_id_meetings_id_fk" FOREIGN KEY ("meeting_id") REFERENCES "public"."meetings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meeting_disciplines" ADD CONSTRAINT "meeting_disciplines_discipline_code_disciplines_code_fk" FOREIGN KEY ("discipline_code") REFERENCES "public"."disciplines"("code") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meeting_occurrences" ADD CONSTRAINT "meeting_occurrences_series_id_meeting_series_id_fk" FOREIGN KEY ("series_id") REFERENCES "public"."meeting_series"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meeting_series" ADD CONSTRAINT "meeting_series_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meetings" ADD CONSTRAINT "meetings_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "point_disciplines" ADD CONSTRAINT "point_disciplines_point_id_points_id_fk" FOREIGN KEY ("point_id") REFERENCES "public"."points"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "point_disciplines" ADD CONSTRAINT "point_disciplines_discipline_code_disciplines_code_fk" FOREIGN KEY ("discipline_code") REFERENCES "public"."disciplines"("code") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "points" ADD CONSTRAINT "points_meeting_id_meetings_id_fk" FOREIGN KEY ("meeting_id") REFERENCES "public"."meetings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "points" ADD CONSTRAINT "points_series_id_meeting_series_id_fk" FOREIGN KEY ("series_id") REFERENCES "public"."meeting_series"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_users" ADD CONSTRAINT "project_users_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_users" ADD CONSTRAINT "project_users_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_owner_company_id_companies_id_fk" FOREIGN KEY ("owner_company_id") REFERENCES "public"."companies"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "series_attendees" ADD CONSTRAINT "series_attendees_series_id_meeting_series_id_fk" FOREIGN KEY ("series_id") REFERENCES "public"."meeting_series"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "series_attendees" ADD CONSTRAINT "series_attendees_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "series_disciplines" ADD CONSTRAINT "series_disciplines_series_id_meeting_series_id_fk" FOREIGN KEY ("series_id") REFERENCES "public"."meeting_series"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "series_disciplines" ADD CONSTRAINT "series_disciplines_discipline_code_disciplines_code_fk" FOREIGN KEY ("discipline_code") REFERENCES "public"."disciplines"("code") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "status_updates" ADD CONSTRAINT "status_updates_point_id_points_id_fk" FOREIGN KEY ("point_id") REFERENCES "public"."points"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE set null ON UPDATE no action;