import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import Layout from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { projectsApi, meetingsApi, meetingSeriesApi } from "@/lib/api";
import type { Project, Meeting, MeetingSeries } from "@shared/schema";
import { Link } from "wouter";
import {
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  Calendar,
  FolderKanban,
  Clock,
  Repeat,
} from "lucide-react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, addMonths, subMonths, differenceInDays, isWithinInterval, parseISO, addDays } from "date-fns";

const STATUS_COLORS: Record<string, string> = {
  active: "bg-green-500",
  planning: "bg-blue-500",
  on_hold: "bg-amber-500",
  completed: "bg-gray-400",
  cancelled: "bg-red-500",
  scheduled: "bg-blue-400",
  closed: "bg-gray-400",
};

const STATUS_BG_COLORS: Record<string, string> = {
  active: "bg-green-100 dark:bg-green-900/30",
  planning: "bg-blue-100 dark:bg-blue-900/30",
  on_hold: "bg-amber-100 dark:bg-amber-900/30",
  completed: "bg-gray-100 dark:bg-gray-900/30",
  cancelled: "bg-red-100 dark:bg-red-900/30",
  scheduled: "bg-blue-100 dark:bg-blue-900/30",
  closed: "bg-gray-100 dark:bg-gray-900/30",
};

type ZoomLevel = "month" | "quarter" | "year";

interface GanttItem {
  id: string;
  name: string;
  startDate: Date;
  endDate: Date;
  status: string;
  type: "project" | "meeting" | "series";
  projectId?: string;
  projectName?: string;
}

