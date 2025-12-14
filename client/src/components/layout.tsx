import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { 
  LayoutDashboard, 
  FolderKanban, 
  Settings, 
  LogOut, 
  Menu,
  X,
  Users,
  Building2,
  LogIn,
  BarChart3,
  GanttChart,
  Box
} from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import GlobalSearch from "@/components/global-search";
import GlobalProjectFilter from "@/components/global-project-filter";
import { useAuth, ROLE_DISPLAY_NAMES, ROLE_COLORS } from "@/contexts/auth-context";
import { useToast } from "@/hooks/use-toast";

interface LayoutProps {
  children: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const [location, setLocation] = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { user, permissions, logout, setDevUser, refreshAuth } = useAuth();
  const { toast } = useToast();

  const allNavItems = [
    { href: "/", icon: LayoutDashboard, label: "Meetings", show: true },
    { href: "/projects", icon: FolderKanban, label: "Projects", show: permissions?.canViewAllProjects || permissions?.canCreateProjects },
    { href: "/analytics", icon: BarChart3, label: "Analytics", show: true },
    { href: "/gantt", icon: GanttChart, label: "Timeline", show: true },
    { href: "/ifc-viewer", icon: Box, label: "IFC Viewer", show: true },
    { href: "/users", icon: Users, label: "Users", show: permissions?.canManageUsers },
    { href: "/settings", icon: Settings, label: "Settings", show: true },
  ];
  
  const navItems = allNavItems.filter(item => item.show !== false);

  return (
    <div className="min-h-screen flex bg-background font-sans text-foreground">
      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={cn(
        "fixed top-0 left-0 z-50 h-full w-64 bg-sidebar text-sidebar-foreground border-r border-sidebar-border transition-transform duration-300 ease-in-out lg:translate-x-0 flex flex-col",
        sidebarOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="h-16 flex items-center px-6 border-b border-sidebar-border">
          <Building2 className="h-6 w-6 text-sidebar-primary mr-3" />
          <span className="font-bold text-lg tracking-tight">BIMCall</span>
        </div>

        <div className="flex-1 py-6 px-3 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const isActive = location === item.href;
            return (
              <Link key={item.href} href={item.href}>
                <div className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors cursor-pointer",
                  isActive 
                    ? "bg-sidebar-primary text-sidebar-primary-foreground" 
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                )}>
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </div>
              </Link>
            );
          })}
        </div>

        <div className="p-4 border-t border-sidebar-border">
          {user ? (
            <>
              <Link href="/profile">
                <div className="flex items-center gap-3 mb-2 px-2 py-2 rounded-md cursor-pointer hover:bg-sidebar-accent transition-colors" data-testid="link-profile">
                  <Avatar className="h-9 w-9 border border-sidebar-border">
                    <AvatarFallback>{user.name.charAt(0).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col flex-1 min-w-0">
                    <span className="text-sm font-medium truncate">{user.name}</span>
                    <span className="text-xs text-sidebar-foreground/60">View Profile</span>
                  </div>
                </div>
              </Link>
              {user.roles.length > 0 && (
                <div className="flex flex-wrap gap-1 px-2 mb-3">
                  {user.roles.slice(0, 2).map(role => (
                    <Badge key={role} variant="secondary" className={`text-xs ${ROLE_COLORS[role]}`}>
                      {ROLE_DISPLAY_NAMES[role]}
                    </Badge>
                  ))}
                  {user.roles.length > 2 && (
                    <Badge variant="secondary" className="text-xs">+{user.roles.length - 2}</Badge>
                  )}
                </div>
              )}
            </>
          ) : (
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-3 px-2">
                <Avatar className="h-9 w-9 border border-sidebar-border">
                  <AvatarFallback>?</AvatarFallback>
                </Avatar>
                <div className="flex flex-col">
                  <span className="text-sm font-medium text-sidebar-foreground/60">Not logged in</span>
                </div>
              </div>
              <Link href="/login">
                <Button 
                  variant="outline" 
                  className="w-full justify-start"
                  data-testid="button-sidebar-login"
                >
                  <LogIn className="h-4 w-4 mr-2" />
                  Sign In
                </Button>
              </Link>
            </div>
          )}
          {user && (
            <Button 
              variant="ghost" 
              className="w-full justify-start text-sidebar-foreground/70 hover:text-sidebar-accent-foreground hover:bg-sidebar-accent"
              onClick={async () => {
                try {
                  await logout();
                  toast({
                    title: "Signed out",
                    description: "You have been signed out successfully.",
                  });
                  setLocation("/login");
                } catch (error) {
                  setDevUser(null);
                  refreshAuth();
                }
              }}
              data-testid="button-sidebar-logout"
            >
              <LogOut className="h-4 w-4 mr-2" />
              Sign Out
            </Button>
          )}
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-h-0 lg:pl-64 transition-all duration-300">
        {/* Header with Global Search and Project Filter */}
        <header className="h-14 flex items-center px-4 border-b bg-card justify-between sticky top-0 z-30">
          <div className="flex items-center gap-3 flex-1">
            {/* Mobile menu button */}
            <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setSidebarOpen(true)}>
              <Menu className="h-5 w-5" />
            </Button>
            <span className="lg:hidden font-bold text-lg">BIMCall</span>
            
            {/* Global Search and Project Filter */}
            <GlobalSearch />
            {location !== "/projects" && <GlobalProjectFilter />}
          </div>
          <Avatar className="h-8 w-8">
            <AvatarFallback>AC</AvatarFallback>
          </Avatar>
        </header>

        <div className="flex-1 overflow-y-auto bg-background/50">
          {children}
        </div>
      </main>
    </div>
  );
}
