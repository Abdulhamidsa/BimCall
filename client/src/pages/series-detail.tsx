import { useParams, Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Layout from "@/components/layout";
import Breadcrumb from "@/components/breadcrumb";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/contexts/auth-context";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { 
  ArrowLeft, 
  Clock, 
  MapPin, 
  Repeat, 
  Calendar,
  ExternalLink,
  Plus,
  CheckCircle,
  XCircle,
  MessageSquare,
  Edit,
  Link2,
  CalendarPlus,
  Download,
  Send,
  ArrowUpDown,
  RefreshCw,
  AlertTriangle,
  Lock,
  LockOpen
} from "lucide-react";
import CloseMeetingDialog from "@/components/close-meeting-dialog";
import { meetingSeriesApi, projectsApi, pointsApi, statusUpdatesApi } from "@/lib/api";
import type { MeetingOccurrence } from "@shared/schema";
import type { PointWithRelations, Status } from "@/lib/types";
import { format, parseISO, addDays } from "date-fns";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import PointCard from "@/components/point-card";
import PointFilter from "@/components/point-filter";
import AddPointDialog from "@/components/add-point-dialog";
import MeetingMinutesDialog from "@/components/meeting-minutes-dialog";
import AttendeeManager from "@/components/attendee-manager";
import { Users } from "lucide-react";

const recurrenceLabels: Record<string, string> = {
  weekly: "Weekly",
  biweekly: "Every 2 weeks",
  monthly: "Monthly",
};

const statusIcons: Record<string, React.ReactNode> = {
  scheduled: <Calendar className="h-4 w-4 text-blue-500" />,
  completed: <CheckCircle className="h-4 w-4 text-green-500" />,
  cancelled: <XCircle className="h-4 w-4 text-red-500" />,
};

const statusColors: Record<string, string> = {
  scheduled: "bg-blue-100 text-blue-700",
  completed: "bg-green-100 text-green-700",
  cancelled: "bg-red-100 text-red-700",
};

function OccurrenceCard({ occurrence }: { occurrence: MeetingOccurrence }) {
  const formattedDate = (() => {
    try {
      return format(parseISO(occurrence.date), "EEEE, MMMM d, yyyy");
    } catch {
      return occurrence.date;
    }
  })();

  return (
    <div className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/30 transition-colors">
      <div className="flex items-center gap-4">
        {statusIcons[occurrence.status] || <Calendar className="h-4 w-4" />}
        <div>
          <p className="font-medium">{formattedDate}</p>
          {occurrence.notes && (
            <p className="text-sm text-muted-foreground">{occurrence.notes}</p>
          )}
          {(occurrence.startTimeOverride || occurrence.locationOverride) && (
            <p className="text-xs text-muted-foreground mt-1">
              {occurrence.startTimeOverride && `Time: ${occurrence.startTimeOverride}`}
              {occurrence.startTimeOverride && occurrence.locationOverride && ' • '}
              {occurrence.locationOverride && `Location: ${occurrence.locationOverride}`}
            </p>
          )}
        </div>
      </div>
      <Badge className={statusColors[occurrence.status] || "bg-gray-100"}>
        {occurrence.status.charAt(0).toUpperCase() + occurrence.status.slice(1)}
      </Badge>
    </div>
  );
}

