import {
  createContext,
  useContext,
  ReactNode,
  useState,
  useCallback,
} from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

export type Role =
  | "BIM_MANAGER"
  | "BIM_PROJECT_MANAGER"
  | "BIM_COORDINATOR"
  | "BIM_DESIGNER"
  | "ENGINEER"
  | "PROJECT_MANAGER"
  | "DESIGN_MANAGER"
  | "VIEWER";

export type CompanyRole =
  | "OWNER"
  | "ADMIN"
  | "DEPARTMENT_MANAGER"
  | "EMPLOYEE"
  | "GUEST";

export interface CurrentUser {
  id: string;
  email: string;
  name: string;
  roles: Role[];
  companyId: string | null;
  companyName: string | null;
  companyRole: CompanyRole | null;
  projectIds: string[];
  projectRoles: Record<string, ProjectRole>;
}

export interface Permissions {
  canCreateMeetings: boolean;
  canEditMeetings: boolean;
  canCloseMeetings: boolean;
  canSendMinutes: boolean;
  canCreatePoints: boolean;
  canEditAnyPoint: boolean;
  canEditAssignedPoints: boolean;
  canAssignPoints: boolean;
  canUploadAttachments: boolean;
  canComment: boolean;
  canEditAttendance: boolean;
  canViewAllProjects: boolean;
  canCreateProjects: boolean;
  canEditProjects: boolean;
  canManageUsers: boolean;
  canViewGlobalKpis: boolean;
  canViewProjectKpis: boolean;
  canViewCompanyKpis: boolean;
  isBimManager: boolean;
}

interface AuthContextType {
  user: CurrentUser | null;
  permissions: Permissions | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshAuth: () => Promise<void>;
  setDevUser: (userId: string | null, email?: string | null) => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

const DEV_USER_ID_KEY = "dev-user-id";
const DEV_USER_EMAIL_KEY = "dev-user-email";

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();

