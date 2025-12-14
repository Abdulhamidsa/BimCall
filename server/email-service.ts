// Email Integration Service for Gmail and Outlook
// Uses Replit integrations for OAuth and token management

import { google } from 'googleapis';
import { Client } from '@microsoft/microsoft-graph-client';

// Gmail connection settings cache
let gmailConnectionSettings: any;

// Outlook connection settings cache
let outlookConnectionSettings: any;

// Google Calendar connection settings cache
let googleCalendarConnectionSettings: any;

/**
 * Get Gmail access token from Replit connector
 */
async function getGmailAccessToken(): Promise<string> {
  if (gmailConnectionSettings && 
      gmailConnectionSettings.settings.expires_at && 
      new Date(gmailConnectionSettings.settings.expires_at).getTime() > Date.now()) {
    return gmailConnectionSettings.settings.access_token;
  }
  
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY 
    ? 'repl ' + process.env.REPL_IDENTITY 
    : process.env.WEB_REPL_RENEWAL 
    ? 'depl ' + process.env.WEB_REPL_RENEWAL 
    : null;

  if (!xReplitToken || !hostname) {
    throw new Error('Replit connector environment not configured');
  }

  const response = await fetch(
    `https://${hostname}/api/v2/connection?include_secrets=true&connector_names=google-mail`,
    {
      headers: {
        'Accept': 'application/json',
        'X_REPLIT_TOKEN': xReplitToken
      }
    }
  );
  
  const data = await response.json();
  gmailConnectionSettings = data.items?.[0];

  const accessToken = gmailConnectionSettings?.settings?.access_token || 
                      gmailConnectionSettings?.settings?.oauth?.credentials?.access_token;

  if (!gmailConnectionSettings || !accessToken) {
    throw new Error('Gmail not connected');
  }
  
  return accessToken;
}

/**
 * Get Google Calendar access token from Replit connector
 * Uses the dedicated google-calendar integration for calendar access
 */
async function getGoogleCalendarAccessToken(): Promise<string> {
  if (googleCalendarConnectionSettings && 
      googleCalendarConnectionSettings.settings.expires_at && 
      new Date(googleCalendarConnectionSettings.settings.expires_at).getTime() > Date.now()) {
    return googleCalendarConnectionSettings.settings.access_token;
  }
  
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY 
    ? 'repl ' + process.env.REPL_IDENTITY 
    : process.env.WEB_REPL_RENEWAL 
    ? 'depl ' + process.env.WEB_REPL_RENEWAL 
    : null;

  if (!xReplitToken || !hostname) {
    throw new Error('Replit connector environment not configured');
  }

  const response = await fetch(
    `https://${hostname}/api/v2/connection?include_secrets=true&connector_names=google-calendar`,
    {
      headers: {
        'Accept': 'application/json',
        'X_REPLIT_TOKEN': xReplitToken
      }
    }
  );
  
  const data = await response.json();
  googleCalendarConnectionSettings = data.items?.[0];

  const accessToken = googleCalendarConnectionSettings?.settings?.access_token || 
                      googleCalendarConnectionSettings?.settings?.oauth?.credentials?.access_token;

  if (!googleCalendarConnectionSettings || !accessToken) {
    throw new Error('Google Calendar not connected');
  }
  
  return accessToken;
}

/**
 * Check Google Calendar connection status
 */
export async function checkGoogleCalendarStatus(): Promise<{ connected: boolean; email?: string }> {
  try {
    const accessToken = await getGoogleCalendarAccessToken();
    const oauth2Client = new google.auth.OAuth2();
    oauth2Client.setCredentials({ access_token: accessToken });
    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
    const calendarList = await calendar.calendarList.list({ maxResults: 1 });
    return { 
      connected: true, 
      email: calendarList.data.items?.[0]?.id || undefined 
    };
  } catch (error) {
    return { connected: false };
  }
}

/**
 * Get Outlook access token from Replit connector
 */
