import type { PointWithRelations, Status } from "@/lib/types";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import jsPDF from "jspdf";

// Helper to get dev auth headers
function getDevAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = {};
  const devUserId = localStorage.getItem("dev-user-id");
  const devUserEmail = localStorage.getItem("dev-user-email");
  if (devUserId) headers["x-dev-user-id"] = devUserId;
  if (devUserEmail) headers["x-dev-user-email"] = devUserEmail;
  return headers;
}
import { Button } from "@/components/ui/button";
import { 
  Paperclip, 
  MessageSquare, 
  MoreVertical, 
  Calendar as CalendarIcon,
  User,
  FileText,
  History,
  Download,
  Pencil,
  Save,
  X,
  ImagePlus,
  File,
  Upload,
  Plus,
  Trash2,
  CircleDot,
  CircleCheck,
  Clock,
  CirclePause,
  CirclePlus
} from "lucide-react";
import { DisciplineBadges } from "./discipline-multi-select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useState, useRef } from "react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { pointsApi } from "@/lib/api";
import EditPointDialog from "./edit-point-dialog";

interface UploadedFile {
  name: string;
  type: string;
  size: string;
  dataUrl: string;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

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

function getFileIcon(type: string) {
  if (type.startsWith('image/')) return ImagePlus;
  if (type === 'application/pdf') return FileText;
  return File;
}

interface Attendee {
  id: string;
  name: string;
  email?: string | null;
  company?: string | null;
}

interface PointCardProps {
  point: PointWithRelations;
  onStatusChange: (id: string, status: Status) => void;
  onAddComment: (id: string, update: { date: string; status: string; actionOn: string }) => void;
  attendees?: Attendee[];
}

const statusConfig: Record<string, { label: string, className: string }> = {
  new: { label: "New", className: "status-badge-new" },
  open: { label: "Open", className: "status-badge-open" },
  closed: { label: "Closed", className: "status-badge-closed" },
  postponed: { label: "Postponed", className: "status-badge-postponed" },
};

const statusIcons: Record<string, React.ElementType> = {
  open: CirclePlus,
  new: CircleDot,
  closed: CircleCheck,
  postponed: CirclePause,
};

const statusColors: Record<string, string> = {
  open: "text-green-600 bg-green-500/25 hover:bg-green-500/35",
  new: "text-blue-600 bg-blue-500/25 hover:bg-blue-500/35",
  closed: "text-slate-600 bg-slate-500/25 hover:bg-slate-500/35",
  postponed: "text-red-600 bg-red-500/25 hover:bg-red-500/35",
};

export default function PointCard({ point, onStatusChange, onAddComment, attendees = [] }: PointCardProps) {
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isAddingComment, setIsAddingComment] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isImageExpanded, setIsImageExpanded] = useState(false);
  const [newCommentDate, setNewCommentDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [newCommentText, setNewCommentText] = useState("");
  // Default to most recent status update's actionOn
  const getDefaultActionOn = () => {
    if (point.statusUpdates.length > 0) {
      const sorted = [...point.statusUpdates].sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
      );
      return sorted[0].actionOn || "";
    }
    return "";
  };
  const [newActionOn, setNewActionOn] = useState(getDefaultActionOn);
  const [pendingFiles, setPendingFiles] = useState<UploadedFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isEditingDescription, setIsEditingDescription] = useState(false);
  const [editedDescription, setEditedDescription] = useState(point.description || "");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: pointDisciplines = [] } = useQuery<string[]>({
    queryKey: ["point-disciplines", point.id],
    queryFn: async () => {
      const response = await fetch(`/api/points/${point.id}/disciplines`, {
        headers: getDevAuthHeaders(),
      });
      if (!response.ok) return [];
      return response.json();
    },
    staleTime: 60000,
    enabled: !!point.id,
    retry: false,
  });

  const deleteMutation = useMutation({
    mutationFn: () => pointsApi.delete(point.id),
    onSuccess: () => {
      setShowDeleteDialog(false);
      queryClient.invalidateQueries({ queryKey: ["points"] });
      queryClient.invalidateQueries({ queryKey: ["meeting-point-counts"] });
      toast({
        title: "Point Deleted",
        description: "The coordination point has been deleted successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete point. Please try again.",
        variant: "destructive",
      });
    },
  });

  const updateDescriptionMutation = useMutation({
    mutationFn: (description: string) => pointsApi.update(point.id, { description }),
    onSuccess: () => {
      setIsEditingDescription(false);
      queryClient.invalidateQueries({ queryKey: ["points"] });
      toast({
        title: "Description Updated",
        description: "The point description has been updated successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update description. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleSaveDescription = () => {
    updateDescriptionMutation.mutate(editedDescription);
  };

  const handleCancelDescriptionEdit = () => {
    setEditedDescription(point.description || "");
    setIsEditingDescription(false);
  };

  // Get the latest update
  const latestUpdate = point.statusUpdates.length > 0 
    ? point.statusUpdates[point.statusUpdates.length - 1] 
    : null;

  const handleSaveComment = () => {
    if (!newCommentText.trim()) return;

    const update = {
      date: newCommentDate,
      status: newCommentText,
      actionOn: newActionOn || "Unassigned"
    };

    onAddComment(point.id, update);
    setIsAddingComment(false);
    setNewCommentText("");
    setNewActionOn("");
    
    toast({
      title: "Status Updated",
      description: "New status comment has been added to the history.",
    });
  };

  const handleExportHistory = async () => {
    try {
      const pdf = new jsPDF();
      const pageWidth = pdf.internal.pageSize.getWidth();
      const margin = 15;
      let yPos = 20;
      
      // Title
      pdf.setFontSize(18);
      pdf.setFont("helvetica", "bold");
      pdf.text(`Point: ${point.title}`, margin, yPos);
      yPos += 10;
      
      // Add image if exists
      if (point.image) {
        try {
          const imgWidth = pageWidth - (margin * 2);
          const imgHeight = imgWidth * 0.75; // 4:3 aspect ratio
          pdf.addImage(point.image, "JPEG", margin, yPos, imgWidth, imgHeight);
          yPos += imgHeight + 10;
        } catch (imgError) {
          console.error("Error adding image to PDF:", imgError);
        }
      }
      
      // Point Details Section
      pdf.setFontSize(14);
      pdf.setFont("helvetica", "bold");
      pdf.text("Point Details", margin, yPos);
      yPos += 8;
      
      pdf.setFontSize(10);
      pdf.setFont("helvetica", "normal");
      
      const details = [
        { label: "ID", value: point.id },
        { label: "Status", value: statusConfig[point.status]?.label || point.status },
        { label: "Due Date", value: point.dueDate || "Not set" },
        { label: "Assigned To", value: point.assignedTo || "Unassigned" },
      ];
      
      details.forEach(({ label, value }) => {
        pdf.setFont("helvetica", "bold");
        pdf.text(`${label}: `, margin, yPos);
        pdf.setFont("helvetica", "normal");
        pdf.text(String(value), margin + 30, yPos);
        yPos += 6;
      });
      yPos += 5;
      
      // Description
      pdf.setFontSize(14);
      pdf.setFont("helvetica", "bold");
      pdf.text("Description", margin, yPos);
      yPos += 8;
      
      pdf.setFontSize(10);
      pdf.setFont("helvetica", "normal");
      const description = point.description || "No description";
      const descLines = pdf.splitTextToSize(description, pageWidth - (margin * 2));
      descLines.forEach((line: string) => {
        if (yPos > 270) {
          pdf.addPage();
          yPos = 20;
        }
        pdf.text(line, margin, yPos);
        yPos += 5;
      });
      yPos += 10;
      
      // Attachments
      if (point.attachments.length > 0) {
        if (yPos > 250) {
          pdf.addPage();
          yPos = 20;
        }
        pdf.setFontSize(14);
        pdf.setFont("helvetica", "bold");
        pdf.text("Attachments", margin, yPos);
        yPos += 8;
        
        pdf.setFontSize(10);
        pdf.setFont("helvetica", "normal");
        point.attachments.forEach((att) => {
          if (yPos > 270) {
            pdf.addPage();
            yPos = 20;
          }
          pdf.text(`• ${att.name} (${att.size})`, margin, yPos);
          yPos += 5;
        });
        yPos += 10;
      }
      
      // Status Updates / History
      if (point.statusUpdates.length > 0) {
        if (yPos > 240) {
          pdf.addPage();
          yPos = 20;
        }
        pdf.setFontSize(14);
        pdf.setFont("helvetica", "bold");
        pdf.text("Status Log", margin, yPos);
        yPos += 8;
        
        const sortedUpdates = [...point.statusUpdates].sort(
          (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
        );
        
        sortedUpdates.forEach((update) => {
          if (yPos > 260) {
            pdf.addPage();
            yPos = 20;
          }
          pdf.setFontSize(10);
          pdf.setFont("helvetica", "bold");
          pdf.text(`${update.date} - Action on: ${update.actionOn}`, margin, yPos);
          yPos += 5;
          
          pdf.setFont("helvetica", "normal");
          const statusLines = pdf.splitTextToSize(update.status, pageWidth - (margin * 2));
          statusLines.forEach((line: string) => {
            if (yPos > 270) {
              pdf.addPage();
              yPos = 20;
            }
            pdf.text(line, margin, yPos);
            yPos += 5;
          });
          yPos += 5;
        });
      }
      
      // Footer
      const pageCount = pdf.internal.pages.length - 1;
      for (let i = 1; i <= pageCount; i++) {
        pdf.setPage(i);
        pdf.setFontSize(8);
        pdf.setFont("helvetica", "normal");
        pdf.text(
          `Generated on ${format(new Date(), "yyyy-MM-dd HH:mm")} | Page ${i} of ${pageCount}`,
          margin,
          pdf.internal.pageSize.getHeight() - 10
        );
      }
      
      // Save the PDF
      pdf.save(`Point_${point.id}_History.pdf`);
      
      toast({
        title: "Export Successful",
        description: `Point history exported as PDF`,
      });
    } catch (error) {
      console.error("Error exporting PDF:", error);
      toast({
        title: "Export Failed",
        description: "Could not generate PDF. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    
    for (const file of Array.from(files)) {
      try {
        const dataUrl = await resizeImage(file);
        setPendingFiles(prev => [...prev, {
          name: file.name,
          type: file.type,
          size: formatFileSize(file.size),
          dataUrl,
        }]);
      } catch (error) {
        console.error('Error processing file:', error);
      }
    }
    
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleRemovePendingFile = (index: number) => {
    setPendingFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleUploadAttachments = async () => {
    if (pendingFiles.length === 0) return;
    
    setIsUploading(true);
    try {
      await Promise.all(
        pendingFiles.map(file =>
          fetch('/api/attachments', {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              pointId: point.id,
              name: file.name,
              type: file.type.startsWith('image/') ? 'img' : 
                    file.type === 'application/pdf' ? 'pdf' : 
                    file.type.includes('dwg') ? 'dwg' : 'doc',
              size: file.size,
              url: file.dataUrl,
            }),
          })
        )
      );
      
      // Invalidate queries to refresh the point data
      queryClient.invalidateQueries({ queryKey: ["points"] });
      
      toast({
        title: "Attachments Uploaded",
        description: `${pendingFiles.length} file(s) have been attached to this point.`,
      });
      
      setPendingFiles([]);
    } catch (error) {
      toast({
        title: "Upload Failed",
        description: "Failed to upload attachments. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <>
      <Card className="flex flex-col overflow-hidden border hover:border-primary/50 transition-colors group w-full md:flex-row md:items-stretch">
        {/* Image Section - Click to open history */}
        <div 
          className="relative w-full h-20 sm:h-24 md:w-28 lg:w-32 md:h-auto md:min-h-[100px] shrink-0 bg-muted overflow-hidden group-hover:opacity-90 transition-opacity cursor-pointer"
          onClick={() => setIsHistoryOpen(true)}
        >
          {point.image ? (
            <img 
              src={point.image} 
              alt={point.title}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-muted-foreground">
              <FileText className="h-8 w-8 sm:h-10 sm:w-10" />
            </div>
          )}
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
            <Button variant="secondary" size="sm" className="bg-white/90 text-black hover:bg-white text-[10px] sm:text-xs px-2 py-1">
              View
            </Button>
          </div>
        </div>

        {/* Content Section */}
        <div className="flex-1 p-3 sm:p-4 flex flex-col gap-2 sm:gap-3 min-w-0 overflow-hidden">
          <div className="flex justify-between items-start gap-1 sm:gap-2">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1 sm:gap-2 mb-1 flex-wrap">
                <span className="font-mono-tech text-[10px] sm:text-xs text-muted-foreground bg-muted px-1 sm:px-1.5 py-0.5 rounded">
                  #{point.id.slice(0, 5)}
                </span>
                {pointDisciplines.length > 0 && (
                  <DisciplineBadges codes={pointDisciplines} maxDisplay={2} size="sm" />
                )}
                <Badge variant="outline" className={cn("font-normal text-[10px] sm:text-xs capitalize", statusConfig[point.status as Status]?.className)}>
                  {statusConfig[point.status as Status]?.label}
                </Badge>
              </div>
              <h3 className="font-medium text-sm sm:text-base leading-snug cursor-pointer hover:text-primary transition-colors line-clamp-2 sm:line-clamp-1 break-words" onClick={() => setIsHistoryOpen(true)}>
                {point.title}
              </h3>
            </div>
            
            <div className="flex items-center gap-0.5 sm:gap-1 shrink-0">
              <TooltipProvider delayDuration={100}>
                <div className="flex gap-0.5 p-0.5 bg-muted/50 rounded-md overflow-x-auto max-w-full">
                  {(Object.keys(statusConfig) as Status[]).map((s) => {
                    const Icon = statusIcons[s];
                    const isActive = point.status === s;
                    return (
                      <Tooltip key={s}>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className={cn(
                              "h-5 w-5 sm:h-6 sm:w-6 rounded-sm",
                              isActive ? `${statusColors[s]} bg-opacity-20` : "text-muted-foreground hover:text-foreground"
                            )}
                            onClick={() => onStatusChange(point.id, s)}
                            data-testid={`button-status-${s}-${point.id}`}
                          >
                            <Icon className={cn("h-3 w-3 sm:h-4 sm:w-4", isActive && statusColors[s].split(" ")[0])} />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="text-xs">
                          {statusConfig[s].label}
                        </TooltipContent>
                      </Tooltip>
                    );
                  })}
                </div>
              </TooltipProvider>
              
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-6 w-6 sm:h-8 sm:w-8">
                    <MoreVertical className="h-3 w-3 sm:h-4 sm:w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => setIsEditDialogOpen(true)} data-testid={`button-edit-point-${point.id}`}>
                    <Pencil className="mr-2 h-4 w-4" />
                    Edit Point
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => setShowDeleteDialog(true)}
                    className="text-destructive focus:text-destructive"
                    data-testid={`button-delete-point-${point.id}`}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete Point
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          <p className="text-xs sm:text-sm text-muted-foreground line-clamp-2 sm:line-clamp-3 md:line-clamp-4 break-anywhere overflow-hidden" title={point.description || ""}>
            {point.description}
          </p>

          {/* Latest Status Update Preview */}
          {latestUpdate && !isAddingComment && (
            <div className="bg-muted/30 border-l-2 border-primary/50 p-1.5 sm:p-2 rounded-r text-[10px] sm:text-xs space-y-1 group/update relative">
              <div className="flex flex-wrap justify-between text-muted-foreground font-mono-tech text-[9px] sm:text-[10px] uppercase gap-1">
                <span>{latestUpdate.date}</span>
                <div className="flex items-center gap-1 sm:gap-2">
                  <span className="hidden sm:inline">Action: <span className="font-medium text-foreground">{latestUpdate.actionOn}</span></span>
                  <span className="sm:hidden font-medium text-foreground">{latestUpdate.actionOn}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-4 w-4 sm:h-5 sm:w-5 opacity-0 group-hover/update:opacity-100 transition-opacity"
                    onClick={() => setIsAddingComment(true)}
                    data-testid={`button-add-update-${point.id}`}
                  >
                    <Pencil className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
                  </Button>
                </div>
              </div>
              <p className="text-foreground/90 line-clamp-2 text-[10px] sm:text-xs break-anywhere overflow-hidden">{latestUpdate.status}</p>
            </div>
          )}
          
          {/* Show add update button when no updates exist */}
          {!latestUpdate && !isAddingComment && (
            <Button
              variant="outline"
              size="sm"
              className="h-6 sm:h-7 text-[10px] sm:text-xs"
              onClick={() => setIsAddingComment(true)}
              data-testid={`button-first-update-${point.id}`}
            >
              <Plus className="h-2.5 w-2.5 sm:h-3 sm:w-3 mr-1" /> Add Status Update
            </Button>
          )}

          {/* Quick Add Comment Area */}
          {isAddingComment && (
             <div className="bg-muted/50 p-3 rounded border space-y-3 animate-in slide-in-from-top-2 fade-in duration-200">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-medium">New Status Update</span>
                  <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => setIsAddingComment(false)}>
                    <X className="h-3 w-3" />
                  </Button>
                </div>
                
                <div className="grid grid-cols-2 gap-2">
                   <Input 
                      type="date" 
                      className="h-8 text-xs bg-background"
                      value={newCommentDate}
                      onChange={(e) => setNewCommentDate(e.target.value)}
                   />
                   <Select value={newActionOn} onValueChange={setNewActionOn}>
                      <SelectTrigger className="h-8 text-xs bg-background">
                        <SelectValue placeholder="Action on..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Unassigned">Unassigned</SelectItem>
                        {attendees.map((att) => (
                          <SelectItem key={att.id} value={att.name}>{att.name}</SelectItem>
                        ))}
                      </SelectContent>
                   </Select>
                </div>
                
                <Textarea 
                  placeholder="Enter status update..." 
                  className="text-xs min-h-[60px] bg-background resize-none"
                  value={newCommentText}
                  onChange={(e) => setNewCommentText(e.target.value)}
                />
                
                <div className="flex justify-end">
                  <Button size="sm" className="h-7 text-xs" onClick={handleSaveComment}>
                    <Save className="mr-1.5 h-3 w-3" /> Save Update
                  </Button>
                </div>
             </div>
          )}

          {/* Attachments Preview */}
          {point.attachments.length > 0 && (
            <div className="flex gap-1.5 sm:gap-2 flex-wrap mt-auto pt-1.5 sm:pt-2">
              {point.attachments.map(att => (
                <div key={att.id} className="flex items-center gap-1 sm:gap-1.5 bg-muted/50 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded text-[10px] sm:text-xs text-muted-foreground border">
                  <FileText className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
                  <span className="max-w-[60px] sm:max-w-[100px] truncate">{att.name}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </Card>

      {/* History Dialog */}
      <Dialog open={isHistoryOpen} onOpenChange={setIsHistoryOpen}>
        <DialogContent className="w-[95vw] max-w-5xl max-h-[90vh] sm:max-h-[85vh] flex flex-col p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle className="text-sm sm:text-base line-clamp-1">
              History: {point.title}
            </DialogTitle>
          </DialogHeader>
          
          <div className="flex-1 overflow-y-auto pr-1 sm:pr-2 space-y-4 sm:space-y-6 py-2 sm:py-4">
            <div className="flex flex-col md:flex-row gap-6">
              <div className="w-full md:w-2/5 shrink-0">
                {point.image && (
                  <img 
                    src={point.image} 
                    alt={point.title} 
                    className="rounded-md w-full object-cover aspect-[4/3] border mb-4 cursor-pointer hover:opacity-90 transition-opacity" 
                    onClick={() => setIsImageExpanded(true)}
                    data-testid={`img-point-${point.id}`}
                  />
                )}
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between py-1 border-b">
                    <span className="text-muted-foreground">ID</span>
                    <span className="font-mono">{point.id}</span>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b">
                    <span className="text-muted-foreground">Status</span>
                    <Select 
                      value={point.status} 
                      onValueChange={(v) => onStatusChange(point.id, v as Status)}
                    >
                      <SelectTrigger className="h-7 w-[110px] text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {(Object.keys(statusConfig) as Status[]).map((s) => (
                          <SelectItem key={s} value={s}>
                            <div className="flex items-center gap-2">
                              <span className={cn("w-2 h-2 rounded-full", 
                                s === 'open' ? 'bg-green-500' : 
                                s === 'closed' ? 'bg-slate-500' : 
                                s === 'ongoing' ? 'bg-amber-500' : 
                                s === 'postponed' ? 'bg-red-500' : 'bg-blue-500'
                              )} />
                              {statusConfig[s].label}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex justify-between py-1 border-b">
                    <span className="text-muted-foreground">Due Date</span>
                    <span>{point.dueDate}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b">
                    <span className="text-muted-foreground">Assigned</span>
                    <span>{point.assignedTo}</span>
                  </div>
                </div>
                
                {/* Description Section */}
                <div className="mt-4 pt-4 border-t">
                  <div className="flex items-center justify-between mb-2">
                    <h5 className="text-sm font-medium">Description</h5>
                    {!isEditingDescription && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => {
                          setEditedDescription(point.description || "");
                          setIsEditingDescription(true);
                        }}
                        data-testid={`button-edit-description-${point.id}`}
                      >
                        <Pencil className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                  {isEditingDescription ? (
                    <div className="space-y-2">
                      <Textarea
                        value={editedDescription}
                        onChange={(e) => setEditedDescription(e.target.value)}
                        className="min-h-[100px] text-sm resize-none"
                        placeholder="Enter point description..."
                        data-testid={`textarea-description-${point.id}`}
                      />
                      <div className="flex gap-2 justify-end">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={handleCancelDescriptionEdit}
                        >
                          Cancel
                        </Button>
                        <Button
                          size="sm"
                          className="h-7 text-xs"
                          onClick={handleSaveDescription}
                          disabled={updateDescriptionMutation.isPending}
                          data-testid={`button-save-description-${point.id}`}
                        >
                          <Save className="h-3 w-3 mr-1" />
                          {updateDescriptionMutation.isPending ? "Saving..." : "Save"}
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                      {point.description || <span className="italic">No description</span>}
                    </p>
                  )}
                </div>
                
                {/* Attachments Section */}
                <div className="mt-4 pt-4 border-t">
                  <h5 className="text-sm font-medium flex items-center gap-2 mb-3">
                    <Paperclip className="h-4 w-4" /> Attachments
                  </h5>
                  
                  {/* Existing Attachments */}
                  {point.attachments.length > 0 && (
                    <div className="space-y-1.5 mb-3">
                      {point.attachments.map(att => {
                        const AttIcon = att.type === 'img' ? ImagePlus : 
                                        att.type === 'pdf' ? FileText : File;
                        return (
                          <div key={att.id} className="flex items-center gap-2 p-1.5 bg-muted/30 rounded text-xs">
                            <AttIcon className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                            <span className="truncate flex-1">{att.name}</span>
                            <span className="text-muted-foreground text-[10px]">{att.size}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  
                  {/* Pending Files to Upload */}
                  {pendingFiles.length > 0 && (
                    <div className="space-y-1.5 mb-3">
                      <div className="text-xs text-muted-foreground mb-1">Pending uploads:</div>
                      {pendingFiles.map((file, index) => {
                        const FileIcon = getFileIcon(file.type);
                        return (
                          <div key={index} className="flex items-center gap-2 p-1.5 bg-primary/10 rounded text-xs border border-primary/20">
                            <FileIcon className="h-3.5 w-3.5 text-primary flex-shrink-0" />
                            <span className="truncate flex-1">{file.name}</span>
                            <span className="text-muted-foreground text-[10px]">{file.size}</span>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-5 w-5 flex-shrink-0"
                              onClick={() => handleRemovePendingFile(index)}
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  
                  {/* Hidden file input */}
                  <input 
                    type="file" 
                    ref={fileInputRef}
                    accept=".pdf,.doc,.docx,.xls,.xlsx,.dwg,.dxf,.rvt,.ifc,.png,.jpg,.jpeg"
                    onChange={handleFileSelect}
                    multiple
                    className="hidden"
                    data-testid="input-attachment-upload"
                  />
                  
                  {/* Add/Upload Buttons */}
                  <div className="flex gap-2">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="h-7 text-xs flex-1"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <Plus className="h-3 w-3 mr-1" /> Add Files
                    </Button>
                    {pendingFiles.length > 0 && (
                      <Button 
                        size="sm" 
                        className="h-7 text-xs"
                        onClick={handleUploadAttachments}
                        disabled={isUploading}
                      >
                        <Upload className="h-3 w-3 mr-1" /> 
                        {isUploading ? "Uploading..." : `Upload (${pendingFiles.length})`}
                      </Button>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex-1 space-y-6">
                <h4 className="font-semibold text-sm flex items-center gap-2">
                  <History className="h-4 w-4" /> Status Log
                </h4>
                
                <div className="relative pl-4 border-l-2 border-muted space-y-6">
                  {/* Add New Update Block inside Dialog */}
                  <div className="relative">
                     <div className="absolute -left-[21px] top-0 h-3 w-3 rounded-full bg-primary ring-4 ring-background" />
                     <div className="bg-muted/30 p-3 rounded-md border space-y-3">
                        <h5 className="text-sm font-medium">Add New Update</h5>
                        <div className="grid grid-cols-2 gap-2">
                           <Input 
                              type="date" 
                              className="h-8 text-xs bg-background"
                              value={newCommentDate}
                              onChange={(e) => setNewCommentDate(e.target.value)}
                           />
                           <Select value={newActionOn} onValueChange={setNewActionOn}>
                              <SelectTrigger className="h-8 text-xs bg-background">
                                <SelectValue placeholder="Action on..." />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="Unassigned">Unassigned</SelectItem>
                                {attendees.map((att) => (
                                  <SelectItem key={att.id} value={att.name}>{att.name}</SelectItem>
                                ))}
                              </SelectContent>
                           </Select>
                        </div>
                        <Textarea 
                          placeholder="Enter status update..." 
                          className="text-xs min-h-[60px] bg-background"
                          value={newCommentText}
                          onChange={(e) => setNewCommentText(e.target.value)}
                        />
                        <Button size="sm" className="w-full h-7 text-xs" onClick={handleSaveComment}>
                          Save Update
                        </Button>
                     </div>
                  </div>

                  {/* History List */}
                  {[...point.statusUpdates].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map((update) => (
                    <div key={update.id} className="relative">
                      <div className="absolute -left-[21px] top-1.5 h-3 w-3 rounded-full bg-muted-foreground/30 ring-4 ring-background" />
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span className="font-mono-tech">{update.date}</span>
                          <span className="bg-muted px-1.5 py-0.5 rounded text-[10px] uppercase tracking-wide">
                            Action: {update.actionOn}
                          </span>
                        </div>
                        <p className="text-sm text-foreground/90 leading-relaxed">
                          {update.status}
                        </p>
                      </div>
                    </div>
                  ))}
                  
                  {/* Creation */}
                  <div className="relative pb-2">
                    <div className="absolute -left-[21px] top-1.5 h-3 w-3 rounded-full bg-muted-foreground/30 ring-4 ring-background" />
                    <div className="text-xs text-muted-foreground italic">
                      Point created
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          {/* Export Button at Bottom */}
          <div className="flex justify-end pt-4 border-t">
            <Button variant="outline" size="sm" className="h-8 text-sm" onClick={handleExportHistory}>
              <Download className="mr-2 h-4 w-4" /> Export to PDF
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Point Dialog */}
      <EditPointDialog
        point={point}
        open={isEditDialogOpen}
        onOpenChange={setIsEditDialogOpen}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Point?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{point.title}"? This will also delete all status updates and attachments for this point.
              <br /><br />
              <span className="font-medium text-destructive">This action cannot be undone.</span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteMutation.mutate()}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteMutation.isPending}
              data-testid="button-confirm-delete"
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Expanded Image Dialog */}
      <Dialog open={isImageExpanded} onOpenChange={setIsImageExpanded}>
        <DialogContent className="w-[95vw] max-w-6xl max-h-[95vh] p-2 sm:p-4 flex items-center justify-center bg-background/95">
          <DialogHeader className="sr-only">
            <DialogTitle>Image View: {point.title}</DialogTitle>
          </DialogHeader>
          {point.image && (
            <img 
              src={point.image} 
              alt={point.title} 
              className="max-w-full max-h-[85vh] object-contain rounded-md"
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
