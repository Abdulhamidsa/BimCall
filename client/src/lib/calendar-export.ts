import type { Meeting, Attendee } from "@shared/schema";
import { format } from "date-fns";

function formatDateForICS(date: string, time: string): string {
  const [year, month, day] = date.split("-");
  const [hours, minutes] = time.split(":");
  return `${year}${month}${day}T${hours}${minutes}00`;
}

function escapeICSText(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n");
}

function foldLine(line: string): string {
  const maxLength = 75;
  if (line.length <= maxLength) return line;
  
  const lines: string[] = [];
  let currentLine = line;
  while (currentLine.length > maxLength) {
    lines.push(currentLine.substring(0, maxLength));
    currentLine = " " + currentLine.substring(maxLength);
  }
  lines.push(currentLine);
  return lines.join("\r\n");
}

export function generateICS(meeting: Meeting, attendees: Attendee[] = []): string {
  const uid = `${meeting.id}@bimcall.app`;
  const dtstart = formatDateForICS(meeting.date, meeting.startTime);
  const dtend = formatDateForICS(meeting.date, meeting.endTime);
  const dtstamp = format(new Date(), "yyyyMMdd'T'HHmmss'Z'");
  
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//BIMCall//Coordination Meeting Manager//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:REQUEST",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${dtstamp}`,
    `DTSTART:${dtstart}`,
    `DTEND:${dtend}`,
    foldLine(`SUMMARY:${escapeICSText(meeting.title)}`),
    foldLine(`LOCATION:${escapeICSText(meeting.location)}`),
  ];

  if (meeting.agenda) {
    lines.push(foldLine(`DESCRIPTION:${escapeICSText(meeting.agenda)}`));
  }

  if (meeting.meetingLink) {
    lines.push(foldLine(`URL:${meeting.meetingLink}`));
  }

  attendees.forEach((attendee) => {
    const status = attendee.status === "accepted" ? "ACCEPTED" 
      : attendee.status === "declined" ? "DECLINED" 
      : "NEEDS-ACTION";
    lines.push(
      foldLine(`ATTENDEE;CN=${escapeICSText(attendee.name)};PARTSTAT=${status}:mailto:${attendee.email}`)
    );
  });

  lines.push("END:VEVENT");
  lines.push("END:VCALENDAR");

  return lines.join("\r\n");
}

export function downloadICS(meeting: Meeting, attendees: Attendee[] = []): void {
  const icsContent = generateICS(meeting, attendees);
  const blob = new Blob([icsContent], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement("a");
  link.href = url;
  link.download = `${meeting.title.replace(/[^a-z0-9]/gi, "_")}_${meeting.date}.ics`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function generateGoogleCalendarUrl(meeting: Meeting): string {
  const startDate = meeting.date.replace(/-/g, "");
  const startTime = meeting.startTime.replace(/:/g, "");
  const endTime = meeting.endTime.replace(/:/g, "");
  
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: meeting.title,
    dates: `${startDate}T${startTime}00/${startDate}T${endTime}00`,
    details: meeting.agenda || "",
    location: meeting.meetingLink || meeting.location,
    sf: "true",
  });
  
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

export function generateOutlookUrl(meeting: Meeting): string {
  const startDate = `${meeting.date}T${meeting.startTime}:00`;
  const endDate = `${meeting.date}T${meeting.endTime}:00`;
  
  const params = new URLSearchParams({
    path: "/calendar/action/compose",
    rru: "addevent",
    subject: meeting.title,
    startdt: startDate,
    enddt: endDate,
    body: meeting.agenda || "",
    location: meeting.meetingLink || meeting.location,
  });
  
  return `https://outlook.office.com/calendar/0/action/compose?${params.toString()}`;
}
