import { addDays, format, subDays } from "date-fns";

// Import the generated assets
import clashImage from "@assets/generated_images/bim_3d_model_wireframe_showing_hvac_and_structural_clash.png";
import lobbyImage from "@assets/generated_images/bim_3d_model_of_a_modern_office_lobby.png";

export type Status = "open" | "new" | "ongoing" | "closed" | "postponed";

export interface Attachment {
  id: string;
  name: string;
  type: "pdf" | "img" | "dwg";
  size: string;
}

export interface StatusUpdate {
  id: string;
  date: string;
  status: string; // Text description of status update
  actionOn: string; // Person responsible
}

export interface Point {
  id: string;
  meetingId: string;
  title: string;
  description: string;
  image: string;
  status: Status;
  assignedTo: string;
  dueDate: string;
  attachments: Attachment[];
  statusUpdates: StatusUpdate[];
}

export interface Attendee {
  id: string;
  name: string;
  email: string;
  role: string;
  avatar: string;
  status: "accepted" | "declined" | "tentative";
}

export interface Meeting {
  id: string;
  title: string;
  date: string; // ISO string
  startTime: string;
  endTime: string;
  location: string;
  platform: "outlook" | "gmail";
  project: string;
  attendees: Attendee[];
  points: Point[];
}

export interface Email {
  id: string;
  subject: string;
  from: string;
  date: string;
  snippet: string;
  body: string; // Full body content
}

// Mock Data
export const mockEmails: Email[] = [
  {
    id: "E-1",
    subject: "Re: Fire Protection Clash L4",
    from: "mike@mep.com",
    date: "Today, 9:42 AM",
    snippet: "The sprinkler main is hitting the cable tray...",
    body: "Hi Alex,\n\nI'm looking at the Level 4 model and the sprinkler main is hitting the cable tray in the corridor. We need to decide who moves. I've attached a screenshot below.\n\nThanks,\nMike"
  },
  {
    id: "E-2",
    subject: "Structural Loading for RTU-3",
    from: "sarah@struct.com",
    date: "Yesterday, 4:15 PM",
    snippet: "We need to confirm the operating weight of the new unit...",
    body: "Team,\n\nWe need to confirm the operating weight of the new RTU-3 unit. The current structural design assumes 2500lbs but the cut sheet says 2800lbs. This might require dunnage reinforcement.\n\nRegards,\nSarah"
  },
  {
    id: "E-3",
    subject: "Glazing Mullion Detail",
    from: "david@arch.com",
    date: "Yesterday, 2:30 PM",
    snippet: "The detail 5/A401 shows a conflict with the column...",
    body: "The detail 5/A401 shows a conflict with the column enclosure. Can we shift the mullion 4 inches to the right to clear the wrap?\n\n- David"
  },
  {
    id: "E-4",
    subject: "Basement Sump Pump Location",
    from: "mike@mep.com",
    date: "Nov 24, 11:00 AM",
    snippet: "Architectural layout has changed in the basement...",
    body: "Architectural layout has changed in the basement and now the sump pump pit is under a partition wall. Please advise on new location.\n\nMike"
  }
];

export const mockAttendees: Attendee[] = [
  { id: "1", name: "Alex Chen", email: "alex@bimcoord.com", role: "BIM Manager", avatar: "AC", status: "accepted" },
  { id: "2", name: "Sarah Jones", email: "sarah@struct.com", role: "Structural Eng", avatar: "SJ", status: "accepted" },
  { id: "3", name: "Mike Ross", email: "mike@mep.com", role: "MEP Lead", avatar: "MR", status: "tentative" },
  { id: "4", name: "David Kim", email: "david@arch.com", role: "Architect", avatar: "DK", status: "accepted" },
];

