import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { 
  insertMeetingSchema, 
  insertPointSchema, 
  insertAttendeeSchema, 
  insertStatusUpdateSchema,
  insertAttachmentSchema,
  insertProjectSchema,
  insertMeetingSeriesSchema,
  insertMeetingOccurrenceSchema,
  insertSeriesAttendeeSchema,
  insertAttendanceRecordSchema,
  insertUserSchema,
  insertCompanySchema,
  roleEnum
} from "@shared/schema";
import { fromZodError } from "zod-validation-error";
import multer from "multer";
import * as ical from "ical";
import { 
  authMiddleware, 
  requireAuth, 
  requireRole, 
  requirePermission,
  getCurrentUserPermissions,
  registerUser,
  loginWithEmail,
  loginWithSocial,
  setAuthCookie,
  clearAuthCookie,
  generateToken,
  hashPassword,
  extractEmailDomain,
  isPublicEmailDomain
} from "./auth";
import { 
  ROLE_DISPLAY_NAMES, 
  ROLE_DESCRIPTIONS, 
  hasPermission,
  ALL_PERMISSION_ACTIONS,
  PERMISSION_ACTION_LABELS,
  PERMISSION_CATEGORIES,
  DEFAULT_PERMISSION_MATRIX,
  updateEffectivePermissionMatrix,
  getEffectivePermissionMatrix
} from "./permissions";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  
  // Apply auth middleware FIRST to all /api routes so req.currentUser is always populated
  app.use(authMiddleware);
  
  // Load role permission overrides from database on startup
  try {
    const overrides = await storage.getRolePermissions();
    updateEffectivePermissionMatrix(overrides);
    console.log(`Loaded ${overrides.length} role permission overrides from database`);
  } catch (error) {
    console.warn("Failed to load role permissions from database, using defaults:", error);
  }
  
  // ===== AUTHENTICATION ROUTES =====

  // Register new user
  app.post("/api/auth/register", async (req, res) => {
    try {
      const { email, password, name } = req.body;
      
      if (!email || !password || !name) {
        return res.status(400).json({ error: "Email, password, and name are required" });
      }

      const { user, token } = await registerUser(email, password, name);
      setAuthCookie(res, token);
      
      res.status(201).json({ 
        message: "Account created successfully",
        user: { id: user.id, email: user.email, name: user.name }
      });
    } catch (error: any) {
      res.status(400).json({ error: error.message || "Registration failed" });
    }
  });

  // Login with email/password
  app.post("/api/auth/login", async (req, res) => {
    try {
      const { email, password } = req.body;
      
      if (!email || !password) {
        return res.status(400).json({ error: "Email and password are required" });
      }

      const { user, token } = await loginWithEmail(email, password);
      setAuthCookie(res, token);
      
      res.json({ 
        message: "Login successful",
        user: { id: user.id, email: user.email, name: user.name }
      });
    } catch (error: any) {
      res.status(401).json({ error: error.message || "Login failed" });
    }
  });

  // Login with Google (via Replit connector)
  app.post("/api/auth/google", async (req, res) => {
    try {
      const { providerId, email, name, avatar } = req.body;
      
      if (!providerId || !email) {
        return res.status(400).json({ error: "Provider ID and email are required" });
      }

      const { user, token, isNewUser } = await loginWithSocial("google", providerId, email, name || email, avatar);
      setAuthCookie(res, token);
      
      res.json({ 
        message: isNewUser ? "Account created with Google" : "Login successful",
        user: { id: user.id, email: user.email, name: user.name },
        isNewUser
      });
    } catch (error: any) {
      res.status(400).json({ error: error.message || "Google login failed" });
    }
  });

  // Login with Microsoft (via Replit connector)
  app.post("/api/auth/microsoft", async (req, res) => {
    try {
      const { providerId, email, name, avatar } = req.body;
      
      if (!providerId || !email) {
        return res.status(400).json({ error: "Provider ID and email are required" });
      }

      const { user, token, isNewUser } = await loginWithSocial("microsoft", providerId, email, name || email, avatar);
      setAuthCookie(res, token);
      
      res.json({ 
        message: isNewUser ? "Account created with Microsoft" : "Login successful",
        user: { id: user.id, email: user.email, name: user.name },
        isNewUser
      });
    } catch (error: any) {
      res.status(400).json({ error: error.message || "Microsoft login failed" });
    }
  });

  // Logout
  app.post("/api/auth/logout", (req, res) => {
    clearAuthCookie(res);
    res.json({ message: "Logged out successfully" });
  });

  // Change password (for authenticated users)
  app.post("/api/auth/change-password", requireAuth, async (req, res) => {
    try {
      const { currentPassword, newPassword } = req.body;
      
      if (!currentPassword || !newPassword) {
        return res.status(400).json({ error: "Current and new password are required" });
      }

      if (newPassword.length < 8) {
        return res.status(400).json({ error: "New password must be at least 8 characters" });
      }

      const user = await storage.getUser(req.currentUser!.id);
      if (!user || !user.passwordHash) {
        return res.status(400).json({ error: "Password change not available for social login accounts" });
      }

      // Verify current password
      const bcrypt = await import("bcrypt");
      const isValid = await bcrypt.compare(currentPassword, user.passwordHash);
      if (!isValid) {
        return res.status(401).json({ error: "Current password is incorrect" });
      }

      // Hash and update new password
      const newHash = await hashPassword(newPassword);
      await storage.updateUser(user.id, { passwordHash: newHash } as any);
      
      res.json({ message: "Password changed successfully" });
    } catch (error) {
      res.status(500).json({ error: "Failed to change password" });
    }
  });

  // ===== PROJECTS ROUTES =====

  // Get all projects with optional filters
  app.get("/api/projects", async (req, res) => {
    try {
      const { city, country, status, search } = req.query;
      const projects = await storage.getAllProjects({
        city: city as string,
        country: country as string,
        status: status as string,
        search: search as string,
      });
      res.json(projects);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch projects" });
    }
  });

  // Get project filter options
  app.get("/api/projects/filters", async (req, res) => {
    try {
      const [cities, countries] = await Promise.all([
        storage.getProjectCities(),
        storage.getProjectCountries(),
      ]);
      res.json({ cities, countries });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch filter options" });
    }
  });

  // Get meeting counts per project
  app.get("/api/projects/meeting-counts", async (req, res) => {
    try {
      const counts = await storage.getAllMeetingCounts();
      res.json(counts);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch meeting counts" });
    }
  });

  // Get single project with meetings
  app.get("/api/projects/:id", async (req, res) => {
    try {
      const project = await storage.getProject(req.params.id);
      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }
      const meetings = await storage.getMeetingsByProject(req.params.id);
      res.json({ ...project, meetings });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch project" });
    }
  });

  // Create project
  app.post("/api/projects", requireAuth, requirePermission("projects:create"), async (req, res) => {
    try {
      const validation = insertProjectSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ error: fromZodError(validation.error).message });
      }
      const project = await storage.createProject(validation.data);
      res.status(201).json(project);
    } catch (error) {
      res.status(500).json({ error: "Failed to create project" });
    }
  });

  // Update project
  app.patch("/api/projects/:id", requireAuth, requirePermission("projects:edit"), async (req, res) => {
    try {
      const project = await storage.updateProject(req.params.id, req.body);
      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }
      res.json(project);
    } catch (error) {
      res.status(500).json({ error: "Failed to update project" });
    }
  });

  // Delete project
  app.delete("/api/projects/:id", requireAuth, requirePermission("projects:edit"), async (req, res) => {
    try {
      await storage.deleteProject(req.params.id);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete project" });
    }
  });

  // Get all points for a project
  app.get("/api/projects/:id/points", async (req, res) => {
    try {
      const points = await storage.getPointsByProject(req.params.id);
      res.json(points);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch project points" });
    }
  });

  // Get all attachments/files for a project
  app.get("/api/projects/:id/files", async (req, res) => {
    try {
      const files = await storage.getAttachmentsByProject(req.params.id);
      res.json(files);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch project files" });
    }
  });

  // ===== DASHBOARD ROUTES =====
  
  // Get dashboard stats
  app.get("/api/dashboard/stats", async (req, res) => {
    try {
      const stats = await storage.getDashboardStats();
      res.json(stats);
    } catch (error) {
      console.error("Failed to fetch dashboard stats:", error);
      res.status(500).json({ error: "Failed to fetch dashboard stats" });
    }
  });

  // ===== MEETINGS ROUTES =====
  
  // Get all meetings with optional filters
  app.get("/api/meetings", async (req, res) => {
    try {
      const { projectId, projectIds, city, search, sortBy, sortOrder, status } = req.query;
      
      // Parse projectIds if provided (comma-separated string)
      const projectIdsArray = projectIds 
        ? (projectIds as string).split(',').filter(Boolean)
        : undefined;
      
      const meetings = await storage.getAllMeetings({
        projectId: projectId as string,
        projectIds: projectIdsArray,
        city: city as string,
        search: search as string,
        sortBy: sortBy as 'date' | 'project' | 'title',
        sortOrder: sortOrder as 'asc' | 'desc',
        status: status as 'scheduled' | 'closed' | 'all',
      });
      res.json(meetings);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch meetings" });
    }
  });

  // Get meeting filter options
  app.get("/api/meetings/filters", async (req, res) => {
    try {
      const [locations, projects, cities] = await Promise.all([
        storage.getMeetingLocations(),
        storage.getAllProjects(),
        storage.getProjectCities(),
      ]);
      res.json({ 
        locations, 
        cities,
        projects: projects.map(p => ({ id: p.id, name: p.name }))
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch filter options" });
    }
  });

  // Get point counts per meeting
  app.get("/api/meetings/point-counts", async (req, res) => {
    try {
      const counts = await storage.getAllPointCounts();
      res.json(counts);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch point counts" });
    }
  });

  // Get attendee counts per meeting
  app.get("/api/meetings/attendee-counts", async (req, res) => {
    try {
      const counts = await storage.getAllMeetingAttendeeCounts();
      res.json(counts);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch attendee counts" });
    }
  });

  // Get attendee counts per series
  app.get("/api/meeting-series/attendee-counts", async (req, res) => {
    try {
      const counts = await storage.getAllSeriesAttendeeCounts();
      res.json(counts);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch series attendee counts" });
    }
  });

  // Get point counts per series
  app.get("/api/meeting-series/point-counts", async (req, res) => {
    try {
      const counts = await storage.getAllSeriesPointCounts();
      res.json(counts);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch series point counts" });
    }
  });

  // Get meetings by project
  app.get("/api/projects/:projectId/meetings", async (req, res) => {
    try {
      const meetings = await storage.getMeetingsByProject(req.params.projectId);
      res.json(meetings);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch meetings" });
    }
  });

  // Get single meeting
  app.get("/api/meetings/:id", async (req, res) => {
    try {
      const meeting = await storage.getMeeting(req.params.id);
      if (!meeting) {
        return res.status(404).json({ error: "Meeting not found" });
      }
      res.json(meeting);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch meeting" });
    }
  });

  // Create meeting
  app.post("/api/meetings", requireAuth, requirePermission("meetings:create"), async (req, res) => {
    try {
      const validation = insertMeetingSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ error: fromZodError(validation.error).message });
      }
      const meeting = await storage.createMeeting(validation.data);
      res.status(201).json(meeting);
    } catch (error) {
      res.status(500).json({ error: "Failed to create meeting" });
    }
  });

  // Update meeting
  app.patch("/api/meetings/:id", requireAuth, requirePermission("meetings:edit"), async (req, res) => {
    try {
      const meeting = await storage.updateMeeting(req.params.id, req.body);
      if (!meeting) {
        return res.status(404).json({ error: "Meeting not found" });
      }
      res.json(meeting);
    } catch (error) {
      res.status(500).json({ error: "Failed to update meeting" });
    }
  });

  // Delete meeting
  app.delete("/api/meetings/:id", requireAuth, requirePermission("meetings:edit"), async (req, res) => {
    try {
      await storage.deleteMeeting(req.params.id);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete meeting" });
    }
  });

  // Close meeting
  app.post("/api/meetings/:id/close", requireAuth, requirePermission("meetings:close"), async (req, res) => {
    try {
      const { mode, targetMeetingId, targetSeriesId } = req.body;
      if (!mode || !['move', 'close'].includes(mode)) {
        return res.status(400).json({ error: "Invalid mode. Must be 'move' or 'close'" });
      }
      await storage.closeMeeting(req.params.id, mode, targetMeetingId, targetSeriesId);
      res.json({ success: true });
    } catch (error) {
      console.error('Failed to close meeting:', error);
      res.status(500).json({ error: error instanceof Error ? error.message : "Failed to close meeting" });
    }
  });

  // Reopen meeting
  app.post("/api/meetings/:id/reopen", requireAuth, requirePermission("meetings:close"), async (req, res) => {
    try {
      await storage.reopenMeeting(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to reopen meeting" });
    }
  });

  // Get open meetings for project (for close dialog target selection)
  app.get("/api/projects/:projectId/open-meetings", async (req, res) => {
    try {
      const excludeMeetingId = req.query.exclude as string | undefined;
      const meetings = await storage.getOpenMeetingsForProject(req.params.projectId, excludeMeetingId);
      res.json(meetings);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch open meetings" });
    }
  });

  // Get open series for project (for close dialog target selection)
  app.get("/api/projects/:projectId/open-series", async (req, res) => {
    try {
      const excludeSeriesId = req.query.exclude as string | undefined;
      const series = await storage.getOpenSeriesForProject(req.params.projectId, excludeSeriesId);
      res.json(series);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch open series" });
    }
  });

  // ===== ATTENDEES ROUTES =====

  // Get attendees for a meeting (includes user roles if linked)
  app.get("/api/meetings/:meetingId/attendees", async (req, res) => {
    try {
      const attendees = await storage.getAttendeesByMeetingWithRoles(req.params.meetingId);
      res.json(attendees);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch attendees" });
    }
  });

  // Create attendee
  app.post("/api/attendees", requireAuth, requirePermission("attendance:edit"), async (req, res) => {
    try {
      const validation = insertAttendeeSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ error: fromZodError(validation.error).message });
      }
      const attendee = await storage.createAttendee(validation.data);
      res.status(201).json(attendee);
    } catch (error) {
      res.status(500).json({ error: "Failed to create attendee" });
    }
  });

  // Update attendee
  app.patch("/api/attendees/:id", requireAuth, requirePermission("attendance:edit"), async (req, res) => {
    try {
      const attendee = await storage.updateAttendee(req.params.id, req.body);
      if (!attendee) {
        return res.status(404).json({ error: "Attendee not found" });
      }
      res.json(attendee);
    } catch (error) {
      res.status(500).json({ error: "Failed to update attendee" });
    }
  });

  // Delete attendee
  app.delete("/api/attendees/:id", requireAuth, requirePermission("attendance:edit"), async (req, res) => {
    try {
      await storage.deleteAttendee(req.params.id);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete attendee" });
    }
  });

  // Bulk create attendees (for import)
  app.post("/api/meetings/:meetingId/attendees/bulk", requireAuth, requirePermission("attendance:edit"), async (req, res) => {
    try {
      const { attendees } = req.body;
      if (!Array.isArray(attendees)) {
        return res.status(400).json({ error: "Attendees must be an array" });
      }
      
      const insertAttendees = attendees.map((a: any) => ({
        meetingId: req.params.meetingId,
        name: a.name,
        email: a.email || null,
        role: a.role || 'Attendee',
        company: a.company || null,
        avatar: a.avatar || null,
      }));
      
      const created = await storage.bulkCreateAttendees(insertAttendees);
      res.status(201).json(created);
    } catch (error) {
      res.status(500).json({ error: "Failed to import attendees" });
    }
  });

  // ===== SERIES ATTENDEES ROUTES =====

  // Get attendees for a series (includes user roles if linked)
  app.get("/api/series/:seriesId/attendees", async (req, res) => {
    try {
      const attendees = await storage.getAttendeesBySeriesWithRoles(req.params.seriesId);
      res.json(attendees);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch series attendees" });
    }
  });

  // Create series attendee
  app.post("/api/series-attendees", requireAuth, requirePermission("attendance:edit"), async (req, res) => {
    try {
      const validation = insertSeriesAttendeeSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ error: fromZodError(validation.error).message });
      }
      const attendee = await storage.createSeriesAttendee(validation.data);
      res.status(201).json(attendee);
    } catch (error) {
      res.status(500).json({ error: "Failed to create series attendee" });
    }
  });

  // Update series attendee
  app.patch("/api/series-attendees/:id", requireAuth, requirePermission("attendance:edit"), async (req, res) => {
    try {
      const attendee = await storage.updateSeriesAttendee(req.params.id, req.body);
      if (!attendee) {
        return res.status(404).json({ error: "Series attendee not found" });
      }
      res.json(attendee);
    } catch (error) {
      res.status(500).json({ error: "Failed to update series attendee" });
    }
  });

  // Delete series attendee
  app.delete("/api/series-attendees/:id", requireAuth, requirePermission("attendance:edit"), async (req, res) => {
    try {
      await storage.deleteSeriesAttendee(req.params.id);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete series attendee" });
    }
  });

  // Bulk create series attendees (for import)
  app.post("/api/series/:seriesId/attendees/bulk", requireAuth, requirePermission("attendance:edit"), async (req, res) => {
    try {
      const { attendees } = req.body;
      if (!Array.isArray(attendees)) {
        return res.status(400).json({ error: "Attendees must be an array" });
      }
      
      const insertAttendees = attendees.map((a: any) => ({
        seriesId: req.params.seriesId,
        name: a.name,
        email: a.email || null,
        role: a.role || 'Attendee',
        company: a.company || null,
        avatar: a.avatar || null,
      }));
      
      const created = await storage.bulkCreateSeriesAttendees(insertAttendees);
      res.status(201).json(created);
    } catch (error) {
      res.status(500).json({ error: "Failed to import series attendees" });
    }
  });

  // ===== ATTENDANCE RECORDS ROUTES =====

  // Get attendance for a meeting
  app.get("/api/meetings/:meetingId/attendance", async (req, res) => {
    try {
      const records = await storage.getAttendanceByMeeting(req.params.meetingId);
      res.json(records);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch attendance records" });
    }
  });

  // Get attendance for an occurrence
  app.get("/api/occurrences/:occurrenceId/attendance", async (req, res) => {
    try {
      const records = await storage.getAttendanceByOccurrence(req.params.occurrenceId);
      res.json(records);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch attendance records" });
    }
  });

  // Record/update attendance
  app.post("/api/attendance", requireAuth, requirePermission("attendance:edit"), async (req, res) => {
    try {
      const validation = insertAttendanceRecordSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ error: fromZodError(validation.error).message });
      }
      const record = await storage.recordAttendance(validation.data);
      res.status(201).json(record);
    } catch (error) {
      res.status(500).json({ error: "Failed to record attendance" });
    }
  });

  // Update attendance record
  app.patch("/api/attendance/:id", requireAuth, requirePermission("attendance:edit"), async (req, res) => {
    try {
      const { present } = req.body;
      if (typeof present !== 'boolean') {
        return res.status(400).json({ error: "Present must be a boolean" });
      }
      const record = await storage.updateAttendance(req.params.id, present);
      if (!record) {
        return res.status(404).json({ error: "Attendance record not found" });
      }
      res.json(record);
    } catch (error) {
      res.status(500).json({ error: "Failed to update attendance" });
    }
  });

  // Get attendance history for an attendee
  app.get("/api/attendees/:attendeeId/attendance-history", async (req, res) => {
    try {
      const history = await storage.getAttendanceHistory(req.params.attendeeId);
      res.json(history);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch attendance history" });
    }
  });

  // Get attendance history for a series attendee
  app.get("/api/series-attendees/:attendeeId/attendance-history", async (req, res) => {
    try {
      const history = await storage.getSeriesAttendanceHistory(req.params.attendeeId);
      res.json(history);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch attendance history" });
    }
  });

  // ===== POINTS ROUTES =====

  // Get points for a meeting with related data
  app.get("/api/meetings/:meetingId/points", async (req, res) => {
    try {
      const points = await storage.getPointsByMeeting(req.params.meetingId);
      
      // Fetch related data for each point
      const pointsWithRelations = await Promise.all(
        points.map(async (point) => {
          const [statusUpdates, attachments] = await Promise.all([
            storage.getStatusUpdatesByPoint(point.id),
            storage.getAttachmentsByPoint(point.id),
          ]);
          return { ...point, statusUpdates, attachments };
        })
      );
      
      res.json(pointsWithRelations);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch points" });
    }
  });

  // Get single point
  app.get("/api/points/:id", async (req, res) => {
    try {
      const point = await storage.getPoint(req.params.id);
      if (!point) {
        return res.status(404).json({ error: "Point not found" });
      }
      res.json(point);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch point" });
    }
  });

  // Create point
  app.post("/api/points", requireAuth, requirePermission("points:create"), async (req, res) => {
    try {
      const validation = insertPointSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ error: fromZodError(validation.error).message });
      }
      
      let meetingTitle = "No Meeting";
      
      // Point can belong to either a meeting or a series
      if (validation.data.meetingId) {
        const meeting = await storage.getMeeting(validation.data.meetingId);
        if (!meeting) {
          return res.status(400).json({ error: "Meeting not found" });
        }
        meetingTitle = meeting.title;
      } else if (validation.data.seriesId) {
        const series = await storage.getMeetingSeries(validation.data.seriesId);
        if (!series) {
          return res.status(400).json({ error: "Meeting series not found" });
        }
        meetingTitle = series.title;
      } else {
        return res.status(400).json({ error: "Point must belong to a meeting or series" });
      }
      
      const point = await storage.createPoint(validation.data, meetingTitle);
      res.status(201).json(point);
    } catch (error) {
      res.status(500).json({ error: "Failed to create point" });
    }
  });

  // Update point
  app.patch("/api/points/:id", requireAuth, requirePermission("points:edit:any"), async (req, res) => {
    try {
      const point = await storage.updatePoint(req.params.id, req.body);
      if (!point) {
        return res.status(404).json({ error: "Point not found" });
      }
      res.json(point);
    } catch (error) {
      res.status(500).json({ error: "Failed to update point" });
    }
  });

  // Delete point
  app.delete("/api/points/:id", requireAuth, requirePermission("points:edit:any"), async (req, res) => {
    try {
      await storage.deletePoint(req.params.id);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete point" });
    }
  });

  // ===== STATUS UPDATES ROUTES =====

  // Get status updates for a point
  app.get("/api/points/:pointId/updates", async (req, res) => {
    try {
      const updates = await storage.getStatusUpdatesByPoint(req.params.pointId);
      res.json(updates);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch status updates" });
    }
  });

  // Create status update
  app.post("/api/status-updates", requireAuth, requirePermission("comments:create"), async (req, res) => {
    try {
      const validation = insertStatusUpdateSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ error: fromZodError(validation.error).message });
      }
      const update = await storage.createStatusUpdate(validation.data);
      res.status(201).json(update);
    } catch (error) {
      res.status(500).json({ error: "Failed to create status update" });
    }
  });

  // ===== ATTACHMENTS ROUTES =====

  // Get attachments for a point
  app.get("/api/points/:pointId/attachments", async (req, res) => {
    try {
      const attachments = await storage.getAttachmentsByPoint(req.params.pointId);
      res.json(attachments);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch attachments" });
    }
  });

  // Create attachment
  app.post("/api/attachments", requireAuth, requirePermission("attachments:upload"), async (req, res) => {
    try {
      const validation = insertAttachmentSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ error: fromZodError(validation.error).message });
      }
      const attachment = await storage.createAttachment(validation.data);
      res.status(201).json(attachment);
    } catch (error) {
      res.status(500).json({ error: "Failed to create attachment" });
    }
  });

  // ===== MEETING SERIES ROUTES (Recurring Meetings) =====

  // Get all meeting series
  app.get("/api/meeting-series", async (req, res) => {
    try {
      const { projectId, projectIds, status } = req.query;
      const filters: { projectId?: string; projectIds?: string[]; status?: 'active' | 'closed' | 'all' } = {};
      if (projectId) filters.projectId = projectId as string;
      if (projectIds) {
        filters.projectIds = Array.isArray(projectIds) ? projectIds as string[] : [projectIds as string];
      }
      if (status) filters.status = status as 'active' | 'closed' | 'all';
      const series = await storage.getAllMeetingSeries(filters);
      res.json(series);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch meeting series" });
    }
  });

  // Get single meeting series with occurrences
  app.get("/api/meeting-series/:id", async (req, res) => {
    try {
      const series = await storage.getMeetingSeries(req.params.id);
      if (!series) {
        return res.status(404).json({ error: "Meeting series not found" });
      }
      const occurrences = await storage.getOccurrencesBySeries(req.params.id);
      const rawPoints = await storage.getPointsBySeries(req.params.id);
      
      // Fetch statusUpdates and attachments for each point
      const points = await Promise.all(
        rawPoints.map(async (point) => {
          const [statusUpdates, attachments] = await Promise.all([
            storage.getStatusUpdatesByPoint(point.id),
            storage.getAttachmentsByPoint(point.id),
          ]);
          return { ...point, statusUpdates, attachments };
        })
      );
      
      res.json({ ...series, occurrences, points });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch meeting series" });
    }
  });

  // Create meeting series
  app.post("/api/meeting-series", requireAuth, requirePermission("meetings:create"), async (req, res) => {
    try {
      const validation = insertMeetingSeriesSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ error: fromZodError(validation.error).message });
      }
      const series = await storage.createMeetingSeries(validation.data);
      res.status(201).json(series);
    } catch (error) {
      res.status(500).json({ error: "Failed to create meeting series" });
    }
  });

  // Update meeting series
  app.patch("/api/meeting-series/:id", requireAuth, requirePermission("meetings:edit"), async (req, res) => {
    try {
      const series = await storage.updateMeetingSeries(req.params.id, req.body);
      if (!series) {
        return res.status(404).json({ error: "Meeting series not found" });
      }
      res.json(series);
    } catch (error) {
      res.status(500).json({ error: "Failed to update meeting series" });
    }
  });

  // Delete meeting series
  app.delete("/api/meeting-series/:id", requireAuth, requirePermission("meetings:edit"), async (req, res) => {
    try {
      await storage.deleteMeetingSeries(req.params.id);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete meeting series" });
    }
  });

  // Close meeting series
  app.post("/api/meeting-series/:id/close", requireAuth, requirePermission("meetings:close"), async (req, res) => {
    try {
      const { mode, targetSeriesId, targetMeetingId } = req.body;
      if (!mode || !['move', 'close'].includes(mode)) {
        return res.status(400).json({ error: "Invalid mode. Must be 'move' or 'close'" });
      }
      await storage.closeMeetingSeries(req.params.id, mode, targetSeriesId, targetMeetingId);
      res.json({ success: true });
    } catch (error) {
      console.error('Failed to close series:', error);
      res.status(500).json({ error: error instanceof Error ? error.message : "Failed to close series" });
    }
  });

  // Reopen meeting series
  app.post("/api/meeting-series/:id/reopen", requireAuth, requirePermission("meetings:close"), async (req, res) => {
    try {
      await storage.reopenMeetingSeries(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to reopen series" });
    }
  });

  // Close occurrence
  app.post("/api/meeting-occurrences/:id/close", requireAuth, requirePermission("meetings:close"), async (req, res) => {
    try {
      const { mode, targetOccurrenceId } = req.body;
      await storage.closeOccurrence(req.params.id, mode || 'close', targetOccurrenceId);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to close occurrence" });
    }
  });

  // Reopen occurrence
  app.post("/api/meeting-occurrences/:id/reopen", requireAuth, requirePermission("meetings:close"), async (req, res) => {
    try {
      await storage.reopenOccurrence(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to reopen occurrence" });
    }
  });

  // Get occurrences for a series
  app.get("/api/meeting-series/:seriesId/occurrences", async (req, res) => {
    try {
      const occurrences = await storage.getOccurrencesBySeries(req.params.seriesId);
      res.json(occurrences);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch occurrences" });
    }
  });

  // Create occurrence
  app.post("/api/meeting-occurrences", requireAuth, requirePermission("meetings:create"), async (req, res) => {
    try {
      const validation = insertMeetingOccurrenceSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ error: fromZodError(validation.error).message });
      }
      const occurrence = await storage.createMeetingOccurrence(validation.data);
      res.status(201).json(occurrence);
    } catch (error) {
      res.status(500).json({ error: "Failed to create occurrence" });
    }
  });

  // Update occurrence
  app.patch("/api/meeting-occurrences/:id", requireAuth, requirePermission("meetings:edit"), async (req, res) => {
    try {
      const occurrence = await storage.updateMeetingOccurrence(req.params.id, req.body);
      if (!occurrence) {
        return res.status(404).json({ error: "Occurrence not found" });
      }
      res.json(occurrence);
    } catch (error) {
      res.status(500).json({ error: "Failed to update occurrence" });
    }
  });

  // Get points for a series
  app.get("/api/meeting-series/:seriesId/points", async (req, res) => {
    try {
      const points = await storage.getPointsBySeries(req.params.seriesId);
      
      // Fetch related data for each point
      const pointsWithRelations = await Promise.all(
        points.map(async (point) => {
          const [statusUpdates, attachments] = await Promise.all([
            storage.getStatusUpdatesByPoint(point.id),
            storage.getAttachmentsByPoint(point.id),
          ]);
          return { ...point, statusUpdates, attachments };
        })
      );
      
      res.json(pointsWithRelations);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch points" });
    }
  });

  // ===== MOVE POINTS ROUTES =====

  // Get unresolved points for a meeting
  app.get("/api/meetings/:meetingId/unresolved-points", async (req, res) => {
    try {
      const points = await storage.getUnresolvedPointsByMeeting(req.params.meetingId);
      res.json(points);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch unresolved points" });
    }
  });

  // Move points to another meeting
  app.post("/api/meetings/:meetingId/move-points", requireAuth, requirePermission("points:edit:any"), async (req, res) => {
    try {
      const { pointIds, targetMeetingId, createNewMeeting } = req.body;
      
      if (!pointIds || pointIds.length === 0) {
        return res.status(400).json({ error: "No points specified" });
      }
      
      let finalTargetId = targetMeetingId;
      
      // If creating a new meeting, do that first
      if (createNewMeeting) {
        const validation = insertMeetingSchema.safeParse(createNewMeeting);
        if (!validation.success) {
          return res.status(400).json({ error: fromZodError(validation.error).message });
        }
        const newMeeting = await storage.createMeeting(validation.data);
        finalTargetId = newMeeting.id;
      }
      
      if (!finalTargetId) {
        return res.status(400).json({ error: "Target meeting not specified" });
      }
      
      await storage.movePointsToMeeting(pointIds, finalTargetId);
      
      res.json({ success: true, targetMeetingId: finalTargetId });
    } catch (error) {
      res.status(500).json({ error: "Failed to move points" });
    }
  });

  // Get next meeting in project
  app.get("/api/meetings/:meetingId/next-in-project", async (req, res) => {
    try {
      const meeting = await storage.getMeeting(req.params.meetingId);
      if (!meeting || !meeting.projectId) {
        return res.status(404).json({ error: "Meeting not found or has no project" });
      }
      
      const nextMeeting = await storage.getNextMeetingInProject(meeting.projectId, meeting.date);
      res.json(nextMeeting || null);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch next meeting" });
    }
  });

  // ===== MEETING MINUTES ROUTES =====

  // Send meeting minutes to attendees
  app.post("/api/send-minutes", requireAuth, requirePermission("meetings:send_minutes"), async (req, res) => {
    try {
      const { meetingId, meetingTitle, emailText, additionalNotes, recipientEmails, points, platform } = req.body;
      
      if (!recipientEmails || recipientEmails.length === 0) {
        return res.status(400).json({ error: "No recipient emails provided" });
      }

      // Build email HTML content
      const statusColors: Record<string, string> = {
        new: '#22c55e',
        open: '#3b82f6',
        ongoing: '#eab308',
        closed: '#6b7280',
        postponed: '#f97316'
      };

      const pointsHtml = points && points.length > 0 
        ? points.map((p: any) => `
          <tr>
            <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">
              <strong>${p.title}</strong>
              <p style="margin: 4px 0 0 0; color: #6b7280; font-size: 14px;">${p.description || ''}</p>
            </td>
            <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: center;">
              <span style="background: ${statusColors[p.status] || '#6b7280'}; color: white; padding: 4px 8px; border-radius: 4px; font-size: 12px; text-transform: uppercase;">
                ${p.status}
              </span>
            </td>
            <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">${p.assignedTo || 'Unassigned'}</td>
          </tr>
        `).join('')
        : '<tr><td colspan="3" style="padding: 12px; text-align: center; color: #6b7280;">No discussion points</td></tr>';

      const htmlBody = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>Meeting Minutes - ${meetingTitle || 'Meeting'}</title>
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px;">
          <h1 style="color: #1f2937; border-bottom: 2px solid #3b82f6; padding-bottom: 10px;">
            Meeting Minutes: ${meetingTitle || 'Meeting'}
          </h1>
          
          ${emailText ? `<div style="background: #f3f4f6; padding: 16px; border-radius: 8px; margin-bottom: 20px;">${emailText.replace(/\n/g, '<br>')}</div>` : ''}
          
          <h2 style="color: #374151; margin-top: 24px;">Discussion Points</h2>
          <table style="width: 100%; border-collapse: collapse; border: 1px solid #e5e7eb; border-radius: 8px;">
            <thead>
              <tr style="background: #f9fafb;">
                <th style="padding: 12px; text-align: left; border-bottom: 2px solid #e5e7eb;">Point</th>
                <th style="padding: 12px; text-align: center; border-bottom: 2px solid #e5e7eb; width: 100px;">Status</th>
                <th style="padding: 12px; text-align: left; border-bottom: 2px solid #e5e7eb; width: 150px;">Assigned To</th>
              </tr>
            </thead>
            <tbody>
              ${pointsHtml}
            </tbody>
          </table>
          
          ${additionalNotes ? `
            <h2 style="color: #374151; margin-top: 24px;">Additional Notes</h2>
            <div style="background: #fef3c7; padding: 16px; border-radius: 8px; border-left: 4px solid #f59e0b;">
              ${additionalNotes.replace(/\n/g, '<br>')}
            </div>
          ` : ''}
          
          <p style="color: #6b7280; font-size: 12px; margin-top: 32px; border-top: 1px solid #e5e7eb; padding-top: 16px;">
            Sent from BIMCall - BIM Coordination Meeting Manager
          </p>
        </body>
        </html>
      `;

      const subject = `Meeting Minutes: ${meetingTitle || 'BIM Coordination Meeting'}`;

      // Try to send via the specified platform or try both
      const { sendEmailViaGmail, sendEmailViaOutlook } = await import('./email-clients');
      
      let sent = false;
      let sendError: any = null;

      if (platform === 'gmail' || !platform) {
        try {
          await sendEmailViaGmail(recipientEmails, subject, htmlBody);
          sent = true;
          console.log(`Minutes sent via Gmail to ${recipientEmails.length} recipients`);
        } catch (err: any) {
          sendError = err;
          console.log(`Gmail send failed: ${err.message}`);
        }
      }

      if (!sent && (platform === 'outlook' || !platform)) {
        try {
          await sendEmailViaOutlook(recipientEmails, subject, htmlBody);
          sent = true;
          console.log(`Minutes sent via Outlook to ${recipientEmails.length} recipients`);
        } catch (err: any) {
          sendError = err;
          console.log(`Outlook send failed: ${err.message}`);
        }
      }

      if (!sent) {
        return res.status(503).json({ 
          error: "Failed to send email",
          message: sendError?.message || "Email service not connected. Please set up Gmail or Outlook integration."
        });
      }

      res.json({ 
        success: true, 
        message: `Minutes sent to ${recipientEmails.length} attendee${recipientEmails.length !== 1 ? 's' : ''}` 
      });
    } catch (error: any) {
      console.error("Error sending minutes:", error);
      res.status(500).json({ error: "Failed to send meeting minutes", message: error.message });
    }
  });

  // ===== EMAIL INTEGRATION ROUTES =====

  // Get email connection status
  app.get("/api/email/status", async (req, res) => {
    try {
      const { checkGmailStatus, checkOutlookStatus, checkGoogleCalendarStatus } = await import('./email-service');
      
      const [gmail, outlook, googleCalendar] = await Promise.all([
        checkGmailStatus().catch(() => ({ connected: false })),
        checkOutlookStatus().catch(() => ({ connected: false })),
        checkGoogleCalendarStatus().catch(() => ({ connected: false }))
      ]);

      res.json({ 
        gmail,
        outlook,
        googleCalendar,
        setupInstructions: "To connect Gmail or Outlook, use the Integrations panel in the Replit sidebar."
      });
    } catch (error) {
      res.json({ 
        gmail: { connected: false }, 
        outlook: { connected: false },
        googleCalendar: { connected: false },
        setupInstructions: "To connect Gmail or Outlook, use the Integrations panel in the Replit sidebar."
      });
    }
  });

  // Get OAuth connect URL for email providers
  app.get("/api/email/connect/:provider", async (req, res) => {
    try {
      const { provider } = req.params;
      const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
      
      if (!hostname) {
        return res.status(503).json({ 
          error: "Integration not available",
          message: "Please use the Replit Integrations panel to connect your email account."
        });
      }

      const connectorName = provider === 'gmail' ? 'google-mail' : 'outlook';
      
      res.json({
        message: `To connect ${provider === 'gmail' ? 'Gmail' : 'Outlook'}, please use the Replit Integrations panel in the sidebar.`,
        provider,
        connectorName
      });
    } catch (error: any) {
      res.status(500).json({ error: "Failed to get connection info", message: error.message });
    }
  });

  // Sync email data for a provider
  app.post("/api/email/sync/:provider", async (req, res) => {
    try {
      const { provider } = req.params;
      
      if (provider !== 'gmail' && provider !== 'outlook') {
        return res.status(400).json({ error: "Invalid provider" });
      }

      // For now, just verify connection and return success
      const { checkGmailStatus, checkOutlookStatus } = await import('./email-service');
      
      if (provider === 'gmail') {
        const status = await checkGmailStatus();
        if (!status.connected) {
          return res.status(503).json({ error: "Gmail not connected" });
        }
      } else {
        const status = await checkOutlookStatus();
        if (!status.connected) {
          return res.status(503).json({ error: "Outlook not connected" });
        }
      }

      res.json({ success: true, message: `${provider} synced successfully` });
    } catch (error: any) {
      res.status(500).json({ error: "Sync failed", message: error.message });
    }
  });

  // Get calendar events
  app.get("/api/email/calendar/:provider", async (req, res) => {
    try {
      const { provider } = req.params;
      const { start, end } = req.query;
      
      if (!start || !end) {
        return res.status(400).json({ error: "start and end dates are required" });
      }

      const { getGoogleCalendarEvents, getOutlookCalendarEvents } = await import('./email-service');

      let events;
      if (provider === 'gmail' || provider === 'google') {
        events = await getGoogleCalendarEvents(start as string, end as string);
      } else if (provider === 'outlook') {
        events = await getOutlookCalendarEvents(start as string, end as string);
      } else {
        return res.status(400).json({ error: "Invalid provider" });
      }

      res.json(events);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to fetch calendar events", message: error.message });
    }
  });

  // Get contacts
  app.get("/api/email/contacts/:provider", async (req, res) => {
    try {
      const { provider } = req.params;
      const { getGoogleContacts, getOutlookContacts } = await import('./email-service');

      let contacts;
      if (provider === 'gmail' || provider === 'google') {
        contacts = await getGoogleContacts();
      } else if (provider === 'outlook') {
        contacts = await getOutlookContacts();
      } else {
        return res.status(400).json({ error: "Invalid provider" });
      }

      res.json(contacts);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to fetch contacts", message: error.message });
    }
  });

  // Create calendar event
  app.post("/api/email/calendar/:provider/events", async (req, res) => {
    try {
      const { provider } = req.params;
      const { title, description, startTime, endTime, location, attendees } = req.body;

      if (!title || !startTime || !endTime) {
        return res.status(400).json({ error: "title, startTime, and endTime are required" });
      }

      const { createGoogleCalendarEvent, createOutlookCalendarEvent } = await import('./email-service');

      const eventData = { title, description, startTime, endTime, location, attendees };
      
      let event;
      if (provider === 'gmail' || provider === 'google') {
        event = await createGoogleCalendarEvent(eventData);
      } else if (provider === 'outlook') {
        event = await createOutlookCalendarEvent(eventData);
      } else {
        return res.status(400).json({ error: "Invalid provider" });
      }

      res.json(event);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to create calendar event", message: error.message });
    }
  });

  // Send email via specific provider
  app.post("/api/email/send/:provider", async (req, res) => {
    try {
      const { provider } = req.params;
      const { to, subject, body, attachments } = req.body;

      if (!to || !subject || !body) {
        return res.status(400).json({ error: "to, subject, and body are required" });
      }

      const { sendGmailEmail, sendOutlookEmail } = await import('./email-service');
      const recipients = Array.isArray(to) ? to : [to];

      let result;
      if (provider === 'gmail') {
        result = await sendGmailEmail(recipients, subject, body, attachments);
      } else if (provider === 'outlook') {
        result = await sendOutlookEmail(recipients, subject, body, attachments);
      } else {
        return res.status(400).json({ error: "Invalid provider" });
      }

      res.json({ success: true, result });
    } catch (error: any) {
      res.status(500).json({ error: "Failed to send email", message: error.message });
    }
  });

  // Get inbox emails for import
  app.get("/api/email/messages", async (req, res) => {
    try {
      const { search, limit } = req.query;
      const maxResults = parseInt(limit as string) || 20;
      
      const { 
        getGmailEmails, 
        getOutlookEmails, 
        checkGmailStatus, 
        checkOutlookStatus 
      } = await import('./email-service');
      
      // Check which providers are connected
      const [gmailStatus, outlookStatus] = await Promise.all([
        checkGmailStatus().catch(() => ({ connected: false })),
        checkOutlookStatus().catch(() => ({ connected: false }))
      ]);
      
      let emails: any[] = [];
      let provider: string | null = null;
      
      // Try Gmail first, then Outlook
      if (gmailStatus.connected) {
        try {
          emails = await getGmailEmails(maxResults, search as string);
          provider = 'gmail';
        } catch (error) {
          console.log('Gmail fetch failed, trying Outlook');
        }
      }
      
      if (emails.length === 0 && outlookStatus.connected) {
        try {
          emails = await getOutlookEmails(maxResults, search as string);
          provider = 'outlook';
        } catch (error) {
          console.log('Outlook fetch failed');
        }
      }
      
      if (!gmailStatus.connected && !outlookStatus.connected) {
        return res.status(503).json({ 
          error: "No email connected",
          message: "Please connect Gmail or Outlook in Settings to import emails."
        });
      }
      
      res.json({ emails, provider });
    } catch (error: any) {
      res.status(500).json({ error: "Failed to fetch emails", message: error.message });
    }
  });

  // Get email attachment data
  app.get("/api/email/attachment/:provider/:messageId/:attachmentId", async (req, res) => {
    try {
      const { provider, messageId, attachmentId } = req.params;
      
      const { getGmailAttachment, getOutlookAttachment } = await import('./email-service');
      
      let data: string;
      if (provider === 'gmail') {
        data = await getGmailAttachment(messageId, attachmentId);
      } else if (provider === 'outlook') {
        data = await getOutlookAttachment(messageId, attachmentId);
      } else {
        return res.status(400).json({ error: "Invalid provider" });
      }
      
      res.json({ data });
    } catch (error: any) {
      res.status(500).json({ error: "Failed to fetch attachment", message: error.message });
    }
  });

  // Save attachment file from base64 data
  app.post("/api/attachments/upload", async (req, res) => {
    try {
      const { pointId, filename, mimeType, data, size } = req.body;
      
      if (!pointId || !filename || !data) {
        return res.status(400).json({ error: "pointId, filename, and data are required" });
      }
      
      // For now, store the base64 data as a data URL
      // In production, you'd upload to object storage
      const dataUrl = `data:${mimeType || 'application/octet-stream'};base64,${data}`;
      
      // Determine file type
      let type = 'file';
      if (mimeType?.startsWith('image/')) {
        type = 'img';
      } else if (mimeType === 'application/pdf') {
        type = 'pdf';
      } else if (filename.toLowerCase().endsWith('.dwg')) {
        type = 'dwg';
      }
      
      // Create attachment record
      const attachment = await storage.createAttachment({
        pointId,
        name: filename,
        type,
        size: size || `${Math.round(data.length * 0.75 / 1024)} KB`,
        url: dataUrl,
      });
      
      res.json({ success: true, attachment });
    } catch (error: any) {
      res.status(500).json({ error: "Failed to save attachment", message: error.message });
    }
  });

  // ===== CALENDAR EVENTS ROUTES =====
  
  // Get calendar events for import
  app.get("/api/calendar/events", async (req, res) => {
    try {
      const { provider, startDate, endDate, search } = req.query;
      
      if (!provider || !startDate || !endDate) {
        return res.status(400).json({ error: "provider, startDate, and endDate are required" });
      }
      
      const { 
        getGoogleCalendarEvents, 
        getOutlookCalendarEvents,
        checkGoogleCalendarStatus,
        checkOutlookStatus
      } = await import('./email-service');
      
      let events: any[] = [];
      
      if (provider === 'google') {
        const status = await checkGoogleCalendarStatus().catch(() => ({ connected: false }));
        if (!status.connected) {
          return res.status(503).json({ 
            error: "Google Calendar not connected",
            message: "Please connect Google Calendar in the Integrations panel to import calendar events."
          });
        }
        events = await getGoogleCalendarEvents(
          startDate as string, 
          endDate as string, 
          search as string | undefined
        );
      } else if (provider === 'outlook') {
        const status = await checkOutlookStatus().catch(() => ({ connected: false }));
        if (!status.connected) {
          return res.status(503).json({ 
            error: "Outlook Calendar not connected",
            message: "Please connect Outlook in Settings to import calendar events."
          });
        }
        events = await getOutlookCalendarEvents(
          startDate as string, 
          endDate as string, 
          search as string | undefined
        );
      } else {
        return res.status(400).json({ error: "Invalid provider. Use 'google' or 'outlook'" });
      }
      
      res.json({ events, provider });
    } catch (error: any) {
      console.error('Calendar events error:', error);
      res.status(500).json({ error: "Failed to fetch calendar events", message: error.message });
    }
  });
  
  // Get recurring event occurrences
  app.get("/api/calendar/events/:eventId/occurrences", async (req, res) => {
    try {
      const { eventId } = req.params;
      const { provider, startDate, endDate } = req.query;
      
      if (!provider || !startDate || !endDate) {
        return res.status(400).json({ error: "provider, startDate, and endDate are required" });
      }
      
      const { 
        getGoogleRecurringEventOccurrences, 
        getOutlookRecurringEventOccurrences 
      } = await import('./email-service');
      
      let occurrences: any[] = [];
      
      if (provider === 'google') {
        occurrences = await getGoogleRecurringEventOccurrences(
          eventId, 
          startDate as string, 
          endDate as string
        );
      } else if (provider === 'outlook') {
        occurrences = await getOutlookRecurringEventOccurrences(
          eventId, 
          startDate as string, 
          endDate as string
        );
      } else {
        return res.status(400).json({ error: "Invalid provider" });
      }
      
      res.json({ occurrences });
    } catch (error: any) {
      console.error('Calendar occurrences error:', error);
      res.status(500).json({ error: "Failed to fetch occurrences", message: error.message });
    }
  });

  // ===== CALENDAR IMPORT DUPLICATE CHECK =====
  
  // Check if a calendar event was already imported
  app.get("/api/calendar/check-duplicate", async (req, res) => {
    try {
      const { eventId } = req.query;
      
      if (!eventId || typeof eventId !== 'string') {
        return res.status(400).json({ error: "eventId query parameter is required" });
      }
      
      // Check if this event was already imported as a meeting
      const existingMeeting = await storage.getMeetingByCalendarEventId(eventId);
      if (existingMeeting) {
        return res.json({
          isDuplicate: true,
          type: 'meeting',
          entity: existingMeeting,
          message: `This event was already imported as "${existingMeeting.title}"`
        });
      }
      
      // Check if this event was already imported as a series
      const existingSeries = await storage.getMeetingSeriesByCalendarEventId(eventId);
      if (existingSeries) {
        return res.json({
          isDuplicate: true,
          type: 'series',
          entity: existingSeries,
          message: `This event was already imported as recurring series "${existingSeries.title}"`
        });
      }
      
      // Not a duplicate
      return res.json({
        isDuplicate: false,
        type: null,
        entity: null,
        message: null
      });
    } catch (error: any) {
      console.error('Calendar duplicate check error:', error);
      res.status(500).json({ error: "Failed to check for duplicates", message: error.message });
    }
  });

  // ===== ICS FILE IMPORT =====
  
  // Configure multer for ICS file uploads
  const icsUpload = multer({ 
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
    fileFilter: (req, file, cb) => {
      const allowedTypes = ['text/calendar', 'application/ics', 'text/x-vcalendar'];
      const allowedExtensions = ['.ics', '.ical'];
      const ext = file.originalname.toLowerCase().slice(file.originalname.lastIndexOf('.'));
      if (allowedTypes.includes(file.mimetype) || allowedExtensions.includes(ext)) {
        cb(null, true);
      } else {
        cb(new Error('Invalid file type. Only ICS/iCal files are allowed.'));
      }
    }
  });

  // Parse ICS file and return calendar events
  app.post("/api/calendar/import/ics", icsUpload.single('file'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }
      
      const fileContent = req.file.buffer.toString('utf-8');
      const parsedCalendar = ical.parseICS(fileContent);
      
      const events: any[] = [];
      
      for (const key in parsedCalendar) {
        const event = parsedCalendar[key];
        
        if (event.type !== 'VEVENT') continue;
        
        const startDate = event.start;
        const endDate = event.end;
        
        if (!startDate) continue;
        
        const formatDate = (d: Date) => {
          const year = d.getFullYear();
          const month = String(d.getMonth() + 1).padStart(2, '0');
          const day = String(d.getDate()).padStart(2, '0');
          return `${year}-${month}-${day}`;
        };
        
        const formatTime = (d: Date) => {
          const hours = String(d.getHours()).padStart(2, '0');
          const mins = String(d.getMinutes()).padStart(2, '0');
          return `${hours}:${mins}`;
        };
        
        const start = startDate instanceof Date ? startDate : new Date(startDate);
        const end = endDate instanceof Date ? endDate : (endDate ? new Date(endDate) : new Date(start.getTime() + 60 * 60 * 1000));
        
        const attendees: { email: string; name?: string }[] = [];
        if (event.attendee) {
          const attendeeList = Array.isArray(event.attendee) ? event.attendee : [event.attendee];
          for (const att of attendeeList) {
            if (typeof att === 'object' && att.val) {
              const email = att.val.replace('mailto:', '');
              attendees.push({
                email,
                name: att.params?.CN || email.split('@')[0],
              });
            } else if (typeof att === 'string') {
              const email = att.replace('mailto:', '');
              attendees.push({ email });
            }
          }
        }
        
        const isRecurring = !!event.rrule;
        let recurrencePattern = '';
        if (isRecurring && event.rrule) {
          const rrule = event.rrule;
          if (typeof rrule === 'object' && 'freq' in rrule) {
            recurrencePattern = String((rrule as any).freq || 'WEEKLY');
          }
        }
        
        // Extract meeting link from description or location
        let meetingLink = '';
        const linkPatterns = [
          /https?:\/\/[^\s]*(?:zoom\.us|teams\.microsoft\.com|meet\.google\.com|webex\.com)[^\s]*/gi,
        ];
        const searchText = `${event.description || ''} ${event.location || ''}`;
        for (const pattern of linkPatterns) {
          const match = searchText.match(pattern);
          if (match) {
            meetingLink = match[0];
            break;
          }
        }
        
        events.push({
          id: event.uid || `ics-${Date.now()}-${Math.random().toString(36).substring(7)}`,
          title: event.summary || 'Untitled Event',
          description: event.description || '',
          location: event.location || '',
          startDateTime: start.toISOString(),
          endDateTime: end.toISOString(),
          date: formatDate(start),
          startTime: formatTime(start),
          endTime: formatTime(end),
          isRecurring,
          recurrencePattern,
          attendees,
          meetingLink,
          provider: 'ics' as const,
        });
      }
      
      // Sort events by date
      events.sort((a, b) => new Date(a.startDateTime).getTime() - new Date(b.startDateTime).getTime());
      
      res.json(events);
    } catch (error: any) {
      console.error('ICS parse error:', error);
      res.status(500).json({ error: "Failed to parse ICS file", message: error.message });
    }
  });

  // ===== CALENDAR SYNC ROUTES =====
  
  // Sync a single meeting from its linked calendar event
  app.post("/api/meetings/:id/sync-from-calendar", async (req, res) => {
    try {
      const { id } = req.params;
      const meeting = await storage.getMeeting(id);
      
      if (!meeting) {
        return res.status(404).json({ error: "Meeting not found" });
      }
      
      if (!meeting.calendarEventId) {
        return res.status(400).json({ error: "Meeting is not linked to a calendar event" });
      }
      
      // Use calendarProvider if available, otherwise fall back to platform
      const provider = meeting.calendarProvider || (meeting.platform === 'gmail' ? 'google' : 'outlook');
      const { getGoogleCalendarEventById, getOutlookCalendarEventById } = await import('./email-service');
      
      let calendarEvent;
      if (provider === 'google') {
        calendarEvent = await getGoogleCalendarEventById(meeting.calendarEventId);
      } else {
        calendarEvent = await getOutlookCalendarEventById(meeting.calendarEventId);
      }
      
      if (!calendarEvent) {
        // Event was deleted from calendar - flag as removed
        const updated = await storage.updateMeeting(id, { 
          removedFromCalendar: true,
          calendarLastSynced: new Date(),
        });
        return res.json({ 
          meeting: updated, 
          status: 'removed',
          message: 'Meeting was removed from calendar' 
        });
      }
      
      // Update meeting with calendar data
      const updated = await storage.updateMeeting(id, {
        title: calendarEvent.title,
        date: calendarEvent.date,
        startTime: calendarEvent.startTime,
        endTime: calendarEvent.endTime,
        location: calendarEvent.location || meeting.location,
        meetingLink: calendarEvent.meetingLink || meeting.meetingLink,
        calendarLastSynced: new Date(),
        removedFromCalendar: false,
      });
      
      // Sync attendees - update existing or add new ones
      if (calendarEvent.attendees && calendarEvent.attendees.length > 0) {
        const existingAttendees = await storage.getAttendeesByMeeting(id);
        
        for (const att of calendarEvent.attendees) {
          if (att.email) {
            const existing = existingAttendees.find(e => e.email?.toLowerCase() === att.email?.toLowerCase());
            if (!existing) {
              // Add new attendee
              await storage.createAttendee({
                meetingId: id,
                name: att.name || att.email.split('@')[0],
                email: att.email,
                role: 'Participant',
                company: '',
              });
            }
          }
        }
      }
      
      res.json({ 
        meeting: updated, 
        status: 'synced',
        message: 'Meeting synced successfully' 
      });
    } catch (error: any) {
      console.error('Meeting sync error:', error);
      res.status(500).json({ error: "Failed to sync meeting", message: error.message });
    }
  });
  
  // Sync a meeting series from its linked calendar event
  app.post("/api/meeting-series/:id/sync-from-calendar", async (req, res) => {
    try {
      const { id } = req.params;
      const series = await storage.getMeetingSeries(id);
      
      if (!series) {
        return res.status(404).json({ error: "Series not found" });
      }
      
      if (!series.calendarEventId) {
        return res.status(400).json({ error: "Series is not linked to a calendar event" });
      }
      
      // Use calendarProvider if available, otherwise fall back to platform
      const provider = series.calendarProvider || (series.platform === 'gmail' ? 'google' : 'outlook');
      const { 
        getGoogleCalendarEventById, 
        getOutlookCalendarEventById,
        getGoogleRecurringEventOccurrences,
        getOutlookRecurringEventOccurrences
      } = await import('./email-service');
      
      let calendarEvent;
      if (provider === 'google') {
        calendarEvent = await getGoogleCalendarEventById(series.calendarEventId);
      } else {
        calendarEvent = await getOutlookCalendarEventById(series.calendarEventId);
      }
      
      if (!calendarEvent) {
        // Event was deleted from calendar - flag as removed
        const updated = await storage.updateMeetingSeries(id, { 
          removedFromCalendar: true,
          calendarLastSynced: new Date(),
        });
        return res.json({ 
          series: updated, 
          status: 'removed',
          message: 'Series was removed from calendar' 
        });
      }
      
      // Update series with calendar data
      const updated = await storage.updateMeetingSeries(id, {
        title: calendarEvent.title,
        startTime: calendarEvent.startTime,
        endTime: calendarEvent.endTime,
        location: calendarEvent.location || series.location,
        meetingLink: calendarEvent.meetingLink || series.meetingLink,
        recurrenceRule: calendarEvent.recurrenceRule || series.recurrenceRule,
        calendarLastSynced: new Date(),
        removedFromCalendar: false,
      });
      
      // Fetch and sync occurrences
      const startDate = new Date().toISOString().split('T')[0];
      const endDate = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      
      let calendarOccurrences: Array<{ id?: string; date: string; status: string }> = [];
      if (provider === 'google') {
        calendarOccurrences = await getGoogleRecurringEventOccurrences(
          series.calendarEventId, startDate, endDate
        );
      } else {
        calendarOccurrences = await getOutlookRecurringEventOccurrences(
          series.calendarEventId, startDate, endDate
        );
      }
      
      // Get existing occurrences
      const existingOccurrences = await storage.getOccurrencesBySeries(id);
      
      // Update existing or add new occurrences
      for (const occ of calendarOccurrences) {
        const existing = existingOccurrences.find(e => e.date === occ.date);
        if (existing) {
          // Update if status changed
          if (occ.status === 'cancelled' && existing.status !== 'cancelled') {
            await storage.updateMeetingOccurrence(existing.id, { status: 'cancelled' });
          }
        } else {
          // Add new occurrence
          await storage.createMeetingOccurrence({
            seriesId: id,
            date: occ.date,
            status: occ.status === 'cancelled' ? 'cancelled' : 'scheduled',
            calendarOccurrenceId: occ.id,
          });
        }
      }
      
      // Sync attendees
      if (calendarEvent.attendees && calendarEvent.attendees.length > 0) {
        const existingAttendees = await storage.getAttendeesBySeries(id);
        
        for (const att of calendarEvent.attendees) {
          if (att.email) {
            const existing = existingAttendees.find((e: any) => e.email?.toLowerCase() === att.email?.toLowerCase());
            if (!existing) {
              // Add new attendee
              await storage.createSeriesAttendee({
                seriesId: id,
                name: att.name || att.email.split('@')[0],
                email: att.email,
                role: 'Participant',
                company: '',
              });
            }
          }
        }
      }
      
      res.json({ 
        series: updated, 
        status: 'synced',
        message: 'Series synced successfully' 
      });
    } catch (error: any) {
      console.error('Series sync error:', error);
      res.status(500).json({ error: "Failed to sync series", message: error.message });
    }
  });

  // ===== GLOBAL SEARCH ROUTE =====
  
  app.get("/api/search", async (req, res) => {
    try {
      const { q, limit } = req.query;
      if (!q || typeof q !== 'string' || q.trim().length < 2) {
        return res.json({ projects: [], meetings: [], series: [], attendees: [], points: [] });
      }
      const results = await storage.globalSearch(q.trim(), parseInt(limit as string) || 10);
      res.json(results);
    } catch (error) {
      res.status(500).json({ error: "Failed to search" });
    }
  });

  // ===== RBAC ROUTES =====

  // Get current user and permissions
  app.get("/api/auth/me", async (req, res) => {
    try {
      if (!req.currentUser) {
        return res.json({ user: null, permissions: null });
      }
      
      const permissions = getCurrentUserPermissions(req);
      
      // Get company name if user has one
      let companyName: string | null = null;
      if (req.currentUser.companyId) {
        const company = await storage.getCompany(req.currentUser.companyId);
        companyName = company?.name ?? null;
      }
      
      res.json({
        user: {
          id: req.currentUser.id,
          email: req.currentUser.email,
          name: req.currentUser.name,
          roles: req.currentUser.roles,
          companyId: req.currentUser.companyId,
          companyName,
          companyRole: req.currentUser.companyRole,
          projectIds: req.currentUser.projectIds,
          projectRoles: req.currentUser.projectRoles,
        },
        permissions,
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to get current user" });
    }
  });

  // Get available roles
  app.get("/api/roles", async (req, res) => {
    try {
      const roles = roleEnum.enumValues.map(role => ({
        id: role,
        name: ROLE_DISPLAY_NAMES[role],
        description: ROLE_DESCRIPTIONS[role],
      }));
      res.json(roles);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch roles" });
    }
  });

  // Get available company roles
  app.get("/api/company-roles", async (req, res) => {
    try {
      const { companyRoleEnum, COMPANY_ROLE_DISPLAY_NAMES, COMPANY_ROLE_DESCRIPTIONS } = await import("@shared/schema");
      const companyRoles = companyRoleEnum.enumValues.map(role => ({
        id: role,
        name: COMPANY_ROLE_DISPLAY_NAMES[role],
        description: COMPANY_ROLE_DESCRIPTIONS[role],
      }));
      res.json(companyRoles);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch company roles" });
    }
  });

  // ===== COMPANIES ROUTES =====

  app.get("/api/companies", async (req, res) => {
    try {
      const companies = await storage.getAllCompanies();
      res.json(companies);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch companies" });
    }
  });

  // Detect company from email address (must be before :id route)
  app.get("/api/companies/detect-by-email", async (req, res) => {
    try {
      const { email } = req.query;
      if (!email || typeof email !== 'string') {
        return res.status(400).json({ error: "Email address required" });
      }
      
      const domain = extractEmailDomain(email);
      if (!domain || isPublicEmailDomain(domain)) {
        return res.json({ company: null, isPublicDomain: isPublicEmailDomain(domain) });
      }
      
      const company = await storage.getCompanyByEmailDomain(domain);
      res.json({ 
        company: company ? { id: company.id, name: company.name, logo: company.logo } : null,
        emailDomain: domain,
        isPublicDomain: false
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to detect company" });
    }
  });

  app.get("/api/companies/:id", async (req, res) => {
    try {
      const company = await storage.getCompany(req.params.id);
      if (!company) {
        return res.status(404).json({ error: "Company not found" });
      }
      res.json(company);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch company" });
    }
  });

  app.post("/api/companies", requireAuth, requirePermission("users:manage"), async (req, res) => {
    try {
      const validation = insertCompanySchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ error: fromZodError(validation.error).message });
      }
      
      // Auto-set emailDomain from company email if not provided, normalize to lowercase
      const companyData = { ...validation.data };
      if (!companyData.emailDomain && companyData.email) {
        const domain = extractEmailDomain(companyData.email);
        if (domain && !isPublicEmailDomain(domain)) {
          companyData.emailDomain = domain.toLowerCase().trim();
        }
      } else if (companyData.emailDomain) {
        companyData.emailDomain = companyData.emailDomain.toLowerCase().trim();
      }
      
      const company = await storage.createCompany(companyData);
      res.status(201).json(company);
    } catch (error) {
      res.status(500).json({ error: "Failed to create company" });
    }
  });

  app.patch("/api/companies/:id", requireAuth, requirePermission("users:manage"), async (req, res) => {
    try {
      // Auto-set emailDomain from company email if email is being updated, normalize to lowercase
      const updateData = { ...req.body };
      if (updateData.email && !updateData.emailDomain) {
        const domain = extractEmailDomain(updateData.email);
        if (domain && !isPublicEmailDomain(domain)) {
          updateData.emailDomain = domain.toLowerCase().trim();
        }
      } else if (updateData.emailDomain) {
        updateData.emailDomain = updateData.emailDomain.toLowerCase().trim();
      }
      
      const company = await storage.updateCompany(req.params.id, updateData);
      if (!company) {
        return res.status(404).json({ error: "Company not found" });
      }
      res.json(company);
    } catch (error) {
      res.status(500).json({ error: "Failed to update company" });
    }
  });

  app.delete("/api/companies/:id", requireAuth, requirePermission("users:manage"), async (req, res) => {
    try {
      await storage.deleteCompany(req.params.id);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete company" });
    }
  });

  app.get("/api/companies/:id/employees", requireAuth, async (req, res) => {
    try {
      const company = await storage.getCompany(req.params.id);
      if (!company) {
        return res.status(404).json({ error: "Company not found" });
      }
      const employees = await storage.getCompanyEmployees(req.params.id);
      
      const userIds = employees.map(e => e.id);
      const rolesMap = new Map<string, Role[]>();
      for (const userId of userIds) {
        rolesMap.set(userId, await storage.getUserRoles(userId));
      }
      
      const enrichedEmployees = employees.map(user => ({
        ...user,
        roles: rolesMap.get(user.id) || [],
      }));
      
      res.json(enrichedEmployees);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch company employees" });
    }
  });

  app.get("/api/companies/:id/stats", requireAuth, async (req, res) => {
    try {
      const company = await storage.getCompany(req.params.id);
      if (!company) {
        return res.status(404).json({ error: "Company not found" });
      }
      const stats = await storage.getCompanyStats(req.params.id);
      res.json(stats);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch company stats" });
    }
  });

  // ===== COMPANY SELF-SERVICE ROUTES =====

  // Create company for current user (any authenticated user can create their own company)
  app.post("/api/companies/create-own", requireAuth, async (req, res) => {
    try {
      const userId = req.currentUser!.id;
      
      // Check if user already belongs to a company
      const user = await storage.getUser(userId);
      if (user?.companyId) {
        return res.status(400).json({ error: "You already belong to a company" });
      }
      
      const validation = insertCompanySchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ error: fromZodError(validation.error).message });
      }
      
      const company = await storage.createCompanyForUser(userId, validation.data);
      res.status(201).json(company);
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to create company" });
    }
  });

  // Get current user's company details
  app.get("/api/companies/mine", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser(req.currentUser!.id);
      if (!user?.companyId) {
        return res.status(404).json({ error: "You do not belong to a company" });
      }
      
      const company = await storage.getCompany(user.companyId);
      if (!company) {
        return res.status(404).json({ error: "Company not found" });
      }
      
      // Include user's role in the company
      res.json({
        ...company,
        userRole: user.companyRole,
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch company" });
    }
  });

  // Send invitation to join company (owner/admin only)
  app.post("/api/companies/:id/invitations", requireAuth, async (req, res) => {
    try {
      const companyId = req.params.id;
      const userId = req.currentUser!.id;
      
      // Verify user belongs to this company and has permission
      const user = await storage.getUser(userId);
      if (user?.companyId !== companyId) {
        return res.status(403).json({ error: "You do not belong to this company" });
      }
      if (!user.companyRole || !['OWNER', 'ADMIN'].includes(user.companyRole)) {
        return res.status(403).json({ error: "Only owners and admins can send invitations" });
      }
      
      const { email, companyRole } = req.body;
      if (!email) {
        return res.status(400).json({ error: "Email is required" });
      }
      
      // Check if user already exists with this email and belongs to a company
      const existingUser = await storage.getUserByEmail(email);
      if (existingUser?.companyId) {
        return res.status(400).json({ error: "This user already belongs to a company" });
      }
      
      const invitation = await storage.createCompanyInvitation(
        companyId,
        userId,
        email,
        companyRole || 'EMPLOYEE'
      );
      
      res.status(201).json(invitation);
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to send invitation" });
    }
  });

  // Get all invitations for a company (owner/admin only)
  app.get("/api/companies/:id/invitations", requireAuth, async (req, res) => {
    try {
      const companyId = req.params.id;
      const userId = req.currentUser!.id;
      
      // Verify user belongs to this company and has permission
      const user = await storage.getUser(userId);
      if (user?.companyId !== companyId) {
        return res.status(403).json({ error: "You do not belong to this company" });
      }
      if (!user.companyRole || !['OWNER', 'ADMIN'].includes(user.companyRole)) {
        return res.status(403).json({ error: "Only owners and admins can view invitations" });
      }
      
      const invitations = await storage.getCompanyInvitations(companyId);
      res.json(invitations);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch invitations" });
    }
  });

  // Cancel an invitation (owner/admin only)
  app.delete("/api/companies/:id/invitations/:invitationId", requireAuth, async (req, res) => {
    try {
      const companyId = req.params.id;
      const invitationId = req.params.invitationId;
      const userId = req.currentUser!.id;
      
      // Verify user belongs to this company and has permission
      const user = await storage.getUser(userId);
      if (user?.companyId !== companyId) {
        return res.status(403).json({ error: "You do not belong to this company" });
      }
      if (!user.companyRole || !['OWNER', 'ADMIN'].includes(user.companyRole)) {
        return res.status(403).json({ error: "Only owners and admins can cancel invitations" });
      }
      
      await storage.cancelInvitation(invitationId);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to cancel invitation" });
    }
  });

  // Get pending invitations for current user
  app.get("/api/invitations/pending", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser(req.currentUser!.id);
      if (!user?.email) {
        return res.json([]);
      }
      
      const invitations = await storage.getUserPendingInvitations(user.email);
      res.json(invitations);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch invitations" });
    }
  });

  // Accept an invitation
  app.post("/api/invitations/:token/accept", requireAuth, async (req, res) => {
    try {
      const token = req.params.token;
      const userId = req.currentUser!.id;
      
      // Check if user already belongs to a company
      const user = await storage.getUser(userId);
      if (user?.companyId) {
        return res.status(400).json({ error: "You already belong to a company" });
      }
      
      // Verify invitation is for this user's email
      const invitation = await storage.getInvitationByToken(token);
      if (!invitation) {
        return res.status(404).json({ error: "Invitation not found or expired" });
      }
      if (invitation.email.toLowerCase() !== user?.email?.toLowerCase()) {
        return res.status(403).json({ error: "This invitation is not for your email address" });
      }
      
      await storage.acceptInvitation(token, userId);
      res.json({ message: "Invitation accepted successfully" });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to accept invitation" });
    }
  });

  // Decline an invitation
  app.post("/api/invitations/:token/decline", requireAuth, async (req, res) => {
    try {
      const token = req.params.token;
      const userId = req.currentUser!.id;
      
      // Verify invitation is for this user's email
      const user = await storage.getUser(userId);
      const invitation = await storage.getInvitationByToken(token);
      if (!invitation) {
        return res.status(404).json({ error: "Invitation not found or expired" });
      }
      if (invitation.email.toLowerCase() !== user?.email?.toLowerCase()) {
        return res.status(403).json({ error: "This invitation is not for your email address" });
      }
      
      await storage.declineInvitation(token);
      res.json({ message: "Invitation declined" });
    } catch (error) {
      res.status(500).json({ error: "Failed to decline invitation" });
    }
  });

  // ===== USERS ROUTES =====

  app.get("/api/users", async (req, res) => {
    try {
      const users = await storage.getAllUsers();
      
      // Enrich with roles and company info
      const enrichedUsers = await Promise.all(users.map(async (user) => {
        const [roles, company] = await Promise.all([
          storage.getUserRoles(user.id),
          user.companyId ? storage.getCompany(user.companyId) : Promise.resolve(null),
        ]);
        return {
          ...user,
          roles,
          companyName: company?.name ?? null,
        };
      }));
      
      res.json(enrichedUsers);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch users" });
    }
  });

  // Global user search/directory endpoint (requires authentication)
  app.get("/api/users/search", requireAuth, async (req, res) => {
    try {
      const { q, limit } = req.query;
      if (!q || typeof q !== 'string') {
        return res.status(400).json({ error: "Search query required" });
      }
      
      const users = await storage.searchUsers(q, limit ? parseInt(limit as string, 10) : 20);
      
      // Enrich with company info
      const enrichedUsers = await Promise.all(users.map(async (user) => {
        const company = user.companyId ? await storage.getCompany(user.companyId) : null;
        return {
          id: user.id,
          name: user.name,
          email: user.email,
          avatar: user.avatar,
          companyId: user.companyId,
          companyName: company?.name ?? null,
          isActive: user.isActive,
        };
      }));
      
      res.json(enrichedUsers);
    } catch (error) {
      res.status(500).json({ error: "Failed to search users" });
    }
  });

  app.get("/api/users/:id", async (req, res) => {
    try {
      const userContext = await storage.getUserWithContext(req.params.id);
      if (!userContext) {
        return res.status(404).json({ error: "User not found" });
      }
      
      // Get user's projects
      const userProjects = await storage.getUserProjects(req.params.id);
      
      res.json({
        ...userContext.user,
        roles: userContext.roles,
        companyName: userContext.company?.name ?? null,
        projects: userProjects,
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch user" });
    }
  });

  app.post("/api/users", requireAuth, requirePermission("users:manage"), async (req, res) => {
    try {
      const { roles, projectIds, ...userData } = req.body;
      
      const validation = insertUserSchema.safeParse(userData);
      if (!validation.success) {
        return res.status(400).json({ error: fromZodError(validation.error).message });
      }
      
      // Check for duplicate email
      const existing = await storage.getUserByEmail(validation.data.email);
      if (existing) {
        return res.status(400).json({ error: "A user with this email already exists" });
      }
      
      const user = await storage.createUser(validation.data);
      
      // Set roles if provided
      if (roles && Array.isArray(roles) && roles.length > 0) {
        await storage.setUserRoles(user.id, roles);
      }
      
      // Assign to projects if provided
      if (projectIds && Array.isArray(projectIds)) {
        for (const projectId of projectIds) {
          await storage.addUserToProject(user.id, projectId);
        }
      }
      
      const userContext = await storage.getUserWithContext(user.id);
      res.status(201).json({
        ...user,
        roles: userContext?.roles ?? [],
        projectIds: userContext?.projectIds ?? [],
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to create user" });
    }
  });

  app.patch("/api/users/:id", requireAuth, requirePermission("users:manage"), async (req, res) => {
    try {
      const { roles, projectIds, ...userData } = req.body;
      
      const user = await storage.updateUser(req.params.id, userData);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      
      // Update roles if provided
      if (roles !== undefined && Array.isArray(roles)) {
        await storage.setUserRoles(user.id, roles);
      }
      
      // Update project assignments if provided
      if (projectIds !== undefined && Array.isArray(projectIds)) {
        // Get current project assignments
        const currentProjectIds = await storage.getUserProjectIds(user.id);
        
        // Remove from projects no longer assigned
        for (const projectId of currentProjectIds) {
          if (!projectIds.includes(projectId)) {
            await storage.removeUserFromProject(user.id, projectId);
          }
        }
        
        // Add to new projects
        for (const projectId of projectIds) {
          if (!currentProjectIds.includes(projectId)) {
            await storage.addUserToProject(user.id, projectId);
          }
        }
      }
      
      const userContext = await storage.getUserWithContext(user.id);
      res.json({
        ...user,
        roles: userContext?.roles ?? [],
        projectIds: userContext?.projectIds ?? [],
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to update user" });
    }
  });

  app.delete("/api/users/:id", requireAuth, requirePermission("users:manage"), async (req, res) => {
    try {
      await storage.deleteUser(req.params.id);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete user" });
    }
  });

  // ===== USER ROLE MANAGEMENT =====

  app.post("/api/users/:id/roles", requireAuth, requirePermission("users:manage"), async (req, res) => {
    try {
      const { role } = req.body;
      if (!role || !roleEnum.enumValues.includes(role)) {
        return res.status(400).json({ error: "Invalid role" });
      }
      
      const userRole = await storage.addUserRole(req.params.id, role);
      res.status(201).json(userRole);
    } catch (error) {
      res.status(500).json({ error: "Failed to add role" });
    }
  });

  app.delete("/api/users/:id/roles/:role", requireAuth, requirePermission("users:manage"), async (req, res) => {
    try {
      await storage.removeUserRole(req.params.id, req.params.role as any);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to remove role" });
    }
  });

  // ===== USER PROJECT ASSIGNMENTS =====

  app.get("/api/users/:id/projects", async (req, res) => {
    try {
      const projects = await storage.getUserProjects(req.params.id);
      res.json(projects);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch user projects" });
    }
  });

  app.post("/api/users/:id/projects", requireAuth, requirePermission("users:manage"), async (req, res) => {
    try {
      const { projectId, projectRole } = req.body;
      if (!projectId) {
        return res.status(400).json({ error: "projectId is required" });
      }
      
      // Check if already assigned
      const isAssigned = await storage.isUserInProject(req.params.id, projectId);
      if (isAssigned) {
        return res.status(400).json({ error: "User is already assigned to this project" });
      }
      
      const projectUser = await storage.addUserToProject(req.params.id, projectId, projectRole);
      res.status(201).json(projectUser);
    } catch (error) {
      res.status(500).json({ error: "Failed to assign user to project" });
    }
  });

  app.patch("/api/users/:id/projects/:projectId", requireAuth, requirePermission("users:manage"), async (req, res) => {
    try {
      const { projectRole } = req.body;
      if (!projectRole) {
        return res.status(400).json({ error: "projectRole is required" });
      }
      
      const projectUser = await storage.updateUserProjectRole(req.params.id, req.params.projectId, projectRole);
      if (!projectUser) {
        return res.status(404).json({ error: "User is not assigned to this project" });
      }
      res.json(projectUser);
    } catch (error) {
      res.status(500).json({ error: "Failed to update project role" });
    }
  });

  app.delete("/api/users/:id/projects/:projectId", requireAuth, requirePermission("users:manage"), async (req, res) => {
    try {
      await storage.removeUserFromProject(req.params.id, req.params.projectId);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to remove user from project" });
    }
  });

  // ===== USER PROFILE STATS =====

  // Get user stats (KPIs) - requires auth, user can only view their own stats unless admin
  app.get("/api/users/:id/stats", requireAuth, async (req, res) => {
    try {
      const isSelf = req.currentUser!.id === req.params.id;
      const isAdmin = hasPermission(req.currentUser!, "users:manage");
      
      if (!isSelf && !isAdmin) {
        return res.status(403).json({ error: "You can only view your own stats" });
      }
      
      const user = await storage.getUser(req.params.id);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      const stats = await storage.getUserStats(req.params.id, user.email);
      res.json(stats);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch user stats" });
    }
  });

  // Get points assigned to user - requires auth, user can only view their own points unless admin
  app.get("/api/users/:id/assigned-points", requireAuth, async (req, res) => {
    try {
      const isSelf = req.currentUser!.id === req.params.id;
      const isAdmin = hasPermission(req.currentUser!, "users:manage");
      
      if (!isSelf && !isAdmin) {
        return res.status(403).json({ error: "You can only view your own assigned points" });
      }
      
      const user = await storage.getUser(req.params.id);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      const points = await storage.getPointsAssignedToUser(req.params.id, user.email);
      res.json(points);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch assigned points" });
    }
  });

  // ===== ROLE PERMISSIONS (configurable permission matrix) =====

  // Get the default permission matrix configuration
  app.get("/api/role-permissions/config", async (req, res) => {
    try {
      res.json({
        actions: ALL_PERMISSION_ACTIONS,
        labels: PERMISSION_ACTION_LABELS,
        categories: PERMISSION_CATEGORIES,
        defaults: DEFAULT_PERMISSION_MATRIX,
        roles: roleEnum.enumValues,
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch permission config" });
    }
  });

  // Get all role permissions (returns configured overrides)
  app.get("/api/role-permissions", async (req, res) => {
    try {
      const permissions = await storage.getRolePermissions();
      res.json(permissions);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch role permissions" });
    }
  });

  // Update role permissions (bulk upsert)
  app.patch("/api/role-permissions", requireAuth, requirePermission("users:manage"), async (req, res) => {
    try {
      const { permissions } = req.body;
      if (!Array.isArray(permissions)) {
        return res.status(400).json({ error: "Permissions must be an array" });
      }
      
      const result = await storage.bulkUpsertRolePermissions(permissions);
      
      // Refresh the effective permission matrix cache
      const allOverrides = await storage.getRolePermissions();
      updateEffectivePermissionMatrix(allOverrides);
      
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: "Failed to update role permissions" });
    }
  });

  // ===== PROJECT USERS (users assigned to a project) =====

  app.get("/api/projects/:id/users", async (req, res) => {
    try {
      const users = await storage.getProjectUsers(req.params.id);
      
      // Enrich with roles and company name
      const enrichedUsers = await Promise.all(users.map(async (user) => {
        const roles = await storage.getUserRoles(user.id);
        let companyName: string | null = null;
        if (user.companyId) {
          const company = await storage.getCompany(user.companyId);
          companyName = company?.name || null;
        }
        return { ...user, roles, companyName };
      }));
      
      res.json(enrichedUsers);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch project users" });
    }
  });

  // ===== ATTENDEE-USER SYNC =====

  // Sync all unlinked attendees to users (creates new users as VIEWER)
  // Auth is optional only when no users exist (initial setup)
  app.post("/api/attendees/sync-all", async (req, res) => {
    try {
      // Check if any users exist - if so, require proper authentication via middleware
      const existingUsers = await storage.getAllUsers();
      if (existingUsers.length > 0) {
        // Use the same auth mechanism as other protected routes
        // req.currentUser is populated by the authMiddleware
        if (!req.currentUser) {
          return res.status(401).json({ error: "Authentication required" });
        }
        // Check for users:manage permission (BIM_MANAGER role)
        const canManage = hasPermission(req.currentUser, 'users:manage');
        if (!canManage) {
          return res.status(403).json({ error: "You need the 'users:manage' permission to sync attendees" });
        }
      }
      
      const result = await storage.syncAllAttendeesToUsers();
      res.json({ 
        message: `Synced ${result.synced} attendees, created ${result.created} new users`,
        ...result 
      });
    } catch (error) {
      console.error("Failed to sync attendees:", error);
      res.status(500).json({ error: "Failed to sync attendees to users" });
    }
  });

  // Sync a single attendee to user
  app.post("/api/attendees/:id/sync", requireAuth, async (req, res) => {
    try {
      const result = await storage.syncAttendeeToUser(req.params.id);
      res.json(result);
    } catch (error) {
      console.error("Failed to sync attendee:", error);
      res.status(500).json({ error: "Failed to sync attendee to user" });
    }
  });

  // Sync a single series attendee to user
  app.post("/api/series-attendees/:id/sync", requireAuth, async (req, res) => {
    try {
      const result = await storage.syncSeriesAttendeeToUser(req.params.id);
      res.json(result);
    } catch (error) {
      console.error("Failed to sync series attendee:", error);
      res.status(500).json({ error: "Failed to sync series attendee to user" });
    }
  });

  // Update attendee with user roles
  app.patch("/api/attendees/:id/user-roles", requireAuth, requirePermission("users:manage"), async (req, res) => {
    try {
      const { roles } = req.body;
      if (!roles || !Array.isArray(roles)) {
        return res.status(400).json({ error: "roles array is required" });
      }

      // Get attendee and ensure it's linked to a user
      const attendee = await storage.getAttendee(req.params.id);
      if (!attendee) {
        return res.status(404).json({ error: "Attendee not found" });
      }

      // If not linked, sync first
      let userId = attendee.userId;
      if (!userId) {
        const syncResult = await storage.syncAttendeeToUser(req.params.id);
        userId = syncResult.user.id;
      }

      // Update user roles
      await storage.setUserRoles(userId!, roles);
      const updatedRoles = await storage.getUserRoles(userId!);
      
      res.json({ userId, roles: updatedRoles });
    } catch (error) {
      console.error("Failed to update attendee user roles:", error);
      res.status(500).json({ error: "Failed to update user roles" });
    }
  });

  // Update series attendee with user roles
  app.patch("/api/series-attendees/:id/user-roles", requireAuth, requirePermission("users:manage"), async (req, res) => {
    try {
      const { roles } = req.body;
      if (!roles || !Array.isArray(roles)) {
        return res.status(400).json({ error: "roles array is required" });
      }

      // Get series attendee and ensure it's linked to a user
      const attendee = await storage.getSeriesAttendee(req.params.id);
      if (!attendee) {
        return res.status(404).json({ error: "Series attendee not found" });
      }

      // If not linked, sync first
      let userId = attendee.userId;
      if (!userId) {
        const syncResult = await storage.syncSeriesAttendeeToUser(req.params.id);
        userId = syncResult.user.id;
      }

      // Update user roles
      await storage.setUserRoles(userId!, roles);
      const updatedRoles = await storage.getUserRoles(userId!);
      
      res.json({ userId, roles: updatedRoles });
    } catch (error) {
      console.error("Failed to update series attendee user roles:", error);
      res.status(500).json({ error: "Failed to update user roles" });
    }
  });

  // ===== DISCIPLINES ROUTES =====

  // Get all disciplines (read-only, pre-seeded)
  app.get("/api/disciplines", async (req, res) => {
    try {
      const allDisciplines = await storage.getAllDisciplines();
      res.json(allDisciplines);
    } catch (error) {
      console.error("Failed to fetch disciplines:", error);
      res.status(500).json({ error: "Failed to fetch disciplines" });
    }
  });

  // Helper to validate discipline codes against master list
  const validateDisciplineCodes = async (codes: string[]): Promise<string[]> => {
    const allDisciplines = await storage.getAllDisciplines();
    const validCodes = new Set(allDisciplines.map(d => d.code));
    return codes.filter(code => validCodes.has(code));
  };

  // Get disciplines for a point (public read-only metadata)
  app.get("/api/points/:pointId/disciplines", async (req, res) => {
    try {
      const disciplineCodes = await storage.getPointDisciplines(req.params.pointId);
      res.json(disciplineCodes);
    } catch (error) {
      console.error("Failed to fetch point disciplines:", error);
      res.status(500).json({ error: "Failed to fetch point disciplines" });
    }
  });

  // Set disciplines for a point
  app.put("/api/points/:pointId/disciplines", requireAuth, requirePermission("points:edit:any"), async (req, res) => {
    try {
      const { disciplines: disciplineCodes } = req.body;
      if (!Array.isArray(disciplineCodes)) {
        return res.status(400).json({ error: "disciplines array is required" });
      }
      
      // Validate codes exist in master list
      const validCodes = await validateDisciplineCodes(disciplineCodes);
      
      await storage.setPointDisciplines(req.params.pointId, validCodes);
      res.json({ success: true, disciplines: validCodes });
    } catch (error) {
      console.error("Failed to set point disciplines:", error);
      res.status(500).json({ error: "Failed to set point disciplines" });
    }
  });

  // Get disciplines for a meeting (public read-only metadata)
  app.get("/api/meetings/:meetingId/disciplines", async (req, res) => {
    try {
      const disciplineCodes = await storage.getMeetingDisciplines(req.params.meetingId);
      res.json(disciplineCodes);
    } catch (error) {
      console.error("Failed to fetch meeting disciplines:", error);
      res.status(500).json({ error: "Failed to fetch meeting disciplines" });
    }
  });

  // Set disciplines for a meeting
  app.put("/api/meetings/:meetingId/disciplines", requireAuth, requirePermission("meetings:edit"), async (req, res) => {
    try {
      const { disciplines: disciplineCodes } = req.body;
      if (!Array.isArray(disciplineCodes)) {
        return res.status(400).json({ error: "disciplines array is required" });
      }
      
      // Validate codes exist in master list
      const validCodes = await validateDisciplineCodes(disciplineCodes);
      
      await storage.setMeetingDisciplines(req.params.meetingId, validCodes);
      res.json({ success: true, disciplines: validCodes });
    } catch (error) {
      console.error("Failed to set meeting disciplines:", error);
      res.status(500).json({ error: "Failed to set meeting disciplines" });
    }
  });

  // Get disciplines for a series (public read-only metadata)
  app.get("/api/series/:seriesId/disciplines", async (req, res) => {
    try {
      const disciplineCodes = await storage.getSeriesDisciplines(req.params.seriesId);
      res.json(disciplineCodes);
    } catch (error) {
      console.error("Failed to fetch series disciplines:", error);
      res.status(500).json({ error: "Failed to fetch series disciplines" });
    }
  });

  // Set disciplines for a series
  app.put("/api/series/:seriesId/disciplines", requireAuth, requirePermission("meetings:edit"), async (req, res) => {
    try {
      const { disciplines: disciplineCodes } = req.body;
      if (!Array.isArray(disciplineCodes)) {
        return res.status(400).json({ error: "disciplines array is required" });
      }
      
      // Validate codes exist in master list
      const validCodes = await validateDisciplineCodes(disciplineCodes);
      
      await storage.setSeriesDisciplines(req.params.seriesId, validCodes);
      res.json({ success: true, disciplines: validCodes });
    } catch (error) {
      console.error("Failed to set series disciplines:", error);
      res.status(500).json({ error: "Failed to set series disciplines" });
    }
  });

  return httpServer;
}