async function getOutlookAccessToken(): Promise<string> {
  if (outlookConnectionSettings && 
      outlookConnectionSettings.settings.expires_at && 
      new Date(outlookConnectionSettings.settings.expires_at).getTime() > Date.now()) {
    return outlookConnectionSettings.settings.access_token;
  }
  
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY 
    ? 'repl ' + process.env.REPL_IDENTITY 
    : process.env.WEB_REPL_RENEWAL 
    ? 'depl ' + process.env.WEB_REPL_RENEWAL 
    : null;

  if (!xReplitToken || !hostname) {
    throw new Error('Replit connector environment not configured');
  }

  const response = await fetch(
    `https://${hostname}/api/v2/connection?include_secrets=true&connector_names=outlook`,
    {
      headers: {
        'Accept': 'application/json',
        'X_REPLIT_TOKEN': xReplitToken
      }
    }
  );
  
  const data = await response.json();
  outlookConnectionSettings = data.items?.[0];

  const accessToken = outlookConnectionSettings?.settings?.access_token || 
                      outlookConnectionSettings?.settings?.oauth?.credentials?.access_token;

  if (!outlookConnectionSettings || !accessToken) {
    throw new Error('Outlook not connected');
  }
  
  return accessToken;
}

/**
 * Get Gmail client (always fresh, never cached)
 */
export async function getGmailClient() {
  const accessToken = await getGmailAccessToken();
  const oauth2Client = new google.auth.OAuth2();
  oauth2Client.setCredentials({ access_token: accessToken });
  return google.gmail({ version: 'v1', auth: oauth2Client });
}

/**
 * Get Outlook/Microsoft Graph client (always fresh, never cached)
 */
export async function getOutlookClient() {
  const accessToken = await getOutlookAccessToken();
  return Client.initWithMiddleware({
    authProvider: {
      getAccessToken: async () => accessToken
    }
  });
}

/**
 * Check Gmail connection status
 */
export async function checkGmailStatus(): Promise<{ connected: boolean; email?: string }> {
  try {
    const client = await getGmailClient();
    const profile = await client.users.getProfile({ userId: 'me' });
    return { 
      connected: true, 
      email: profile.data.emailAddress || undefined 
    };
  } catch (error) {
    return { connected: false };
  }
}

/**
 * Check Outlook connection status
 */
export async function checkOutlookStatus(): Promise<{ connected: boolean; email?: string }> {
  try {
    const client = await getOutlookClient();
    const user = await client.api('/me').get();
    return { 
      connected: true, 
      email: user.mail || user.userPrincipalName || undefined 
    };
  } catch (error) {
    return { connected: false };
  }
}

/**
 * Send email via Gmail
 */
export async function sendGmailEmail(to: string[], subject: string, htmlBody: string, attachments?: Array<{ filename: string; content: string; mimeType: string }>) {
  const client = await getGmailClient();
  
  const boundary = 'boundary_' + Date.now();
  let message = [
    `To: ${to.join(', ')}`,
    `Subject: ${subject}`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    '',
    `--${boundary}`,
    'Content-Type: text/html; charset=UTF-8',
    '',
    htmlBody,
  ];

  if (attachments && attachments.length > 0) {
    for (const attachment of attachments) {
      message.push(
        `--${boundary}`,
        `Content-Type: ${attachment.mimeType}; name="${attachment.filename}"`,
        'Content-Transfer-Encoding: base64',
        `Content-Disposition: attachment; filename="${attachment.filename}"`,
        '',
        attachment.content
      );
    }
  }
  
  message.push(`--${boundary}--`);
  
  const rawMessage = Buffer.from(message.join('\r\n'))
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  const result = await client.users.messages.send({
    userId: 'me',
    requestBody: { raw: rawMessage }
  });

  return result.data;
}

/**
 * Send email via Outlook
 */
export async function sendOutlookEmail(to: string[], subject: string, htmlBody: string, attachments?: Array<{ filename: string; content: string; mimeType: string }>) {
  const client = await getOutlookClient();
  
  const message: any = {
    subject,
    body: {
      contentType: 'HTML',
      content: htmlBody
    },
    toRecipients: to.map(email => ({
      emailAddress: { address: email }
    }))
  };

  if (attachments && attachments.length > 0) {
    message.attachments = attachments.map(att => ({
      '@odata.type': '#microsoft.graph.fileAttachment',
      name: att.filename,
      contentType: att.mimeType,
      contentBytes: att.content
    }));
  }

  const result = await client.api('/me/sendMail').post({ message });
  return result;
}

// Calendar event type with full details for import
export interface CalendarEventAttendee {
  email: string;
  name?: string;
  responseStatus?: string;
}

export interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  location?: string;
  startDateTime: string;
  endDateTime: string;
  startTime: string; // HH:mm format
  endTime: string; // HH:mm format
  date: string; // YYYY-MM-DD format
  isRecurring: boolean;
  recurrenceRule?: string; // weekly, biweekly, monthly, or custom RRULE
  recurrencePattern?: string; // Human readable description
  attendees: CalendarEventAttendee[];
  organizer?: CalendarEventAttendee;
  meetingLink?: string;
  provider: 'google' | 'outlook';
}

