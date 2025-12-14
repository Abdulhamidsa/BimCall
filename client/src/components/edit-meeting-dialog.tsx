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
import { meetingsApi, projectsApi } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import type { Meeting } from "@shared/schema";

interface EditMeetingDialogProps {
  meeting: Meeting;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function EditMeetingDialog({ meeting, open, onOpenChange }: EditMeetingDialogProps) {
  const [formData, setFormData] = useState({
    title: "",
    projectId: "",
    project: "",
    date: "",
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
    if (meeting && open) {
      setFormData({
        title: meeting.title || "",
        projectId: meeting.projectId || "",
        project: meeting.project || "",
        date: meeting.date || "",
        startTime: meeting.startTime || "",
        endTime: meeting.endTime || "",
        location: meeting.location || "",
        platform: (meeting.platform as "outlook" | "gmail") || "outlook",
        agenda: meeting.agenda || "",
        meetingLink: meeting.meetingLink || "",
      });
    }
  }, [meeting, open]);

  const updateMutation = useMutation({
    mutationFn: (data: any) => meetingsApi.update(meeting.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["meetings"] });
      queryClient.invalidateQueries({ queryKey: ["meeting", meeting.id] });
      onOpenChange(false);
      toast({
        title: "Meeting Updated",
        description: "Your meeting has been updated successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update meeting. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleProjectChange = (id: string) => {
    setFormData(prev => ({ ...prev, projectId: id }));
    const project = projects.find(p => p.id === id);
    if (project) {
      setFormData(prev => ({ ...prev, project: project.name }));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title || !formData.date || !formData.location) return;
    
    updateMutation.mutate({
      title: formData.title,
      projectId: formData.projectId || null,
      project: formData.project || "Unassigned Project",
      date: formData.date,
      startTime: formData.startTime,
      endTime: formData.endTime,
      location: formData.location,
      platform: formData.platform,
      agenda: formData.agenda || null,
      meetingLink: formData.meetingLink || null,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <DialogHeader>
          <DialogTitle>Edit Meeting</DialogTitle>
          <DialogDescription className="sr-only">
            Edit the meeting details and schedule
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-4">
          <div className="space-y-2">
            <Label htmlFor="title">Meeting Title *</Label>
            <Input
              id="title"
              placeholder="e.g., Weekly Coordination - Tower A"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              required
              data-testid="input-edit-meeting-title"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="project">Project</Label>
            <Select value={formData.projectId} onValueChange={handleProjectChange}>
              <SelectTrigger data-testid="select-edit-project">
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
            {!formData.projectId && (
              <Input
                placeholder="Or enter project name manually"
                value={formData.project}
                onChange={(e) => setFormData({ ...formData, project: e.target.value })}
                className="mt-2"
                data-testid="input-edit-project-name"
              />
            )}
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-2">
              <Label htmlFor="date">Date *</Label>
              <Input
                id="date"
                type="date"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                required
                data-testid="input-edit-date"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="startTime">Start Time *</Label>
              <Input
                id="startTime"
                type="time"
                value={formData.startTime}
                onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                required
                data-testid="input-edit-start-time"
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
                data-testid="input-edit-end-time"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="location">Location *</Label>
              <Input
                id="location"
                placeholder="e.g., Conf Room B / Teams"
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                required
                data-testid="input-edit-location"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="platform">Calendar Platform</Label>
              <Select value={formData.platform} onValueChange={(v: "outlook" | "gmail") => setFormData({ ...formData, platform: v })}>
                <SelectTrigger data-testid="select-edit-platform">
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
              data-testid="input-edit-meeting-link"
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
              data-testid="input-edit-agenda"
            />
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} data-testid="button-cancel-edit">
              Cancel
            </Button>
            <Button type="submit" disabled={updateMutation.isPending} data-testid="button-save-meeting">
              {updateMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
