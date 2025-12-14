import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";

// Helper to get dev auth headers
function getDevAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = {};
  const devUserId = localStorage.getItem("dev-user-id");
  const devUserEmail = localStorage.getItem("dev-user-email");
  if (devUserId) headers["x-dev-user-id"] = devUserId;
  if (devUserEmail) headers["x-dev-user-email"] = devUserEmail;
  return headers;
}
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
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
  Upload, 
  Search, 
  Trash2, 
  Edit, 
  MoreVertical,
  Building2,
  Mail,
  User,
  Briefcase,
  History,
  Shield,
  Users
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useAuth, ROLE_DISPLAY_NAMES, ROLE_COLORS, type Role } from "@/contexts/auth-context";
import type { Attendee, SeriesAttendee, AttendanceRecord, MeetingOccurrence } from "@shared/schema";
import { format, parseISO } from "date-fns";

interface AttendeeManagerProps {
  type: 'meeting' | 'series';
  parentId: string;
  attendees: (Attendee | SeriesAttendee)[];
  attendanceRecords?: AttendanceRecord[];
  occurrenceId?: string;
  occurrences?: MeetingOccurrence[];
  isLoading?: boolean;
  projectId?: string | null;
}

interface ProjectUser {
  id: string;
  name: string;
  email: string;
  company?: string | null;
  roles?: { id: string; name: string }[];
}

interface AttendeeFormData {
  name: string;
  email: string;
  role: string;
  company: string;
}

const emptyFormData: AttendeeFormData = {
  name: "",
  email: "",
  role: "",
  company: "",
};

interface RoleInfo {
  id: Role;
  name: string;
  description: string;
}