// Recurring event master for import with all occurrences
export interface RecurringEventMaster {
  id: string;
  title: string;
  description?: string;
  location?: string;
  startTime: string;
  endTime: string;
  recurrenceRule: 'weekly' | 'biweekly' | 'monthly';
  attendees: CalendarEventAttendee[];
  meetingLink?: string;
  occurrences: Array<{
    date: string;
    status: 'scheduled' | 'cancelled';
  }>;
}

/**
 * Parse Google Calendar recurrence rule to our format
 */
function parseGoogleRecurrence(recurrence?: string[]): { isRecurring: boolean; rule?: string; pattern?: string } {
  if (!recurrence || recurrence.length === 0) {
    return { isRecurring: false };
  }
  
  const rrule = recurrence.find(r => r.startsWith('RRULE:'));
  if (!rrule) {
    return { isRecurring: true, pattern: 'Custom recurrence' };
  }
  
  // Parse RRULE
  if (rrule.includes('FREQ=WEEKLY') && rrule.includes('INTERVAL=2')) {
    return { isRecurring: true, rule: 'biweekly', pattern: 'Every 2 weeks' };
  }
  if (rrule.includes('FREQ=WEEKLY')) {
    return { isRecurring: true, rule: 'weekly', pattern: 'Weekly' };
  }
  if (rrule.includes('FREQ=MONTHLY')) {
    return { isRecurring: true, rule: 'monthly', pattern: 'Monthly' };
  }
  if (rrule.includes('FREQ=DAILY')) {
    return { isRecurring: true, rule: 'daily', pattern: 'Daily' };
  }
  
  return { isRecurring: true, pattern: 'Custom recurrence' };
}

/**
 * Get calendar events from Google Calendar with full details
 * Uses the dedicated google-calendar integration
 */
