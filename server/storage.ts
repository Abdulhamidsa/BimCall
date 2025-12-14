import { 
  type Meeting, 
  type InsertMeeting, 
  type Point, 
  type InsertPoint,
  type Attendee,
  type InsertAttendee,
  type StatusUpdate,
  type InsertStatusUpdate,
  type Attachment,
  type InsertAttachment,
  type Project,
  type InsertProject,
  type MeetingSeries,
  type InsertMeetingSeries,
  type MeetingOccurrence,
  type InsertMeetingOccurrence,
  type SeriesAttendee,
  type InsertSeriesAttendee,
  type AttendanceRecord,
  type InsertAttendanceRecord,
  type User,
  type InsertUser,
  type Company,
  type InsertCompany,
  type CompanyInvitation,
  type InsertCompanyInvitation,
  type UserRole,
  type InsertUserRole,
  type ProjectUser,
  type InsertProjectUser,
  type Role,
  type ProjectRole,
  type CompanyRole,
  type RolePermission,
  type Discipline,
  meetings,
  points,
  attendees,
  statusUpdates,
  attachments,
  projects,
  meetingSeries,
  meetingOccurrences,
  seriesAttendees,
  attendanceRecords,
  users,
  companies,
  companyInvitations,
  userRoles,
  projectUsers,
  rolePermissions,
  disciplines,
  pointDisciplines,
  meetingDisciplines,
  seriesDisciplines
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, asc, and, ilike, or, sql, isNotNull, like, inArray } from "drizzle-orm";

function generateMeetingInitials(meetingTitle: string): string {
  const words = meetingTitle
    .replace(/[^a-zA-Z0-9\s-]/g, '')
    .split(/[\s-]+/)
    .filter(word => word.length > 0);
  
  const initials = words
    .map(word => word[0].toUpperCase())
    .join('');
  
  return initials.slice(0, 4) || 'PT';
}

async function generatePointId(meetingId: string, meetingTitle: string): Promise<string> {
  const prefix = generateMeetingInitials(meetingTitle);
  
  const existingPoints = await db.select({ id: points.id })
    .from(points)
    .where(like(points.id, `${prefix}%`));
  
  const existingNumbers = existingPoints
    .map(p => {
      const match = p.id.match(new RegExp(`^${prefix}(\\d+)$`));
      return match ? parseInt(match[1], 10) : 0;
    })
    .filter(n => !isNaN(n));
  
  const maxNumber = existingNumbers.length > 0 ? Math.max(...existingNumbers) : 0;
  const nextNumber = maxNumber + 1;
  
  const paddedNumber = nextNumber.toString().padStart(3, '0');
  
  return `${prefix}${paddedNumber}`;
}

export interface ProjectFilters {
  city?: string;
  country?: string;
  status?: string;
  search?: string;
}

export interface MeetingFilters {
  projectId?: string;
  projectIds?: string[];
  city?: string;
  search?: string;
  sortBy?: 'date' | 'project' | 'title';
  sortOrder?: 'asc' | 'desc';
  status?: 'scheduled' | 'closed' | 'all';
}

export interface SeriesFilters {
  projectId?: string;
  projectIds?: string[];
  status?: 'active' | 'closed' | 'all';
}

export interface IStorage {
  // Projects
  getAllProjects(filters?: ProjectFilters): Promise<Project[]>;
  getProject(id: string): Promise<Project | undefined>;
  createProject(project: InsertProject): Promise<Project>;
  updateProject(id: string, project: Partial<InsertProject>): Promise<Project | undefined>;
  deleteProject(id: string): Promise<void>;
  getProjectCities(): Promise<string[]>;
  getProjectCountries(): Promise<string[]>;

  // Meetings
  getAllMeetings(filters?: MeetingFilters): Promise<Meeting[]>;
  getMeetingsByProject(projectId: string): Promise<Meeting[]>;
  getMeetingLocations(): Promise<string[]>;
  getMeeting(id: string): Promise<Meeting | undefined>;
  getMeetingByCalendarEventId(calendarEventId: string): Promise<Meeting | undefined>;
  createMeeting(meeting: InsertMeeting): Promise<Meeting>;
  updateMeeting(id: string, meeting: Partial<InsertMeeting>): Promise<Meeting | undefined>;
  deleteMeeting(id: string): Promise<void>;
  getMeetingCountByProject(projectId: string): Promise<number>;
  getAllMeetingCounts(): Promise<Record<string, number>>;

  // Attendees (for meetings)
  getAttendee(id: string): Promise<Attendee | undefined>;
  getAttendeesByMeeting(meetingId: string): Promise<Attendee[]>;
  createAttendee(attendee: InsertAttendee): Promise<Attendee>;
  updateAttendee(id: string, attendee: Partial<InsertAttendee>): Promise<Attendee | undefined>;
  deleteAttendee(id: string): Promise<void>;
  bulkCreateAttendees(attendees: InsertAttendee[]): Promise<Attendee[]>;
  getAllMeetingAttendeeCounts(): Promise<Record<string, number>>;

  // Series Attendees (for recurring series)
  getSeriesAttendee(id: string): Promise<SeriesAttendee | undefined>;
  getAttendeesBySeries(seriesId: string): Promise<SeriesAttendee[]>;
  createSeriesAttendee(attendee: InsertSeriesAttendee): Promise<SeriesAttendee>;
  updateSeriesAttendee(id: string, attendee: Partial<InsertSeriesAttendee>): Promise<SeriesAttendee | undefined>;
  deleteSeriesAttendee(id: string): Promise<void>;
  bulkCreateSeriesAttendees(attendees: InsertSeriesAttendee[]): Promise<SeriesAttendee[]>;
  getAllSeriesAttendeeCounts(): Promise<Record<string, number>>;

  // Attendance Records
  getAttendanceByMeeting(meetingId: string): Promise<AttendanceRecord[]>;
  getAttendanceByOccurrence(occurrenceId: string): Promise<AttendanceRecord[]>;
  recordAttendance(record: InsertAttendanceRecord): Promise<AttendanceRecord>;
  updateAttendance(id: string, present: boolean): Promise<AttendanceRecord | undefined>;
  getAttendanceHistory(attendeeId: string): Promise<AttendanceRecord[]>;
  getSeriesAttendanceHistory(seriesAttendeeId: string): Promise<AttendanceRecord[]>;

  // Points
  getPointsByMeeting(meetingId: string): Promise<Point[]>;
  getPointsByProject(projectId: string): Promise<(Point & { meetingTitle?: string; seriesTitle?: string })[]>;
  getPoint(id: string): Promise<Point | undefined>;
  createPoint(point: InsertPoint, meetingTitle: string): Promise<Point>;
  updatePoint(id: string, point: Partial<InsertPoint>): Promise<Point | undefined>;
  deletePoint(id: string): Promise<void>;
  getPointCountByMeeting(meetingId: string): Promise<number>;
  getAllPointCounts(): Promise<Record<string, number>>;
  getAllSeriesPointCounts(): Promise<Record<string, number>>;

  // Status Updates
  getStatusUpdatesByPoint(pointId: string): Promise<StatusUpdate[]>;
  createStatusUpdate(update: InsertStatusUpdate): Promise<StatusUpdate>;

  // Attachments
  getAttachmentsByPoint(pointId: string): Promise<Attachment[]>;
  getAttachmentsByProject(projectId: string): Promise<(Attachment & { pointTitle: string; meetingTitle?: string; seriesTitle?: string })[]>;
  createAttachment(attachment: InsertAttachment): Promise<Attachment>;
  deleteAttachment(id: string): Promise<void>;

  // Meeting Series (recurring meetings)
  getAllMeetingSeries(filters?: SeriesFilters): Promise<MeetingSeries[]>;
  getMeetingSeries(id: string): Promise<MeetingSeries | undefined>;
  getMeetingSeriesByCalendarEventId(calendarEventId: string): Promise<MeetingSeries | undefined>;
  createMeetingSeries(series: InsertMeetingSeries): Promise<MeetingSeries>;
  updateMeetingSeries(id: string, series: Partial<InsertMeetingSeries>): Promise<MeetingSeries | undefined>;
  deleteMeetingSeries(id: string): Promise<void>;
  
  // Close/Reopen meetings
  closeMeeting(id: string, mode: 'move' | 'close', targetMeetingId?: string, targetSeriesId?: string): Promise<void>;
  reopenMeeting(id: string): Promise<void>;
  closeMeetingSeries(id: string, mode: 'move' | 'close', targetSeriesId?: string, targetMeetingId?: string): Promise<void>;
  reopenMeetingSeries(id: string): Promise<void>;
  closeOccurrence(id: string, mode: 'move' | 'close', targetOccurrenceId?: string): Promise<void>;
  reopenOccurrence(id: string): Promise<void>;
  getOpenMeetingsForProject(projectId: string, excludeMeetingId?: string): Promise<Meeting[]>;
  getOpenSeriesForProject(projectId: string, excludeSeriesId?: string): Promise<MeetingSeries[]>;
  
  // Meeting Occurrences
  getOccurrencesBySeries(seriesId: string): Promise<MeetingOccurrence[]>;
  createMeetingOccurrence(occurrence: InsertMeetingOccurrence): Promise<MeetingOccurrence>;
  updateMeetingOccurrence(id: string, occurrence: Partial<InsertMeetingOccurrence>): Promise<MeetingOccurrence | undefined>;
  
  // Points for series
  getPointsBySeries(seriesId: string): Promise<Point[]>;
  
  // Move unresolved points
  getUnresolvedPointsByMeeting(meetingId: string): Promise<Point[]>;
  movePointsToMeeting(pointIds: string[], targetMeetingId: string): Promise<void>;
  getNextMeetingInProject(projectId: string, afterDate: string): Promise<Meeting | undefined>;

  // ===== RBAC (Role-Based Access Control) =====
  
  // Companies
  getAllCompanies(): Promise<Company[]>;
  getCompany(id: string): Promise<Company | undefined>;
  getCompanyByEmailDomain(emailDomain: string): Promise<Company | undefined>;
  createCompany(company: InsertCompany): Promise<Company>;
  updateCompany(id: string, company: Partial<InsertCompany>): Promise<Company | undefined>;
  deleteCompany(id: string): Promise<void>;
  getCompanyEmployees(companyId: string): Promise<User[]>;
  getCompanyStats(companyId: string): Promise<{
    employeeCount: number;
    projectCount: number;
    openPointsCount: number;
    meetingsThisMonth: number;
  }>;

