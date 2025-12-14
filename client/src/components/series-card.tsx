import { useState } from "react";
import type { MeetingSeries, Project } from "@shared/schema";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock, MapPin, MessageSquare, Repeat, Users, Monitor, Lock } from "lucide-react";
import { useLocation } from "wouter";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { meetingSeriesApi } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/auth-context";
import EntityActionMenu from "./entity-action-menu";
import EditSeriesDialog from "./edit-series-dialog";

interface SeriesCardProps {
  series: MeetingSeries;
  project?: Project;
  pointCount?: number;
  occurrenceCount?: number;
  attendeeCount?: number;
}

const recurrenceLabels: Record<string, string> = {
  weekly: "Weekly",
  biweekly: "Every 2 weeks",
  monthly: "Monthly",
};

export default function SeriesCard({ series, project, pointCount = 0, occurrenceCount = 0, attendeeCount }: SeriesCardProps) {
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { permissions } = useAuth();
  
  const canEdit = permissions?.canEditMeetings ?? false;

  const deleteMutation = useMutation({
    mutationFn: () => meetingSeriesApi.delete(series.id),
    onSuccess: () => {
      setShowDeleteConfirm(false);
      queryClient.invalidateQueries({ queryKey: ["meeting-series"] });
      toast({
        title: "Series Deleted",
        description: "The meeting series has been deleted successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete series. Please try again.",
        variant: "destructive",
      });
    },
  });

  const platformLabel = series.platform === 'outlook' ? 'Outlook' : 'Gmail';

  const handleCardClick = () => {
    setLocation(`/series/${series.id}`);
  };

  return (
    <>
      <Card 
        className="group cursor-pointer hover:shadow-lg hover:border-blue-400/40 transition-all duration-200 border-l-4 border-l-blue-500 min-w-0 w-full" 
        data-testid={`card-series-${series.id}`}
        onClick={handleCardClick}
      >
        <CardHeader className="pb-2 p-4 sm:p-6 sm:pb-2">
          <div className="flex justify-between items-start gap-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1.5">
                <Badge 
                  variant="outline" 
                  className="font-mono text-xs text-muted-foreground/60 uppercase tracking-wider hover:text-primary hover:border-primary/40 cursor-pointer transition-colors" 
                  data-testid={`text-project-${series.id}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (series.projectId) setLocation(`/project/${series.projectId}`);
                  }}
                >
                  {project?.name || 'No Project'}
                </Badge>
                {series.status === 'closed' && (
                  <Badge variant="secondary" className="text-xs gap-1" data-testid={`badge-closed-${series.id}`}>
                    <Lock className="h-3 w-3" />
                    Closed
                  </Badge>
                )}
              </div>
              <h3 className="font-semibold text-base leading-snug group-hover:text-primary transition-colors line-clamp-2" data-testid={`text-title-${series.id}`}>
                {series.title}
              </h3>
            </div>
            <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
              <div className="h-7 w-7 rounded-full flex items-center justify-center bg-blue-100 text-blue-600">
                <Repeat className="h-3.5 w-3.5" />
              </div>
              {canEdit && (
                <EntityActionMenu
                  entityType="series"
                  entityName={series.title}
                  onEdit={() => setEditDialogOpen(true)}
                  onDelete={() => deleteMutation.mutate()}
                  isDeleting={deleteMutation.isPending}
                  showDeleteConfirm={showDeleteConfirm}
                  onShowDeleteConfirmChange={setShowDeleteConfirm}
                />
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0 pb-4 px-4 sm:px-6">
          <div className="space-y-1.5 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <Repeat className="h-3.5 w-3.5 text-blue-500 shrink-0" />
              <span className="font-medium text-blue-600" data-testid={`text-recurrence-${series.id}`}>
                {recurrenceLabels[series.recurrenceRule] || series.recurrenceRule}
              </span>
              {occurrenceCount > 0 && (
                <span className="text-xs text-muted-foreground/70">({occurrenceCount} occurrence{occurrenceCount !== 1 ? 's' : ''})</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Clock className="h-3.5 w-3.5 text-primary/60 shrink-0" />
              <span className="truncate" data-testid={`text-time-${series.id}`}>{series.startTime} - {series.endTime}</span>
            </div>
            <div className="flex items-center gap-2">
              <MapPin className="h-3.5 w-3.5 text-primary/60 shrink-0" />
              <span className="truncate" data-testid={`text-location-${series.id}`}>{series.location}</span>
            </div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pt-1 text-xs">
              <div className="flex items-center gap-1.5">
                <MessageSquare className="h-3.5 w-3.5 text-primary/60" />
                <span className="font-medium" data-testid={`text-point-count-${series.id}`}>
                  {pointCount} point{pointCount !== 1 ? 's' : ''}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5 text-primary/60" />
                {attendeeCount !== undefined ? (
                  <span className="font-medium" data-testid={`text-attendee-count-${series.id}`}>
                    {attendeeCount} attendee{attendeeCount !== 1 ? 's' : ''}
                  </span>
                ) : (
                  <span className="h-3.5 w-12 bg-muted/60 rounded animate-pulse" />
                )}
              </div>
              <div className="flex items-center gap-1.5">
                <Monitor className="h-3.5 w-3.5 text-primary/60" />
                <span className="font-medium" data-testid={`text-platform-${series.id}`}>
                  {platformLabel}
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <EditSeriesDialog
        series={series}
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
      />
    </>
  );
}