export async function getGoogleCalendarEvents(startDate: string, endDate: string, searchQuery?: string): Promise<CalendarEvent[]> {
  const accessToken = await getGoogleCalendarAccessToken();
  const oauth2Client = new google.auth.OAuth2();
  oauth2Client.setCredentials({ access_token: accessToken });
  
  const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
  
  // Ensure endDate is inclusive by adding 1 day
  const endDateObj = new Date(endDate);
  endDateObj.setDate(endDateObj.getDate() + 1);
  const endDateInclusive = endDateObj.toISOString();
  
  // First get events WITHOUT expanding recurring (to see recurrence info)
  const response = await calendar.events.list({
    calendarId: 'primary',
    timeMin: new Date(startDate).toISOString(),
    timeMax: endDateInclusive,
    singleEvents: false, // Keep recurring events as masters
    maxResults: 100,
    q: searchQuery, // Search query for title
  });
  
  const events = response.data.items || [];
  
  // Also get expanded single events for accurate date/time
  const expandedResponse = await calendar.events.list({
    calendarId: 'primary',
    timeMin: new Date(startDate).toISOString(),
    timeMax: endDateInclusive,
    singleEvents: true, // Expand recurring events
    orderBy: 'startTime',
    maxResults: 200,
    q: searchQuery,
  });
  
  const expandedEvents = expandedResponse.data.items || [];
  
  // Map recurring event IDs to their occurrences
  const recurringOccurrences = new Map<string, any[]>();
  for (const event of expandedEvents) {
    if (event.recurringEventId) {
      const existing = recurringOccurrences.get(event.recurringEventId) || [];
      existing.push(event);
      recurringOccurrences.set(event.recurringEventId, existing);
    }
  }
  
  // Process events
  const result: CalendarEvent[] = [];
  const processedRecurringIds = new Set<string>();
  
  for (const event of events) {
    if (!event.id || !event.summary) continue;
    
    const { isRecurring, rule, pattern } = parseGoogleRecurrence(event.recurrence || undefined);
    
    // Extract start/end times
    const startDT = event.start?.dateTime || event.start?.date || '';
    const endDT = event.end?.dateTime || event.end?.date || '';
    const startDate_ = startDT.split('T')[0];
    const startTime = startDT.includes('T') ? startDT.split('T')[1].substring(0, 5) : '00:00';
    const endTime = endDT.includes('T') ? endDT.split('T')[1].substring(0, 5) : '00:00';
    
    // Extract attendees
    const attendees: CalendarEventAttendee[] = (event.attendees || []).map((att: any) => ({
      email: att.email,
      name: att.displayName,
      responseStatus: att.responseStatus,
    }));
    
    // Extract meeting link from conferenceData or description
    let meetingLink = event.hangoutLink || '';
    if (!meetingLink && event.conferenceData?.entryPoints) {
      const videoEntry = event.conferenceData.entryPoints.find((e: any) => e.entryPointType === 'video');
      meetingLink = videoEntry?.uri || '';
    }
    
    result.push({
      id: event.id,
      title: event.summary,
      description: event.description || undefined,
      location: event.location || undefined,
      startDateTime: startDT,
      endDateTime: endDT,
      startTime,
      endTime,
      date: startDate_,
      isRecurring,
      recurrenceRule: rule,
      recurrencePattern: pattern,
      attendees,
      organizer: event.organizer ? { email: event.organizer.email!, name: event.organizer.displayName || undefined } : undefined,
      meetingLink,
      provider: 'google',
    });
    
    if (isRecurring) {
      processedRecurringIds.add(event.id);
    }
  }
  
  // Add non-recurring expanded events that weren't in the master list
  for (const event of expandedEvents) {
    if (!event.id || !event.summary) continue;
    if (event.recurringEventId && processedRecurringIds.has(event.recurringEventId)) continue;
    if (result.some(r => r.id === event.id)) continue;
    
    const startDT = event.start?.dateTime || event.start?.date || '';
    const endDT = event.end?.dateTime || event.end?.date || '';
    const startDate_ = startDT.split('T')[0];
    const startTime = startDT.includes('T') ? startDT.split('T')[1].substring(0, 5) : '00:00';
    const endTime = endDT.includes('T') ? endDT.split('T')[1].substring(0, 5) : '00:00';
    
    const attendees: CalendarEventAttendee[] = (event.attendees || []).map((att: any) => ({
      email: att.email,
      name: att.displayName,
      responseStatus: att.responseStatus,
    }));
    
    let meetingLink = event.hangoutLink || '';
    if (!meetingLink && event.conferenceData?.entryPoints) {
      const videoEntry = event.conferenceData.entryPoints.find((e: any) => e.entryPointType === 'video');
      meetingLink = videoEntry?.uri || '';
    }
    
    result.push({
      id: event.id,
      title: event.summary,
      description: event.description || undefined,
      location: event.location || undefined,
      startDateTime: startDT,
      endDateTime: endDT,
      startTime,
      endTime,
      date: startDate_,
      isRecurring: !!event.recurringEventId,
      recurrencePattern: event.recurringEventId ? 'Part of recurring series' : undefined,
      attendees,
      organizer: event.organizer ? { email: event.organizer.email!, name: event.organizer.displayName || undefined } : undefined,
      meetingLink,
      provider: 'google',
    });
  }
  
  return result;
}

/**
 * Get recurring event occurrences from Google Calendar
 * Uses the dedicated google-calendar integration
 */
export async function getGoogleRecurringEventOccurrences(eventId: string, startDate: string, endDate: string): Promise<Array<{ id?: string; date: string; status: 'scheduled' | 'cancelled' }>> {
  const accessToken = await getGoogleCalendarAccessToken();
  const oauth2Client = new google.auth.OAuth2();
  oauth2Client.setCredentials({ access_token: accessToken });
  
  const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
  
  const response = await calendar.events.instances({
    calendarId: 'primary',
    eventId,
    timeMin: new Date(startDate).toISOString(),
    timeMax: new Date(endDate).toISOString(),
    maxResults: 52, // Up to a year of weekly meetings
  });
  
  return (response.data.items || []).map((event: any) => ({
    id: event.id, // Calendar occurrence ID for syncing
    date: (event.start?.dateTime || event.start?.date || '').split('T')[0],
    status: event.status === 'cancelled' ? 'cancelled' : 'scheduled',
  }));
}

/**
 * Get calendar events from Outlook with full details
 */
