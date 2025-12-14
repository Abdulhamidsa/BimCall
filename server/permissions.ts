import { Role, ProjectRole } from "@shared/schema";

// Permission actions
export type PermissionAction =
  // Meetings
  | "meetings:create"
  | "meetings:edit"
  | "meetings:close"
  | "meetings:send_minutes"
  // Points
  | "points:create"
  | "points:edit:any"
  | "points:edit:assigned"
  | "points:assign"
  // Attachments
  | "attachments:upload"
  // Comments/Status Updates
  | "comments:create"
  // Attendance
  | "attendance:edit"
  // Projects
  | "projects:view_all"
  | "projects:create"
  | "projects:edit"
  // Users
  | "users:manage"
  // KPIs
  | "kpis:view_global"
  | "kpis:view_project"
  | "kpis:view_company";

// All permission actions for UI display
export const ALL_PERMISSION_ACTIONS: PermissionAction[] = [
  "meetings:create",
  "meetings:edit",
  "meetings:close",
  "meetings:send_minutes",
  "points:create",
  "points:edit:any",
  "points:edit:assigned",
  "points:assign",
  "attachments:upload",
  "comments:create",
  "attendance:edit",
  "projects:view_all",
  "projects:create",
  "projects:edit",
  "users:manage",
  "kpis:view_global",
  "kpis:view_project",
  "kpis:view_company",
];

// Permission action display names for UI
export const PERMISSION_ACTION_LABELS: Record<PermissionAction, string> = {
  "meetings:create": "Create Meetings",
  "meetings:edit": "Edit Meetings",
  "meetings:close": "Close Meetings",
  "meetings:send_minutes": "Send Minutes",
  "points:create": "Create Points",
  "points:edit:any": "Edit Any Point",
  "points:edit:assigned": "Edit Assigned Points",
  "points:assign": "Assign Points",
  "attachments:upload": "Upload Attachments",
  "comments:create": "Create Comments",
  "attendance:edit": "Edit Attendance",
  "projects:view_all": "View All Projects",
  "projects:create": "Create Projects",
  "projects:edit": "Edit Projects",
  "users:manage": "Manage Users",
  "kpis:view_global": "View Global KPIs",
  "kpis:view_project": "View Project KPIs",
  "kpis:view_company": "View Company KPIs",
};

// Permission action categories for grouping in UI
export const PERMISSION_CATEGORIES: { name: string; actions: PermissionAction[] }[] = [
  {
    name: "Meetings",
    actions: ["meetings:create", "meetings:edit", "meetings:close", "meetings:send_minutes"],
  },
  {
    name: "Points",
    actions: ["points:create", "points:edit:any", "points:edit:assigned", "points:assign"],
  },
  {
    name: "Content",
    actions: ["attachments:upload", "comments:create"],
  },
  {
    name: "Attendance",
    actions: ["attendance:edit"],
  },
  {
    name: "Projects",
    actions: ["projects:view_all", "projects:create", "projects:edit"],
  },
  {
    name: "Administration",
    actions: ["users:manage"],
  },
  {
    name: "KPIs & Analytics",
    actions: ["kpis:view_global", "kpis:view_project", "kpis:view_company"],
  },
];

// Default permission matrix - maps actions to allowed roles (exported for UI)
export const DEFAULT_PERMISSION_MATRIX: Record<PermissionAction, Role[]> = {
  // Meetings
  "meetings:create": ["BIM_MANAGER", "BIM_PROJECT_MANAGER"],
  "meetings:edit": ["BIM_MANAGER", "BIM_PROJECT_MANAGER"],
  "meetings:close": ["BIM_MANAGER", "BIM_PROJECT_MANAGER"],
  "meetings:send_minutes": ["BIM_MANAGER", "BIM_PROJECT_MANAGER"],
  
  // Points
  "points:create": ["BIM_MANAGER", "BIM_PROJECT_MANAGER", "BIM_COORDINATOR"],
  "points:edit:any": ["BIM_MANAGER", "BIM_PROJECT_MANAGER", "BIM_COORDINATOR"],
  "points:edit:assigned": ["BIM_DESIGNER", "ENGINEER"],
  "points:assign": ["BIM_MANAGER", "BIM_PROJECT_MANAGER"],
  
  // Attachments
  "attachments:upload": [
    "BIM_MANAGER", "BIM_PROJECT_MANAGER", "BIM_COORDINATOR",
    "BIM_DESIGNER", "ENGINEER", "PROJECT_MANAGER", "DESIGN_MANAGER"
  ],
  
  // Comments/Status Updates
  "comments:create": [
    "BIM_MANAGER", "BIM_PROJECT_MANAGER", "BIM_COORDINATOR",
    "BIM_DESIGNER", "ENGINEER", "PROJECT_MANAGER", "DESIGN_MANAGER"
  ],
  
  // Attendance
  "attendance:edit": ["BIM_MANAGER", "BIM_PROJECT_MANAGER", "BIM_COORDINATOR"],
  
  // Projects
  "projects:view_all": ["BIM_MANAGER"],
  "projects:create": ["BIM_MANAGER"],
  "projects:edit": ["BIM_MANAGER", "BIM_PROJECT_MANAGER"],
  
  // Users
  "users:manage": ["BIM_MANAGER"],
  
  // KPIs
  "kpis:view_global": ["BIM_MANAGER"],
  "kpis:view_project": ["BIM_MANAGER", "BIM_PROJECT_MANAGER"],
  "kpis:view_company": ["PROJECT_MANAGER"],
};

