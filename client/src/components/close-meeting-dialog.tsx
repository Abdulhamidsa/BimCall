import { useState, useEffect, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SelectGroup,
  SelectLabel,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { AlertCircle, CheckCircle2, Lock, Loader2, Calendar, Repeat } from "lucide-react";
import { format } from "date-fns";

function getDevAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = {};
  const devUserId = localStorage.getItem("dev-user-id");
  const devUserEmail = localStorage.getItem("dev-user-email");
  if (devUserId) headers["x-dev-user-id"] = devUserId;
  if (devUserEmail) headers["x-dev-user-email"] = devUserEmail;
  return headers;
}

interface Meeting {
  id: string;
  title: string;
  date: string;
  project?: string;
  projectId?: string | null;
  status?: string;
}

interface MeetingSeries {
  id: string;
  title: string;
  projectId?: string | null;
  status?: string;
  recurrenceRule?: string;
}

interface Point {
  id: string;
  title: string;
  status: string;
}

interface CloseMeetingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  meeting?: Meeting;
  series?: MeetingSeries;
  openPoints: Point[];
  type: 'meeting' | 'series';
  onClosed?: () => void;
}

type TargetSelection = {
  id: string;
  type: 'meeting' | 'series';
};

export default function CloseMeetingDialog({
  open,
  onOpenChange,
  meeting,
  series,
  openPoints,
  type,
  onClosed,
}: CloseMeetingDialogProps) {
  const [mode, setMode] = useState<'move' | 'close'>('close');
  const [target, setTarget] = useState<TargetSelection | null>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const entity = type === 'meeting' ? meeting : series;
  const entityId = entity?.id;
  const projectId = type === 'meeting' ? meeting?.projectId : series?.projectId;

  // Fetch both open meetings and open series for the project
  const { data: openMeetings = [] } = useQuery<Meeting[]>({
    queryKey: ['open-meetings', projectId, entityId],
    queryFn: async () => {
      if (!projectId) return [];
      const excludeParam = type === 'meeting' ? `?exclude=${entityId}` : '';
      const response = await fetch(`/api/projects/${projectId}/open-meetings${excludeParam}`, {
        headers: getDevAuthHeaders(),
      });
      if (!response.ok) throw new Error('Failed to fetch meetings');
      return response.json();
    },
    enabled: open && !!projectId,
  });

  const { data: openSeries = [] } = useQuery<MeetingSeries[]>({
    queryKey: ['open-series', projectId, entityId],
    queryFn: async () => {
      if (!projectId) return [];
      const excludeParam = type === 'series' ? `?exclude=${entityId}` : '';
      const response = await fetch(`/api/projects/${projectId}/open-series${excludeParam}`, {
        headers: getDevAuthHeaders(),
      });
      if (!response.ok) throw new Error('Failed to fetch series');
      return response.json();
    },
    enabled: open && !!projectId,
  });

  // Combine available targets
  const hasTargets = openMeetings.length > 0 || openSeries.length > 0;

  useEffect(() => {
    if (open) {
      setMode(openPoints.length > 0 ? 'close' : 'close');
      setTarget(null);
    }
  }, [open, openPoints.length]);

  const closeMutation = useMutation({
    mutationFn: async () => {
      const endpoint = type === 'meeting'
        ? `/api/meetings/${entityId}/close`
        : `/api/meeting-series/${entityId}/close`;
      
      let body: any = { mode };
      
      if (mode === 'move' && target) {
        if (target.type === 'meeting') {
          body.targetMeetingId = target.id;
        } else {
          body.targetSeriesId = target.id;
        }
      }
      
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getDevAuthHeaders(),
        },
        body: JSON.stringify(body),
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to close');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meetings'] });
      queryClient.invalidateQueries({ queryKey: ['meeting-series'] });
      if (entityId) {
        queryClient.invalidateQueries({ queryKey: type === 'meeting' ? ['meeting', entityId] : ['meeting-series', entityId] });
      }
      if (target) {
        queryClient.invalidateQueries({ queryKey: target.type === 'meeting' ? ['meeting', target.id] : ['meeting-series', target.id] });
        queryClient.invalidateQueries({ queryKey: ['points'] });
      }
      queryClient.invalidateQueries({ queryKey: ['points'] });
      
      toast({
        title: type === 'meeting' ? "Meeting Closed" : "Series Closed",
        description: mode === 'move' && openPoints.length > 0 && target
          ? `${openPoints.length} open point(s) moved to the target ${target.type}.`
          : `${type === 'meeting' ? 'Meeting' : 'Series'} closed successfully.`,
      });
      
      onOpenChange(false);
      onClosed?.();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || `Failed to close ${type}.`,
        variant: "destructive",
      });
    },
  });

  const handleClose = () => {
    if (mode === 'move' && openPoints.length > 0 && !target) {
      toast({
        title: "Select Target",
        description: "Please select a target meeting or series to move the open points to.",
        variant: "destructive",
      });
      return;
    }
    closeMutation.mutate();
  };

  const handleTargetChange = (value: string) => {
    // Value format: "meeting:id" or "series:id"
    const [targetType, id] = value.split(':');
    setTarget({ type: targetType as 'meeting' | 'series', id });
  };

  const currentTargetValue = target ? `${target.type}:${target.id}` : '';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5 text-orange-500" />
            Close {type === 'meeting' ? 'Meeting' : 'Series'}
          </DialogTitle>
          <DialogDescription>
            {type === 'meeting' && meeting && (
              <>Close "{meeting.title}" from {meeting.date}</>
            )}
            {type === 'series' && series && (
              <>Close recurring series "{series.title}"</>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 space-y-4">
          {openPoints.length > 0 ? (
            <>
              <div className="flex items-center gap-2 p-3 bg-amber-50 dark:bg-amber-950/30 rounded-lg border border-amber-200 dark:border-amber-800">
                <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0" />
                <div className="text-sm">
                  <span className="font-medium text-amber-800 dark:text-amber-300">
                    {openPoints.length} open point{openPoints.length !== 1 ? 's' : ''}
                  </span>
                  <span className="text-amber-700 dark:text-amber-400"> will be affected</span>
                </div>
              </div>

              <RadioGroup value={mode} onValueChange={(v) => setMode(v as 'move' | 'close')}>
                <div className={`flex items-start space-x-3 p-3 rounded-lg border ${mode === 'move' ? 'border-primary bg-primary/5' : 'border-border'}`}>
                  <RadioGroupItem value="move" id="move" className="mt-0.5" disabled={!hasTargets} />
                  <div className="flex-1">
                    <Label htmlFor="move" className={`font-medium cursor-pointer ${!hasTargets ? 'text-muted-foreground' : ''}`}>
                      Move open points to another meeting or series
                    </Label>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      {hasTargets 
                        ? 'Points will be transferred and remain open for follow-up'
                        : 'No other open meetings or series available in this project'
                      }
                    </p>
                    
                    {mode === 'move' && hasTargets && (
                      <div className="mt-3">
                        <Select value={currentTargetValue} onValueChange={handleTargetChange}>
                          <SelectTrigger data-testid="select-target">
                            <SelectValue placeholder="Select target meeting or series..." />
                          </SelectTrigger>
                          <SelectContent>
                            {openMeetings.length > 0 && (
                              <SelectGroup>
                                <SelectLabel className="flex items-center gap-1.5">
                                  <Calendar className="h-3 w-3" />
                                  Meetings
                                </SelectLabel>
                                {openMeetings.map((m) => (
                                  <SelectItem key={`meeting:${m.id}`} value={`meeting:${m.id}`}>
                                    <div className="flex items-center gap-2">
                                      <Calendar className="h-3 w-3 text-muted-foreground" />
                                      <span>{m.title}</span>
                                      {m.date && (
                                        <Badge variant="outline" className="text-xs">
                                          {format(new Date(m.date), 'MMM d')}
                                        </Badge>
                                      )}
                                    </div>
                                  </SelectItem>
                                ))}
                              </SelectGroup>
                            )}
                            {openSeries.length > 0 && (
                              <SelectGroup>
                                <SelectLabel className="flex items-center gap-1.5">
                                  <Repeat className="h-3 w-3" />
                                  Series
                                </SelectLabel>
                                {openSeries.map((s) => (
                                  <SelectItem key={`series:${s.id}`} value={`series:${s.id}`}>
                                    <div className="flex items-center gap-2">
                                      <Repeat className="h-3 w-3 text-muted-foreground" />
                                      <span>{s.title}</span>
                                      {s.recurrenceRule && (
                                        <Badge variant="outline" className="text-xs capitalize">
                                          {s.recurrenceRule}
                                        </Badge>
                                      )}
                                    </div>
                                  </SelectItem>
                                ))}
                              </SelectGroup>
                            )}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>
                </div>

                <div className={`flex items-start space-x-3 p-3 rounded-lg border ${mode === 'close' ? 'border-primary bg-primary/5' : 'border-border'}`}>
                  <RadioGroupItem value="close" id="close" className="mt-0.5" />
                  <div className="flex-1">
                    <Label htmlFor="close" className="font-medium cursor-pointer">
                      Close all open points with the {type}
                    </Label>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      All {openPoints.length} point{openPoints.length !== 1 ? 's' : ''} will be marked as closed
                    </p>
                  </div>
                </div>
              </RadioGroup>
            </>
          ) : (
            <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-950/30 rounded-lg border border-green-200 dark:border-green-800">
              <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0" />
              <div className="text-sm text-green-800 dark:text-green-300">
                No open points. Ready to close.
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleClose} 
            disabled={closeMutation.isPending || (mode === 'move' && openPoints.length > 0 && !target)}
            data-testid="button-confirm-close"
          >
            {closeMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Closing...
              </>
            ) : (
              <>
                <Lock className="h-4 w-4 mr-2" />
                Close {type === 'meeting' ? 'Meeting' : 'Series'}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