export async function getOutlookCalendarEvents(startDate: string, endDate: string, searchQuery?: string): Promise<CalendarEvent[]> {
  const client = await getOutlookClient();
  
  // Ensure endDate is inclusive by adding 1 day
  const endDateObj = new Date(endDate);
  endDateObj.setDate(endDateObj.getDate() + 1);
  const endDateInclusive = endDateObj.toISOString().split('T')[0];
  
  let request = client
    .api('/me/calendar/events')
    .select('id,subject,body,location,start,end,isAllDay,recurrence,attendees,organizer,onlineMeeting,onlineMeetingUrl')
    .filter(`start/dateTime ge '${startDate}' and start/dateTime lt '${endDateInclusive}'`)
    .orderby('start/dateTime')
    .top(100);
  
  // Note: Outlook Graph API doesn't support $search on calendar, use client-side filter
  const response = await request.get();
  
  let events = response.value || [];
  
  // Client-side search filter if query provided
  if (searchQuery) {
    const query = searchQuery.toLowerCase();
    events = events.filter((e: any) => 
      e.subject?.toLowerCase().includes(query) ||
      e.location?.displayName?.toLowerCase().includes(query)
    );
  }
  
  return events.map((event: any) => {
    const startDT = event.start?.dateTime || '';
    const endDT = event.end?.dateTime || '';
    const startDate_ = startDT.split('T')[0];
    const startTime = startDT.includes('T') ? startDT.split('T')[1].substring(0, 5) : '00:00';
    const endTime = endDT.includes('T') ? endDT.split('T')[1].substring(0, 5) : '00:00';
    
    // Parse recurrence
    let isRecurring = !!event.recurrence;
    let recurrenceRule: string | undefined;
    let recurrencePattern: string | undefined;
    
    if (event.recurrence?.pattern) {
      const pattern = event.recurrence.pattern;
      if (pattern.type === 'weekly' && pattern.interval === 1) {
        recurrenceRule = 'weekly';
        recurrencePattern = 'Weekly';
      } else if (pattern.type === 'weekly' && pattern.interval === 2) {
        recurrenceRule = 'biweekly';
        recurrencePattern = 'Every 2 weeks';
      } else if (pattern.type === 'absoluteMonthly' || pattern.type === 'relativeMonthly') {
        recurrenceRule = 'monthly';
        recurrencePattern = 'Monthly';
      } else if (pattern.type === 'daily') {
        recurrencePattern = 'Daily';
      } else {
        recurrencePattern = 'Custom recurrence';
      }
    }
    
    // Extract attendees
    const attendees: CalendarEventAttendee[] = (event.attendees || []).map((att: any) => ({
      email: att.emailAddress?.address,
      name: att.emailAddress?.name,
      responseStatus: att.status?.response,
    }));
    
    // Extract meeting link
    const meetingLink = event.onlineMeetingUrl || event.onlineMeeting?.joinUrl || '';
    
    return {
      id: event.id,
      title: event.subject || 'Untitled',
      description: event.body?.content?.replace(/<[^>]*>/g, ' ').trim(),
      location: event.location?.displayName,
      startDateTime: startDT,
      endDateTime: endDT,
      startTime,
      endTime,
      date: startDate_,
      isRecurring,
      recurrenceRule,
      recurrencePattern,
      attendees,
      organizer: event.organizer?.emailAddress ? {
        email: event.organizer.emailAddress.address,
        name: event.organizer.emailAddress.name,
      } : undefined,
      meetingLink,
      provider: 'outlook' as const,
    };
  });
}

/**
 * Get recurring event occurrences from Outlook
 */
export async function getOutlookRecurringEventOccurrences(eventId: string, startDate: string, endDate: string): Promise<Array<{ id?: string; date: string; status: 'scheduled' | 'cancelled' }>> {
  const client = await getOutlookClient();
  
  // Outlook uses instances endpoint for recurring events
  const response = await client
    .api(`/me/calendar/events/${eventId}/instances`)
    .query({
      startDateTime: startDate,
      endDateTime: endDate,
    })
    .select('id,start,isCancelled')
    .top(52)
    .get();
  
  return (response.value || []).map((event: any) => ({
    id: event.id, // Calendar occurrence ID for syncing
    date: (event.start?.dateTime || '').split('T')[0],
    status: event.isCancelled ? 'cancelled' : 'scheduled',
  }));
}

/**
 * Get a single calendar event by ID from Google Calendar
 * Uses the dedicated google-calendar integration
 */
