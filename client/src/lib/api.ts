import type { 
  Meeting, 
  InsertMeeting, 
  Point, 
  InsertPoint, 
  Attendee, 
  InsertAttendee,
  StatusUpdate,
  InsertStatusUpdate,
  Attachment,
  InsertAttachment,
  Project,
  InsertProject,
  MeetingSeries,
  InsertMeetingSeries,
  MeetingOccurrence,
  InsertMeetingOccurrence,
  SeriesAttendee,
  InsertSeriesAttendee
} from "@shared/schema";
import type { PointWithRelations } from "./types";

const API_BASE = "/api";

// Helper function to get dev auth headers from localStorage
function getDevAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = {};
  const devUserId = localStorage.getItem("dev-user-id");
  const devUserEmail = localStorage.getItem("dev-user-email");
  
  if (devUserId) {
    headers["x-dev-user-id"] = devUserId;
  }
  if (devUserEmail) {
    headers["x-dev-user-email"] = devUserEmail;
  }
  return headers;
}

// Helper function for API calls
async function apiCall<T>(url: string, options?: RequestInit): Promise<T> {
  // Extract headers from options to prevent them from being overwritten
  const { headers: optionHeaders, ...restOptions } = options || {};
  
  // Merge all headers properly
  const mergedHeaders: Record<string, string> = {
    "Content-Type": "application/json",
    ...getDevAuthHeaders(),
  };
  
  // Add any additional headers from options
  if (optionHeaders) {
    if (optionHeaders instanceof Headers) {
      optionHeaders.forEach((value, key) => {
        mergedHeaders[key] = value;
      });
    } else if (Array.isArray(optionHeaders)) {
      optionHeaders.forEach(([key, value]) => {
        mergedHeaders[key] = value;
      });
    } else {
      Object.assign(mergedHeaders, optionHeaders);
    }
  }
  
  const response = await fetch(`${API_BASE}${url}`, {
    credentials: 'include',
    ...restOptions,
    headers: mergedHeaders,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: "Request failed" }));
    throw new Error(error.error || "Request failed");
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json();
}

// Projects API
export interface ProjectFilters {
  city?: string;
  country?: string;
  status?: string;
  search?: string;
}

export interface ProjectWithMeetings extends Project {
  meetings: Meeting[];
}

export interface ProjectUser {
  id: string;
  name: string;
  email: string;
  companyId: string | null;
  companyRole: string | null;
  companyName?: string | null;
  projectRole?: string | null;
  avatar: string | null;
  isActive: boolean;
  roles: string[];
}

export interface FilterOptions {
  cities: string[];
  countries: string[];
}

export interface DashboardStats {
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
}

export const dashboardApi = {
  getStats: () => apiCall<DashboardStats>('/dashboard/stats'),
};

export const projectsApi = {
  getAll: (filters?: ProjectFilters) => {
    const params = new URLSearchParams();
    if (filters?.city) params.set('city', filters.city);
    if (filters?.country) params.set('country', filters.country);
    if (filters?.status) params.set('status', filters.status);
    if (filters?.search) params.set('search', filters.search);
    const query = params.toString();
    return apiCall<Project[]>(`/projects${query ? `?${query}` : ''}`);
  },
  
  getById: (id: string) => apiCall<ProjectWithMeetings>(`/projects/${id}`),
  
  getFilterOptions: () => apiCall<FilterOptions>('/projects/filters'),
  
  getMeetingCounts: () => apiCall<Record<string, number>>('/projects/meeting-counts'),
  
  create: (project: InsertProject) =>
    apiCall<Project>("/projects", {
      method: "POST",
      body: JSON.stringify(project),
    }),
  
  update: (id: string, project: Partial<InsertProject>) =>
    apiCall<Project>(`/projects/${id}`, {
      method: "PATCH",
      body: JSON.stringify(project),
    }),
  
  delete: (id: string) =>
    apiCall<void>(`/projects/${id}`, {
      method: "DELETE",
    }),
    
  getUsers: (projectId: string) => 
    apiCall<ProjectUser[]>(`/projects/${projectId}/users`),
    
  addUser: (projectId: string, userId: string, projectRole?: string) =>
    apiCall<any>(`/users/${userId}/projects`, {
      method: "POST",
      body: JSON.stringify({ projectId, projectRole }),
    }),
    
  updateUserRole: (projectId: string, userId: string, projectRole: string) =>
    apiCall<any>(`/users/${userId}/projects/${projectId}`, {
      method: "PATCH",
      body: JSON.stringify({ projectRole }),
    }),
    
  removeUser: (projectId: string, userId: string) =>
    apiCall<void>(`/users/${userId}/projects/${projectId}`, {
      method: "DELETE",
    }),
    
  getPoints: (projectId: string) =>
    apiCall<(Point & { meetingTitle?: string; seriesTitle?: string })[]>(`/projects/${projectId}/points`),
    
  getFiles: (projectId: string) =>
    apiCall<(Attachment & { pointTitle: string; meetingTitle?: string; seriesTitle?: string })[]>(`/projects/${projectId}/files`),
};

