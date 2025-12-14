import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Send,
  Download,
  FileText,
  FileSpreadsheet,
  ChevronDown,
  Calendar,
  Clock,
  MapPin,
  User,
  CheckCircle,
  Loader2,
} from "lucide-react";
import type { Meeting, Attendee, AttendanceRecord, SeriesAttendee } from "@shared/schema";
import type { PointWithRelations } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import jsPDF from "jspdf";

interface ImageData {
  base64: string;
  width: number;
  height: number;
  format: 'JPEG' | 'PNG' | 'WEBP';
}

const imageCache = new Map<string, ImageData>();

function getImageFormat(mimeType: string): 'JPEG' | 'PNG' | 'WEBP' {
  if (mimeType.includes('png')) return 'PNG';
  if (mimeType.includes('webp')) return 'WEBP';
  return 'JPEG';
}

async function loadImageData(url: string): Promise<ImageData | null> {
  if (!url) return null;
  
  if (imageCache.has(url)) {
    return imageCache.get(url)!;
  }
  
  try {
    const response = await fetch(url);
    const blob = await response.blob();
    const mimeType = blob.type;
    const format = getImageFormat(mimeType);
    
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result as string;
        
        const img = new Image();
        img.onload = () => {
          const imageData: ImageData = {
            base64,
            width: img.width,
            height: img.height,
            format,
          };
          imageCache.set(url, imageData);
          resolve(imageData);
        };
        img.onerror = () => resolve(null);
        img.src = base64;
      };
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

async function preloadAllImages(points: PointWithRelations[]): Promise<Map<string, ImageData>> {
  const imageMap = new Map<string, ImageData>();
  
  const imagePromises = points
    .filter(p => p.image)
    .map(async (p) => {
      const data = await loadImageData(p.image!);
      if (data) {
        imageMap.set(p.id, data);
      }
    });
  
  await Promise.all(imagePromises);
  return imageMap;
}

interface MeetingMinutesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  meeting: Meeting;
  points: PointWithRelations[];
  attendees: (Attendee | SeriesAttendee)[];
  attendanceRecords?: AttendanceRecord[];
}

const statusColors: Record<string, string> = {
  new: "bg-blue-100 text-blue-800 border-blue-200",
  open: "bg-yellow-100 text-yellow-800 border-yellow-200",
  ongoing: "bg-purple-100 text-purple-800 border-purple-200",
  postponed: "bg-orange-100 text-orange-800 border-orange-200",
  closed: "bg-green-100 text-green-800 border-green-200",
};