export async function getGoogleCalendarEventById(eventId: string): Promise<CalendarEvent | null> {
  try {
    const accessToken = await getGoogleCalendarAccessToken();
    const oauth2Client = new google.auth.OAuth2();
    oauth2Client.setCredentials({ access_token: accessToken });
    
    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
    
    const response = await calendar.events.get({
      calendarId: 'primary',
      eventId,
    });
    
    const event = response.data;
    if (!event) return null;
    
    const startDT = event.start?.dateTime || event.start?.date || '';
    const endDT = event.end?.dateTime || event.end?.date || '';
    const startDate_ = startDT.split('T')[0];
    const startTime = startDT.includes('T') ? startDT.split('T')[1].substring(0, 5) : '00:00';
    const endTime = endDT.includes('T') ? endDT.split('T')[1].substring(0, 5) : '00:00';
    
    const attendees: CalendarEventAttendee[] = (event.attendees || []).map((att: any) => ({
      email: att.email,
      name: att.displayName,
      responseStatus: att.responseStatus,
    }));
    
    let meetingLink = '';
    if (event.conferenceData?.entryPoints) {
      const videoEntry = event.conferenceData.entryPoints.find((e: any) => e.entryPointType === 'video');
      meetingLink = videoEntry?.uri || '';
    }
    
    let isRecurring = !!event.recurrence || !!event.recurringEventId;
    let recurrenceRule: string | undefined;
    
    if (event.recurrence) {
      const rrule = event.recurrence.find((r: string) => r.startsWith('RRULE:'));
      if (rrule) {
        if (rrule.includes('FREQ=WEEKLY') && !rrule.includes('INTERVAL=2')) {
          recurrenceRule = 'weekly';
        } else if (rrule.includes('FREQ=WEEKLY') && rrule.includes('INTERVAL=2')) {
          recurrenceRule = 'biweekly';
        } else if (rrule.includes('FREQ=MONTHLY')) {
          recurrenceRule = 'monthly';
        }
      }
    }
    
    return {
      id: event.id!,
      title: event.summary || 'Untitled',
      description: event.description || undefined,
      location: event.location || undefined,
      startDateTime: startDT,
      endDateTime: endDT,
      startTime,
      endTime,
      date: startDate_,
      isRecurring,
      recurrenceRule,
      attendees,
      organizer: event.organizer ? { email: event.organizer.email!, name: event.organizer.displayName || undefined } : undefined,
      meetingLink,
      provider: 'google',
    };
  } catch (error: any) {
    if (error.code === 404 || error.response?.status === 404) {
      return null; // Event was deleted
    }
    throw error;
  }
}

/**
 * Get a single calendar event by ID from Outlook
 */
export async function getOutlookCalendarEventById(eventId: string): Promise<CalendarEvent | null> {
  try {
    const client = await getOutlookClient();
    
    const event = await client
      .api(`/me/calendar/events/${eventId}`)
      .select('id,subject,body,location,start,end,isAllDay,recurrence,attendees,organizer,onlineMeeting,onlineMeetingUrl')
      .get();
    
    if (!event) return null;
    
    const startDT = event.start?.dateTime || '';
    const endDT = event.end?.dateTime || '';
    const startDate_ = startDT.split('T')[0];
    const startTime = startDT.includes('T') ? startDT.split('T')[1].substring(0, 5) : '00:00';
    const endTime = endDT.includes('T') ? endDT.split('T')[1].substring(0, 5) : '00:00';
    
    let isRecurring = !!event.recurrence;
    let recurrenceRule: string | undefined;
    
    if (event.recurrence?.pattern) {
      const pattern = event.recurrence.pattern;
      if (pattern.type === 'weekly' && pattern.interval === 1) {
        recurrenceRule = 'weekly';
      } else if (pattern.type === 'weekly' && pattern.interval === 2) {
        recurrenceRule = 'biweekly';
      } else if (pattern.type === 'absoluteMonthly' || pattern.type === 'relativeMonthly') {
        recurrenceRule = 'monthly';
      }
    }
    
    const attendees: CalendarEventAttendee[] = (event.attendees || []).map((att: any) => ({
      email: att.emailAddress?.address,
      name: att.emailAddress?.name,
      responseStatus: att.status?.response,
    }));
    
    const meetingLink = event.onlineMeetingUrl || event.onlineMeeting?.joinUrl || '';
    
    return {
      id: event.id,
      title: event.subject || 'Untitled',
      description: event.body?.content?.replace(/<[^>]*>/g, ' ').trim(),
      location: event.location?.displayName,
      startDateTime: startDT,
      endDateTime: endDT,
      startTime,
      endTime,
      date: startDate_,
      isRecurring,
      recurrenceRule,
      attendees,
      organizer: event.organizer?.emailAddress ? {
        email: event.organizer.emailAddress.address,
        name: event.organizer.emailAddress.name,
      } : undefined,
      meetingLink,
      provider: 'outlook',
    };
  } catch (error: any) {
    if (error.statusCode === 404 || error.code === 'ErrorItemNotFound') {
      return null; // Event was deleted
    }
    throw error;
  }
}