  // Users
  getAllUsers(): Promise<User[]>;
  searchUsers(query: string, limit?: number): Promise<User[]>;
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserByGoogleId(googleId: string): Promise<User | undefined>;
  getUserByMicrosoftId(microsoftId: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, user: Partial<InsertUser>): Promise<User | undefined>;
  deleteUser(id: string): Promise<void>;

  // User Roles
  getUserRoles(userId: string): Promise<Role[]>;
  addUserRole(userId: string, role: Role): Promise<UserRole>;
  removeUserRole(userId: string, role: Role): Promise<void>;
  setUserRoles(userId: string, roles: Role[]): Promise<void>;

  // Project Users (user-project assignments)
  getProjectUsers(projectId: string): Promise<(User & { projectRole: ProjectRole | null })[]>;
  getUserProjects(userId: string): Promise<Project[]>;
  getUserProjectIds(userId: string): Promise<string[]>;
  addUserToProject(userId: string, projectId: string, projectRole?: ProjectRole): Promise<ProjectUser>;
  updateUserProjectRole(userId: string, projectId: string, projectRole: ProjectRole): Promise<ProjectUser | undefined>;
  removeUserFromProject(userId: string, projectId: string): Promise<void>;
  isUserInProject(userId: string, projectId: string): Promise<boolean>;

  // User with full context (for auth middleware)
  getUserWithContext(userId: string): Promise<{
    user: User;
    roles: Role[];
    projectIds: string[];
    projectRoles: Record<string, ProjectRole>;
    company: Company | null;
  } | null>;
  
  // Get user's project roles (projectId -> ProjectRole mapping)
  getUserProjectRoles(userId: string): Promise<Record<string, ProjectRole>>;

  // User Profile Stats
  getUserStats(userId: string, userEmail: string): Promise<{
    totalPoints: number;
    openPoints: number;
    closedPoints: number;
    upcomingDeadlines: number;
    overduePoints: number;
  }>;
  
  // Points assigned to a user (by userId or email)
  getPointsAssignedToUser(userId: string, userEmail: string): Promise<(Point & { 
    meetingTitle?: string; 
    seriesTitle?: string;
    projectName?: string;
  })[]>;

  // Role Permissions (configurable permission matrix)
  getRolePermissions(): Promise<RolePermission[]>;
  upsertRolePermission(role: Role, action: string, isEnabled: boolean): Promise<RolePermission>;
  bulkUpsertRolePermissions(permissions: { role: Role; action: string; isEnabled: boolean }[]): Promise<RolePermission[]>;

  // ===== DISCIPLINES =====
  
  // Disciplines (read-only, pre-seeded)
  getAllDisciplines(): Promise<Discipline[]>;
  
  // Point Disciplines (many-to-many)
  getPointDisciplines(pointId: string): Promise<string[]>;
  setPointDisciplines(pointId: string, disciplineCodes: string[]): Promise<void>;
  
  // Meeting Disciplines (many-to-many)
  getMeetingDisciplines(meetingId: string): Promise<string[]>;
  setMeetingDisciplines(meetingId: string, disciplineCodes: string[]): Promise<void>;
  
  // Series Disciplines (many-to-many)
  getSeriesDisciplines(seriesId: string): Promise<string[]>;
  setSeriesDisciplines(seriesId: string, disciplineCodes: string[]): Promise<void>;

  // Dashboard Stats
  getDashboardStats(): Promise<{
    totalProjects: number;
    activeProjects: number;
    totalMeetings: number;
    scheduledMeetings: number;
    totalSeries: number;
    activeSeries: number;
    totalPoints: number;
    openPoints: number;
    closedPoints: number;
    overduePoints: number;
    totalUsers: number;
    totalCompanies: number;
    pointsByStatus: { status: string; count: number }[];
    pointsByDiscipline: { discipline: string; count: number }[];
    meetingsByMonth: { month: string; meetings: number; series: number }[];
    projectsByStatus: { status: string; count: number }[];
  }>;

  // ===== COMPANY INVITATIONS =====
  
  // Create company and set user as owner
  createCompanyForUser(userId: string, companyData: InsertCompany): Promise<Company>;
  
  // Company Invitations
  createCompanyInvitation(companyId: string, inviterId: string, email: string, companyRole: CompanyRole): Promise<CompanyInvitation>;
  getCompanyInvitations(companyId: string): Promise<(CompanyInvitation & { inviterName: string })[]>;
  getInvitationByToken(token: string): Promise<(CompanyInvitation & { companyName: string; inviterName: string }) | undefined>;
  getUserPendingInvitations(email: string): Promise<(CompanyInvitation & { companyName: string; inviterName: string })[]>;
  acceptInvitation(token: string, userId: string): Promise<void>;
  declineInvitation(token: string): Promise<void>;
  cancelInvitation(invitationId: string): Promise<void>;
  expireOldInvitations(): Promise<number>;
}

export class DBStorage implements IStorage {
  // Projects
  async getAllProjects(filters?: ProjectFilters): Promise<Project[]> {
    let query = db.select().from(projects);
    
    const conditions = [];
    
    if (filters?.city) {
      conditions.push(eq(projects.city, filters.city));
    }
    if (filters?.country) {
      conditions.push(eq(projects.country, filters.country));
    }
    if (filters?.status) {
      conditions.push(eq(projects.status, filters.status));
    }
    if (filters?.search) {
      conditions.push(
        or(
          ilike(projects.name, `%${filters.search}%`),
          ilike(projects.code, `%${filters.search}%`),
          sql`COALESCE(${projects.client}, '') ILIKE ${`%${filters.search}%`}`
        )
      );
    }
    
    if (conditions.length > 0) {
      return await db.select().from(projects)
        .where(and(...conditions))
        .orderBy(desc(projects.createdAt));
    }
    
    return await db.select().from(projects).orderBy(desc(projects.createdAt));
  }

  async getProject(id: string): Promise<Project | undefined> {
    const result = await db.select().from(projects).where(eq(projects.id, id));
    return result[0];
  }

  async createProject(insertProject: InsertProject): Promise<Project> {
    const result = await db.insert(projects).values(insertProject).returning();
    return result[0];
  }

  async updateProject(id: string, updateData: Partial<InsertProject>): Promise<Project | undefined> {
    const result = await db.update(projects)
      .set(updateData)
      .where(eq(projects.id, id))
      .returning();
    return result[0];
  }

  async deleteProject(id: string): Promise<void> {
    await db.delete(projects).where(eq(projects.id, id));
  }

  async getProjectCities(): Promise<string[]> {
    const result = await db.selectDistinct({ city: projects.city }).from(projects);
    return result.map((r: { city: string }) => r.city).filter(Boolean);
  }

  async getProjectCountries(): Promise<string[]> {
    const result = await db.selectDistinct({ country: projects.country }).from(projects);
    return result.map((r: { country: string }) => r.country).filter(Boolean);
  }

  // Meetings
  async getAllMeetings(filters?: MeetingFilters): Promise<Meeting[]> {
    // Determine sort order
    const sortOrderFn = filters?.sortOrder === 'asc' ? asc : desc;
    let orderBy;
    switch (filters?.sortBy) {
      case 'project':
        orderBy = sortOrderFn(meetings.project);
        break;
      case 'title':
        orderBy = sortOrderFn(meetings.title);
        break;
      case 'date':
      default:
        orderBy = sortOrderFn(meetings.date);
        break;
    }
    
    // If city filter is specified, join with projects to filter by project city
    // Uses INNER JOIN because we only want meetings that belong to projects in the selected city
    if (filters?.city) {
      const conditions = [];
      conditions.push(eq(projects.city, filters.city));
      conditions.push(isNotNull(meetings.projectId)); // Only include meetings with project assignments
      
      if (filters.projectId) {
        conditions.push(eq(meetings.projectId, filters.projectId));
      }
      if (filters.projectIds && filters.projectIds.length > 0) {
        conditions.push(inArray(meetings.projectId, filters.projectIds));
      }
      if (filters.search) {
        conditions.push(
          or(
            ilike(meetings.title, `%${filters.search}%`),
            ilike(meetings.project, `%${filters.search}%`),
            ilike(meetings.location, `%${filters.search}%`)
          )
        );
      }
      // Status filter (default to 'scheduled' if not specified)
      if (filters.status && filters.status !== 'all') {
        conditions.push(eq(meetings.status, filters.status));
      } else if (!filters.status) {
        conditions.push(eq(meetings.status, 'scheduled'));
      }
      
      const result = await db.select({
        id: meetings.id,
        projectId: meetings.projectId,
        title: meetings.title,
        date: meetings.date,
        startTime: meetings.startTime,
        endTime: meetings.endTime,
        location: meetings.location,
        platform: meetings.platform,
        project: meetings.project,
        agenda: meetings.agenda,
        meetingLink: meetings.meetingLink,
        status: meetings.status,
        closedAt: meetings.closedAt,
        calendarProvider: meetings.calendarProvider,
        calendarEventId: meetings.calendarEventId,
        calendarLastSynced: meetings.calendarLastSynced,
        removedFromCalendar: meetings.removedFromCalendar,
        createdAt: meetings.createdAt,
      })
      .from(meetings)
      .innerJoin(projects, eq(meetings.projectId, projects.id))
      .where(and(...conditions))
      .orderBy(orderBy);
      
      return result;
    }
    
    // No city filter - simple query
    const conditions = [];
    if (filters?.projectId) {
      conditions.push(eq(meetings.projectId, filters.projectId));
    }
    if (filters?.projectIds && filters.projectIds.length > 0) {
      conditions.push(inArray(meetings.projectId, filters.projectIds));
    }
    if (filters?.search) {
      conditions.push(
        or(
          ilike(meetings.title, `%${filters.search}%`),
          ilike(meetings.project, `%${filters.search}%`),
          ilike(meetings.location, `%${filters.search}%`)
        )
      );
    }
    // Status filter (default to 'scheduled' if not specified)
    if (filters?.status && filters.status !== 'all') {
      conditions.push(eq(meetings.status, filters.status));
    } else if (!filters?.status) {
      conditions.push(eq(meetings.status, 'scheduled'));
    }
    
    if (conditions.length > 0) {
      return await db.select().from(meetings)
        .where(and(...conditions))
        .orderBy(orderBy);
    }
    
    return await db.select().from(meetings).orderBy(orderBy);
  }

