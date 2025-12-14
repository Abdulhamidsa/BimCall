import Layout from "@/components/layout";
import Breadcrumb from "@/components/breadcrumb";
import { useRoute, Link, useLocation } from "wouter";
import type { PointWithRelations, Status } from "@/lib/types";
import PointCard from "@/components/point-card";
import PointFilter from "@/components/point-filter";
import CloseMeetingDialog from "@/components/close-meeting-dialog";

function getDevAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = {};
  const devUserId = localStorage.getItem("dev-user-id");
  const devUserEmail = localStorage.getItem("dev-user-email");
  if (devUserId) headers["x-dev-user-id"] = devUserId;
  if (devUserEmail) headers["x-dev-user-email"] = devUserEmail;
  return headers;
}
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/contexts/auth-context";
import { 
  Calendar, 
  Clock, 
  MapPin, 
  Send, 
  Edit, 
  Download, 
  Video,
  ArrowUpDown,
  Link2,
  ExternalLink,
  CalendarPlus,
  RefreshCw,
  AlertTriangle,
  Lock,
  LockOpen
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { format, addDays } from "date-fns";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import AddPointDialog from "@/components/add-point-dialog";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { meetingsApi, attendeesApi, pointsApi, statusUpdatesApi } from "@/lib/api";
import MeetingMinutesDialog from "@/components/meeting-minutes-dialog";
import AttendeeManager from "@/components/attendee-manager";
import { downloadICS, generateGoogleCalendarUrl, generateOutlookUrl } from "@/lib/calendar-export";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export default function MeetingDetail() {
  const [, params] = useRoute("/meeting/:id");
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { permissions } = useAuth();
  const meetingId = params?.id || "";
  
  const canEditMeetings = permissions?.canEditMeetings ?? false;
  const canSendMinutes = permissions?.canSendMinutes ?? false;
  const canCreatePoints = permissions?.canCreatePoints ?? false;

  const [filters, setFilters] = useState({
    status: "all" as Status | "all",
    assignedTo: "all",
    search: "",
    disciplines: [] as string[]
  });
  const [sortBy, setSortBy] = useState<'date' | 'status' | 'assignee' | 'title'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [editingLink, setEditingLink] = useState("");
  const [minutesDialogOpen, setMinutesDialogOpen] = useState(false);
  const [closeDialogOpen, setCloseDialogOpen] = useState(false);
  const [, navigate] = useLocation();
  
  // Fetch meeting data
  const { data: meeting, isLoading: meetingLoading } = useQuery({
    queryKey: ["meeting", meetingId],
    queryFn: () => meetingsApi.getById(meetingId),
    enabled: !!meetingId,
  });

  // Fetch attendees
  const { data: attendees = [] } = useQuery({
    queryKey: ["attendees", meetingId],
    queryFn: () => attendeesApi.getByMeeting(meetingId),
    enabled: !!meetingId,
  });

  // Fetch attendance records
  const { data: attendanceRecords = [] } = useQuery({
    queryKey: ["attendance", meetingId],
    queryFn: async () => {
      const res = await fetch(`/api/meetings/${meetingId}/attendance`, {
        headers: getDevAuthHeaders(),
      });
      if (!res.ok) throw new Error("Failed to fetch attendance");
      return res.json();
    },
    enabled: !!meetingId,
  });

  // Fetch points with related data
  const { data: points = [], isLoading: pointsLoading } = useQuery({
    queryKey: ["points", meetingId],
    queryFn: () => pointsApi.getByMeeting(meetingId),
    enabled: !!meetingId,
  });

  // Fetch disciplines for point filtering - using stable query key based on point IDs
  const pointIds = points.map(p => p.id).sort().join(',');
  const { data: allPointDisciplines = {} } = useQuery<Record<string, string[]>>({
    queryKey: ["all-point-disciplines", meetingId, pointIds],
    queryFn: async () => {
      const results: Record<string, string[]> = {};
      for (const point of points) {
        try {
          const response = await fetch(`/api/points/${point.id}/disciplines`, {
            headers: getDevAuthHeaders(),
          });
          if (response.ok) {
            results[point.id] = await response.json();
          }
        } catch { }
      }
      return results;
    },
    enabled: points.length > 0 && filters.disciplines.length > 0,
    staleTime: 60000,
  });

  // Update point status mutation
  const updatePointMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: Status }) =>
      pointsApi.update(id, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["points", meetingId] });
      queryClient.invalidateQueries({ queryKey: ["meeting-point-counts"] });
      toast({
        title: "Status Updated",
        description: "Point status has been updated",
      });
    },
  });

  // Add status update mutation
  const addStatusUpdateMutation = useMutation({
    mutationFn: (update: { pointId: string; date: string; status: string; actionOn: string }) =>
      statusUpdatesApi.create(update),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["points", meetingId] });
      toast({
        title: "Comment Added",
        description: "Status update has been added",
      });
    },
  });

  // Create point mutation
  const createPointMutation = useMutation({
    mutationFn: async (point: any) => {
      const createdPoint = await pointsApi.create({
        meetingId,
        title: point.title,
        description: point.description,
        image: point.image || "",
        status: point.status,
        assignedTo: point.assignedTo || "Unassigned",
        dueDate: format(addDays(new Date(), 7), "yyyy-MM-dd"),
      });
      
      if (point.attachments && point.attachments.length > 0) {
        await Promise.all(
          point.attachments.map((att: any) =>
            fetch('/api/attachments', {
              method: 'POST',
              credentials: 'include',
              headers: { 'Content-Type': 'application/json', ...getDevAuthHeaders() },
              body: JSON.stringify({
                pointId: createdPoint.id,
                name: att.name,
                type: att.type,
                size: att.size,
                url: att.url,
              }),
            })
          )
        );
      }
      
      if (point.disciplines && point.disciplines.length > 0) {
        await fetch(`/api/points/${createdPoint.id}/disciplines`, {
          method: 'PUT',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json', ...getDevAuthHeaders() },
          body: JSON.stringify({ disciplines: point.disciplines }),
        });
      }
      
      return createdPoint;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["points", meetingId] });
      queryClient.invalidateQueries({ queryKey: ["meeting-point-counts"] });
      toast({
        title: "Point Added",
        description: "New coordination point has been added to the agenda.",
      });
    },
  });

  // Update meeting link mutation
  const updateMeetingLinkMutation = useMutation({
    mutationFn: (meetingLink: string | null) =>
      meetingsApi.update(meetingId, { meetingLink }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["meeting", meetingId] });
      setLinkDialogOpen(false);
      toast({
        title: "Meeting Link Updated",
        description: "The meeting link has been saved.",
      });
    },
  });

  // Add attendee mutation (for adding from Add Point dialog)
  const addAttendeeMutation = useMutation({
    mutationFn: async (attendee: { name: string; email: string; role: string; company: string }) => {
      const res = await fetch('/api/attendees', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', ...getDevAuthHeaders() },
        body: JSON.stringify({ meetingId, ...attendee }),
      });
      if (!res.ok) throw new Error('Failed to add attendee');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["attendees", meetingId] });
    },
  });

  const handleAddAttendee = async (attendee: { name: string; email: string; role: string; company: string }) => {
    const created = await addAttendeeMutation.mutateAsync(attendee);
    return created;
  };

  // Sync from calendar mutation
  const syncFromCalendarMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/meetings/${meetingId}/sync-from-calendar`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to sync');
      }
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["meeting", meetingId] });
      queryClient.invalidateQueries({ queryKey: ["attendees", meetingId] });
      if (data.status === 'removed') {
        toast({
          title: "Meeting Removed from Calendar",
          description: "This meeting no longer exists in your calendar.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Synced from Calendar",
          description: "Meeting details have been updated from the calendar.",
        });
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Sync Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Reopen meeting mutation
  const reopenMeetingMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/meetings/${meetingId}/reopen`, {
        method: 'POST',
        credentials: 'include',
        headers: getDevAuthHeaders(),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to reopen meeting');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["meeting", meetingId] });
      queryClient.invalidateQueries({ queryKey: ["meetings"] });
      toast({
        title: "Meeting Reopened",
        description: "The meeting has been reopened.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  if (meetingLoading) {
    return <Layout><div className="px-4 sm:px-8 py-8" data-testid="text-loading">Loading meeting...</div></Layout>;
  }

  if (!meeting) {
    return <Layout><div className="px-4 sm:px-8 py-8" data-testid="text-not-found">Meeting not found</div></Layout>;
  }

  const isClosed = meeting.status === 'closed';
  const openPoints = points.filter((p: PointWithRelations) => 
    p.status === 'open' || p.status === 'new' || p.status === 'ongoing'
  );
  const canCloseMeetings = permissions?.canCloseMeetings ?? false;

  const statusOrder: Record<string, number> = { new: 0, open: 1, ongoing: 2, postponed: 3, closed: 4 };

  const filteredAndSortedPoints = points
    .filter((point: PointWithRelations) => {
      const matchesStatus = filters.status === "all" || point.status === filters.status;
      const matchesAssignee = filters.assignedTo === "all" || point.assignedTo === filters.assignedTo;
      const matchesSearch = filters.search === "" || 
        point.title.toLowerCase().includes(filters.search.toLowerCase()) || 
        point.description.toLowerCase().includes(filters.search.toLowerCase());
      const matchesDisciplines = filters.disciplines.length === 0 || 
        (allPointDisciplines[point.id] || []).some(d => filters.disciplines.includes(d));
        
      return matchesStatus && matchesAssignee && matchesSearch && matchesDisciplines;
    })
    .sort((a: PointWithRelations, b: PointWithRelations) => {
      let comparison = 0;
      switch (sortBy) {
        case 'status':
          comparison = statusOrder[a.status] - statusOrder[b.status];
          break;
        case 'assignee':
          comparison = a.assignedTo.localeCompare(b.assignedTo);
          break;
        case 'title':
          comparison = a.title.localeCompare(b.title);
          break;
        case 'date':
        default:
          comparison = new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
          break;
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });

  const handleStatusChange = (id: string, newStatus: Status) => {
    updatePointMutation.mutate({ id, status: newStatus });
  };

  const handleAddComment = (id: string, update: { date: string; status: string; actionOn: string }) => {
    addStatusUpdateMutation.mutate({
      pointId: id,
      ...update,
    });
  };

  const handleAddPoint = async (newPoint: any) => {
    return createPointMutation.mutateAsync(newPoint);
  };

  const handleSendMinutes = () => {
    setMinutesDialogOpen(true);
  };

  const handleOpenLinkDialog = () => {
    setEditingLink(meeting?.meetingLink || "");
    setLinkDialogOpen(true);
  };

  const handleSaveLink = () => {
    const link = editingLink.trim() || null;
    updateMeetingLinkMutation.mutate(link);
  };

  const handleJoinMeeting = () => {
    if (meeting?.meetingLink) {
      window.open(meeting.meetingLink, "_blank");
    }
  };

  return (
    <Layout>
      <div className="flex flex-col h-full">
        {/* Breadcrumb */}
        <div className="bg-card border-b px-4 sm:px-6 py-2">
          <Breadcrumb 
            items={[
              { label: "Meetings", href: "/" },
              { label: meeting.title }
            ]} 
          />
        </div>
        
        {/* Top Bar */}
        <div className="bg-card border-b px-4 sm:px-6 py-4 space-y-3 overflow-hidden">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight w-full break-words" data-testid="text-meeting-title">{meeting.title}</h1>
              <Link href={meeting.projectId ? `/project/${meeting.projectId}` : "#"}>
                <Badge 
                  variant="outline" 
                  className="font-mono text-xs cursor-pointer hover:bg-accent transition-colors" 
                  data-testid="text-project"
                >
                  {meeting.project}
                </Badge>
              </Link>
              {isClosed && (
                <Badge className="bg-gray-500 text-white" data-testid="badge-closed">
                  <Lock className="h-3 w-3 mr-1" />
                  Closed
                </Badge>
              )}
              {meeting.removedFromCalendar && (
                <Badge variant="destructive" className="text-xs" data-testid="badge-removed-from-calendar">
                  <AlertTriangle className="h-3 w-3 mr-1" />
                  Removed from Calendar
                </Badge>
              )}
            </div>
            <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center sm:justify-between gap-3">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  <span data-testid="text-date">{meeting.date}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  <span data-testid="text-time">{meeting.startTime} - {meeting.endTime}</span>
                </div>
                <div className="flex items-center gap-2">
                  {meeting.location === "Zoom" || meeting.location.includes("Teams") ? <Video className="h-4 w-4" /> : <MapPin className="h-4 w-4" />}
                  <span data-testid="text-location">{meeting.location}</span>
                </div>
                <Dialog open={linkDialogOpen} onOpenChange={setLinkDialogOpen}>
                  <div className="flex items-center gap-1">
                    {meeting.meetingLink ? (
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="h-7 px-2 text-primary hover:text-primary/80" 
                        onClick={handleJoinMeeting}
                        data-testid="button-join-meeting"
                      >
                        <ExternalLink className="h-4 w-4 mr-1" />
                        Join Meeting
                      </Button>
                    ) : (
                      <span className="text-muted-foreground/50">No meeting link</span>
                    )}
                    {canEditMeetings && (
                      <DialogTrigger asChild>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-7 w-7"
                          onClick={handleOpenLinkDialog}
                          data-testid="button-edit-meeting-link"
                        >
                          <Edit className="h-3.5 w-3.5" />
                        </Button>
                      </DialogTrigger>
                    )}
                  </div>
                  <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                      <DialogTitle>Edit Meeting Link</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label htmlFor="meeting-link">Meeting URL</Label>
                        <div className="flex gap-2">
                          <div className="relative flex-1">
                            <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                              id="meeting-link"
                              placeholder="https://zoom.us/j/... or https://teams.microsoft.com/..."
                              value={editingLink}
                              onChange={(e) => setEditingLink(e.target.value)}
                              className="pl-9"
                              data-testid="input-meeting-link"
                            />
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Enter the URL for your Zoom, Teams, or other video conferencing link.
                        </p>
                      </div>
                      <div className="flex justify-end gap-2">
                        <Button 
                          variant="outline" 
                          onClick={() => setLinkDialogOpen(false)}
                          data-testid="button-cancel-link"
                        >
                          Cancel
                        </Button>
                        <Button 
                          onClick={handleSaveLink}
                          disabled={updateMeetingLinkMutation.isPending}
                          data-testid="button-save-link"
                        >
                          {updateMeetingLinkMutation.isPending ? "Saving..." : "Save Link"}
                        </Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>

              <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="text-xs sm:text-sm" data-testid="button-calendar-export">
                      <CalendarPlus className="mr-1 sm:mr-2 h-3.5 w-3.5" />
                      <span className="hidden xs:inline">Add to </span>Calendar
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem 
                      onClick={() => window.open(generateGoogleCalendarUrl(meeting), "_blank")}
                      data-testid="menu-item-google-calendar"
                    >
                      <Calendar className="mr-2 h-4 w-4" />
                      Google Calendar
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      onClick={() => window.open(generateOutlookUrl(meeting), "_blank")}
                      data-testid="menu-item-outlook"
                    >
                      <Calendar className="mr-2 h-4 w-4" />
                      Outlook
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      onClick={() => {
                        downloadICS(meeting, attendees);
                        toast({ title: "Downloaded", description: "Calendar file saved" });
                      }}
                      data-testid="menu-item-download-ics"
                    >
                      <Download className="mr-2 h-4 w-4" />
                      Download .ics File
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                {meeting.calendarEventId && canEditMeetings && (
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => syncFromCalendarMutation.mutate()}
                    disabled={syncFromCalendarMutation.isPending}
                    data-testid="button-sync-calendar"
                  >
                    <RefreshCw className={`mr-2 h-3.5 w-3.5 ${syncFromCalendarMutation.isPending ? 'animate-spin' : ''}`} />
                    {syncFromCalendarMutation.isPending ? 'Syncing...' : 'Refresh from Calendar'}
                  </Button>
                )}
                {canCloseMeetings && !isClosed && (
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => setCloseDialogOpen(true)}
                    data-testid="button-close-meeting"
                  >
                    <Lock className="mr-2 h-3.5 w-3.5" />
                    Close Meeting
                    {openPoints.length > 0 && (
                      <Badge variant="secondary" className="ml-2 h-5 px-1.5">
                        {openPoints.length}
                      </Badge>
                    )}
                  </Button>
                )}
                {canCloseMeetings && isClosed && (
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => reopenMeetingMutation.mutate()}
                    disabled={reopenMeetingMutation.isPending}
                    data-testid="button-reopen-meeting"
                  >
                    <LockOpen className="mr-2 h-3.5 w-3.5" />
                    {reopenMeetingMutation.isPending ? 'Reopening...' : 'Reopen Meeting'}
                  </Button>
                )}
                {canSendMinutes && (
                  <Button size="sm" onClick={handleSendMinutes} data-testid="button-send-minutes">
                    <Send className="mr-2 h-3.5 w-3.5" />
                    Send Minutes
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 overflow-hidden flex flex-col">
          <Tabs defaultValue="agenda" className="flex-1 flex flex-col">
            <div className="px-4 sm:px-6 pt-4">
              <TabsList>
                <TabsTrigger value="agenda" data-testid="tab-agenda">Agenda & Points</TabsTrigger>
                <TabsTrigger value="attendees" data-testid="tab-attendees">Attendees ({attendees.length})</TabsTrigger>
                <TabsTrigger value="files" data-testid="tab-files">Project Files</TabsTrigger>
              </TabsList>
            </div>

            <div className="flex-1 overflow-y-auto bg-muted/30 px-4 sm:px-6 py-6">
              <TabsContent value="agenda" className="mt-0 max-w-5xl mx-auto space-y-6">
                <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
                  <div className="flex items-center justify-between md:justify-start w-full md:w-auto gap-4">
                    <h2 className="text-lg font-semibold whitespace-nowrap">Discussion Points</h2>
                    {canCreatePoints && (
                      <div className="md:hidden">
                        <AddPointDialog onAddPoint={handleAddPoint} attendees={attendees} onAddAttendee={handleAddAttendee} />
                      </div>
                    )}
                  </div>
                  
                  <div className="flex flex-col-reverse md:flex-row items-stretch md:items-center gap-3 w-full md:w-auto">
                    <div className="flex items-center gap-2">
                      <Select value={sortBy} onValueChange={(v) => setSortBy(v as any)}>
                        <SelectTrigger className="w-[130px] h-9" data-testid="select-sort-by">
                          <SelectValue placeholder="Sort by" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="date">Due Date</SelectItem>
                          <SelectItem value="status">Status</SelectItem>
                          <SelectItem value="assignee">Assignee</SelectItem>
                          <SelectItem value="title">Title</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button 
                        variant="outline" 
                        size="icon" 
                        className="h-9 w-9"
                        onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
                        data-testid="button-sort-order"
                      >
                        <ArrowUpDown className="h-4 w-4" />
                      </Button>
                    </div>
                    <PointFilter filters={filters} onFilterChange={setFilters} />
                    {canCreatePoints && (
                      <div className="hidden md:block">
                        <AddPointDialog onAddPoint={handleAddPoint} attendees={attendees} onAddAttendee={handleAddAttendee} />
                      </div>
                    )}
                  </div>
                </div>

                {pointsLoading ? (
                  <div className="text-center py-12 text-muted-foreground" data-testid="text-loading-points">
                    Loading points...
                  </div>
                ) : (
                  <div className="space-y-4">
                    {filteredAndSortedPoints.length === 0 ? (
                      <div className="text-center py-12 bg-background rounded-lg border border-dashed">
                        <p className="text-muted-foreground" data-testid="text-no-points">No points match your filters</p>
                        <Button variant="link" onClick={() => setFilters({ status: "all", assignedTo: "all", search: "", disciplines: [] })} data-testid="button-clear-filters">
                          Clear all filters
                        </Button>
                      </div>
                    ) : (
                      filteredAndSortedPoints.map((point: PointWithRelations) => (
                        <PointCard 
                          key={point.id} 
                          point={point} 
                          onStatusChange={handleStatusChange}
                          onAddComment={handleAddComment}
                          attendees={attendees}
                        />
                      ))
                    )}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="attendees" className="mt-0 max-w-3xl mx-auto">
                <AttendeeManager 
                  type="meeting"
                  parentId={meetingId}
                  attendees={attendees}
                  attendanceRecords={attendanceRecords}
                  projectId={meeting.projectId}
                />
              </TabsContent>

              <TabsContent value="files" className="mt-0 max-w-3xl mx-auto">
                 <div className="border-2 border-dashed rounded-lg p-12 flex flex-col items-center justify-center text-center bg-card">
                    <Download className="h-10 w-10 text-muted-foreground mb-4" />
                    <h3 className="text-lg font-medium mb-1">Upload Project Documents</h3>
                    <p className="text-sm text-muted-foreground mb-4">Drag and drop files here, or click to select files</p>
                    <Button variant="outline" data-testid="button-select-files">Select Files</Button>
                 </div>
              </TabsContent>
            </div>
          </Tabs>
        </div>
      </div>

      {meeting && (
        <MeetingMinutesDialog
          open={minutesDialogOpen}
          onOpenChange={setMinutesDialogOpen}
          meeting={meeting}
          points={filteredAndSortedPoints}
          attendees={attendees}
          attendanceRecords={attendanceRecords}
        />
      )}

      <CloseMeetingDialog
        open={closeDialogOpen}
        onOpenChange={setCloseDialogOpen}
        type="meeting"
        meeting={{
          id: meetingId,
          title: meeting.title,
          date: meeting.date,
          project: meeting.project,
          projectId: meeting.projectId,
        }}
        openPoints={openPoints.map((p: PointWithRelations) => ({
          id: p.id,
          title: p.title,
          status: p.status,
        }))}
        onClosed={() => {
          queryClient.invalidateQueries({ queryKey: ["meeting", meetingId] });
          queryClient.invalidateQueries({ queryKey: ["points", meetingId] });
          queryClient.invalidateQueries({ queryKey: ["meetings"] });
          queryClient.invalidateQueries({ queryKey: ["meeting-point-counts"] });
        }}
      />
    </Layout>
  );
}