/**
 * Get contacts from Gmail
 */
export async function getGoogleContacts() {
  const accessToken = await getGmailAccessToken();
  const oauth2Client = new google.auth.OAuth2();
  oauth2Client.setCredentials({ access_token: accessToken });
  
  const people = google.people({ version: 'v1', auth: oauth2Client });
  
  const response = await people.people.connections.list({
    resourceName: 'people/me',
    personFields: 'names,emailAddresses,organizations',
    pageSize: 100
  });

  return response.data.connections || [];
}

/**
 * Get contacts from Outlook
 */
export async function getOutlookContacts() {
  const client = await getOutlookClient();
  
  const response = await client
    .api('/me/contacts')
    .select('displayName,emailAddresses,companyName,jobTitle')
    .top(100)
    .get();

  return response.value || [];
}

/**
 * Create calendar event in Google Calendar
 * Uses the dedicated google-calendar integration
 */
export async function createGoogleCalendarEvent(event: {
  title: string;
  description?: string;
  startTime: string;
  endTime: string;
  location?: string;
  attendees?: string[];
}) {
  const accessToken = await getGoogleCalendarAccessToken();
  const oauth2Client = new google.auth.OAuth2();
  oauth2Client.setCredentials({ access_token: accessToken });
  
  const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
  
  const response = await calendar.events.insert({
    calendarId: 'primary',
    requestBody: {
      summary: event.title,
      description: event.description,
      location: event.location,
      start: { dateTime: event.startTime },
      end: { dateTime: event.endTime },
      attendees: event.attendees?.map(email => ({ email }))
    }
  });

  return response.data;
}

// Attachment type for email attachments
export interface EmailAttachment {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
  isImage: boolean;
  data?: string; // Base64 encoded data (only when fetched)
}

// Email type with attachments
export interface EmailWithAttachments {
  id: string;
  subject: string;
  from: string;
  date: string;
  snippet: string;
  body: string;
  attachments: EmailAttachment[];
  inlineImages: EmailAttachment[];
}

/**
 * Helper to extract attachments info from Gmail message parts
 */
function extractGmailAttachments(parts: any[], messageId: string): { attachments: EmailAttachment[], inlineImages: EmailAttachment[] } {
  const attachments: EmailAttachment[] = [];
  const inlineImages: EmailAttachment[] = [];
  
  function processParts(parts: any[]) {
    for (const part of parts) {
      if (part.parts) {
        processParts(part.parts);
      }
      
      if (part.filename && part.body?.attachmentId) {
        const isImage = part.mimeType?.startsWith('image/');
        const attachment: EmailAttachment = {
          id: part.body.attachmentId,
          filename: part.filename,
          mimeType: part.mimeType || 'application/octet-stream',
          size: part.body.size || 0,
          isImage,
        };
        
        // Check if it's an inline image (has Content-ID header)
        const contentId = part.headers?.find((h: any) => h.name?.toLowerCase() === 'content-id');
        if (isImage && contentId) {
          inlineImages.push(attachment);
        } else {
          attachments.push(attachment);
        }
      }
    }
  }
  
  processParts(parts);
  return { attachments, inlineImages };
}

/**
 * Get emails from Gmail inbox with attachment info
 */
