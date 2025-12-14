import { useState } from "react";
import { useLocation } from "wouter";
import { useAuth, ROLE_DISPLAY_NAMES, ROLE_COLORS, Role, COMPANY_ROLE_DISPLAY_NAMES, CompanyRole } from "@/contexts/auth-context";
import Layout from "@/components/layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  User, 
  Mail, 
  Building2, 
  Shield, 
  FolderKanban,
  Lock,
  Loader2,
  CheckCircle,
  AlertCircle,
  LogOut,
  Pencil,
  Save,
  X,
  Target,
  Clock,
  AlertTriangle,
  CheckCircle2,
  ListTodo,
  CalendarDays,
  Plus,
  UserPlus,
  Send,
  Trash2,
  MailCheck,
  MailX
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { format, isPast, isToday, isTomorrow, addDays } from "date-fns";

interface Project {
  id: string;
  name: string;
  code: string;
}

interface UserStats {
  totalPoints: number;
  openPoints: number;
  closedPoints: number;
  upcomingDeadlines: number;
  overduePoints: number;
}

interface AssignedPoint {
  id: string;
  title: string;
  description: string;
  status: string;
  dueDate: string;
  meetingId?: string;
  seriesId?: string;
  meetingTitle?: string;
  seriesTitle?: string;
  projectName?: string;
}

interface MyCompany {
  id: string;
  name: string;
  domain?: string;
  userRole: CompanyRole;
}

interface CompanyInvitation {
  id: string;
  companyId: string;
  email: string;
  companyRole: CompanyRole;
  status: string;
  token: string;
  expiresAt: string;
  inviterName: string;
  companyName?: string;
}

const STATUS_COLORS: Record<string, string> = {
  open: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  new: "bg-purple-500/10 text-purple-500 border-purple-500/20",
  ongoing: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
  closed: "bg-green-500/10 text-green-500 border-green-500/20",
  postponed: "bg-gray-500/10 text-gray-500 border-gray-500/20",
};