// Project Role to Permissions mapping
// Maps project-specific roles to permissions they grant within that project
export const PROJECT_ROLE_PERMISSIONS: Record<ProjectRole, PermissionAction[]> = {
  PROJECT_LEADER: [
    "meetings:create", "meetings:edit", "meetings:close", "meetings:send_minutes",
    "points:create", "points:edit:any", "points:assign",
    "attachments:upload", "comments:create", "attendance:edit",
    "projects:edit", "kpis:view_project"
  ],
  BIM_MANAGER: [
    "meetings:create", "meetings:edit", "meetings:close", "meetings:send_minutes",
    "points:create", "points:edit:any", "points:assign",
    "attachments:upload", "comments:create", "attendance:edit",
    "projects:edit", "kpis:view_project"
  ],
  BIM_COORDINATOR: [
    "meetings:create", "meetings:edit",
    "points:create", "points:edit:any",
    "attachments:upload", "comments:create", "attendance:edit"
  ],
  DESIGN_LEAD: [
    "points:create", "points:edit:any",
    "attachments:upload", "comments:create"
  ],
  DESIGN_MANAGER: [
    "points:create", "points:edit:any",
    "attachments:upload", "comments:create",
    "kpis:view_project"
  ],
  DESIGN_TEAM_MEMBER: [
    "points:edit:assigned",
    "attachments:upload", "comments:create"
  ],
  ENGINEER: [
    "points:edit:assigned",
    "attachments:upload", "comments:create"
  ],
  EXTERNAL_CONSULTANT: [
    "comments:create"
  ],
  PROJECT_VIEWER: []
};

// Current user context with resolved permissions
export interface CurrentUser {
  id: string;
  email: string;
  name: string;
  roles: Role[];
  companyId: string | null;
  projectIds: string[]; // Projects user is assigned to
  projectRoles: Record<string, ProjectRole>; // Map of projectId -> ProjectRole
}

// Cached effective permission matrix (defaults merged with database overrides)
let effectivePermissionMatrix: Record<PermissionAction, Role[]> = { ...DEFAULT_PERMISSION_MATRIX };

// Update the effective permission matrix from database overrides
export function updateEffectivePermissionMatrix(
  overrides: Array<{ role: Role; action: string; isEnabled: boolean }>
): void {
  // Start with a fresh copy of defaults
  const newMatrix: Record<PermissionAction, Role[]> = {} as Record<PermissionAction, Role[]>;
  
  // Copy defaults
  for (const action of ALL_PERMISSION_ACTIONS) {
    newMatrix[action] = [...DEFAULT_PERMISSION_MATRIX[action]];
  }
  
  // Apply overrides
  for (const override of overrides) {
    const action = override.action as PermissionAction;
    if (!ALL_PERMISSION_ACTIONS.includes(action)) continue;
    
    const roleIndex = newMatrix[action].indexOf(override.role);
    
    if (override.isEnabled && roleIndex === -1) {
      // Add role to action
      newMatrix[action].push(override.role);
    } else if (!override.isEnabled && roleIndex !== -1) {
      // Remove role from action
      newMatrix[action].splice(roleIndex, 1);
    }
  }
  
  effectivePermissionMatrix = newMatrix;
}

// Get the current effective permission matrix
export function getEffectivePermissionMatrix(): Record<PermissionAction, Role[]> {
  return effectivePermissionMatrix;
}

// Check if user has a specific role
export function hasRole(user: CurrentUser, role: Role): boolean {
  return user.roles.includes(role);
}

// Check if user has any of the specified roles
export function hasAnyRole(user: CurrentUser, roles: Role[]): boolean {
  return roles.some(role => user.roles.includes(role));
}

// Check if user is a BIM_MANAGER (full admin access)
export function isBimManager(user: CurrentUser): boolean {
  return hasRole(user, "BIM_MANAGER");
}

// Check if user has permission for a global action (not project-scoped)
export function hasPermission(user: CurrentUser, action: PermissionAction): boolean {
  // BIM_MANAGER has all permissions
  if (isBimManager(user)) {
    return true;
  }
  
  // Use the effective permission matrix (defaults + database overrides)
  const allowedRoles = effectivePermissionMatrix[action];
  return hasAnyRole(user, allowedRoles);
}

// Check if user can access a specific project
export function canAccessProject(user: CurrentUser, projectId: string | null): boolean {
  // BIM_MANAGER can access all projects
  if (isBimManager(user)) {
    return true;
  }
  
  // No project = no restriction
  if (!projectId) {
    return true;
  }
  
  // Check if user is assigned to this project
  return user.projectIds.includes(projectId);
}