  async getMeetingsByProject(projectId: string): Promise<Meeting[]> {
    return await db.select().from(meetings)
      .where(eq(meetings.projectId, projectId))
      .orderBy(desc(meetings.date));
  }

  async getMeetingLocations(): Promise<string[]> {
    const result = await db.selectDistinct({ location: meetings.location }).from(meetings);
    return result.map((r: { location: string }) => r.location).filter(Boolean);
  }

  async getMeeting(id: string): Promise<Meeting | undefined> {
    const result = await db.select().from(meetings).where(eq(meetings.id, id));
    return result[0];
  }

  async getMeetingByCalendarEventId(calendarEventId: string): Promise<Meeting | undefined> {
    const result = await db.select().from(meetings).where(eq(meetings.calendarEventId, calendarEventId));
    return result[0];
  }

  async createMeeting(insertMeeting: InsertMeeting): Promise<Meeting> {
    const result = await db.insert(meetings).values(insertMeeting).returning();
    return result[0];
  }

  async updateMeeting(id: string, updateData: Partial<InsertMeeting>): Promise<Meeting | undefined> {
    const result = await db.update(meetings)
      .set(updateData)
      .where(eq(meetings.id, id))
      .returning();
    return result[0];
  }

  async deleteMeeting(id: string): Promise<void> {
    await db.delete(meetings).where(eq(meetings.id, id));
  }

  async getMeetingCountByProject(projectId: string): Promise<number> {
    const result = await db.select({ count: sql<number>`count(*)::int` })
      .from(meetings)
      .where(eq(meetings.projectId, projectId));
    return result[0]?.count ?? 0;
  }

  async getAllMeetingCounts(): Promise<Record<string, number>> {
    const result = await db.select({
      projectId: meetings.projectId,
      count: sql<number>`count(*)::int`,
    })
      .from(meetings)
      .where(isNotNull(meetings.projectId))
      .groupBy(meetings.projectId);
    
    const counts: Record<string, number> = {};
    for (const row of result) {
      if (row.projectId) {
        counts[row.projectId] = row.count;
      }
    }
    return counts;
  }

  // Attendees (for meetings)
  async getAttendee(id: string): Promise<Attendee | undefined> {
    const result = await db.select().from(attendees).where(eq(attendees.id, id));
    return result[0];
  }

  async getAttendeesByMeeting(meetingId: string): Promise<Attendee[]> {
    return await db.select().from(attendees).where(eq(attendees.meetingId, meetingId));
  }

  async createAttendee(insertAttendee: InsertAttendee): Promise<Attendee> {
    const result = await db.insert(attendees).values(insertAttendee).returning();
    return result[0];
  }

  async updateAttendee(id: string, updateData: Partial<InsertAttendee>): Promise<Attendee | undefined> {
    const result = await db.update(attendees)
      .set(updateData)
      .where(eq(attendees.id, id))
      .returning();
    return result[0];
  }

  async deleteAttendee(id: string): Promise<void> {
    await db.delete(attendees).where(eq(attendees.id, id));
  }

  async bulkCreateAttendees(insertAttendees: InsertAttendee[]): Promise<Attendee[]> {
    if (insertAttendees.length === 0) return [];
    const result = await db.insert(attendees).values(insertAttendees).returning();
    return result;
  }

  async getAllMeetingAttendeeCounts(): Promise<Record<string, number>> {
    const result = await db.select({
      meetingId: attendees.meetingId,
      count: sql<number>`count(*)::int`,
    })
      .from(attendees)
      .where(isNotNull(attendees.meetingId))
      .groupBy(attendees.meetingId);
    
    const counts: Record<string, number> = {};
    for (const row of result) {
      if (row.meetingId) {
        counts[row.meetingId] = row.count;
      }
    }
    return counts;
  }

  // Series Attendees
  async getSeriesAttendee(id: string): Promise<SeriesAttendee | undefined> {
    const result = await db.select().from(seriesAttendees).where(eq(seriesAttendees.id, id));
    return result[0];
  }

  async getAttendeesBySeries(seriesId: string): Promise<SeriesAttendee[]> {
    return await db.select().from(seriesAttendees).where(eq(seriesAttendees.seriesId, seriesId));
  }

  async createSeriesAttendee(insertAttendee: InsertSeriesAttendee): Promise<SeriesAttendee> {
    const result = await db.insert(seriesAttendees).values(insertAttendee).returning();
    return result[0];
  }

  async updateSeriesAttendee(id: string, updateData: Partial<InsertSeriesAttendee>): Promise<SeriesAttendee | undefined> {
    const result = await db.update(seriesAttendees)
      .set(updateData)
      .where(eq(seriesAttendees.id, id))
      .returning();
    return result[0];
  }

  async deleteSeriesAttendee(id: string): Promise<void> {
    await db.delete(seriesAttendees).where(eq(seriesAttendees.id, id));
  }

  async bulkCreateSeriesAttendees(insertAttendees: InsertSeriesAttendee[]): Promise<SeriesAttendee[]> {
    if (insertAttendees.length === 0) return [];
    const result = await db.insert(seriesAttendees).values(insertAttendees).returning();
    return result;
  }

  async getAllSeriesAttendeeCounts(): Promise<Record<string, number>> {
    const result = await db.select({
      seriesId: seriesAttendees.seriesId,
      count: sql<number>`count(*)::int`,
    })
      .from(seriesAttendees)
      .where(isNotNull(seriesAttendees.seriesId))
      .groupBy(seriesAttendees.seriesId);
    
    const counts: Record<string, number> = {};
    for (const row of result) {
      if (row.seriesId) {
        counts[row.seriesId] = row.count;
      }
    }
    return counts;
  }

  // Attendance Records
  async getAttendanceByMeeting(meetingId: string): Promise<AttendanceRecord[]> {
    return await db.select().from(attendanceRecords).where(eq(attendanceRecords.meetingId, meetingId));
  }

  async getAttendanceByOccurrence(occurrenceId: string): Promise<AttendanceRecord[]> {
    return await db.select().from(attendanceRecords).where(eq(attendanceRecords.occurrenceId, occurrenceId));
  }

  async recordAttendance(insertRecord: InsertAttendanceRecord): Promise<AttendanceRecord> {
    const result = await db.insert(attendanceRecords).values(insertRecord).returning();
    return result[0];
  }

  async updateAttendance(id: string, present: boolean): Promise<AttendanceRecord | undefined> {
    const result = await db.update(attendanceRecords)
      .set({ present })
      .where(eq(attendanceRecords.id, id))
      .returning();
    return result[0];
  }

  async getAttendanceHistory(attendeeId: string): Promise<AttendanceRecord[]> {
    return await db.select().from(attendanceRecords)
      .where(eq(attendanceRecords.attendeeId, attendeeId))
      .orderBy(desc(attendanceRecords.recordedAt));
  }

  async getSeriesAttendanceHistory(seriesAttendeeId: string): Promise<AttendanceRecord[]> {
    return await db.select().from(attendanceRecords)
      .where(eq(attendanceRecords.seriesAttendeeId, seriesAttendeeId))
      .orderBy(desc(attendanceRecords.recordedAt));
  }

  // Points
  async getPointsByMeeting(meetingId: string): Promise<Point[]> {
    return await db.select().from(points)
      .where(eq(points.meetingId, meetingId))
      .orderBy(desc(points.createdAt));
  }