function getDueDateLabel(dueDate: string): { label: string; className: string } {
  const date = new Date(dueDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (isPast(date) && !isToday(date)) {
    return { label: "Overdue", className: "text-destructive" };
  }
  if (isToday(date)) {
    return { label: "Due Today", className: "text-yellow-600" };
  }
  if (isTomorrow(date)) {
    return { label: "Tomorrow", className: "text-yellow-500" };
  }
  const weekFromNow = addDays(today, 7);
  if (date <= weekFromNow) {
    return { label: format(date, "EEEE"), className: "text-muted-foreground" };
  }
  return { label: format(date, "MMM d"), className: "text-muted-foreground" };
}

export default function ProfilePage() {
  const [, setLocation] = useLocation();
  const { user, permissions, isLoading, logout, refreshAuth } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [isEditingName, setIsEditingName] = useState(false);
  const [editName, setEditName] = useState("");
  
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  
  // Company self-service state
  const [showCreateCompanyDialog, setShowCreateCompanyDialog] = useState(false);
  const [companyName, setCompanyName] = useState("");
  const [companyDomain, setCompanyDomain] = useState("");
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<CompanyRole>("EMPLOYEE");

  // Fetch user's company if they have one
  // Include user.companyName in key so query refetches when user joins a company
  const { data: myCompany, refetch: refetchMyCompany } = useQuery<MyCompany | null>({
    queryKey: ["/api/companies/mine", user?.companyName],
    queryFn: async () => {
      const response = await fetch("/api/companies/mine", { credentials: "include" });
      if (response.status === 404) return null;
      if (!response.ok) throw new Error("Failed to fetch company");
      return response.json();
    },
    enabled: !!user,
  });

  // Fetch pending invitations to the user
  const { data: pendingInvitations = [] } = useQuery<CompanyInvitation[]>({
    queryKey: ["/api/invitations/pending"],
    queryFn: async () => {
      const response = await fetch("/api/invitations/pending", { credentials: "include" });
      if (!response.ok) return [];
      return response.json();
    },
    enabled: !!user,
  });

  // Fetch company invitations (for owners/admins)
  const { data: companyInvitations = [] } = useQuery<CompanyInvitation[]>({
    queryKey: ["/api/companies", myCompany?.id, "invitations"],
    queryFn: async () => {
      if (!myCompany?.id) return [];
      const response = await fetch(`/api/companies/${myCompany.id}/invitations`, { credentials: "include" });
      if (!response.ok) return [];
      return response.json();
    },
    enabled: !!myCompany && ['OWNER', 'ADMIN'].includes(myCompany.userRole),
  });

  // Create company mutation
  const createCompanyMutation = useMutation({
    mutationFn: async (data: { name: string; domain?: string }) => {
      const response = await apiRequest("POST", "/api/companies/create-own", data);
      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || "Failed to create company");
      }
      return response.json();
    },
    onSuccess: async (createdCompany) => {
      toast({ title: "Company created", description: "Your company has been created successfully." });
      setShowCreateCompanyDialog(false);
      setCompanyName("");
      setCompanyDomain("");
      // Update company cache immediately with returned data
      const companyWithRole: MyCompany = {
        id: createdCompany.id,
        name: createdCompany.name,
        domain: createdCompany.emailDomain,
        userRole: 'OWNER',
      };
      // Set the company data directly in query cache for immediate UI update
      queryClient.setQueryData(["/api/companies/mine", null], companyWithRole);
      queryClient.setQueryData(["/api/companies/mine", createdCompany.name], companyWithRole);
      // Also refresh auth to update user context
      await refreshAuth();
    },
    onError: (error: Error) => {
      toast({ title: "Failed to create company", description: error.message, variant: "destructive" });
    },
  });

  // Send invitation mutation
  const sendInvitationMutation = useMutation({
    mutationFn: async (data: { email: string; companyRole: CompanyRole }) => {
      const response = await apiRequest("POST", `/api/companies/${myCompany?.id}/invitations`, data);
      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || "Failed to send invitation");
      }
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Invitation sent", description: `An invitation has been sent to ${inviteEmail}.` });
      setShowInviteDialog(false);
      setInviteEmail("");
      setInviteRole("EMPLOYEE");
      queryClient.invalidateQueries({ queryKey: ["/api/companies", myCompany?.id, "invitations"] });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to send invitation", description: error.message, variant: "destructive" });
    },
  });

  // Cancel invitation mutation
  const cancelInvitationMutation = useMutation({
    mutationFn: async (invitationId: string) => {
      const response = await apiRequest("DELETE", `/api/companies/${myCompany?.id}/invitations/${invitationId}`);
      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || "Failed to cancel invitation");
      }
    },
    onSuccess: () => {
      toast({ title: "Invitation cancelled" });
      queryClient.invalidateQueries({ queryKey: ["/api/companies", myCompany?.id, "invitations"] });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to cancel invitation", description: error.message, variant: "destructive" });
    },
  });

  // Accept invitation mutation
  const acceptInvitationMutation = useMutation({
    mutationFn: async (token: string) => {
      const response = await apiRequest("POST", `/api/invitations/${token}/accept`);
      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || "Failed to accept invitation");
      }
      return response.json();
    },
    onSuccess: async () => {
      toast({ title: "Invitation accepted", description: "You have joined the company." });
      queryClient.invalidateQueries({ queryKey: ["/api/invitations/pending"] });
      // First refresh auth to update user.companyName, then refetch company data
      await refreshAuth();
      await refetchMyCompany();
    },
    onError: (error: Error) => {
      toast({ title: "Failed to accept invitation", description: error.message, variant: "destructive" });
    },
  });

  // Decline invitation mutation
  const declineInvitationMutation = useMutation({
    mutationFn: async (token: string) => {
      const response = await apiRequest("POST", `/api/invitations/${token}/decline`);
      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || "Failed to decline invitation");
      }
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Invitation declined" });
      queryClient.invalidateQueries({ queryKey: ["/api/invitations/pending"] });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to decline invitation", description: error.message, variant: "destructive" });
    },
  });

  const { data: userProjects = [] } = useQuery<Project[]>({
    queryKey: ["/api/users", user?.id, "projects"],
    queryFn: async () => {
      if (!user) return [];
      const response = await fetch(`/api/users/${user.id}/projects`);
      if (!response.ok) return [];
      return response.json();
    },
    enabled: !!user,
  });

  const { data: userStats } = useQuery<UserStats>({
    queryKey: ["/api/users", user?.id, "stats"],
    queryFn: async () => {
      if (!user) return null;
      const response = await fetch(`/api/users/${user.id}/stats`);
      if (!response.ok) return null;
      return response.json();
    },
    enabled: !!user,
  });

  const { data: assignedPoints = [] } = useQuery<AssignedPoint[]>({
    queryKey: ["/api/users", user?.id, "assigned-points"],
    queryFn: async () => {
      if (!user) return [];
      const response = await fetch(`/api/users/${user.id}/assigned-points`);
      if (!response.ok) return [];
      return response.json();
    },
    enabled: !!user,
  });

  const updateNameMutation = useMutation({
    mutationFn: async (name: string) => {
      const response = await apiRequest("PATCH", `/api/users/${user?.id}`, { name });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to update name");
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Name updated",
        description: "Your display name has been updated successfully.",
      });
      setIsEditingName(false);
      refreshAuth();
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Update failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleStartEditName = () => {
    setEditName(user?.name || "");
    setIsEditingName(true);
  };

  const handleSaveName = () => {
    if (editName.trim() && editName !== user?.name) {
      updateNameMutation.mutate(editName.trim());
    } else {
      setIsEditingName(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);
    setPasswordSuccess(false);

    if (newPassword !== confirmPassword) {
      setPasswordError("New passwords do not match");
      return;
    }

    if (newPassword.length < 8) {
      setPasswordError("New password must be at least 8 characters");
      return;
    }

    setIsChangingPassword(true);

    try {
      const response = await apiRequest("POST", "/api/auth/change-password", {
        currentPassword,
        newPassword,
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to change password");
      }

      setPasswordSuccess(true);
      toast({
        title: "Password changed",
        description: "Your password has been updated successfully.",
      });

      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (error: any) {
      setPasswordError(error.message || "Failed to change password");
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await logout();
      toast({
        title: "Signed out",
        description: "You have been signed out successfully.",
      });
      setLocation("/login");
    } catch (error) {
      toast({
        title: "Sign out failed",
        description: "There was an error signing out. Please try again.",
        variant: "destructive",
      });
    }
  };

  const openPoints = assignedPoints.filter(p => ['open', 'new', 'ongoing'].includes(p.status));
  const completionRate = userStats && userStats.totalPoints > 0 
    ? Math.round((userStats.closedPoints / userStats.totalPoints) * 100) 
    : 0;

  if (isLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-full">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </Layout>
    );
  }

  if (!user) {
    return (
      <Layout>
        <div className="px-4 sm:px-6 py-6">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              You need to be logged in to view your profile.
            </AlertDescription>
          </Alert>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="px-4 sm:px-6 py-6 max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <User className="h-6 w-6" />
            <h1 className="text-2xl font-bold" data-testid="text-profile-title">My Profile</h1>
          </div>
          <Button 
            variant="outline" 
            onClick={handleSignOut}
            data-testid="button-profile-signout"
          >
            <LogOut className="h-4 w-4 mr-2" />
            Sign Out
          </Button>
        </div>

        {userStats && (
          <div className="grid gap-4 grid-cols-2 md:grid-cols-5" data-testid="container-user-stats">
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <ListTodo className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold" data-testid="text-total-points">{userStats.totalPoints}</p>
                    <p className="text-xs text-muted-foreground">Total Points</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-lg bg-blue-500/10">
                    <Target className="h-4 w-4 text-blue-500" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold" data-testid="text-open-points">{userStats.openPoints}</p>
                    <p className="text-xs text-muted-foreground">Open</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-lg bg-green-500/10">
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold" data-testid="text-closed-points">{userStats.closedPoints}</p>
                    <p className="text-xs text-muted-foreground">Closed</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-lg bg-yellow-500/10">
                    <Clock className="h-4 w-4 text-yellow-500" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold" data-testid="text-upcoming-deadlines">{userStats.upcomingDeadlines}</p>
                    <p className="text-xs text-muted-foreground">Upcoming</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-lg bg-destructive/10">
                    <AlertTriangle className="h-4 w-4 text-destructive" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold" data-testid="text-overdue-points">{userStats.overduePoints}</p>
                    <p className="text-xs text-muted-foreground">Overdue</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {userStats && userStats.totalPoints > 0 && (
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Completion Rate</span>
                <span className="text-sm text-muted-foreground">{completionRate}%</span>
              </div>
              <Progress value={completionRate} className="h-2" data-testid="progress-completion-rate" />
            </CardContent>
          </Card>
        )}

        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Account Information</CardTitle>
              <CardDescription>Your personal details and account settings</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center gap-4">
                <Avatar className="h-16 w-16">
                  <AvatarFallback className="text-xl">
                    {user.name.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  {isEditingName ? (
                    <div className="flex items-center gap-2">
                      <Input
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="h-8"
                        autoFocus
                        data-testid="input-edit-name"
                      />
                      <Button 
                        size="icon" 
                        variant="ghost" 
                        className="h-8 w-8"
                        onClick={handleSaveName}
                        disabled={updateNameMutation.isPending}
                        data-testid="button-save-name"
                      >
                        {updateNameMutation.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Save className="h-4 w-4" />
                        )}
                      </Button>
                      <Button 
                        size="icon" 
                        variant="ghost" 
                        className="h-8 w-8"
                        onClick={() => setIsEditingName(false)}
                        data-testid="button-cancel-edit-name"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-lg" data-testid="text-user-name">{user.name}</h3>
                      <Button 
                        size="icon" 
                        variant="ghost" 
                        className="h-6 w-6"
                        onClick={handleStartEditName}
                        data-testid="button-edit-name"
                      >
                        <Pencil className="h-3 w-3" />
                      </Button>
                    </div>
                  )}
                </div>
              </div>

              <Separator />

              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <Mail className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-sm font-medium">Email</p>
                    <p className="text-sm text-muted-foreground" data-testid="text-user-email">{user.email}</p>
                  </div>
                </div>

                {user.companyName && (
                  <div className="flex items-start gap-3">
                    <Building2 className="h-5 w-5 text-muted-foreground mt-0.5" />
                    <div>
                      <p className="text-sm font-medium">Company</p>
                      <p className="text-sm text-muted-foreground" data-testid="text-user-company">{user.companyName}</p>
                    </div>
                  </div>
                )}

                <div className="flex items-start gap-3">
                  <Shield className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-sm font-medium mb-2">Roles</p>
                    <div className="flex flex-wrap gap-1" data-testid="container-user-roles">
                      {user.roles.map((role) => (
                        <Badge 
                          key={role} 
                          variant="secondary"
                          className={ROLE_COLORS[role as Role]}
                          data-testid={`badge-role-${role}`}
                        >
                          {ROLE_DISPLAY_NAMES[role as Role]}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <FolderKanban className="h-5 w-5" />
                Assigned Projects
              </CardTitle>
              <CardDescription>Projects you have access to</CardDescription>
            </CardHeader>
            <CardContent>
              {permissions?.isBimManager ? (
                <div className="text-sm text-muted-foreground" data-testid="text-bim-manager-access">
                  <Badge variant="outline" className="mb-2">BIM Manager</Badge>
                  <p>As a BIM Manager, you have access to all projects.</p>
                </div>
              ) : userProjects.length > 0 ? (
                <div className="space-y-2" data-testid="container-assigned-projects">
                  {userProjects.map((project) => (
                    <div 
                      key={project.id}
                      className="flex items-center justify-between p-2 rounded-md border"
                      data-testid={`project-${project.id}`}
                    >
                      <span className="font-medium">{project.name}</span>
                      <Badge variant="outline">{project.code}</Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground" data-testid="text-no-projects">
                  You haven't been assigned to any projects yet. 
                  Contact your BIM Manager for project access.
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Pending invitations section */}
        {pendingInvitations.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <MailCheck className="h-5 w-5" />
                Pending Invitations
              </CardTitle>
              <CardDescription>You have been invited to join a company</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3" data-testid="container-pending-invitations">
                {pendingInvitations.map((invitation) => (
                  <div 
                    key={invitation.id}
                    className="flex items-center justify-between p-3 rounded-lg border bg-muted/30"
                    data-testid={`invitation-${invitation.id}`}
                  >
                    <div>
                      <p className="font-medium">{invitation.companyName}</p>
                      <p className="text-sm text-muted-foreground">
                        Invited by {invitation.inviterName} as {COMPANY_ROLE_DISPLAY_NAMES[invitation.companyRole as CompanyRole] || invitation.companyRole}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Expires {format(new Date(invitation.expiresAt), "MMM d, yyyy")}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => acceptInvitationMutation.mutate(invitation.token)}
                        disabled={acceptInvitationMutation.isPending || declineInvitationMutation.isPending}
                        data-testid={`button-accept-invitation-${invitation.id}`}
                      >
                        {acceptInvitationMutation.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <CheckCircle className="h-4 w-4 mr-1" />
                        )}
                        Accept
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => declineInvitationMutation.mutate(invitation.token)}
                        disabled={acceptInvitationMutation.isPending || declineInvitationMutation.isPending}
                        data-testid={`button-decline-invitation-${invitation.id}`}
                      >
                        <X className="h-4 w-4 mr-1" />
                        Decline
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Company section */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Building2 className="h-5 w-5" />
                  {myCompany ? "My Company" : "Company"}
                </CardTitle>
                <CardDescription>
                  {myCompany 
                    ? "Your company details and team management" 
                    : "Create your own company or wait for an invitation"
                  }
                </CardDescription>
              </div>
              {myCompany && ['OWNER', 'ADMIN'].includes(myCompany.userRole) && (
                <Dialog open={showInviteDialog} onOpenChange={setShowInviteDialog}>
                  <DialogTrigger asChild>
                    <Button size="sm" data-testid="button-invite-team-member">
                      <UserPlus className="h-4 w-4 mr-1" />
                      Invite Team Member
                    </Button>
                  </DialogTrigger>
                  <DialogContent aria-describedby="invite-dialog-description">
                    <DialogHeader>
                      <DialogTitle>Invite Team Member</DialogTitle>
                      <DialogDescription id="invite-dialog-description">
                        Send an invitation to join {myCompany.name}
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label htmlFor="invite-email">Email Address</Label>
                        <Input
                          id="invite-email"
                          type="email"
                          placeholder="colleague@example.com"
                          value={inviteEmail}
                          onChange={(e) => setInviteEmail(e.target.value)}
                          data-testid="input-invite-email"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="invite-role">Role</Label>
                        <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as CompanyRole)}>
                          <SelectTrigger data-testid="select-invite-role">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="ADMIN">Admin</SelectItem>
                            <SelectItem value="DEPARTMENT_MANAGER">Department Manager</SelectItem>
                            <SelectItem value="EMPLOYEE">Employee</SelectItem>
                            <SelectItem value="GUEST">Guest</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button
                        onClick={() => sendInvitationMutation.mutate({ email: inviteEmail, companyRole: inviteRole })}
                        disabled={!inviteEmail || sendInvitationMutation.isPending}
                        data-testid="button-send-invitation"
                      >
                        {sendInvitationMutation.isPending ? (
                          <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                        ) : (
                          <Send className="h-4 w-4 mr-1" />
                        )}
                        Send Invitation
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {myCompany ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
                  <div>
                    <p className="font-medium" data-testid="text-company-name">{myCompany.name}</p>
                    <p className="text-sm text-muted-foreground">
                      Your role: <Badge variant="outline">{COMPANY_ROLE_DISPLAY_NAMES[myCompany.userRole] || myCompany.userRole}</Badge>
                    </p>
                  </div>
                </div>

                {['OWNER', 'ADMIN'].includes(myCompany.userRole) && companyInvitations.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Pending Invitations</p>
                    {companyInvitations.map((inv) => (
                      <div 
                        key={inv.id} 
                        className="flex items-center justify-between p-2 rounded border text-sm"
                        data-testid={`company-invitation-${inv.id}`}
                      >
                        <div>
                          <span className="font-medium">{inv.email}</span>
                          <Badge variant="outline" className="ml-2">
                            {COMPANY_ROLE_DISPLAY_NAMES[inv.companyRole as CompanyRole] || inv.companyRole}
                          </Badge>
                          <span className="text-muted-foreground ml-2">
                            Expires {format(new Date(inv.expiresAt), "MMM d")}
                          </span>
                        </div>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8"
                          onClick={() => cancelInvitationMutation.mutate(inv.id)}
                          disabled={cancelInvitationMutation.isPending}
                          data-testid={`button-cancel-invitation-${inv.id}`}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground" data-testid="text-no-company">
                  You don't belong to any company yet. Create your own company to start inviting team members, 
                  or wait for an invitation from an existing company.
                </p>
                <Dialog open={showCreateCompanyDialog} onOpenChange={setShowCreateCompanyDialog}>
                  <DialogTrigger asChild>
                    <Button data-testid="button-create-company">
                      <Plus className="h-4 w-4 mr-1" />
                      Create Company
                    </Button>
                  </DialogTrigger>
                  <DialogContent aria-describedby="create-company-dialog-description">
                    <DialogHeader>
                      <DialogTitle>Create Your Company</DialogTitle>
                      <DialogDescription id="create-company-dialog-description">
                        Set up your company to invite team members and manage projects together.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label htmlFor="company-name">Company Name *</Label>
                        <Input
                          id="company-name"
                          placeholder="Acme Construction"
                          value={companyName}
                          onChange={(e) => setCompanyName(e.target.value)}
                          data-testid="input-company-name"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="company-domain">Email Domain (optional)</Label>
                        <Input
                          id="company-domain"
                          placeholder="acme.com"
                          value={companyDomain}
                          onChange={(e) => setCompanyDomain(e.target.value)}
                          data-testid="input-company-domain"
                        />
                        <p className="text-xs text-muted-foreground">
                          If set, new users with this email domain can auto-join your company.
                        </p>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button
                        onClick={() => createCompanyMutation.mutate({ 
                          name: companyName, 
                          domain: companyDomain || undefined 
                        })}
                        disabled={!companyName || createCompanyMutation.isPending}
                        data-testid="button-submit-create-company"
                      >
                        {createCompanyMutation.isPending ? (
                          <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                        ) : (
                          <CheckCircle className="h-4 w-4 mr-1" />
                        )}
                        Create Company
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            )}
          </CardContent>
        </Card>

        {openPoints.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <CalendarDays className="h-5 w-5" />
                My Open Points
              </CardTitle>
              <CardDescription>Points assigned to you that are still open</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3" data-testid="container-assigned-points">
                {openPoints.slice(0, 10).map((point) => {
                  const dueDateInfo = getDueDateLabel(point.dueDate);
                  return (
                    <div 
                      key={point.id}
                      className="flex items-start justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors cursor-pointer"
                      onClick={() => {
                        if (point.meetingId) {
                          setLocation(`/meetings/${point.meetingId}`);
                        } else if (point.seriesId) {
                          setLocation(`/series/${point.seriesId}`);
                        }
                      }}
                      data-testid={`point-${point.id}`}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant="outline" className="text-xs">{point.id}</Badge>
                          <Badge variant="outline" className={STATUS_COLORS[point.status]}>
                            {point.status}
                          </Badge>
                        </div>
                        <p className="font-medium truncate">{point.title}</p>
                        <p className="text-sm text-muted-foreground truncate">
                          {point.projectName && `${point.projectName} • `}
                          {point.meetingTitle || point.seriesTitle}
                        </p>
                      </div>
                      <div className="text-right ml-4 shrink-0">
                        <p className={`text-sm font-medium ${dueDateInfo.className}`}>
                          {dueDateInfo.label}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(point.dueDate), "MMM d, yyyy")}
                        </p>
                      </div>
                    </div>
                  );
                })}
                {openPoints.length > 10 && (
                  <p className="text-sm text-muted-foreground text-center py-2">
                    And {openPoints.length - 10} more open points...
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Lock className="h-5 w-5" />
              Change Password
            </CardTitle>
            <CardDescription>
              Update your password to keep your account secure
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleChangePassword} className="space-y-4 max-w-md">
              {passwordError && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{passwordError}</AlertDescription>
                </Alert>
              )}

              {passwordSuccess && (
                <Alert>
                  <CheckCircle className="h-4 w-4" />
                  <AlertDescription>Password changed successfully!</AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                <Label htmlFor="current-password">Current Password</Label>
                <Input
                  id="current-password"
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Enter current password"
                  required
                  data-testid="input-current-password"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="new-password">New Password</Label>
                <Input
                  id="new-password"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Min. 8 characters"
                  required
                  minLength={8}
                  data-testid="input-new-password"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirm-password">Confirm New Password</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter new password"
                  required
                  data-testid="input-confirm-password"
                />
              </div>

              <Button 
                type="submit" 
                disabled={isChangingPassword}
                data-testid="button-change-password"
              >
                {isChangingPassword ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Changing...
                  </>
                ) : (
                  <>
                    <CheckCircle className="mr-2 h-4 w-4" />
                    Change Password
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
