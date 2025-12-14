import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle,
  DialogDescription,
  DialogTrigger,
  DialogFooter
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

// Helper to get dev auth headers
function getDevAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = {};
  const devUserId = localStorage.getItem("dev-user-id");
  const devUserEmail = localStorage.getItem("dev-user-email");
  if (devUserId) headers["x-dev-user-id"] = devUserId;
  if (devUserEmail) headers["x-dev-user-email"] = devUserEmail;
  return headers;
}
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue,
  SelectGroup,
  SelectLabel,
  SelectSeparator
} from "@/components/ui/select";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { 
  Plus, 
  Mail, 
  FileSpreadsheet, 
  FileCode, 
  PenTool, 
  Search, 
  UploadCloud,
  FileText,
  Check,
  ImagePlus,
  X,
  File,
  Paperclip,
  User,
  Building2,
  UserPlus,
  ChevronsUpDown,
  Loader2,
  AlertCircle
} from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { DisciplineMultiSelect } from "./discipline-multi-select";
import type { Attendee, SeriesAttendee } from "@shared/schema";
import JSZip from "jszip";

interface EmailAttachment {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
  isImage: boolean;
  data?: string; // Base64 data (may be pre-loaded for Outlook)
}

// Navisworks XML clash data structure
interface ClashObject {
  elementId: string;
  itemName: string;
  itemType: string;
}

interface NavisworksClash {
  id: string;
  name: string;
  guid: string;
  status: string;
  clashType: string;
  distance: string;
  gridLocation: string;
  createdDate: string;
  clashPoint: { x: string; y: string; z: string } | null;
  imagePath: string; // href attribute - relative path to image
  imageData: string | null; // Base64 image data (loaded from ZIP)
  item1: ClashObject;
  item2: ClashObject;
}

interface Email {
  id: string;
  subject: string;
  from: string;
  date: string;
  snippet: string;
  body: string;
  attachments?: EmailAttachment[];
  inlineImages?: EmailAttachment[];
}

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

interface AddPointDialogProps {
  onAddPoint: (point: any) => void;
  attendees?: (Attendee | SeriesAttendee)[];
  onAddAttendee?: (attendee: { name: string; email: string; role: string; company: string }) => Promise<Attendee | SeriesAttendee | void>;
}

type AddMode = "manual" | "email" | "excel" | "xml" | null;

