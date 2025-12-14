import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { useAuth } from "@/contexts/auth-context";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Calendar, Download, AlertCircle, Loader2, Repeat, Search, Users, Link, Check, RefreshCw, Clock, MapPin } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { meetingsApi, meetingSeriesApi, meetingOccurrencesApi, projectsApi, seriesAttendeesApi, attendeesApi, calendarApi } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
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
import { format, addWeeks, addMonths, parseISO } from "date-fns";
import { useLocation } from "wouter";

interface CalendarEventAttendee {
  email: string;
  name?: string;
  responseStatus?: string;
}

interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  location?: string;
  startDateTime: string;
  endDateTime: string;
  startTime: string;
  endTime: string;
  date: string;
  isRecurring: boolean;
  recurrenceRule?: string;
  recurrencePattern?: string;
  attendees: CalendarEventAttendee[];
  organizer?: CalendarEventAttendee;
  meetingLink?: string;
  provider: 'google' | 'outlook';
}

interface DayActionsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedDate: Date;
}

export default function DayActionsDialog({ open, onOpenChange, selectedDate }: DayActionsDialogProps) {
  const { permissions } = useAuth();
  const canCreateMeetings = permissions?.canCreateMeetings ?? false;
  const [activeTab, setActiveTab] = useState(canCreateMeetings ? "create" : "view");
  const [, navigate] = useLocation();
  
  const [title, setTitle] = useState("");
  const [projectId, setProjectId] = useState("");
  const [projectName, setProjectName] = useState("");
  const [startTime, setStartTime] = useState("10:00");
  const [endTime, setEndTime] = useState("11:30");
  const [location, setLocation] = useState("");
  const [platform, setPlatform] = useState<"outlook" | "gmail">("outlook");
  const [agenda, setAgenda] = useState("");
  const [meetingLink, setMeetingLink] = useState("");
  
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurrenceRule, setRecurrenceRule] = useState<"weekly" | "biweekly" | "monthly">("weekly");
  const [occurrenceCount, setOccurrenceCount] = useState(6);
  
  const [calendarSearch, setCalendarSearch] = useState("");
  const [selectedProvider, setSelectedProvider] = useState<"all" | "google" | "outlook">("all");
  const [selectedEvents, setSelectedEvents] = useState<Set<string>>(new Set());
  const [importingEventId, setImportingEventId] = useState<string | null>(null);
  
  const [duplicateDialogOpen, setDuplicateDialogOpen] = useState(false);
  const [duplicateInfo, setDuplicateInfo] = useState<any>(null);
  const [pendingCalendarEvent, setPendingCalendarEvent] = useState<CalendarEvent | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  const queryClient = useQueryClient();
  const { toast } = useToast();

  const dateString = format(selectedDate, "yyyy-MM-dd");

  const { data: projects = [] } = useQuery({
    queryKey: ["projects-dropdown"],
    queryFn: () => projectsApi.getAll({}),
  });

  const [googleEvents, setGoogleEvents] = useState<CalendarEvent[]>([]);
  const [outlookEvents, setOutlookEvents] = useState<CalendarEvent[]>([]);
  const [isLoadingEvents, setIsLoadingEvents] = useState(false);
  const [eventsError, setEventsError] = useState<string | null>(null);

  const fetchCalendarEvents = async () => {
    if (!open) return;
    
    setIsLoadingEvents(true);
    setEventsError(null);
    
    try {
      const params = new URLSearchParams({
        startDate: dateString,
        endDate: dateString,
      });
      
      const [googleRes, outlookRes] = await Promise.allSettled([
        fetch(`/api/calendar/events?${params.toString()}&provider=google`).then(r => r.json()),
        fetch(`/api/calendar/events?${params.toString()}&provider=outlook`).then(r => r.json()),
      ]);
      
      if (googleRes.status === 'fulfilled') {
        const data = googleRes.value;
        const events = Array.isArray(data) ? data : (data?.events || []);
        setGoogleEvents(events.map((e: any) => ({ ...e, provider: 'google' as const })));
      } else {
        setGoogleEvents([]);
      }
      
      if (outlookRes.status === 'fulfilled') {
        const data = outlookRes.value;
        const events = Array.isArray(data) ? data : (data?.events || []);
        setOutlookEvents(events.map((e: any) => ({ ...e, provider: 'outlook' as const })));
      } else {
        setOutlookEvents([]);
      }
    } catch (error) {
      console.error('Failed to fetch calendar events:', error);
      setEventsError('Failed to load calendar events');
    } finally {
      setIsLoadingEvents(false);
    }
  };

  // Clear events and fetch fresh data whenever dialog opens or date changes
  useEffect(() => {
    if (open) {
      // Clear stale events from previous date
      setGoogleEvents([]);
      setOutlookEvents([]);
      setEventsError(null);
      // Fetch events for the new date
      fetchCalendarEvents();
    }
  }, [open, dateString]);

  const allEvents = [...googleEvents, ...outlookEvents];
  
  const filteredEvents = allEvents.filter(event => {
    const matchesDate = event.date === dateString;
    const matchesSearch = !calendarSearch || 
      event.title.toLowerCase().includes(calendarSearch.toLowerCase()) ||
      event.location?.toLowerCase().includes(calendarSearch.toLowerCase());
    const matchesProvider = selectedProvider === "all" || event.provider === selectedProvider;
    return matchesDate && matchesSearch && matchesProvider;
  });

  const resetForm = () => {
    setTitle("");
    setProjectId("");
    setProjectName("");
    setStartTime("10:00");
    setEndTime("11:30");
    setLocation("");
    setAgenda("");
    setMeetingLink("");
    setIsRecurring(false);
    setRecurrenceRule("weekly");
    setOccurrenceCount(6);
    setCalendarSearch("");
    setSelectedEvents(new Set());
  };

  const createMeetingMutation = useMutation({
    mutationFn: meetingsApi.create,
    onSuccess: (meeting) => {
      queryClient.invalidateQueries({ queryKey: ["meetings"] });
      onOpenChange(false);
      resetForm();
      toast({
        title: "Meeting Created",
        description: "Your coordination meeting has been scheduled.",
      });
      navigate(`/meeting/${meeting.id}`);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create meeting. Please try again.",
        variant: "destructive",
      });
    },
  });

  const createSeriesMutation = useMutation({
    mutationFn: async (data: { series: any; occurrences: any[] }) => {
      const series = await meetingSeriesApi.create(data.series);
      for (const occ of data.occurrences) {
        await meetingOccurrencesApi.create({
          ...occ,
          seriesId: series.id,
        });
      }
      return series;
    },
    onSuccess: (series) => {
      queryClient.invalidateQueries({ queryKey: ["meetings"] });
      queryClient.invalidateQueries({ queryKey: ["meeting-series"] });
      onOpenChange(false);
      resetForm();
      toast({
        title: "Meeting Series Created",
        description: `Created series with ${occurrenceCount} occurrences.`,
      });
      navigate(`/series/${series.id}`);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create meeting series. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleCreateMeeting = () => {
    if (!title.trim()) {
      toast({
        title: "Validation Error",
        description: "Please enter a meeting title.",
        variant: "destructive",
      });
      return;
    }

    if (isRecurring) {
      const startDate = selectedDate;
      const occurrences = [];
      
      for (let i = 0; i < occurrenceCount; i++) {
        let occDate: Date;
        if (recurrenceRule === "weekly") {
          occDate = addWeeks(startDate, i);
        } else if (recurrenceRule === "biweekly") {
          occDate = addWeeks(startDate, i * 2);
        } else {
          occDate = addMonths(startDate, i);
        }
        occurrences.push({
          date: format(occDate, "yyyy-MM-dd"),
          startTime,
          endTime,
          location,
          status: "scheduled",
        });
      }

      createSeriesMutation.mutate({
        series: {
          title: title.trim(),
          projectId: projectId || undefined,
          recurrenceRule,
          startTime,
          endTime,
          location,
          platform,
          agenda,
          meetingLink,
        },
        occurrences,
      });
    } else {
      createMeetingMutation.mutate({
        title: title.trim(),
        projectId: projectId || undefined,
        project: projectName || "No Project",
        date: dateString,
        startTime,
        endTime,
        location,
        platform,
        agenda,
        meetingLink,
      });
    }
  };

  const handleImportEvent = async (event: CalendarEvent) => {
    setImportingEventId(event.id);
    
    try {
      const duplicateCheck = await calendarApi.checkDuplicate(event.id);
      
      if (duplicateCheck.isDuplicate) {
        setDuplicateInfo(duplicateCheck);
        setPendingCalendarEvent(event);
        setDuplicateDialogOpen(true);
        setImportingEventId(null);
        return;
      }

      await importEventToDatabase(event);
    } catch (error) {
      console.error('Import error:', error);
      toast({
        title: "Import Failed",
        description: "Failed to import the calendar event. Please try again.",
        variant: "destructive",
      });
    } finally {
      setImportingEventId(null);
    }
  };

  const importEventToDatabase = async (event: CalendarEvent) => {
    const platformValue = event.provider === 'google' ? 'gmail' : 'outlook';
    
    if (event.isRecurring) {
      const endDate = format(addMonths(parseISO(event.date), 3), "yyyy-MM-dd");
      const occurrencesResponse = await fetch(
        `/api/calendar/events/${encodeURIComponent(event.id)}/occurrences?provider=${event.provider}&startDate=${event.date}&endDate=${endDate}`
      );
      const occurrences = await occurrencesResponse.json();
      
      const series = await meetingSeriesApi.create({
        title: event.title,
        projectId: undefined,
        recurrenceRule: mapRecurrenceRule(event.recurrencePattern),
        startTime: event.startTime,
        endTime: event.endTime,
        location: event.location || '',
        platform: platformValue,
        agenda: event.description || '',
        meetingLink: event.meetingLink || '',
        calendarEventId: event.id,
      });
      
      for (const occ of occurrences) {
        await meetingOccurrencesApi.create({
          seriesId: series.id,
          date: occ.date,
          startTimeOverride: occ.startTime !== event.startTime ? occ.startTime : undefined,
          endTimeOverride: occ.endTime !== event.endTime ? occ.endTime : undefined,
          locationOverride: occ.location && occ.location !== event.location ? occ.location : undefined,
          status: 'scheduled',
        });
      }
      
      if (event.attendees && event.attendees.length > 0) {
        for (const att of event.attendees) {
          if (att.email) {
            try {
              await seriesAttendeesApi.create({
                seriesId: series.id,
                name: att.name || att.email.split('@')[0],
                email: att.email,
                role: 'Participant',
                company: '',
              });
            } catch (e) {}
          }
        }
      }
      
      toast({
        title: "Series Imported",
        description: `Imported "${event.title}" as a recurring series.`,
      });
      
      queryClient.invalidateQueries({ queryKey: ["meeting-series"] });
      navigate(`/series/${series.id}`);
    } else {
        const meeting = await meetingsApi.create({
        title: event.title,
        projectId: undefined,
        project: "Imported Meeting",
        date: event.date,
        startTime: event.startTime,
        endTime: event.endTime,
        location: event.location || '',
        platform: platformValue,
        agenda: event.description || '',
        meetingLink: event.meetingLink || '',
        calendarEventId: event.id,
      });
      
      if (event.attendees && event.attendees.length > 0) {
        for (const att of event.attendees) {
          if (att.email) {
            try {
              await attendeesApi.create({
                meetingId: meeting.id,
                name: att.name || att.email.split('@')[0],
                email: att.email,
                role: 'Participant',
                company: '',
              });
            } catch (e) {}
          }
        }
      }
      
      toast({
        title: "Meeting Imported",
        description: `Imported "${event.title}" successfully.`,
      });
      
      queryClient.invalidateQueries({ queryKey: ["meetings"] });
      navigate(`/meeting/${meeting.id}`);
    }
    
    onOpenChange(false);
    resetForm();
  };

  const mapRecurrenceRule = (pattern?: string): "weekly" | "biweekly" | "monthly" => {
    if (!pattern) return "weekly";
    const lower = pattern.toLowerCase();
    if (lower.includes("month")) return "monthly";
    if (lower.includes("2 week") || lower.includes("bi")) return "biweekly";
    return "weekly";
  };

  const handleSyncDuplicate = async () => {
    if (!duplicateInfo?.entity) return;
    
    setIsSyncing(true);
    try {
      if (duplicateInfo.type === 'meeting') {
        await calendarApi.syncMeeting(duplicateInfo.entity.id);
        toast({
          title: "Meeting Synced",
          description: "The meeting has been updated from the calendar.",
        });
        queryClient.invalidateQueries({ queryKey: ["meetings"] });
        navigate(`/meeting/${duplicateInfo.entity.id}`);
      } else {
        await calendarApi.syncSeries(duplicateInfo.entity.id);
        toast({
          title: "Series Synced",
          description: "The series has been updated from the calendar.",
        });
        queryClient.invalidateQueries({ queryKey: ["meeting-series"] });
        navigate(`/series/${duplicateInfo.entity.id}`);
      }
      setDuplicateDialogOpen(false);
      onOpenChange(false);
    } catch (error) {
      toast({
        title: "Sync Failed",
        description: "Failed to sync from calendar. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSyncing(false);
    }
  };

  const handleBulkImport = async () => {
    if (selectedEvents.size === 0) {
      toast({
        title: "No Events Selected",
        description: "Please select at least one event to import.",
        variant: "destructive",
      });
      return;
    }

    const eventsToImport = filteredEvents.filter(e => selectedEvents.has(e.id));
    let successCount = 0;
    let duplicateCount = 0;

    for (const event of eventsToImport) {
      try {
        const duplicateCheck = await calendarApi.checkDuplicate(event.id);
        if (duplicateCheck.isDuplicate) {
          duplicateCount++;
          continue;
        }
        await importEventToDatabase(event);
        successCount++;
      } catch (error) {
        console.error(`Failed to import event ${event.id}:`, error);
      }
    }

    toast({
      title: "Bulk Import Complete",
      description: `Imported ${successCount} event(s). ${duplicateCount > 0 ? `${duplicateCount} already exist.` : ''}`,
    });
    
    setSelectedEvents(new Set());
    queryClient.invalidateQueries({ queryKey: ["meetings"] });
    queryClient.invalidateQueries({ queryKey: ["meeting-series"] });
  };

  const toggleEventSelection = (eventId: string) => {
    const newSelected = new Set(selectedEvents);
    if (newSelected.has(eventId)) {
      newSelected.delete(eventId);
    } else {
      newSelected.add(eventId);
    }
    setSelectedEvents(newSelected);
  };

  const toggleSelectAll = () => {
    if (selectedEvents.size === filteredEvents.length) {
      setSelectedEvents(new Set());
    } else {
      setSelectedEvents(new Set(filteredEvents.map(e => e.id)));
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              {format(selectedDate, "EEEE, MMMM d, yyyy")}
            </DialogTitle>
            <DialogDescription>
              {canCreateMeetings ? "Create a new meeting or import from your connected calendars" : "View calendar events for this day"}
            </DialogDescription>
          </DialogHeader>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 overflow-hidden flex flex-col">
            <TabsList className={canCreateMeetings ? "grid w-full grid-cols-2" : "grid w-full grid-cols-1"}>
              {canCreateMeetings && (
                <TabsTrigger value="create" data-testid="tab-create">
                  <Plus className="h-4 w-4 mr-2" />
                  Create Meeting
                </TabsTrigger>
              )}
              <TabsTrigger value="import" data-testid="tab-import">
                <Download className="h-4 w-4 mr-2" />
                {canCreateMeetings ? "Import from Calendar" : "View Calendar Events"}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="create" className="flex-1 overflow-auto mt-4">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="title">Meeting Title *</Label>
                  <Input
                    id="title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g., BIM Coordination Meeting"
                    data-testid="input-title"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="project">Project</Label>
                  <Select
                    value={projectId}
                    onValueChange={(value) => {
                      setProjectId(value);
                      const project = projects.find(p => p.id === value);
                      setProjectName(project?.name || "");
                    }}
                  >
                    <SelectTrigger data-testid="select-project">
                      <SelectValue placeholder="Select project (optional)" />
                    </SelectTrigger>
                    <SelectContent>
                      {projects.map((project) => (
                        <SelectItem key={project.id} value={project.id}>
                          {project.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="startTime">Start Time</Label>
                    <Input
                      id="startTime"
                      type="time"
                      value={startTime}
                      onChange={(e) => setStartTime(e.target.value)}
                      data-testid="input-start-time"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="endTime">End Time</Label>
                    <Input
                      id="endTime"
                      type="time"
                      value={endTime}
                      onChange={(e) => setEndTime(e.target.value)}
                      data-testid="input-end-time"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="location">Location</Label>
                  <Input
                    id="location"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="e.g., Conference Room A / Microsoft Teams"
                    data-testid="input-location"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="meetingLink">Meeting Link (optional)</Label>
                  <Input
                    id="meetingLink"
                    value={meetingLink}
                    onChange={(e) => setMeetingLink(e.target.value)}
                    placeholder="https://teams.microsoft.com/..."
                    data-testid="input-meeting-link"
                  />
                </div>

                <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
                  <div className="flex items-center gap-2">
                    <Repeat className="h-4 w-4 text-blue-500" />
                    <div>
                      <Label htmlFor="recurring" className="font-medium">Recurring Meeting</Label>
                      <p className="text-xs text-muted-foreground">Create as a meeting series</p>
                    </div>
                  </div>
                  <Switch
                    id="recurring"
                    checked={isRecurring}
                    onCheckedChange={setIsRecurring}
                    data-testid="switch-recurring"
                  />
                </div>

                {isRecurring && (
                  <div className="grid grid-cols-2 gap-4 p-3 rounded-lg border bg-blue-50/50 dark:bg-blue-950/20">
                    <div className="space-y-2">
                      <Label>Frequency</Label>
                      <Select value={recurrenceRule} onValueChange={(v: any) => setRecurrenceRule(v)}>
                        <SelectTrigger data-testid="select-recurrence">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="weekly">Weekly</SelectItem>
                          <SelectItem value="biweekly">Every 2 weeks</SelectItem>
                          <SelectItem value="monthly">Monthly</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Occurrences</Label>
                      <Input
                        type="number"
                        min={2}
                        max={52}
                        value={occurrenceCount}
                        onChange={(e) => setOccurrenceCount(parseInt(e.target.value) || 6)}
                        data-testid="input-occurrences"
                      />
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="agenda">Agenda (optional)</Label>
                  <Textarea
                    id="agenda"
                    value={agenda}
                    onChange={(e) => setAgenda(e.target.value)}
                    placeholder="Meeting agenda and discussion points..."
                    rows={3}
                    data-testid="input-agenda"
                  />
                </div>

                <Button
                  onClick={handleCreateMeeting}
                  disabled={createMeetingMutation.isPending || createSeriesMutation.isPending}
                  className="w-full"
                  data-testid="button-create-meeting"
                >
                  {(createMeetingMutation.isPending || createSeriesMutation.isPending) && (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  )}
                  {isRecurring ? `Create Series (${occurrenceCount} meetings)` : "Create Meeting"}
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="import" className="flex-1 overflow-hidden flex flex-col mt-4">
              <div className="space-y-4 flex-1 overflow-hidden flex flex-col">
                <div className="flex items-center justify-between bg-muted/50 rounded-lg p-3 border">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-primary" />
                    <span className="text-sm font-medium">
                      Events for {format(selectedDate, "EEEE, MMMM d, yyyy")}
                    </span>
                  </div>
                  <Button variant="ghost" size="sm" onClick={fetchCalendarEvents} disabled={isLoadingEvents}>
                    <RefreshCw className={`h-4 w-4 ${isLoadingEvents ? 'animate-spin' : ''}`} />
                  </Button>
                </div>

                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search events..."
                      value={calendarSearch}
                      onChange={(e) => setCalendarSearch(e.target.value)}
                      className="pl-9"
                      data-testid="input-search-events"
                    />
                  </div>
                  <Select value={selectedProvider} onValueChange={(v: any) => setSelectedProvider(v)}>
                    <SelectTrigger className="w-36" data-testid="select-provider-filter">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Calendars</SelectItem>
                      <SelectItem value="google">Google</SelectItem>
                      <SelectItem value="outlook">Outlook</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {filteredEvents.length > 0 && (
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="select-all"
                        checked={selectedEvents.size === filteredEvents.length && filteredEvents.length > 0}
                        onCheckedChange={toggleSelectAll}
                        data-testid="checkbox-select-all"
                      />
                      <label htmlFor="select-all" className="text-muted-foreground cursor-pointer">
                        Select all ({filteredEvents.length})
                      </label>
                    </div>
                    {selectedEvents.size > 0 && (
                      <Button size="sm" onClick={handleBulkImport} data-testid="button-bulk-import">
                        <Download className="h-4 w-4 mr-2" />
                        Import {selectedEvents.size} selected
                      </Button>
                    )}
                  </div>
                )}

                <ScrollArea className="flex-1">
                  {isLoadingEvents ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                    </div>
                  ) : eventsError ? (
                    <div className="text-center py-12 text-muted-foreground">
                      <AlertCircle className="h-8 w-8 mx-auto mb-2" />
                      <p>{eventsError}</p>
                    </div>
                  ) : filteredEvents.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                      <Calendar className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p>No calendar events found for this date</p>
                      <p className="text-xs mt-1">Make sure your calendars are connected in Settings</p>
                    </div>
                  ) : (
                    <div className="space-y-2 pr-4">
                      {filteredEvents.map((event) => (
                        <Card
                          key={event.id}
                          className={`cursor-pointer transition-colors ${
                            selectedEvents.has(event.id) ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'
                          }`}
                          onClick={() => toggleEventSelection(event.id)}
                          data-testid={`card-event-${event.id}`}
                        >
                          <CardContent className="p-3">
                            <div className="flex items-start gap-3">
                              <Checkbox
                                checked={selectedEvents.has(event.id)}
                                onCheckedChange={() => toggleEventSelection(event.id)}
                                onClick={(e) => e.stopPropagation()}
                                data-testid={`checkbox-event-${event.id}`}
                              />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="font-medium truncate">{event.title}</span>
                                  {event.isRecurring && (
                                    <Badge variant="secondary" className="text-xs">
                                      <Repeat className="h-3 w-3 mr-1" />
                                      Recurring
                                    </Badge>
                                  )}
                                  <Badge
                                    variant="outline"
                                    className={event.provider === 'google' ? 'text-red-600 border-red-200' : 'text-blue-600 border-blue-200'}
                                  >
                                    {event.provider === 'google' ? 'Google' : 'Outlook'}
                                  </Badge>
                                </div>
                                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                                  <span className="flex items-center gap-1">
                                    <Clock className="h-3 w-3" />
                                    {event.startTime} - {event.endTime}
                                  </span>
                                  {event.location && (
                                    <span className="flex items-center gap-1 truncate">
                                      <MapPin className="h-3 w-3" />
                                      {event.location}
                                    </span>
                                  )}
                                  {event.attendees?.length > 0 && (
                                    <span className="flex items-center gap-1">
                                      <Users className="h-3 w-3" />
                                      {event.attendees.length}
                                    </span>
                                  )}
                                </div>
                              </div>
                              {canCreateMeetings && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleImportEvent(event);
                                  }}
                                  disabled={importingEventId === event.id}
                                  data-testid={`button-import-${event.id}`}
                                >
                                  {importingEventId === event.id ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <Download className="h-4 w-4" />
                                  )}
                                </Button>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </div>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      <AlertDialog open={duplicateDialogOpen} onOpenChange={setDuplicateDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-amber-500" />
              Event Already Imported
            </AlertDialogTitle>
            <AlertDialogDescription>
              This calendar event has already been imported as a {duplicateInfo?.type}.
              Would you like to sync the latest changes from your calendar?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleSyncDuplicate} disabled={isSyncing}>
              {isSyncing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Sync from Calendar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
