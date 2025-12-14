import { useState } from "react";
import Layout from "@/components/layout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import {
  Mail,
  Calendar,
  Download,
  Upload,
  Bell,
  User,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Send,
  Users,
  FileText,
  CalendarPlus,
  Inbox,
  Settings2,
  Link2,
  ExternalLink,
  LogOut,
} from "lucide-react";
import { useAuth } from "@/contexts/auth-context";

interface EmailConnectionStatus {
  gmail: {
    connected: boolean;
    email?: string;
  };
  outlook: {
    connected: boolean;
    email?: string;
  };
}

function EmailIntegrationTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: connectionStatus, isLoading, refetch } = useQuery<EmailConnectionStatus>({
    queryKey: ["email-connection-status"],
    queryFn: async () => {
      const response = await fetch("/api/email/status");
      if (!response.ok) throw new Error("Failed to fetch connection status");
      return response.json();
    },
  });

  const syncMutation = useMutation({
    mutationFn: async (provider: 'gmail' | 'outlook') => {
      const response = await fetch(`/api/email/sync/${provider}`, { method: 'POST' });
      if (!response.ok) throw new Error("Sync failed");
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Sync Complete", description: "Your email data has been synchronized." });
      queryClient.invalidateQueries({ queryKey: ["email-connection-status"] });
    },
    onError: () => {
      toast({ title: "Sync Failed", description: "Could not sync email data.", variant: "destructive" });
    },
  });

  const handleConnect = (provider: 'gmail' | 'outlook') => {
    toast({
      title: `Connect ${provider === 'gmail' ? 'Gmail' : 'Outlook'}`,
      description: "Look for the Integrations panel in the Replit sidebar. Click 'Connect' next to the email integration to authorize your account.",
      duration: 8000,
    });
    refetch();
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">Email Accounts</h3>
        <p className="text-sm text-muted-foreground">
          Connect your email accounts to enable meeting invites, import contacts, and sync calendars.
        </p>
      </div>

      <div className="grid gap-4">
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-red-500/10 flex items-center justify-center">
                  <Mail className="h-5 w-5 text-red-500" />
                </div>
                <div>
                  <CardTitle className="text-base">Gmail / Google Workspace</CardTitle>
                  <CardDescription>
                    {connectionStatus?.gmail.connected 
                      ? connectionStatus.gmail.email 
                      : "Connect your Google account"}
                  </CardDescription>
                </div>
              </div>
              {connectionStatus?.gmail.connected ? (
                <Badge variant="default" className="bg-green-500/10 text-green-600 border-green-500/20">
                  <CheckCircle2 className="h-3 w-3 mr-1" /> Connected
                </Badge>
              ) : (
                <Badge variant="outline" className="text-muted-foreground">
                  <XCircle className="h-3 w-3 mr-1" /> Not Connected
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              {connectionStatus?.gmail.connected ? (
                <>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => syncMutation.mutate('gmail')}
                    disabled={syncMutation.isPending}
                    data-testid="button-sync-gmail"
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Sync Now
                  </Button>
                  <Button variant="ghost" size="sm" className="text-destructive" data-testid="button-disconnect-gmail">
                    Disconnect
                  </Button>
                </>
              ) : (
                <Button size="sm" data-testid="button-connect-gmail" onClick={() => handleConnect('gmail')}>
                  <Link2 className="h-4 w-4 mr-2" />
                  Connect Gmail
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                  <Mail className="h-5 w-5 text-blue-500" />
                </div>
                <div>
                  <CardTitle className="text-base">Outlook / Microsoft 365</CardTitle>
                  <CardDescription>
                    {connectionStatus?.outlook.connected 
                      ? connectionStatus.outlook.email 
                      : "Connect your Microsoft account"}
                  </CardDescription>
                </div>
              </div>
              {connectionStatus?.outlook.connected ? (
                <Badge variant="default" className="bg-green-500/10 text-green-600 border-green-500/20">
                  <CheckCircle2 className="h-3 w-3 mr-1" /> Connected
                </Badge>
              ) : (
                <Badge variant="outline" className="text-muted-foreground">
                  <XCircle className="h-3 w-3 mr-1" /> Not Connected
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              {connectionStatus?.outlook.connected ? (
                <>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => syncMutation.mutate('outlook')}
                    disabled={syncMutation.isPending}
                    data-testid="button-sync-outlook"
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Sync Now
                  </Button>
                  <Button variant="ghost" size="sm" className="text-destructive" data-testid="button-disconnect-outlook">
                    Disconnect
                  </Button>
                </>
              ) : (
                <Button size="sm" data-testid="button-connect-outlook" onClick={() => handleConnect('outlook')}>
                  <Link2 className="h-4 w-4 mr-2" />
                  Connect Outlook
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Separator />

      <div>
        <h3 className="text-lg font-medium">Email Features</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Configure which email features are enabled for your connected accounts.
        </p>

        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div className="flex items-center gap-3">
              <Send className="h-5 w-5 text-muted-foreground" />
              <div>
                <Label className="text-sm font-medium">Send Meeting Minutes</Label>
                <p className="text-xs text-muted-foreground">Send meeting minutes to attendees via email</p>
              </div>
            </div>
            <Switch defaultChecked data-testid="switch-send-minutes" />
          </div>

          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div className="flex items-center gap-3">
              <CalendarPlus className="h-5 w-5 text-muted-foreground" />
              <div>
                <Label className="text-sm font-medium">Create Calendar Invites</Label>
                <p className="text-xs text-muted-foreground">Automatically send calendar invites for new meetings</p>
              </div>
            </div>
            <Switch defaultChecked data-testid="switch-calendar-invites" />
          </div>

          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div className="flex items-center gap-3">
              <Users className="h-5 w-5 text-muted-foreground" />
              <div>
                <Label className="text-sm font-medium">Import Contacts</Label>
                <p className="text-xs text-muted-foreground">Import attendees from your email contacts</p>
              </div>
            </div>
            <Switch defaultChecked data-testid="switch-import-contacts" />
          </div>

          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div className="flex items-center gap-3">
              <Inbox className="h-5 w-5 text-muted-foreground" />
              <div>
                <Label className="text-sm font-medium">Import Points from Email</Label>
                <p className="text-xs text-muted-foreground">Extract action items and points from emails</p>
              </div>
            </div>
            <Switch data-testid="switch-import-points" />
          </div>

          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div className="flex items-center gap-3">
              <FileText className="h-5 w-5 text-muted-foreground" />
              <div>
                <Label className="text-sm font-medium">Email Notifications</Label>
                <p className="text-xs text-muted-foreground">Receive email notifications for meeting updates</p>
              </div>
            </div>
            <Switch defaultChecked data-testid="switch-email-notifications" />
          </div>
        </div>
      </div>
    </div>
  );
}

function CalendarSyncTab() {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">Calendar Synchronization</h3>
        <p className="text-sm text-muted-foreground">
          Sync your meetings with external calendar applications.
        </p>
      </div>

      <div className="grid gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Google Calendar
            </CardTitle>
            <CardDescription>
              Two-way sync with Google Calendar
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <Label>Auto-sync meetings</Label>
              <Switch data-testid="switch-google-auto-sync" />
            </div>
            <div className="flex items-center justify-between">
              <Label>Import external events</Label>
              <Switch data-testid="switch-google-import-events" />
            </div>
            <Button variant="outline" size="sm" data-testid="button-sync-google-calendar">
              <RefreshCw className="h-4 w-4 mr-2" />
              Sync Now
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Outlook Calendar
            </CardTitle>
            <CardDescription>
              Two-way sync with Outlook/Microsoft 365 Calendar
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <Label>Auto-sync meetings</Label>
              <Switch data-testid="switch-outlook-auto-sync" />
            </div>
            <div className="flex items-center justify-between">
              <Label>Import external events</Label>
              <Switch data-testid="switch-outlook-import-events" />
            </div>
            <Button variant="outline" size="sm" data-testid="button-sync-outlook-calendar">
              <RefreshCw className="h-4 w-4 mr-2" />
              Sync Now
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function ImportExportTab() {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">Import & Export</h3>
        <p className="text-sm text-muted-foreground">
          Import data from external sources or export your BIMCall data.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Download className="h-5 w-5" />
              Import
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button variant="outline" className="w-full justify-start" data-testid="button-import-meetings">
              <Calendar className="h-4 w-4 mr-2" />
              Import Meetings from Calendar
            </Button>
            <Button variant="outline" className="w-full justify-start" data-testid="button-import-contacts">
              <Users className="h-4 w-4 mr-2" />
              Import Attendees from Contacts
            </Button>
            <Button variant="outline" className="w-full justify-start" data-testid="button-import-points">
              <Inbox className="h-4 w-4 mr-2" />
              Import Points from Email
            </Button>
            <Button variant="outline" className="w-full justify-start" data-testid="button-import-csv">
              <FileText className="h-4 w-4 mr-2" />
              Import from CSV
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Upload className="h-5 w-5" />
              Export
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button variant="outline" className="w-full justify-start" data-testid="button-export-projects">
              <FileText className="h-4 w-4 mr-2" />
              Export All Projects (CSV)
            </Button>
            <Button variant="outline" className="w-full justify-start" data-testid="button-export-meetings">
              <Calendar className="h-4 w-4 mr-2" />
              Export Meetings (ICS)
            </Button>
            <Button variant="outline" className="w-full justify-start" data-testid="button-export-minutes">
              <FileText className="h-4 w-4 mr-2" />
              Export Meeting Minutes (PDF)
            </Button>
            <Button variant="outline" className="w-full justify-start" data-testid="button-export-backup">
              <FileText className="h-4 w-4 mr-2" />
              Full Data Backup (JSON)
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function NotificationsTab() {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">Notifications</h3>
        <p className="text-sm text-muted-foreground">
          Configure how and when you receive notifications.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Email Notifications</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label>Meeting Reminders</Label>
              <p className="text-xs text-muted-foreground">Get reminded before meetings start</p>
            </div>
            <Switch defaultChecked data-testid="switch-meeting-reminders" />
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div>
              <Label>Point Status Changes</Label>
              <p className="text-xs text-muted-foreground">When action items are updated</p>
            </div>
            <Switch defaultChecked data-testid="switch-point-status" />
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div>
              <Label>New Assignments</Label>
              <p className="text-xs text-muted-foreground">When you're assigned to a point</p>
            </div>
            <Switch defaultChecked data-testid="switch-new-assignments" />
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div>
              <Label>Meeting Minutes</Label>
              <p className="text-xs text-muted-foreground">Receive meeting minutes after meetings</p>
            </div>
            <Switch defaultChecked data-testid="switch-meeting-minutes" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">In-App Notifications</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label>Desktop Notifications</Label>
              <p className="text-xs text-muted-foreground">Show browser notifications</p>
            </div>
            <Switch data-testid="switch-desktop-notifications" />
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div>
              <Label>Sound Alerts</Label>
              <p className="text-xs text-muted-foreground">Play sound for notifications</p>
            </div>
            <Switch data-testid="switch-sound-alerts" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function AccountTab() {
  const { user: currentUser, setDevUser, refreshAuth } = useAuth();
  const { toast } = useToast();
  
  const { data: usersData } = useQuery<{ id: string; name: string; email: string; roles: string[] }[]>({
    queryKey: ["/api/users"],
    queryFn: async () => {
      const response = await fetch("/api/users");
      if (!response.ok) throw new Error("Failed to fetch users");
      return response.json();
    },
  });

  const handleLogin = (user: { id: string; name: string; email: string; roles: string[] }) => {
    setDevUser(user.id, user.email);
    refreshAuth();
    toast({ 
      title: `Logged in as ${user.name}`, 
      description: user.roles.length > 0 ? `Role: ${user.roles.join(", ")}` : "No role assigned" 
    });
  };

  const handleLogout = () => {
    setDevUser(null);
    refreshAuth();
    toast({ title: "Logged out" });
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">Account Settings</h3>
        <p className="text-sm text-muted-foreground">
          Manage your account preferences and personal information.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Current User</CardTitle>
          <CardDescription>Switch between users for testing different roles</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {currentUser ? (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <User className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <p className="font-medium">{currentUser.name}</p>
                  <p className="text-sm text-muted-foreground">{currentUser.email}</p>
                  {currentUser.roles.length > 0 && (
                    <div className="flex gap-1 mt-1">
                      {currentUser.roles.map(role => (
                        <Badge key={role} variant="secondary" className="text-xs">{role}</Badge>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={handleLogout} data-testid="button-logout">
                <LogOut className="h-4 w-4 mr-2" />
                Log Out
              </Button>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Not logged in. Select a user below to log in.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Switch User</CardTitle>
          <CardDescription>Select a user to log in as (development mode)</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2 max-h-64 overflow-y-auto">
            {usersData?.map(user => (
              <div 
                key={user.id} 
                className={`flex items-center justify-between p-3 rounded-lg border ${currentUser?.id === user.id ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'}`}
              >
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-xs font-medium">
                    {user.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-medium">{user.name}</p>
                    <p className="text-xs text-muted-foreground">{user.roles.join(", ") || "No role"}</p>
                  </div>
                </div>
                {currentUser?.id !== user.id && (
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => handleLogin(user)}
                    data-testid={`button-switch-to-${user.id}`}
                  >
                    Log In
                  </Button>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Profile</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
              <User className="h-8 w-8 text-primary" />
            </div>
            <div>
              <p className="font-medium">{currentUser?.name || "BIMCall User"}</p>
              <p className="text-sm text-muted-foreground">{currentUser?.email || "user@example.com"}</p>
            </div>
          </div>
          <Button variant="outline" size="sm" data-testid="button-edit-profile">Edit Profile</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Preferences</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label>Default Meeting Duration</Label>
              <p className="text-xs text-muted-foreground">Default duration for new meetings</p>
            </div>
            <span className="text-sm">1 hour</span>
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div>
              <Label>Time Zone</Label>
              <p className="text-xs text-muted-foreground">Your local time zone</p>
            </div>
            <span className="text-sm">UTC+0</span>
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div>
              <Label>Date Format</Label>
              <p className="text-xs text-muted-foreground">How dates are displayed</p>
            </div>
            <span className="text-sm">DD/MM/YYYY</span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base text-destructive">Danger Zone</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label>Delete All Data</Label>
              <p className="text-xs text-muted-foreground">Permanently delete all your data</p>
            </div>
            <Button variant="destructive" size="sm" data-testid="button-delete-data">Delete</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState("email");

  return (
    <Layout>
      <div className="container mx-auto px-4 sm:px-6 py-6 max-w-4xl space-y-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight" data-testid="text-page-title">Settings</h1>
          <p className="text-muted-foreground mt-1">
            Manage your integrations, notifications, and account preferences.
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid grid-cols-5 w-full">
            <TabsTrigger value="email" className="flex items-center gap-2" data-testid="tab-email">
              <Mail className="h-4 w-4" />
              <span className="hidden sm:inline">Email</span>
            </TabsTrigger>
            <TabsTrigger value="calendar" className="flex items-center gap-2" data-testid="tab-calendar">
              <Calendar className="h-4 w-4" />
              <span className="hidden sm:inline">Calendar</span>
            </TabsTrigger>
            <TabsTrigger value="import-export" className="flex items-center gap-2" data-testid="tab-import-export">
              <Download className="h-4 w-4" />
              <span className="hidden sm:inline">Import/Export</span>
            </TabsTrigger>
            <TabsTrigger value="notifications" className="flex items-center gap-2" data-testid="tab-notifications">
              <Bell className="h-4 w-4" />
              <span className="hidden sm:inline">Notifications</span>
            </TabsTrigger>
            <TabsTrigger value="account" className="flex items-center gap-2" data-testid="tab-account">
              <User className="h-4 w-4" />
              <span className="hidden sm:inline">Account</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="email">
            <EmailIntegrationTab />
          </TabsContent>
          <TabsContent value="calendar">
            <CalendarSyncTab />
          </TabsContent>
          <TabsContent value="import-export">
            <ImportExportTab />
          </TabsContent>
          <TabsContent value="notifications">
            <NotificationsTab />
          </TabsContent>
          <TabsContent value="account">
            <AccountTab />
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}
