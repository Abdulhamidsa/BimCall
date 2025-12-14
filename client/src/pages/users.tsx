import React, { useState, useCallback } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth, ROLE_DISPLAY_NAMES, ROLE_COLORS, type Role, type CompanyRole, COMPANY_ROLE_DISPLAY_NAMES, COMPANY_ROLE_COLORS } from "@/contexts/auth-context";
import Layout from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { 
  Plus, 
  Search, 
  Users, 
  Building2, 
  Pencil, 
  Trash2, 
  UserPlus,
  Shield,
  LogIn,
  LogOut,
  Check,
  RefreshCw,
  Key,
  Save
} from "lucide-react";

interface Company {
  id: string;
  name: string;
  code: string | null;
}

interface User {
  id: string;
  name: string;
  email: string;
  companyId: string | null;
  companyName: string | null;
  companyRole: CompanyRole | null;
  avatar: string | null;
  isActive: boolean;
  roles: Role[];
}

interface Project {
  id: string;
  name: string;
  code: string;
}

interface RoleInfo {
  id: Role;
  name: string;
  description: string;
}

interface PermissionConfig {
  actions: string[];
  labels: Record<string, string>;
  categories: { name: string; actions: string[] }[];
  defaults: Record<string, Role[]>;
  roles: Role[];
}

interface RolePermission {
  id: string;
  role: Role;
  action: string;
  isEnabled: boolean;
}

