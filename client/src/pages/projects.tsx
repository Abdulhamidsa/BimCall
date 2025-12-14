import { useState } from "react";
import Layout from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/auth-context";
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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Plus,
  MapPin,
  Building2,
  Calendar,
  Users,
  FolderOpen,
  Filter,
  X,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { projectsApi, type ProjectFilters } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Link, useLocation } from "wouter";
import { format } from "date-fns";
import type { Project } from "@shared/schema";
import EntityActionMenu from "@/components/entity-action-menu";
import EditProjectDialog from "@/components/edit-project-dialog";

const statusColors: Record<string, string> = {
  planning: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
  active: "bg-green-500/10 text-green-500 border-green-500/20",
  on_hold: "bg-orange-500/10 text-orange-500 border-orange-500/20",
  completed: "bg-blue-500/10 text-blue-500 border-blue-500/20",
};

const constructionTypeLabels: Record<string, string> = {
  commercial: "Commercial",
  residential: "Residential",
  infrastructure: "Infrastructure",
  healthcare: "Healthcare",
  industrial: "Industrial",
};

function ProjectCard({ project, meetingCount }: { project: Project; meetingCount: number }) {
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { permissions } = useAuth();
  
  const canEditProjects = permissions?.canEditProjects ?? false;

  const deleteMutation = useMutation({
    mutationFn: () => projectsApi.delete(project.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      queryClient.invalidateQueries({ queryKey: ["project-filters"] });
      toast({
        title: "Project Deleted",
        description: "The project has been deleted successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete project. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleCardClick = () => {
    setLocation(`/project/${project.id}`);
  };

  return (
    <>
      <Card 
        className="group cursor-pointer hover:shadow-lg transition-all duration-200 hover:border-primary/30" 
        data-testid={`card-project-${project.id}`}
        onClick={handleCardClick}
      >
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <Link href={`/project/${project.id}`} onClick={(e) => e.stopPropagation()}>
                <h3 className="font-semibold text-lg truncate hover:text-primary hover:underline transition-colors cursor-pointer" data-testid={`text-project-name-${project.id}`}>
                  {project.name}
                </h3>
              </Link>
              <p className="text-sm text-muted-foreground font-mono">{project.code}</p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className={statusColors[project.status] || ""} data-testid={`badge-status-${project.id}`}>
                {project.status.replace("_", " ")}
              </Badge>
              {canEditProjects && (
                <EntityActionMenu
                  entityType="project"
                  entityName={project.name}
                  onEdit={() => setEditDialogOpen(true)}
                  onDelete={() => deleteMutation.mutate()}
                  isDeleting={deleteMutation.isPending}
                />
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {project.description && (
            <p className="text-sm text-muted-foreground line-clamp-2">{project.description}</p>
          )}
          
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="flex items-center gap-2 text-muted-foreground">
              <MapPin className="h-4 w-4 shrink-0" />
              <span className="truncate">{project.city}, {project.country}</span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Calendar className="h-4 w-4 shrink-0" />
              <span className="font-medium" data-testid={`text-meeting-count-${project.id}`}>{meetingCount} meeting{meetingCount !== 1 ? 's' : ''}</span>
            </div>
            {project.client && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Building2 className="h-4 w-4 shrink-0" />
                <span className="truncate">{project.client}</span>
              </div>
            )}
            {project.constructionType && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <FolderOpen className="h-4 w-4 shrink-0" />
                <span>{constructionTypeLabels[project.constructionType] || project.constructionType}</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <EditProjectDialog
        project={project}
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
      />
    </>
  );
}

function AddProjectDialog() {
  const [open, setOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    code: "",
    description: "",
    street: "",
    city: "",
    country: "",
    status: "planning" as const,
    client: "",
    startDate: "",
    endDate: "",
    constructionType: "",
  });

  const queryClient = useQueryClient();
  const { toast } = useToast();

  const createMutation = useMutation({
    mutationFn: projectsApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      queryClient.invalidateQueries({ queryKey: ["project-filters"] });
      setOpen(false);
      resetForm();
      toast({
        title: "Project Created",
        description: "Your project has been created successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create project. Please try again.",
        variant: "destructive",
      });
    },
  });

  const resetForm = () => {
    setFormData({
      name: "",
      code: "",
      description: "",
      street: "",
      city: "",
      country: "",
      status: "planning",
      client: "",
      startDate: "",
      endDate: "",
      constructionType: "",
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.code || !formData.city || !formData.country) return;
    
    createMutation.mutate({
      ...formData,
      description: formData.description || null,
      street: formData.street || null,
      client: formData.client || null,
      startDate: formData.startDate || null,
      endDate: formData.endDate || null,
      constructionType: formData.constructionType || null,
      contractValue: null,
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-primary hover:bg-primary/90 shadow-sm" data-testid="button-add-project">
          <Plus className="mr-2 h-4 w-4" /> Add Project
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add New Project</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Project Name *</Label>
              <Input
                id="name"
                placeholder="e.g., Skyline Tower A"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
                data-testid="input-project-name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="code">Project Code *</Label>
              <Input
                id="code"
                placeholder="e.g., SKY-TWR-A"
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                required
                data-testid="input-project-code"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              placeholder="Brief description of the project..."
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={2}
              data-testid="input-project-description"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="street">Street Address</Label>
            <Input
              id="street"
              placeholder="e.g., 123 Business Bay"
              value={formData.street}
              onChange={(e) => setFormData({ ...formData, street: e.target.value })}
              data-testid="input-project-street"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="city">City *</Label>
              <Input
                id="city"
                placeholder="e.g., Dubai"
                value={formData.city}
                onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                required
                data-testid="input-project-city"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="country">Country *</Label>
              <Input
                id="country"
                placeholder="e.g., UAE"
                value={formData.country}
                onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                required
                data-testid="input-project-country"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select value={formData.status} onValueChange={(v) => setFormData({ ...formData, status: v as any })}>
                <SelectTrigger data-testid="select-project-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="planning">Planning</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="on_hold">On Hold</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="constructionType">Construction Type</Label>
              <Select value={formData.constructionType} onValueChange={(v) => setFormData({ ...formData, constructionType: v })}>
                <SelectTrigger data-testid="select-construction-type">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="commercial">Commercial</SelectItem>
                  <SelectItem value="residential">Residential</SelectItem>
                  <SelectItem value="infrastructure">Infrastructure</SelectItem>
                  <SelectItem value="healthcare">Healthcare</SelectItem>
                  <SelectItem value="industrial">Industrial</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="client">Client</Label>
            <Input
              id="client"
              placeholder="e.g., ABC Development Corp"
              value={formData.client}
              onChange={(e) => setFormData({ ...formData, client: e.target.value })}
              data-testid="input-project-client"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="startDate">Start Date</Label>
              <Input
                id="startDate"
                type="date"
                value={formData.startDate}
                onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                data-testid="input-start-date"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="endDate">End Date</Label>
              <Input
                id="endDate"
                type="date"
                value={formData.endDate}
                onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                data-testid="input-end-date"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => setOpen(false)} data-testid="button-cancel">
              Cancel
            </Button>
            <Button type="submit" disabled={createMutation.isPending} data-testid="button-create-project">
              {createMutation.isPending ? "Creating..." : "Create Project"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function ProjectsPage() {
  const [filters, setFilters] = useState<ProjectFilters>({});
  const [showFilters, setShowFilters] = useState(false);
  const { permissions } = useAuth();
  
  const canCreateProjects = permissions?.canCreateProjects ?? false;

  const { data: projects, isLoading } = useQuery({
    queryKey: ["projects", filters],
    queryFn: () => projectsApi.getAll(filters),
  });

  const { data: filterOptions } = useQuery({
    queryKey: ["project-filters"],
    queryFn: projectsApi.getFilterOptions,
  });

  const { data: meetingCounts } = useQuery({
    queryKey: ["project-meeting-counts"],
    queryFn: projectsApi.getMeetingCounts,
  });

  const clearFilters = () => {
    setFilters({});
  };

  const hasActiveFilters = filters.city || filters.country || filters.status || filters.search;

  return (
    <Layout>
      <div className="container mx-auto px-4 sm:px-6 py-6 max-w-6xl space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight" data-testid="text-page-title">Projects</h1>
            <p className="text-muted-foreground mt-1">Manage your construction projects and coordination meetings.</p>
          </div>
          {canCreateProjects && <AddProjectDialog />}
        </div>

        {/* Filter and Options */}
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1 max-w-full sm:max-w-[200px]">
              <Filter className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Filter..."
                className="pl-8 h-8 text-sm bg-transparent"
                value={filters.search || ""}
                onChange={(e) => setFilters({ ...filters, search: e.target.value || undefined })}
                data-testid="input-filter-projects"
              />
            </div>
            <Button
              variant={showFilters ? "secondary" : "outline"}
              onClick={() => setShowFilters(!showFilters)}
              className="shrink-0"
              data-testid="button-toggle-filters"
            >
              <Filter className="h-4 w-4 mr-2" />
              Filters
              {hasActiveFilters && (
                <Badge className="ml-2 h-5 w-5 p-0 flex items-center justify-center" variant="default">
                  {[filters.city, filters.country, filters.status].filter(Boolean).length}
                </Badge>
              )}
            </Button>
          </div>

          {/* Filter Panel */}
          {showFilters && (
            <Card className="p-4" data-testid="panel-filters">
              <div className="flex flex-wrap gap-4">
                <div className="space-y-2 min-w-0 flex-1 sm:flex-none sm:min-w-[150px]">
                  <Label className="text-xs text-muted-foreground">City</Label>
                  <Select value={filters.city || "all"} onValueChange={(v) => setFilters({ ...filters, city: v === "all" ? undefined : v })}>
                    <SelectTrigger className="w-full sm:w-[180px]" data-testid="filter-city">
                      <SelectValue placeholder="All cities" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All cities</SelectItem>
                      {filterOptions?.cities.map((city) => (
                        <SelectItem key={city} value={city}>{city}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2 min-w-0 flex-1 sm:flex-none sm:min-w-[150px]">
                  <Label className="text-xs text-muted-foreground">Country</Label>
                  <Select value={filters.country || "all"} onValueChange={(v) => setFilters({ ...filters, country: v === "all" ? undefined : v })}>
                    <SelectTrigger className="w-full sm:w-[180px]" data-testid="filter-country">
                      <SelectValue placeholder="All countries" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All countries</SelectItem>
                      {filterOptions?.countries.map((country) => (
                        <SelectItem key={country} value={country}>{country}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2 min-w-[150px]">
                  <Label className="text-xs text-muted-foreground">Status</Label>
                  <Select value={filters.status || "all"} onValueChange={(v) => setFilters({ ...filters, status: v === "all" ? undefined : v })}>
                    <SelectTrigger className="w-full sm:w-[180px]" data-testid="filter-status">
                      <SelectValue placeholder="All statuses" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All statuses</SelectItem>
                      <SelectItem value="planning">Planning</SelectItem>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="on_hold">On Hold</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {hasActiveFilters && (
                  <div className="flex items-end">
                    <Button variant="ghost" size="sm" onClick={clearFilters} className="text-muted-foreground" data-testid="button-clear-filters">
                      <X className="h-4 w-4 mr-1" />
                      Clear all
                    </Button>
                  </div>
                )}
              </div>
            </Card>
          )}
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="text-center py-12 text-muted-foreground" data-testid="text-loading">
            Loading projects...
          </div>
        )}

        {/* Empty State */}
        {projects && projects.length === 0 && (
          <div className="text-center py-12" data-testid="text-empty">
            <FolderOpen className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-medium mb-1">No projects found</h3>
            <p className="text-muted-foreground">
              {hasActiveFilters 
                ? "Try adjusting your filters or search terms."
                : "Create your first project to get started."}
            </p>
          </div>
        )}

        {/* Projects Grid */}
        {projects && projects.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {projects.map((project) => (
              <ProjectCard 
                key={project.id} 
                project={project} 
                meetingCount={meetingCounts?.[project.id] || 0}
              />
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