function LoadingSkeleton() {
  return (
    <Layout>
      <div className="container mx-auto py-8">
        <Skeleton className="h-10 w-64 mb-8" />
        <Skeleton className="h-12 w-full mb-4" />
        <div className="space-y-2">
          {[...Array(8)].map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      </div>
    </Layout>
  );
}

export default function GanttPage() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [zoomLevel, setZoomLevel] = useState<ZoomLevel>("month");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [showProjects, setShowProjects] = useState(true);
  const [showMeetings, setShowMeetings] = useState(true);
  const [showSeries, setShowSeries] = useState(true);

  const { data: projects = [], isLoading: projectsLoading } = useQuery({
    queryKey: ["projects"],
    queryFn: () => projectsApi.getAll(),
  });

  const { data: meetings = [], isLoading: meetingsLoading } = useQuery({
    queryKey: ["meetings", { status: "all" }],
    queryFn: () => meetingsApi.getAll({ status: "all" }),
  });

  const { data: series = [], isLoading: seriesLoading } = useQuery({
    queryKey: ["meeting-series", { status: "all" }],
    queryFn: () => meetingSeriesApi.getAll({ status: "all" }),
  });

  const isLoading = projectsLoading || meetingsLoading || seriesLoading;

  const dateRange = useMemo(() => {
    let start: Date;
    let end: Date;
    
    if (zoomLevel === "month") {
      start = startOfMonth(currentDate);
      end = endOfMonth(currentDate);
    } else if (zoomLevel === "quarter") {
      start = startOfMonth(currentDate);
      end = endOfMonth(addMonths(currentDate, 2));
    } else {
      start = startOfMonth(currentDate);
      end = endOfMonth(addMonths(currentDate, 11));
    }
    
    return { start, end };
  }, [currentDate, zoomLevel]);

  const days = useMemo(() => {
    return eachDayOfInterval({ start: dateRange.start, end: dateRange.end });
  }, [dateRange]);

  const ganttItems = useMemo(() => {
    const items: GanttItem[] = [];

    if (showProjects) {
      projects.forEach((project: Project) => {
        if (filterStatus !== "all" && project.status !== filterStatus) return;
        
        const startDate = project.startDate ? parseISO(project.startDate) : new Date();
        const endDate = project.endDate ? parseISO(project.endDate) : addDays(startDate, 365);
        
        items.push({
          id: project.id,
          name: project.name,
          startDate,
          endDate,
          status: project.status,
          type: "project",
        });
      });
    }

    if (showMeetings) {
      meetings.forEach((meeting: Meeting) => {
        if (filterStatus !== "all" && meeting.status !== filterStatus) return;
        
        const meetingDate = parseISO(meeting.date);
        const projectName = projects.find((p: Project) => p.id === meeting.projectId)?.name;
        
        items.push({
          id: meeting.id,
          name: meeting.title,
          startDate: meetingDate,
          endDate: meetingDate,
          status: meeting.status,
          type: "meeting",
          projectId: meeting.projectId || undefined,
          projectName,
        });
      });
    }

    if (showSeries) {
      series.forEach((s: MeetingSeries) => {
        if (filterStatus !== "all" && s.status !== filterStatus) return;
        
        const createdDate = new Date(s.createdAt);
        const projectName = projects.find((p: Project) => p.id === s.projectId)?.name;
        
        items.push({
          id: s.id,
          name: s.title,
          startDate: createdDate,
          endDate: addMonths(createdDate, 6),
          status: s.status,
          type: "series",
          projectId: s.projectId || undefined,
          projectName,
        });
      });
    }

    return items.sort((a, b) => a.startDate.getTime() - b.startDate.getTime());
  }, [projects, meetings, series, showProjects, showMeetings, showSeries, filterStatus]);

  const calculateBarPosition = (item: GanttItem) => {
    const totalDays = differenceInDays(dateRange.end, dateRange.start) + 1;
    
    const startOffset = Math.max(0, differenceInDays(item.startDate, dateRange.start));
    const endOffset = Math.min(totalDays, differenceInDays(item.endDate, dateRange.start) + 1);
    
    const isVisible = isWithinInterval(item.startDate, { start: dateRange.start, end: dateRange.end }) ||
                      isWithinInterval(item.endDate, { start: dateRange.start, end: dateRange.end }) ||
                      (item.startDate < dateRange.start && item.endDate > dateRange.end);
    
    if (!isVisible) return null;
    
    const left = (startOffset / totalDays) * 100;
    const width = Math.max(1, ((endOffset - startOffset) / totalDays) * 100);
    
    return { left: `${left}%`, width: `${width}%` };
  };

  const navigateTime = (direction: "prev" | "next") => {
    const months = zoomLevel === "month" ? 1 : zoomLevel === "quarter" ? 3 : 12;
    setCurrentDate(direction === "prev" ? subMonths(currentDate, months) : addMonths(currentDate, months));
  };

  const getItemLink = (item: GanttItem) => {
    switch (item.type) {
      case "project":
        return `/project/${item.id}`;
      case "meeting":
        return `/meeting/${item.id}`;
      case "series":
        return `/series/${item.id}`;
      default:
        return "/";
    }
  };

  const getItemIcon = (type: GanttItem["type"]) => {
    switch (type) {
      case "project":
        return FolderKanban;
      case "meeting":
        return Calendar;
      case "series":
        return Repeat;
      default:
        return Clock;
    }
  };

  if (isLoading) {
    return <LoadingSkeleton />;
  }

  return (
    <Layout>
      <div className="container mx-auto py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold" data-testid="text-gantt-title">Project Timeline</h1>
            <p className="text-muted-foreground mt-1">
              Visualize your projects, meetings, and series on a timeline
            </p>
          </div>
        </div>

        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => navigateTime("prev")}
                  data-testid="button-prev-time"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="min-w-[200px] text-center font-medium">
                  {format(dateRange.start, "MMM yyyy")} - {format(dateRange.end, "MMM yyyy")}
                </span>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => navigateTime("next")}
                  data-testid="button-next-time"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>

              <Select value={zoomLevel} onValueChange={(v) => setZoomLevel(v as ZoomLevel)}>
                <SelectTrigger className="w-[140px]" data-testid="select-zoom-level">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="month">Month</SelectItem>
                  <SelectItem value="quarter">Quarter</SelectItem>
                  <SelectItem value="year">Year</SelectItem>
                </SelectContent>
              </Select>

              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-[140px]" data-testid="select-filter-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="planning">Planning</SelectItem>
                  <SelectItem value="on_hold">On Hold</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="scheduled">Scheduled</SelectItem>
                  <SelectItem value="closed">Closed</SelectItem>
                </SelectContent>
              </Select>

              <div className="flex items-center gap-2 ml-auto">
                <Button
                  variant={showProjects ? "default" : "outline"}
                  size="sm"
                  onClick={() => setShowProjects(!showProjects)}
                  data-testid="button-toggle-projects"
                >
                  <FolderKanban className="h-4 w-4 mr-1" />
                  Projects
                </Button>
                <Button
                  variant={showMeetings ? "default" : "outline"}
                  size="sm"
                  onClick={() => setShowMeetings(!showMeetings)}
                  data-testid="button-toggle-meetings"
                >
                  <Calendar className="h-4 w-4 mr-1" />
                  Meetings
                </Button>
                <Button
                  variant={showSeries ? "default" : "outline"}
                  size="sm"
                  onClick={() => setShowSeries(!showSeries)}
                  data-testid="button-toggle-series"
                >
                  <Repeat className="h-4 w-4 mr-1" />
                  Series
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <div className="min-w-[900px]">
                <div className="sticky top-0 z-10 bg-card border-b flex">
                  <div className="w-[250px] flex-shrink-0 p-3 font-medium border-r">
                    Items ({ganttItems.length})
                  </div>
                  <div className="flex-1 flex">
                    {zoomLevel === "month" ? (
                      days.map((day, i) => (
                        <div
                          key={i}
                          className={`flex-1 text-center py-2 text-xs border-r last:border-r-0 ${
                            day.getDay() === 0 || day.getDay() === 6 ? "bg-muted/50" : ""
                          }`}
                        >
                          <div className="font-medium">{format(day, "d")}</div>
                          {i === 0 && <div className="text-muted-foreground">{format(day, "EEE")}</div>}
                        </div>
                      ))
                    ) : zoomLevel === "quarter" ? (
                      Array.from({ length: 3 }).map((_, i) => {
                        const monthDate = addMonths(dateRange.start, i);
                        return (
                          <div key={i} className="flex-1 text-center py-3 text-sm font-medium border-r last:border-r-0">
                            {format(monthDate, "MMMM yyyy")}
                          </div>
                        );
                      })
                    ) : (
                      Array.from({ length: 12 }).map((_, i) => {
                        const monthDate = addMonths(dateRange.start, i);
                        return (
                          <div key={i} className="flex-1 text-center py-3 text-xs font-medium border-r last:border-r-0">
                            {format(monthDate, "MMM")}
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                {ganttItems.length === 0 ? (
                  <div className="p-8 text-center text-muted-foreground">
                    No items to display for the selected filters and time range.
                  </div>
                ) : (
                  <div className="divide-y">
                    {ganttItems.map((item) => {
                      const barPosition = calculateBarPosition(item);
                      const Icon = getItemIcon(item.type);
                      
                      return (
                        <div key={`${item.type}-${item.id}`} className="flex hover:bg-muted/50 transition-colors">
                          <div className="w-[250px] flex-shrink-0 p-3 border-r">
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Link href={getItemLink(item)}>
                                    <div className="flex items-center gap-2 cursor-pointer" data-testid={`gantt-item-${item.type}-${item.id}`}>
                                      <Icon className={`h-4 w-4 flex-shrink-0 ${
                                        item.type === "project" ? "text-blue-500" :
                                        item.type === "meeting" ? "text-green-500" : "text-purple-500"
                                      }`} />
                                      <div className="min-w-0 flex-1">
                                        <div className="font-medium text-sm truncate">{item.name}</div>
                                        {item.projectName && (
                                          <div className="text-xs text-muted-foreground truncate">{item.projectName}</div>
                                        )}
                                      </div>
                                    </div>
                                  </Link>
                                </TooltipTrigger>
                                <TooltipContent side="right">
                                  <div className="space-y-1">
                                    <div className="font-medium">{item.name}</div>
                                    <div className="text-xs">
                                      {format(item.startDate, "MMM d, yyyy")} - {format(item.endDate, "MMM d, yyyy")}
                                    </div>
                                    <Badge className={STATUS_COLORS[item.status]} variant="secondary">
                                      {item.status}
                                    </Badge>
                                  </div>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </div>
                          
                          <div className="flex-1 relative h-14">
                            {barPosition && (
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Link href={getItemLink(item)}>
                                      <div
                                        className={`absolute top-1/2 -translate-y-1/2 h-6 rounded cursor-pointer transition-all hover:opacity-80 ${STATUS_COLORS[item.status]}`}
                                        style={{
                                          left: barPosition.left,
                                          width: barPosition.width,
                                          minWidth: item.type === "meeting" ? "8px" : "4px",
                                        }}
                                        data-testid={`gantt-bar-${item.type}-${item.id}`}
                                      />
                                    </Link>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <div className="space-y-1">
                                      <div className="font-medium">{item.name}</div>
                                      <div className="text-xs">
                                        {format(item.startDate, "MMM d, yyyy")}
                                        {item.type !== "meeting" && ` - ${format(item.endDate, "MMM d, yyyy")}`}
                                      </div>
                                      <div className="text-xs capitalize">{item.status}</div>
                                    </div>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="mt-6 flex items-center gap-6 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <FolderKanban className="h-4 w-4 text-blue-500" />
            <span>Projects</span>
          </div>
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-green-500" />
            <span>Meetings</span>
          </div>
          <div className="flex items-center gap-2">
            <Repeat className="h-4 w-4 text-purple-500" />
            <span>Series</span>
          </div>
          <div className="ml-auto flex items-center gap-4">
            <div className="flex items-center gap-1">
              <div className="w-4 h-3 rounded bg-green-500" />
              <span>Active</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-4 h-3 rounded bg-blue-500" />
              <span>Planning</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-4 h-3 rounded bg-amber-500" />
              <span>On Hold</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-4 h-3 rounded bg-gray-400" />
              <span>Completed</span>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
