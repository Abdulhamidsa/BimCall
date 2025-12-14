import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ProjectFilterProvider } from "@/contexts/project-filter-context";
import { AuthProvider } from "@/contexts/auth-context";
import { ProtectedRoute } from "@/components/protected-route";
import NotFound from "@/pages/not-found";
import Dashboard from "@/pages/dashboard";
import MeetingDetail from "@/pages/meeting-detail";
import SeriesDetail from "@/pages/series-detail";
import ProjectsPage from "@/pages/projects";
import ProjectDetail from "@/pages/project-detail";
import SettingsPage from "@/pages/settings";
import UsersPage from "@/pages/users";
import LoginPage from "@/pages/login";
import ProfilePage from "@/pages/profile";
import CompanyDetailPage from "@/pages/company-detail";
import AnalyticsPage from "@/pages/analytics";
import GanttPage from "@/pages/gantt";
import IFCViewerPage from "@/pages/ifc-viewer";

function Router() {
  return (
    <Switch>
      <Route path="/login" component={LoginPage} />
      <Route path="/" component={Dashboard} />
      <Route path="/meeting/:id" component={MeetingDetail} />
      <Route path="/series/:id" component={SeriesDetail} />
      <Route path="/projects">
        <ProtectedRoute
          requiredPermissions={["canViewAllProjects", "canCreateProjects"]}
          requireAny
          fallbackMessage="You don't have permission to access the Projects page. Contact your BIM Manager for access."
        >
          <ProjectsPage />
        </ProtectedRoute>
      </Route>
      <Route path="/project/:id" component={ProjectDetail} />
      <Route path="/settings" component={SettingsPage} />
      <Route path="/analytics" component={AnalyticsPage} />
      <Route path="/gantt" component={GanttPage} />
      <Route path="/ifc-viewer" component={IFCViewerPage} />
      <Route path="/profile" component={ProfilePage} />
      <Route path="/users">
        <ProtectedRoute
          requiredPermissions={["canManageUsers"]}
          fallbackMessage="You don't have permission to access the Users page. Only BIM Managers can manage users."
        >
          <UsersPage />
        </ProtectedRoute>
      </Route>
      <Route path="/company/:id" component={CompanyDetailPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ProjectFilterProvider>
          <TooltipProvider>
            <Toaster />
            <Router />
          </TooltipProvider>
        </ProjectFilterProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