// Check if user has permission for a project-scoped action
export function hasProjectPermission(
  user: CurrentUser,
  action: PermissionAction,
  projectId: string | null
): boolean {
  // BIM_MANAGER app role has all permissions
  if (isBimManager(user)) {
    return true;
  }
  
  // Check if user has project access
  if (!canAccessProject(user, projectId)) {
    return false;
  }
  
  // Check if user's app-level role grants the permission
  if (hasPermission(user, action)) {
    return true;
  }
  
  // Check if user's project-specific role grants the permission
  if (projectId && user.projectRoles[projectId]) {
    const projectRole = user.projectRoles[projectId];
    const rolePermissions = PROJECT_ROLE_PERMISSIONS[projectRole];
    if (rolePermissions.includes(action)) {
      return true;
    }
  }
  
  return false;
}

// Check if user can edit a specific point (handles assigned-only rules)
export function canEditPoint(
  user: CurrentUser,
  pointAssignedToRef: string | null,
  projectId: string | null
): boolean {
  // Check project access first
  if (!canAccessProject(user, projectId)) {
    return false;
  }
  
  // BIM_MANAGER, BIM_PROJECT_MANAGER, BIM_COORDINATOR can edit any point
  if (hasPermission(user, "points:edit:any")) {
    return true;
  }
  
  // BIM_DESIGNER and ENGINEER can only edit points assigned to them
  if (hasPermission(user, "points:edit:assigned")) {
    // Check if point is assigned to this user
    // assignedToRef format: "user:{userId}" or "attendee:{attendeeId}" or "company:{companyName}"
    if (pointAssignedToRef?.startsWith("user:")) {
      const assignedUserId = pointAssignedToRef.replace("user:", "");
      return assignedUserId === user.id;
    }
    // Also check by email in attendee reference
    if (pointAssignedToRef?.includes(user.email)) {
      return true;
    }
  }
  
  return false;
}

// Check if user can view points (with company filtering for PROJECT_MANAGER)
export function getPointsFilter(user: CurrentUser): { companyId?: string } | null {
  // PROJECT_MANAGER can only see points linked to their company
  if (hasRole(user, "PROJECT_MANAGER") && user.companyId) {
    return { companyId: user.companyId };
  }
  
  return null;
}

// Get all accessible project IDs for a user
export function getAccessibleProjectIds(user: CurrentUser): string[] | "all" {
  if (isBimManager(user)) {
    return "all";
  }
  return user.projectIds;
}

// Role display names for UI
export const ROLE_DISPLAY_NAMES: Record<Role, string> = {
  "BIM_MANAGER": "BIM Manager",
  "BIM_PROJECT_MANAGER": "BIM Project Manager",
  "BIM_COORDINATOR": "BIM Coordinator",
  "BIM_DESIGNER": "BIM Designer",
  "ENGINEER": "Engineer",
  "PROJECT_MANAGER": "Project Manager",
  "DESIGN_MANAGER": "Design Manager",
  "VIEWER": "Viewer",
};

// Role descriptions for UI
export const ROLE_DESCRIPTIONS: Record<Role, string> = {
  "BIM_MANAGER": "Full access across all projects, global KPIs, user management",
  "BIM_PROJECT_MANAGER": "Full access within assigned projects, project-level KPIs",
  "BIM_COORDINATOR": "Add/edit points, attachments, statuses, attendance in assigned projects",
  "BIM_DESIGNER": "Edit assigned points, upload attachments, add comments",
  "ENGINEER": "Edit assigned points, upload attachments, add comments",
  "PROJECT_MANAGER": "Company-filtered view of points and KPIs in assigned projects",
  "DESIGN_MANAGER": "Review role: view all, comment and upload attachments only",
  "VIEWER": "Read-only access to assigned projects",
};

// Get permission summary for frontend
export function getPermissionSummary(user: CurrentUser): Record<string, boolean> {
  return {
    canCreateMeetings: hasPermission(user, "meetings:create"),
    canEditMeetings: hasPermission(user, "meetings:edit"),
    canCloseMeetings: hasPermission(user, "meetings:close"),
    canSendMinutes: hasPermission(user, "meetings:send_minutes"),
    canCreatePoints: hasPermission(user, "points:create"),
    canEditAnyPoint: hasPermission(user, "points:edit:any"),
    canEditAssignedPoints: hasPermission(user, "points:edit:assigned"),
    canAssignPoints: hasPermission(user, "points:assign"),
    canUploadAttachments: hasPermission(user, "attachments:upload"),
    canComment: hasPermission(user, "comments:create"),
    canEditAttendance: hasPermission(user, "attendance:edit"),
    canViewAllProjects: hasPermission(user, "projects:view_all"),
    canCreateProjects: hasPermission(user, "projects:create"),
    canEditProjects: hasPermission(user, "projects:edit"),
    canManageUsers: hasPermission(user, "users:manage"),
    canViewGlobalKpis: hasPermission(user, "kpis:view_global"),
    canViewProjectKpis: hasPermission(user, "kpis:view_project"),
    canViewCompanyKpis: hasPermission(user, "kpis:view_company"),
    isBimManager: isBimManager(user),
  };
}