export default function SeriesDetail() {
  const params = useParams();
  const seriesId = params.id as string;
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { permissions } = useAuth();
  
  const canEditMeetings = permissions?.canEditMeetings ?? false;
  const canSendMinutes = permissions?.canSendMinutes ?? false;
  const canCreatePoints = permissions?.canCreatePoints ?? false;

  // State for filtering and sorting
  const [filters, setFilters] = useState({
    status: "all" as Status | "all",
    assignedTo: "all",
    search: "",
    disciplines: [] as string[]
  });
  const [sortBy, setSortBy] = useState<'date' | 'status' | 'assignee' | 'title'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  
  // Dialog states
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [editingLink, setEditingLink] = useState("");
  const [minutesDialogOpen, setMinutesDialogOpen] = useState(false);
  const [closeDialogOpen, setCloseDialogOpen] = useState(false);
  
  const canCloseMeetings = permissions?.canCloseMeetings ?? false;

  const { data: series, isLoading, error } = useQuery({
    queryKey: ["meeting-series", seriesId],
    queryFn: () => meetingSeriesApi.getById(seriesId),
    enabled: !!seriesId,
  });

  const { data: projects = [] } = useQuery({
    queryKey: ["projects"],
    queryFn: () => projectsApi.getAll(),
  });

  const { data: seriesAttendees = [] } = useQuery({
    queryKey: ["series-attendees", seriesId],
    queryFn: async () => {
      const res = await fetch(`/api/series/${seriesId}/attendees`, {
        headers: getDevAuthHeaders(),
      });
      if (!res.ok) throw new Error("Failed to fetch attendees");
      return res.json();
    },
    enabled: !!seriesId,
  });

  // Fetch disciplines for point filtering - uses series data when available
  const seriesPoints = (series?.points || []) as PointWithRelations[];
  const { data: allPointDisciplines = {} } = useQuery<Record<string, string[]>>({
    queryKey: ["all-point-disciplines", seriesId, seriesPoints.map(p => p.id).join(',')],
    queryFn: async () => {
      const results: Record<string, string[]> = {};
      for (const point of seriesPoints) {
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
    enabled: seriesPoints.length > 0 && filters.disciplines.length > 0,
    staleTime: 60000,
  });

  const latestOccurrenceId = series?.occurrences?.[0]?.id;
  
  const { data: occurrenceAttendance = [] } = useQuery({
    queryKey: ["occurrence-attendance", latestOccurrenceId],
    queryFn: async () => {
      const res = await fetch(`/api/occurrences/${latestOccurrenceId}/attendance`, {
        headers: getDevAuthHeaders(),
      });
      if (!res.ok) throw new Error("Failed to fetch attendance");
      return res.json();
    },
    enabled: !!latestOccurrenceId,
  });

  // Update point status mutation
  const updatePointMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: Status }) =>
      pointsApi.update(id, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["meeting-series", seriesId] });
      queryClient.invalidateQueries({ queryKey: ["meeting-point-counts"] });
      queryClient.invalidateQueries({ queryKey: ["series-point-counts"] });
      queryClient.invalidateQueries({ queryKey: ["meeting-series"] });
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
      queryClient.invalidateQueries({ queryKey: ["meeting-series", seriesId] });
      toast({
        title: "Comment Added",
        description: "Status update has been added",
      });
    },
  });

  // Create point mutation for series
  const createPointMutation = useMutation({
    mutationFn: async (point: any) => {
      const createdPoint = await pointsApi.create({
        seriesId: seriesId,
        meetingId: null,
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
      queryClient.invalidateQueries({ queryKey: ["meeting-series", seriesId] });
      queryClient.invalidateQueries({ queryKey: ["meeting-point-counts"] });
      queryClient.invalidateQueries({ queryKey: ["series-point-counts"] });
      queryClient.invalidateQueries({ queryKey: ["meeting-series"] });
      toast({
        title: "Point Added",
        description: "New coordination point has been added to the series.",
      });
    },
  });

  // Update series link mutation
  const updateSeriesLinkMutation = useMutation({
    mutationFn: (meetingLink: string | null) =>
      meetingSeriesApi.update(seriesId, { meetingLink }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["meeting-series", seriesId] });
      setLinkDialogOpen(false);
      toast({
        title: "Meeting Link Updated",
        description: "The meeting link has been saved.",
      });
    },
  });

  // Add series attendee mutation (for adding from Add Point dialog)
  const addSeriesAttendeeMutation = useMutation({
    mutationFn: async (attendee: { name: string; email: string; role: string; company: string }) => {
      const res = await fetch('/api/series-attendees', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ seriesId, ...attendee }),
      });
      if (!res.ok) throw new Error('Failed to add attendee');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["series-attendees", seriesId] });
    },
  });

  const handleAddSeriesAttendee = async (attendee: { name: string; email: string; role: string; company: string }) => {
    const created = await addSeriesAttendeeMutation.mutateAsync(attendee);
    return created;
  };

  // Sync from calendar mutation
  const syncFromCalendarMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/meeting-series/${seriesId}/sync-from-calendar`, {
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
      queryClient.invalidateQueries({ queryKey: ["meeting-series", seriesId] });
      queryClient.invalidateQueries({ queryKey: ["series-attendees", seriesId] });
      if (data.status === 'removed') {
        toast({
          title: "Series Removed from Calendar",
          description: "This meeting series no longer exists in your calendar.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Synced from Calendar",
          description: "Series details have been updated from the calendar.",
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

  // Reopen series mutation
  const reopenSeriesMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/meeting-series/${seriesId}/reopen`, {
        method: 'POST',
        credentials: 'include',
        headers: getDevAuthHeaders(),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to reopen series');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["meeting-series", seriesId] });
      queryClient.invalidateQueries({ queryKey: ["meeting-series"] });
      toast({
        title: "Series Reopened",
        description: "The meeting series has been reopened.",
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

  const project = projects.find(p => p.id === series?.projectId);

  if (isLoading) {
    return (
      <Layout>
        <div className="container mx-auto px-4 sm:px-6 py-6 max-w-6xl">
          <div className="text-center py-12 text-muted-foreground">
            Loading series...
          </div>
        </div>
      </Layout>
    );
  }

  if (error || !series) {
    return (
      <Layout>
        <div className="container mx-auto px-4 sm:px-6 py-6 max-w-6xl">
          <div className="text-center py-12">
            <h2 className="text-xl font-semibold text-destructive">Series not found</h2>
            <p className="text-muted-foreground mt-2">The meeting series you're looking for doesn't exist.</p>
            <Link href="/">
              <Button className="mt-4">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Meetings
              </Button>
            </Link>
          </div>
        </div>
      </Layout>
    );
  }

  const isClosed = series.status === 'closed';
  const openPoints = seriesPoints.filter((p: PointWithRelations) => 
    p.status === 'open' || p.status === 'new' || p.status === 'ongoing'
  );

  // Status order for sorting
  const statusOrder: Record<string, number> = { new: 0, open: 1, ongoing: 2, postponed: 3, closed: 4 };

  // Filter and sort points (using seriesPoints defined before early returns for hook consistency)
  const filteredAndSortedPoints = seriesPoints
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

  const handleOpenLinkDialog = () => {
    setEditingLink(series?.meetingLink || "");
    setLinkDialogOpen(true);
  };

  const handleSaveLink = () => {
    const link = editingLink.trim() || null;
    updateSeriesLinkMutation.mutate(link);
  };

  const handleJoinMeeting = () => {
    if (series?.meetingLink) {
      window.open(series.meetingLink, "_blank");
    }
  };

  // Helper to get next occurrence date
  const getNextOccurrenceDate = () => {
    const nextOccurrence = series.occurrences?.find(o => o.status === 'scheduled');
    return nextOccurrence?.date || format(new Date(), 'yyyy-MM-dd');
  };

  // Generate Google Calendar URL for recurring series
  const generateGoogleCalendarUrl = () => {
    const startDate = getNextOccurrenceDate();
    const formatDateForGoogle = (dateStr: string, timeStr: string) => {
      const date = parseISO(dateStr);
      const [hours, minutes] = timeStr.split(':');
      date.setHours(parseInt(hours), parseInt(minutes), 0, 0);
      return date.toISOString().replace(/[-:.]/g, '').slice(0, 15) + 'Z';
    };

    const dtstart = formatDateForGoogle(startDate, series.startTime);
    const dtend = formatDateForGoogle(startDate, series.endTime);
    
    const recur = series.recurrenceRule === 'weekly' ? 'RRULE:FREQ=WEEKLY' :
                  series.recurrenceRule === 'biweekly' ? 'RRULE:FREQ=WEEKLY;INTERVAL=2' :
                  'RRULE:FREQ=MONTHLY';

    const params = new URLSearchParams({
      action: 'TEMPLATE',
      text: series.title,
      dates: `${dtstart}/${dtend}`,
      details: series.agenda || '',
      location: series.location || '',
      recur: recur,
    });

    return `https://calendar.google.com/calendar/render?${params.toString()}`;
  };

  // Generate Outlook URL for recurring series  
  const generateOutlookUrl = () => {
    const startDate = getNextOccurrenceDate();
    const formatDateForOutlook = (dateStr: string, timeStr: string) => {
      const date = parseISO(dateStr);
      const [hours, minutes] = timeStr.split(':');
      date.setHours(parseInt(hours), parseInt(minutes), 0, 0);
      return date.toISOString();
    };

    const dtstart = formatDateForOutlook(startDate, series.startTime);
    const dtend = formatDateForOutlook(startDate, series.endTime);

    const params = new URLSearchParams({
      path: '/calendar/action/compose',
      rru: 'addevent',
      subject: series.title,
      startdt: dtstart,
      enddt: dtend,
      body: series.agenda || '',
      location: series.location || '',
    });

    return `https://outlook.office.com/calendar/0/deeplink/compose?${params.toString()}`;
  };

  // Generate ICS for recurring series
  const handleDownloadICS = () => {
    const rrule = series.recurrenceRule === 'weekly' ? 'FREQ=WEEKLY' :
                  series.recurrenceRule === 'biweekly' ? 'FREQ=WEEKLY;INTERVAL=2' :
                  'FREQ=MONTHLY';
    
    const startDate = getNextOccurrenceDate();
    
    const formatDateForICS = (dateStr: string, timeStr: string) => {
      const date = parseISO(dateStr);
      const [hours, minutes] = timeStr.split(':');
      date.setHours(parseInt(hours), parseInt(minutes), 0, 0);
      return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    };

    const dtstart = formatDateForICS(startDate, series.startTime);
    const dtend = formatDateForICS(startDate, series.endTime);

    const icsContent = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//BIMCall//Series//EN
BEGIN:VEVENT
UID:${series.id}@bimcall.app
DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').split('.')[0]}Z
DTSTART:${dtstart}
DTEND:${dtend}
RRULE:${rrule}
SUMMARY:${series.title}
LOCATION:${series.location || ''}
DESCRIPTION:${series.agenda?.replace(/\n/g, '\\n') || ''}
END:VEVENT
END:VCALENDAR`;

    const blob = new Blob([icsContent], { type: 'text/calendar' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${series.title.replace(/[^a-z0-9]/gi, '_')}.ics`;
    a.click();
    URL.revokeObjectURL(url);
    
    toast({ title: "Downloaded", description: "Calendar file saved" });
  };

  // Create a mock meeting object for the minutes dialog
  const mockMeetingForMinutes = {
    id: series.id,
    title: series.title,
    date: series.occurrences?.[0]?.date || format(new Date(), 'yyyy-MM-dd'),
    startTime: series.startTime,
    endTime: series.endTime,
    location: series.location,
    platform: series.platform,
    project: project?.name || 'Unknown Project',
    projectId: series.projectId,
    agenda: series.agenda,
    meetingLink: series.meetingLink,
  };

  return (
    <Layout>
      <div className="flex flex-col h-full">
        {/* Breadcrumb */}
        <div className="bg-card border-b px-4 sm:px-6 py-2">
          <Breadcrumb 
            items={[
              { label: "Meetings", href: "/" },
              { label: series.title }
            ]} 
          />
        </div>
        
        {/* Top Bar */}
        <div className="bg-card border-b px-4 sm:px-6 py-4 space-y-3 overflow-hidden">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <div className="flex items-center gap-3 w-full">
                <div className="h-8 w-8 rounded-full flex items-center justify-center bg-blue-100 text-blue-600 flex-shrink-0">
                  <Repeat className="h-4 w-4" />
                </div>
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight break-words" data-testid="text-series-title">
                  {series.title}
                </h1>
              </div>
              <Link href={series.projectId ? `/project/${series.projectId}` : "#"}>
                <Badge 
                  variant="outline" 
                  className="font-mono text-xs uppercase tracking-wider cursor-pointer hover:bg-accent transition-colors"
                >
                  {project?.name || 'No Project'}
                </Badge>
              </Link>
              {isClosed && (
                <Badge className="bg-gray-500 text-white" data-testid="badge-closed">
                  <Lock className="h-3 w-3 mr-1" />
                  Closed
                </Badge>
              )}
              {series.removedFromCalendar && (
                <Badge variant="destructive" className="text-xs" data-testid="badge-removed-from-calendar">
                  <AlertTriangle className="h-3 w-3 mr-1" />
                  Removed from Calendar
                </Badge>
              )}
            </div>
            <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center sm:justify-between gap-3">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <Repeat className="h-4 w-4 text-blue-500" />
                  <span className="font-medium text-blue-600">
                    {recurrenceLabels[series.recurrenceRule] || series.recurrenceRule}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  <span>{series.startTime} - {series.endTime}</span>
                </div>
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  <span>{series.location}</span>
                </div>
                <Dialog open={linkDialogOpen} onOpenChange={setLinkDialogOpen}>
                  <div className="flex items-center gap-1">
                    {series.meetingLink ? (
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
                          disabled={updateSeriesLinkMutation.isPending}
                          data-testid="button-save-link"
                        >
                          {updateSeriesLinkMutation.isPending ? "Saving..." : "Save Link"}
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
                      onClick={() => window.open(generateGoogleCalendarUrl(), "_blank")}
                      data-testid="menu-item-google-calendar"
                    >
                      <Calendar className="mr-2 h-4 w-4" />
                      Google Calendar
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      onClick={() => window.open(generateOutlookUrl(), "_blank")}
                      data-testid="menu-item-outlook"
                    >
                      <Calendar className="mr-2 h-4 w-4" />
                      Outlook
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      onClick={handleDownloadICS}
                      data-testid="menu-item-download-ics"
                    >
                      <Download className="mr-2 h-4 w-4" />
                      Download .ics File (Recurring)
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                {series.calendarEventId && canEditMeetings && (
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
                    data-testid="button-close-series"
                  >
                    <Lock className="mr-2 h-3.5 w-3.5" />
                    Close Series
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
                    onClick={() => reopenSeriesMutation.mutate()}
                    disabled={reopenSeriesMutation.isPending}
                    data-testid="button-reopen-series"
                  >
                    <LockOpen className="mr-2 h-3.5 w-3.5" />
                    {reopenSeriesMutation.isPending ? 'Reopening...' : 'Reopen Series'}
                  </Button>
                )}
                {canSendMinutes && (
                  <Button size="sm" onClick={() => setMinutesDialogOpen(true)} data-testid="button-send-minutes">
                    <Send className="mr-2 h-3.5 w-3.5" />
                    Send Minutes
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Content Tabs */}
        <div className="flex-1 overflow-hidden flex flex-col">
          <Tabs defaultValue="agenda" className="flex-1 flex flex-col">
            <div className="px-4 sm:px-6 pt-4">
              <TabsList>
                <TabsTrigger value="agenda" data-testid="tab-agenda">
                  Agenda ({seriesPoints.length})
                </TabsTrigger>
                <TabsTrigger value="attendees" data-testid="tab-attendees">
                  <Users className="h-4 w-4 mr-1.5" />
                  Attendees ({seriesAttendees.length})
                </TabsTrigger>
                <TabsTrigger value="occurrences" data-testid="tab-occurrences">
                  Occurrences ({series.occurrences?.length || 0})
                </TabsTrigger>
              </TabsList>
            </div>

            <div className="flex-1 overflow-y-auto bg-muted/30 px-4 sm:px-6 py-6">
              <TabsContent value="agenda" className="mt-0 max-w-5xl mx-auto space-y-6">
                {series.agenda && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Series Notes</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="whitespace-pre-wrap text-muted-foreground">{series.agenda}</p>
                    </CardContent>
                  </Card>
                )}

                {/* Filtering and Sorting Controls */}
                <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
                  <div className="flex items-center justify-between md:justify-start w-full md:w-auto gap-4">
                    <h2 className="text-lg font-semibold whitespace-nowrap">Discussion Points</h2>
                    {canCreatePoints && (
                      <div className="md:hidden">
                        <AddPointDialog onAddPoint={handleAddPoint} attendees={seriesAttendees} onAddAttendee={handleAddSeriesAttendee} />
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
                        <AddPointDialog onAddPoint={handleAddPoint} attendees={seriesAttendees} onAddAttendee={handleAddSeriesAttendee} />
                      </div>
                    )}
                  </div>
                </div>

                {/* Points List */}
                {filteredAndSortedPoints.length > 0 ? (
                  <div className="space-y-4">
                    {filteredAndSortedPoints.map((point) => (
                      <PointCard
                        key={point.id}
                        point={point}
                        onStatusChange={handleStatusChange}
                        onAddComment={handleAddComment}
                        attendees={seriesAttendees}
                      />
                    ))}
                  </div>
                ) : seriesPoints.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground border rounded-lg bg-muted/20">
                    <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <h3 className="text-lg font-medium mb-1">No discussion points yet</h3>
                    <p className="text-sm">Add points to track coordination items for this recurring series.</p>
                  </div>
                ) : (
                  <div className="text-center py-12 bg-background rounded-lg border border-dashed">
                    <p className="text-muted-foreground" data-testid="text-no-points">No points match your filters</p>
                    <Button variant="link" onClick={() => setFilters({ status: "all", assignedTo: "all", search: "", disciplines: [] })} data-testid="button-clear-filters">
                      Clear all filters
                    </Button>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="attendees" className="mt-0 max-w-4xl mx-auto">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Series Attendees</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <AttendeeManager 
                      type="series"
                      parentId={seriesId}
                      attendees={seriesAttendees}
                      occurrences={series.occurrences || []}
                      projectId={series.projectId}
                    />
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="occurrences" className="mt-0 max-w-4xl mx-auto">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle className="text-lg">Meeting Occurrences</CardTitle>
                    <Button size="sm" variant="outline" disabled className="gap-2">
                      <Plus className="h-4 w-4" />
                      Add Occurrence
                    </Button>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {series.occurrences && series.occurrences.length > 0 ? (
                      series.occurrences.map((occurrence) => (
                        <OccurrenceCard key={occurrence.id} occurrence={occurrence} />
                      ))
                    ) : (
                      <div className="text-center py-8 text-muted-foreground">
                        <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
                        <p>No occurrences scheduled yet.</p>
                        <p className="text-sm">Add occurrences to track individual meeting dates.</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </div>
          </Tabs>
        </div>
      </div>

      {/* Meeting Minutes Dialog */}
      <MeetingMinutesDialog
        open={minutesDialogOpen}
        onOpenChange={setMinutesDialogOpen}
        meeting={mockMeetingForMinutes as any}
        points={filteredAndSortedPoints}
        attendees={seriesAttendees}
        attendanceRecords={occurrenceAttendance}
      />

      <CloseMeetingDialog
        open={closeDialogOpen}
        onOpenChange={setCloseDialogOpen}
        type="series"
        series={{
          id: seriesId,
          title: series.title,
          projectId: series.projectId,
        }}
        openPoints={openPoints.map((p: PointWithRelations) => ({
          id: p.id,
          title: p.title,
          status: p.status,
        }))}
        onClosed={() => {
          queryClient.invalidateQueries({ queryKey: ["meeting-series", seriesId] });
          queryClient.invalidateQueries({ queryKey: ["meeting-series"] });
          queryClient.invalidateQueries({ queryKey: ["meeting-point-counts"] });
          queryClient.invalidateQueries({ queryKey: ["series-point-counts"] });
        }}
      />
    </Layout>
  );
}