  const [devUserId, setDevUserId] = useState<string | null>(() =>
    localStorage.getItem(DEV_USER_ID_KEY),
  );
  const [devUserEmail, setDevUserEmail] = useState<string | null>(() =>
    localStorage.getItem(DEV_USER_EMAIL_KEY),
  );

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["/api/auth/me", devUserId, devUserEmail],
    queryFn: async () => {
      const headers: Record<string, string> = {};
      if (devUserId) {
        headers["x-dev-user-id"] = devUserId;
      }
      if (devUserEmail) {
        headers["x-dev-user-email"] = devUserEmail;
      }

      const response = await fetch("/api/auth/me", {
        headers,
        credentials: "include",
      });
      if (!response.ok) {
        if (response.status === 401) {
          return { user: null, permissions: null };
        }
        throw new Error("Failed to fetch auth");
      }
      return response.json() as Promise<{
        user: CurrentUser | null;
        permissions: Permissions | null;
      }>;
    },
    staleTime: 1000 * 60 * 5,
    retry: false,
  });

  const loginMutation = useMutation({
    mutationFn: async ({
      email,
      password,
    }: {
      email: string;
      password: string;
    }) => {
      const response = await apiRequest("POST", "/api/auth/login", {
        email,
        password,
      });
      return response.json();
    },
    onSuccess: () => {
      localStorage.removeItem(DEV_USER_ID_KEY);
      localStorage.removeItem(DEV_USER_EMAIL_KEY);
      setDevUserId(null);
      setDevUserEmail(null);
      refetch();
      queryClient.invalidateQueries();
    },
  });

  const registerMutation = useMutation({
    mutationFn: async ({
      email,
      password,
      name,
    }: {
      email: string;
      password: string;
      name: string;
    }) => {
      const response = await apiRequest("POST", "/api/auth/register", {
        email,
        password,
        name,
      });
      return response.json();
    },
    onSuccess: () => {
      localStorage.removeItem(DEV_USER_ID_KEY);
      localStorage.removeItem(DEV_USER_EMAIL_KEY);
      setDevUserId(null);
      setDevUserEmail(null);
      refetch();
      queryClient.invalidateQueries();
    },
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/auth/logout", {});
      return response.json();
    },
    onSuccess: () => {
      localStorage.removeItem(DEV_USER_ID_KEY);
      localStorage.removeItem(DEV_USER_EMAIL_KEY);
      setDevUserId(null);
      setDevUserEmail(null);
      queryClient.clear();
      refetch();
    },
  });

  const login = useCallback(
    async (email: string, password: string) => {
      await loginMutation.mutateAsync({ email, password });
    },
    [loginMutation],
  );

  const register = useCallback(
    async (email: string, password: string, name: string) => {
      await registerMutation.mutateAsync({ email, password, name });
    },
    [registerMutation],
  );

  const logout = useCallback(async () => {
    await logoutMutation.mutateAsync();
  }, [logoutMutation]);

  const setDevUser = useCallback(
    (userId: string | null, email: string | null = null) => {
      if (userId) {
        localStorage.setItem(DEV_USER_ID_KEY, userId);
        setDevUserId(userId);
      } else {
        localStorage.removeItem(DEV_USER_ID_KEY);
        setDevUserId(null);
      }

      if (email) {
        localStorage.setItem(DEV_USER_EMAIL_KEY, email);
        setDevUserEmail(email);
      } else {
        localStorage.removeItem(DEV_USER_EMAIL_KEY);
        setDevUserEmail(null);
      }
    },
    [],
  );

  const refreshAuth = useCallback(async () => {
    await refetch();
    queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
  }, [refetch, queryClient]);

  return (
    <AuthContext.Provider
      value={{
        user: data?.user ?? null,
        permissions: data?.permissions ?? null,
        isLoading,
        isAuthenticated: !!data?.user,
        login,
        register,
        logout,
        refreshAuth,
        setDevUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

export function usePermissions() {
  const { permissions } = useAuth();
  return permissions;
}

export function useHasPermission(permission: keyof Permissions): boolean {
  const permissions = usePermissions();
  if (!permissions) return false;
  return permissions[permission];
}

export function useCanEditPoint(assignedToRef: string | null): boolean {
  const { user, permissions } = useAuth();

  if (!permissions) return false;

  if (permissions.canEditAnyPoint) return true;

  if (permissions.canEditAssignedPoints && user) {
    if (assignedToRef?.startsWith("user:")) {
      const assignedUserId = assignedToRef.replace("user:", "");
      return assignedUserId === user.id;
    }
    if (assignedToRef?.includes(user.email)) {
      return true;
    }
  }

  return false;
}

export function useCanAccessProject(projectId: string | null): boolean {
  const { user, permissions } = useAuth();

  if (!user || !permissions) return true;

  if (permissions.isBimManager) return true;

  if (!projectId) return true;

  return user.projectIds.includes(projectId);
}

export const ROLE_DISPLAY_NAMES: Record<Role, string> = {
  BIM_MANAGER: "BIM Manager",
  BIM_PROJECT_MANAGER: "BIM Project Manager",
  BIM_COORDINATOR: "BIM Coordinator",
  BIM_DESIGNER: "BIM Designer",
  ENGINEER: "Engineer",
  PROJECT_MANAGER: "Project Manager",
  DESIGN_MANAGER: "Design Manager",
  VIEWER: "Viewer",
};

export const ROLE_COLORS: Record<Role, string> = {
  BIM_MANAGER:
    "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  BIM_PROJECT_MANAGER:
    "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  BIM_COORDINATOR:
    "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  BIM_DESIGNER:
    "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  ENGINEER: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200",
  PROJECT_MANAGER:
    "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
  DESIGN_MANAGER:
    "bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200",
  VIEWER: "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200",
};

// Company Role display names and colors
export const COMPANY_ROLE_DISPLAY_NAMES: Record<CompanyRole, string> = {
  OWNER: "Owner",
  ADMIN: "Admin",
  DEPARTMENT_MANAGER: "Department Manager",
  EMPLOYEE: "Employee",
  GUEST: "Guest",
};

export const COMPANY_ROLE_COLORS: Record<CompanyRole, string> = {
  OWNER: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
  ADMIN: "bg-rose-100 text-rose-800 dark:bg-rose-900 dark:text-rose-200",
  DEPARTMENT_MANAGER:
    "bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-200",
  EMPLOYEE: "bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-200",
  GUEST: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300",
};

export const COMPANY_ROLE_DESCRIPTIONS: Record<CompanyRole, string> = {
  OWNER:
    "Company founder with full control over company settings and all employees",
  ADMIN: "Can manage company settings, employees, and projects",
  DEPARTMENT_MANAGER: "Manages a department and its team members",
  EMPLOYEE: "Regular company employee with standard access",
  GUEST: "External collaborator with limited access",
};

// Project Role types and display names
export type ProjectRole =
  | "PROJECT_LEADER"
  | "BIM_MANAGER"
  | "BIM_COORDINATOR"
  | "DESIGN_LEAD"
  | "DESIGN_MANAGER"
  | "DESIGN_TEAM_MEMBER"
  | "ENGINEER"
  | "EXTERNAL_CONSULTANT"
  | "PROJECT_VIEWER";

export const PROJECT_ROLE_DISPLAY_NAMES: Record<ProjectRole, string> = {
  PROJECT_LEADER: "Project Leader",
  BIM_MANAGER: "BIM Manager",
  BIM_COORDINATOR: "BIM Coordinator",
  DESIGN_LEAD: "Design Lead",
  DESIGN_MANAGER: "Design Manager",
  DESIGN_TEAM_MEMBER: "Design Team Member",
  ENGINEER: "Engineer",
  EXTERNAL_CONSULTANT: "External Consultant",
  PROJECT_VIEWER: "Project Viewer",
};

export const PROJECT_ROLE_COLORS: Record<ProjectRole, string> = {
  PROJECT_LEADER:
    "bg-violet-100 text-violet-800 dark:bg-violet-900 dark:text-violet-200",
  BIM_MANAGER:
    "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  BIM_COORDINATOR:
    "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  DESIGN_LEAD: "bg-sky-100 text-sky-800 dark:bg-sky-900 dark:text-sky-200",
  DESIGN_MANAGER:
    "bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200",
  DESIGN_TEAM_MEMBER:
    "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  ENGINEER: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200",
  EXTERNAL_CONSULTANT:
    "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
  PROJECT_VIEWER:
    "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200",
};

export const PROJECT_ROLE_DESCRIPTIONS: Record<ProjectRole, string> = {
  PROJECT_LEADER: "Overall project leadership and decision-making authority",
  BIM_MANAGER: "Manages BIM processes, standards, and coordination",
  BIM_COORDINATOR: "Coordinates BIM models and clash detection",
  DESIGN_LEAD: "Leads design direction and reviews",
  DESIGN_MANAGER: "Manages design team and deliverables",
  DESIGN_TEAM_MEMBER: "Creates and updates design documentation",
  ENGINEER: "Technical engineering role",
  EXTERNAL_CONSULTANT: "External advisor or specialist",
  PROJECT_VIEWER: "View-only access to project resources",
};

export type PermissionAction =
  | "meetings:create"
  | "meetings:edit"
  | "meetings:close"
  | "meetings:send_minutes"
  | "points:create"
  | "points:edit:any"
  | "points:edit:assigned"
  | "points:assign"
  | "attachments:upload"
  | "comments:create"
  | "attendance:edit"
  | "projects:view_all"
  | "projects:create"
  | "projects:edit"
  | "users:manage"
  | "kpis:view_global"
  | "kpis:view_project"
  | "kpis:view_company";

export const PROJECT_ROLE_PERMISSIONS: Record<ProjectRole, PermissionAction[]> =
  {
    PROJECT_LEADER: [
      "meetings:create",
      "meetings:edit",
      "meetings:close",
      "meetings:send_minutes",
      "points:create",
      "points:edit:any",
      "points:assign",
      "attachments:upload",
      "comments:create",
      "attendance:edit",
      "projects:edit",
      "kpis:view_project",
    ],
    BIM_MANAGER: [
      "meetings:create",
      "meetings:edit",
      "meetings:close",
      "meetings:send_minutes",
      "points:create",
      "points:edit:any",
      "points:assign",
      "attachments:upload",
      "comments:create",
      "attendance:edit",
      "projects:edit",
      "kpis:view_project",
    ],
    BIM_COORDINATOR: [
      "meetings:create",
      "meetings:edit",
      "points:create",
      "points:edit:any",
      "attachments:upload",
      "comments:create",
      "attendance:edit",
    ],
    DESIGN_LEAD: [
      "points:create",
      "points:edit:any",
      "attachments:upload",
      "comments:create",
    ],
    DESIGN_MANAGER: [
      "points:create",
      "points:edit:any",
      "attachments:upload",
      "comments:create",
      "kpis:view_project",
    ],
    DESIGN_TEAM_MEMBER: [
      "points:edit:assigned",
      "attachments:upload",
      "comments:create",
    ],
    ENGINEER: ["points:edit:assigned", "attachments:upload", "comments:create"],
    EXTERNAL_CONSULTANT: ["comments:create"],
    PROJECT_VIEWER: [],
  };

export function useHasProjectPermission(
  action: PermissionAction,
  projectId: string | null,
): boolean {
  const { user, permissions } = useAuth();

  if (!user || !permissions) return false;

  if (permissions.isBimManager) return true;

  if (!projectId) return false;

  if (!user.projectIds.includes(projectId)) return false;

  const projectRole = user.projectRoles[projectId];
  if (projectRole) {
    const rolePermissions = PROJECT_ROLE_PERMISSIONS[projectRole];
    if (rolePermissions.includes(action)) {
      return true;
    }
  }

  return false;
}