export const mockPoints: Point[] = [
  {
    id: "P-101",
    meetingId: "M-1",
    title: "HVAC Duct Clash with Beam at Grid B4",
    description: "The main supply duct is clashing with the primary steel beam on Level 3. We need to reroute the duct or request a web penetration.",
    image: clashImage,
    status: "new",
    assignedTo: "Mike Ross",
    dueDate: format(addDays(new Date(), 7), "yyyy-MM-dd"),
    attachments: [
      { id: "a1", name: "L3-Mech-Layout.pdf", type: "pdf", size: "2.4 MB" },
      { id: "a2", name: "Clash-Report-04.csv", type: "pdf", size: "120 KB" }
    ],
    statusUpdates: [
      { 
        id: "u1", 
        date: format(new Date(), "yyyy-MM-dd"), 
        status: "Identified clash during model federation. Assigned to Mechanical team for review.",
        actionOn: "Mike Ross"
      }
    ]
  },
  {
    id: "P-102",
    meetingId: "M-1",
    title: "Lobby Ceiling Height Clearance",
    description: "The drop ceiling in the lobby is conflicting with the storefront glazing header detail. Verify clear height requirements.",
    image: lobbyImage,
    status: "ongoing",
    assignedTo: "David Kim",
    dueDate: format(addDays(new Date(), 3), "yyyy-MM-dd"),
    attachments: [
      { id: "a3", name: "Arch-Elevations.dwg", type: "dwg", size: "5.1 MB" }
    ],
    statusUpdates: [
      { 
        id: "u2", 
        date: format(subDays(new Date(), 7), "yyyy-MM-dd"), 
        status: "Initial issue raised by ID team.",
        actionOn: "David Kim"
      },
      { 
        id: "u3", 
        date: format(new Date(), "yyyy-MM-dd"), 
        status: "Architect proposes lowering ceiling by 2 inches. Waiting for client approval.",
        actionOn: "Alex Chen"
      }
    ]
  },
  {
    id: "P-103",
    meetingId: "M-1",
    title: "Electrical Room Door Swing",
    description: "Door swing into the electrical room violates code clearance for panels. Need to reverse swing or move panels.",
    image: "https://images.unsplash.com/photo-1581094794329-cd8119604f89?auto=format&fit=crop&q=80&w=1000",
    status: "open",
    assignedTo: "Alex Chen",
    dueDate: format(addDays(new Date(), 5), "yyyy-MM-dd"),
    attachments: [],
    statusUpdates: [
      { 
        id: "u4", 
        date: format(new Date(), "yyyy-MM-dd"), 
        status: "Code violation confirmed. Arch to revise door schedule.",
        actionOn: "David Kim"
      }
    ]
  },
  {
    id: "P-104",
    meetingId: "M-2",
    title: "Facade Anchor Points",
    description: "Structural embeds for facade system missed in concrete pour. Need remedial anchor detail.",
    image: "https://images.unsplash.com/photo-1503387762-592deb58ef4e?auto=format&fit=crop&q=80&w=1000",
    status: "postponed",
    assignedTo: "Sarah Jones",
    dueDate: format(addDays(new Date(), 14), "yyyy-MM-dd"),
    attachments: [],
    statusUpdates: [
      { 
        id: "u5", 
        date: format(subDays(new Date(), 2), "yyyy-MM-dd"), 
        status: "Site survey completed. Waiting for structural calculations.",
        actionOn: "Sarah Jones"
      }
    ]
  }
];

export const mockMeetings: Meeting[] = [
  {
    id: "M-1",
    title: "Weekly Coordination - Tower A",
    date: format(new Date(), "yyyy-MM-dd"),
    startTime: "10:00",
    endTime: "11:30",
    location: "Conf Room B / Teams",
    platform: "outlook",
    project: "Skyline Tower A",
    attendees: mockAttendees,
    points: mockPoints.filter(p => p.meetingId === "M-1")
  },
  {
    id: "M-2",
    title: "Facade Review Workshop",
    date: format(addDays(new Date(), 2), "yyyy-MM-dd"),
    startTime: "14:00",
    endTime: "15:00",
    location: "Site Office",
    platform: "gmail",
    project: "Skyline Tower A",
    attendees: [mockAttendees[0], mockAttendees[1], mockAttendees[3]],
    points: mockPoints.filter(p => p.meetingId === "M-2")
  },
  {
    id: "M-3",
    title: "MEP Sign-off Level 4-10",
    date: format(subDays(new Date(), 5), "yyyy-MM-dd"),
    startTime: "09:00",
    endTime: "12:00",
    location: "Zoom",
    platform: "outlook",
    project: "Skyline Tower A",
    attendees: mockAttendees,
    points: []
  }
];