export default function AddPointDialog({ onAddPoint, attendees = [], onAddAttendee }: AddPointDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [mode, setMode] = useState<AddMode>("manual");
  const [step, setStep] = useState<"select" | "edit">("select");
  const [searchQuery, setSearchQuery] = useState("");
  const { toast } = useToast();
  const imageInputRef = useRef<HTMLInputElement>(null);
  const documentInputRef = useRef<HTMLInputElement>(null);

  // Form State
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [assignedTo, setAssignedTo] = useState("");
  const [status, setStatus] = useState("new");
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [selectedDisciplines, setSelectedDisciplines] = useState<string[]>([]);

  // Assignment dropdown state
  const [assignmentOpen, setAssignmentOpen] = useState(false);
  const [addAttendeeDialogOpen, setAddAttendeeDialogOpen] = useState(false);
  const [newAttendee, setNewAttendee] = useState({ name: "", email: "", role: "", company: "" });
  // Store newly created attendee for label display before list refresh
  const [lastCreatedAttendee, setLastCreatedAttendee] = useState<{ id: number | string; name: string } | null>(null);

  // Email import state
  const [emails, setEmails] = useState<Email[]>([]);
  const [emailsLoading, setEmailsLoading] = useState(false);
  const [emailsError, setEmailsError] = useState<string | null>(null);
  const [emailProvider, setEmailProvider] = useState<string | null>(null);
  const [importedAttachments, setImportedAttachments] = useState<EmailAttachment[]>([]);
  const [attachmentsLoading, setAttachmentsLoading] = useState(false);
  const [selectedEmailIds, setSelectedEmailIds] = useState<Set<string>>(new Set());
  const [emailBulkMode, setEmailBulkMode] = useState(false);

  // XML import state
  const [xmlClashes, setXmlClashes] = useState<NavisworksClash[]>([]);
  const [xmlFileName, setXmlFileName] = useState<string>("");
  const [xmlSearchQuery, setXmlSearchQuery] = useState("");
  const [selectedClash, setSelectedClash] = useState<NavisworksClash | null>(null);
  const [selectedClashIds, setSelectedClashIds] = useState<Set<string>>(new Set());
  const [xmlBulkMode, setXmlBulkMode] = useState(false); // true when multiple clashes selected
  const [bulkCreating, setBulkCreating] = useState(false);
  const xmlInputRef = useRef<HTMLInputElement>(null);

  // Fetch emails when email mode is selected
  useEffect(() => {
    if (mode === "email" && step === "select" && isOpen) {
      fetchEmails();
    }
  }, [mode, step, isOpen]);

  const fetchEmails = async (search?: string) => {
    setEmailsLoading(true);
    setEmailsError(null);
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      params.set('limit', '20');
      
      const response = await fetch(`/api/email/messages?${params}`);
      const data = await response.json();
      
      if (!response.ok) {
        setEmailsError(data.message || data.error || "Failed to fetch emails");
        setEmails([]);
        setEmailProvider(null);
      } else {
        setEmails(data.emails || []);
        setEmailProvider(data.provider || null);
      }
    } catch (error: any) {
      setEmailsError(error.message || "Failed to connect to email service");
      setEmails([]);
      setEmailProvider(null);
    } finally {
      setEmailsLoading(false);
    }
  };

  // Convert URL-safe base64 (Gmail) to standard base64
  const normalizeBase64 = (data: string): string => {
    // Gmail uses URL-safe base64: replace - with +, _ with /
    let normalized = data.replace(/-/g, '+').replace(/_/g, '/');
    // Remove any whitespace
    normalized = normalized.replace(/\s/g, '');
    // Add padding if needed
    const paddingNeeded = (4 - (normalized.length % 4)) % 4;
    normalized += '='.repeat(paddingNeeded);
    return normalized;
  };

  // Fetch attachment data from email
  const fetchEmailAttachment = async (messageId: string, attachment: EmailAttachment): Promise<EmailAttachment | null> => {
    if (!emailProvider) return null;
    
    // If data is already loaded (Outlook inline), return as-is with normalized base64
    if (attachment.data) {
      return { ...attachment, data: normalizeBase64(attachment.data) };
    }
    
    try {
      const response = await fetch(`/api/email/attachment/${emailProvider}/${messageId}/${attachment.id}`);
      if (!response.ok) {
        console.error('Failed to fetch attachment:', attachment.filename);
        return null;
      }
      const responseData = await response.json();
      if (!responseData.data) {
        console.error('No data returned for attachment:', attachment.filename);
        return null;
      }
      // Normalize the base64 data (Gmail uses URL-safe base64)
      const normalizedData = normalizeBase64(responseData.data);
      return { ...attachment, data: normalizedData };
    } catch (error) {
      console.error('Error fetching attachment:', error);
      return null;
    }
  };

  // Get unique companies from attendees
  const companies = Array.from(new Set(attendees.map(a => a.company).filter(Boolean))) as string[];
  
  // Parse assignment value to get display label
  // Format: "attendee:{id}" for attendees, "company:{name}" for companies, or plain text for legacy
  const getAssignmentLabel = () => {
    if (!assignedTo) return "Select assignee...";
    
    if (assignedTo.startsWith("attendee:")) {
      const id = assignedTo.substring(9);
      const attendee = attendees.find(a => String(a.id) === id);
      if (attendee) return attendee.name;
      // Fallback to lastCreatedAttendee if list not refreshed yet
      if (lastCreatedAttendee && String(lastCreatedAttendee.id) === id) {
        return lastCreatedAttendee.name;
      }
      return "Unknown Attendee";
    }
    
    if (assignedTo.startsWith("company:")) {
      const companyName = assignedTo.substring(8);
      return `${companyName} (Company)`;
    }
    
    // Legacy: plain name/email - try to find matching attendee
    const attendee = attendees.find(a => a.name === assignedTo || a.email === assignedTo);
    if (attendee) return attendee.name;
    if (companies.includes(assignedTo)) return `${assignedTo} (Company)`;
    return assignedTo;
  };
  
  // Convert assignment value to display name for API
  const getAssignedToDisplayName = () => {
    if (!assignedTo) return "Unassigned";
    
    if (assignedTo.startsWith("attendee:")) {
      const id = assignedTo.substring(9);
      const attendee = attendees.find(a => String(a.id) === id);
      if (attendee) return attendee.name;
      // Fallback to lastCreatedAttendee if list not refreshed yet
      if (lastCreatedAttendee && String(lastCreatedAttendee.id) === id) {
        return lastCreatedAttendee.name;
      }
      return "Unassigned";
    }
    
    if (assignedTo.startsWith("company:")) {
      return assignedTo.substring(8);
    }
    
    return assignedTo || "Unassigned";
  };

  const handleAddNewAttendee = async () => {
    if (!newAttendee.name.trim()) {
      toast({ title: "Error", description: "Name is required", variant: "destructive" });
      return;
    }
    if (onAddAttendee) {
      try {
        const createdAttendee = await onAddAttendee(newAttendee);
        // If the callback returns the created attendee, use its ID
        if (createdAttendee && createdAttendee.id) {
          // Store for immediate label display before list refresh
          setLastCreatedAttendee({ id: createdAttendee.id, name: createdAttendee.name });
          setAssignedTo(`attendee:${createdAttendee.id}`);
        } else {
          // Fallback to name if no ID returned
          setAssignedTo(newAttendee.name);
        }
        setAddAttendeeDialogOpen(false);
        setNewAttendee({ name: "", email: "", role: "", company: "" });
        toast({ title: "Attendee Added", description: `${newAttendee.name} has been added and assigned.` });
      } catch (error) {
        toast({ title: "Error", description: "Failed to add attendee", variant: "destructive" });
      }
    } else {
      setAssignedTo(newAttendee.name);
      setAddAttendeeDialogOpen(false);
      setNewAttendee({ name: "", email: "", role: "", company: "" });
    }
  };

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (!open) {
      setTimeout(() => {
        setMode("manual");
        setStep("select");
        setTitle("");
        setDescription("");
        setAssignedTo("");
        setSearchQuery("");
        setImagePreview(null);
        setImageFile(null);
        setUploadedFiles([]);
        setSelectedDisciplines([]);
        setAssignmentOpen(false);
        setAddAttendeeDialogOpen(false);
        setNewAttendee({ name: "", email: "", role: "", company: "" });
        setLastCreatedAttendee(null);
        setImportedAttachments([]);
        setAttachmentsLoading(false);
        // Reset XML state
        setXmlClashes([]);
        setXmlFileName("");
        setXmlSearchQuery("");
        setSelectedClash(null);
        setSelectedClashIds(new Set());
        setXmlBulkMode(false);
        setBulkCreating(false);
        // Reset email selection state
        setSelectedEmailIds(new Set());
        setEmailBulkMode(false);
      }, 300);
    }
  };

  // XML multi-select helpers
  const toggleClashSelection = (clashId: string) => {
    setSelectedClashIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(clashId)) {
        newSet.delete(clashId);
      } else {
        newSet.add(clashId);
      }
      return newSet;
    });
  };

  const selectAllClashes = () => {
    const filteredIds = xmlClashes
      .filter(clash => {
        const q = xmlSearchQuery.toLowerCase();
        return clash.name.toLowerCase().includes(q) ||
          clash.item1.itemName.toLowerCase().includes(q) ||
          clash.item2.itemName.toLowerCase().includes(q) ||
          clash.gridLocation.toLowerCase().includes(q) ||
          clash.item1.elementId.includes(q) ||
          clash.item2.elementId.includes(q);
      })
      .map(c => c.id);
    setSelectedClashIds(new Set(filteredIds));
  };

  const deselectAllClashes = () => {
    setSelectedClashIds(new Set());
  };

  const getSelectedClashes = (): NavisworksClash[] => {
    return xmlClashes.filter(c => selectedClashIds.has(c.id));
  };

  // Email multi-select helpers
  const toggleEmailSelection = (emailId: string) => {
    setSelectedEmailIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(emailId)) {
        newSet.delete(emailId);
      } else {
        newSet.add(emailId);
      }
      return newSet;
    });
  };

  const selectAllEmails = () => {
    const filteredIds = filteredEmails.map(e => e.id);
    setSelectedEmailIds(new Set(filteredIds));
  };

  const deselectAllEmails = () => {
    setSelectedEmailIds(new Set());
  };

  const getSelectedEmails = (): Email[] => {
    return emails.filter(e => selectedEmailIds.has(e.id));
  };

  // Handle proceeding with selected emails (bulk mode)
  const handleProceedWithSelectedEmails = () => {
    if (selectedEmailIds.size === 0) {
      toast({
        title: "No Selection",
        description: "Please select at least one email to import",
        variant: "destructive",
      });
      return;
    }
    
    if (selectedEmailIds.size === 1) {
      // Single selection - use normal flow
      const email = emails.find(e => selectedEmailIds.has(e.id));
      if (email) {
        handleEmailSelect(email);
      }
    } else {
      // Multiple selection - go to bulk edit mode
      setEmailBulkMode(true);
      setStep("edit");
    }
  };

  // Handle bulk creation of points from emails
  const handleEmailBulkCreate = async () => {
    const selectedEmailsList = getSelectedEmails();
    if (selectedEmailsList.length === 0) return;
    
    setBulkCreating(true);
    
    try {
      for (const email of selectedEmailsList) {
        const newPoint = {
          title: email.subject,
          description: email.body,
          status,
          assignedTo: assignedTo.startsWith("attendee:") 
            ? attendees.find(a => `attendee:${a.id}` === assignedTo)?.name || ""
            : assignedTo,
          assignedToRef: assignedTo.startsWith("attendee:") ? assignedTo.replace("attendee:", "") : null,
          image: null,
          disciplines: selectedDisciplines,
        };
        
        await onAddPoint(newPoint);
      }
      
      toast({
        title: "Points Created",
        description: `Successfully created ${selectedEmailsList.length} points from emails`,
      });
      
      handleOpenChange(false);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to create points",
        variant: "destructive",
      });
    } finally {
      setBulkCreating(false);
    }
  };

  // Build point data from a clash or viewpoint
  const buildPointFromClash = (clash: NavisworksClash) => {
    const parts: string[] = [];
    const isViewpoint = clash.clashType === "Viewpoint";
    
    if (isViewpoint) {
      // Viewpoint description
      parts.push(`Navisworks Viewpoint: ${clash.name}`);
      
      if (clash.clashPoint) {
        parts.push("");
        parts.push("CAMERA POSITION:");
        parts.push(`X: ${clash.clashPoint.x}`);
        parts.push(`Y: ${clash.clashPoint.y}`);
        parts.push(`Z: ${clash.clashPoint.z}`);
      }
      
      return {
        title: clash.name,
        description: parts.join('\n'),
        image: clash.imageData || null,
      };
    }
    
    // Clash description
    parts.push(`${clash.clashType} Clash`);
    if (clash.distance) {
      const dist = parseFloat(clash.distance);
      parts.push(`Penetration: ${Math.abs(dist).toFixed(3)}m`);
    }
    if (clash.gridLocation) {
      parts.push(`Location: ${clash.gridLocation}`);
    }
    
    parts.push("");
    parts.push("CLASHING ELEMENTS:");
    parts.push(`• ${clash.item1.itemName}`);
    if (clash.item1.elementId) {
      parts.push(`  Element ID: ${clash.item1.elementId}`);
    }
    parts.push(`• ${clash.item2.itemName}`);
    if (clash.item2.elementId) {
      parts.push(`  Element ID: ${clash.item2.elementId}`);
    }
    
    if (clash.clashPoint) {
      parts.push("");
      parts.push(`Coordinates: X=${clash.clashPoint.x}, Y=${clash.clashPoint.y}, Z=${clash.clashPoint.z}`);
    }
    
    if (clash.createdDate) {
      parts.push(`Created: ${clash.createdDate}`);
    }
    
    return {
      title: `${clash.name} - ${clash.gridLocation || 'No Grid'}`,
      description: parts.join('\n'),
      image: clash.imageData || null,
    };
  };

  // Handle proceeding with selected clashes (bulk mode)
  const handleProceedWithSelected = () => {
    if (selectedClashIds.size === 0) {
      toast({
        title: "No Selection",
        description: "Please select at least one clash to import",
        variant: "destructive",
      });
      return;
    }
    
    if (selectedClashIds.size === 1) {
      // Single selection - use normal flow
      const clash = xmlClashes.find(c => selectedClashIds.has(c.id));
      if (clash) {
        handleClashSelect(clash);
      }
    } else {
      // Multiple selection - go to bulk edit mode
      setXmlBulkMode(true);
      setStep("edit");
    }
  };

  // Handle bulk creation of points
  const handleBulkCreate = async () => {
    const selectedClashesList = getSelectedClashes();
    if (selectedClashesList.length === 0) return;
    
    setBulkCreating(true);
    
    try {
      for (const clash of selectedClashesList) {
        const pointData = buildPointFromClash(clash);
        
        const newPoint = {
          title: pointData.title,
          description: pointData.description,
          status,
          assignedTo: assignedTo.startsWith("attendee:") 
            ? attendees.find(a => `attendee:${a.id}` === assignedTo)?.name || ""
            : assignedTo,
          assignedToRef: assignedTo.startsWith("attendee:") ? assignedTo.replace("attendee:", "") : null,
          image: pointData.image,
          disciplines: selectedDisciplines,
        };
        
        await onAddPoint(newPoint);
      }
      
      toast({
        title: "Points Created",
        description: `Successfully created ${selectedClashesList.length} point${selectedClashesList.length !== 1 ? 's' : ''}`,
      });
      
      handleOpenChange(false);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to create points",
        variant: "destructive",
      });
    } finally {
      setBulkCreating(false);
    }
  };

  // Parse Navisworks XML file - based on actual Clash Detective export format
  const parseNavisworksXml = (xmlText: string): NavisworksClash[] => {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlText, "text/xml");
    const clashes: NavisworksClash[] = [];
    
    // Check for parsing errors
    const parseError = doc.querySelector("parsererror");
    if (parseError) {
      throw new Error("Invalid XML file format");
    }
    
    // Get test type from clashtest element
    const clashTest = doc.querySelector("clashtest");
    const testType = clashTest?.getAttribute("test_type") || "hard";
    
    // Find all clashresult elements
    const clashResults = doc.querySelectorAll("clashresult");
    
    clashResults.forEach((clash, index) => {
      // Extract attributes
      const name = clash.getAttribute("name") || `Clash-${index + 1}`;
      const guid = clash.getAttribute("guid") || "";
      const href = clash.getAttribute("href") || ""; // Path to image
      const status = clash.getAttribute("status") || "new";
      const distance = clash.getAttribute("distance") || "";
      
      // Extract child elements
      const gridLocation = clash.querySelector("gridlocation")?.textContent?.trim() || "";
      
      // Parse created date
      const dateEl = clash.querySelector("createddate date");
      let createdDate = "";
      if (dateEl) {
        const year = dateEl.getAttribute("year");
        const month = dateEl.getAttribute("month");
        const day = dateEl.getAttribute("day");
        if (year && month && day) {
          createdDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
        }
      }
      
      // Parse clash point coordinates
      const pos3f = clash.querySelector("clashpoint pos3f");
      const clashPoint = pos3f ? {
        x: pos3f.getAttribute("x") || "0",
        y: pos3f.getAttribute("y") || "0",
        z: pos3f.getAttribute("z") || "0"
      } : null;
      
      // Parse clash objects (the two items that are clashing)
      const clashObjects = clash.querySelectorAll("clashobjects > clashobject");
      
      const parseClashObject = (obj: Element | null): ClashObject => {
        if (!obj) {
          return { elementId: "", itemName: "Unknown", itemType: "" };
        }
        
        // Get Element ID from objectattributes - find the one named "Element ID" or similar
        let elementId = "";
        const objectAttributes = obj.querySelectorAll("objectattribute");
        objectAttributes.forEach(attr => {
          const attrName = attr.querySelector("name")?.textContent?.trim()?.toLowerCase() || "";
          const attrValue = attr.querySelector("value")?.textContent?.trim() || "";
          // Match "element id", "elementid", "item id", "id"
          if (attrName.includes("element") && attrName.includes("id")) {
            elementId = attrValue;
          } else if (!elementId && attrName === "id") {
            elementId = attrValue;
          }
        });
        
        // Get Item Name and Type from smarttags
        const smarttags = obj.querySelectorAll("smarttags > smarttag");
        let itemName = "";
        let itemType = "";
        
        smarttags.forEach(tag => {
          const tagName = tag.querySelector("name")?.textContent?.trim();
          const tagValue = tag.querySelector("value")?.textContent?.trim() || "";
          if (tagName === "Item Name") itemName = tagValue;
          if (tagName === "Item Type") itemType = tagValue;
        });
        
        return { elementId, itemName: itemName || "Unknown", itemType };
      };
      
      const item1 = parseClashObject(clashObjects[0] || null);
      const item2 = parseClashObject(clashObjects[1] || null);
      
      clashes.push({
        id: name,
        name,
        guid,
        status,
        clashType: testType.charAt(0).toUpperCase() + testType.slice(1), // Capitalize
        distance,
        gridLocation,
        createdDate,
        clashPoint,
        imagePath: href, // e.g., "Structural vs MEP_files\cd000001.jpg"
        imageData: null, // Will be populated from ZIP
        item1,
        item2,
      });
    });
    
    return clashes;
  };

  // State for ZIP processing
  const [xmlProcessing, setXmlProcessing] = useState(false);

  // Parse Navisworks HTML viewpoints export
  const parseNavisworksHtml = (htmlText: string): NavisworksClash[] => {
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlText, "text/html");
    const viewpoints: NavisworksClash[] = [];
    
    // Find all viewpoint divs
    const viewpointDivs = doc.querySelectorAll("div.viewpoint");
    
    viewpointDivs.forEach((vp, index) => {
      // Get viewpoint name from h2
      const h2 = vp.querySelector("h2");
      const name = h2?.textContent?.trim() || `Viewpoint-${index + 1}`;
      
      // Get image path from img src
      const img = vp.querySelector("img");
      const imagePath = img?.getAttribute("src") || "";
      
      // Get camera position
      let cameraPosition = "";
      const nameValuePairs = vp.querySelectorAll("span.namevaluepair");
      nameValuePairs.forEach(pair => {
        const nameSpan = pair.querySelector("span.name");
        const valueSpan = pair.querySelector("span.value");
        if (nameSpan?.textContent?.includes("Camera Position") && valueSpan) {
          cameraPosition = valueSpan.textContent?.trim().replace(/\s+/g, ' ') || "";
        }
      });
      
      // Parse camera coordinates if available
      let clashPoint: { x: string; y: string; z: string } | null = null;
      if (cameraPosition) {
        const coords = cameraPosition.split(',').map(c => c.trim());
        if (coords.length >= 3) {
          clashPoint = {
            x: coords[0],
            y: coords[1],
            z: coords[2]
          };
        }
      }
      
      viewpoints.push({
        id: `vp-${index + 1}`,
        name,
        guid: "",
        status: "new",
        clashType: "Viewpoint",
        distance: "",
        gridLocation: "",
        createdDate: "",
        clashPoint,
        imagePath,
        imageData: null,
        item1: { elementId: "", itemName: "Navisworks Viewpoint", itemType: "Viewpoint" },
        item2: { elementId: "", itemName: cameraPosition || "Camera View", itemType: "Position" },
      });
    });
    
    return viewpoints;
  };

  // Handle ZIP, XML, or HTML file selection
  const handleXmlFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const fileName = file.name.toLowerCase();
    const isZip = fileName.endsWith('.zip');
    const isXml = fileName.endsWith('.xml');
    const isHtml = fileName.endsWith('.html') || fileName.endsWith('.htm');
    
    if (!isZip && !isXml && !isHtml) {
      toast({
        title: "Invalid File",
        description: "Please select a ZIP file (with images), XML file, or HTML file",
        variant: "destructive",
      });
      return;
    }
    
    setXmlFileName(file.name);
    setXmlProcessing(true);
    
    try {
      if (isZip) {
        // Process ZIP file containing XML/HTML and images
        const zip = await JSZip.loadAsync(file);
        
        // Find the XML or HTML file in the ZIP
        let dataFile: JSZip.JSZipObject | null = null;
        let dataPath = "";
        let isHtmlData = false;
        
        zip.forEach((path, zipEntry) => {
          const lowerPath = path.toLowerCase();
          if (!zipEntry.dir) {
            // Prefer XML over HTML if both exist
            if (lowerPath.endsWith('.xml')) {
              dataFile = zipEntry;
              dataPath = path;
              isHtmlData = false;
            } else if (!dataFile && (lowerPath.endsWith('.html') || lowerPath.endsWith('.htm'))) {
              dataFile = zipEntry;
              dataPath = path;
              isHtmlData = true;
            }
          }
        });
        
        if (!dataFile) {
          throw new Error("No XML or HTML file found in the ZIP archive");
        }
        
        // Parse XML or HTML
        const dataText = await (dataFile as JSZip.JSZipObject).async("text");
        const items = isHtmlData 
          ? parseNavisworksHtml(dataText) 
          : parseNavisworksXml(dataText);
        
        if (items.length === 0) {
          throw new Error(isHtmlData 
            ? "No viewpoints found in the HTML file" 
            : "No clashes found in the XML file");
        }
        
        // Load images from ZIP
        const imagePromises = items.map(async (item) => {
          if (!item.imagePath) return item;
          
          // Normalize path separators and try to find image in ZIP
          const normalizedPath = item.imagePath.replace(/\\/g, '/');
          
          // Try different path variations
          const pathsToTry = [
            normalizedPath,
            normalizedPath.toLowerCase(),
            // Try with parent folder from data file path
            dataPath.replace(/[^/]*$/, '') + normalizedPath,
            // Try just the filename (for HTML exports where images are at root)
            normalizedPath.split('/').pop() || normalizedPath,
          ];
          
          for (const tryPath of pathsToTry) {
            const imageEntry = zip.file(tryPath);
            if (imageEntry) {
              try {
                const imageData = await imageEntry.async("base64");
                const ext = tryPath.split('.').pop()?.toLowerCase() || 'jpg';
                const mimeType = ext === 'png' ? 'image/png' : 'image/jpeg';
                return { ...item, imageData: `data:${mimeType};base64,${imageData}` };
              } catch {
                // Continue to next path
              }
            }
          }
          
          return item;
        });
        
        const itemsWithImages = await Promise.all(imagePromises);
        const imagesLoaded = itemsWithImages.filter(c => c.imageData).length;
        
        setXmlClashes(itemsWithImages);
        toast({
          title: "ZIP Processed",
          description: isHtmlData 
            ? `Found ${items.length} viewpoint(s), ${imagesLoaded} with images`
            : `Found ${items.length} clash(es), ${imagesLoaded} with images`,
        });
        
      } else if (isHtml) {
        // Process standalone HTML file (no images)
        const text = await file.text();
        const viewpoints = parseNavisworksHtml(text);
        
        if (viewpoints.length === 0) {
          throw new Error("No viewpoints found in the HTML file");
        }
        
        setXmlClashes(viewpoints);
        toast({
          title: "HTML Parsed",
          description: `Found ${viewpoints.length} viewpoint(s). Upload a ZIP file to include images.`,
        });
      } else {
        // Process standalone XML file (no images)
        const text = await file.text();
        const clashes = parseNavisworksXml(text);
        
        if (clashes.length === 0) {
          throw new Error("No clashes found in the XML file");
        }
        
        setXmlClashes(clashes);
        toast({
          title: "XML Parsed",
          description: `Found ${clashes.length} clash(es). Upload a ZIP file to include images.`,
        });
      }
    } catch (error: any) {
      toast({
        title: "Parse Error",
        description: error.message || "Failed to process file",
        variant: "destructive",
      });
      setXmlClashes([]);
      setXmlFileName("");
    } finally {
      setXmlProcessing(false);
      // Reset file input
      if (xmlInputRef.current) {
        xmlInputRef.current.value = "";
      }
    }
  };

  // Handle clash/viewpoint selection
  const handleClashSelect = (clash: NavisworksClash) => {
    setSelectedClash(clash);
    
    const isViewpoint = clash.clashType === "Viewpoint";
    
    // Set title based on type
    if (isViewpoint) {
      setTitle(clash.name);
    } else {
      setTitle(`${clash.name} - ${clash.gridLocation || 'No Grid'}`);
    }
    
    // Build detailed description based on type
    const parts: string[] = [];
    
    if (isViewpoint) {
      // Viewpoint description
      parts.push(`Navisworks Viewpoint: ${clash.name}`);
      
      // Camera position
      if (clash.clashPoint) {
        parts.push("");
        parts.push("CAMERA POSITION:");
        parts.push(`X: ${clash.clashPoint.x}`);
        parts.push(`Y: ${clash.clashPoint.y}`);
        parts.push(`Z: ${clash.clashPoint.z}`);
      }
    } else {
      // Clash description
      parts.push(`${clash.clashType} Clash`);
      if (clash.distance) {
        const dist = parseFloat(clash.distance);
        parts.push(`Penetration: ${Math.abs(dist).toFixed(3)}m`);
      }
      
      // Grid location
      if (clash.gridLocation) {
        parts.push(`Location: ${clash.gridLocation}`);
      }
      
      // Clashing elements with Element IDs
      parts.push("");
      parts.push("CLASHING ELEMENTS:");
      parts.push(`• ${clash.item1.itemName}`);
      if (clash.item1.elementId) {
        parts.push(`  Element ID: ${clash.item1.elementId}`);
      }
      parts.push(`• ${clash.item2.itemName}`);
      if (clash.item2.elementId) {
        parts.push(`  Element ID: ${clash.item2.elementId}`);
      }
      
      // Coordinates
      if (clash.clashPoint) {
        parts.push("");
        parts.push(`Coordinates: X=${clash.clashPoint.x}, Y=${clash.clashPoint.y}, Z=${clash.clashPoint.z}`);
      }
      
      // Date
      if (clash.createdDate) {
        parts.push(`Created: ${clash.createdDate}`);
      }
    }
    
    setDescription(parts.join('\n'));
    
    // Set image if available
    if (clash.imageData) {
      setImagePreview(clash.imageData);
    }
    
    setStep("edit");
  };

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      try {
        const resizedDataUrl = await resizeImage(file);
        setImagePreview(resizedDataUrl);
      } catch (error) {
        console.error('Error resizing image:', error);
      }
    }
  };

  const handleRemoveImage = () => {
    setImagePreview(null);
    setImageFile(null);
    if (imageInputRef.current) {
      imageInputRef.current.value = "";
    }
  };

  const handleDocumentSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    
    for (const file of Array.from(files)) {
      try {
        const dataUrl = await resizeImage(file);
        setUploadedFiles(prev => [...prev, {
          name: file.name,
          type: file.type,
          size: formatFileSize(file.size),
          dataUrl,
        }]);
      } catch (error) {
        console.error('Error processing file:', error);
      }
    }
    
    if (documentInputRef.current) {
      documentInputRef.current.value = "";
    }
  };

  const handleRemoveDocument = (index: number) => {
    setUploadedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const startMode = (newMode: AddMode) => {
    setMode(newMode);
    setStep(newMode === "manual" ? "edit" : "select");
    setIsOpen(true);
  };

  const handleEmailSelect = async (email: Email) => {
    setTitle(email.subject);
    setDescription(email.body);
    
    // Collect all attachments (regular + inline images) with their original order preserved
    const allAttachments = [
      ...(email.attachments || []),
      ...(email.inlineImages || [])
    ];
    
    if (allAttachments.length > 0) {
      setAttachmentsLoading(true);
      toast({
        title: "Loading Attachments",
        description: `Fetching ${allAttachments.length} attachment(s) from email...`,
      });
      
      try {
        // Fetch all attachments in parallel, keeping track of original indices
        const fetchResults = await Promise.all(
          allAttachments.map(async (att, index) => {
            const fetched = await fetchEmailAttachment(email.id, att);
            return { attachment: fetched, originalIndex: index };
          })
        );
        
        // Filter out nulls (failed fetches) and sort by original index to maintain order
        const validResults = fetchResults
          .filter((result): result is { attachment: EmailAttachment; originalIndex: number } => 
            result.attachment !== null && !!result.attachment.data
          )
          .sort((a, b) => a.originalIndex - b.originalIndex);
        
        const validAttachments = validResults.map(r => r.attachment);
        const failedCount = allAttachments.length - validAttachments.length;
        
        setImportedAttachments(validAttachments);
        
        // Show warning if some attachments failed
        if (failedCount > 0) {
          toast({
            title: "Warning",
            description: `${failedCount} attachment(s) could not be loaded`,
            variant: "destructive",
          });
        }
        
        // Find the LAST image in the original order to use as preview (clash detection image)
        const imageAttachments = validAttachments.filter(att => att.isImage);
        if (imageAttachments.length > 0) {
          // Take the last image (last in array = last in original email order)
          const lastImage = imageAttachments[imageAttachments.length - 1];
          // Convert base64 to data URL for preview
          try {
            const dataUrl = `data:${lastImage.mimeType};base64,${lastImage.data}`;
            setImagePreview(dataUrl);
            
            toast({
              title: "Preview Image Set",
              description: `"${lastImage.filename}" set as clash detection image`,
            });
          } catch (err) {
            console.error('Error setting image preview:', err);
          }
        }
        
        // Convert non-image attachments to uploaded files format
        const nonImageFiles: UploadedFile[] = validAttachments
          .filter(att => !att.isImage)
          .map(att => ({
            name: att.filename,
            type: att.mimeType,
            size: formatFileSize(att.size),
            dataUrl: `data:${att.mimeType};base64,${att.data}`,
          }));
        
        // Also add images as uploaded files (except the last one which is preview)
        const imageFiles: UploadedFile[] = imageAttachments
          .slice(0, -1) // All except last (which becomes the preview)
          .map(att => ({
            name: att.filename,
            type: att.mimeType,
            size: formatFileSize(att.size),
            dataUrl: `data:${att.mimeType};base64,${att.data}`,
          }));
        
        setUploadedFiles([...nonImageFiles, ...imageFiles]);
        
        if (validAttachments.length > 0) {
          toast({
            title: "Attachments Imported",
            description: `${validAttachments.length} file(s) imported from email`,
          });
        }
      } catch (error) {
        console.error('Error fetching attachments:', error);
        toast({
          title: "Error",
          description: "Failed to import attachments from email",
          variant: "destructive",
        });
      } finally {
        setAttachmentsLoading(false);
      }
    }
    
    setStep("edit");
  };

  const handleFileUpload = (type: "excel" | "xml") => {
    // Mock file upload delay
    toast({
      title: "Processing File",
      description: `Parsing ${type === 'excel' ? 'Excel' : 'XML'} file...`,
    });
    
    setTimeout(() => {
      if (type === "xml") {
        setTitle("Clash Report: Mech vs Struct L3");
        setDescription("Imported from Navisworks XML Report generated on 2024-11-27. Contains 15 unresolved clashes.");
      } else {
        setTitle("Points Import - Site Walkthrough");
        setDescription("Imported from site_issues_log.xlsx");
      }
      setStep("edit");
    }, 1000);
  };

  const handleSubmit = () => {
    const attachments = uploadedFiles.map(f => ({
      name: f.name,
      type: f.type.startsWith('image/') ? 'img' : 
            f.type === 'application/pdf' ? 'pdf' : 
            f.type.includes('dwg') ? 'dwg' : 'doc',
      size: f.size,
      url: f.dataUrl,
    }));
    
    // Convert assignment value to display name for storage
    const assignedToDisplay = getAssignedToDisplayName();
    
    // Determine assignedToRef - canonical identifier for stable lookups
    // Only set if we have a prefixed identifier (not legacy plain text)
    const assignedToRef = assignedTo.startsWith("attendee:") || assignedTo.startsWith("company:") 
      ? assignedTo 
      : null;
    
    onAddPoint({
      title,
      description,
      assignedTo: assignedToDisplay,
      assignedToRef,
      status,
      image: imagePreview || "",
      attachments,
      disciplines: selectedDisciplines
    });
    setIsOpen(false);
  };

  // Filter emails by search query (client-side filtering for quick search)
  const filteredEmails = emails.filter((e: Email) => 
    e.subject.toLowerCase().includes(searchQuery.toLowerCase()) || 
    e.from.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button className="gap-2">
            <Plus className="h-4 w-4" /> Add Point
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuItem onClick={() => startMode("manual")}>
            <PenTool className="mr-2 h-4 w-4" />
            Manually
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => startMode("email")}>
            <Mail className="mr-2 h-4 w-4" />
            From Email
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => startMode("excel")}>
            <FileSpreadsheet className="mr-2 h-4 w-4" />
            From Excel File
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => startMode("xml")}>
            <FileCode className="mr-2 h-4 w-4" />
            From Navisworks XML
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle>
            {step === "select" && mode === "email" && "Select Emails to Import"}
            {step === "select" && (mode === "excel" || mode === "xml") && `Import from ${mode === "excel" ? "Excel" : "Navisworks XML"}`}
            {step === "edit" && emailBulkMode && "Create Points from Emails"}
            {step === "edit" && xmlBulkMode && "Create Points from Clashes"}
            {step === "edit" && !emailBulkMode && !xmlBulkMode && "Edit Point Details"}
          </DialogTitle>
          <DialogDescription className="sr-only">
            Add a new coordination point to track issues and action items
          </DialogDescription>
        </DialogHeader>

        {/* STEP 1: SELECTION / IMPORT */}
        {step === "select" && mode === "email" && (
          <div className="space-y-4">
            {/* Header with Select All / Deselect All */}
            {!emailsLoading && !emailsError && emails.length > 0 && (
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Mail className="h-4 w-4" />
                  <span className="text-primary font-medium">({emails.length} emails)</span>
                </div>
                <div className="flex items-center gap-2">
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={selectAllEmails}
                    data-testid="button-select-all-emails"
                  >
                    Select All
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={deselectAllEmails}
                    data-testid="button-deselect-all-emails"
                  >
                    Deselect All
                  </Button>
                </div>
              </div>
            )}
            
            {/* Selection count */}
            {selectedEmailIds.size > 0 && (
              <div className="flex items-center justify-between bg-primary/10 rounded-lg px-3 py-2">
                <span className="text-sm font-medium">
                  {selectedEmailIds.size} email{selectedEmailIds.size > 1 ? 's' : ''} selected
                </span>
                <Button 
                  size="sm"
                  onClick={handleProceedWithSelectedEmails}
                  data-testid="button-proceed-selected-emails"
                >
                  Continue with Selected
                </Button>
              </div>
            )}
            
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Search emails by subject or sender..." 
                className="pl-9"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                data-testid="input-email-search"
              />
            </div>
            <ScrollArea className="h-[280px] rounded-md border">
              <div className="p-1">
                {emailsLoading && (
                  <div className="p-8 text-center">
                    <Loader2 className="h-8 w-8 mx-auto mb-3 animate-spin text-primary" />
                    <p className="text-sm text-muted-foreground">Loading emails from your inbox...</p>
                  </div>
                )}
                
                {emailsError && !emailsLoading && (
                  <div className="p-8 text-center">
                    <AlertCircle className="h-8 w-8 mx-auto mb-3 text-destructive" />
                    <p className="text-sm font-medium text-destructive mb-2">Unable to load emails</p>
                    <p className="text-xs text-muted-foreground">{emailsError}</p>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="mt-4"
                      onClick={() => fetchEmails()}
                    >
                      Try Again
                    </Button>
                  </div>
                )}
                
                {!emailsLoading && !emailsError && filteredEmails.map((email: Email) => {
                  const attachmentCount = (email.attachments?.length || 0) + (email.inlineImages?.length || 0);
                  const imageCount = (email.attachments?.filter(a => a.isImage).length || 0) + (email.inlineImages?.length || 0);
                  const isSelected = selectedEmailIds.has(email.id);
                  
                  return (
                    <div 
                      key={email.id}
                      onClick={() => toggleEmailSelection(email.id)}
                      className={cn(
                        "flex gap-3 p-3 cursor-pointer rounded-md transition-colors border-b last:border-0",
                        isSelected 
                          ? "bg-primary/10 border-primary" 
                          : "hover:bg-muted/50"
                      )}
                      data-testid={`email-item-${email.id}`}
                    >
                      {/* Checkbox */}
                      <div className="flex items-center pt-1">
                        <Checkbox 
                          checked={isSelected}
                          onCheckedChange={() => toggleEmailSelection(email.id)}
                          onClick={(e) => e.stopPropagation()}
                          data-testid={`checkbox-email-${email.id}`}
                        />
                      </div>
                      
                      {/* Email content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-start">
                          <span className="font-medium text-sm">{email.from}</span>
                          <span className="text-xs text-muted-foreground">
                            {email.date ? new Date(email.date).toLocaleDateString() : ''}
                          </span>
                        </div>
                        <span className="font-semibold text-sm truncate block">{email.subject}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground line-clamp-1 flex-1">{email.snippet}</span>
                          {attachmentCount > 0 && (
                            <div className="flex items-center gap-1 text-xs text-primary shrink-0">
                              <Paperclip className="h-3 w-3" />
                              <span>{attachmentCount}</span>
                              {imageCount > 0 && (
                                <span className="text-muted-foreground">({imageCount} img)</span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
                
                {!emailsLoading && !emailsError && filteredEmails.length === 0 && emails.length > 0 && (
                  <div className="p-8 text-center text-muted-foreground text-sm">
                    No emails found matching "{searchQuery}".
                  </div>
                )}
                
                {!emailsLoading && !emailsError && emails.length === 0 && (
                  <div className="p-8 text-center text-muted-foreground text-sm">
                    No emails found in your inbox.
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>
        )}

        {step === "select" && mode === "excel" && (
          <div className="flex flex-col items-center justify-center py-12 border-2 border-dashed rounded-lg bg-muted/10 hover:bg-muted/20 transition-colors cursor-pointer"
               onClick={() => handleFileUpload("excel")}>
            <UploadCloud className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-sm font-medium">Click to upload .xlsx, .csv file</p>
            <p className="text-xs text-muted-foreground mt-1">or drag and drop here</p>
          </div>
        )}

        {step === "select" && mode === "xml" && (
          <div className="space-y-4">
            {/* Hidden file input - accepts both ZIP and XML */}
            <input
              type="file"
              ref={xmlInputRef}
              accept=".xml,.zip,.html,.htm"
              onChange={handleXmlFileSelect}
              className="hidden"
              data-testid="input-xml-upload"
            />
            
            {/* Upload area - shown when no clashes loaded */}
            {xmlClashes.length === 0 && !xmlProcessing && (
              <div 
                className="flex flex-col items-center justify-center py-12 border-2 border-dashed rounded-lg bg-muted/10 hover:bg-muted/20 transition-colors cursor-pointer"
                onClick={() => xmlInputRef.current?.click()}
                data-testid="button-upload-xml"
              >
                <FileCode className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-sm font-medium">Click to upload Navisworks export</p>
                <p className="text-xs text-muted-foreground mt-1">ZIP (with images), XML (clashes), or HTML (viewpoints)</p>
              </div>
            )}
            
            {/* Processing indicator */}
            {xmlProcessing && (
              <div className="flex flex-col items-center justify-center py-12">
                <Loader2 className="h-12 w-12 text-primary animate-spin mb-4" />
                <p className="text-sm font-medium">Processing Navisworks export...</p>
                <p className="text-xs text-muted-foreground mt-1">Parsing data and loading images</p>
              </div>
            )}
            
            {/* Clash list - shown after file is parsed */}
            {xmlClashes.length > 0 && !xmlProcessing && (
              <>
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <FileCode className="h-4 w-4" />
                    <span className="truncate max-w-[150px]">{xmlFileName}</span>
                    <span className="text-primary font-medium">({xmlClashes.length} item{xmlClashes.length !== 1 ? 's' : ''})</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={selectAllClashes}
                      data-testid="button-select-all"
                    >
                      Select All
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={deselectAllClashes}
                      data-testid="button-deselect-all"
                    >
                      Deselect All
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => {
                        setXmlClashes([]);
                        setXmlFileName("");
                        setXmlSearchQuery("");
                        setSelectedClashIds(new Set());
                      }}
                      data-testid="button-clear-xml"
                    >
                      Clear
                    </Button>
                  </div>
                </div>
                
                {/* Selection count */}
                {selectedClashIds.size > 0 && (
                  <div className="flex items-center justify-between bg-primary/10 rounded-lg px-3 py-2">
                    <span className="text-sm font-medium">
                      {selectedClashIds.size} item{selectedClashIds.size > 1 ? 's' : ''} selected
                    </span>
                    <Button 
                      size="sm"
                      onClick={handleProceedWithSelected}
                      data-testid="button-proceed-selected"
                    >
                      Continue with Selected
                    </Button>
                  </div>
                )}
                
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input 
                    placeholder="Search by name, grid, or element..." 
                    className="pl-9"
                    value={xmlSearchQuery}
                    onChange={(e) => setXmlSearchQuery(e.target.value)}
                    data-testid="input-xml-search"
                  />
                </div>
                
                <ScrollArea className="h-[280px] rounded-md border">
                  <div className="p-2 space-y-2">
                    {xmlClashes
                      .filter(clash => {
                        const q = xmlSearchQuery.toLowerCase();
                        return clash.name.toLowerCase().includes(q) ||
                          clash.item1.itemName.toLowerCase().includes(q) ||
                          clash.item2.itemName.toLowerCase().includes(q) ||
                          clash.gridLocation.toLowerCase().includes(q) ||
                          clash.item1.elementId.includes(q) ||
                          clash.item2.elementId.includes(q);
                      })
                      .map((clash) => {
                        const isSelected = selectedClashIds.has(clash.id);
                        return (
                          <div 
                            key={clash.id}
                            onClick={() => toggleClashSelection(clash.id)}
                            className={cn(
                              "flex gap-3 p-2 cursor-pointer rounded-lg transition-colors border",
                              isSelected 
                                ? "bg-primary/10 border-primary" 
                                : "bg-card hover:bg-muted/50"
                            )}
                            data-testid={`clash-item-${clash.id}`}
                          >
                            {/* Checkbox */}
                            <div className="flex items-center">
                              <Checkbox 
                                checked={isSelected}
                                onCheckedChange={() => toggleClashSelection(clash.id)}
                                onClick={(e) => e.stopPropagation()}
                                data-testid={`checkbox-clash-${clash.id}`}
                              />
                            </div>
                            
                            {/* Thumbnail */}
                            <div className="flex-shrink-0 w-16 h-14 rounded overflow-hidden bg-muted">
                              {clash.imageData ? (
                                <img 
                                  src={clash.imageData} 
                                  alt={clash.name}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center">
                                  <ImagePlus className="h-5 w-5 text-muted-foreground/50" />
                                </div>
                              )}
                            </div>
                            
                            {/* Content */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between gap-2">
                                <div>
                                  <span className="font-semibold text-sm">{clash.name}</span>
                                  {clash.gridLocation && (
                                    <span className="text-xs text-muted-foreground ml-2">{clash.gridLocation}</span>
                                  )}
                                </div>
                                <div className="flex items-center gap-1 flex-shrink-0">
                                  <span className={cn(
                                    "px-1.5 py-0.5 rounded text-[10px] font-medium uppercase",
                                    clash.status.toLowerCase() === "new" && "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
                                    clash.status.toLowerCase() === "active" && "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300",
                                    clash.status.toLowerCase() === "reviewed" && "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300",
                                    clash.status.toLowerCase() === "resolved" && "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
                                    clash.status.toLowerCase() === "approved" && "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300",
                                  )}>
                                    {clash.status}
                                  </span>
                                </div>
                              </div>
                              <div className="text-xs text-muted-foreground mt-1 space-y-0.5">
                                <div className="truncate">• {clash.item1.itemName}</div>
                                <div className="truncate">• {clash.item2.itemName}</div>
                              </div>
                              {clash.distance && (
                                <div className="text-[10px] text-muted-foreground mt-1">
                                  Penetration: {Math.abs(parseFloat(clash.distance)).toFixed(3)}m
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    
                    {xmlClashes.filter(clash => {
                      const q = xmlSearchQuery.toLowerCase();
                      return clash.name.toLowerCase().includes(q) ||
                        clash.item1.itemName.toLowerCase().includes(q) ||
                        clash.item2.itemName.toLowerCase().includes(q) ||
                        clash.gridLocation.toLowerCase().includes(q);
                    }).length === 0 && (
                      <div className="p-8 text-center text-muted-foreground text-sm">
                        No clashes found matching "{xmlSearchQuery}".
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </>
            )}
          </div>
        )}

        {/* STEP 2: EDITING - BULK MODE (Multiple emails) */}
        {step === "edit" && emailBulkMode && (
          <ScrollArea className="flex-1 overflow-y-auto pr-4">
            <div className="grid gap-4 py-4">
              {/* Selected emails summary */}
              <div className="bg-muted/50 rounded-lg p-4">
                <h4 className="font-medium mb-2">Creating {selectedEmailIds.size} Points from Emails</h4>
                <div className="max-h-[120px] overflow-y-auto space-y-1">
                  {getSelectedEmails().map((email) => (
                    <div key={email.id} className="flex items-center gap-2 text-sm">
                      <Mail className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      <span className="truncate font-medium">{email.subject}</span>
                      <span className="text-xs text-muted-foreground flex-shrink-0">
                        from {email.from.split('<')[0].trim()}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
              
              <p className="text-sm text-muted-foreground">
                Set common properties for all selected emails. Each email will be created as a separate point with its subject as title and body as description.
              </p>
              
              {/* Common properties */}
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="bulk-email-assigned">Assign All To</Label>
                  <Popover open={assignmentOpen} onOpenChange={setAssignmentOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={assignmentOpen}
                        className="justify-between font-normal"
                        data-testid="button-bulk-email-assigned-to"
                      >
                        <span className="truncate">{getAssignmentLabel()}</span>
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[280px] p-0" align="start">
                      <Command>
                        <CommandInput placeholder="Search name, email, or company..." />
                        <CommandList>
                          <CommandEmpty>
                            <div className="py-2 text-center text-sm text-muted-foreground">
                              No matches found
                            </div>
                          </CommandEmpty>
                          
                          {attendees.length > 0 && (
                            <CommandGroup heading="Attendees">
                              {attendees.map((attendee) => (
                                <CommandItem
                                  key={attendee.id}
                                  value={`${attendee.name} ${attendee.email || ''} ${attendee.company || ''}`}
                                  onSelect={() => {
                                    setAssignedTo(`attendee:${attendee.id}`);
                                    setAssignmentOpen(false);
                                  }}
                                  className="flex items-center gap-2"
                                >
                                  <User className="h-4 w-4 text-muted-foreground" />
                                  <div className="flex flex-col">
                                    <span>{attendee.name}</span>
                                    {(attendee.email || attendee.company) && (
                                      <span className="text-xs text-muted-foreground">
                                        {attendee.email}{attendee.email && attendee.company ? ' • ' : ''}{attendee.company}
                                      </span>
                                    )}
                                  </div>
                                  {assignedTo === `attendee:${attendee.id}` && (
                                    <Check className="ml-auto h-4 w-4" />
                                  )}
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          )}
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>
                
                <div className="grid gap-2">
                  <Label htmlFor="bulk-email-status">Status for All</Label>
                  <Select value={status} onValueChange={setStatus}>
                    <SelectTrigger data-testid="select-bulk-email-status">
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="new">New</SelectItem>
                      <SelectItem value="open">Open</SelectItem>
                      <SelectItem value="closed">Closed</SelectItem>
                      <SelectItem value="postponed">Postponed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div className="grid gap-2">
                <Label>Disciplines for All</Label>
                <DisciplineMultiSelect
                  value={selectedDisciplines}
                  onChange={setSelectedDisciplines}
                />
              </div>
              
              <div className="flex justify-end gap-2 mt-4">
                <Button 
                  variant="outline" 
                  onClick={() => {
                    setEmailBulkMode(false);
                    setStep("select");
                  }}
                >
                  Back
                </Button>
                <Button 
                  onClick={handleEmailBulkCreate}
                  disabled={bulkCreating}
                  data-testid="button-create-all-email-points"
                >
                  {bulkCreating ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    `Create ${selectedEmailIds.size} Points`
                  )}
                </Button>
              </div>
            </div>
          </ScrollArea>
        )}

        {/* STEP 2: EDITING - BULK MODE (Multiple clashes) */}
        {step === "edit" && xmlBulkMode && (
          <ScrollArea className="flex-1 overflow-y-auto pr-4">
            <div className="grid gap-4 py-4">
              {/* Selected clashes summary */}
              <div className="bg-muted/50 rounded-lg p-4">
                <h4 className="font-medium mb-2">Creating {selectedClashIds.size} Points</h4>
                <div className="max-h-[120px] overflow-y-auto space-y-1">
                  {getSelectedClashes().map((clash) => (
                    <div key={clash.id} className="flex items-center gap-2 text-sm">
                      {clash.imageData && (
                        <img src={clash.imageData} alt="" className="w-8 h-6 object-cover rounded" />
                      )}
                      <span className="truncate">{clash.name}</span>
                      {clash.gridLocation && (
                        <span className="text-xs text-muted-foreground">({clash.gridLocation})</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
              
              <p className="text-sm text-muted-foreground">
                Set common properties for all selected clashes. Each clash will be created as a separate point with its own title, description, and image.
              </p>
              
              {/* Common properties */}
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="bulk-assigned">Assign All To</Label>
                  <Popover open={assignmentOpen} onOpenChange={setAssignmentOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={assignmentOpen}
                        className="justify-between font-normal"
                        data-testid="button-bulk-assigned-to"
                      >
                        <span className="truncate">{getAssignmentLabel()}</span>
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[280px] p-0" align="start">
                      <Command>
                        <CommandInput placeholder="Search name, email, or company..." />
                        <CommandList>
                          <CommandEmpty>
                            <div className="py-2 text-center text-sm text-muted-foreground">
                              No matches found
                            </div>
                          </CommandEmpty>
                          
                          {attendees.length > 0 && (
                            <CommandGroup heading="Attendees">
                              {attendees.map((attendee) => (
                                <CommandItem
                                  key={attendee.id}
                                  value={`${attendee.name} ${attendee.email || ''} ${attendee.company || ''}`}
                                  onSelect={() => {
                                    setAssignedTo(`attendee:${attendee.id}`);
                                    setAssignmentOpen(false);
                                  }}
                                  className="flex items-center gap-2"
                                >
                                  <User className="h-4 w-4 text-muted-foreground" />
                                  <div className="flex flex-col">
                                    <span>{attendee.name}</span>
                                    {(attendee.email || attendee.company) && (
                                      <span className="text-xs text-muted-foreground">
                                        {attendee.email}{attendee.email && attendee.company ? ' • ' : ''}{attendee.company}
                                      </span>
                                    )}
                                  </div>
                                  {assignedTo === `attendee:${attendee.id}` && (
                                    <Check className="ml-auto h-4 w-4" />
                                  )}
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          )}
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>
                
                <div className="grid gap-2">
                  <Label htmlFor="bulk-status">Status for All</Label>
                  <Select value={status} onValueChange={setStatus}>
                    <SelectTrigger data-testid="select-bulk-status">
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="new">New</SelectItem>
                      <SelectItem value="open">Open</SelectItem>
                      <SelectItem value="closed">Closed</SelectItem>
                      <SelectItem value="postponed">Postponed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div className="grid gap-2">
                <Label>Disciplines for All</Label>
                <DisciplineMultiSelect
                  value={selectedDisciplines}
                  onChange={setSelectedDisciplines}
                />
              </div>
              
              <div className="flex justify-end gap-2 mt-4">
                <Button 
                  variant="outline" 
                  onClick={() => {
                    setXmlBulkMode(false);
                    setStep("select");
                  }}
                >
                  Back
                </Button>
                <Button 
                  onClick={handleBulkCreate}
                  disabled={bulkCreating}
                  data-testid="button-create-all-points"
                >
                  {bulkCreating ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    `Create ${selectedClashIds.size} Points`
                  )}
                </Button>
              </div>
            </div>
          </ScrollArea>
        )}

        {/* STEP 2: EDITING - SINGLE MODE (Common for all other modes) */}
        {step === "edit" && !xmlBulkMode && (
          <ScrollArea className="flex-1 overflow-y-auto pr-4">
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="title">Point Title</Label>
                <Input 
                  id="title" 
                  value={title} 
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Enter point title"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="description">Description</Label>
                <Textarea 
                  id="description" 
                  value={description} 
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Enter detailed description..."
                  className="min-h-[120px]"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="assigned">Assigned To</Label>
                  <Popover open={assignmentOpen} onOpenChange={setAssignmentOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={assignmentOpen}
                        className="justify-between font-normal"
                        data-testid="button-assigned-to"
                      >
                        <span className="truncate">{getAssignmentLabel()}</span>
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[280px] p-0" align="start">
                      <Command>
                        <CommandInput placeholder="Search name, email, or company..." />
                        <CommandList>
                          <CommandEmpty>
                            <div className="py-2 text-center text-sm text-muted-foreground">
                              No matches found
                            </div>
                          </CommandEmpty>
                          
                          {attendees.length > 0 && (
                            <CommandGroup heading="Attendees">
                              {attendees.map((attendee) => (
                                <CommandItem
                                  key={attendee.id}
                                  value={`${attendee.name} ${attendee.email || ''} ${attendee.company || ''}`}
                                  onSelect={() => {
                                    setAssignedTo(`attendee:${attendee.id}`);
                                    setAssignmentOpen(false);
                                  }}
                                  className="flex items-center gap-2"
                                >
                                  <User className="h-4 w-4 text-muted-foreground" />
                                  <div className="flex flex-col">
                                    <span>{attendee.name}</span>
                                    {(attendee.email || attendee.company) && (
                                      <span className="text-xs text-muted-foreground">
                                        {attendee.email}{attendee.email && attendee.company ? ' • ' : ''}{attendee.company}
                                      </span>
                                    )}
                                  </div>
                                  {assignedTo === `attendee:${attendee.id}` && (
                                    <Check className="ml-auto h-4 w-4" />
                                  )}
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          )}
                          
                          {companies.length > 0 && (
                            <>
                              <CommandSeparator />
                              <CommandGroup heading="Companies">
                                {companies.map((company) => (
                                  <CommandItem
                                    key={company}
                                    value={company}
                                    onSelect={() => {
                                      setAssignedTo(`company:${company}`);
                                      setAssignmentOpen(false);
                                    }}
                                    className="flex items-center gap-2"
                                  >
                                    <Building2 className="h-4 w-4 text-muted-foreground" />
                                    <span>{company}</span>
                                    {assignedTo === `company:${company}` && (
                                      <Check className="ml-auto h-4 w-4" />
                                    )}
                                  </CommandItem>
                                ))}
                              </CommandGroup>
                            </>
                          )}
                          
                          <CommandSeparator />
                          <CommandGroup>
                            <CommandItem
                              onSelect={() => {
                                setAddAttendeeDialogOpen(true);
                                setAssignmentOpen(false);
                              }}
                              className="flex items-center gap-2 text-primary"
                            >
                              <UserPlus className="h-4 w-4" />
                              <span>Add New Attendee...</span>
                            </CommandItem>
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="status">Status</Label>
                  <Select value={status} onValueChange={setStatus}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="new">New</SelectItem>
                      <SelectItem value="open">Open</SelectItem>
                      <SelectItem value="closed">Closed</SelectItem>
                      <SelectItem value="postponed">Postponed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Disciplines */}
              <div className="grid gap-2">
                <Label>Disciplines</Label>
                <DisciplineMultiSelect
                  value={selectedDisciplines}
                  onChange={setSelectedDisciplines}
                  placeholder="Select disciplines (optional)"
                />
              </div>
              
              {/* Image Upload Area */}
              <div className="border rounded-md p-3 bg-muted/20 mt-2">
                 <Label className="text-xs text-muted-foreground mb-2 block">Clash Detection Image</Label>
                 <input 
                   type="file" 
                   ref={imageInputRef}
                   accept="image/*"
                   onChange={handleImageSelect}
                   className="hidden"
                   data-testid="input-image-upload"
                 />
                 {imagePreview ? (
                   <div className="relative">
                     <img 
                       src={imagePreview} 
                       alt="Selected preview" 
                       className="w-full h-40 object-cover rounded-md border"
                       data-testid="img-preview"
                     />
                     <Button 
                       variant="destructive" 
                       size="icon" 
                       className="absolute top-2 right-2 h-7 w-7"
                       onClick={handleRemoveImage}
                       data-testid="button-remove-image"
                     >
                       <X className="h-4 w-4" />
                     </Button>
                   </div>
                 ) : (
                   <div 
                     className="flex flex-col items-center justify-center py-6 border-2 border-dashed rounded-lg bg-background hover:bg-muted/30 transition-colors cursor-pointer"
                     onClick={() => imageInputRef.current?.click()}
                     data-testid="button-upload-image"
                   >
                     <ImagePlus className="h-8 w-8 text-muted-foreground mb-2" />
                     <p className="text-sm font-medium">Click to upload image</p>
                     <p className="text-xs text-muted-foreground mt-1">PNG, JPG, GIF up to 10MB</p>
                   </div>
                 )}
              </div>

              {/* Document Upload Area */}
              <div className="border rounded-md p-3 bg-muted/20">
                 <Label className="text-xs text-muted-foreground mb-2 block">Attachments (Documents & Files)</Label>
                 <input 
                   type="file" 
                   ref={documentInputRef}
                   accept=".pdf,.doc,.docx,.xls,.xlsx,.dwg,.dxf,.rvt,.ifc,.png,.jpg,.jpeg"
                   onChange={handleDocumentSelect}
                   multiple
                   className="hidden"
                   data-testid="input-document-upload"
                 />
                 
                 {uploadedFiles.length > 0 && (
                   <div className="space-y-2 mb-3">
                     {uploadedFiles.map((file, index) => {
                       const FileIcon = getFileIcon(file.type);
                       return (
                         <div 
                           key={index}
                           className="flex items-center justify-between p-2 bg-background rounded border"
                           data-testid={`attachment-item-${index}`}
                         >
                           <div className="flex items-center gap-2 min-w-0">
                             <FileIcon className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                             <span className="text-sm truncate">{file.name}</span>
                             <span className="text-xs text-muted-foreground flex-shrink-0">({file.size})</span>
                           </div>
                           <Button 
                             variant="ghost" 
                             size="icon" 
                             className="h-6 w-6 flex-shrink-0"
                             onClick={() => handleRemoveDocument(index)}
                             data-testid={`button-remove-attachment-${index}`}
                           >
                             <X className="h-3 w-3" />
                           </Button>
                         </div>
                       );
                     })}
                   </div>
                 )}
                 
                 <div 
                   className="flex flex-col items-center justify-center py-4 border-2 border-dashed rounded-lg bg-background hover:bg-muted/30 transition-colors cursor-pointer"
                   onClick={() => documentInputRef.current?.click()}
                   data-testid="button-upload-document"
                 >
                   <Paperclip className="h-6 w-6 text-muted-foreground mb-1" />
                   <p className="text-sm font-medium">Click to attach files</p>
                   <p className="text-xs text-muted-foreground mt-1">PDF, Word, Excel, CAD files, Images</p>
                 </div>
              </div>

              <div className="flex justify-end gap-2 mt-4">
                 <Button variant="outline" onClick={() => setIsOpen(false)}>Cancel</Button>
                 <Button onClick={handleSubmit}>Save Point</Button>
              </div>
            </div>
          </ScrollArea>
        )}
      </DialogContent>

      {/* Add New Attendee Dialog */}
      <Dialog open={addAttendeeDialogOpen} onOpenChange={setAddAttendeeDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add New Attendee</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="new-name">Name *</Label>
              <Input
                id="new-name"
                value={newAttendee.name}
                onChange={(e) => setNewAttendee(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Enter name"
                data-testid="input-new-attendee-name"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="new-email">Email</Label>
              <Input
                id="new-email"
                type="email"
                value={newAttendee.email}
                onChange={(e) => setNewAttendee(prev => ({ ...prev, email: e.target.value }))}
                placeholder="Enter email"
                data-testid="input-new-attendee-email"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="new-role">Role</Label>
                <Input
                  id="new-role"
                  value={newAttendee.role}
                  onChange={(e) => setNewAttendee(prev => ({ ...prev, role: e.target.value }))}
                  placeholder="e.g. BIM Manager"
                  data-testid="input-new-attendee-role"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="new-company">Company</Label>
                <Input
                  id="new-company"
                  value={newAttendee.company}
                  onChange={(e) => setNewAttendee(prev => ({ ...prev, company: e.target.value }))}
                  placeholder="Enter company"
                  data-testid="input-new-attendee-company"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddAttendeeDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddNewAttendee} data-testid="button-save-new-attendee">
              Add & Assign
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}
