import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Card, CardContent } from "@/components/ui/card";
import { FileUp, Calendar, Download, AlertCircle, Loader2, Repeat, Search, Users, RefreshCw, Clock, MapPin, Upload, Check } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { meetingsApi, meetingSeriesApi, meetingOccurrencesApi, seriesAttendeesApi, attendeesApi, calendarApi } from "@/lib/api";
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
import { format, addMonths, parseISO } from "date-fns";
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

interface BulkCalendarImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function BulkCalendarImportDialog({ open, onOpenChange }: BulkCalendarImportDialogProps) {
  const [activeTab, setActiveTab] = useState("calendar");
  const [, navigate] = useLocation();
  
  const [startDate, setStartDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [endDate, setEndDate] = useState(format(addMonths(new Date(), 3), "yyyy-MM-dd"));
  const [calendarSearch, setCalendarSearch] = useState("");
  const [selectedProvider, setSelectedProvider] = useState<"all" | "google" | "outlook">("all");
  const [selectedEvents, setSelectedEvents] = useState<Set<string>>(new Set());
  const [importingEventId, setImportingEventId] = useState<string | null>(null);
  const [isImportingBulk, setIsImportingBulk] = useState(false);
  
  const [googleEvents, setGoogleEvents] = useState<CalendarEvent[]>([]);
  const [outlookEvents, setOutlookEvents] = useState<CalendarEvent[]>([]);
  const [isLoadingEvents, setIsLoadingEvents] = useState(false);
  const [eventsError, setEventsError] = useState<string | null>(null);
  
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [icsEvents, setIcsEvents] = useState<CalendarEvent[]>([]);
  const [isParsingFile, setIsParsingFile] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [duplicateDialogOpen, setDuplicateDialogOpen] = useState(false);
  const [duplicateInfo, setDuplicateInfo] = useState<any>(null);
  const [pendingCalendarEvent, setPendingCalendarEvent] = useState<CalendarEvent | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  const queryClient = useQueryClient();
  const { toast } = useToast();

  const fetchCalendarEvents = async () => {
    setIsLoadingEvents(true);
    setEventsError(null);
    
    try {
      const params = new URLSearchParams({
        startDate,
        endDate,
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

  useEffect(() => {
    if (open && activeTab === "calendar") {
      fetchCalendarEvents();
    }
  }, [open, activeTab]);

  const allEvents = activeTab === "ics" ? icsEvents : [...googleEvents, ...outlookEvents];
  
  const filteredEvents = allEvents.filter(event => {
    const matchesSearch = !calendarSearch || 
      event.title.toLowerCase().includes(calendarSearch.toLowerCase()) ||
      event.location?.toLowerCase().includes(calendarSearch.toLowerCase()) ||
      event.description?.toLowerCase().includes(calendarSearch.toLowerCase());
    const matchesProvider = activeTab === "ics" || selectedProvider === "all" || event.provider === selectedProvider;
    return matchesSearch && matchesProvider;
  });

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setSelectedFile(file);
    setIsParsingFile(true);
    
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
      setIcsEvents(events);
      toast({
        title: "File Parsed",
        description: `Found ${events.length} events in the file.`,
      });
    } catch (error) {
      console.error('Failed to parse ICS file:', error);
      toast({
        title: "Parse Error",
        description: "Failed to parse the calendar file. Please check the format.",
        variant: "destructive",
      });
      setIcsEvents([]);
    } finally {
      setIsParsingFile(false);
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
      const occEndDate = format(addMonths(parseISO(event.date), 3), "yyyy-MM-dd");
      const occurrencesResponse = await fetch(
        `/api/calendar/events/${encodeURIComponent(event.id)}/occurrences?provider=${event.provider}&startDate=${event.date}&endDate=${occEndDate}`
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
      
      return { type: 'series', id: series.id };
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
      
      return { type: 'meeting', id: meeting.id };
    }
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
      } else {
        await calendarApi.syncSeries(duplicateInfo.entity.id);
        toast({
          title: "Series Synced",
          description: "The series has been updated from the calendar.",
        });
        queryClient.invalidateQueries({ queryKey: ["meeting-series"] });
      }
      setDuplicateDialogOpen(false);
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

    setIsImportingBulk(true);
    const eventsToImport = filteredEvents.filter(e => selectedEvents.has(e.id));
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
      onOpenChange(false);
    }
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

  const resetState = () => {
    setSelectedEvents(new Set());
    setCalendarSearch("");
    setSelectedFile(null);
    setIcsEvents([]);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={(value) => { onOpenChange(value); if (!value) resetState(); }}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col min-h-0">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Download className="h-5 w-5" />
              Import Calendar Events
            </DialogTitle>
            <DialogDescription>
              Import meetings from your connected calendars or an ICS file
            </DialogDescription>
          </DialogHeader>

          <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v); setSelectedEvents(new Set()); }} className="flex-1 overflow-hidden flex flex-col min-h-0">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="calendar" data-testid="tab-calendar-import">
                <Calendar className="h-4 w-4 mr-2" />
                From Calendars
              </TabsTrigger>
              <TabsTrigger value="ics" data-testid="tab-ics-import">
                <FileUp className="h-4 w-4 mr-2" />
                From ICS File
              </TabsTrigger>
            </TabsList>

            <TabsContent value="calendar" className="flex-1 overflow-hidden flex flex-col mt-4 min-h-0">
              <div className="space-y-4 flex-1 overflow-hidden flex flex-col min-h-0">
                <div className="flex items-center gap-3">
                  <div className="grid grid-cols-2 gap-2 flex-1">
                    <div className="space-y-1">
                      <Label className="text-xs">From</Label>
                      <Input
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        data-testid="input-start-date"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">To</Label>
                      <Input
                        type="date"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        data-testid="input-end-date"
                      />
                    </div>
                  </div>
                  <Button onClick={fetchCalendarEvents} disabled={isLoadingEvents} className="mt-5">
                    {isLoadingEvents ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                  </Button>
                </div>

                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search by title, location, or description..."
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
                  <div className="flex items-center justify-between text-sm border-b pb-2">
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="select-all"
                        checked={selectedEvents.size === filteredEvents.length && filteredEvents.length > 0}
                        onCheckedChange={toggleSelectAll}
                        data-testid="checkbox-select-all"
                      />
                      <label htmlFor="select-all" className="text-muted-foreground cursor-pointer">
                        Select all ({filteredEvents.length} events)
                      </label>
                    </div>
                    {selectedEvents.size > 0 && (
                      <Button onClick={handleBulkImport} disabled={isImportingBulk} data-testid="button-bulk-import">
                        {isImportingBulk ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
                        Import {selectedEvents.size} selected
                      </Button>
                    )}
                  </div>
                )}

                <div className="flex-1 min-h-0 overflow-auto max-h-[280px]">
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
                      <p>No calendar events found in this date range</p>
                      <p className="text-xs mt-1">Make sure your calendars are connected in Settings</p>
                    </div>
                  ) : (
                    <div className="space-y-2 pr-2">
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
                                className="mt-0.5"
                                data-testid={`checkbox-event-${event.id}`}
                              />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1 flex-wrap">
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
                                <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
                                  <span className="flex items-center gap-1">
                                    <Calendar className="h-3 w-3" />
                                    {event.date}
                                  </span>
                                  <span className="flex items-center gap-1">
                                    <Clock className="h-3 w-3" />
                                    {event.startTime} - {event.endTime}
                                  </span>
                                  {event.location && (
                                    <span className="flex items-center gap-1 truncate max-w-[200px]">
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
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="ics" className="flex-1 overflow-hidden flex flex-col mt-4 min-h-0">
              <div className="space-y-4 flex-1 overflow-hidden flex flex-col min-h-0">
                <div 
                  className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 transition-colors"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".ics,.ical"
                    onChange={handleFileSelect}
                    className="hidden"
                    data-testid="input-ics-file"
                  />
                  {isParsingFile ? (
                    <Loader2 className="h-10 w-10 mx-auto mb-3 text-muted-foreground animate-spin" />
                  ) : selectedFile ? (
                    <Check className="h-10 w-10 mx-auto mb-3 text-green-500" />
                  ) : (
                    <Upload className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
                  )}
                  <p className="font-medium">
                    {selectedFile ? selectedFile.name : "Click to upload ICS file"}
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    {selectedFile 
                      ? `${icsEvents.length} events found` 
                      : "Supports .ics and .ical calendar files"}
                  </p>
                </div>

                {icsEvents.length > 0 && (
                  <>
                    <div className="flex items-center gap-2">
                      <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          placeholder="Search events..."
                          value={calendarSearch}
                          onChange={(e) => setCalendarSearch(e.target.value)}
                          className="pl-9"
                          data-testid="input-search-ics-events"
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-sm border-b pb-2">
                      <div className="flex items-center gap-2">
                        <Checkbox
                          id="select-all-ics"
                          checked={selectedEvents.size === filteredEvents.length && filteredEvents.length > 0}
                          onCheckedChange={toggleSelectAll}
                          data-testid="checkbox-select-all-ics"
                        />
                        <label htmlFor="select-all-ics" className="text-muted-foreground cursor-pointer">
                          Select all ({filteredEvents.length} events)
                        </label>
                      </div>
                      {selectedEvents.size > 0 && (
                        <Button onClick={handleBulkImport} disabled={isImportingBulk} data-testid="button-bulk-import-ics">
                          {isImportingBulk ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
                          Import {selectedEvents.size} selected
                        </Button>
                      )}
                    </div>

                    <div className="flex-1 min-h-0 overflow-auto max-h-[200px]">
                      <div className="space-y-2 pr-2">
                        {filteredEvents.map((event) => (
                          <Card
                            key={event.id}
                            className={`cursor-pointer transition-colors ${
                              selectedEvents.has(event.id) ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'
                            }`}
                            onClick={() => toggleEventSelection(event.id)}
                            data-testid={`card-ics-event-${event.id}`}
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
                                  <div className="flex items-center gap-2 mb-1">
                                    <span className="font-medium truncate">{event.title}</span>
                                    {event.isRecurring && (
                                      <Badge variant="secondary" className="text-xs">
                                        <Repeat className="h-3 w-3 mr-1" />
                                        Recurring
                                      </Badge>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                                    <span className="flex items-center gap-1">
                                      <Calendar className="h-3 w-3" />
                                      {event.date}
                                    </span>
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
                                  </div>
                                </div>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleImportEvent(event);
                                  }}
                                  disabled={importingEventId === event.id}
                                >
                                  {importingEventId === event.id ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <Download className="h-4 w-4" />
                                  )}
                                </Button>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </div>
                  </>
                )}
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
