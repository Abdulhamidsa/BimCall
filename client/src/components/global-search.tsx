import { useState, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { 
  Search, 
  FolderKanban, 
  Calendar, 
  Repeat, 
  Users, 
  MessageSquare,
  ArrowRight
} from "lucide-react";
import { cn } from "@/lib/utils";
import { searchApi, type SearchResults, type SearchAttendee, type SearchPoint } from "@/lib/api";

export default function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [, navigate] = useLocation();
  const inputRef = useRef<HTMLInputElement>(null);

  const { data: results, isLoading } = useQuery<SearchResults>({
    queryKey: ["global-search", query],
    queryFn: async () => {
      if (query.length < 2) {
        return { projects: [], meetings: [], series: [], attendees: [], points: [] };
      }
      return searchApi.search(query, 5);
    },
    enabled: query.length >= 2,
  });

  const hasResults = results && (
    results.projects.length > 0 ||
    results.meetings.length > 0 ||
    results.series.length > 0 ||
    results.attendees.length > 0 ||
    results.points.length > 0
  );

  const handleSelect = (type: string, id: string, relatedId?: string) => {
    setOpen(false);
    setQuery("");
    
    switch (type) {
      case 'project':
        navigate(`/project/${id}`);
        break;
      case 'meeting':
        navigate(`/meeting/${id}`);
        break;
      case 'series':
        navigate(`/series/${id}`);
        break;
      case 'point':
        if (relatedId) {
          navigate(relatedId);
        }
        break;
      case 'attendee-meeting':
        if (relatedId) {
          navigate(`/meeting/${relatedId}`);
        }
        break;
      case 'attendee-series':
        if (relatedId) {
          navigate(`/series/${relatedId}`);
        }
        break;
      default:
        break;
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen(true);
        setTimeout(() => inputRef.current?.focus(), 100);
      }
    };
    
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  const isMac = typeof navigator !== 'undefined' && navigator.platform.toUpperCase().indexOf('MAC') >= 0;
  const shortcutKey = isMac ? '⌘' : 'Ctrl';

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className="relative flex items-center gap-2 w-64 lg:w-80 h-9 px-3 text-sm text-muted-foreground bg-muted/50 hover:bg-muted border border-border rounded-lg transition-colors cursor-pointer hidden sm:flex"
          onClick={() => {
            setOpen(true);
            setTimeout(() => inputRef.current?.focus(), 100);
          }}
          data-testid="button-global-search"
        >
          <Search className="h-4 w-4 shrink-0" />
          <span className="flex-1 text-left truncate">
            {query || "Search everything..."}
          </span>
          <kbd className="hidden md:inline-flex h-5 items-center gap-1 rounded border bg-background px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
            {shortcutKey}K
          </kbd>
        </button>
      </PopoverTrigger>
      <PopoverContent 
        className="w-[calc(100vw-2rem)] sm:w-[400px] max-w-[400px] p-0" 
        align="start"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <div className="flex items-center border-b px-3">
          <Search className="h-4 w-4 text-muted-foreground shrink-0" />
          <Input
            ref={inputRef}
            placeholder="Search projects, meetings, people..."
            className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0 h-11"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            data-testid="input-global-search"
          />
        </div>
        <ScrollArea className="max-h-[350px]">
          {query.length < 2 ? (
            <div className="p-4 text-sm text-muted-foreground text-center">
              Type to search across all projects, meetings, and people...
            </div>
          ) : isLoading ? (
            <div className="p-4 text-sm text-muted-foreground text-center">
              Searching...
            </div>
          ) : !hasResults ? (
            <div className="p-4 text-sm text-muted-foreground text-center">
              No results found for "{query}"
            </div>
          ) : (
            <div className="py-2">
              {results.projects.length > 0 && (
                <div className="mb-2">
                  <div className="px-3 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                    <FolderKanban className="h-3 w-3" />
                    Projects
                  </div>
                  {results.projects.map((project) => (
                    <div
                      key={project.id}
                      className="px-3 py-2 hover:bg-accent cursor-pointer flex items-center justify-between group"
                      onClick={() => handleSelect('project', project.id)}
                      data-testid={`search-result-project-${project.id}`}
                    >
                      <div>
                        <p className="text-sm font-medium">{project.name}</p>
                        <p className="text-xs text-muted-foreground">{project.city}, {project.country}</p>
                      </div>
                      <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  ))}
                </div>
              )}

              {results.meetings.length > 0 && (
                <div className="mb-2">
                  <div className="px-3 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                    <Calendar className="h-3 w-3" />
                    Meetings
                  </div>
                  {results.meetings.map((meeting) => (
                    <div
                      key={meeting.id}
                      className="px-3 py-2 hover:bg-accent cursor-pointer flex items-center justify-between group"
                      onClick={() => handleSelect('meeting', meeting.id)}
                      data-testid={`search-result-meeting-${meeting.id}`}
                    >
                      <div>
                        <p className="text-sm font-medium">{meeting.title}</p>
                        <p className="text-xs text-muted-foreground">{meeting.date} • {meeting.project}</p>
                      </div>
                      <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  ))}
                </div>
              )}

              {results.series.length > 0 && (
                <div className="mb-2">
                  <div className="px-3 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                    <Repeat className="h-3 w-3" />
                    Recurring Series
                  </div>
                  {results.series.map((s) => (
                    <div
                      key={s.id}
                      className="px-3 py-2 hover:bg-accent cursor-pointer flex items-center justify-between group"
                      onClick={() => handleSelect('series', s.id)}
                      data-testid={`search-result-series-${s.id}`}
                    >
                      <div>
                        <p className="text-sm font-medium">{s.title}</p>
                        <p className="text-xs text-muted-foreground">{s.recurrenceRule} • {s.location}</p>
                      </div>
                      <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  ))}
                </div>
              )}

              {results.attendees.length > 0 && (
                <div className="mb-2">
                  <div className="px-3 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                    <Users className="h-3 w-3" />
                    People
                  </div>
                  {results.attendees.map((attendee: SearchAttendee, idx) => {
                    const relatedId = attendee.meetingId || attendee.seriesId;
                    const type = attendee.meetingId ? 'attendee-meeting' : attendee.seriesId ? 'attendee-series' : 'attendee';
                    
                    return (
                      <div
                        key={`attendee-${idx}`}
                        className="px-3 py-2 hover:bg-accent cursor-pointer flex items-center justify-between group"
                        onClick={() => handleSelect(type, attendee.id, relatedId)}
                        data-testid={`search-result-attendee-${idx}`}
                      >
                        <div>
                          <p className="text-sm font-medium">{attendee.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {attendee.email && `${attendee.email} • `}
                            {attendee.company || attendee.role}
                          </p>
                        </div>
                        {relatedId && (
                          <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {results.points.length > 0 && (
                <div className="mb-2">
                  <div className="px-3 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                    <MessageSquare className="h-3 w-3" />
                    Points
                  </div>
                  {results.points.map((point: SearchPoint) => {
                    const relatedPath = point.meetingId 
                      ? `/meeting/${point.meetingId}` 
                      : point.seriesId 
                        ? `/series/${point.seriesId}` 
                        : undefined;
                    
                    return (
                      <div
                        key={point.id}
                        className="px-3 py-2 hover:bg-accent cursor-pointer flex items-center justify-between group"
                        onClick={() => handleSelect('point', point.id, relatedPath)}
                        data-testid={`search-result-point-${point.id}`}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs text-muted-foreground">#{point.id.slice(0, 6)}</span>
                            <p className="text-sm font-medium truncate">{point.title}</p>
                          </div>
                          <p className="text-xs text-muted-foreground truncate">{point.description}</p>
                        </div>
                        {relatedPath && (
                          <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0 ml-2" />
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
