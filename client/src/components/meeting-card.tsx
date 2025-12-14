import { useState } from "react";
import type { Meeting } from "@shared/schema";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CalendarDays, Clock, MapPin, MessageSquare, Users, Monitor, Lock } from "lucide-react";
import { useLocation } from "wouter";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { meetingsApi } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/auth-context";
import EntityActionMenu from "./entity-action-menu";
import EditMeetingDialog from "./edit-meeting-dialog";

interface MeetingCardProps {
  meeting: Meeting;
  pointCount?: number;
  attendeeCount?: number;
}

export default function MeetingCard({ meeting, pointCount = 0, attendeeCount }: MeetingCardProps) {
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { permissions } = useAuth();
  
  const canEdit = permissions?.canEditMeetings ?? false;

  const deleteMutation = useMutation({
    mutationFn: () => meetingsApi.delete(meeting.id),
    onSuccess: () => {
      setShowDeleteConfirm(false);
      queryClient.invalidateQueries({ queryKey: ["meetings"] });
      toast({
        title: "Meeting Deleted",
        description: "The meeting has been deleted successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete meeting. Please try again.",
        variant: "destructive",
      });
    },
  });

  const platformLabel = meeting.platform === 'outlook' ? 'Outlook' : 'Gmail';

  const handleCardClick = () => {
    setLocation(`/meeting/${meeting.id}`);
  };

  return (
    <>
      <Card 
        className="group cursor-pointer hover:shadow-lg hover:border-primary/40 transition-all duration-200 border-l-4 border-l-primary min-w-0 w-full" 
        data-testid={`card-meeting-${meeting.id}`}
        onClick={handleCardClick}
      >
        <CardHeader className="pb-2 p-4 sm:p-6 sm:pb-2">
          <div className="flex justify-between items-start gap-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1.5">
                <Badge 
                  variant="outline" 
                  className="font-mono text-xs text-muted-foreground/60 uppercase tracking-wider hover:text-primary hover:border-primary/40 cursor-pointer transition-colors" 
                  data-testid={`text-project-${meeting.id}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (meeting.projectId) setLocation(`/project/${meeting.projectId}`);
                  }}
                >
                  {meeting.project}
                </Badge>
                {meeting.status === 'closed' && (
                  <Badge variant="secondary" className="text-xs gap-1" data-testid={`badge-closed-${meeting.id}`}>
                    <Lock className="h-3 w-3" />
                    Closed
                  </Badge>
                )}
              </div>
              <h3 className="font-semibold text-base leading-snug group-hover:text-primary transition-colors line-clamp-2" data-testid={`text-title-${meeting.id}`}>
                {meeting.title}
              </h3>
            </div>
            {canEdit && (
              <div className="flex items-center shrink-0" onClick={(e) => e.stopPropagation()}>
                <EntityActionMenu
                  entityType="meeting"
                  entityName={meeting.title}
                  onEdit={() => setEditDialogOpen(true)}
                  onDelete={() => deleteMutation.mutate()}
                  isDeleting={deleteMutation.isPending}
                  showDeleteConfirm={showDeleteConfirm}
                  onShowDeleteConfirmChange={setShowDeleteConfirm}
                />
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent className="pt-0 pb-4 px-4 sm:px-6">
          <div className="space-y-1.5 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <CalendarDays className="h-3.5 w-3.5 text-primary/60 shrink-0" />
              <span className="truncate" data-testid={`text-date-${meeting.id}`}>{meeting.date}</span>
              <span className="text-muted-foreground/50">•</span>
              <Clock className="h-3.5 w-3.5 text-primary/60 shrink-0" />
              <span className="truncate" data-testid={`text-time-${meeting.id}`}>{meeting.startTime} - {meeting.endTime}</span>
            </div>
            <div className="flex items-center gap-2">
              <MapPin className="h-3.5 w-3.5 text-primary/60 shrink-0" />
              <span className="truncate" data-testid={`text-location-${meeting.id}`}>{meeting.location}</span>
            </div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pt-1 text-xs">
              <div className="flex items-center gap-1.5">
                <MessageSquare className="h-3.5 w-3.5 text-primary/60" />
                <span className="font-medium" data-testid={`text-point-count-${meeting.id}`}>
                  {pointCount} point{pointCount !== 1 ? 's' : ''}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5 text-primary/60" />
                {attendeeCount !== undefined ? (
                  <span className="font-medium" data-testid={`text-attendee-count-${meeting.id}`}>
                    {attendeeCount} attendee{attendeeCount !== 1 ? 's' : ''}
                  </span>
                ) : (
                  <span className="h-3.5 w-12 bg-muted/60 rounded animate-pulse" />
                )}
              </div>
              <div className="flex items-center gap-1.5">
                <Monitor className="h-3.5 w-3.5 text-primary/60" />
                <span className="font-medium" data-testid={`text-platform-${meeting.id}`}>
                  {platformLabel}
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <EditMeetingDialog
        meeting={meeting}
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
      />
    </>
  );
}
