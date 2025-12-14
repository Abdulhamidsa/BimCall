import type { Meeting, Point, Attendee, StatusUpdate, Attachment } from "@shared/schema";

// Extended types for frontend that include related data
export interface MeetingWithRelations extends Meeting {
  attendees: Attendee[];
  points: PointWithRelations[];
}

export interface PointWithRelations extends Point {
  statusUpdates: StatusUpdate[];
  attachments: Attachment[];
}

export type Status = "open" | "new" | "ongoing" | "closed" | "postponed";
