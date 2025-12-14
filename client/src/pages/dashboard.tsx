import { useState, useMemo } from "react";
import Layout from "@/components/layout";
import MeetingCard from "@/components/meeting-card";
import SeriesCard from "@/components/series-card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  X, 
  ArrowUpDown, 
  Calendar as CalendarIcon, 
  Filter, 
  List, 
  ChevronLeft, 
  ChevronRight, 
  Plus,
  Repeat,
  Lock
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { meetingsApi, meetingSeriesApi, type MeetingFilters } from "@/lib/api";
import AddMeetingDialog from "@/components/add-meeting-dialog";
import DayActionsDialog from "@/components/day-actions-dialog";
import { useProjectFilter } from "@/contexts/project-filter-context";
import { useAuth } from "@/contexts/auth-context";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay, addMonths, subMonths, isSameDay, parseISO } from "date-fns";
import type { Project, Meeting, MeetingSeries } from "@shared/schema";

type ViewMode = 'list' | 'calendar';
type ViewFilter = 'all' | 'meetings' | 'series' | 'closed';

export default function Dashboard() {
  const { permissions } = useAuth();
  const { selectedProjectIds, toggleProject } = useProjectFilter();
  const [localSearch, setLocalSearch] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [viewFilter, setViewFilter] = useState<ViewFilter>('all');
  const [filters, setFilters] = useState<MeetingFilters>({
    sortBy: 'date',
    sortOrder: 'desc',
  });

  // Calendar state
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [dayDialogOpen, setDayDialogOpen] = useState(false);

  // Derive status filters based on viewFilter
  // 'all', 'meetings', 'series' show only open/scheduled items
  // 'closed' shows only closed items
  const meetingStatus = viewFilter === 'closed' ? 'closed' as const : 'scheduled' as const;
  const seriesStatus = viewFilter === 'closed' ? 'closed' as const : 'active' as const;

  const combinedFilters = useMemo(() => ({
    ...filters,
    search: localSearch || undefined,
    projectIds: selectedProjectIds.length > 0 ? selectedProjectIds : undefined,
    status: meetingStatus,
  }), [filters, selectedProjectIds, localSearch, meetingStatus]);

  const seriesFilters = useMemo(() => ({
    projectIds: selectedProjectIds.length > 0 ? selectedProjectIds : undefined,
    status: seriesStatus,
  }), [selectedProjectIds, seriesStatus]);

  // Main data queries based on current view filter
  const { data: meetings, isLoading: meetingsLoading, error: meetingsError } = useQuery({
    queryKey: ["meetings", combinedFilters],
    queryFn: () => meetingsApi.getAll(combinedFilters),
  });

  const { data: meetingSeries, isLoading: seriesLoading, error: seriesError } = useQuery({
    queryKey: ["meeting-series", seriesFilters],
    queryFn: () => meetingSeriesApi.getAll(seriesFilters),
  });

  // Additional queries for badge counts (need both open and closed counts)
  const openMeetingsFilters = useMemo(() => ({
    ...filters,
    search: localSearch || undefined,
    projectIds: selectedProjectIds.length > 0 ? selectedProjectIds : undefined,
    status: 'scheduled' as const,
  }), [filters, selectedProjectIds, localSearch]);

  const closedMeetingsFilters = useMemo(() => ({
    ...filters,
    search: localSearch || undefined,
    projectIds: selectedProjectIds.length > 0 ? selectedProjectIds : undefined,
    status: 'closed' as const,
  }), [filters, selectedProjectIds, localSearch]);

  const openSeriesFilters = useMemo(() => ({
    projectIds: selectedProjectIds.length > 0 ? selectedProjectIds : undefined,
    status: 'active' as const,
  }), [selectedProjectIds]);

  const closedSeriesFilters = useMemo(() => ({
    projectIds: selectedProjectIds.length > 0 ? selectedProjectIds : undefined,
    status: 'closed' as const,
  }), [selectedProjectIds]);

  const { data: openMeetings } = useQuery({
    queryKey: ["meetings-open-count", openMeetingsFilters],
    queryFn: () => meetingsApi.getAll(openMeetingsFilters),
  });

  const { data: closedMeetings } = useQuery({
    queryKey: ["meetings-closed-count", closedMeetingsFilters],
    queryFn: () => meetingsApi.getAll(closedMeetingsFilters),
  });

  const { data: openSeries } = useQuery({
    queryKey: ["series-open-count", openSeriesFilters],
    queryFn: () => meetingSeriesApi.getAll(openSeriesFilters),
  });

  const { data: closedSeries } = useQuery({
    queryKey: ["series-closed-count", closedSeriesFilters],
    queryFn: () => meetingSeriesApi.getAll(closedSeriesFilters),
  });

  const { data: projects = [] } = useQuery<Project[]>({
    queryKey: ["projects"],
    queryFn: async () => {
      const response = await fetch("/api/projects");
      if (!response.ok) throw new Error("Failed to fetch projects");
      return response.json();
    },
  });

  const { data: pointCounts } = useQuery({
    queryKey: ["meeting-point-counts"],
    queryFn: meetingsApi.getPointCounts,
  });

  const { data: meetingAttendeeCounts } = useQuery({
    queryKey: ["meeting-attendee-counts"],
    queryFn: meetingsApi.getAttendeeCounts,
  });

  const { data: seriesAttendeeCounts } = useQuery({
    queryKey: ["series-attendee-counts"],
    queryFn: meetingSeriesApi.getAttendeeCounts,
  });

  const { data: seriesPointCounts } = useQuery({
    queryKey: ["series-point-counts"],
    queryFn: meetingSeriesApi.getPointCounts,
  });

  const isLoading = meetingsLoading || seriesLoading;
  const error = meetingsError || seriesError;

  const filteredSeries = useMemo(() => {
    if (!meetingSeries) return [];
    let filtered = meetingSeries;
    
    if (selectedProjectIds.length > 0) {
      filtered = filtered.filter(s => s.projectId && selectedProjectIds.includes(s.projectId));
    }
    
    if (localSearch) {
      const query = localSearch.toLowerCase();
      filtered = filtered.filter(s => {
        const project = projects.find(p => p.id === s.projectId);
        return s.title.toLowerCase().includes(query) ||
               (project?.name?.toLowerCase().includes(query)) ||
               (project?.city?.toLowerCase().includes(query));
      });
    }
    
    return filtered;
  }, [meetingSeries, selectedProjectIds, localSearch, projects]);

  type CombinedItem = 
    | { type: 'meeting'; data: Meeting }
    | { type: 'series'; data: MeetingSeries };

  const combinedItems = useMemo((): CombinedItem[] => {
    const items: CombinedItem[] = [];
    
    // Include meetings when viewing all, meetings only, or closed
    if (viewFilter === 'all' || viewFilter === 'meetings' || viewFilter === 'closed') {
      if (meetings) {
        meetings.forEach(m => items.push({ type: 'meeting', data: m }));
      }
    }
    
    // Include series when viewing all, series only, or closed
    if (viewFilter === 'all' || viewFilter === 'series' || viewFilter === 'closed') {
      filteredSeries.forEach(s => items.push({ type: 'series', data: s }));
    }
    
    items.sort((a, b) => {
      if (filters.sortBy === 'title') {
        const titleA = a.type === 'meeting' ? a.data.title : a.data.title;
        const titleB = b.type === 'meeting' ? b.data.title : b.data.title;
        return filters.sortOrder === 'asc' 
          ? titleA.localeCompare(titleB)
          : titleB.localeCompare(titleA);
      }
      if (filters.sortBy === 'project') {
        const projA = a.type === 'meeting' ? a.data.project : 
          (projects.find(p => p.id === a.data.projectId)?.name || '');
        const projB = b.type === 'meeting' ? b.data.project : 
          (projects.find(p => p.id === b.data.projectId)?.name || '');
        return filters.sortOrder === 'asc'
          ? projA.localeCompare(projB)
          : projB.localeCompare(projA);
      }
      const dateA = a.type === 'meeting' ? a.data.date : a.data.createdAt?.toString() || '';
      const dateB = b.type === 'meeting' ? b.data.date : b.data.createdAt?.toString() || '';
      return filters.sortOrder === 'asc'
        ? dateA.localeCompare(dateB)
        : dateB.localeCompare(dateA);
    });
    
    return items;
  }, [meetings, filteredSeries, filters, projects, viewFilter]);

  const selectedProjects = projects.filter(p => selectedProjectIds.includes(p.id));

  const toggleSortOrder = () => {
    setFilters(prev => ({
      ...prev,
      sortOrder: prev.sortOrder === 'asc' ? 'desc' : 'asc',
    }));
  };

  const hasActiveFilters = selectedProjectIds.length > 0 || localSearch || viewFilter !== 'all';

  // Calendar logic
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  
  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(currentDate);
    const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });
    
    let startDay = getDay(monthStart);
    startDay = startDay === 0 ? 6 : startDay - 1;
    
    const prevMonthDays: { date: Date; currentMonth: boolean }[] = [];
    for (let i = startDay - 1; i >= 0; i--) {
      const date = new Date(monthStart);
      date.setDate(date.getDate() - (i + 1));
      prevMonthDays.push({ date, currentMonth: false });
    }
    
    const currentMonthDays = daysInMonth.map(date => ({ date, currentMonth: true }));
    
    const totalDays = [...prevMonthDays, ...currentMonthDays];
    const remainingDays = 42 - totalDays.length;
    
    const nextMonthDays: { date: Date; currentMonth: boolean }[] = [];
    for (let i = 1; i <= remainingDays; i++) {
      const date = new Date(monthEnd);
      date.setDate(date.getDate() + i);
      nextMonthDays.push({ date, currentMonth: false });
    }
    
    return [...prevMonthDays, ...currentMonthDays, ...nextMonthDays];
  }, [currentDate]);

  const getMeetingsForDate = (date: Date): Meeting[] => {
    if (!meetings) return [];
    return meetings.filter(meeting => {
      const meetingDate = parseISO(meeting.date);
      return isSameDay(meetingDate, date);
    });
  };

  const goToPreviousMonth = () => setCurrentDate(prev => subMonths(prev, 1));
  const goToNextMonth = () => setCurrentDate(prev => addMonths(prev, 1));

  const handleDayClick = (date: Date) => {
    setSelectedDate(date);
    setDayDialogOpen(true);
  };

  const canCreateMeetings = permissions?.canCreateMeetings ?? false;

  // Count items by type for badges - use the dedicated count queries
  const openMeetingsCount = openMeetings?.length || 0;
  const openSeriesCount = useMemo(() => {
    if (!openSeries) return 0;
    let filtered = openSeries;
    if (selectedProjectIds.length > 0) {
      filtered = filtered.filter(s => s.projectId && selectedProjectIds.includes(s.projectId));
    }
    if (localSearch) {
      const query = localSearch.toLowerCase();
      filtered = filtered.filter(s => {
        const project = projects.find(p => p.id === s.projectId);
        return s.title.toLowerCase().includes(query) ||
               (project?.name?.toLowerCase().includes(query)) ||
               (project?.city?.toLowerCase().includes(query));
      });
    }
    return filtered.length;
  }, [openSeries, selectedProjectIds, localSearch, projects]);
  
  const closedMeetingsCount = closedMeetings?.length || 0;
  const closedSeriesCount = useMemo(() => {
    if (!closedSeries) return 0;
    let filtered = closedSeries;
    if (selectedProjectIds.length > 0) {
      filtered = filtered.filter(s => s.projectId && selectedProjectIds.includes(s.projectId));
    }
    if (localSearch) {
      const query = localSearch.toLowerCase();
      filtered = filtered.filter(s => {
        const project = projects.find(p => p.id === s.projectId);
        return s.title.toLowerCase().includes(query) ||
               (project?.name?.toLowerCase().includes(query)) ||
               (project?.city?.toLowerCase().includes(query));
      });
    }
    return filtered.length;
  }, [closedSeries, selectedProjectIds, localSearch, projects]);

  const closedCount = closedMeetingsCount + closedSeriesCount;

  return (
    <Layout>
      <div className="flex flex-col h-full">
        {/* Fixed Header Section */}
        <div className="flex-shrink-0 border-b bg-card">
          {/* Title Row */}
          <div className="px-4 sm:px-6 py-4 border-b">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1">
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground" data-testid="text-page-title">
                  Coordination Meetings
                </h1>
                <p className="text-sm text-muted-foreground">
                  Manage your BIM coordination sessions and agendas.
                </p>
              </div>

              {/* Primary Actions */}
              <div className="flex items-center gap-3">
                {canCreateMeetings && <AddMeetingDialog />}
              </div>
            </div>
          </div>

          {/* Unified Toolbar - Shared between views */}
          <div className="px-4 sm:px-6 py-3 flex flex-wrap items-center gap-2 sm:gap-3 overflow-x-auto">
            {/* View Mode Toggle */}
            <div className="flex items-center bg-muted rounded-lg p-0.5">
              <Button
                variant={viewMode === 'list' ? 'secondary' : 'ghost'}
                size="sm"
                className="h-8 px-3"
                onClick={() => setViewMode('list')}
                data-testid="button-view-list"
              >
                <List className="h-4 w-4 mr-1.5" />
                List
              </Button>
              <Button
                variant={viewMode === 'calendar' ? 'secondary' : 'ghost'}
                size="sm"
                className="h-8 px-3"
                onClick={() => setViewMode('calendar')}
                data-testid="button-view-calendar"
              >
                <CalendarIcon className="h-4 w-4 mr-1.5" />
                Calendar
              </Button>
            </div>

            <div className="h-6 w-px bg-border" />

            {/* Type Filter Toggle - Shared */}
            <div className="flex items-center bg-muted rounded-lg p-0.5">
              <Button
                variant={viewFilter === 'all' ? 'secondary' : 'ghost'}
                size="sm"
                className="h-7 px-3 text-xs"
                onClick={() => setViewFilter('all')}
                data-testid="filter-type-all"
              >
                All
                <Badge variant="outline" className="ml-1.5 h-5 px-1.5 text-[10px]">
                  {openMeetingsCount + openSeriesCount}
                </Badge>
              </Button>
              <Button
                variant={viewFilter === 'meetings' ? 'secondary' : 'ghost'}
                size="sm"
                className="h-7 px-3 text-xs"
                onClick={() => setViewFilter('meetings')}
                data-testid="filter-type-meetings"
              >
                <CalendarIcon className="h-3 w-3 mr-1" />
                Meetings
                <Badge variant="outline" className="ml-1.5 h-5 px-1.5 text-[10px]">
                  {openMeetingsCount}
                </Badge>
              </Button>
              <Button
                variant={viewFilter === 'series' ? 'secondary' : 'ghost'}
                size="sm"
                className="h-7 px-3 text-xs"
                onClick={() => setViewFilter('series')}
                data-testid="filter-type-series"
              >
                <Repeat className="h-3 w-3 mr-1" />
                Series
                <Badge variant="outline" className="ml-1.5 h-5 px-1.5 text-[10px]">
                  {openSeriesCount}
                </Badge>
              </Button>
              <Button
                variant={viewFilter === 'closed' ? 'secondary' : 'ghost'}
                size="sm"
                className="h-7 px-3 text-xs"
                onClick={() => setViewFilter('closed')}
                data-testid="filter-type-closed"
              >
                <Lock className="h-3 w-3 mr-1" />
                Closed
                <Badge variant="outline" className="ml-1.5 h-5 px-1.5 text-[10px]">
                  {closedCount}
                </Badge>
              </Button>
            </div>

            <div className="h-6 w-px bg-border" />

            {/* Search Filter - Shared */}
            <div className="relative flex-1 max-w-full sm:max-w-[200px]">
              <Filter className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Search..."
                className="pl-8 h-8 text-sm bg-transparent"
                value={localSearch}
                onChange={(e) => setLocalSearch(e.target.value)}
                data-testid="input-local-filter"
              />
            </div>

            {/* View-specific controls */}
            {viewMode === 'list' ? (
              <>
                {/* Sort By - List view only */}
                <Select 
                  value={filters.sortBy || "date"} 
                  onValueChange={(v) => setFilters({ ...filters, sortBy: v as 'date' | 'project' | 'title' })}
                >
                  <SelectTrigger className="w-[110px] h-8 text-xs" data-testid="filter-sort">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="date">Date</SelectItem>
                    <SelectItem value="project">Project</SelectItem>
                    <SelectItem value="title">Title</SelectItem>
                  </SelectContent>
                </Select>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={toggleSortOrder}
                  className="h-8 text-xs"
                  data-testid="button-sort-order"
                >
                  <ArrowUpDown className="h-3.5 w-3.5 mr-1.5" />
                  {filters.sortOrder === 'asc' ? 'Oldest' : 'Newest'}
                </Button>
              </>
            ) : (
              /* Calendar navigation - Calendar view only */
              <div className="flex items-center bg-muted rounded-md ml-auto">
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={goToPreviousMonth} data-testid="button-prev-month">
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="px-3 text-sm font-medium min-w-[140px] text-center" data-testid="text-current-month">
                  {format(currentDate, "MMMM yyyy")}
                </span>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={goToNextMonth} data-testid="button-next-month">
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>

          {/* Active Project Chips - Shown when filters active */}
          {selectedProjects.length > 0 && (
            <div className="px-4 sm:px-6 pb-3 flex flex-wrap items-center gap-2">
              <span className="text-xs text-muted-foreground">Active projects:</span>
              {selectedProjects.map((project) => (
                <Badge
                  key={project.id}
                  variant="secondary"
                  className="gap-1 pr-1 text-xs"
                  data-testid={`chip-project-${project.id}`}
                >
                  <span className="truncate max-w-[150px]">{project.name}</span>
                  <button
                    onClick={() => toggleProject(project.id)}
                    className="ml-1 hover:bg-muted rounded-sm p-0.5"
                    data-testid={`remove-chip-${project.id}`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          )}
        </div>

        {/* Content Area - Scrollable */}
        <div className="flex-1 overflow-auto">
          {viewMode === 'list' ? (
            /* List View */
            <div className="w-full max-w-6xl mx-auto px-4 sm:px-6 py-6">
              {/* Loading State */}
              {isLoading && (
                <div className="text-center py-12 text-muted-foreground" data-testid="text-loading">
                  Loading meetings...
                </div>
              )}

              {/* Error State */}
              {error && (
                <div className="text-center py-12 text-destructive" data-testid="text-error">
                  Failed to load meetings. Please try again.
                </div>
              )}

              {/* Empty State */}
              {combinedItems.length === 0 && !isLoading && (
                <div className="text-center py-16 border-2 border-dashed rounded-lg" data-testid="text-empty">
                  <CalendarIcon className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                  <h3 className="text-lg font-medium mb-1">No meetings found</h3>
                  <p className="text-muted-foreground text-sm">
                    {hasActiveFilters 
                      ? "Try adjusting your filters or search terms."
                      : "Create your first coordination meeting to get started."}
                  </p>
                  {!hasActiveFilters && canCreateMeetings && (
                    <AddMeetingDialog trigger={
                      <Button variant="outline" className="mt-4" data-testid="button-empty-create">
                        <Plus className="h-4 w-4 mr-2" />
                        Create Meeting
                      </Button>
                    } />
                  )}
                </div>
              )}
              
              {/* Meeting Grid */}
              {combinedItems.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {combinedItems.map((item) => 
                    item.type === 'meeting' ? (
                      <MeetingCard 
                        key={`meeting-${item.data.id}`}
                        meeting={item.data} 
                        pointCount={pointCounts?.[item.data.id] || 0}
                        attendeeCount={meetingAttendeeCounts?.[item.data.id] || 0}
                      />
                    ) : (
                      <SeriesCard
                        key={`series-${item.data.id}`}
                        series={item.data}
                        project={projects.find(p => p.id === item.data.projectId)}
                        attendeeCount={seriesAttendeeCounts?.[item.data.id] || 0}
                        pointCount={seriesPointCounts?.[item.data.id] || 0}
                      />
                    )
                  )}
                </div>
              )}
            </div>
          ) : (
            /* Calendar View */
            <div className="px-4 sm:px-6 py-6 swipe-hint">
              <div className="swipe-container pb-2">
                <div className="grid grid-cols-7 gap-px bg-border rounded-lg overflow-hidden border shadow-sm min-w-[700px]">
                {days.map(day => (
                  <div key={day} className="bg-muted/50 p-2 text-center text-sm font-medium text-muted-foreground">
                    {day}
                  </div>
                ))}
                {calendarDays.map((calendarDay, i) => {
                  const dayMeetings = getMeetingsForDate(calendarDay.date);
                  const isToday = isSameDay(calendarDay.date, new Date());
                  
                  // Apply type filter in calendar view too - hide meetings when viewing only series
                  const filteredDayMeetings = viewFilter === 'series' ? [] : dayMeetings;
                  
                  return (
                    <div 
                      key={i} 
                      className={cn(
                        "min-h-[120px] bg-card p-2 transition-colors hover:bg-accent/10 cursor-pointer group",
                        !calendarDay.currentMonth && "bg-muted/20 text-muted-foreground"
                      )}
                      onClick={() => handleDayClick(calendarDay.date)}
                      data-testid={`calendar-day-${format(calendarDay.date, "yyyy-MM-dd")}`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <div className={cn(
                          "text-sm p-1",
                          isToday && "bg-primary text-primary-foreground rounded-full w-7 h-7 flex items-center justify-center"
                        )}>
                          {format(calendarDay.date, "d")}
                        </div>
                        <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                          <Plus className="h-4 w-4 text-muted-foreground" />
                        </div>
                      </div>
                      <div className="space-y-1" onClick={(e) => e.stopPropagation()}>
                        {filteredDayMeetings.slice(0, 3).map(meeting => (
                          <Link key={meeting.id} href={`/meeting/${meeting.id}`}>
                            <div className={cn(
                              "text-xs px-2 py-1 rounded cursor-pointer truncate border-l-2 shadow-sm hover:opacity-80 transition-opacity",
                              meeting.platform === 'outlook' 
                                ? "bg-blue-100 text-blue-700 border-l-blue-500 dark:bg-blue-900/30 dark:text-blue-300" 
                                : "bg-red-100 text-red-700 border-l-red-500 dark:bg-red-900/30 dark:text-red-300"
                            )} data-testid={`calendar-event-${meeting.id}`}>
                              {meeting.startTime} {meeting.title}
                            </div>
                          </Link>
                        ))}
                        {filteredDayMeetings.length > 3 && (
                          <div className="text-xs text-muted-foreground px-2">
                            +{filteredDayMeetings.length - 3} more
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Day Actions Dialog for Calendar */}
      {selectedDate && (
        <DayActionsDialog
          open={dayDialogOpen}
          onOpenChange={setDayDialogOpen}
          selectedDate={selectedDate}
        />
      )}
    </Layout>
  );
}