  async getPointsByProject(projectId: string): Promise<(Point & { meetingTitle?: string; seriesTitle?: string })[]> {
    // Get points from meetings in this project
    const meetingPoints = await db.select({
      id: points.id,
      meetingId: points.meetingId,
      seriesId: points.seriesId,
      title: points.title,
      description: points.description,
      image: points.image,
      status: points.status,
      assignedTo: points.assignedTo,
      assignedToRef: points.assignedToRef,
      dueDate: points.dueDate,
      createdAt: points.createdAt,
      meetingTitle: meetings.title,
    })
      .from(points)
      .innerJoin(meetings, eq(points.meetingId, meetings.id))
      .where(eq(meetings.projectId, projectId));
    
    // Get points from series in this project
    const seriesPoints = await db.select({
      id: points.id,
      meetingId: points.meetingId,
      seriesId: points.seriesId,
      title: points.title,
      description: points.description,
      image: points.image,
      status: points.status,
      assignedTo: points.assignedTo,
      assignedToRef: points.assignedToRef,
      dueDate: points.dueDate,
      createdAt: points.createdAt,
      seriesTitle: meetingSeries.title,
    })
      .from(points)
      .innerJoin(meetingSeries, eq(points.seriesId, meetingSeries.id))
      .where(eq(meetingSeries.projectId, projectId));
    
    // Combine and sort by createdAt desc
    const allPoints = [
      ...meetingPoints.map(p => ({ ...p, seriesTitle: undefined })),
      ...seriesPoints.map(p => ({ ...p, meetingTitle: undefined })),
    ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    
    return allPoints;
  }

  async getPoint(id: string): Promise<Point | undefined> {
    const result = await db.select().from(points).where(eq(points.id, id));
    return result[0];
  }

  async createPoint(insertPoint: InsertPoint, meetingTitle: string): Promise<Point> {
    const meetingIdForPrefix = insertPoint.meetingId || 'SERIES';
    const customId = await generatePointId(meetingIdForPrefix, meetingTitle);
    const result = await db.insert(points).values({ 
      ...insertPoint, 
      id: customId 
    }).returning();
    return result[0];
  }

  async updatePoint(id: string, updateData: Partial<InsertPoint>): Promise<Point | undefined> {
    const result = await db.update(points)
      .set(updateData)
      .where(eq(points.id, id))
      .returning();
    return result[0];
  }

  async deletePoint(id: string): Promise<void> {
    await db.delete(points).where(eq(points.id, id));
  }

  async getPointCountByMeeting(meetingId: string): Promise<number> {
    const result = await db.select({ count: sql<number>`count(*)::int` })
      .from(points)
      .where(eq(points.meetingId, meetingId));
    return result[0]?.count ?? 0;
  }

  async getAllPointCounts(): Promise<Record<string, number>> {
    const result = await db.select({
      meetingId: points.meetingId,
      count: sql<number>`count(*)::int`,
    })
      .from(points)
      .where(isNotNull(points.meetingId))
      .groupBy(points.meetingId);
    
    const counts: Record<string, number> = {};
    for (const row of result) {
      if (row.meetingId) {
        counts[row.meetingId] = row.count;
      }
    }
    return counts;
  }

  async getAllSeriesPointCounts(): Promise<Record<string, number>> {
    const result = await db.select({
      seriesId: points.seriesId,
      count: sql<number>`count(*)::int`,
    })
      .from(points)
      .where(isNotNull(points.seriesId))
      .groupBy(points.seriesId);
    
    const counts: Record<string, number> = {};
    for (const row of result) {
      if (row.seriesId) {
        counts[row.seriesId] = row.count;
      }
    }
    return counts;
  }

  // Status Updates
  async getStatusUpdatesByPoint(pointId: string): Promise<StatusUpdate[]> {
    return await db.select().from(statusUpdates)
      .where(eq(statusUpdates.pointId, pointId))
      .orderBy(statusUpdates.createdAt);
  }

  async createStatusUpdate(insertUpdate: InsertStatusUpdate): Promise<StatusUpdate> {
    const result = await db.insert(statusUpdates).values(insertUpdate).returning();
    return result[0];
  }

  // Attachments
  async getAttachmentsByPoint(pointId: string): Promise<Attachment[]> {
    return await db.select().from(attachments).where(eq(attachments.pointId, pointId));
  }

  async getAttachmentsByProject(projectId: string): Promise<(Attachment & { pointTitle: string; meetingTitle?: string; seriesTitle?: string })[]> {
    // Get attachments from points in meetings
    const meetingAttachments = await db.select({
      id: attachments.id,
      pointId: attachments.pointId,
      name: attachments.name,
      type: attachments.type,
      size: attachments.size,
      url: attachments.url,
      createdAt: attachments.createdAt,
      pointTitle: points.title,
      meetingTitle: meetings.title,
    })
      .from(attachments)
      .innerJoin(points, eq(attachments.pointId, points.id))
      .innerJoin(meetings, eq(points.meetingId, meetings.id))
      .where(eq(meetings.projectId, projectId));
    
    // Get attachments from points in series
    const seriesAttachments = await db.select({
      id: attachments.id,
      pointId: attachments.pointId,
      name: attachments.name,
      type: attachments.type,
      size: attachments.size,
      url: attachments.url,
      createdAt: attachments.createdAt,
      pointTitle: points.title,
      seriesTitle: meetingSeries.title,
    })
      .from(attachments)
      .innerJoin(points, eq(attachments.pointId, points.id))
      .innerJoin(meetingSeries, eq(points.seriesId, meetingSeries.id))
      .where(eq(meetingSeries.projectId, projectId));
    
    // Combine and sort by createdAt desc
    const allAttachments = [
      ...meetingAttachments.map(a => ({ ...a, seriesTitle: undefined })),
      ...seriesAttachments.map(a => ({ ...a, meetingTitle: undefined })),
    ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    
    return allAttachments;
  }

  async createAttachment(insertAttachment: InsertAttachment): Promise<Attachment> {
    const result = await db.insert(attachments).values(insertAttachment).returning();
    return result[0];
  }

  async deleteAttachment(id: string): Promise<void> {
    await db.delete(attachments).where(eq(attachments.id, id));
  }

  // Meeting Series (recurring meetings)
  async getAllMeetingSeries(filters?: SeriesFilters): Promise<MeetingSeries[]> {
    const conditions = [];
    
    if (filters?.projectId) {
      conditions.push(eq(meetingSeries.projectId, filters.projectId));
    }
    if (filters?.projectIds && filters.projectIds.length > 0) {
      conditions.push(inArray(meetingSeries.projectId, filters.projectIds));
    }
    // Status filter (default to 'active' if not specified)
    if (filters?.status && filters.status !== 'all') {
      conditions.push(eq(meetingSeries.status, filters.status));
    } else if (!filters?.status) {
      conditions.push(eq(meetingSeries.status, 'active'));
    }
    
    if (conditions.length > 0) {
      return await db.select().from(meetingSeries)
        .where(and(...conditions))
        .orderBy(desc(meetingSeries.createdAt));
    }
    return await db.select().from(meetingSeries).orderBy(desc(meetingSeries.createdAt));
  }

  async getMeetingSeries(id: string): Promise<MeetingSeries | undefined> {
    const result = await db.select().from(meetingSeries).where(eq(meetingSeries.id, id));
    return result[0];
  }

  async getMeetingSeriesByCalendarEventId(calendarEventId: string): Promise<MeetingSeries | undefined> {
    const result = await db.select().from(meetingSeries).where(eq(meetingSeries.calendarEventId, calendarEventId));
    return result[0];
  }

  async createMeetingSeries(insertSeries: InsertMeetingSeries): Promise<MeetingSeries> {
    const result = await db.insert(meetingSeries).values(insertSeries).returning();
    return result[0];
  }

  async updateMeetingSeries(id: string, updateData: Partial<InsertMeetingSeries>): Promise<MeetingSeries | undefined> {
    const result = await db.update(meetingSeries)
      .set(updateData)
      .where(eq(meetingSeries.id, id))
      .returning();
    return result[0];
  }

  async deleteMeetingSeries(id: string): Promise<void> {
    await db.delete(meetingSeries).where(eq(meetingSeries.id, id));
  }

  // Meeting Occurrences
  async getOccurrencesBySeries(seriesId: string): Promise<MeetingOccurrence[]> {
    return await db.select().from(meetingOccurrences)
      .where(eq(meetingOccurrences.seriesId, seriesId))
      .orderBy(asc(meetingOccurrences.date));
  }

  async createMeetingOccurrence(insertOccurrence: InsertMeetingOccurrence): Promise<MeetingOccurrence> {
    const result = await db.insert(meetingOccurrences).values(insertOccurrence).returning();
    return result[0];
  }

  async updateMeetingOccurrence(id: string, updateData: Partial<InsertMeetingOccurrence>): Promise<MeetingOccurrence | undefined> {
    const result = await db.update(meetingOccurrences)
      .set(updateData)
      .where(eq(meetingOccurrences.id, id))
      .returning();
    return result[0];
  }

  // Points for series
  async getPointsBySeries(seriesId: string): Promise<Point[]> {
    return await db.select().from(points)
      .where(eq(points.seriesId, seriesId))
      .orderBy(desc(points.createdAt));
  }

  // Move unresolved points
  async getUnresolvedPointsByMeeting(meetingId: string): Promise<Point[]> {
    return await db.select().from(points)
      .where(and(
        eq(points.meetingId, meetingId),
        or(
          eq(points.status, 'open'),
          eq(points.status, 'new'),
          eq(points.status, 'ongoing')
        )
      ))
      .orderBy(desc(points.createdAt));
  }

  async movePointsToMeeting(pointIds: string[], targetMeetingId: string): Promise<void> {
    if (pointIds.length === 0) return;
    await db.update(points)
      .set({ meetingId: targetMeetingId, seriesId: null })
      .where(inArray(points.id, pointIds));
  }

  async getNextMeetingInProject(projectId: string, afterDate: string): Promise<Meeting | undefined> {
    const result = await db.select().from(meetings)
      .where(and(
        eq(meetings.projectId, projectId),
        sql`${meetings.date} > ${afterDate}`
      ))
      .orderBy(asc(meetings.date))
      .limit(1);
    return result[0];
  }

  // Close/Reopen meetings
  async closeMeeting(id: string, mode: 'move' | 'close', targetMeetingId?: string, targetSeriesId?: string): Promise<void> {
    const meeting = await this.getMeeting(id);
    if (!meeting) throw new Error('Meeting not found');
    
    // Get open points for this meeting
    const openPoints = await this.getUnresolvedPointsByMeeting(id);
    
    if (mode === 'move' && openPoints.length > 0) {
      const pointIds = openPoints.map(p => p.id);
      
      if (targetMeetingId) {
        // Move open points to target meeting
        await db.update(points)
          .set({ meetingId: targetMeetingId, seriesId: null })
          .where(inArray(points.id, pointIds));
        
        const targetMeeting = await this.getMeeting(targetMeetingId);
        for (const point of openPoints) {
          await this.createStatusUpdate({
            pointId: point.id,
            date: new Date().toISOString().split('T')[0],
            status: `Point moved from closed meeting "${meeting.title}" to meeting "${targetMeeting?.title || 'Unknown'}"`,
            actionOn: 'System'
          });
        }
      } else if (targetSeriesId) {
        // Move open points to target series
        await db.update(points)
          .set({ seriesId: targetSeriesId, meetingId: null })
          .where(inArray(points.id, pointIds));
        
        const targetSeries = await this.getMeetingSeries(targetSeriesId);
        for (const point of openPoints) {
          await this.createStatusUpdate({
            pointId: point.id,
            date: new Date().toISOString().split('T')[0],
            status: `Point moved from closed meeting "${meeting.title}" to series "${targetSeries?.title || 'Unknown'}"`,
            actionOn: 'System'
          });
        }
      } else {
        throw new Error('Target meeting or series required for move mode');
      }
    } else if (mode === 'close' && openPoints.length > 0) {
      // Mark all open points as closed
      for (const point of openPoints) {
        await db.update(points)
          .set({ status: 'closed' })
          .where(eq(points.id, point.id));
        await this.createStatusUpdate({
          pointId: point.id,
          date: new Date().toISOString().split('T')[0],
          status: 'Closed with meeting',
          actionOn: 'System'
        });
      }
    }
    
    // Mark meeting as closed
    await db.update(meetings)
      .set({ status: 'closed', closedAt: new Date() })
      .where(eq(meetings.id, id));
  }

  async reopenMeeting(id: string): Promise<void> {
    await db.update(meetings)
      .set({ status: 'scheduled', closedAt: null })
      .where(eq(meetings.id, id));
  }

  async closeMeetingSeries(id: string, mode: 'move' | 'close', targetSeriesId?: string, targetMeetingId?: string): Promise<void> {
    const series = await this.getMeetingSeries(id);
    if (!series) throw new Error('Series not found');
    
    // Get open points for this series
    const openPoints = await db.select().from(points)
      .where(and(
        eq(points.seriesId, id),
        or(
          eq(points.status, 'open'),
          eq(points.status, 'new'),
          eq(points.status, 'ongoing')
        )
      ));
    
    if (mode === 'move' && openPoints.length > 0) {
      const pointIds = openPoints.map(p => p.id);
      
      if (targetSeriesId) {
        // Move open points to target series
        await db.update(points)
          .set({ seriesId: targetSeriesId, meetingId: null })
          .where(inArray(points.id, pointIds));
        
        const targetSeries = await this.getMeetingSeries(targetSeriesId);
        for (const point of openPoints) {
          await this.createStatusUpdate({
            pointId: point.id,
            date: new Date().toISOString().split('T')[0],
            status: `Point moved from closed series "${series.title}" to series "${targetSeries?.title || 'Unknown'}"`,
            actionOn: 'System'
          });
        }
      } else if (targetMeetingId) {
        // Move open points to target meeting
        await db.update(points)
          .set({ meetingId: targetMeetingId, seriesId: null })
          .where(inArray(points.id, pointIds));
        
        const targetMeeting = await this.getMeeting(targetMeetingId);
        for (const point of openPoints) {
          await this.createStatusUpdate({
            pointId: point.id,
            date: new Date().toISOString().split('T')[0],
            status: `Point moved from closed series "${series.title}" to meeting "${targetMeeting?.title || 'Unknown'}"`,
            actionOn: 'System'
          });
        }
      } else {
        throw new Error('Target series or meeting required for move mode');
      }
    } else if (mode === 'close' && openPoints.length > 0) {
      // Mark all open points as closed
      for (const point of openPoints) {
        await db.update(points)
          .set({ status: 'closed' })
          .where(eq(points.id, point.id));
        await this.createStatusUpdate({
          pointId: point.id,
          date: new Date().toISOString().split('T')[0],
          status: 'Closed with series',
          actionOn: 'System'
        });
      }
    }
    
    // Mark series as closed
    await db.update(meetingSeries)
      .set({ status: 'closed', closedAt: new Date() })
      .where(eq(meetingSeries.id, id));
  }

  async reopenMeetingSeries(id: string): Promise<void> {
    await db.update(meetingSeries)
      .set({ status: 'active', closedAt: null })
      .where(eq(meetingSeries.id, id));
  }

  async closeOccurrence(id: string, mode: 'move' | 'close', targetOccurrenceId?: string): Promise<void> {
    // Occurrences don't directly hold points (points belong to series), so just mark as completed
    await db.update(meetingOccurrences)
      .set({ status: 'completed' })
      .where(eq(meetingOccurrences.id, id));
  }

  async reopenOccurrence(id: string): Promise<void> {
    await db.update(meetingOccurrences)
      .set({ status: 'scheduled' })
      .where(eq(meetingOccurrences.id, id));
  }

  async getOpenMeetingsForProject(projectId: string, excludeMeetingId?: string): Promise<Meeting[]> {
    const conditions = [
      eq(meetings.projectId, projectId),
      eq(meetings.status, 'scheduled')
    ];
    if (excludeMeetingId) {
      conditions.push(sql`${meetings.id} != ${excludeMeetingId}`);
    }
    return await db.select().from(meetings)
      .where(and(...conditions))
      .orderBy(asc(meetings.date));
  }

  async getOpenSeriesForProject(projectId: string, excludeSeriesId?: string): Promise<MeetingSeries[]> {
    const conditions = [
      eq(meetingSeries.projectId, projectId),
      eq(meetingSeries.status, 'active')
    ];
    if (excludeSeriesId) {
      conditions.push(sql`${meetingSeries.id} != ${excludeSeriesId}`);
    }
    return await db.select().from(meetingSeries)
      .where(and(...conditions))
      .orderBy(desc(meetingSeries.createdAt));
  }

  async globalSearch(query: string, limit: number = 10): Promise<{
    projects: Project[];
    meetings: Meeting[];
    series: MeetingSeries[];
    attendees: (Attendee | SeriesAttendee)[];
    points: Point[];
  }> {
    const searchPattern = `%${query.toLowerCase()}%`;
    
    const [projectResults, meetingResults, seriesResults, attendeeResults, seriesAttendeeResults, pointResults] = await Promise.all([
      db.select().from(projects)
        .where(or(
          ilike(projects.name, searchPattern),
          ilike(projects.city, searchPattern),
          ilike(projects.country, searchPattern),
          ilike(projects.client, searchPattern)
        ))
        .limit(limit),
      
      db.select().from(meetings)
        .where(or(
          ilike(meetings.title, searchPattern),
          ilike(meetings.location, searchPattern),
          ilike(meetings.project, searchPattern)
        ))
        .limit(limit),
      
      db.select().from(meetingSeries)
        .where(or(
          ilike(meetingSeries.title, searchPattern),
          ilike(meetingSeries.location, searchPattern)
        ))
        .limit(limit),
      
      db.select().from(attendees)
        .where(or(
          ilike(attendees.name, searchPattern),
          ilike(attendees.email, searchPattern),
          ilike(attendees.company, searchPattern)
        ))
        .limit(limit),
      
      db.select().from(seriesAttendees)
        .where(or(
          ilike(seriesAttendees.name, searchPattern),
          ilike(seriesAttendees.email, searchPattern),
          ilike(seriesAttendees.company, searchPattern)
        ))
        .limit(limit),
      
      db.select().from(points)
        .where(or(
          ilike(points.title, searchPattern),
          ilike(points.description, searchPattern),
          ilike(points.assignedTo, searchPattern)
        ))
        .limit(limit),
    ]);
    
    const allAttendees = [...attendeeResults, ...seriesAttendeeResults].slice(0, limit);
    
    return {
      projects: projectResults,
      meetings: meetingResults,
      series: seriesResults,
      attendees: allAttendees,
      points: pointResults,
    };
  }

  // ===== RBAC (Role-Based Access Control) =====

  // Companies
  async getAllCompanies(): Promise<Company[]> {
    return await db.select().from(companies).orderBy(asc(companies.name));
  }

  async getCompany(id: string): Promise<Company | undefined> {
    const result = await db.select().from(companies).where(eq(companies.id, id));
    return result[0];
  }

  async getCompanyByEmailDomain(emailDomain: string): Promise<Company | undefined> {
    const result = await db.select().from(companies).where(eq(companies.emailDomain, emailDomain.toLowerCase()));
    return result[0];
  }

  async createCompany(company: InsertCompany): Promise<Company> {
    const result = await db.insert(companies).values(company).returning();
    return result[0];
  }

  async updateCompany(id: string, company: Partial<InsertCompany>): Promise<Company | undefined> {
    const result = await db.update(companies).set(company).where(eq(companies.id, id)).returning();
    return result[0];
  }

  async deleteCompany(id: string): Promise<void> {
    await db.delete(companies).where(eq(companies.id, id));
  }

  async getCompanyEmployees(companyId: string): Promise<User[]> {
    return await db.select().from(users)
      .where(eq(users.companyId, companyId))
      .orderBy(asc(users.name));
  }

  async getCompanyStats(companyId: string): Promise<{
    employeeCount: number;
    projectCount: number;
    openPointsCount: number;
    meetingsThisMonth: number;
  }> {
    const today = new Date();
    const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
    const lastDayOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().split('T')[0];

    const employees = await this.getCompanyEmployees(companyId);
    const employeeIds = employees.map(e => e.id);
    const employeeEmails = employees.map(e => e.email).filter((e): e is string => e !== null);

    const employeeCount = employees.length;

    let projectCount = 0;
    let openPointsCount = 0;
    let meetingsThisMonth = 0;

    if (employeeIds.length > 0) {
      const projectResults = await db
        .selectDistinct({ projectId: projectUsers.projectId })
        .from(projectUsers)
        .where(inArray(projectUsers.userId, employeeIds));
      projectCount = projectResults.length;

      if (employeeEmails.length > 0) {
        const assigneeConditions = employeeEmails.map(email => 
          or(
            eq(points.assignedToRef, `user:${email}`),
            ilike(points.assignedTo, email)
          )
        ).filter((c): c is NonNullable<typeof c> => c !== undefined);
        
        if (assigneeConditions.length > 0) {
          const pointsResult = await db.select({ count: sql<number>`count(*)` }).from(points)
            .where(and(
              or(...assigneeConditions),
              sql`${points.status} NOT IN ('closed')`
            ));
          openPointsCount = Number(pointsResult[0]?.count || 0);
        }
      }

      const meetingAttendeeResults = await db
        .selectDistinct({ meetingId: attendees.meetingId })
        .from(attendees)
        .innerJoin(meetings, eq(attendees.meetingId, meetings.id))
        .where(and(
          inArray(attendees.userId, employeeIds),
          sql`${meetings.date} >= ${firstDayOfMonth}`,
          sql`${meetings.date} <= ${lastDayOfMonth}`
        ));
      meetingsThisMonth = meetingAttendeeResults.length;
    }

    return {
      employeeCount,
      projectCount,
      openPointsCount,
      meetingsThisMonth,
    };
  }

  // Users
  async getAllUsers(): Promise<User[]> {
    return await db.select().from(users).orderBy(asc(users.name));
  }

  async searchUsers(query: string, limit: number = 20): Promise<User[]> {
    const searchTerm = `%${query.toLowerCase()}%`;
    return await db.select().from(users)
      .where(or(
        ilike(users.name, searchTerm),
        ilike(users.email, searchTerm)
      ))
      .orderBy(asc(users.name))
      .limit(limit);
  }

  async getUser(id: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.id, id));
    return result[0];
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.email, email.toLowerCase()));
    return result[0];
  }

  async getUserByGoogleId(googleId: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.googleId, googleId));
    return result[0];
  }

  async getUserByMicrosoftId(microsoftId: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.microsoftId, microsoftId));
    return result[0];
  }

  async createUser(user: InsertUser): Promise<User> {
    const result = await db.insert(users).values(user).returning();
    return result[0];
  }

  async updateUser(id: string, user: Partial<InsertUser>): Promise<User | undefined> {
    const result = await db.update(users).set(user).where(eq(users.id, id)).returning();
    return result[0];
  }

  async deleteUser(id: string): Promise<void> {
    await db.delete(users).where(eq(users.id, id));
  }

  // User Roles
  async getUserRoles(userId: string): Promise<Role[]> {
    const result = await db.select({ role: userRoles.role }).from(userRoles).where(eq(userRoles.userId, userId));
    return result.map(r => r.role);
  }

  async addUserRole(userId: string, role: Role): Promise<UserRole> {
    const result = await db.insert(userRoles).values({ userId, role }).returning();
    return result[0];
  }

  async removeUserRole(userId: string, role: Role): Promise<void> {
    await db.delete(userRoles).where(and(eq(userRoles.userId, userId), eq(userRoles.role, role)));
  }

  async setUserRoles(userId: string, roles: Role[]): Promise<void> {
    // Delete existing roles
    await db.delete(userRoles).where(eq(userRoles.userId, userId));
    // Add new roles
    if (roles.length > 0) {
      await db.insert(userRoles).values(roles.map(role => ({ userId, role })));
    }
  }

  // Project Users (user-project assignments)
  async getProjectUsers(projectId: string): Promise<(User & { projectRole: ProjectRole | null })[]> {
    const result = await db
      .select({ user: users, projectRole: projectUsers.projectRole })
      .from(projectUsers)
      .innerJoin(users, eq(projectUsers.userId, users.id))
      .where(eq(projectUsers.projectId, projectId));
    return result.map(r => ({ ...r.user, projectRole: r.projectRole }));
  }

  async getUserProjects(userId: string): Promise<Project[]> {
    const result = await db
      .select({ project: projects })
      .from(projectUsers)
      .innerJoin(projects, eq(projectUsers.projectId, projects.id))
      .where(eq(projectUsers.userId, userId));
    return result.map(r => r.project);
  }

  async getUserProjectIds(userId: string): Promise<string[]> {
    const result = await db
      .select({ projectId: projectUsers.projectId })
      .from(projectUsers)
      .where(eq(projectUsers.userId, userId));
    return result.map(r => r.projectId);
  }

  async addUserToProject(userId: string, projectId: string, projectRole?: ProjectRole): Promise<ProjectUser> {
    const result = await db.insert(projectUsers).values({ 
      userId, 
      projectId,
      projectRole: projectRole || "PROJECT_VIEWER"
    }).returning();
    return result[0];
  }

  async updateUserProjectRole(userId: string, projectId: string, projectRole: ProjectRole): Promise<ProjectUser | undefined> {
    const result = await db.update(projectUsers)
      .set({ projectRole })
      .where(and(eq(projectUsers.userId, userId), eq(projectUsers.projectId, projectId)))
      .returning();
    return result[0];
  }

  async removeUserFromProject(userId: string, projectId: string): Promise<void> {
    await db.delete(projectUsers).where(and(eq(projectUsers.userId, userId), eq(projectUsers.projectId, projectId)));
  }

  async isUserInProject(userId: string, projectId: string): Promise<boolean> {
    const result = await db
      .select({ id: projectUsers.id })
      .from(projectUsers)
      .where(and(eq(projectUsers.userId, userId), eq(projectUsers.projectId, projectId)));
    return result.length > 0;
  }

  // Get user's project roles (projectId -> ProjectRole mapping)
  async getUserProjectRoles(userId: string): Promise<Record<string, ProjectRole>> {
    const result = await db
      .select({ projectId: projectUsers.projectId, projectRole: projectUsers.projectRole })
      .from(projectUsers)
      .where(eq(projectUsers.userId, userId));
    
    const roleMap: Record<string, ProjectRole> = {};
    for (const r of result) {
      if (r.projectRole) {
        roleMap[r.projectId] = r.projectRole;
      }
    }
    return roleMap;
  }

  // User with full context (for auth middleware)
  async getUserWithContext(userId: string): Promise<{
    user: User;
    roles: Role[];
    projectIds: string[];
    projectRoles: Record<string, ProjectRole>;
    company: Company | null;
  } | null> {
    const user = await this.getUser(userId);
    if (!user) return null;

    const [roles, projectIdsList, projectRoles, company] = await Promise.all([
      this.getUserRoles(userId),
      this.getUserProjectIds(userId),
      this.getUserProjectRoles(userId),
      user.companyId ? this.getCompany(user.companyId) : Promise.resolve(null),
    ]);

    return {
      user,
      roles,
      projectIds: projectIdsList,
      projectRoles,
      company: company ?? null,
    };
  }

  // Attendee-User sync methods
  async findOrCreateUserFromAttendee(attendeeData: {
    name: string;
    email?: string | null;
    company?: string | null;
  }): Promise<User> {
    // Try to find existing user by email if provided
    if (attendeeData.email) {
      const existingUser = await this.getUserByEmail(attendeeData.email);
      if (existingUser) return existingUser;
    }

    // Find or create company if provided
    let companyId: string | null = null;
    if (attendeeData.company) {
      const existingCompany = await db.select().from(companies).where(eq(companies.name, attendeeData.company));
      if (existingCompany.length > 0) {
        companyId = existingCompany[0].id;
      } else {
        const newCompany = await this.createCompany({ name: attendeeData.company });
        companyId = newCompany.id;
      }
    }

    // Create new user with VIEWER role
    const newUser = await this.createUser({
      name: attendeeData.name,
      email: attendeeData.email ?? `${attendeeData.name.toLowerCase().replace(/\s+/g, '.')}@temp.local`,
      companyId,
      avatar: null,
      isActive: true,
    });

    // Assign VIEWER role by default
    await this.setUserRoles(newUser.id, ['VIEWER']);

    return newUser;
  }

  async linkAttendeeToUser(attendeeId: string, userId: string): Promise<Attendee> {
    const result = await db.update(attendees)
      .set({ userId })
      .where(eq(attendees.id, attendeeId))
      .returning();
    return result[0];
  }

  async linkSeriesAttendeeToUser(seriesAttendeeId: string, userId: string): Promise<SeriesAttendee> {
    const result = await db.update(seriesAttendees)
      .set({ userId })
      .where(eq(seriesAttendees.id, seriesAttendeeId))
      .returning();
    return result[0];
  }

  async syncAttendeeToUser(attendeeId: string): Promise<{ attendee: Attendee; user: User }> {
    const attendee = await db.select().from(attendees).where(eq(attendees.id, attendeeId));
    if (attendee.length === 0) throw new Error('Attendee not found');

    // If already linked, return existing user
    if (attendee[0].userId) {
      const user = await this.getUser(attendee[0].userId);
      if (user) return { attendee: attendee[0], user };
    }

    // Find or create user
    const user = await this.findOrCreateUserFromAttendee({
      name: attendee[0].name,
      email: attendee[0].email,
      company: attendee[0].company,
    });

    // Link attendee to user
    const updatedAttendee = await this.linkAttendeeToUser(attendeeId, user.id);
    return { attendee: updatedAttendee, user };
  }

  async syncSeriesAttendeeToUser(seriesAttendeeId: string): Promise<{ attendee: SeriesAttendee; user: User }> {
    const attendee = await db.select().from(seriesAttendees).where(eq(seriesAttendees.id, seriesAttendeeId));
    if (attendee.length === 0) throw new Error('Series attendee not found');

    // If already linked, return existing user
    if (attendee[0].userId) {
      const user = await this.getUser(attendee[0].userId);
      if (user) return { attendee: attendee[0], user };
    }

    // Find or create user
    const user = await this.findOrCreateUserFromAttendee({
      name: attendee[0].name,
      email: attendee[0].email,
      company: attendee[0].company,
    });

    // Link attendee to user
    const updatedAttendee = await this.linkSeriesAttendeeToUser(seriesAttendeeId, user.id);
    return { attendee: updatedAttendee, user };
  }

  async syncAllAttendeesToUsers(): Promise<{ synced: number; created: number }> {
    let synced = 0;
    let created = 0;

    // Sync meeting attendees
    const allAttendees = await db.select().from(attendees).where(sql`${attendees.userId} IS NULL`);
    for (const attendee of allAttendees) {
      try {
        const existingUser = attendee.email ? await this.getUserByEmail(attendee.email) : null;
        if (!existingUser) created++;
        await this.syncAttendeeToUser(attendee.id);
        synced++;
      } catch (error) {
        console.error(`Failed to sync attendee ${attendee.id}:`, error);
      }
    }

    // Sync series attendees
    const allSeriesAttendees = await db.select().from(seriesAttendees).where(sql`${seriesAttendees.userId} IS NULL`);
    for (const attendee of allSeriesAttendees) {
      try {
        const existingUser = attendee.email ? await this.getUserByEmail(attendee.email) : null;
        if (!existingUser) created++;
        await this.syncSeriesAttendeeToUser(attendee.id);
        synced++;
      } catch (error) {
        console.error(`Failed to sync series attendee ${attendee.id}:`, error);
      }
    }

    return { synced, created };
  }

  async getAttendeeWithUser(attendeeId: string): Promise<Attendee & { user: User | null }> {
    const result = await db.select({
      attendee: attendees,
      user: users,
    })
      .from(attendees)
      .leftJoin(users, eq(attendees.userId, users.id))
      .where(eq(attendees.id, attendeeId));
    
    if (result.length === 0) throw new Error('Attendee not found');
    return { ...result[0].attendee, user: result[0].user };
  }

  async getSeriesAttendeeWithUser(seriesAttendeeId: string): Promise<SeriesAttendee & { user: User | null }> {
    const result = await db.select({
      attendee: seriesAttendees,
      user: users,
    })
      .from(seriesAttendees)
      .leftJoin(users, eq(seriesAttendees.userId, users.id))
      .where(eq(seriesAttendees.id, seriesAttendeeId));
    
    if (result.length === 0) throw new Error('Series attendee not found');
    return { ...result[0].attendee, user: result[0].user };
  }

  // Get attendees with their user roles for display
  async getAttendeesByMeetingWithRoles(meetingId: string): Promise<(Attendee & { userRoles?: string[] })[]> {
    const attendeeList = await db.select().from(attendees).where(eq(attendees.meetingId, meetingId));
    
    // For each attendee with a userId, fetch their roles
    const result = await Promise.all(attendeeList.map(async (attendee) => {
      if (!attendee.userId) {
        return { ...attendee, userRoles: undefined };
      }
      
      const roles = await db.select({ role: userRoles.role })
        .from(userRoles)
        .where(eq(userRoles.userId, attendee.userId));
      
      return { ...attendee, userRoles: roles.map(r => r.role) };
    }));
    
    return result;
  }

  async getAttendeesBySeriesWithRoles(seriesId: string): Promise<(SeriesAttendee & { userRoles?: string[] })[]> {
    const attendeeList = await db.select().from(seriesAttendees).where(eq(seriesAttendees.seriesId, seriesId));
    
    // For each attendee with a userId, fetch their roles
    const result = await Promise.all(attendeeList.map(async (attendee) => {
      if (!attendee.userId) {
        return { ...attendee, userRoles: undefined };
      }
      
      const roles = await db.select({ role: userRoles.role })
        .from(userRoles)
        .where(eq(userRoles.userId, attendee.userId));
      
      return { ...attendee, userRoles: roles.map(r => r.role) };
    }));
    
    return result;
  }

  // ===== Role Permissions (configurable permission matrix) =====
  
  async getRolePermissions(): Promise<RolePermission[]> {
    return await db.select().from(rolePermissions);
  }

  async upsertRolePermission(role: Role, action: string, isEnabled: boolean): Promise<RolePermission> {
    const existing = await db.select()
      .from(rolePermissions)
      .where(and(eq(rolePermissions.role, role), eq(rolePermissions.action, action)));
    
    if (existing.length > 0) {
      const updated = await db.update(rolePermissions)
        .set({ isEnabled, updatedAt: new Date() })
        .where(eq(rolePermissions.id, existing[0].id))
        .returning();
      return updated[0];
    } else {
      const created = await db.insert(rolePermissions)
        .values({ role, action, isEnabled })
        .returning();
      return created[0];
    }
  }

  async bulkUpsertRolePermissions(permissions: { role: Role; action: string; isEnabled: boolean }[]): Promise<RolePermission[]> {
    const results: RolePermission[] = [];
    for (const perm of permissions) {
      const result = await this.upsertRolePermission(perm.role, perm.action, perm.isEnabled);
      results.push(result);
    }
    return results;
  }

  // ===== DISCIPLINES =====
  
  async getAllDisciplines(): Promise<Discipline[]> {
    return await db.select().from(disciplines).orderBy(asc(disciplines.code));
  }
  
  // Point Disciplines
  async getPointDisciplines(pointId: string): Promise<string[]> {
    const result = await db.select({ code: pointDisciplines.disciplineCode })
      .from(pointDisciplines)
      .where(eq(pointDisciplines.pointId, pointId));
    return result.map(r => r.code);
  }
  
  async setPointDisciplines(pointId: string, disciplineCodes: string[]): Promise<void> {
    // Delete existing assignments
    await db.delete(pointDisciplines).where(eq(pointDisciplines.pointId, pointId));
    
    // Insert new assignments
    if (disciplineCodes.length > 0) {
      await db.insert(pointDisciplines).values(
        disciplineCodes.map(code => ({ pointId, disciplineCode: code }))
      );
    }
  }
  
  // Meeting Disciplines
  async getMeetingDisciplines(meetingId: string): Promise<string[]> {
    const result = await db.select({ code: meetingDisciplines.disciplineCode })
      .from(meetingDisciplines)
      .where(eq(meetingDisciplines.meetingId, meetingId));
    return result.map(r => r.code);
  }
  
  async setMeetingDisciplines(meetingId: string, disciplineCodes: string[]): Promise<void> {
    // Delete existing assignments
    await db.delete(meetingDisciplines).where(eq(meetingDisciplines.meetingId, meetingId));
    
    // Insert new assignments
    if (disciplineCodes.length > 0) {
      await db.insert(meetingDisciplines).values(
        disciplineCodes.map(code => ({ meetingId, disciplineCode: code }))
      );
    }
  }
  
  // Series Disciplines
  async getSeriesDisciplines(seriesId: string): Promise<string[]> {
    const result = await db.select({ code: seriesDisciplines.disciplineCode })
      .from(seriesDisciplines)
      .where(eq(seriesDisciplines.seriesId, seriesId));
    return result.map(r => r.code);
  }
  
  async setSeriesDisciplines(seriesId: string, disciplineCodes: string[]): Promise<void> {
    // Delete existing assignments
    await db.delete(seriesDisciplines).where(eq(seriesDisciplines.seriesId, seriesId));
    
    // Insert new assignments
    if (disciplineCodes.length > 0) {
      await db.insert(seriesDisciplines).values(
        disciplineCodes.map(code => ({ seriesId, disciplineCode: code }))
      );
    }
  }

  // ===== USER PROFILE STATS =====

  async getUserStats(userId: string, userEmail: string): Promise<{
    totalPoints: number;
    openPoints: number;
    closedPoints: number;
    upcomingDeadlines: number;
    overduePoints: number;
  }> {
    const today = new Date().toISOString().split('T')[0];
    
    // Find all points assigned to user by userId or email
    const userPattern = `user:${userId}`;
    
    const allPoints = await db.select({
      status: points.status,
      dueDate: points.dueDate,
    }).from(points).where(
      or(
        eq(points.assignedToRef, userPattern),
        ilike(points.assignedTo, `%${userEmail}%`),
        ilike(points.assignedToRef, `%${userEmail}%`)
      )
    );

    const totalPoints = allPoints.length;
    const openPoints = allPoints.filter(p => ['open', 'new', 'ongoing'].includes(p.status)).length;
    const closedPoints = allPoints.filter(p => p.status === 'closed').length;
    const upcomingDeadlines = allPoints.filter(p => 
      ['open', 'new', 'ongoing'].includes(p.status) && 
      p.dueDate >= today
    ).length;
    const overduePoints = allPoints.filter(p => 
      ['open', 'new', 'ongoing'].includes(p.status) && 
      p.dueDate < today
    ).length;

    return { totalPoints, openPoints, closedPoints, upcomingDeadlines, overduePoints };
  }

  async getPointsAssignedToUser(userId: string, userEmail: string): Promise<(Point & { 
    meetingTitle?: string; 
    seriesTitle?: string;
    projectName?: string;
  })[]> {
    const userPattern = `user:${userId}`;
    
    // Get all points assigned to this user
    const assignedPoints = await db.select().from(points).where(
      or(
        eq(points.assignedToRef, userPattern),
        ilike(points.assignedTo, `%${userEmail}%`),
        ilike(points.assignedToRef, `%${userEmail}%`)
      )
    ).orderBy(asc(points.dueDate));

    // Enhance with meeting/series titles and project names
    const enhancedPoints = await Promise.all(assignedPoints.map(async (point) => {
      let meetingTitle: string | undefined;
      let seriesTitle: string | undefined;
      let projectName: string | undefined;

      if (point.meetingId) {
        const meeting = await db.select({ 
          title: meetings.title, 
          projectId: meetings.projectId 
        }).from(meetings).where(eq(meetings.id, point.meetingId));
        if (meeting[0]) {
          meetingTitle = meeting[0].title;
          if (meeting[0].projectId) {
            const project = await db.select({ name: projects.name })
              .from(projects).where(eq(projects.id, meeting[0].projectId));
            projectName = project[0]?.name;
          }
        }
      } else if (point.seriesId) {
        const series = await db.select({ 
          title: meetingSeries.title, 
          projectId: meetingSeries.projectId 
        }).from(meetingSeries).where(eq(meetingSeries.id, point.seriesId));
        if (series[0]) {
          seriesTitle = series[0].title;
          if (series[0].projectId) {
            const project = await db.select({ name: projects.name })
              .from(projects).where(eq(projects.id, series[0].projectId));
            projectName = project[0]?.name;
          }
        }
      }

      return { ...point, meetingTitle, seriesTitle, projectName };
    }));

    return enhancedPoints;
  }

  async getDashboardStats(): Promise<{
    totalProjects: number;
    activeProjects: number;
    totalMeetings: number;
    scheduledMeetings: number;
    totalSeries: number;
    activeSeries: number;
    totalPoints: number;
    openPoints: number;
    closedPoints: number;
    overduePoints: number;
    totalUsers: number;
    totalCompanies: number;
    pointsByStatus: { status: string; count: number }[];
    pointsByDiscipline: { discipline: string; count: number }[];
    meetingsByMonth: { month: string; meetings: number; series: number }[];
    projectsByStatus: { status: string; count: number }[];
  }> {
    const today = new Date().toISOString().split('T')[0];

    // Total counts
    const [projectsResult, meetingsResult, seriesResult, pointsResult, usersResult, companiesResult] = await Promise.all([
      db.select({ count: sql<number>`count(*)::int` }).from(projects),
      db.select({ count: sql<number>`count(*)::int` }).from(meetings),
      db.select({ count: sql<number>`count(*)::int` }).from(meetingSeries),
      db.select({ count: sql<number>`count(*)::int` }).from(points),
      db.select({ count: sql<number>`count(*)::int` }).from(users),
      db.select({ count: sql<number>`count(*)::int` }).from(companies)
    ]);

    const totalProjects = projectsResult[0]?.count ?? 0;
    const totalMeetings = meetingsResult[0]?.count ?? 0;
    const totalSeries = seriesResult[0]?.count ?? 0;
    const totalPoints = pointsResult[0]?.count ?? 0;
    const totalUsers = usersResult[0]?.count ?? 0;
    const totalCompanies = companiesResult[0]?.count ?? 0;

    // Active/Scheduled counts
    const [activeProjectsResult, scheduledMeetingsResult, activeSeriesResult] = await Promise.all([
      db.select({ count: sql<number>`count(*)::int` }).from(projects).where(eq(projects.status, 'active')),
      db.select({ count: sql<number>`count(*)::int` }).from(meetings).where(eq(meetings.status, 'scheduled')),
      db.select({ count: sql<number>`count(*)::int` }).from(meetingSeries).where(eq(meetingSeries.status, 'active'))
    ]);

    const activeProjects = activeProjectsResult[0]?.count ?? 0;
    const scheduledMeetings = scheduledMeetingsResult[0]?.count ?? 0;
    const activeSeries = activeSeriesResult[0]?.count ?? 0;

    // Points by status
    const allPoints = await db.select({
      status: points.status,
      dueDate: points.dueDate,
    }).from(points);

    const openStatuses = ['open', 'new', 'ongoing'];
    const openPoints = allPoints.filter(p => openStatuses.includes(p.status)).length;
    const closedPoints = allPoints.filter(p => p.status === 'closed').length;
    const overduePoints = allPoints.filter(p => 
      openStatuses.includes(p.status) && p.dueDate && p.dueDate < today
    ).length;

    // Points by status breakdown
    const statusCounts: Record<string, number> = {};
    allPoints.forEach(p => {
      statusCounts[p.status] = (statusCounts[p.status] || 0) + 1;
    });
    const pointsByStatus = Object.entries(statusCounts).map(([status, count]) => ({ status, count }));

    // Points by discipline - fetch and count in JS
    let pointsByDiscipline: { discipline: string; count: number }[] = [];
    try {
      const allPointDisciplines = await db.select().from(pointDisciplines);
      const disciplineCounts: Record<string, number> = {};
      allPointDisciplines.forEach(pd => {
        disciplineCounts[pd.disciplineCode] = (disciplineCounts[pd.disciplineCode] || 0) + 1;
      });
      pointsByDiscipline = Object.entries(disciplineCounts)
        .map(([discipline, count]) => ({ discipline, count }));
    } catch (e) {
      console.warn("Failed to fetch discipline data:", e);
    }

    // Meetings by month (last 6 months) - fetch all and group in JS to avoid SQL syntax issues
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
    sixMonthsAgo.setDate(1);
    const startDateStr = sixMonthsAgo.toISOString().split('T')[0];

    const allMeetingsForMonth = await db.select({ date: meetings.date }).from(meetings)
      .where(sql`${meetings.date} >= ${startDateStr}`);

    const allSeriesForMonth = await db.select({ createdAt: meetingSeries.createdAt }).from(meetingSeries)
      .where(sql`${meetingSeries.createdAt} >= ${startDateStr}`);

    // Merge meetings and series by month
    const monthMap: Record<string, { meetings: number; series: number }> = {};
    
    // Generate last 6 months
    for (let i = 0; i < 6; i++) {
      const d = new Date();
      d.setMonth(d.getMonth() - (5 - i));
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      monthMap[key] = { meetings: 0, series: 0 };
    }

    allMeetingsForMonth.forEach(m => {
      if (m.date) {
        const monthKey = m.date.substring(0, 7); // YYYY-MM
        if (monthMap[monthKey]) {
          monthMap[monthKey].meetings++;
        }
      }
    });

    allSeriesForMonth.forEach(s => {
      if (s.createdAt) {
        const dateStr = s.createdAt.toISOString().split('T')[0];
        const monthKey = dateStr.substring(0, 7); // YYYY-MM
        if (monthMap[monthKey]) {
          monthMap[monthKey].series++;
        }
      }
    });

    const meetingsByMonth = Object.entries(monthMap).map(([month, data]) => ({
      month,
      meetings: data.meetings,
      series: data.series
    }));

    // Projects by status - fetch and count in JS
    const allProjectsStatus = await db.select({ status: projects.status }).from(projects);
    const projectStatusCounts: Record<string, number> = {};
    allProjectsStatus.forEach(p => {
      const status = p.status || 'unknown';
      projectStatusCounts[status] = (projectStatusCounts[status] || 0) + 1;
    });
    
    const projectsByStatus = Object.entries(projectStatusCounts)
      .map(([status, count]) => ({ status, count }));

    return {
      totalProjects,
      activeProjects,
      totalMeetings,
      scheduledMeetings,
      totalSeries,
      activeSeries,
      totalPoints,
      openPoints,
      closedPoints,
      overduePoints,
      totalUsers,
      totalCompanies,
      pointsByStatus,
      pointsByDiscipline,
      meetingsByMonth,
      projectsByStatus
    };
  }

  // ===== COMPANY INVITATIONS =====
  
  async createCompanyForUser(userId: string, companyData: InsertCompany): Promise<Company> {
    // Create company
    const [company] = await db.insert(companies).values(companyData).returning();
    
    // Update user to be owner of this company
    await db.update(users)
      .set({ companyId: company.id, companyRole: 'OWNER' as CompanyRole })
      .where(eq(users.id, userId));
    
    return company;
  }

  async createCompanyInvitation(
    companyId: string, 
    inviterId: string, 
    email: string, 
    companyRole: CompanyRole
  ): Promise<CompanyInvitation> {
    // Generate unique token
    const token = crypto.randomUUID();
    
    // Set expiration to 7 days from now
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);
    
    // Check if user with this email already exists
    const existingUser = await db.select().from(users).where(eq(users.email, email.toLowerCase()));
    
    const [invitation] = await db.insert(companyInvitations).values({
      companyId,
      inviterId,
      email: email.toLowerCase(),
      inviteeId: existingUser[0]?.id || null,
      token,
      companyRole,
      expiresAt,
    }).returning();
    
    return invitation;
  }

  async getCompanyInvitations(companyId: string): Promise<(CompanyInvitation & { inviterName: string })[]> {
    const result = await db
      .select({
        id: companyInvitations.id,
        companyId: companyInvitations.companyId,
        inviterId: companyInvitations.inviterId,
        email: companyInvitations.email,
        inviteeId: companyInvitations.inviteeId,
        token: companyInvitations.token,
        companyRole: companyInvitations.companyRole,
        status: companyInvitations.status,
        expiresAt: companyInvitations.expiresAt,
        respondedAt: companyInvitations.respondedAt,
        createdAt: companyInvitations.createdAt,
        inviterName: users.name,
      })
      .from(companyInvitations)
      .innerJoin(users, eq(companyInvitations.inviterId, users.id))
      .where(eq(companyInvitations.companyId, companyId))
      .orderBy(desc(companyInvitations.createdAt));
    
    return result;
  }

  async getInvitationByToken(token: string): Promise<(CompanyInvitation & { companyName: string; inviterName: string }) | undefined> {
    const result = await db
      .select({
        id: companyInvitations.id,
        companyId: companyInvitations.companyId,
        inviterId: companyInvitations.inviterId,
        email: companyInvitations.email,
        inviteeId: companyInvitations.inviteeId,
        token: companyInvitations.token,
        companyRole: companyInvitations.companyRole,
        status: companyInvitations.status,
        expiresAt: companyInvitations.expiresAt,
        respondedAt: companyInvitations.respondedAt,
        createdAt: companyInvitations.createdAt,
        companyName: companies.name,
        inviterName: users.name,
      })
      .from(companyInvitations)
      .innerJoin(companies, eq(companyInvitations.companyId, companies.id))
      .innerJoin(users, eq(companyInvitations.inviterId, users.id))
      .where(eq(companyInvitations.token, token));
    
    return result[0];
  }

  async getUserPendingInvitations(email: string): Promise<(CompanyInvitation & { companyName: string; inviterName: string })[]> {
    const result = await db
      .select({
        id: companyInvitations.id,
        companyId: companyInvitations.companyId,
        inviterId: companyInvitations.inviterId,
        email: companyInvitations.email,
        inviteeId: companyInvitations.inviteeId,
        token: companyInvitations.token,
        companyRole: companyInvitations.companyRole,
        status: companyInvitations.status,
        expiresAt: companyInvitations.expiresAt,
        respondedAt: companyInvitations.respondedAt,
        createdAt: companyInvitations.createdAt,
        companyName: companies.name,
        inviterName: users.name,
      })
      .from(companyInvitations)
      .innerJoin(companies, eq(companyInvitations.companyId, companies.id))
      .innerJoin(users, eq(companyInvitations.inviterId, users.id))
      .where(and(
        eq(companyInvitations.email, email.toLowerCase()),
        eq(companyInvitations.status, 'pending'),
        sql`${companyInvitations.expiresAt} > NOW()`
      ))
      .orderBy(desc(companyInvitations.createdAt));
    
    return result;
  }

  async acceptInvitation(token: string, userId: string): Promise<void> {
    const invitation = await this.getInvitationByToken(token);
    
    if (!invitation) {
      throw new Error("Invitation not found");
    }
    
    if (invitation.status !== 'pending') {
      throw new Error("Invitation is no longer pending");
    }
    
    if (new Date(invitation.expiresAt) < new Date()) {
      throw new Error("Invitation has expired");
    }
    
    // Update invitation status
    await db.update(companyInvitations)
      .set({ 
        status: 'accepted',
        inviteeId: userId,
        respondedAt: new Date()
      })
      .where(eq(companyInvitations.token, token));
    
    // Update user's company membership
    await db.update(users)
      .set({ 
        companyId: invitation.companyId,
        companyRole: invitation.companyRole || 'EMPLOYEE'
      })
      .where(eq(users.id, userId));
  }

  async declineInvitation(token: string): Promise<void> {
    await db.update(companyInvitations)
      .set({ 
        status: 'declined',
        respondedAt: new Date()
      })
      .where(eq(companyInvitations.token, token));
  }

  async cancelInvitation(invitationId: string): Promise<void> {
    await db.delete(companyInvitations)
      .where(eq(companyInvitations.id, invitationId));
  }

  async expireOldInvitations(): Promise<number> {
    const result = await db.update(companyInvitations)
      .set({ status: 'expired' })
      .where(and(
        eq(companyInvitations.status, 'pending'),
        sql`${companyInvitations.expiresAt} < NOW()`
      ))
      .returning();
    
    return result.length;
  }
}

export const storage = new DBStorage();
