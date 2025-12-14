import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useProjectFilter } from "@/contexts/project-filter-context";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { FolderKanban, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Project } from "@shared/schema";

export default function GlobalProjectFilter() {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const { selectedProjectIds, toggleProject, clearSelection } = useProjectFilter();

  const { data: projects = [] } = useQuery<Project[]>({
    queryKey: ["projects"],
    queryFn: async () => {
      const response = await fetch("/api/projects");
      if (!response.ok) throw new Error("Failed to fetch projects");
      return response.json();
    },
  });

  const filteredProjects = projects.filter(project => {
    const searchLower = search.toLowerCase();
    return (
      project.name.toLowerCase().includes(searchLower) ||
      project.city.toLowerCase().includes(searchLower) ||
      project.country.toLowerCase().includes(searchLower)
    );
  });

  const selectedProjects = projects.filter(p => selectedProjectIds.includes(p.id));

  const getDisplayText = () => {
    if (selectedProjects.length === 0) return "All Projects";
    if (selectedProjects.length === 1) return selectedProjects[0].name;
    if (selectedProjects.length === 2) return selectedProjects.map(p => p.name).join(", ");
    return `${selectedProjects.length} projects selected`;
  };

  const displayText = getDisplayText();
  const hasActiveFilter = selectedProjectIds.length > 0;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button 
          variant={hasActiveFilter ? "default" : "outline"}
          className={cn(
            "h-9 gap-2 max-w-[300px]",
            !hasActiveFilter && "border-dashed"
          )}
          data-testid="button-global-project-filter"
        >
          <FolderKanban className="h-4 w-4 shrink-0" />
          <span className="truncate hidden sm:inline">{displayText}</span>
          <span className="sm:hidden">
            {hasActiveFilter ? selectedProjectIds.length : "All"}
          </span>
          {hasActiveFilter && (
            <X 
              className="h-3.5 w-3.5 shrink-0 opacity-70 hover:opacity-100" 
              onClick={(e) => {
                e.stopPropagation();
                clearSelection();
              }}
            />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="start">
        <div className="p-3 border-b">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search projects..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 h-8"
                data-testid="input-project-search"
              />
            </div>
            {selectedProjectIds.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearSelection}
                className="h-8 px-2 text-muted-foreground"
                data-testid="button-clear-selection"
              >
                Clear
              </Button>
            )}
          </div>
        </div>
        <div className="max-h-64 overflow-y-auto p-2">
          {filteredProjects.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No projects found
            </p>
          ) : (
            <div className="space-y-1">
              {filteredProjects.map((project) => (
                <div
                  key={project.id}
                  className={cn(
                    "flex items-center gap-2 p-2 rounded-md cursor-pointer hover:bg-accent",
                    selectedProjectIds.includes(project.id) && "bg-accent"
                  )}
                  onClick={() => toggleProject(project.id)}
                  data-testid={`filter-project-${project.id}`}
                >
                  <Checkbox
                    checked={selectedProjectIds.includes(project.id)}
                    onCheckedChange={() => toggleProject(project.id)}
                    data-testid={`checkbox-project-${project.id}`}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{project.name}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {project.city}, {project.country}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        {selectedProjectIds.length > 0 && (
          <div className="p-2 border-t">
            <div className="flex flex-wrap gap-1">
              {selectedProjects.map((project) => (
                <Badge
                  key={project.id}
                  variant="secondary"
                  className="gap-1 pr-1"
                >
                  <span className="truncate max-w-[120px]">{project.name}</span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleProject(project.id);
                    }}
                    className="ml-1 hover:bg-muted rounded-sm"
                    data-testid={`remove-project-${project.id}`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
