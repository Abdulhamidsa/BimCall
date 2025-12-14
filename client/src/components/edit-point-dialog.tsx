import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";

// Helper to get dev auth headers
function getDevAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = {};
  const devUserId = localStorage.getItem("dev-user-id");
  const devUserEmail = localStorage.getItem("dev-user-email");
  if (devUserId) headers["x-dev-user-id"] = devUserId;
  if (devUserEmail) headers["x-dev-user-email"] = devUserEmail;
  return headers;
}
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
import { ImagePlus, X } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { pointsApi } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { DisciplineMultiSelect } from "./discipline-multi-select";
import type { Point } from "@shared/schema";

const MAX_IMAGE_WIDTH = 800;
const MAX_IMAGE_HEIGHT = 600;
const IMAGE_QUALITY = 0.85;

function resizeImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
      return;
    }

    const img = new Image();
    const reader = new FileReader();
    
    reader.onloadend = () => {
      img.src = reader.result as string;
    };
    
    img.onload = () => {
      let { width, height } = img;
      
      if (width <= MAX_IMAGE_WIDTH && height <= MAX_IMAGE_HEIGHT) {
        resolve(reader.result as string);
        return;
      }
      
      const aspectRatio = width / height;
      
      if (width > MAX_IMAGE_WIDTH) {
        width = MAX_IMAGE_WIDTH;
        height = width / aspectRatio;
      }
      
      if (height > MAX_IMAGE_HEIGHT) {
        height = MAX_IMAGE_HEIGHT;
        width = height * aspectRatio;
      }
      
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(reader.result as string);
        return;
      }
      
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, width, height);
      
      const resizedDataUrl = canvas.toDataURL(file.type === 'image/png' ? 'image/png' : 'image/jpeg', IMAGE_QUALITY);
      resolve(resizedDataUrl);
    };
    
    img.onerror = () => {
      resolve(reader.result as string);
    };
    
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

interface EditPointDialogProps {
  point: Point;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const statusOptions = [
  { value: "new", label: "New" },
  { value: "open", label: "Open" },
  { value: "closed", label: "Closed" },
  { value: "postponed", label: "Postponed" },
];

export default function EditPointDialog({ point, open, onOpenChange }: EditPointDialogProps) {
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    status: "open",
    assignedTo: "",
    dueDate: "",
    image: "",
  });
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [selectedDisciplines, setSelectedDisciplines] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: pointDisciplines = [] } = useQuery<string[]>({
    queryKey: ["point-disciplines", point?.id],
    queryFn: async () => {
      const response = await fetch(`/api/points/${point.id}/disciplines`, {
        headers: getDevAuthHeaders(),
      });
      if (!response.ok) throw new Error("Failed to fetch disciplines");
      return response.json();
    },
    enabled: !!point?.id && open,
  });

  useEffect(() => {
    if (point && open) {
      setFormData({
        title: point.title || "",
        description: point.description || "",
        status: point.status || "open",
        assignedTo: point.assignedTo || "",
        dueDate: point.dueDate || "",
        image: point.image || "",
      });
      setImagePreview(point.image || null);
    }
  }, [point, open]);

  useEffect(() => {
    if (pointDisciplines) {
      setSelectedDisciplines(pointDisciplines);
    }
  }, [pointDisciplines]);

  const updateMutation = useMutation({
    mutationFn: async (data: any) => {
      const result = await pointsApi.update(point.id, data);
      await fetch(`/api/points/${point.id}/disciplines`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json", ...getDevAuthHeaders() },
        body: JSON.stringify({ disciplines: selectedDisciplines }),
      });
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["points"] });
      queryClient.invalidateQueries({ queryKey: ["meeting-point-counts"] });
      queryClient.invalidateQueries({ queryKey: ["point-disciplines", point.id] });
      onOpenChange(false);
      toast({
        title: "Point Updated",
        description: "Your coordination point has been updated successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update point. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const resizedDataUrl = await resizeImage(file);
        setImagePreview(resizedDataUrl);
        setFormData({ ...formData, image: resizedDataUrl });
      } catch (error) {
        console.error('Error resizing image:', error);
      }
    }
  };

  const handleRemoveImage = () => {
    setImagePreview(null);
    setFormData({ ...formData, image: "" });
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title) return;
    
    updateMutation.mutate({
      title: formData.title,
      description: formData.description || null,
      status: formData.status,
      assignedTo: formData.assignedTo || "Unassigned",
      dueDate: formData.dueDate || "TBD",
      image: formData.image || null,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] flex flex-col p-0" onClick={(e) => e.stopPropagation()}>
        <DialogHeader className="px-6 pt-6 pb-2">
          <DialogTitle>Edit Point</DialogTitle>
          <DialogDescription className="sr-only">
            Edit the details of this coordination point
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="flex-1 px-6 pb-6 overflow-y-auto" style={{ maxHeight: "calc(90vh - 100px)" }}>
          <form onSubmit={handleSubmit} className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label htmlFor="title">Title *</Label>
              <Input
                id="title"
                placeholder="e.g., HVAC duct clash with beam"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                required
                data-testid="input-edit-point-title"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder="Describe the coordination issue..."
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
                data-testid="input-edit-point-description"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Select value={formData.status} onValueChange={(v) => setFormData({ ...formData, status: v })}>
                  <SelectTrigger data-testid="select-edit-point-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {statusOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="assignedTo">Assigned To</Label>
                <Input
                  id="assignedTo"
                  placeholder="e.g., John Doe"
                  value={formData.assignedTo}
                  onChange={(e) => setFormData({ ...formData, assignedTo: e.target.value })}
                  data-testid="input-edit-point-assigned"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="dueDate">Due Date</Label>
              <Input
                id="dueDate"
                type="date"
                value={formData.dueDate}
                onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                data-testid="input-edit-point-due-date"
              />
            </div>

            <div className="space-y-2">
              <Label>Disciplines</Label>
              <DisciplineMultiSelect
                value={selectedDisciplines}
                onChange={setSelectedDisciplines}
                placeholder="Select disciplines (optional)"
              />
            </div>

            <div className="space-y-2">
              <Label>Image</Label>
              <div className="flex gap-3">
                {imagePreview ? (
                  <div className="relative group">
                    <img
                      src={imagePreview}
                      alt="Preview"
                      className="h-24 w-24 object-cover rounded-md border"
                    />
                    <Button
                      type="button"
                      variant="destructive"
                      size="icon"
                      className="absolute -top-2 -right-2 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={handleRemoveImage}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ) : (
                  <Button
                    type="button"
                    variant="outline"
                    className="h-24 w-24 flex flex-col gap-1"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <ImagePlus className="h-6 w-6" />
                    <span className="text-xs">Add Image</span>
                  </Button>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImageSelect}
                  className="hidden"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} data-testid="button-cancel-edit">
                Cancel
              </Button>
              <Button type="submit" disabled={updateMutation.isPending} data-testid="button-save-point">
                {updateMutation.isPending ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </form>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