// Meetings API
export interface MeetingFilters {
  projectId?: string;
  projectIds?: string[];
  city?: string;
  search?: string;
  sortBy?: 'date' | 'project' | 'title';
  sortOrder?: 'asc' | 'desc';
  status?: 'scheduled' | 'closed' | 'all';
}

export interface MeetingFilterOptions {
  locations: string[];
  cities: string[];
  projects: { id: string; name: string }[];
}

export const meetingsApi = {
  getAll: (filters?: MeetingFilters) => {
    const params = new URLSearchParams();
    if (filters?.projectId) params.set('projectId', filters.projectId);
    if (filters?.projectIds && filters.projectIds.length > 0) {
      params.set('projectIds', filters.projectIds.join(','));
    }
    if (filters?.city) params.set('city', filters.city);
    if (filters?.search) params.set('search', filters.search);
    if (filters?.sortBy) params.set('sortBy', filters.sortBy);
    if (filters?.sortOrder) params.set('sortOrder', filters.sortOrder);
    if (filters?.status) params.set('status', filters.status);
    const query = params.toString();
    return apiCall<Meeting[]>(`/meetings${query ? `?${query}` : ''}`);
  },
  
  getById: (id: string) => apiCall<Meeting>(`/meetings/${id}`),
  
  getByProject: (projectId: string) => apiCall<Meeting[]>(`/projects/${projectId}/meetings`),
  
  getFilterOptions: () => apiCall<MeetingFilterOptions>('/meetings/filters'),
  
  getPointCounts: () => apiCall<Record<string, number>>('/meetings/point-counts'),
  
  getAttendeeCounts: () => apiCall<Record<string, number>>('/meetings/attendee-counts'),

  async getFullMeeting(id: string) {
    const [meeting, attendees, points] = await Promise.all([
      apiCall<Meeting>(`/meetings/${id}`),
      apiCall<Attendee[]>(`/meetings/${id}/attendees`),
      apiCall<Point[]>(`/meetings/${id}/points`),
    ]);
    
    return { ...meeting, attendees, points };
  },
  
  create: (meeting: InsertMeeting) => 
    apiCall<Meeting>("/meetings", {
      method: "POST",
      body: JSON.stringify(meeting),
    }),
  
  update: (id: string, meeting: Partial<InsertMeeting>) =>
    apiCall<Meeting>(`/meetings/${id}`, {
      method: "PATCH",
      body: JSON.stringify(meeting),
    }),
  
  delete: (id: string) =>
    apiCall<void>(`/meetings/${id}`, {
      method: "DELETE",
    }),
};

// Attendees API
export const attendeesApi = {
  getByMeeting: (meetingId: string) => 
    apiCall<Attendee[]>(`/meetings/${meetingId}/attendees`),
  
  create: (attendee: InsertAttendee) =>
    apiCall<Attendee>("/attendees", {
      method: "POST",
      body: JSON.stringify(attendee),
    }),
};