export default function AttendeeManager({ 
  type, 
  parentId, 
  attendees, 
  attendanceRecords = [],
  occurrenceId: initialOccurrenceId,
  occurrences = [],
  isLoading,
  projectId
}: AttendeeManagerProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { permissions } = useAuth();
  
  const [searchQuery, setSearchQuery] = useState("");
  const [filterRole, setFilterRole] = useState<string>("all");
  const [filterCompany, setFilterCompany] = useState<string>("all");
  const [selectedOccurrenceId, setSelectedOccurrenceId] = useState<string | undefined>(initialOccurrenceId);
  
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importFromProjectDialogOpen, setImportFromProjectDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false);
  
  const [formData, setFormData] = useState<AttendeeFormData>(emptyFormData);
  const [editingAttendee, setEditingAttendee] = useState<Attendee | SeriesAttendee | null>(null);
  const [deletingAttendee, setDeletingAttendee] = useState<Attendee | SeriesAttendee | null>(null);
  const [viewingHistoryFor, setViewingHistoryFor] = useState<Attendee | SeriesAttendee | null>(null);
  const [importText, setImportText] = useState("");
  const [selectedSystemRoles, setSelectedSystemRoles] = useState<Role[]>([]);
  const [selectedProjectUsers, setSelectedProjectUsers] = useState<string[]>([]);

  const canManageUsers = permissions?.canManageUsers ?? false;

  const { data: systemRoles = [] } = useQuery<RoleInfo[]>({
    queryKey: ["/api/roles"],
  });

  const { data: projectUsers = [], isLoading: isLoadingProjectUsers } = useQuery<ProjectUser[]>({
    queryKey: ["project-users", projectId],
    queryFn: async () => {
      if (!projectId) return [];
      const res = await fetch(`/api/projects/${projectId}/users`, {
        headers: getDevAuthHeaders(),
      });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!projectId && importFromProjectDialogOpen,
  });

  const existingEmails = new Set(attendees.map(a => a.email?.toLowerCase()).filter(Boolean));
  const availableProjectUsers = projectUsers.filter(
    user => !existingEmails.has(user.email?.toLowerCase())
  );

  const effectiveOccurrenceId = type === 'series' ? selectedOccurrenceId : initialOccurrenceId;

  const queryKey = type === 'meeting' 
    ? ["attendees", parentId] 
    : ["series-attendees", parentId];

  const apiEndpoint = type === 'meeting' ? '/api/attendees' : '/api/series-attendees';
  const bulkEndpoint = type === 'meeting' 
    ? `/api/meetings/${parentId}/attendees/bulk`
    : `/api/series/${parentId}/attendees/bulk`;

  const attendanceEndpoint = type === 'meeting' 
    ? `/api/meetings/${parentId}/attendance`
    : effectiveOccurrenceId 
      ? `/api/occurrences/${effectiveOccurrenceId}/attendance`
      : null;

  const { data: fetchedAttendanceRecords = [] } = useQuery({
    queryKey: ["attendance", type === 'meeting' ? parentId : effectiveOccurrenceId],
    queryFn: async () => {
      if (!attendanceEndpoint) return [];
      const res = await fetch(attendanceEndpoint);
      if (!res.ok) throw new Error("Failed to fetch attendance");
      return res.json();
    },
    enabled: type === 'meeting' || !!effectiveOccurrenceId,
  });

  const effectiveAttendanceRecords = fetchedAttendanceRecords.length > 0 
    ? fetchedAttendanceRecords 
    : attendanceRecords;

  const createMutation = useMutation({
    mutationFn: async (data: AttendeeFormData) => {
      const body = type === 'meeting' 
        ? { meetingId: parentId, ...data }
        : { seriesId: parentId, ...data };
      const res = await fetch(apiEndpoint, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error('Failed to create attendee');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      setAddDialogOpen(false);
      setFormData(emptyFormData);
      toast({ title: "Attendee Added", description: "The attendee has been added successfully." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to add attendee.", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<AttendeeFormData> }) => {
      const res = await fetch(`${apiEndpoint}/${id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Failed to update attendee');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      setEditDialogOpen(false);
      setEditingAttendee(null);
      setFormData(emptyFormData);
      toast({ title: "Attendee Updated", description: "The attendee has been updated." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update attendee.", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`${apiEndpoint}/${id}`, { method: 'DELETE', credentials: 'include' });
      if (!res.ok) throw new Error('Failed to delete attendee');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      setDeleteDialogOpen(false);
      setDeletingAttendee(null);
      toast({ title: "Attendee Removed", description: "The attendee has been removed." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to remove attendee.", variant: "destructive" });
    },
  });

  const importMutation = useMutation({
    mutationFn: async (attendees: AttendeeFormData[]) => {
      const res = await fetch(bulkEndpoint, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ attendees }),
      });
      if (!res.ok) throw new Error('Failed to import attendees');
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey });
      setImportDialogOpen(false);
      setImportText("");
      toast({ 
        title: "Import Complete", 
        description: `${data.length} attendee(s) imported successfully.` 
      });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to import attendees.", variant: "destructive" });
    },
  });

  const importFromProjectMutation = useMutation({
    mutationFn: async (users: ProjectUser[]) => {
      const attendeesToCreate = users.map(user => ({
        name: user.name,
        email: user.email || "",
        role: "",
        company: user.company || "",
      }));
      const res = await fetch(bulkEndpoint, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', ...getDevAuthHeaders() },
        body: JSON.stringify({ attendees: attendeesToCreate }),
      });
      if (!res.ok) throw new Error('Failed to import attendees from project');
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey });
      setImportFromProjectDialogOpen(false);
      setSelectedProjectUsers([]);
      toast({ 
        title: "Import Complete", 
        description: `${data.length} attendee(s) imported from project.` 
      });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to import attendees from project.", variant: "destructive" });
    },
  });

  const updateUserRolesMutation = useMutation({
    mutationFn: async ({ attendeeId, roles }: { attendeeId: string; roles: Role[] }) => {
      const endpoint = type === 'meeting' 
        ? `/api/attendees/${attendeeId}/user-roles`
        : `/api/series-attendees/${attendeeId}/user-roles`;
      const res = await fetch(endpoint, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', ...getDevAuthHeaders() },
        body: JSON.stringify({ roles }),
      });
      if (!res.ok) throw new Error('Failed to update user roles');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({ title: "Roles Updated", description: "System roles have been updated." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update system roles.", variant: "destructive" });
    },
  });

  const toggleAttendanceMutation = useMutation({
    mutationFn: async ({ attendeeId, present }: { attendeeId: string; present: boolean }) => {
      const existingRecord = effectiveAttendanceRecords.find((r: AttendanceRecord) => 
        (type === 'meeting' ? r.attendeeId === attendeeId : r.seriesAttendeeId === attendeeId) &&
        (effectiveOccurrenceId ? r.occurrenceId === effectiveOccurrenceId : r.meetingId === parentId)
      );
      
      if (existingRecord) {
        const res = await fetch(`/api/attendance/${existingRecord.id}`, {
          method: 'PATCH',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json', ...getDevAuthHeaders() },
          body: JSON.stringify({ present }),
        });
        if (!res.ok) throw new Error('Failed to update attendance');
        return res.json();
      } else {
        if (type === 'series' && !effectiveOccurrenceId) {
          throw new Error('Please select a meeting date first');
        }
        const body = type === 'meeting'
          ? { meetingId: parentId, attendeeId, present }
          : { occurrenceId: effectiveOccurrenceId, seriesAttendeeId: attendeeId, present };
        const res = await fetch('/api/attendance', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json', ...getDevAuthHeaders() },
          body: JSON.stringify(body),
        });
        if (!res.ok) throw new Error('Failed to record attendance');
        return res.json();
      }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["attendance", parentId] });
      if (effectiveOccurrenceId) {
        queryClient.invalidateQueries({ queryKey: ["attendance", effectiveOccurrenceId] });
      }
      toast({
        title: variables.present ? "Marked Present" : "Marked Absent",
        description: "Attendance has been recorded.",
      });
    },
    onError: (error: Error) => {
      toast({ 
        title: "Error", 
        description: error.message || "Failed to record attendance.", 
        variant: "destructive" 
      });
    },
  });

  const handleOpenEdit = async (attendee: Attendee | SeriesAttendee) => {
    setEditingAttendee(attendee);
    setFormData({
      name: attendee.name,
      email: attendee.email || "",
      role: attendee.role,
      company: attendee.company || "",
    });
    setSelectedSystemRoles([]);
    setEditDialogOpen(true);

    // If attendee has a linked user, fetch their current roles
    if ((attendee as any).userId) {
      try {
        const endpoint = type === 'meeting' 
          ? `/api/attendees/${attendee.id}/user-roles`
          : `/api/series-attendees/${attendee.id}/user-roles`;
        const res = await fetch(endpoint.replace('/user-roles', ''), {
          headers: getDevAuthHeaders(),
        });
        if (res.ok) {
          const data = await res.json();
          if (data.userId) {
            const userRes = await fetch(`/api/users/${data.userId}`, {
              headers: getDevAuthHeaders(),
            });
            if (userRes.ok) {
              const userData = await userRes.json();
              if (userData.roles && Array.isArray(userData.roles)) {
                setSelectedSystemRoles(userData.roles);
              }
            }
          }
        }
      } catch (error) {
        console.error('Failed to fetch user roles:', error);
      }
    }
  };

  const handleOpenDelete = (attendee: Attendee | SeriesAttendee) => {
    setDeletingAttendee(attendee);
    setDeleteDialogOpen(true);
  };

  const handleOpenHistory = (attendee: Attendee | SeriesAttendee) => {
    setViewingHistoryFor(attendee);
    setHistoryDialogOpen(true);
  };

  const handleImport = () => {
    const lines = importText.split('\n').filter(line => line.trim());
    const parsed: AttendeeFormData[] = [];
    
    for (const line of lines) {
      const parts = line.split(/[,\t]/).map(p => p.trim());
      if (parts.length >= 1 && parts[0]) {
        parsed.push({
          name: parts[0],
          email: parts[1] || "",
          role: parts[2] || "Attendee",
          company: parts[3] || "",
        });
      }
    }
    
    if (parsed.length === 0) {
      toast({ 
        title: "No Data", 
        description: "No valid attendees found in the input.", 
        variant: "destructive" 
      });
      return;
    }
    
    importMutation.mutate(parsed);
  };

  const handleImportFromProject = () => {
    const usersToImport = availableProjectUsers.filter(
      user => selectedProjectUsers.includes(user.id)
    );
    if (usersToImport.length > 0) {
      importFromProjectMutation.mutate(usersToImport);
    }
  };

  const uniqueRoles = Array.from(new Set(attendees.map(a => a.role).filter(Boolean)));
  const uniqueCompanies = Array.from(new Set(attendees.map(a => a.company).filter(Boolean))) as string[];

  const filteredAttendees = attendees.filter(a => {
    const matchesSearch = searchQuery === "" || 
      a.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (a.email?.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (a.company?.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesRole = filterRole === "all" || a.role === filterRole;
    const matchesCompany = filterCompany === "all" || a.company === filterCompany;
    return matchesSearch && matchesRole && matchesCompany;
  });

  const isPresent = (attendeeId: string) => {
    const record = effectiveAttendanceRecords.find((r: AttendanceRecord) => 
      (type === 'meeting' ? r.attendeeId === attendeeId : r.seriesAttendeeId === attendeeId) &&
      (effectiveOccurrenceId ? r.occurrenceId === effectiveOccurrenceId : r.meetingId === parentId)
    );
    return record?.present || false;
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {type === 'series' && occurrences.length > 0 && (
        <div className="p-4 bg-muted/50 rounded-lg border">
          <Label className="text-sm font-medium mb-2 block">Select Meeting Date for Attendance</Label>
          <Select
            value={selectedOccurrenceId || ""}
            onValueChange={(value) => setSelectedOccurrenceId(value || undefined)}
          >
            <SelectTrigger className="w-full sm:w-[300px]" data-testid="select-occurrence">
              <SelectValue placeholder="Select a meeting date..." />
            </SelectTrigger>
            <SelectContent>
              {occurrences.map((occ) => {
                let dateLabel = occ.date;
                try {
                  dateLabel = format(parseISO(occ.date), "EEEE, MMMM d, yyyy");
                } catch {}
                return (
                  <SelectItem key={occ.id} value={occ.id}>
                    {dateLabel}
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
          {!selectedOccurrenceId && (
            <p className="text-xs text-muted-foreground mt-2">
              Select a meeting date above to mark attendance for that specific occurrence.
            </p>
          )}
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex-1 flex gap-2 w-full sm:w-auto">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search attendees..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
              data-testid="input-search-attendees"
            />
          </div>
        </div>
        
        <div className="flex gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" data-testid="button-add-attendee-dropdown">
                <Plus className="h-4 w-4 mr-2" />
                Add Attendee
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setAddDialogOpen(true)} data-testid="button-add-manual">
                <User className="h-4 w-4 mr-2" />
                Add Manually
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setImportDialogOpen(true)} data-testid="button-import">
                <Upload className="h-4 w-4 mr-2" />
                Import from List
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={() => setImportFromProjectDialogOpen(true)} 
                data-testid="button-import-from-project"
                disabled={!projectId}
              >
                <Users className="h-4 w-4 mr-2" />
                Import from Project
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="flex gap-2 flex-wrap">
        {uniqueRoles.length > 0 && (
          <select
            value={filterRole}
            onChange={(e) => setFilterRole(e.target.value)}
            className="text-sm border rounded-md px-2 py-1"
            data-testid="select-filter-role"
          >
            <option value="all">All Roles</option>
            {uniqueRoles.map(role => (
              <option key={role} value={role}>{role}</option>
            ))}
          </select>
        )}
        {uniqueCompanies.length > 0 && (
          <select
            value={filterCompany}
            onChange={(e) => setFilterCompany(e.target.value)}
            className="text-sm border rounded-md px-2 py-1"
            data-testid="select-filter-company"
          >
            <option value="all">All Companies</option>
            {uniqueCompanies.map(company => (
              <option key={company} value={company}>{company}</option>
            ))}
          </select>
        )}
      </div>

      {filteredAttendees.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          {attendees.length === 0 ? (
            <div>
              <User className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No attendees yet</p>
              <p className="text-sm">Add attendees manually or import from a list</p>
            </div>
          ) : (
            <p>No attendees match your search</p>
          )}
        </div>
      ) : (
        <ScrollArea className="h-[400px]">
          <div className="space-y-2">
            {filteredAttendees.map((attendee) => (
              <div 
                key={attendee.id}
                className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                data-testid={`attendee-card-${attendee.id}`}
              >
                <div className="flex items-center gap-3">
                  <Checkbox
                    checked={isPresent(attendee.id)}
                    disabled={type === 'series' && !effectiveOccurrenceId}
                    onCheckedChange={(checked) => 
                      toggleAttendanceMutation.mutate({ 
                        attendeeId: attendee.id, 
                        present: !!checked 
                      })
                    }
                    data-testid={`checkbox-attendance-${attendee.id}`}
                  />
                  <Avatar className="h-10 w-10">
                    <AvatarFallback className="bg-primary/10 text-primary">
                      {getInitials(attendee.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium">{attendee.name}</p>
                      {(attendee as any).userRoles?.length > 0 && (
                        (attendee as any).userRoles.map((role: Role) => (
                          <Badge 
                            key={role} 
                            variant="secondary" 
                            className={`text-xs ${ROLE_COLORS[role]}`}
                          >
                            {ROLE_DISPLAY_NAMES[role]}
                          </Badge>
                        ))
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-sm text-muted-foreground">
                      {attendee.role && (
                        <span className="flex items-center gap-1">
                          <Briefcase className="h-3 w-3" />
                          {attendee.role}
                        </span>
                      )}
                      {attendee.company && (
                        <span className="flex items-center gap-1">
                          <Building2 className="h-3 w-3" />
                          {attendee.company}
                        </span>
                      )}
                      {attendee.email && (
                        <span className="flex items-center gap-1">
                          <Mail className="h-3 w-3" />
                          {attendee.email}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" data-testid={`button-attendee-menu-${attendee.id}`}>
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => handleOpenEdit(attendee)}>
                      <Edit className="h-4 w-4 mr-2" />
                      Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleOpenHistory(attendee)}>
                      <History className="h-4 w-4 mr-2" />
                      View History
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      onClick={() => handleOpenDelete(attendee)}
                      className="text-destructive"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Remove
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            ))}
          </div>
        </ScrollArea>
      )}

      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Attendee</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="John Doe"
                data-testid="input-attendee-name"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="john@example.com"
                data-testid="input-attendee-email"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="role">Role *</Label>
                <Input
                  id="role"
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                  placeholder="Project Manager"
                  data-testid="input-attendee-role"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="company">Company</Label>
                <Input
                  id="company"
                  value={formData.company}
                  onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                  placeholder="ACME Corp"
                  data-testid="input-attendee-company"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={() => createMutation.mutate(formData)}
              disabled={!formData.name || !formData.role || createMutation.isPending}
              data-testid="button-save-attendee"
            >
              {createMutation.isPending ? "Adding..." : "Add Attendee"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Attendee</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="edit-name">Name *</Label>
              <Input
                id="edit-name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                data-testid="input-edit-attendee-name"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-email">Email</Label>
              <Input
                id="edit-email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                data-testid="input-edit-attendee-email"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="edit-role">Role *</Label>
                <Input
                  id="edit-role"
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                  data-testid="input-edit-attendee-role"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-company">Company</Label>
                <Input
                  id="edit-company"
                  value={formData.company}
                  onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                  data-testid="input-edit-attendee-company"
                />
              </div>
            </div>

            {canManageUsers && (
              <div className="border-t pt-4 mt-2">
                <Label className="flex items-center gap-2 mb-3">
                  <Shield className="h-4 w-4" />
                  System Access Roles
                </Label>
                {!(editingAttendee as any)?.userId && !formData.email ? (
                  <p className="text-xs text-amber-600 dark:text-amber-400">
                    This attendee needs an email address to be linked to a user account. Add an email above and save to enable role assignment.
                  </p>
                ) : (
                  <>
                    <p className="text-xs text-muted-foreground mb-3">
                      {(editingAttendee as any)?.userId 
                        ? "Manage system roles for this attendee's linked user account."
                        : "Assign system roles to create a linked user account for this attendee."}
                    </p>
                    <div className="grid grid-cols-2 gap-2 max-h-[200px] overflow-y-auto">
                      {systemRoles.map((role) => (
                        <div
                          key={role.id}
                          className="flex items-center space-x-2 p-2 border rounded-md hover:bg-muted/50"
                        >
                          <Checkbox
                            id={`role-${role.id}`}
                            checked={selectedSystemRoles.includes(role.id)}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setSelectedSystemRoles([...selectedSystemRoles, role.id]);
                              } else {
                                setSelectedSystemRoles(selectedSystemRoles.filter(r => r !== role.id));
                              }
                            }}
                            data-testid={`checkbox-role-${role.id}`}
                          />
                          <div className="flex-1">
                            <label
                              htmlFor={`role-${role.id}`}
                              className="text-sm font-medium cursor-pointer"
                            >
                              <Badge variant="secondary" className={`${ROLE_COLORS[role.id]} text-xs`}>
                                {ROLE_DISPLAY_NAMES[role.id]}
                              </Badge>
                            </label>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            {canManageUsers && selectedSystemRoles.length > 0 && (formData.email || (editingAttendee as any)?.userId) && (
              <Button
                variant="secondary"
                onClick={() => editingAttendee && updateUserRolesMutation.mutate({
                  attendeeId: editingAttendee.id,
                  roles: selectedSystemRoles
                })}
                disabled={updateUserRolesMutation.isPending}
                data-testid="button-assign-roles"
              >
                {updateUserRolesMutation.isPending ? "Assigning..." : "Assign System Roles"}
              </Button>
            )}
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
                Cancel
              </Button>
              <Button 
                onClick={() => editingAttendee && updateMutation.mutate({ 
                  id: editingAttendee.id, 
                  data: formData 
                })}
                disabled={!formData.name || !formData.role || updateMutation.isPending}
                data-testid="button-update-attendee"
              >
                {updateMutation.isPending ? "Updating..." : "Update"}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Import Attendees</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <p className="text-sm text-muted-foreground">
              Paste a list of attendees. Each line should contain: Name, Email, Role, Company (comma or tab separated).
            </p>
            <textarea
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              placeholder="John Doe, john@example.com, Project Manager, ACME Corp&#10;Jane Smith, jane@example.com, Architect, Design Co"
              className="min-h-[200px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              data-testid="textarea-import-attendees"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setImportDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleImport}
              disabled={!importText.trim() || importMutation.isPending}
              data-testid="button-confirm-import"
            >
              {importMutation.isPending ? "Importing..." : "Import"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={importFromProjectDialogOpen} onOpenChange={setImportFromProjectDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Import from Project Users</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            {!projectId ? (
              <p className="text-sm text-muted-foreground">This meeting is not assigned to a project.</p>
            ) : isLoadingProjectUsers ? (
              <p className="text-sm text-muted-foreground">Loading project users...</p>
            ) : availableProjectUsers.length === 0 ? (
              <p className="text-sm text-muted-foreground">No available users to import. All project users are already attendees.</p>
            ) : (
              <ScrollArea className="h-[300px]">
                <div className="space-y-2">
                  {availableProjectUsers.map((user) => (
                    <div 
                      key={user.id}
                      className="flex items-center gap-3 p-2 border rounded-lg hover:bg-muted/50"
                    >
                      <Checkbox
                        checked={selectedProjectUsers.includes(user.id)}
                        onCheckedChange={(checked) => {
                          setSelectedProjectUsers(prev => 
                            checked 
                              ? [...prev, user.id]
                              : prev.filter(id => id !== user.id)
                          );
                        }}
                        data-testid={`checkbox-project-user-${user.id}`}
                      />
                      <Avatar className="h-8 w-8">
                        <AvatarFallback className="bg-primary/10 text-primary text-xs">
                          {user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <p className="font-medium text-sm">{user.name}</p>
                        <p className="text-xs text-muted-foreground">{user.email}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setImportFromProjectDialogOpen(false);
              setSelectedProjectUsers([]);
            }}>
              Cancel
            </Button>
            <Button 
              onClick={handleImportFromProject}
              disabled={selectedProjectUsers.length === 0 || importFromProjectMutation.isPending}
              data-testid="button-confirm-import-project"
            >
              {importFromProjectMutation.isPending ? "Importing..." : `Import (${selectedProjectUsers.length})`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Attendee</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove {deletingAttendee?.name}? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingAttendee && deleteMutation.mutate(deletingAttendee.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete"
            >
              {deleteMutation.isPending ? "Removing..." : "Remove"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AttendanceHistoryDialog 
        open={historyDialogOpen}
        onOpenChange={setHistoryDialogOpen}
        attendee={viewingHistoryFor}
        type={type}
      />
    </div>
  );
}

function AttendanceHistoryDialog({ 
  open, 
  onOpenChange, 
  attendee, 
  type 
}: { 
  open: boolean; 
  onOpenChange: (open: boolean) => void; 
  attendee: Attendee | SeriesAttendee | null;
  type: 'meeting' | 'series';
}) {
  const historyEndpoint = type === 'meeting' 
    ? `/api/attendees/${attendee?.id}/attendance-history`
    : `/api/series-attendees/${attendee?.id}/attendance-history`;

  const { data: historyRecords = [], isLoading } = useQuery({
    queryKey: ["attendance-history", attendee?.id],
    queryFn: async () => {
      const res = await fetch(historyEndpoint);
      if (!res.ok) throw new Error("Failed to fetch history");
      return res.json();
    },
    enabled: open && !!attendee?.id,
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Attendance History - {attendee?.name}</DialogTitle>
        </DialogHeader>
        <div className="py-4">
          {isLoading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
            </div>
          ) : historyRecords.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No attendance records found. Records will appear here after meetings are held.
            </p>
          ) : (
            <ScrollArea className="h-[300px]">
              <div className="space-y-2">
                {historyRecords.map((record: AttendanceRecord) => (
                  <div 
                    key={record.id}
                    className="flex items-center justify-between p-3 border rounded-lg"
                  >
                    <div className="flex items-center gap-2">
                      {record.present ? (
                        <div className="w-2 h-2 rounded-full bg-green-500" />
                      ) : (
                        <div className="w-2 h-2 rounded-full bg-red-500" />
                      )}
                      <span className="text-sm">
                        {record.present ? "Present" : "Absent"}
                      </span>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {new Date(record.recordedAt).toLocaleDateString()}
                    </span>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
