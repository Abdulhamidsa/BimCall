import { useState } from "react";
import Layout from "@/components/layout";
import Breadcrumb from "@/components/breadcrumb";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Plus,
  MapPin,
  Building2,
  Calendar,
  FolderOpen,
  Clock,
  Users,
  Video,
  UserPlus,
  MoreHorizontal,
  UserMinus,
  ExternalLink,
  Home,
  Briefcase,
  UserCog,
  FileText,
  AlertCircle,
  CheckCircle2,
  Circle,
  File,
  FileImage,
  Download,
  LayoutGrid,
  ListTodo,
  Paperclip,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { projectsApi, meetingsApi, usersApi, type ProjectUser } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Link, useParams } from "wouter";
import { format } from "date-fns";
import type { Meeting, ProjectRole, Point, Attachment } from "@shared/schema";
import { COMPANY_ROLE_DISPLAY_NAMES, PROJECT_ROLE_DISPLAY_NAMES } from "@shared/schema";

const statusColors: Record<string, string> = {
  planning: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
  active: "bg-green-500/10 text-green-500 border-green-500/20",
  on_hold: "bg-orange-500/10 text-orange-500 border-orange-500/20",
  completed: "bg-blue-500/10 text-blue-500 border-blue-500/20",
};

const pointStatusColors: Record<string, string> = {
  open: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  new: "bg-purple-500/10 text-purple-500 border-purple-500/20",
  ongoing: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
  closed: "bg-green-500/10 text-green-500 border-green-500/20",
  postponed: "bg-gray-500/10 text-gray-500 border-gray-500/20",
};

const constructionTypeLabels: Record<string, string> = {
  commercial: "Commercial",
  residential: "Residential",
  infrastructure: "Infrastructure",
  healthcare: "Healthcare",
  industrial: "Industrial",
};

