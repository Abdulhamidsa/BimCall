import { google } from 'googleapis';
import { Client } from '@microsoft/microsoft-graph-client';

let gmailConnectionSettings: any;
let outlookConnectionSettings: any;

async function getGmailAccessToken() {
  if (gmailConnectionSettings && gmailConnectionSettings.settings.expires_at && new Date(gmailConnectionSettings.settings.expires_at).getTime() > Date.now()) {
    return gmailConnectionSettings.settings.access_token;
  }
  
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY 
    ? 'repl ' + process.env.REPL_IDENTITY 
    : process.env.WEB_REPL_RENEWAL 
    ? 'depl ' + process.env.WEB_REPL_RENEWAL 
    : null;

  if (!xReplitToken) {
    throw new Error('X_REPLIT_TOKEN not found for repl/depl');
  }

  gmailConnectionSettings = await fetch(
    'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=google-mail',
    {
      headers: {
        'Accept': 'application/json',
        'X_REPLIT_TOKEN': xReplitToken
      }
    }
  ).then(res => res.json()).then(data => data.items?.[0]);

  const accessToken = gmailConnectionSettings?.settings?.access_token || gmailConnectionSettings?.settings?.oauth?.credentials?.access_token;

  if (!gmailConnectionSettings || !accessToken) {
    throw new Error('Gmail not connected');
  }
  return accessToken;
}

export async function getGmailClient() {
  const accessToken = await getGmailAccessToken();

  const oauth2Client = new google.auth.OAuth2();
  oauth2Client.setCredentials({
    access_token: accessToken
  });

  return google.gmail({ version: 'v1', auth: oauth2Client });
}

async function getOutlookAccessToken() {
  if (outlookConnectionSettings && outlookConnectionSettings.settings.expires_at && new Date(outlookConnectionSettings.settings.expires_at).getTime() > Date.now()) {
    return outlookConnectionSettings.settings.access_token;
  }
  
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY 
    ? 'repl ' + process.env.REPL_IDENTITY 
    : process.env.WEB_REPL_RENEWAL 
    ? 'depl ' + process.env.WEB_REPL_RENEWAL 
    : null;

  if (!xReplitToken) {
    throw new Error('X_REPLIT_TOKEN not found for repl/depl');
  }

  outlookConnectionSettings = await fetch(
    'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=outlook',
    {
      headers: {
        'Accept': 'application/json',
        'X_REPLIT_TOKEN': xReplitToken
      }
    }
  ).then(res => res.json()).then(data => data.items?.[0]);

  const accessToken = outlookConnectionSettings?.settings?.access_token || outlookConnectionSettings?.settings?.oauth?.credentials?.access_token;

  if (!outlookConnectionSettings || !accessToken) {
    throw new Error('Outlook not connected');
  }
  return accessToken;
}

export async function getOutlookClient() {
  const accessToken = await getOutlookAccessToken();

  return Client.initWithMiddleware({
    authProvider: {
      getAccessToken: async () => accessToken
    }
  });
}

export async function sendEmailViaGmail(to: string[], subject: string, htmlBody: string) {
  const gmail = await getGmailClient();
  
  const toHeader = to.join(', ');
  const messageParts = [
    `To: ${toHeader}`,
    'Content-Type: text/html; charset=utf-8',
    'MIME-Version: 1.0',
    `Subject: ${subject}`,
    '',
    htmlBody
  ];
  const message = messageParts.join('\n');
  
  const encodedMessage = Buffer.from(message)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  const result = await gmail.users.messages.send({
    userId: 'me',
    requestBody: {
      raw: encodedMessage
    }
  });

  return result.data;
}

export async function sendEmailViaOutlook(to: string[], subject: string, htmlBody: string) {
  const client = await getOutlookClient();
  
  const message = {
    subject: subject,
    body: {
      contentType: 'HTML',
      content: htmlBody
    },
    toRecipients: to.map(email => ({
      emailAddress: { address: email }
    }))
  };

  const result = await client.api('/me/sendMail').post({
    message: message,
    saveToSentItems: true
  });

  return result;
}