// Points API
export const pointsApi = {
  getByMeeting: (meetingId: string) =>
    apiCall<PointWithRelations[]>(`/meetings/${meetingId}/points`),
  
  getById: (id: string) =>
    apiCall<Point>(`/points/${id}`),
  
  create: (point: InsertPoint) =>
    apiCall<Point>("/points", {
      method: "POST",
      body: JSON.stringify(point),
    }),
  
  update: (id: string, point: Partial<InsertPoint>) =>
    apiCall<Point>(`/points/${id}`, {
      method: "PATCH",
      body: JSON.stringify(point),
    }),
  
  delete: (id: string) =>
    apiCall<void>(`/points/${id}`, {
      method: "DELETE",
    }),
};

// Status Updates API
export const statusUpdatesApi = {
  getByPoint: (pointId: string) =>
    apiCall<StatusUpdate[]>(`/points/${pointId}/updates`),
  
  create: (update: InsertStatusUpdate) =>
    apiCall<StatusUpdate>("/status-updates", {
      method: "POST",
      body: JSON.stringify(update),
    }),
};

// Attachments API
export const attachmentsApi = {
  getByPoint: (pointId: string) =>
    apiCall<Attachment[]>(`/points/${pointId}/attachments`),
  
  create: (attachment: InsertAttachment) =>
    apiCall<Attachment>("/attachments", {
      method: "POST",
      body: JSON.stringify(attachment),
    }),
};

// Meeting Series API (recurring meetings)
export interface MeetingSeriesWithRelations extends MeetingSeries {
  occurrences: MeetingOccurrence[];
  points: PointWithRelations[];
}

export interface SeriesFilters {
  projectId?: string;
  projectIds?: string[];
  status?: 'active' | 'closed' | 'all';
}

export const meetingSeriesApi = {
  getAll: (filters?: SeriesFilters | string) => {
    const params = new URLSearchParams();
    if (typeof filters === 'string') {
      params.set('projectId', filters);
    } else if (filters) {
      if (filters.projectId) params.set('projectId', filters.projectId);
      if (filters.projectIds && filters.projectIds.length > 0) {
        params.set('projectIds', filters.projectIds.join(','));
      }
      if (filters.status) params.set('status', filters.status);
    }
    const query = params.toString();
    return apiCall<MeetingSeries[]>(`/meeting-series${query ? `?${query}` : ''}`);
  },
  
  getById: (id: string) => apiCall<MeetingSeriesWithRelations>(`/meeting-series/${id}`),
  
  create: (series: InsertMeetingSeries) =>
    apiCall<MeetingSeries>("/meeting-series", {
      method: "POST",
      body: JSON.stringify(series),
    }),
  
  update: (id: string, series: Partial<InsertMeetingSeries>) =>
    apiCall<MeetingSeries>(`/meeting-series/${id}`, {
      method: "PATCH",
      body: JSON.stringify(series),
    }),
  
  delete: (id: string) =>
    apiCall<void>(`/meeting-series/${id}`, {
      method: "DELETE",
    }),
  
  getOccurrences: (seriesId: string) =>
    apiCall<MeetingOccurrence[]>(`/meeting-series/${seriesId}/occurrences`),
  
  getPoints: (seriesId: string) =>
    apiCall<PointWithRelations[]>(`/meeting-series/${seriesId}/points`),
  
  getAttendeeCounts: () => apiCall<Record<string, number>>('/meeting-series/attendee-counts'),
  
  getPointCounts: () => apiCall<Record<string, number>>('/meeting-series/point-counts'),
};

// Meeting Occurrences API
export const meetingOccurrencesApi = {
  create: (occurrence: InsertMeetingOccurrence) =>
    apiCall<MeetingOccurrence>("/meeting-occurrences", {
      method: "POST",
      body: JSON.stringify(occurrence),
    }),
  
  update: (id: string, occurrence: Partial<InsertMeetingOccurrence>) =>
    apiCall<MeetingOccurrence>(`/meeting-occurrences/${id}`, {
      method: "PATCH",
      body: JSON.stringify(occurrence),
    }),
};

