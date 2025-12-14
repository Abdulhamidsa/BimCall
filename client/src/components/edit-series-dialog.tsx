import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { meetingSeriesApi, projectsApi } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import type { MeetingSeries } from "@shared/schema";

interface EditSeriesDialogProps {
  series: MeetingSeries;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function EditSeriesDialog({ series, open, onOpenChange }: EditSeriesDialogProps) {
  const [formData, setFormData] = useState({
    title: "",
    projectId: "",
    recurrenceRule: "weekly" as "weekly" | "biweekly" | "monthly",
    startTime: "",
    endTime: "",
    location: "",
    platform: "outlook" as "outlook" | "gmail",
    agenda: "",
    meetingLink: "",
  });

  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: projects = [] } = useQuery({
    queryKey: ["projects-dropdown"],
    queryFn: () => projectsApi.getAll({}),
  });

  useEffect(() => {
    if (series && open) {
      setFormData({
        title: series.title || "",
        projectId: series.projectId || "",
        recurrenceRule: (series.recurrenceRule as "weekly" | "biweekly" | "monthly") || "weekly",
        startTime: series.startTime || "",
        endTime: series.endTime || "",
        location: series.location || "",
        platform: (series.platform as "outlook" | "gmail") || "outlook",
        agenda: series.agenda || "",
        meetingLink: series.meetingLink || "",
      });
    }
  }, [series, open]);

  const updateMutation = useMutation({
    mutationFn: (data: any) => meetingSeriesApi.update(series.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["meeting-series"] });
      queryClient.invalidateQueries({ queryKey: ["meeting-series", series.id] });
      onOpenChange(false);
      toast({
        title: "Series Updated",
        description: "Your meeting series has been updated successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update series. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title || !formData.location) return;
    
    updateMutation.mutate({
      title: formData.title,
      projectId: formData.projectId || null,
      recurrenceRule: formData.recurrenceRule,
      startTime: formData.startTime,
      endTime: formData.endTime,
      location: formData.location,
      platform: formData.platform,
      agenda: formData.agenda || null,
      meetingLink: formData.meetingLink || null,
    });
  };

  const recurrenceLabels = {
    weekly: "Weekly",
    biweekly: "Every 2 weeks",
    monthly: "Monthly",
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <DialogHeader>
          <DialogTitle>Edit Meeting Series</DialogTitle>
          <DialogDescription className="sr-only">
            Edit the recurring meeting series details
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-4">
          <div className="space-y-2">
            <Label htmlFor="title">Series Title *</Label>
            <Input
              id="title"
              placeholder="e.g., Weekly BIM Coordination"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              required
              data-testid="input-edit-series-title"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="project">Project</Label>
            <Select value={formData.projectId} onValueChange={(v) => setFormData({ ...formData, projectId: v })}>
              <SelectTrigger data-testid="select-edit-series-project">
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

          <div className="space-y-2">
            <Label htmlFor="recurrence">Recurrence Pattern</Label>
            <Select value={formData.recurrenceRule} onValueChange={(v: "weekly" | "biweekly" | "monthly") => setFormData({ ...formData, recurrenceRule: v })}>
              <SelectTrigger data-testid="select-edit-recurrence">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="weekly">Weekly</SelectItem>
                <SelectItem value="biweekly">Every 2 weeks</SelectItem>
                <SelectItem value="monthly">Monthly</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="startTime">Start Time *</Label>
              <Input
                id="startTime"
                type="time"
                value={formData.startTime}
                onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                required
                data-testid="input-edit-series-start-time"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="endTime">End Time *</Label>
              <Input
                id="endTime"
                type="time"
                value={formData.endTime}
                onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                required
                data-testid="input-edit-series-end-time"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="location">Location *</Label>
              <Input
                id="location"
                placeholder="e.g., BIM Room / Teams"
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                required
                data-testid="input-edit-series-location"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="platform">Calendar Platform</Label>
              <Select value={formData.platform} onValueChange={(v: "outlook" | "gmail") => setFormData({ ...formData, platform: v })}>
                <SelectTrigger data-testid="select-edit-series-platform">
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
            <Label htmlFor="meetingLink">Meeting Link</Label>
            <Input
              id="meetingLink"
              placeholder="e.g., https://teams.microsoft.com/l/meetup-join/..."
              value={formData.meetingLink}
              onChange={(e) => setFormData({ ...formData, meetingLink: e.target.value })}
              data-testid="input-edit-series-meeting-link"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="agenda">Agenda</Label>
            <Textarea
              id="agenda"
              placeholder="Enter meeting agenda items..."
              value={formData.agenda}
              onChange={(e) => setFormData({ ...formData, agenda: e.target.value })}
              rows={3}
              data-testid="input-edit-series-agenda"
            />
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} data-testid="button-cancel-edit">
              Cancel
            </Button>
            <Button type="submit" disabled={updateMutation.isPending} data-testid="button-save-series">
              {updateMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