export default function UsersPage() {
  const [, setLocation] = useLocation();
  const { user: currentUser, permissions, setDevUser, refreshAuth } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [showUserDialog, setShowUserDialog] = useState(false);
  const [showCompanyDialog, setShowCompanyDialog] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editingCompany, setEditingCompany] = useState<Company | null>(null);

  const { data: users = [], isLoading: usersLoading } = useQuery<User[]>({
    queryKey: ["/api/users"],
  });

  const { data: companies = [], isLoading: companiesLoading } = useQuery<Company[]>({
    queryKey: ["/api/companies"],
  });

  const { data: projects = [] } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
  });

  const { data: roles = [] } = useQuery<RoleInfo[]>({
    queryKey: ["/api/roles"],
  });

  const filteredUsers = users.filter(user => 
    user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (user.companyName?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false)
  );

  const canManageUsers = permissions?.canManageUsers ?? false;

  // Helper to get auth headers for API calls
  const getAuthHeaders = (): Record<string, string> => {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    const devUserId = localStorage.getItem("dev-user-id");
    const devUserEmail = localStorage.getItem("dev-user-email");
    if (devUserId) headers["x-dev-user-id"] = devUserId;
    if (devUserEmail) headers["x-dev-user-email"] = devUserEmail;
    return headers;
  };

  const createUserMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to create user");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({ title: "User created successfully" });
      setShowUserDialog(false);
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const updateUserMutation = useMutation({
    mutationFn: async ({ id, ...data }: any) => {
      const res = await fetch(`/api/users/${id}`, {
        method: "PATCH",
        headers: getAuthHeaders(),
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to update user");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({ title: "User updated successfully" });
      setShowUserDialog(false);
      setEditingUser(null);
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/users/${id}`, { 
        method: "DELETE",
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error("Failed to delete user");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({ title: "User deleted successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const createCompanyMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch("/api/companies", {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to create company");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/companies"] });
      toast({ title: "Company created successfully" });
      setShowCompanyDialog(false);
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const updateCompanyMutation = useMutation({
    mutationFn: async ({ id, ...data }: any) => {
      const res = await fetch(`/api/companies/${id}`, {
        method: "PATCH",
        headers: getAuthHeaders(),
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to update company");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/companies"] });
      toast({ title: "Company updated successfully" });
      setShowCompanyDialog(false);
      setEditingCompany(null);
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const deleteCompanyMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/companies/${id}`, { 
        method: "DELETE",
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error("Failed to delete company");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/companies"] });
      toast({ title: "Company deleted successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const syncAttendeesMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/attendees/sync-all", {
        method: "POST",
        headers: getAuthHeaders(),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to sync attendees");
      }
      return res.json();
    },
    onSuccess: (data: { synced: number; created: number }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({ 
        title: "Attendees synced successfully", 
        description: `Synced ${data.synced} attendees, created ${data.created} new users` 
      });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  return (
    <Layout>
      <div className="px-4 sm:px-6 py-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">User Management</h1>
            <p className="text-muted-foreground">Manage users, roles, and companies</p>
          </div>
          {currentUser && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setDevUser(null);
                refreshAuth();
                toast({ title: "Logged out" });
              }}
              data-testid="button-logout"
            >
              <LogOut className="h-4 w-4 mr-2" />
              Logout
            </Button>
          )}
        </div>
        {!canManageUsers && (
          <Card className="mb-6 border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950">
            <CardContent className="py-4">
              <div className="flex items-center gap-2 text-amber-800 dark:text-amber-200">
                <Shield className="h-4 w-4" />
                <p>You can view users but cannot make changes. Only BIM Managers can manage users.</p>
              </div>
            </CardContent>
          </Card>
        )}

        <Tabs defaultValue="users" className="w-full">
          <TabsList className="mb-6">
            <TabsTrigger value="users" className="flex items-center gap-2" data-testid="tab-users">
              <Users className="h-4 w-4" />
              Users
            </TabsTrigger>
            <TabsTrigger value="companies" className="flex items-center gap-2" data-testid="tab-companies">
              <Building2 className="h-4 w-4" />
              Companies
            </TabsTrigger>
            <TabsTrigger value="roles" className="flex items-center gap-2" data-testid="tab-roles">
              <Key className="h-4 w-4" />
              Roles & Permissions
            </TabsTrigger>
          </TabsList>

          <TabsContent value="users">
            <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Users ({users.length})
                </CardTitle>
                {canManageUsers && (
                  <Button
                    size="sm"
                    onClick={() => {
                      setEditingUser(null);
                      setShowUserDialog(true);
                    }}
                    data-testid="button-add-user"
                  >
                    <UserPlus className="h-4 w-4 mr-2" />
                    Add User
                  </Button>
                )}
              </CardHeader>
              <CardContent>
                <div className="mb-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search users..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10"
                      data-testid="input-search-users"
                    />
                  </div>
                </div>

                {usersLoading ? (
                  <p className="text-center py-8 text-muted-foreground">Loading users...</p>
                ) : filteredUsers.length === 0 ? (
                  <p className="text-center py-8 text-muted-foreground">No users found</p>
                ) : (
                  <div className="space-y-3">
                    {filteredUsers.map((user) => (
                      <div
                        key={user.id}
                        className="flex items-center justify-between p-4 border rounded-lg bg-muted/30"
                        data-testid={`user-card-${user.id}`}
                      >
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold">
                            {user.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-medium">{user.name}</div>
                            <div className="text-sm text-muted-foreground">{user.email}</div>
                            {user.companyName && (
                              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <span>{user.companyName}</span>
                                {user.companyRole && (
                                  <Badge variant="outline" className={`text-xs ${COMPANY_ROLE_COLORS[user.companyRole]}`}>
                                    {COMPANY_ROLE_DISPLAY_NAMES[user.companyRole]}
                                  </Badge>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="flex flex-wrap gap-1 max-w-[200px]">
                            {user.roles.map((role) => (
                              <Badge
                                key={role}
                                variant="secondary"
                                className={`text-xs ${ROLE_COLORS[role]}`}
                              >
                                {ROLE_DISPLAY_NAMES[role]}
                              </Badge>
                            ))}
                          </div>
                          <div className="flex gap-1">
                            {currentUser?.id === user.id ? (
                              <Badge variant="default" className="flex items-center gap-1 bg-green-600">
                                <Check className="h-3 w-3" />
                                Active
                              </Badge>
                            ) : (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setDevUser(user.id, user.email);
                                  refreshAuth();
                                  toast({ title: `Switched to ${user.name}`, description: `Now viewing as ${user.roles.join(", ") || "No role"}` });
                                }}
                                data-testid={`button-login-as-${user.id}`}
                              >
                                <LogIn className="h-3 w-3 mr-1" />
                                Login
                              </Button>
                            )}
                          </div>
                          {canManageUsers && (
                            <div className="flex gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => {
                                  setEditingUser(user);
                                  setShowUserDialog(true);
                                }}
                                data-testid={`button-edit-user-${user.id}`}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => {
                                  if (confirm("Are you sure you want to delete this user?")) {
                                    deleteUserMutation.mutate(user.id);
                                  }
                                }}
                                data-testid={`button-delete-user-${user.id}`}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <div>
            <Card className="mt-6 lg:mt-0">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <RefreshCw className="h-5 w-5" />
                  Sync Attendees
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  Convert all meeting attendees into system users with VIEWER role. This links existing attendees to user accounts for role-based access control.
                </p>
                <Button
                  onClick={() => syncAttendeesMutation.mutate()}
                  disabled={syncAttendeesMutation.isPending}
                  data-testid="button-sync-attendees"
                >
                  {syncAttendeesMutation.isPending ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      Syncing...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Sync All Attendees
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          </div>
            </div>
          </TabsContent>

          <TabsContent value="companies">
            <div className="grid gap-6 lg:grid-cols-2">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <Building2 className="h-5 w-5" />
                    Companies ({companies.length})
                  </CardTitle>
                  {canManageUsers && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setEditingCompany(null);
                        setShowCompanyDialog(true);
                      }}
                      data-testid="button-add-company"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add Company
                    </Button>
                  )}
                </CardHeader>
                <CardContent>
                  {companiesLoading ? (
                    <p className="text-center py-8 text-muted-foreground">Loading companies...</p>
                  ) : companies.length === 0 ? (
                    <p className="text-center py-8 text-muted-foreground">No companies found</p>
                  ) : (
                    <div className="space-y-3">
                      {companies.map((company) => (
                        <div
                          key={company.id}
                          className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                          data-testid={`company-card-${company.id}`}
                        >
                          <div 
                            className="flex-1 cursor-pointer"
                            onClick={() => setLocation(`/company/${company.id}`)}
                          >
                            <div className="font-medium hover:text-primary">{company.name}</div>
                            {company.code && (
                              <Badge variant="outline" className="text-xs mt-1">{company.code}</Badge>
                            )}
                          </div>
                          {canManageUsers && (
                            <div className="flex gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => {
                                  setEditingCompany(company);
                                  setShowCompanyDialog(true);
                                }}
                                data-testid={`button-edit-company-tab-${company.id}`}
                              >
                                <Pencil className="h-3 w-3" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => {
                                  if (confirm("Are you sure you want to delete this company?")) {
                                    deleteCompanyMutation.mutate(company.id);
                                  }
                                }}
                                data-testid={`button-delete-company-tab-${company.id}`}
                              >
                                <Trash2 className="h-3 w-3 text-destructive" />
                              </Button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Shield className="h-5 w-5" />
                    Available Roles
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {roles.map((role) => (
                      <div key={role.id} className="border-b pb-2 last:border-0">
                        <Badge variant="secondary" className={ROLE_COLORS[role.id]}>
                          {role.name}
                        </Badge>
                        <p className="text-xs text-muted-foreground mt-1">{role.description}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="roles">
            <RolesTab canManageUsers={canManageUsers} getAuthHeaders={getAuthHeaders} />
          </TabsContent>
        </Tabs>

        <UserDialog
          open={showUserDialog}
          onOpenChange={(open) => {
            setShowUserDialog(open);
            if (!open) setEditingUser(null);
          }}
          user={editingUser}
          companies={companies}
          projects={projects}
          roles={roles}
          onSave={(data) => {
            if (editingUser) {
              updateUserMutation.mutate({ id: editingUser.id, ...data });
            } else {
              createUserMutation.mutate(data);
            }
          }}
          isLoading={createUserMutation.isPending || updateUserMutation.isPending}
        />

        <CompanyDialog
          open={showCompanyDialog}
          onOpenChange={(open) => {
            setShowCompanyDialog(open);
            if (!open) setEditingCompany(null);
          }}
          company={editingCompany}
          onSave={(data) => {
            if (editingCompany) {
              updateCompanyMutation.mutate({ id: editingCompany.id, ...data });
            } else {
              createCompanyMutation.mutate(data);
            }
          }}
          isLoading={createCompanyMutation.isPending || updateCompanyMutation.isPending}
        />
      </div>
    </Layout>
  );
}

function UserDialog({
  open,
  onOpenChange,
  user,
  companies,
  projects,
  roles,
  onSave,
  isLoading,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: User | null;
  companies: Company[];
  projects: Project[];
  roles: RoleInfo[];
  onSave: (data: any) => void;
  isLoading: boolean;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [companyRole, setCompanyRole] = useState<CompanyRole>("EMPLOYEE");
  const [selectedRoles, setSelectedRoles] = useState<Role[]>([]);
  const [selectedProjects, setSelectedProjects] = useState<string[]>([]);

  const resetForm = () => {
    if (user) {
      setName(user.name);
      setEmail(user.email);
      setCompanyId(user.companyId);
      setCompanyRole(user.companyRole || "EMPLOYEE");
      setSelectedRoles(user.roles);
      // Load user's projects
      fetch(`/api/users/${user.id}/projects`)
        .then(res => res.json())
        .then((data: Project[]) => setSelectedProjects(data.map(p => p.id)))
        .catch(() => setSelectedProjects([]));
    } else {
      setName("");
      setEmail("");
      setCompanyId(null);
      setCompanyRole("EMPLOYEE");
      setSelectedRoles([]);
      setSelectedProjects([]);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto" onOpenAutoFocus={() => resetForm()}>
        <DialogHeader>
          <DialogTitle>{user ? "Edit User" : "Add New User"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="John Smith"
              data-testid="input-user-name"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="john@example.com"
              data-testid="input-user-email"
            />
          </div>
          <div className="space-y-2">
            <Label>Company</Label>
            <Select value={companyId ?? "none"} onValueChange={(v) => setCompanyId(v === "none" ? null : v)}>
              <SelectTrigger data-testid="select-user-company">
                <SelectValue placeholder="Select company" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No Company</SelectItem>
                {companies.map((company) => (
                  <SelectItem key={company.id} value={company.id}>
                    {company.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {companyId && (
            <div className="space-y-2">
              <Label>Company Role</Label>
              <Select value={companyRole} onValueChange={(v) => setCompanyRole(v as CompanyRole)}>
                <SelectTrigger data-testid="select-user-company-role">
                  <SelectValue placeholder="Select company role" />
                </SelectTrigger>
                <SelectContent>
                  {(["OWNER", "ADMIN", "DEPARTMENT_MANAGER", "EMPLOYEE", "GUEST"] as CompanyRole[]).map((role) => (
                    <SelectItem key={role} value={role}>
                      {COMPANY_ROLE_DISPLAY_NAMES[role]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="space-y-2">
            <Label>App Roles</Label>
            <div className="grid grid-cols-2 gap-2 p-3 border rounded-lg">
              {roles.map((role) => (
                <label
                  key={role.id}
                  className="flex items-center gap-2 cursor-pointer"
                >
                  <Checkbox
                    checked={selectedRoles.includes(role.id)}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        setSelectedRoles([...selectedRoles, role.id]);
                      } else {
                        setSelectedRoles(selectedRoles.filter(r => r !== role.id));
                      }
                    }}
                    data-testid={`checkbox-role-${role.id}`}
                  />
                  <span className="text-sm">{role.name}</span>
                </label>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <Label>Project Access</Label>
            <div className="max-h-40 overflow-y-auto p-3 border rounded-lg space-y-2">
              {projects.map((project) => (
                <label
                  key={project.id}
                  className="flex items-center gap-2 cursor-pointer"
                >
                  <Checkbox
                    checked={selectedProjects.includes(project.id)}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        setSelectedProjects([...selectedProjects, project.id]);
                      } else {
                        setSelectedProjects(selectedProjects.filter(p => p !== project.id));
                      }
                    }}
                    data-testid={`checkbox-project-${project.id}`}
                  />
                  <span className="text-sm">{project.name} ({project.code})</span>
                </label>
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline" data-testid="button-cancel-user">Cancel</Button>
          </DialogClose>
          <Button
            onClick={() => onSave({ name, email, companyId, companyRole: companyId ? companyRole : null, roles: selectedRoles, projectIds: selectedProjects })}
            disabled={isLoading || !name || !email}
            data-testid="button-save-user"
          >
            {isLoading ? "Saving..." : user ? "Update" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CompanyDialog({
  open,
  onOpenChange,
  company,
  onSave,
  isLoading,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  company: Company | null;
  onSave: (data: any) => void;
  isLoading: boolean;
}) {
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [email, setEmail] = useState("");
  const [emailDomain, setEmailDomain] = useState("");

  const resetForm = () => {
    if (company) {
      setName(company.name);
      setCode(company.code ?? "");
      setEmail((company as any).email ?? "");
      setEmailDomain((company as any).emailDomain ?? "");
    } else {
      setName("");
      setCode("");
      setEmail("");
      setEmailDomain("");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent onOpenAutoFocus={() => resetForm()}>
        <DialogHeader>
          <DialogTitle>{company ? "Edit Company" : "Add New Company"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="company-name">Name</Label>
            <Input
              id="company-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Acme Construction"
              data-testid="input-company-name"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="company-code">Code (optional)</Label>
            <Input
              id="company-code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="ACM"
              data-testid="input-company-code"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="company-email">Company Email (optional)</Label>
            <Input
              id="company-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="contact@acme.com"
              data-testid="input-company-email"
            />
            <p className="text-xs text-muted-foreground">
              New users with matching email domain will auto-join this company
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="company-email-domain">Email Domain (optional)</Label>
            <Input
              id="company-email-domain"
              value={emailDomain}
              onChange={(e) => setEmailDomain(e.target.value)}
              placeholder="acme.com"
              data-testid="input-company-email-domain"
            />
            <p className="text-xs text-muted-foreground">
              Auto-set from company email, or manually specify for user matching
            </p>
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline" data-testid="button-cancel-company">Cancel</Button>
          </DialogClose>
          <Button
            onClick={() => onSave({ 
              name, 
              code: code || null, 
              email: email || null,
              emailDomain: emailDomain || null 
            })}
            disabled={isLoading || !name}
            data-testid="button-save-company"
          >
            {isLoading ? "Saving..." : company ? "Update" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RolesTab({
  canManageUsers,
  getAuthHeaders,
}: {
  canManageUsers: boolean;
  getAuthHeaders: () => Record<string, string>;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [pendingChanges, setPendingChanges] = useState<Map<string, boolean>>(new Map());
  const [isSaving, setIsSaving] = useState(false);

  const { data: permissionConfig, isLoading: configLoading } = useQuery<PermissionConfig>({
    queryKey: ["/api/role-permissions/config"],
  });

  const { data: rolePermissions = [], isLoading: permissionsLoading } = useQuery<RolePermission[]>({
    queryKey: ["/api/role-permissions"],
  });

  const getPermissionKey = (role: Role, action: string) => `${role}:${action}`;

  const isPermissionGranted = useCallback((role: Role, action: string): boolean => {
    const key = getPermissionKey(role, action);
    
    if (pendingChanges.has(key)) {
      return pendingChanges.get(key)!;
    }
    
    const override = rolePermissions.find(p => p.role === role && p.action === action);
    if (override) {
      return override.isEnabled;
    }
    
    if (permissionConfig) {
      return permissionConfig.defaults[action]?.includes(role) ?? false;
    }
    
    return false;
  }, [pendingChanges, rolePermissions, permissionConfig]);

  const togglePermission = (role: Role, action: string) => {
    if (!canManageUsers) return;
    
    const key = getPermissionKey(role, action);
    const currentValue = isPermissionGranted(role, action);
    
    setPendingChanges(prev => {
      const newMap = new Map(prev);
      newMap.set(key, !currentValue);
      return newMap;
    });
  };

  const saveChanges = async () => {
    if (!canManageUsers || pendingChanges.size === 0) return;
    
    setIsSaving(true);
    try {
      const permissions: { role: Role; action: string; isEnabled: boolean }[] = [];
      pendingChanges.forEach((isEnabled, key) => {
        const [role, action] = key.split(":") as [Role, string];
        permissions.push({ role, action, isEnabled });
      });

      const res = await fetch("/api/role-permissions", {
        method: "PATCH",
        headers: getAuthHeaders(),
        body: JSON.stringify({ permissions }),
      });

      if (!res.ok) {
        throw new Error("Failed to save permissions");
      }

      await queryClient.invalidateQueries({ queryKey: ["/api/role-permissions"] });
      setPendingChanges(new Map());
      toast({ title: "Permissions saved successfully" });
    } catch (error) {
      toast({ title: "Error", description: "Failed to save permissions", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const discardChanges = () => {
    setPendingChanges(new Map());
  };

  if (configLoading || permissionsLoading) {
    return (
      <Card>
        <CardContent className="py-12">
          <p className="text-center text-muted-foreground">Loading permissions...</p>
        </CardContent>
      </Card>
    );
  }

  if (!permissionConfig) {
    return (
      <Card>
        <CardContent className="py-12">
          <p className="text-center text-muted-foreground">Failed to load permission configuration</p>
        </CardContent>
      </Card>
    );
  }

  const { categories, labels, roles } = permissionConfig;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Key className="h-5 w-5" />
                Permission Matrix
              </CardTitle>
              <CardDescription className="mt-1">
                Configure which roles have access to specific actions. Check or uncheck boxes to grant or revoke permissions.
              </CardDescription>
            </div>
            {canManageUsers && pendingChanges.size > 0 && (
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-amber-600">
                  {pendingChanges.size} unsaved changes
                </Badge>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={discardChanges}
                  data-testid="button-discard-changes"
                >
                  Discard
                </Button>
                <Button
                  size="sm"
                  onClick={saveChanges}
                  disabled={isSaving}
                  data-testid="button-save-permissions"
                >
                  {isSaving ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-2" />
                      Save Changes
                    </>
                  )}
                </Button>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {!canManageUsers && (
            <div className="mb-4 p-3 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-900 rounded-lg">
              <div className="flex items-center gap-2 text-amber-800 dark:text-amber-200 text-sm">
                <Shield className="h-4 w-4" />
                <p>You can view permissions but cannot make changes. Only BIM Managers can modify role permissions.</p>
              </div>
            </div>
          )}

          <div className="swipe-hint">
            <div className="swipe-container">
              <table className="w-full border-collapse min-w-[600px]">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-4 font-semibold text-sm sticky left-0 bg-background min-w-[200px]">
                    Permission
                  </th>
                  {roles.map(role => (
                    <th key={role} className="py-3 px-2 text-center">
                      <Badge variant="secondary" className={`text-xs ${ROLE_COLORS[role] || ""}`}>
                        {ROLE_DISPLAY_NAMES[role] || role}
                      </Badge>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {categories.map(category => (
                  <React.Fragment key={category.name}>
                    <tr className="bg-muted/50">
                      <td colSpan={roles.length + 1} className="py-2 px-4 font-semibold text-sm text-muted-foreground">
                        {category.name}
                      </td>
                    </tr>
                    {category.actions.map(action => (
                      <tr key={action} className="border-b hover:bg-muted/30">
                        <td className="py-2 px-4 text-sm sticky left-0 bg-background">
                          {labels[action] || action}
                        </td>
                        {roles.map(role => {
                          const isGranted = isPermissionGranted(role, action);
                          const key = getPermissionKey(role, action);
                          const hasChange = pendingChanges.has(key);
                          
                          return (
                            <td key={role} className="py-2 px-2 text-center">
                              <div className="flex justify-center">
                                <Checkbox
                                  checked={isGranted}
                                  onCheckedChange={() => togglePermission(role, action)}
                                  disabled={!canManageUsers}
                                  className={hasChange ? "ring-2 ring-amber-500" : ""}
                                  data-testid={`checkbox-permission-${role}-${action}`}
                                />
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </React.Fragment>
                ))}
              </tbody>
              </table>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Role Descriptions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {roles.map(role => (
              <div key={role} className="p-3 border rounded-lg">
                <Badge variant="secondary" className={`text-xs ${ROLE_COLORS[role] || ""}`}>
                  {ROLE_DISPLAY_NAMES[role] || role}
                </Badge>
                <p className="text-xs text-muted-foreground mt-2">
                  {getRoleDescription(role)}
                </p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function getRoleDescription(role: Role): string {
  const descriptions: Record<Role, string> = {
    BIM_MANAGER: "Full administrative access to all features and projects",
    BIM_PROJECT_MANAGER: "Project-specific management with full access to assigned projects",
    BIM_COORDINATOR: "Coordinate meetings and points within assigned projects",
    BIM_DESIGNER: "Can edit only points assigned to them",
    ENGINEER: "Technical role with limited editing permissions",
    PROJECT_MANAGER: "Company-scoped access with project management capabilities",
    DESIGN_MANAGER: "Design-focused management role",
    VIEWER: "Read-only access to view data without modifications",
  };
  return descriptions[role] || "No description available";
}
