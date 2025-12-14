import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import { Plus, Calendar, Upload, Mail, FileUp, Check, AlertCircle, Loader2, Repeat, Search, Users, Link, RefreshCw, Settings, Download, Clock, MapPin } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { meetingsApi, meetingSeriesApi, meetingOccurrencesApi, projectsApi, attendeesApi, seriesAttendeesApi, calendarApi, type DuplicateCheckResult } from "@/lib/api";
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
import { format, addWeeks, addMonths, startOfDay, endOfDay, parseISO } from "date-fns";
import { useLocation } from "wouter";

// Calendar event types from backend
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

interface AddMeetingDialogProps {
  trigger?: React.ReactNode;
}

export default function AddMeetingDialog({ trigger }: AddMeetingDialogProps) {
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("manual");
  const [, navigate] = useLocation();
  
  // Manual form state
  const [title, setTitle] = useState("");
  const [projectId, setProjectId] = useState("");
  const [projectName, setProjectName] = useState("");
  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [startTime, setStartTime] = useState("10:00");
  const [endTime, setEndTime] = useState("11:30");
  const [location, setLocation] = useState("");
  const [platform, setPlatform] = useState<"outlook" | "gmail">("outlook");
  const [agenda, setAgenda] = useState("");
  const [meetingLink, setMeetingLink] = useState("");
  
  // Recurring meeting state
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurrenceRule, setRecurrenceRule] = useState<"weekly" | "biweekly" | "monthly">("weekly");
  const [occurrenceCount, setOccurrenceCount] = useState(6);
  
  // File import state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [importedEvents, setImportedEvents] = useState<any[]>([]);
  const [isParsingFile, setIsParsingFile] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Calendar import state
  const [calendarStartDate, setCalendarStartDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [calendarEndDate, setCalendarEndDate] = useState(format(addMonths(new Date(), 3), "yyyy-MM-dd"));
  const [calendarSearch, setCalendarSearch] = useState("");
  const [importingEventId, setImportingEventId] = useState<string | null>(null);
  
  // Duplicate detection state
  const [duplicateDialogOpen, setDuplicateDialogOpen] = useState(false);
  const [duplicateInfo, setDuplicateInfo] = useState<DuplicateCheckResult | null>(null);
  const [pendingCalendarEvent, setPendingCalendarEvent] = useState<CalendarEvent | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  // Bulk import state
  const [bulkStartDate, setBulkStartDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [bulkEndDate, setBulkEndDate] = useState(format(addMonths(new Date(), 3), "yyyy-MM-dd"));
  const [bulkSearch, setBulkSearch] = useState("");
  const [bulkProvider, setBulkProvider] = useState<"all" | "google" | "outlook">("all");
  const [selectedEvents, setSelectedEvents] = useState<Set<string>>(new Set());
  const [isLoadingBulkEvents, setIsLoadingBulkEvents] = useState(false);
  const [bulkGoogleEvents, setBulkGoogleEvents] = useState<CalendarEvent[]>([]);
  const [bulkOutlookEvents, setBulkOutlookEvents] = useState<CalendarEvent[]>([]);
  const [isImportingBulk, setIsImportingBulk] = useState(false);
  const bulkFileInputRef = useRef<HTMLInputElement>(null);
  const [bulkIcsFile, setBulkIcsFile] = useState<File | null>(null);
  const [bulkIcsEvents, setBulkIcsEvents] = useState<CalendarEvent[]>([]);
  const [isBulkParsingFile, setIsBulkParsingFile] = useState(false);
  const [bulkImportSource, setBulkImportSource] = useState<"calendar" | "file">("calendar");

  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Fetch projects for dropdown (separate cache key to avoid conflicts)
  const { data: projects = [] } = useQuery({
    queryKey: ["projects-dropdown"],
    queryFn: () => projectsApi.getAll({}),
  });

  const createMeetingMutation = useMutation({
    mutationFn: meetingsApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["meetings"] });
      setOpen(false);
      resetForm();
      toast({
        title: "Meeting Created",
        description: "Your coordination meeting has been scheduled.",
      });
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
    mutationFn: async (data: { series: any; occurrences: any[]; attendees?: CalendarEventAttendee[] }) => {
      const series = await meetingSeriesApi.create(data.series);
      // Create occurrences for the series
      for (const occ of data.occurrences) {
        await meetingOccurrencesApi.create({
          ...occ,
          seriesId: series.id,
        });
      }
      // Import attendees if provided
      if (data.attendees && data.attendees.length > 0) {
        for (const att of data.attendees) {
          if (att.email) {
            try {
              await seriesAttendeesApi.create({
                seriesId: series.id,
                name: att.name || att.email.split('@')[0],
                email: att.email,
                role: 'Participant',
                company: '',
              });
            } catch (e) {
              // Ignore duplicate attendee errors
            }
          }
        }
      }
      return series;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["meetings"] });
      queryClient.invalidateQueries({ queryKey: ["meeting-series"] });
      setOpen(false);
      resetForm();
      toast({
        title: "Recurring Meeting Created",
        description: `Your recurring meeting series has been created with ${occurrenceCount} occurrences.`,
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create recurring meeting. Please try again.",
        variant: "destructive",
      });
    },
  });
  
  // Debounced search for calendar events (client-side filtering is fine for smaller lists)
  // but we send search to backend for server-side filtering on large calendars
  
  // Fetch Outlook calendar events
  const { 
    data: outlookCalendarData,
    isLoading: isLoadingOutlook,
    error: outlookError,
    refetch: refetchOutlook,
  } = useQuery({
    queryKey: ["calendar-events", "outlook", calendarStartDate, calendarEndDate, calendarSearch],
    queryFn: async () => {
      const params = new URLSearchParams({
        provider: 'outlook',
        startDate: calendarStartDate,
        endDate: calendarEndDate,
      });
      if (calendarSearch.trim()) {
        params.append('search', calendarSearch.trim());
      }
      const response = await fetch(`/api/calendar/events?${params.toString()}`);
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to fetch Outlook events');
      }
      return response.json();
    },
    enabled: activeTab === 'outlook' && open,
    retry: false,
    staleTime: 30000,
  });
  
  // Fetch Google calendar events
  const { 
    data: googleCalendarData,
    isLoading: isLoadingGoogle,
    error: googleError,
    refetch: refetchGoogle,
  } = useQuery({
    queryKey: ["calendar-events", "google", calendarStartDate, calendarEndDate, calendarSearch],
    queryFn: async () => {
      const params = new URLSearchParams({
        provider: 'google',
        startDate: calendarStartDate,
        endDate: calendarEndDate,
      });
      if (calendarSearch.trim()) {
        params.append('search', calendarSearch.trim());
      }
      const response = await fetch(`/api/calendar/events?${params.toString()}`);
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to fetch Google events');
      }
      return response.json();
    },
    enabled: activeTab === 'google' && open,
    retry: false,
    staleTime: 30000,
  });
  
  // Filter events by search query
  const filterEvents = (events: CalendarEvent[] | undefined): CalendarEvent[] => {
    if (!events) return [];
    if (!calendarSearch.trim()) return events;
    const query = calendarSearch.toLowerCase();
    return events.filter(e => 
      e.title.toLowerCase().includes(query) ||
      e.location?.toLowerCase().includes(query) ||
      e.description?.toLowerCase().includes(query)
    );
  };
  
  const outlookEvents = filterEvents(outlookCalendarData?.events);
  const googleEvents = filterEvents(googleCalendarData?.events);

  const resetForm = () => {
    setTitle("");
    setProjectId("");
    setProjectName("");
    setDate(format(new Date(), "yyyy-MM-dd"));
    setStartTime("10:00");
    setEndTime("11:30");
    setLocation("");
    setPlatform("outlook");
    setAgenda("");
    setMeetingLink("");
    setIsRecurring(false);
    setRecurrenceRule("weekly");
    setOccurrenceCount(6);
    setSelectedFile(null);
    setImportedEvents([]);
    setActiveTab("manual");
    // Reset bulk import state
    setSelectedEvents(new Set());
    setBulkGoogleEvents([]);
    setBulkOutlookEvents([]);
    setBulkIcsFile(null);
    setBulkIcsEvents([]);
    setBulkSearch("");
    setBulkImportSource("calendar");
  };

  // Bulk import functions
  const fetchBulkCalendarEvents = async () => {
    setIsLoadingBulkEvents(true);
    try {
      const params = new URLSearchParams({
        startDate: bulkStartDate,
        endDate: bulkEndDate,
      });
      
      const [googleRes, outlookRes] = await Promise.allSettled([
        fetch(`/api/calendar/events?${params.toString()}&provider=google`).then(r => r.json()),
        fetch(`/api/calendar/events?${params.toString()}&provider=outlook`).then(r => r.json()),
      ]);
      
      if (googleRes.status === 'fulfilled') {
        const data = googleRes.value;
        const events = Array.isArray(data) ? data : (data?.events || []);
        setBulkGoogleEvents(events.map((e: any) => ({ ...e, provider: 'google' as const })));
      } else {
        setBulkGoogleEvents([]);
      }
      
      if (outlookRes.status === 'fulfilled') {
        const data = outlookRes.value;
        const events = Array.isArray(data) ? data : (data?.events || []);
        setBulkOutlookEvents(events.map((e: any) => ({ ...e, provider: 'outlook' as const })));
      } else {
        setBulkOutlookEvents([]);
      }
    } catch (error) {
      console.error('Failed to fetch calendar events:', error);
    } finally {
      setIsLoadingBulkEvents(false);
    }
  };

  const handleBulkIcsFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setBulkIcsFile(file);
    setIsBulkParsingFile(true);
    
    try {
      const formData = new FormData();
      formData.append('file', file);
      
      const response = await fetch('/api/calendar/import/ics', {
        method: 'POST',
        body: formData,
      });
      
      if (!response.ok) {
        throw new Error('Failed to parse ICS file');
      }
      
      const events = await response.json();
      setBulkIcsEvents(events);
      toast({
        title: "File Parsed",
        description: `Found ${events.length} events in the file.`,
      });
    } catch (error) {
      toast({
        title: "Parse Error",
        description: "Failed to parse the calendar file.",
        variant: "destructive",
      });
      setBulkIcsEvents([]);
    } finally {
      setIsBulkParsingFile(false);
    }
  };

  const getBulkEvents = () => {
    if (bulkImportSource === "file") return bulkIcsEvents;
    return [...bulkGoogleEvents, ...bulkOutlookEvents];
  };

  const getFilteredBulkEvents = () => {
    const allEvents = getBulkEvents();
    return allEvents.filter(event => {
      const matchesSearch = !bulkSearch || 
        event.title.toLowerCase().includes(bulkSearch.toLowerCase()) ||
        event.location?.toLowerCase().includes(bulkSearch.toLowerCase());
      const matchesProvider = bulkImportSource === "file" || bulkProvider === "all" || event.provider === bulkProvider;
      return matchesSearch && matchesProvider;
    });
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

  const toggleSelectAllEvents = () => {
    const filtered = getFilteredBulkEvents();
    if (selectedEvents.size === filtered.length) {
      setSelectedEvents(new Set());
    } else {
      setSelectedEvents(new Set(filtered.map(e => e.id)));
    }
  };

  const mapRecurrenceRule = (pattern?: string): "weekly" | "biweekly" | "monthly" => {
    if (!pattern) return "weekly";
    const lower = pattern.toLowerCase();
    if (lower.includes("month")) return "monthly";
    if (lower.includes("2 week") || lower.includes("bi")) return "biweekly";
    return "weekly";
  };

  const importEventToDatabase = async (event: CalendarEvent) => {
    const platformValue = event.provider === 'google' ? 'gmail' : 'outlook';
    
    if (event.isRecurring) {
      const occEndDate = format(addMonths(parseISO(event.date), 3), "yyyy-MM-dd");
      const occurrencesResponse = await fetch(
        `/api/calendar/events/${encodeURIComponent(event.id)}/occurrences?provider=${event.provider}&startDate=${event.date}&endDate=${occEndDate}`
      );
      const occurrences = await occurrencesResponse.json();
      
      const series = await meetingSeriesApi.create({
        title: event.title,
        projectId: projectId || undefined,
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
      
      return { type: 'series', id: series.id };
    } else {
      const meeting = await meetingsApi.create({
        title: event.title,
        projectId: projectId || undefined,
        project: projectName || "Imported Meeting",
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
      
      return { type: 'meeting', id: meeting.id };
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

    setIsImportingBulk(true);
    const eventsToImport = getFilteredBulkEvents().filter(e => selectedEvents.has(e.id));
    let successCount = 0;
    let duplicateCount = 0;
    let errorCount = 0;

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
        errorCount++;
      }
    }

    toast({
      title: "Bulk Import Complete",
      description: `Imported ${successCount} event(s). ${duplicateCount > 0 ? `${duplicateCount} already exist. ` : ''}${errorCount > 0 ? `${errorCount} failed.` : ''}`,
    });
    
    setSelectedEvents(new Set());
    queryClient.invalidateQueries({ queryKey: ["meetings"] });
    queryClient.invalidateQueries({ queryKey: ["meeting-series"] });
    setIsImportingBulk(false);
    
    if (successCount > 0) {
      setOpen(false);
      resetForm();
    }
  };

  const handleProjectChange = (id: string) => {
    setProjectId(id);
    const project = projects.find(p => p.id === id);
    if (project) {
      setProjectName(project.name);
    }
  };

  const generateOccurrences = () => {
    const occurrences = [];
    const startDate = new Date(date);
    
    for (let i = 0; i < occurrenceCount; i++) {
      let occDate: Date;
      switch (recurrenceRule) {
        case "weekly":
          occDate = addWeeks(startDate, i);
          break;
        case "biweekly":
          occDate = addWeeks(startDate, i * 2);
          break;
        case "monthly":
          occDate = new Date(startDate);
          occDate.setMonth(occDate.getMonth() + i);
          break;
        default:
          occDate = addWeeks(startDate, i);
      }
      
      occurrences.push({
        date: format(occDate, "yyyy-MM-dd"),
        status: "scheduled",
      });
    }
    
    return occurrences;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const meetingProjectName = projectName || "Unassigned Project";
    if (!title || !date || !location) return;

    if (isRecurring) {
      // Create recurring meeting series
      const seriesData: any = {
        title,
        recurrenceRule,
        startTime,
        endTime,
        location,
        platform,
      };
      
      if (projectId) {
        seriesData.projectId = projectId;
      }
      
      if (agenda) {
        seriesData.agenda = agenda;
      }
      
      if (meetingLink) {
        seriesData.meetingLink = meetingLink;
      }

      const occurrences = generateOccurrences();
      createSeriesMutation.mutate({ series: seriesData, occurrences });
    } else {
      // Create single meeting
      const meetingData: any = {
        title,
        project: meetingProjectName,
        date,
        startTime,
        endTime,
        location,
        platform,
      };
      
      if (projectId) {
        meetingData.projectId = projectId;
      }
      
      if (agenda) {
        meetingData.agenda = agenda;
      }
      
      if (meetingLink) {
        meetingData.meetingLink = meetingLink;
      }

      createMeetingMutation.mutate(meetingData);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setSelectedFile(file);
    setIsParsingFile(true);
    
    try {
      const text = await file.text();
      const events = parseICSFile(text);
      setImportedEvents(events);
      toast({
        title: "File Parsed",
        description: `Found ${events.length} event(s) in the calendar file.`,
      });
    } catch (error) {
      toast({
        title: "Parse Error",
        description: "Could not read the calendar file. Please check the format.",
        variant: "destructive",
      });
    } finally {
      setIsParsingFile(false);
    }
  };

  const parseICSFile = (content: string): any[] => {
    const events: any[] = [];
    
    // First, unfold lines (lines starting with space/tab are continuations)
    const unfoldedContent = content.replace(/\r?\n[ \t]/g, '');
    const lines = unfoldedContent.split(/\r?\n/);
    
    let currentEvent: Record<string, string> = {};
    let inEvent = false;
    
    for (const line of lines) {
      if (line === 'BEGIN:VEVENT') {
        inEvent = true;
        currentEvent = {};
        continue;
      }
      
      if (line === 'END:VEVENT' && inEvent) {
        // Check for recurrence rule
        const hasRecurrence = !!currentEvent.RRULE;
        
        // Finalize event
        const event = {
          title: (currentEvent.SUMMARY || "Untitled Event").replace(/\\,/g, ',').replace(/\\n/g, '\n'),
          description: (currentEvent.DESCRIPTION || "").replace(/\\,/g, ',').replace(/\\n/g, '\n'),
          location: (currentEvent.LOCATION || "").replace(/\\,/g, ','),
          startDate: parseICSDate(currentEvent.DTSTART || ""),
          endDate: parseICSDate(currentEvent.DTEND || ""),
          isRecurring: hasRecurrence,
          recurrenceRule: hasRecurrence ? parseRRULE(currentEvent.RRULE) : null,
        };
        events.push(event);
        inEvent = false;
        continue;
      }
      
      if (inEvent) {
        const colonIndex = line.indexOf(":");
        if (colonIndex > 0) {
          // Extract key (ignore parameters like TZID)
          const keyPart = line.substring(0, colonIndex);
          const key = keyPart.split(";")[0];
          const value = line.substring(colonIndex + 1);
          currentEvent[key] = value;
        }
      }
    }
    
    return events;
  };

  const parseRRULE = (rrule: string): "weekly" | "biweekly" | "monthly" | null => {
    if (!rrule) return null;
    
    if (rrule.includes("FREQ=WEEKLY") && rrule.includes("INTERVAL=2")) {
      return "biweekly";
    } else if (rrule.includes("FREQ=WEEKLY")) {
      return "weekly";
    } else if (rrule.includes("FREQ=MONTHLY")) {
      return "monthly";
    }
    return "weekly";
  };

  const parseICSDate = (dateStr: string): { date: string; time: string } | null => {
    if (!dateStr) return null;
    
    // Handle different ICS date formats
    const cleanDate = dateStr.replace(/[TZ]/g, "");
    
    if (cleanDate.length >= 8) {
      const year = cleanDate.substring(0, 4);
      const month = cleanDate.substring(4, 6);
      const day = cleanDate.substring(6, 8);
      const hour = cleanDate.length >= 10 ? cleanDate.substring(8, 10) : "00";
      const minute = cleanDate.length >= 12 ? cleanDate.substring(10, 12) : "00";
      
      return {
        date: `${year}-${month}-${day}`,
        time: `${hour}:${minute}`,
      };
    }
    return null;
  };

  const importEvent = async (event: any) => {
    const startInfo = event.startDate || { date: format(new Date(), "yyyy-MM-dd"), time: "10:00" };
    const endInfo = event.endDate || { date: startInfo.date, time: "11:30" };
    
    if (event.isRecurring && event.recurrenceRule) {
      // Import as recurring series
      const seriesData: any = {
        title: event.title,
        recurrenceRule: event.recurrenceRule,
        startTime: startInfo.time,
        endTime: endInfo.time,
        location: event.location || "To be confirmed",
        platform: "outlook",
      };
      
      if (projectId) {
        seriesData.projectId = projectId;
      }
      
      if (event.description) {
        seriesData.agenda = event.description;
      }
      
      // Generate default occurrences
      const occurrences = [];
      const eventDate = new Date(startInfo.date);
      for (let i = 0; i < 6; i++) {
        let occDate: Date;
        switch (event.recurrenceRule) {
          case "weekly":
            occDate = addWeeks(eventDate, i);
            break;
          case "biweekly":
            occDate = addWeeks(eventDate, i * 2);
            break;
          case "monthly":
            occDate = new Date(eventDate);
            occDate.setMonth(occDate.getMonth() + i);
            break;
          default:
            occDate = addWeeks(eventDate, i);
        }
        occurrences.push({
          date: format(occDate, "yyyy-MM-dd"),
          status: "scheduled",
        });
      }
      
      createSeriesMutation.mutate({ series: seriesData, occurrences });
    } else {
      // Import as single meeting
      const meetingData: any = {
        title: event.title,
        project: projectName || "Imported Meeting",
        date: startInfo.date,
        startTime: startInfo.time,
        endTime: endInfo.time,
        location: event.location || "To be confirmed",
        platform: "outlook",
      };
      
      if (projectId) {
        meetingData.projectId = projectId;
      }
      
      if (event.description) {
        meetingData.agenda = event.description;
      }
      
      createMeetingMutation.mutate(meetingData);
    }
  };

  // Import calendar event from API (Outlook/Google)
  const importCalendarEvent = async (event: CalendarEvent) => {
    setImportingEventId(event.id);
    
    try {
      // Check for duplicates first
      const duplicateCheck = await calendarApi.checkDuplicate(event.id);
      
      if (duplicateCheck.isDuplicate) {
        // Store the pending event and show the duplicate dialog
        setPendingCalendarEvent(event);
        setDuplicateInfo(duplicateCheck);
        setDuplicateDialogOpen(true);
        setImportingEventId(null);
        return;
      }
      
      // Proceed with import
      await performCalendarImport(event);
    } catch (error) {
      toast({
        title: "Import Failed",
        description: "Failed to import the calendar event. Please try again.",
        variant: "destructive",
      });
      setImportingEventId(null);
    }
  };

  // Perform the actual calendar import (extracted for reuse)
  const performCalendarImport = async (event: CalendarEvent) => {
    try {
      if (event.isRecurring && event.recurrenceRule) {
        // Import as recurring series
        const rule = event.recurrenceRule as "weekly" | "biweekly" | "monthly";
        const seriesData: any = {
          title: event.title,
          recurrenceRule: rule,
          startTime: event.startTime,
          endTime: event.endTime,
          location: event.location || "To be confirmed",
          platform: event.provider === 'google' ? 'gmail' : 'outlook',
          // Store calendar link for sync
          calendarProvider: event.provider, // 'google' or 'outlook'
          calendarEventId: event.id,
        };
        
        if (projectId) {
          seriesData.projectId = projectId;
        }
        
        if (event.description) {
          seriesData.agenda = event.description;
        }
        
        if (event.meetingLink) {
          seriesData.meetingLink = event.meetingLink;
        }
        
        // Fetch occurrences from API
        let occurrences: Array<{ date: string; status: string; calendarOccurrenceId?: string }> = [];
        try {
          const occResponse = await fetch(
            `/api/calendar/events/${encodeURIComponent(event.id)}/occurrences?provider=${event.provider}&startDate=${calendarStartDate}&endDate=${calendarEndDate}`
          );
          if (occResponse.ok) {
            const occData = await occResponse.json();
            // Map the response to include calendarOccurrenceId
            occurrences = (occData.occurrences || []).map((occ: any) => ({
              date: occ.date,
              status: occ.status || 'scheduled',
              calendarOccurrenceId: occ.id, // Store calendar occurrence ID for syncing
            }));
          }
        } catch (e) {
          // Fall back to generating occurrences
        }
        
        // Generate default occurrences if API didn't return any
        if (occurrences.length === 0) {
          const eventDate = new Date(event.date);
          for (let i = 0; i < 6; i++) {
            let occDate: Date;
            switch (rule) {
              case "weekly":
                occDate = addWeeks(eventDate, i);
                break;
              case "biweekly":
                occDate = addWeeks(eventDate, i * 2);
                break;
              case "monthly":
                occDate = new Date(eventDate);
                occDate.setMonth(occDate.getMonth() + i);
                break;
              default:
                occDate = addWeeks(eventDate, i);
            }
            occurrences.push({
              date: format(occDate, "yyyy-MM-dd"),
              status: "scheduled",
            });
          }
        }
        
        createSeriesMutation.mutate({ 
          series: seriesData, 
          occurrences,
          attendees: event.attendees,
        });
      } else {
        // Import as single meeting with attendees
        const meetingData: any = {
          title: event.title,
          project: projectName || "Imported Meeting",
          date: event.date,
          startTime: event.startTime,
          endTime: event.endTime,
          location: event.location || "To be confirmed",
          platform: event.provider === 'google' ? 'gmail' : 'outlook',
          // Store calendar link for sync
          calendarProvider: event.provider, // 'google' or 'outlook'
          calendarEventId: event.id,
        };
        
        if (projectId) {
          meetingData.projectId = projectId;
        }
        
        if (event.description) {
          meetingData.agenda = event.description;
        }
        
        if (event.meetingLink) {
          meetingData.meetingLink = event.meetingLink;
        }
        
        // Create meeting and then add attendees
        const meeting = await meetingsApi.create(meetingData);
        
        // Add attendees
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
              } catch (e) {
                // Ignore errors for individual attendees
              }
            }
          }
        }
        
        queryClient.invalidateQueries({ queryKey: ["meetings"] });
        setOpen(false);
        resetForm();
        toast({
          title: "Meeting Imported",
          description: `"${event.title}" has been imported${event.attendees.length > 0 ? ` with ${event.attendees.length} attendee(s)` : ''}.`,
        });
      }
    } catch (error) {
      toast({
        title: "Import Failed",
        description: "Failed to import the calendar event. Please try again.",
        variant: "destructive",
      });
    } finally {
      setImportingEventId(null);
    }
  };

  const handleOutlookConnect = () => {
    setOpen(false);
    navigate('/settings');
    toast({
      title: "Connect Outlook",
      description: "Navigate to Settings to connect your Outlook account.",
    });
  };

  const handleGoogleConnect = () => {
    setOpen(false);
    navigate('/settings');
    toast({
      title: "Connect Google",
      description: "Navigate to Settings to connect your Google account.",
    });
  };

  // Handle navigating to the existing entity when a duplicate is found
  const handleNavigateToExisting = () => {
    if (!duplicateInfo?.entity) return;
    
    setDuplicateDialogOpen(false);
    setOpen(false);
    
    if (duplicateInfo.type === 'meeting') {
      navigate(`/meetings/${duplicateInfo.entity.id}`);
    } else if (duplicateInfo.type === 'series') {
      navigate(`/series/${duplicateInfo.entity.id}`);
    }
    
    setPendingCalendarEvent(null);
    setDuplicateInfo(null);
  };

  // Handle syncing/refreshing the existing entity from calendar
  const handleSyncExisting = async () => {
    if (!duplicateInfo?.entity) return;
    
    setIsSyncing(true);
    
    try {
      if (duplicateInfo.type === 'meeting') {
        await calendarApi.syncMeeting(duplicateInfo.entity.id);
        queryClient.invalidateQueries({ queryKey: ["meetings"] });
        toast({
          title: "Meeting Refreshed",
          description: `"${duplicateInfo.entity.title}" has been synced with calendar.`,
        });
      } else if (duplicateInfo.type === 'series') {
        await calendarApi.syncSeries(duplicateInfo.entity.id);
        queryClient.invalidateQueries({ queryKey: ["meeting-series"] });
        toast({
          title: "Series Refreshed",
          description: `"${duplicateInfo.entity.title}" has been synced with calendar.`,
        });
      }
      
      setDuplicateDialogOpen(false);
      setOpen(false);
      setPendingCalendarEvent(null);
      setDuplicateInfo(null);
    } catch (error) {
      toast({
        title: "Sync Failed",
        description: "Failed to refresh from calendar. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSyncing(false);
    }
  };

  // Close duplicate dialog without action
  const handleCancelDuplicate = () => {
    setDuplicateDialogOpen(false);
    setPendingCalendarEvent(null);
    setDuplicateInfo(null);
  };

  const isPending = createMeetingMutation.isPending || createSeriesMutation.isPending || importingEventId !== null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button className="bg-primary hover:bg-primary/90 shadow-sm" data-testid="button-new-meeting">
            <Plus className="mr-2 h-4 w-4" /> New Meeting
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Schedule Coordination Meeting</DialogTitle>
          <DialogDescription>Create a new meeting or import from your calendar</DialogDescription>
        </DialogHeader>
        
        <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v); if (v === 'bulk') fetchBulkCalendarEvents(); }} className="mt-4">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="manual" className="text-xs" data-testid="tab-manual">
              <Calendar className="h-3.5 w-3.5 mr-1.5" />
              Manual
            </TabsTrigger>
            <TabsTrigger value="outlook" className="text-xs" data-testid="tab-outlook">
              <Mail className="h-3.5 w-3.5 mr-1.5" />
              Outlook
            </TabsTrigger>
            <TabsTrigger value="google" className="text-xs" data-testid="tab-google">
              <Calendar className="h-3.5 w-3.5 mr-1.5" />
              Google
            </TabsTrigger>
            <TabsTrigger value="file" className="text-xs" data-testid="tab-file">
              <FileUp className="h-3.5 w-3.5 mr-1.5" />
              ICS File
            </TabsTrigger>
            <TabsTrigger value="bulk" className="text-xs" data-testid="tab-bulk">
              <Download className="h-3.5 w-3.5 mr-1.5" />
              Bulk Import
            </TabsTrigger>
          </TabsList>

          {/* Manual Creation Tab */}
          <TabsContent value="manual" className="mt-4">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">Meeting Title</Label>
                <Input
                  id="title"
                  placeholder="e.g., Weekly Coordination - Tower A"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                  data-testid="input-meeting-title"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="project">Project</Label>
                <Select value={projectId} onValueChange={handleProjectChange}>
                  <SelectTrigger data-testid="select-project">
                    <SelectValue placeholder="Select a project" />
                  </SelectTrigger>
                  <SelectContent>
                    {projects.map((project) => (
                      <SelectItem key={project.id} value={project.id}>
                        {project.name} ({project.code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {!projectId && (
                  <Input
                    placeholder="Or enter project name manually"
                    value={projectName}
                    onChange={(e) => setProjectName(e.target.value)}
                    className="mt-2"
                    data-testid="input-project-name"
                  />
                )}
              </div>

              {/* Recurring Meeting Toggle */}
              <div className="flex items-center justify-between p-4 rounded-lg border bg-muted/30">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-full bg-blue-100 flex items-center justify-center">
                    <Repeat className="h-4 w-4 text-blue-600" />
                  </div>
                  <div>
                    <Label htmlFor="recurring" className="font-medium cursor-pointer">Recurring Meeting</Label>
                    <p className="text-xs text-muted-foreground">Create a series of meetings</p>
                  </div>
                </div>
                <Switch
                  id="recurring"
                  checked={isRecurring}
                  onCheckedChange={setIsRecurring}
                  data-testid="switch-recurring"
                />
              </div>

              {/* Recurrence Options */}
              {isRecurring && (
                <div className="grid grid-cols-2 gap-3 p-4 rounded-lg border border-blue-200 bg-blue-50/50">
                  <div className="space-y-2">
                    <Label>Recurrence Pattern</Label>
                    <Select value={recurrenceRule} onValueChange={(v: "weekly" | "biweekly" | "monthly") => setRecurrenceRule(v)}>
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
                    <Label>Number of Occurrences</Label>
                    <Select value={occurrenceCount.toString()} onValueChange={(v) => setOccurrenceCount(parseInt(v))}>
                      <SelectTrigger data-testid="select-occurrences">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {[4, 6, 8, 10, 12, 16, 20, 24].map((n) => (
                          <SelectItem key={n} value={n.toString()}>{n} occurrences</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="date">{isRecurring ? "Start Date" : "Date"}</Label>
                  <Input
                    id="date"
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    required
                    data-testid="input-date"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="startTime">Start Time</Label>
                  <Input
                    id="startTime"
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    required
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
                    required
                    data-testid="input-end-time"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="location">Location</Label>
                  <Input
                    id="location"
                    placeholder="e.g., Conf Room B / Teams"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    required
                    data-testid="input-location"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="platform">Calendar Platform</Label>
                  <Select value={platform} onValueChange={(v: "outlook" | "gmail") => setPlatform(v)}>
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
                <Label htmlFor="meetingLink">Meeting Link (Optional)</Label>
                <Input
                  id="meetingLink"
                  placeholder="e.g., https://teams.microsoft.com/l/meetup-join/..."
                  value={meetingLink}
                  onChange={(e) => setMeetingLink(e.target.value)}
                  data-testid="input-meeting-link"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="agenda">Agenda (Optional)</Label>
                <Textarea
                  id="agenda"
                  placeholder="Enter meeting agenda items..."
                  value={agenda}
                  onChange={(e) => setAgenda(e.target.value)}
                  rows={3}
                  data-testid="input-agenda"
                />
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="outline" onClick={() => setOpen(false)} data-testid="button-cancel">
                  Cancel
                </Button>
                <Button type="submit" disabled={isPending} data-testid="button-create-meeting">
                  {isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Creating...
                    </>
                  ) : isRecurring ? (
                    <>
                      <Repeat className="mr-2 h-4 w-4" />
                      Create Series
                    </>
                  ) : (
                    "Create Meeting"
                  )}
                </Button>
              </div>
            </form>
          </TabsContent>

          {/* Outlook Import Tab */}
          <TabsContent value="outlook" className="mt-4 space-y-4">
            {/* Project Selection */}
            <div className="space-y-2">
              <Label>Select Project for Imported Meetings</Label>
              <Select value={projectId} onValueChange={handleProjectChange}>
                <SelectTrigger data-testid="select-outlook-project">
                  <SelectValue placeholder="Select a project" />
                </SelectTrigger>
                <SelectContent>
                  {projects.map((project) => (
                    <SelectItem key={project.id} value={project.id}>
                      {project.name} ({project.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            {/* Date Range and Search */}
            <div className="grid grid-cols-5 gap-2">
              <div className="col-span-2">
                <Label className="text-xs">From</Label>
                <Input
                  type="date"
                  value={calendarStartDate}
                  onChange={(e) => setCalendarStartDate(e.target.value)}
                  className="h-9"
                  data-testid="input-outlook-start-date"
                />
              </div>
              <div className="col-span-2">
                <Label className="text-xs">To</Label>
                <Input
                  type="date"
                  value={calendarEndDate}
                  onChange={(e) => setCalendarEndDate(e.target.value)}
                  className="h-9"
                  data-testid="input-outlook-end-date"
                />
              </div>
              <div className="flex items-end">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9 w-full"
                  onClick={() => refetchOutlook()}
                  disabled={isLoadingOutlook}
                  data-testid="button-refresh-outlook"
                >
                  <RefreshCw className={`h-4 w-4 ${isLoadingOutlook ? 'animate-spin' : ''}`} />
                </Button>
              </div>
            </div>
            
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search meetings..."
                value={calendarSearch}
                onChange={(e) => setCalendarSearch(e.target.value)}
                className="pl-9"
                data-testid="input-outlook-search"
              />
            </div>
            
            {/* Events List */}
            {outlookError ? (
              <Card className="border-dashed">
                <CardContent className="pt-6 text-center">
                  <div className="mx-auto w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mb-3">
                    <Mail className="h-6 w-6 text-blue-600" />
                  </div>
                  <p className="text-sm font-medium mb-2">Outlook Not Connected</p>
                  <p className="text-xs text-muted-foreground mb-4">
                    Connect your Outlook account in Settings to import calendar events
                  </p>
                  <Button onClick={handleOutlookConnect} data-testid="button-connect-outlook">
                    <Settings className="mr-2 h-4 w-4" />
                    Go to Settings
                  </Button>
                </CardContent>
              </Card>
            ) : isLoadingOutlook ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                <span className="ml-2 text-sm text-muted-foreground">Loading Outlook events...</span>
              </div>
            ) : outlookEvents.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Calendar className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No events found in the selected date range</p>
              </div>
            ) : (
              <ScrollArea className="h-[280px] pr-3">
                <div className="space-y-2">
                  {outlookEvents.map((event) => (
                    <Card key={event.id} className="p-3 hover:bg-muted/50 transition-colors">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-medium truncate">{event.title}</p>
                            {event.isRecurring && (
                              <Badge variant="secondary" className="text-xs gap-1">
                                <Repeat className="h-3 w-3" />
                                {event.recurrencePattern || 'Recurring'}
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1 flex-wrap">
                            <span>{event.date} at {event.startTime}</span>
                            {event.location && <span>• {event.location}</span>}
                          </div>
                          {event.attendees.length > 0 && (
                            <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                              <Users className="h-3 w-3" />
                              <span>{event.attendees.length} attendee{event.attendees.length !== 1 ? 's' : ''}</span>
                            </div>
                          )}
                          {event.meetingLink && (
                            <div className="flex items-center gap-1 text-xs text-blue-600 mt-1">
                              <Link className="h-3 w-3" />
                              <span>Has meeting link</span>
                            </div>
                          )}
                        </div>
                        <Button
                          size="sm"
                          onClick={() => importCalendarEvent(event)}
                          disabled={importingEventId === event.id || isPending}
                          data-testid={`button-import-outlook-event-${event.id}`}
                        >
                          {importingEventId === event.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            'Import'
                          )}
                        </Button>
                      </div>
                    </Card>
                  ))}
                </div>
              </ScrollArea>
            )}
            
            <div className="flex items-start gap-2 p-3 bg-muted/50 rounded-lg">
              <AlertCircle className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
              <div className="text-xs text-muted-foreground">
                <p>Recurring meetings will be imported as a series. Attendees from the calendar invite will be automatically added.</p>
              </div>
            </div>
          </TabsContent>

          {/* Google Calendar Import Tab */}
          <TabsContent value="google" className="mt-4 space-y-4">
            {/* Project Selection */}
            <div className="space-y-2">
              <Label>Select Project for Imported Meetings</Label>
              <Select value={projectId} onValueChange={handleProjectChange}>
                <SelectTrigger data-testid="select-google-project">
                  <SelectValue placeholder="Select a project" />
                </SelectTrigger>
                <SelectContent>
                  {projects.map((project) => (
                    <SelectItem key={project.id} value={project.id}>
                      {project.name} ({project.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            {/* Date Range and Search */}
            <div className="grid grid-cols-5 gap-2">
              <div className="col-span-2">
                <Label className="text-xs">From</Label>
                <Input
                  type="date"
                  value={calendarStartDate}
                  onChange={(e) => setCalendarStartDate(e.target.value)}
                  className="h-9"
                  data-testid="input-google-start-date"
                />
              </div>
              <div className="col-span-2">
                <Label className="text-xs">To</Label>
                <Input
                  type="date"
                  value={calendarEndDate}
                  onChange={(e) => setCalendarEndDate(e.target.value)}
                  className="h-9"
                  data-testid="input-google-end-date"
                />
              </div>
              <div className="flex items-end">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9 w-full"
                  onClick={() => refetchGoogle()}
                  disabled={isLoadingGoogle}
                  data-testid="button-refresh-google"
                >
                  <RefreshCw className={`h-4 w-4 ${isLoadingGoogle ? 'animate-spin' : ''}`} />
                </Button>
              </div>
            </div>
            
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search meetings..."
                value={calendarSearch}
                onChange={(e) => setCalendarSearch(e.target.value)}
                className="pl-9"
                data-testid="input-google-search"
              />
            </div>
            
            {/* Events List */}
            {googleError ? (
              <Card className="border-dashed">
                <CardContent className="pt-6 text-center">
                  <div className="mx-auto w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mb-3">
                    <Calendar className="h-6 w-6 text-red-600" />
                  </div>
                  <p className="text-sm font-medium mb-2">Google Calendar Not Connected</p>
                  <p className="text-xs text-muted-foreground mb-4">
                    Connect your Google account in Settings to import calendar events
                  </p>
                  <Button onClick={handleGoogleConnect} data-testid="button-connect-google">
                    <Settings className="mr-2 h-4 w-4" />
                    Go to Settings
                  </Button>
                </CardContent>
              </Card>
            ) : isLoadingGoogle ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                <span className="ml-2 text-sm text-muted-foreground">Loading Google events...</span>
              </div>
            ) : googleEvents.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Calendar className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No events found in the selected date range</p>
              </div>
            ) : (
              <ScrollArea className="h-[280px] pr-3">
                <div className="space-y-2">
                  {googleEvents.map((event) => (
                    <Card key={event.id} className="p-3 hover:bg-muted/50 transition-colors">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-medium truncate">{event.title}</p>
                            {event.isRecurring && (
                              <Badge variant="secondary" className="text-xs gap-1">
                                <Repeat className="h-3 w-3" />
                                {event.recurrencePattern || 'Recurring'}
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1 flex-wrap">
                            <span>{event.date} at {event.startTime}</span>
                            {event.location && <span>• {event.location}</span>}
                          </div>
                          {event.attendees.length > 0 && (
                            <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                              <Users className="h-3 w-3" />
                              <span>{event.attendees.length} attendee{event.attendees.length !== 1 ? 's' : ''}</span>
                            </div>
                          )}
                          {event.meetingLink && (
                            <div className="flex items-center gap-1 text-xs text-green-600 mt-1">
                              <Link className="h-3 w-3" />
                              <span>Has meeting link</span>
                            </div>
                          )}
                        </div>
                        <Button
                          size="sm"
                          onClick={() => importCalendarEvent(event)}
                          disabled={importingEventId === event.id || isPending}
                          data-testid={`button-import-google-event-${event.id}`}
                        >
                          {importingEventId === event.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            'Import'
                          )}
                        </Button>
                      </div>
                    </Card>
                  ))}
                </div>
              </ScrollArea>
            )}
            
            <div className="flex items-start gap-2 p-3 bg-muted/50 rounded-lg">
              <AlertCircle className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
              <div className="text-xs text-muted-foreground">
                <p>Recurring meetings will be imported as a series. Attendees from the calendar invite will be automatically added.</p>
              </div>
            </div>
          </TabsContent>

          {/* File Import Tab */}
          <TabsContent value="file" className="mt-4">
            <div className="space-y-4">
              {/* Project selection for imports */}
              <div className="space-y-2">
                <Label>Select Project for Imported Meetings</Label>
                <Select value={projectId} onValueChange={handleProjectChange}>
                  <SelectTrigger data-testid="select-import-project">
                    <SelectValue placeholder="Select a project" />
                  </SelectTrigger>
                  <SelectContent>
                    {projects.map((project) => (
                      <SelectItem key={project.id} value={project.id}>
                        {project.name} ({project.code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* File Upload Area */}
              <div 
                className="border-2 border-dashed rounded-lg p-8 text-center hover:border-primary/50 transition-colors cursor-pointer"
                onClick={() => fileInputRef.current?.click()}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".ics,.ical,.ifb,.icalendar"
                  onChange={handleFileSelect}
                  className="hidden"
                  data-testid="input-file-upload"
                />
                
                {isParsingFile ? (
                  <div className="py-4">
                    <Loader2 className="h-8 w-8 mx-auto text-primary animate-spin mb-2" />
                    <p className="text-sm text-muted-foreground">Parsing calendar file...</p>
                  </div>
                ) : selectedFile ? (
                  <div className="py-2">
                    <Check className="h-8 w-8 mx-auto text-green-500 mb-2" />
                    <p className="font-medium">{selectedFile.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {importedEvents.length} event(s) found
                    </p>
                  </div>
                ) : (
                  <>
                    <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                    <p className="font-medium mb-1">Drop calendar file here</p>
                    <p className="text-sm text-muted-foreground">
                      or click to browse (.ics, .ical files)
                    </p>
                  </>
                )}
              </div>

              {/* Imported Events List */}
              {importedEvents.length > 0 && (
                <div className="space-y-3">
                  <Label>Events to Import</Label>
                  <div className="max-h-[200px] overflow-y-auto space-y-2">
                    {importedEvents.map((event, index) => (
                      <Card key={index} className="p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="font-medium truncate">{event.title}</p>
                              {event.isRecurring && (
                                <span className="inline-flex items-center gap-1 text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                                  <Repeat className="h-3 w-3" />
                                  {event.recurrenceRule}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                              {event.startDate && (
                                <span>{event.startDate.date} at {event.startDate.time}</span>
                              )}
                              {event.location && (
                                <span className="truncate">• {event.location}</span>
                              )}
                            </div>
                          </div>
                          <Button 
                            size="sm" 
                            onClick={() => importEvent(event)}
                            disabled={isPending}
                            data-testid={`button-import-event-${index}`}
                          >
                            Import
                          </Button>
                        </div>
                      </Card>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex items-start gap-2 p-3 bg-muted/50 rounded-lg">
                <AlertCircle className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                <div className="text-xs text-muted-foreground space-y-1">
                  <p>Export your calendar from Outlook or Google Calendar as an .ics file, then upload it here.</p>
                  <p className="font-medium">Recurring meetings will be detected and imported as a series.</p>
                </div>
              </div>
            </div>
          </TabsContent>

          {/* Bulk Import Tab */}
          <TabsContent value="bulk" className="mt-4">
            <div className="space-y-4">
              {/* Source Toggle */}
              <div className="flex items-center bg-muted rounded-lg p-0.5 w-fit">
                <Button
                  variant={bulkImportSource === 'calendar' ? 'secondary' : 'ghost'}
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => { setBulkImportSource('calendar'); setSelectedEvents(new Set()); }}
                  data-testid="bulk-source-calendar"
                >
                  <Calendar className="h-3 w-3 mr-1.5" />
                  From Calendars
                </Button>
                <Button
                  variant={bulkImportSource === 'file' ? 'secondary' : 'ghost'}
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => { setBulkImportSource('file'); setSelectedEvents(new Set()); }}
                  data-testid="bulk-source-file"
                >
                  <FileUp className="h-3 w-3 mr-1.5" />
                  From ICS File
                </Button>
              </div>

              {bulkImportSource === 'calendar' ? (
                <>
                  {/* Date Range and Filters */}
                  <div className="flex items-end gap-3">
                    <div className="grid grid-cols-2 gap-2 flex-1">
                      <div className="space-y-1">
                        <Label className="text-xs">From</Label>
                        <Input
                          type="date"
                          value={bulkStartDate}
                          onChange={(e) => setBulkStartDate(e.target.value)}
                          data-testid="bulk-start-date"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">To</Label>
                        <Input
                          type="date"
                          value={bulkEndDate}
                          onChange={(e) => setBulkEndDate(e.target.value)}
                          data-testid="bulk-end-date"
                        />
                      </div>
                    </div>
                    <Button onClick={fetchBulkCalendarEvents} disabled={isLoadingBulkEvents} size="sm" data-testid="bulk-refresh">
                      {isLoadingBulkEvents ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                    </Button>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search events..."
                        value={bulkSearch}
                        onChange={(e) => setBulkSearch(e.target.value)}
                        className="pl-9"
                        data-testid="bulk-search"
                      />
                    </div>
                    <Select value={bulkProvider} onValueChange={(v: "all" | "google" | "outlook") => setBulkProvider(v)}>
                      <SelectTrigger className="w-32" data-testid="bulk-provider">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All</SelectItem>
                        <SelectItem value="google">Google</SelectItem>
                        <SelectItem value="outlook">Outlook</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </>
              ) : (
                /* ICS File Upload for Bulk */
                <div 
                  className="border-2 border-dashed rounded-lg p-6 text-center hover:border-primary/50 transition-colors cursor-pointer"
                  onClick={() => bulkFileInputRef.current?.click()}
                >
                  <input
                    ref={bulkFileInputRef}
                    type="file"
                    accept=".ics,.ical"
                    onChange={handleBulkIcsFileSelect}
                    className="hidden"
                    data-testid="bulk-file-input"
                  />
                  {isBulkParsingFile ? (
                    <div className="py-2">
                      <Loader2 className="h-6 w-6 mx-auto text-primary animate-spin mb-2" />
                      <p className="text-sm text-muted-foreground">Parsing file...</p>
                    </div>
                  ) : bulkIcsFile ? (
                    <div className="py-1">
                      <Check className="h-6 w-6 mx-auto text-green-500 mb-2" />
                      <p className="font-medium text-sm">{bulkIcsFile.name}</p>
                      <p className="text-xs text-muted-foreground">{bulkIcsEvents.length} event(s) found</p>
                    </div>
                  ) : (
                    <>
                      <Upload className="h-6 w-6 mx-auto text-muted-foreground mb-2" />
                      <p className="font-medium text-sm mb-1">Drop ICS file or click to browse</p>
                    </>
                  )}
                </div>
              )}

              {/* Events List with Selection */}
              {getFilteredBulkEvents().length > 0 && (
                <>
                  <div className="flex items-center justify-between text-sm border-b pb-2">
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="bulk-select-all"
                        checked={selectedEvents.size === getFilteredBulkEvents().length && getFilteredBulkEvents().length > 0}
                        onCheckedChange={toggleSelectAllEvents}
                        data-testid="bulk-select-all"
                      />
                      <label htmlFor="bulk-select-all" className="text-muted-foreground cursor-pointer">
                        Select all ({getFilteredBulkEvents().length})
                      </label>
                    </div>
                    {selectedEvents.size > 0 && (
                      <Button onClick={handleBulkImport} disabled={isImportingBulk} size="sm" data-testid="button-import-selected">
                        {isImportingBulk ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Download className="h-4 w-4 mr-1.5" />}
                        Import {selectedEvents.size}
                      </Button>
                    )}
                  </div>

                  <ScrollArea className="h-[220px]">
                    <div className="space-y-2 pr-4">
                      {getFilteredBulkEvents().map((event) => (
                        <Card
                          key={event.id}
                          className={`cursor-pointer transition-colors ${
                            selectedEvents.has(event.id) ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'
                          }`}
                          onClick={() => toggleEventSelection(event.id)}
                          data-testid={`bulk-event-${event.id}`}
                        >
                          <CardContent className="p-3">
                            <div className="flex items-start gap-3">
                              <Checkbox
                                checked={selectedEvents.has(event.id)}
                                onCheckedChange={() => toggleEventSelection(event.id)}
                                onClick={(e) => e.stopPropagation()}
                                className="mt-0.5"
                              />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1 flex-wrap">
                                  <span className="font-medium text-sm truncate">{event.title}</span>
                                  {event.isRecurring && (
                                    <Badge variant="secondary" className="text-[10px] h-5">
                                      <Repeat className="h-2.5 w-2.5 mr-1" />
                                      Recurring
                                    </Badge>
                                  )}
                                  <Badge
                                    variant="outline"
                                    className={`text-[10px] h-5 ${event.provider === 'google' ? 'text-red-600 border-red-200' : 'text-blue-600 border-blue-200'}`}
                                  >
                                    {event.provider === 'google' ? 'Google' : 'Outlook'}
                                  </Badge>
                                </div>
                                <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                                  <span className="flex items-center gap-1">
                                    <Calendar className="h-3 w-3" />
                                    {event.date}
                                  </span>
                                  <span className="flex items-center gap-1">
                                    <Clock className="h-3 w-3" />
                                    {event.startTime} - {event.endTime}
                                  </span>
                                  {event.location && (
                                    <span className="flex items-center gap-1 truncate max-w-[140px]">
                                      <MapPin className="h-3 w-3" />
                                      {event.location}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </ScrollArea>
                </>
              )}

              {/* Empty States */}
              {bulkImportSource === 'calendar' && !isLoadingBulkEvents && getFilteredBulkEvents().length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <Calendar className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No events found</p>
                  <p className="text-xs mt-1">Check your connected calendars in Settings</p>
                </div>
              )}

              {isLoadingBulkEvents && (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>

      {/* Duplicate Detection Alert Dialog */}
      <AlertDialog open={duplicateDialogOpen} onOpenChange={setDuplicateDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Event Already Imported</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>{duplicateInfo?.message}</p>
                <p className="text-sm">
                  Would you like to refresh the existing {duplicateInfo?.type === 'series' ? 'series' : 'meeting'} from the calendar, 
                  or go to view it?
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <AlertDialogCancel onClick={handleCancelDuplicate} data-testid="button-cancel-duplicate">
              Cancel
            </AlertDialogCancel>
            <Button
              variant="outline"
              onClick={handleNavigateToExisting}
              data-testid="button-view-existing"
            >
              View Existing
            </Button>
            <AlertDialogAction
              onClick={handleSyncExisting}
              disabled={isSyncing}
              data-testid="button-refresh-from-calendar"
            >
              {isSyncing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Refreshing...
                </>
              ) : (
                <>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Refresh from Calendar
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}