export default function MeetingMinutesDialog({
  open,
  onOpenChange,
  meeting,
  points,
  attendees,
  attendanceRecords = [],
}: MeetingMinutesDialogProps) {
  const { toast } = useToast();
  const contentRef = useRef<HTMLDivElement>(null);
  
  const [emailText, setEmailText] = useState(
    `Dear Team,\n\nPlease find attached the meeting minutes for "${meeting.title}" held on ${meeting.date}.\n\nKey items discussed and action points are outlined below. Please review and reach out if you have any questions or concerns.\n\nBest regards`
  );
  
  const [additionalNotes, setAdditionalNotes] = useState("");
  
  const filteredAttendees = useMemo(() => {
    if (attendanceRecords.length === 0) {
      return attendees;
    }
    const presentAttendeeIds = new Set(
      attendanceRecords
        .filter(r => r.present)
        .map(r => r.attendeeId || r.seriesAttendeeId)
    );
    return attendees.filter(a => presentAttendeeIds.has(a.id));
  }, [attendees, attendanceRecords]);
  
  const [recipientEmails, setRecipientEmails] = useState("");
  
  useEffect(() => {
    if (open) {
      const emails = filteredAttendees
        .map(a => a.email)
        .filter((email): email is string => Boolean(email));
      setRecipientEmails(emails.join(", "));
    }
  }, [open, filteredAttendees]);

  const [isExporting, setIsExporting] = useState(false);
  const [isSending, setIsSending] = useState(false);

  const handleSend = async () => {
    // Parse all emails from the recipient field (includes both attendee and manually added)
    const allEmails = recipientEmails
      .split(/[,;\s]+/)
      .map((e: string) => e.trim())
      .filter((e: string) => e && e.includes('@'));
    const uniqueEmails = Array.from(new Set(allEmails));
    
    if (uniqueEmails.length === 0) {
      toast({
        title: "No Recipients",
        description: "Please enter at least one email address to send minutes.",
        variant: "destructive",
      });
      return;
    }
    
    setIsSending(true);
    try {
      const imageMap = await preloadAllImages(points);
      
      const pointsWithImages = points.map(p => {
        const imgData = imageMap.get(p.id);
        return {
          id: p.id.slice(0, 8),
          title: p.title,
          description: p.description,
          status: p.status,
          assignedTo: p.assignedTo,
          dueDate: p.dueDate,
          imageUrl: p.image || null,
          imageBase64: imgData?.base64 || null,
        };
      });
      
      const response = await fetch('/api/send-minutes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          meetingId: meeting.id,
          meetingTitle: meeting.title,
          meetingDate: meeting.date,
          meetingTime: `${meeting.startTime} - ${meeting.endTime}`,
          meetingLocation: meeting.location,
          project: meeting.project,
          platform: meeting.platform,
          emailText,
          additionalNotes,
          recipientEmails: uniqueEmails,
          attendees: filteredAttendees.map(a => ({
            name: a.name,
            role: a.role,
            email: a.email,
          })),
          points: pointsWithImages,
        }),
      });
      
      let data;
      try {
        data = await response.json();
      } catch {
        data = { message: response.ok ? "Email sent successfully" : "Failed to send email" };
      }
      
      if (response.ok) {
        toast({
          title: "Minutes Sent",
          description: data.message || `Meeting minutes sent to ${uniqueEmails.length} recipient(s).`,
        });
        onOpenChange(false);
      } else {
        toast({
          title: "Failed to Send",
          description: data.message || "Unable to send email. Please check your email integration.",
          variant: "destructive",
        });
      }
    } catch (error: any) {
      toast({
        title: "Send Error", 
        description: error.message || "Failed to send meeting minutes. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSending(false);
    }
  };

  const handleExportPDF = async () => {
    setIsExporting(true);
    try {
      const pdf = new jsPDF();
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 20;
      const maxWidth = pageWidth - 2 * margin;
      let yPos = 20;
      
      const checkPageBreak = (requiredSpace: number) => {
        if (yPos + requiredSpace > pageHeight - 20) {
          pdf.addPage();
          yPos = 20;
        }
      };
      
      pdf.setFontSize(18);
      pdf.setFont("helvetica", "bold");
      pdf.text("MEETING MINUTES", margin, yPos);
      yPos += 10;
      
      pdf.setFontSize(14);
      pdf.text(meeting.title, margin, yPos);
      yPos += 8;
      
      pdf.setFontSize(10);
      pdf.setFont("helvetica", "normal");
      pdf.text(`Project: ${meeting.project}`, margin, yPos);
      yPos += 5;
      pdf.text(`Date: ${meeting.date}`, margin, yPos);
      yPos += 5;
      pdf.text(`Time: ${meeting.startTime} - ${meeting.endTime}`, margin, yPos);
      yPos += 5;
      pdf.text(`Location: ${meeting.location}`, margin, yPos);
      yPos += 10;
      
      pdf.setFontSize(11);
      pdf.setFont("helvetica", "bold");
      pdf.text("Attendees:", margin, yPos);
      yPos += 5;
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(9);
      filteredAttendees.forEach(att => {
        checkPageBreak(5);
        pdf.text(`• ${att.name} (${att.role})`, margin + 5, yPos);
        yPos += 4;
      });
      yPos += 5;
      
      pdf.setFontSize(11);
      pdf.setFont("helvetica", "bold");
      pdf.text("Email Message:", margin, yPos);
      yPos += 5;
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(9);
      const emailLines = pdf.splitTextToSize(emailText, maxWidth - 10);
      emailLines.forEach((line: string) => {
        checkPageBreak(5);
        pdf.text(line, margin + 5, yPos);
        yPos += 4;
      });
      yPos += 10;
      
      pdf.setFontSize(12);
      pdf.setFont("helvetica", "bold");
      pdf.text(`Agenda Points (${points.length} items)`, margin, yPos);
      yPos += 8;
      
      for (let i = 0; i < points.length; i++) {
        const point = points[i];
        const index = i;
        
        checkPageBreak(60);
        
        pdf.setFontSize(10);
        pdf.setFont("helvetica", "bold");
        const titleLines = pdf.splitTextToSize(`${index + 1}. ${point.title}`, maxWidth - 30);
        titleLines.forEach((line: string) => {
          pdf.text(line, margin, yPos);
          yPos += 4;
        });
        
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(7);
        pdf.setTextColor(100);
        pdf.text(`ID: ${point.id.slice(0, 8)}`, margin + 5, yPos);
        pdf.setTextColor(0);
        yPos += 4;
        
        pdf.setFontSize(8);
        pdf.text(`Status: ${point.status.toUpperCase()} | Assigned: ${point.assignedTo} | Due: ${point.dueDate}`, margin + 5, yPos);
        yPos += 5;
        
        pdf.setFontSize(9);
        const descLines = pdf.splitTextToSize(point.description, maxWidth - 15);
        descLines.forEach((line: string) => {
          checkPageBreak(5);
          pdf.text(line, margin + 5, yPos);
          yPos += 4;
        });
        
        if (point.image) {
          try {
            const imgData = await loadImageData(point.image);
            if (imgData) {
              const imgMaxWidth = 60;
              const imgMaxHeight = 40;
              const scale = Math.min(imgMaxWidth / imgData.width, imgMaxHeight / imgData.height);
              const imgWidth = imgData.width * scale;
              const imgHeight = imgData.height * scale;
              
              checkPageBreak(imgHeight + 5);
              yPos += 2;
              pdf.addImage(imgData.base64, imgData.format, margin + 5, yPos, imgWidth, imgHeight);
              yPos += imgHeight + 3;
            }
          } catch (e) {
            console.warn('Failed to add image to PDF:', e);
          }
        }
        
        yPos += 6;
      }
      
      if (additionalNotes) {
        checkPageBreak(30);
        pdf.setFontSize(11);
        pdf.setFont("helvetica", "bold");
        pdf.text("Additional Notes:", margin, yPos);
        yPos += 5;
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(9);
        const noteLines = pdf.splitTextToSize(additionalNotes, maxWidth - 10);
        noteLines.forEach((line: string) => {
          checkPageBreak(5);
          pdf.text(line, margin + 5, yPos);
          yPos += 4;
        });
      }
      
      pdf.setFontSize(8);
      pdf.text(`Generated on: ${format(new Date(), 'PPpp')}`, margin, pageHeight - 10);
      
      pdf.save(`${meeting.title.replace(/\s+/g, '_')}_Minutes.pdf`);
      
      toast({
        title: "Export Complete",
        description: "Meeting minutes exported as PDF with images.",
      });
    } catch (error) {
      console.error('PDF export error:', error);
      toast({
        title: "Export Failed",
        description: "Failed to generate PDF. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportExcel = () => {
    const csvContent = generateCSVContent();
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${meeting.title.replace(/\s+/g, '_')}_Minutes.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    toast({
      title: "Export Complete",
      description: "Meeting minutes exported as CSV (Excel compatible).",
    });
  };

  const handleExportWord = async () => {
    setIsExporting(true);
    try {
      const imageMap = await preloadAllImages(points);
      const htmlContent = generateHTMLContent(imageMap);
      const blob = new Blob([htmlContent], { type: 'application/msword' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${meeting.title.replace(/\s+/g, '_')}_Minutes.doc`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      toast({
        title: "Export Complete",
        description: "Meeting minutes exported as Word document with images.",
      });
    } catch (error) {
      console.error('Word export error:', error);
      toast({
        title: "Export Failed",
        description: "Failed to generate Word document. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
    }
  };

  const generateHTMLContent = (imageMap: Map<string, ImageData>) => {
    let html = `
      <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word'>
      <head><meta charset="utf-8"><title>Meeting Minutes</title>
      <style>
        body { font-family: Arial, sans-serif; font-size: 11pt; line-height: 1.4; margin: 40px; }
        h1 { color: #1a1a1a; font-size: 18pt; margin-bottom: 5px; }
        h2 { color: #333; font-size: 14pt; margin-top: 20px; margin-bottom: 10px; border-bottom: 1px solid #ddd; padding-bottom: 5px; }
        h3 { color: #444; font-size: 12pt; margin-top: 15px; }
        .meta { color: #666; font-size: 10pt; margin-bottom: 20px; }
        .meta p { margin: 3px 0; }
        .attendees { margin-left: 15px; }
        .email-text { background: #f9f9f9; padding: 15px; border-left: 3px solid #0066cc; margin: 15px 0; white-space: pre-wrap; }
        .point { margin: 15px 0; padding: 10px; background: #fafafa; border: 1px solid #eee; display: table; width: 100%; }
        .point-content { display: table-cell; vertical-align: top; }
        .point-image { display: table-cell; vertical-align: top; width: 150px; padding-left: 15px; }
        .point-image img { max-width: 140px; max-height: 100px; border: 1px solid #ddd; }
        .point-title { font-weight: bold; color: #1a1a1a; }
        .point-id { font-size: 8pt; color: #999; font-family: monospace; }
        .point-meta { font-size: 9pt; color: #666; margin: 5px 0; }
        .point-desc { margin-top: 8px; }
        .status { display: inline-block; padding: 2px 8px; border-radius: 3px; font-size: 9pt; font-weight: bold; }
        .status-new { background: #e3f2fd; color: #1565c0; }
        .status-open { background: #fff3e0; color: #ef6c00; }
        .status-ongoing { background: #f3e5f5; color: #7b1fa2; }
        .status-postponed { background: #fff8e1; color: #f57f17; }
        .status-closed { background: #e8f5e9; color: #2e7d32; }
        .notes { background: #fffde7; padding: 15px; border-left: 3px solid #ffc107; margin: 15px 0; white-space: pre-wrap; }
        .footer { margin-top: 30px; font-size: 9pt; color: #999; border-top: 1px solid #ddd; padding-top: 10px; }
      </style>
      </head>
      <body>
        <h1>MEETING MINUTES</h1>
        <h2>${meeting.title}</h2>
        <div class="meta">
          <p><strong>Project:</strong> ${meeting.project}</p>
          <p><strong>Date:</strong> ${meeting.date}</p>
          <p><strong>Time:</strong> ${meeting.startTime} - ${meeting.endTime}</p>
          <p><strong>Location:</strong> ${meeting.location}</p>
        </div>
        
        <h2>Attendees</h2>
        <div class="attendees">
          ${filteredAttendees.map(att => `<p>• ${att.name} (${att.role})</p>`).join('')}
        </div>
        
        <h2>Email Message</h2>
        <div class="email-text">${emailText}</div>
        
        <h2>Agenda Points (${points.length} items)</h2>
        ${points.map((point, index) => {
          const imgData = imageMap.get(point.id);
          return `
          <div class="point">
            <div class="point-content">
              <div class="point-title">${index + 1}. ${point.title}</div>
              <div class="point-id">ID: ${point.id.slice(0, 8)}</div>
              <div class="point-meta">
                <span class="status status-${point.status}">${point.status.toUpperCase()}</span>
                | Assigned to: ${point.assignedTo} | Due: ${point.dueDate}
              </div>
              <div class="point-desc">${point.description}</div>
            </div>
            ${imgData ? `
              <div class="point-image">
                <img src="${imgData.base64}" alt="${point.title}" />
              </div>
            ` : ''}
          </div>
        `;}).join('')}
        
        ${additionalNotes ? `
          <h2>Additional Notes</h2>
          <div class="notes">${additionalNotes}</div>
        ` : ''}
        
        <div class="footer">Generated on: ${format(new Date(), 'PPpp')}</div>
      </body>
      </html>
    `;
    return html;
  };

  const generateCSVContent = () => {
    let csv = 'Item,ID,Title,Status,Assigned To,Due Date,Description,Image URL\n';
    points.forEach((point, index) => {
      const escapedTitle = `"${point.title.replace(/"/g, '""')}"`;
      const escapedDesc = `"${point.description.replace(/"/g, '""')}"`;
      const imageUrl = point.image || '';
      csv += `${index + 1},${point.id.slice(0, 8)},${escapedTitle},${point.status},${point.assignedTo},${point.dueDate},${escapedDesc},"${imageUrl}"\n`;
    });
    return csv;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl h-[90vh] flex flex-col overflow-hidden">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Meeting Minutes Preview
          </DialogTitle>
          <DialogDescription className="sr-only">
            Preview and export meeting minutes with attendance and action items
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 overflow-y-auto pr-4" ref={contentRef}>
          <div className="space-y-6 pb-4">
            <div className="bg-muted/30 rounded-lg p-4 space-y-3">
              <h3 className="font-semibold text-lg">{meeting.title}</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Calendar className="h-4 w-4" />
                  <span>{meeting.date}</span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Clock className="h-4 w-4" />
                  <span>{meeting.startTime} - {meeting.endTime}</span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <MapPin className="h-4 w-4" />
                  <span>{meeting.location}</span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <User className="h-4 w-4" />
                  <span>{filteredAttendees.length} Attendees</span>
                </div>
              </div>
              <Badge variant="outline" className="font-mono text-xs">
                {meeting.project}
              </Badge>
            </div>

            <div className="space-y-2">
              <Label htmlFor="recipient-emails" className="text-sm font-medium flex items-center gap-2">
                <Send className="h-4 w-4" />
                Send To
              </Label>
              <Textarea
                id="recipient-emails"
                value={recipientEmails}
                onChange={(e) => setRecipientEmails(e.target.value)}
                className="min-h-[80px] resize-y"
                placeholder="email1@example.com, email2@example.com..."
                data-testid="textarea-recipient-emails"
              />
              <p className="text-xs text-muted-foreground">
                {filteredAttendees.filter(a => a.email).length > 0 
                  ? `${filteredAttendees.filter(a => a.email).length} attendee email(s) included. Add more emails separated by commas.`
                  : "Enter email addresses separated by commas or spaces."}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email-text" className="text-sm font-medium">
                Email Message (editable)
              </Label>
              <Textarea
                id="email-text"
                value={emailText}
                onChange={(e) => setEmailText(e.target.value)}
                className="min-h-[120px] resize-y"
                placeholder="Enter your email message here..."
                data-testid="textarea-email-message"
              />
            </div>

            <Separator />

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-medium text-sm">
                  Agenda Points ({points.length} items)
                </h4>
              </div>
              
              {points.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground border rounded-lg">
                  No agenda points match the current filters.
                </div>
              ) : (
                <div className="space-y-4">
                  {points.map((point, index) => (
                    <div
                      key={point.id}
                      className="border rounded-lg p-4 bg-card"
                      data-testid={`minutes-point-${point.id}`}
                    >
                      <div className="flex gap-4">
                        {point.image && (
                          <div className="flex-shrink-0">
                            <img
                              src={point.image}
                              alt={point.title}
                              className="w-40 h-28 rounded border object-cover"
                            />
                          </div>
                        )}
                        <div className="flex-1 space-y-2">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-start gap-2">
                              <span className="text-muted-foreground font-mono text-sm font-bold">
                                {index + 1}.
                              </span>
                              <div>
                                <h5 className="font-medium">{point.title}</h5>
                                <span className="text-xs font-mono text-muted-foreground">
                                  ID: {point.id.slice(0, 8)}
                                </span>
                              </div>
                            </div>
                            <Badge
                              variant="outline"
                              className={statusColors[point.status] || ""}
                            >
                              {point.status}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {point.description}
                          </p>
                          <div className="flex items-center gap-4 text-xs text-muted-foreground">
                            <span>
                              <strong>Assigned:</strong> {point.assignedTo}
                            </span>
                            <span>
                              <strong>Due:</strong> {point.dueDate}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <Separator />

            <div className="space-y-2">
              <Label htmlFor="additional-notes" className="text-sm font-medium">
                Additional Notes (editable)
              </Label>
              <Textarea
                id="additional-notes"
                value={additionalNotes}
                onChange={(e) => setAdditionalNotes(e.target.value)}
                className="min-h-[100px] resize-y"
                placeholder="Add any additional notes, next steps, or comments..."
                data-testid="textarea-additional-notes"
              />
            </div>

            <Separator />

            <div className="space-y-3">
              <h4 className="font-medium text-sm">
                Attendees ({filteredAttendees.length})
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {filteredAttendees.map((att) => (
                  <div
                    key={att.id}
                    className="flex items-center gap-3 border rounded-lg p-3 bg-card"
                    data-testid={`minutes-attendee-${att.id}`}
                  >
                    <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center">
                      <User className="h-4 w-4 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{att.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{att.role}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </ScrollArea>

        <div className="flex items-center justify-between gap-4 pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          
          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" data-testid="button-export-dropdown">
                  <Download className="h-4 w-4 mr-2" />
                  Export
                  <ChevronDown className="h-4 w-4 ml-2" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={handleExportPDF} data-testid="button-export-pdf">
                  <FileText className="h-4 w-4 mr-2" />
                  Export as PDF
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleExportExcel} data-testid="button-export-excel">
                  <FileSpreadsheet className="h-4 w-4 mr-2" />
                  Export as Excel (CSV)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleExportWord} data-testid="button-export-word">
                  <FileText className="h-4 w-4 mr-2" />
                  Export as Word
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <Button onClick={handleSend} disabled={isSending} data-testid="button-send-minutes">
              {isSending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Send className="h-4 w-4 mr-2" />
              )}
              {isSending ? "Sending..." : "Send to Attendees"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