function MeetingCard({ meeting }: { meeting: Meeting }) {
  return (
    <Link href={`/meeting/${meeting.id}`}>
      <Card className="group cursor-pointer hover:shadow-md transition-all hover:border-primary/30" data-testid={`card-meeting-${meeting.id}`}>
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <h4 className="font-medium truncate group-hover:text-primary transition-colors" data-testid={`text-meeting-title-${meeting.id}`}>
                {meeting.title}
              </h4>
              <div className="flex flex-wrap gap-3 mt-2 text-sm text-muted-foreground">
                <div className="flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5" />
                  <span>{format(new Date(meeting.date), "MMM d, yyyy")}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5" />
                  <span>{meeting.startTime} - {meeting.endTime}</span>
                </div>
              </div>
            </div>
            <Badge variant="outline" className="shrink-0">
              <Video className="h-3 w-3 mr-1" />
              {meeting.platform}
            </Badge>
          </div>
          {meeting.agenda && (
            <p className="text-sm text-muted-foreground mt-3 line-clamp-2">{meeting.agenda}</p>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}

function AddMeetingToProjectDialog({ projectId, projectName }: { projectId: string; projectName: string }) {
  const [open, setOpen] = useState(false);
  const [formData, setFormData] = useState({
    title: "",
    date: format(new Date(), "yyyy-MM-dd"),
    startTime: "10:00",
    endTime: "11:30",
    location: "",
    platform: "outlook" as "outlook" | "gmail",
    agenda: "",
  });

  const queryClient = useQueryClient();
  const { toast } = useToast();

  const createMutation = useMutation({
    mutationFn: meetingsApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project", projectId] });
      queryClient.invalidateQueries({ queryKey: ["meetings"] });
      setOpen(false);
      resetForm();
      toast({
        title: "Meeting Created",
        description: "The meeting has been scheduled.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create meeting.",
        variant: "destructive",
      });
    },
  });

  const resetForm = () => {
    setFormData({
      title: "",
      date: format(new Date(), "yyyy-MM-dd"),
      startTime: "10:00",
      endTime: "11:30",
      location: "",
      platform: "outlook",
      agenda: "",
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title || !formData.location) return;
    
    createMutation.mutate({
      ...formData,
      projectId,
      project: projectName,
      agenda: formData.agenda || null,
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" data-testid="button-add-meeting">
          <Plus className="h-4 w-4 mr-1" /> Add Meeting
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Schedule Meeting</DialogTitle>
          <DialogDescription>Create a new coordination meeting for this project.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-4">
          <div className="space-y-2">
            <Label htmlFor="title">Meeting Title</Label>
            <Input
              id="title"
              placeholder="e.g., Weekly Coordination Meeting"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              required
              data-testid="input-meeting-title"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-2">
              <Label htmlFor="date">Date</Label>
              <Input
                id="date"
                type="date"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                required
                data-testid="input-meeting-date"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="startTime">Start</Label>
              <Input
                id="startTime"
                type="time"
                value={formData.startTime}
                onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                required
                data-testid="input-start-time"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="endTime">End</Label>
              <Input
                id="endTime"
                type="time"
                value={formData.endTime}
                onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                required
                data-testid="input-end-time"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="location">Location</Label>
              <Input
                id="location"
                placeholder="e.g., Conf Room B / Teams"
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                required
                data-testid="input-location"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="platform">Platform</Label>
              <Select value={formData.platform} onValueChange={(v: "outlook" | "gmail") => setFormData({ ...formData, platform: v })}>
                <SelectTrigger data-testid="select-platform">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="outlook">Outlook</SelectItem>
                  <SelectItem value="gmail">Gmail</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="agenda">Agenda (optional)</Label>
            <Input
              id="agenda"
              placeholder="Meeting agenda notes..."
              value={formData.agenda}
              onChange={(e) => setFormData({ ...formData, agenda: e.target.value })}
              data-testid="input-agenda"
            />
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => setOpen(false)} data-testid="button-cancel">
              Cancel
            </Button>
            <Button type="submit" disabled={createMutation.isPending} data-testid="button-create-meeting">
              {createMutation.isPending ? "Creating..." : "Create Meeting"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ProjectTeamSection({ projectId, ownerCompanyId }: { projectId: string; ownerCompanyId?: string | null }) {
  const [addMemberOpen, setAddMemberOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRole, setSelectedRole] = useState<ProjectRole>("PROJECT_VIEWER");
  const [confirmRemove, setConfirmRemove] = useState<ProjectUser | null>(null);
  
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  const { data: projectUsers = [], isLoading: loadingProjectUsers } = useQuery({
    queryKey: ["project-users", projectId],
    queryFn: () => projectsApi.getUsers(projectId),
  });
  
  const { data: allUsers = [], isLoading: loadingAllUsers } = useQuery({
    queryKey: ["all-users"],
    queryFn: () => usersApi.getAll(),
    enabled: addMemberOpen,
  });
  
  const addUserMutation = useMutation({
    mutationFn: (userId: string) => projectsApi.addUser(projectId, userId, selectedRole),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project-users", projectId] });
      setAddMemberOpen(false);
      setSearchQuery("");
      setSelectedRole("PROJECT_VIEWER");
      toast({
        title: "Team Member Added",
        description: "User has been added to the project.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to add team member.",
        variant: "destructive",
      });
    },
  });
  
  const updateRoleMutation = useMutation({
    mutationFn: ({ userId, projectRole }: { userId: string; projectRole: ProjectRole }) => 
      projectsApi.updateUserRole(projectId, userId, projectRole),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project-users", projectId] });
      toast({
        title: "Role Updated",
        description: "Project role has been updated.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update role.",
        variant: "destructive",
      });
    },
  });
  
  const removeUserMutation = useMutation({
    mutationFn: (userId: string) => projectsApi.removeUser(projectId, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project-users", projectId] });
      setConfirmRemove(null);
      toast({
        title: "Team Member Removed",
        description: "User has been removed from the project.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to remove team member.",
        variant: "destructive",
      });
    },
  });
  
  const projectUserIds = new Set(projectUsers.map(u => u.id));
  const availableUsers = allUsers.filter(u => 
    !projectUserIds.has(u.id) &&
    (searchQuery === "" || 
     u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
     u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
     (u.companyName && u.companyName.toLowerCase().includes(searchQuery.toLowerCase())))
  );
  
  const getInitials = (name: string) => {
    return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
  };
  
  const isInternal = (user: ProjectUser) => {
    if (!ownerCompanyId) return true;
    return user.companyId === ownerCompanyId;
  };
  
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Users className="h-5 w-5" />
          Project Team ({projectUsers.length})
        </h2>
        <Dialog open={addMemberOpen} onOpenChange={setAddMemberOpen}>
          <DialogTrigger asChild>
            <Button size="sm" data-testid="button-add-team-member">
              <UserPlus className="h-4 w-4 mr-1" /> Add Team Member
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Add Team Member</DialogTitle>
              <DialogDescription>
                Select a user and assign a project role.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label>Project Role</Label>
                <Select value={selectedRole} onValueChange={(v: ProjectRole) => setSelectedRole(v)}>
                  <SelectTrigger data-testid="select-project-role">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(PROJECT_ROLE_DISPLAY_NAMES) as ProjectRole[]).map((role) => (
                      <SelectItem key={role} value={role}>
                        {PROJECT_ROLE_DISPLAY_NAMES[role]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Input
                placeholder="Search users by name, email, or company..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                data-testid="input-search-users"
              />
              <ScrollArea className="h-[300px]">
                {loadingAllUsers ? (
                  <div className="text-center py-6 text-muted-foreground">Loading users...</div>
                ) : availableUsers.length === 0 ? (
                  <div className="text-center py-6 text-muted-foreground">
                    {searchQuery ? "No users match your search" : "All users are already on this project"}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {availableUsers.map((user) => (
                      <div 
                        key={user.id}
                        className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 cursor-pointer transition-colors"
                        onClick={() => addUserMutation.mutate(user.id)}
                        data-testid={`user-option-${user.id}`}
                      >
                        <div className="flex items-center gap-3">
                          <Avatar className="h-9 w-9">
                            <AvatarImage src={user.avatar || undefined} />
                            <AvatarFallback className="text-xs">{getInitials(user.name)}</AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium text-sm">{user.name}</p>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <span>{user.email}</span>
                              {user.companyName && (
                                <>
                                  <span>•</span>
                                  <span>{user.companyName}</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                        <Plus className="h-4 w-4 text-muted-foreground" />
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {loadingProjectUsers ? (
        <Card className="p-8 text-center">
          <p className="text-muted-foreground">Loading team members...</p>
        </Card>
      ) : projectUsers.length === 0 ? (
        <Card className="p-8 text-center">
          <Users className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
          <h3 className="text-lg font-medium mb-1">No team members</h3>
          <p className="text-muted-foreground">Add users to this project to start collaborating.</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {projectUsers.map((user) => (
            <Card key={user.id} className="group" data-testid={`card-team-member-${user.id}`}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={user.avatar || undefined} />
                      <AvatarFallback>{getInitials(user.name)}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="font-medium truncate" data-testid={`text-member-name-${user.id}`}>{user.name}</p>
                      <p className="text-sm text-muted-foreground truncate">{user.email}</p>
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuSub>
                        <DropdownMenuSubTrigger>
                          <UserCog className="h-4 w-4 mr-2" />
                          Change Role
                        </DropdownMenuSubTrigger>
                        <DropdownMenuSubContent>
                          {(Object.keys(PROJECT_ROLE_DISPLAY_NAMES) as ProjectRole[]).map((role) => (
                            <DropdownMenuItem
                              key={role}
                              onClick={() => updateRoleMutation.mutate({ userId: user.id, projectRole: role })}
                              className={user.projectRole === role ? "bg-accent" : ""}
                            >
                              {PROJECT_ROLE_DISPLAY_NAMES[role]}
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuSubContent>
                      </DropdownMenuSub>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem 
                        onClick={() => setConfirmRemove(user)}
                        className="text-destructive focus:text-destructive"
                      >
                        <UserMinus className="h-4 w-4 mr-2" />
                        Remove from Project
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                <div className="flex flex-wrap items-center gap-2 mt-3">
                  {user.projectRole && PROJECT_ROLE_DISPLAY_NAMES[user.projectRole as ProjectRole] && (
                    <Badge className="text-xs bg-primary/10 text-primary border-primary/20" data-testid={`badge-project-role-${user.id}`}>
                      <Briefcase className="h-3 w-3 mr-1" />
                      {PROJECT_ROLE_DISPLAY_NAMES[user.projectRole as ProjectRole]}
                    </Badge>
                  )}
                  {user.companyName && (
                    <Badge variant="outline" className="text-xs">
                      <Building2 className="h-3 w-3 mr-1" />
                      {user.companyName}
                    </Badge>
                  )}
                  {user.companyRole && COMPANY_ROLE_DISPLAY_NAMES[user.companyRole as keyof typeof COMPANY_ROLE_DISPLAY_NAMES] && (
                    <Badge variant="secondary" className="text-xs">
                      {COMPANY_ROLE_DISPLAY_NAMES[user.companyRole as keyof typeof COMPANY_ROLE_DISPLAY_NAMES]}
                    </Badge>
                  )}
                  <Badge 
                    variant="outline" 
                    className={`text-xs ${isInternal(user) ? "bg-green-500/10 text-green-600 border-green-500/20" : "bg-blue-500/10 text-blue-600 border-blue-500/20"}`}
                  >
                    {isInternal(user) ? (
                      <>
                        <Home className="h-3 w-3 mr-1" />
                        Internal
                      </>
                    ) : (
                      <>
                        <ExternalLink className="h-3 w-3 mr-1" />
                        External
                      </>
                    )}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <AlertDialog open={!!confirmRemove} onOpenChange={(open) => !open && setConfirmRemove(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Team Member</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove {confirmRemove?.name} from this project? They will no longer have access to project resources.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => confirmRemove && removeUserMutation.mutate(confirmRemove.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function ProjectPointsSection({ projectId }: { projectId: string }) {
  const { data: projectPoints = [], isLoading } = useQuery({
    queryKey: ["project-points", projectId],
    queryFn: () => projectsApi.getPoints(projectId),
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'closed':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'open':
      case 'new':
        return <AlertCircle className="h-4 w-4 text-blue-500" />;
      case 'ongoing':
        return <Circle className="h-4 w-4 text-yellow-500" />;
      default:
        return <Circle className="h-4 w-4 text-gray-500" />;
    }
  };

  const openPoints = projectPoints.filter(p => p.status !== 'closed');
  const closedPoints = projectPoints.filter(p => p.status === 'closed');

  if (isLoading) {
    return (
      <Card className="p-8 text-center">
        <p className="text-muted-foreground">Loading points...</p>
      </Card>
    );
  }

  if (projectPoints.length === 0) {
    return (
      <Card className="p-8 text-center">
        <ListTodo className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
        <h3 className="text-lg font-medium mb-1">No coordination points</h3>
        <p className="text-muted-foreground">Create points in meetings or series to track issues and action items.</p>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="bg-blue-500/10 text-blue-600 border-blue-500/20">
            {openPoints.length} Open
          </Badge>
          <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/20">
            {closedPoints.length} Closed
          </Badge>
        </div>
      </div>

      <div className="space-y-3">
        {projectPoints.map((point) => (
          <Card key={point.id} className="group hover:shadow-md transition-all" data-testid={`card-point-${point.id}`}>
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                {getStatusIcon(point.status)}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-medium" data-testid={`text-point-title-${point.id}`}>{point.title}</p>
                      <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{point.description}</p>
                    </div>
                    <Badge variant="outline" className={pointStatusColors[point.status] || ""}>
                      {point.status}
                    </Badge>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 mt-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Users className="h-3 w-3" />
                      {point.assignedTo}
                    </span>
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      Due: {point.dueDate}
                    </span>
                    {point.meetingTitle && (
                      <Badge variant="secondary" className="text-xs">
                        Meeting: {point.meetingTitle}
                      </Badge>
                    )}
                    {point.seriesTitle && (
                      <Badge variant="secondary" className="text-xs">
                        Series: {point.seriesTitle}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function ProjectFilesSection({ projectId }: { projectId: string }) {
  const { data: projectFiles = [], isLoading } = useQuery({
    queryKey: ["project-files", projectId],
    queryFn: () => projectsApi.getFiles(projectId),
  });

  const getFileIcon = (type: string) => {
    switch (type) {
      case 'img':
        return <FileImage className="h-5 w-5 text-green-500" />;
      case 'pdf':
        return <FileText className="h-5 w-5 text-red-500" />;
      default:
        return <File className="h-5 w-5 text-blue-500" />;
    }
  };

  if (isLoading) {
    return (
      <Card className="p-8 text-center">
        <p className="text-muted-foreground">Loading files...</p>
      </Card>
    );
  }

  if (projectFiles.length === 0) {
    return (
      <Card className="p-8 text-center">
        <Paperclip className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
        <h3 className="text-lg font-medium mb-1">No files</h3>
        <p className="text-muted-foreground">Attachments added to coordination points will appear here.</p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Badge variant="outline">{projectFiles.length} files</Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {projectFiles.map((file) => (
          <Card key={file.id} className="group hover:shadow-md transition-all" data-testid={`card-file-${file.id}`}>
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                {getFileIcon(file.type)}
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate" data-testid={`text-file-name-${file.id}`}>{file.name}</p>
                  <div className="flex flex-wrap items-center gap-2 mt-2 text-xs text-muted-foreground">
                    <span>{file.size}</span>
                    <span>•</span>
                    <span>Point: {file.pointTitle}</span>
                  </div>
                  {(file.meetingTitle || file.seriesTitle) && (
                    <div className="mt-2">
                      <Badge variant="secondary" className="text-xs">
                        {file.meetingTitle ? `Meeting: ${file.meetingTitle}` : `Series: ${file.seriesTitle}`}
                      </Badge>
                    </div>
                  )}
                </div>
                {file.url && (
                  <a 
                    href={file.url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <Download className="h-4 w-4" />
                    </Button>
                  </a>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

export default function ProjectDetail() {
  const params = useParams<{ id: string }>();
  const projectId = params.id!;

  const { data: project, isLoading } = useQuery({
    queryKey: ["project", projectId],
    queryFn: () => projectsApi.getById(projectId),
  });

  if (isLoading) {
    return (
      <Layout>
        <div className="container mx-auto px-4 sm:px-6 py-6 max-w-6xl">
          <div className="text-center py-12 text-muted-foreground">Loading project...</div>
        </div>
      </Layout>
    );
  }

  if (!project) {
    return (
      <Layout>
        <div className="container mx-auto px-4 sm:px-6 py-6 max-w-6xl">
          <div className="text-center py-12 text-muted-foreground">Project not found</div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="container mx-auto px-4 sm:px-6 py-6 max-w-6xl space-y-6">
        <Breadcrumb 
          items={[
            { label: "Projects", href: "/projects" },
            { label: project.name }
          ]} 
        />
        
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight break-words" data-testid="text-project-name">{project.name}</h1>
            <Badge variant="outline" className={statusColors[project.status] || ""} data-testid="badge-status">
              {project.status.replace("_", " ")}
            </Badge>
          </div>
          <p className="text-muted-foreground font-mono mt-1">{project.code}</p>
        </div>

        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="grid w-full grid-cols-4" data-testid="project-tabs">
            <TabsTrigger value="overview" data-testid="tab-overview">
              <LayoutGrid className="h-4 w-4 mr-2" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="team" data-testid="tab-team">
              <Users className="h-4 w-4 mr-2" />
              Team
            </TabsTrigger>
            <TabsTrigger value="points" data-testid="tab-points">
              <ListTodo className="h-4 w-4 mr-2" />
              Points
            </TabsTrigger>
            <TabsTrigger value="files" data-testid="tab-files">
              <Paperclip className="h-4 w-4 mr-2" />
              Files
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card>
                <CardContent className="p-4 flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <MapPin className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Location</p>
                    {project.street && <p className="font-medium text-sm">{project.street}</p>}
                    <p className="font-medium">{project.city}, {project.country}</p>
                  </div>
                </CardContent>
              </Card>

              {project.client && (
                <Card>
                  <CardContent className="p-4 flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Building2 className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Client</p>
                      <p className="font-medium">{project.client}</p>
                    </div>
                  </CardContent>
                </Card>
              )}

              {project.constructionType && (
                <Card>
                  <CardContent className="p-4 flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <FolderOpen className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Type</p>
                      <p className="font-medium">{constructionTypeLabels[project.constructionType] || project.constructionType}</p>
                    </div>
                  </CardContent>
                </Card>
              )}

              {project.startDate && (
                <Card>
                  <CardContent className="p-4 flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Calendar className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Timeline</p>
                      <p className="font-medium">
                        {format(new Date(project.startDate), "MMM yyyy")}
                        {project.endDate && ` - ${format(new Date(project.endDate), "MMM yyyy")}`}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>

            {project.description && (
              <Card>
                <CardContent className="p-4">
                  <p className="text-muted-foreground">{project.description}</p>
                </CardContent>
              </Card>
            )}

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">Coordination Meetings</h2>
                <AddMeetingToProjectDialog projectId={projectId} projectName={project.name} />
              </div>

              {project.meetings && project.meetings.length === 0 && (
                <Card className="p-8 text-center">
                  <Calendar className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                  <h3 className="text-lg font-medium mb-1">No meetings scheduled</h3>
                  <p className="text-muted-foreground">Create your first coordination meeting for this project.</p>
                </Card>
              )}

              {project.meetings && project.meetings.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {project.meetings.map((meeting) => (
                    <MeetingCard key={meeting.id} meeting={meeting} />
                  ))}
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="team" className="mt-6">
            <ProjectTeamSection projectId={projectId} ownerCompanyId={project.ownerCompanyId} />
          </TabsContent>

          <TabsContent value="points" className="mt-6">
            <ProjectPointsSection projectId={projectId} />
          </TabsContent>

          <TabsContent value="files" className="mt-6">
            <ProjectFilesSection projectId={projectId} />
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}