// Series Attendees API
export const seriesAttendeesApi = {
  getBySeries: (seriesId: string) => 
    apiCall<SeriesAttendee[]>(`/meeting-series/${seriesId}/attendees`),
  
  create: (attendee: InsertSeriesAttendee) =>
    apiCall<SeriesAttendee>("/series-attendees", {
      method: "POST",
      body: JSON.stringify(attendee),
    }),
    
  update: (id: string, attendee: Partial<InsertSeriesAttendee>) =>
    apiCall<SeriesAttendee>(`/series-attendees/${id}`, {
      method: "PATCH",
      body: JSON.stringify(attendee),
    }),
    
  delete: (id: string) =>
    apiCall<void>(`/series-attendees/${id}`, {
      method: "DELETE",
    }),
};

// Move Points API
export const movePointsApi = {
  getUnresolvedPoints: (meetingId: string) =>
    apiCall<Point[]>(`/meetings/${meetingId}/unresolved-points`),
  
  movePoints: (meetingId: string, pointIds: string[], targetMeetingId: string) =>
    apiCall<{ success: boolean; targetMeetingId: string }>(`/meetings/${meetingId}/move-points`, {
      method: "POST",
      body: JSON.stringify({ pointIds, targetMeetingId }),
    }),
  
  movePointsToNewMeeting: (meetingId: string, pointIds: string[], newMeetingData: InsertMeeting) =>
    apiCall<{ success: boolean; targetMeetingId: string }>(`/meetings/${meetingId}/move-points`, {
      method: "POST",
      body: JSON.stringify({ pointIds, createNewMeeting: newMeetingData }),
    }),
  
  getNextMeeting: (meetingId: string) =>
    apiCall<Meeting | null>(`/meetings/${meetingId}/next-in-project`),
};

// Search API
export interface SearchAttendee {
  id: string;
  meetingId?: string;
  seriesId?: string;
  name: string;
  email: string | null;
  role: string;
  company: string | null;
  avatar: string | null;
}

export interface SearchPoint {
  id: string;
  meetingId: string | null;
  seriesId: string | null;
  title: string;
  description: string | null;
  status: string;
  assignedTo: string | null;
}

export interface SearchResults {
  projects: Project[];
  meetings: Meeting[];
  series: MeetingSeries[];
  attendees: SearchAttendee[];
  points: SearchPoint[];
}

export const searchApi = {
  search: (query: string, limit?: number) => {
    const params = new URLSearchParams();
    params.set('q', query);
    if (limit) params.set('limit', String(limit));
    return apiCall<SearchResults>(`/search?${params.toString()}`);
  },
};

// Calendar API
export interface DuplicateCheckResult {
  isDuplicate: boolean;
  type: 'meeting' | 'series' | null;
  entity: Meeting | MeetingSeries | null;
  message: string | null;
}

export interface CalendarSyncResult {
  meeting?: Meeting;
  series?: MeetingSeries;
  status: 'updated' | 'removed';
  message: string;
}

export const calendarApi = {
  checkDuplicate: (eventId: string) =>
    apiCall<DuplicateCheckResult>(`/calendar/check-duplicate?eventId=${encodeURIComponent(eventId)}`),
  
  syncMeeting: (meetingId: string) =>
    apiCall<CalendarSyncResult>(`/meetings/${meetingId}/sync-from-calendar`, {
      method: "POST",
    }),
  
  syncSeries: (seriesId: string) =>
    apiCall<CalendarSyncResult>(`/meeting-series/${seriesId}/sync-from-calendar`, {
      method: "POST",
    }),
};

// Users API
export const usersApi = {
  getAll: () => apiCall<ProjectUser[]>('/users'),
  getById: (id: string) => apiCall<ProjectUser>(`/users/${id}`),
};