export async function getGmailEmails(maxResults: number = 20, query?: string): Promise<EmailWithAttachments[]> {
  const client = await getGmailClient();
  
  // Build the query - search in inbox
  let q = 'in:inbox';
  if (query) {
    q += ` ${query}`;
  }
  
  // Get list of message IDs
  const listResponse = await client.users.messages.list({
    userId: 'me',
    maxResults,
    q,
  });
  
  const messages = listResponse.data.messages || [];
  
  // Fetch full message details for each
  const emailDetails = await Promise.all(
    messages.map(async (msg) => {
      const detail = await client.users.messages.get({
        userId: 'me',
        id: msg.id!,
        format: 'full',
      });
      
      const headers = detail.data.payload?.headers || [];
      const getHeader = (name: string) => 
        headers.find(h => h.name?.toLowerCase() === name.toLowerCase())?.value || '';
      
      // Extract body - try plain text first, then html
      let body = '';
      const payload = detail.data.payload;
      
      if (payload?.body?.data) {
        body = Buffer.from(payload.body.data, 'base64').toString('utf-8');
      } else if (payload?.parts) {
        const textPart = payload.parts.find(p => p.mimeType === 'text/plain');
        const htmlPart = payload.parts.find(p => p.mimeType === 'text/html');
        if (textPart?.body?.data) {
          body = Buffer.from(textPart.body.data, 'base64').toString('utf-8');
        } else if (htmlPart?.body?.data) {
          // Strip HTML tags for plain text
          const htmlBody = Buffer.from(htmlPart.body.data, 'base64').toString('utf-8');
          body = htmlBody.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
        }
      }
      
      // Extract attachment info
      const { attachments, inlineImages } = payload?.parts 
        ? extractGmailAttachments(payload.parts, msg.id!)
        : { attachments: [], inlineImages: [] };
      
      return {
        id: msg.id!,
        subject: getHeader('Subject') || '(No Subject)',
        from: getHeader('From'),
        date: getHeader('Date'),
        snippet: detail.data.snippet || '',
        body: body.substring(0, 5000), // Limit body size
        attachments,
        inlineImages,
      };
    })
  );
  
  return emailDetails;
}

/**
 * Fetch a specific Gmail attachment by ID
 */
export async function getGmailAttachment(messageId: string, attachmentId: string): Promise<string> {
  const client = await getGmailClient();
  
  const attachment = await client.users.messages.attachments.get({
    userId: 'me',
    messageId,
    id: attachmentId,
  });
  
  // Return base64 data (already URL-safe base64)
  return attachment.data.data || '';
}

/**
 * Get emails from Outlook inbox with attachment info
 */
export async function getOutlookEmails(maxResults: number = 20, search?: string): Promise<EmailWithAttachments[]> {
  const client = await getOutlookClient();
  
  let request = client
    .api('/me/messages')
    .top(maxResults)
    .select('id,subject,from,receivedDateTime,bodyPreview,body,hasAttachments')
    .expand('attachments')
    .orderby('receivedDateTime desc');
  
  if (search) {
    // Escape single quotes for OData filter
    const escapedSearch = search.replace(/'/g, "''");
    request = request.filter(`contains(subject, '${escapedSearch}')`);
  }
  
  const response = await request.get();
  
  return (response.value || []).map((msg: any) => {
    const attachments: EmailAttachment[] = [];
    const inlineImages: EmailAttachment[] = [];
    
    if (msg.attachments) {
      for (const att of msg.attachments) {
        const isImage = att.contentType?.startsWith('image/');
        const attachment: EmailAttachment = {
          id: att.id,
          filename: att.name || 'unnamed',
          mimeType: att.contentType || 'application/octet-stream',
          size: att.size || 0,
          isImage,
          // Include base64 data if it's inline content
          data: att.contentBytes,
        };
        
        if (att.isInline && isImage) {
          inlineImages.push(attachment);
        } else {
          attachments.push(attachment);
        }
      }
    }
    
    return {
      id: msg.id,
      subject: msg.subject || '(No Subject)',
      from: msg.from?.emailAddress?.address || msg.from?.emailAddress?.name || 'Unknown',
      date: msg.receivedDateTime,
      snippet: msg.bodyPreview || '',
      body: msg.body?.content?.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().substring(0, 5000) || '',
      attachments,
      inlineImages,
    };
  });
}

/**
 * Fetch a specific Outlook attachment by ID
 */
export async function getOutlookAttachment(messageId: string, attachmentId: string): Promise<string> {
  const client = await getOutlookClient();
  
  const attachment = await client
    .api(`/me/messages/${messageId}/attachments/${attachmentId}`)
    .get();
  
  // Return base64 data
  return attachment.contentBytes || '';
}

/**
 * Create calendar event in Outlook
 */
export async function createOutlookCalendarEvent(event: {
  title: string;
  description?: string;
  startTime: string;
  endTime: string;
  location?: string;
  attendees?: string[];
}) {
  const client = await getOutlookClient();
  
  const response = await client.api('/me/calendar/events').post({
    subject: event.title,
    body: {
      contentType: 'HTML',
      content: event.description || ''
    },
    start: {
      dateTime: event.startTime,
      timeZone: 'UTC'
    },
    end: {
      dateTime: event.endTime,
      timeZone: 'UTC'
    },
    location: {
      displayName: event.location || ''
    },
    attendees: event.attendees?.map(email => ({
      emailAddress: { address: email },
      type: 'required'
    }))
  });

  return response;
}
