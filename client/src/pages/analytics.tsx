import { useQuery } from "@tanstack/react-query";
import Layout from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { dashboardApi, type DashboardStats } from "@/lib/api";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  LineChart,
  Line,
} from "recharts";
import {
  FolderKanban,
  Calendar,
  Repeat,
  CircleDot,
  Users,
  Building2,
  AlertTriangle,
  CheckCircle2,
  Clock,
} from "lucide-react";
import { format, parse } from "date-fns";

const STATUS_COLORS: Record<string, string> = {
  open: "#3b82f6",
  new: "#8b5cf6",
  ongoing: "#f59e0b",
  closed: "#22c55e",
  resolved: "#10b981",
};

const DISCIPLINE_COLORS = [
  "#3b82f6", "#8b5cf6", "#ec4899", "#f59e0b", "#22c55e",
  "#06b6d4", "#6366f1", "#f97316", "#84cc16", "#14b8a6", "#a855f7"
];

const PROJECT_STATUS_COLORS: Record<string, string> = {
  active: "#22c55e",
  planning: "#3b82f6",
  on_hold: "#f59e0b",
  completed: "#6b7280",
  cancelled: "#ef4444",
};

function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  variant = "default",
}: {
  title: string;
  value: number | string;
  subtitle?: string;
  icon: React.ElementType;
  variant?: "default" | "success" | "warning" | "danger";
}) {
  const variantClasses = {
    default: "bg-card",
    success: "bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-900",
    warning: "bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900",
    danger: "bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-900",
  };

  const iconClasses = {
    default: "text-muted-foreground",
    success: "text-green-600 dark:text-green-400",
    warning: "text-amber-600 dark:text-amber-400",
    danger: "text-red-600 dark:text-red-400",
  };

  return (
    <Card className={variantClasses[variant]} data-testid={`stat-card-${title.toLowerCase().replace(/\s+/g, '-')}`}>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <p className="text-3xl font-bold mt-1">{value}</p>
            {subtitle && (
              <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
            )}
          </div>
          <Icon className={`h-8 w-8 ${iconClasses[variant]}`} />
        </div>
      </CardContent>
    </Card>
  );
}

function LoadingSkeleton() {
  return (
    <Layout>
      <div className="container mx-auto py-8">
        <Skeleton className="h-10 w-48 mb-8" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {[...Array(8)].map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-80" />
          ))}
        </div>
      </div>
    </Layout>
  );
}

export default function AnalyticsPage() {
  const { data: stats, isLoading, error } = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: dashboardApi.getStats,
  });

  if (isLoading) {
    return <LoadingSkeleton />;
  }

  if (error) {
    return (
      <Layout>
        <div className="container mx-auto py-8">
          <div className="text-center text-destructive">
            Failed to load analytics data. Please try again.
          </div>
        </div>
      </Layout>
    );
  }

  if (!stats) {
    return null;
  }

  const meetingsByMonthFormatted = stats.meetingsByMonth.map((item) => ({
    ...item,
    monthLabel: format(parse(item.month, "yyyy-MM", new Date()), "MMM yy"),
    total: item.meetings + item.series,
  }));

  const pointsByStatusForChart = stats.pointsByStatus.map((item) => ({
    ...item,
    fill: STATUS_COLORS[item.status] || "#6b7280",
    statusLabel: item.status.charAt(0).toUpperCase() + item.status.slice(1),
  }));

  const projectsByStatusForChart = stats.projectsByStatus.map((item) => ({
    ...item,
    fill: PROJECT_STATUS_COLORS[item.status] || "#6b7280",
    statusLabel: item.status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
  }));

  const pointsByDisciplineForChart = stats.pointsByDiscipline.map((item, index) => ({
    ...item,
    fill: DISCIPLINE_COLORS[index % DISCIPLINE_COLORS.length],
  }));

  return (
    <Layout>
      <div className="container mx-auto py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold" data-testid="text-analytics-title">Analytics Dashboard</h1>
            <p className="text-muted-foreground mt-1">
              Overview of your BIM coordination activities
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <StatCard
            title="Total Projects"
            value={stats.totalProjects}
            subtitle={`${stats.activeProjects} active`}
            icon={FolderKanban}
          />
          <StatCard
            title="Meetings"
            value={stats.totalMeetings}
            subtitle={`${stats.scheduledMeetings} scheduled`}
            icon={Calendar}
          />
          <StatCard
            title="Series"
            value={stats.totalSeries}
            subtitle={`${stats.activeSeries} active`}
            icon={Repeat}
          />
          <StatCard
            title="Total Points"
            value={stats.totalPoints}
            subtitle={`${stats.openPoints} open`}
            icon={CircleDot}
          />
          <StatCard
            title="Open Points"
            value={stats.openPoints}
            icon={Clock}
            variant="warning"
          />
          <StatCard
            title="Overdue Points"
            value={stats.overduePoints}
            icon={AlertTriangle}
            variant="danger"
          />
          <StatCard
            title="Closed Points"
            value={stats.closedPoints}
            icon={CheckCircle2}
            variant="success"
          />
          <StatCard
            title="Users & Companies"
            value={stats.totalUsers}
            subtitle={`${stats.totalCompanies} companies`}
            icon={Users}
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card data-testid="chart-meetings-trend">
            <CardHeader>
              <CardTitle className="text-lg">Meetings & Series Trend</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={meetingsByMonthFormatted}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis
                      dataKey="monthLabel"
                      tick={{ fontSize: 12 }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 12 }}
                      tickLine={false}
                      axisLine={false}
                      allowDecimals={false}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                      }}
                    />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="meetings"
                      stroke="#3b82f6"
                      strokeWidth={2}
                      dot={{ fill: "#3b82f6" }}
                      name="Meetings"
                    />
                    <Line
                      type="monotone"
                      dataKey="series"
                      stroke="#8b5cf6"
                      strokeWidth={2}
                      dot={{ fill: "#8b5cf6" }}
                      name="Series"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card data-testid="chart-points-status">
            <CardHeader>
              <CardTitle className="text-lg">Points by Status</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pointsByStatusForChart}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ statusLabel, count, percent }) =>
                        `${statusLabel}: ${count} (${(percent * 100).toFixed(0)}%)`
                      }
                      outerRadius={80}
                      dataKey="count"
                    >
                      {pointsByStatusForChart.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card data-testid="chart-projects-status">
            <CardHeader>
              <CardTitle className="text-lg">Projects by Status</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={projectsByStatusForChart} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis
                      type="number"
                      tick={{ fontSize: 12 }}
                      tickLine={false}
                      axisLine={false}
                      allowDecimals={false}
                    />
                    <YAxis
                      dataKey="statusLabel"
                      type="category"
                      tick={{ fontSize: 12 }}
                      tickLine={false}
                      axisLine={false}
                      width={100}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                      }}
                    />
                    <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                      {projectsByStatusForChart.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card data-testid="chart-points-discipline">
            <CardHeader>
              <CardTitle className="text-lg">Points by Discipline</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-72">
                {pointsByDisciplineForChart.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={pointsByDisciplineForChart}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis
                        dataKey="discipline"
                        tick={{ fontSize: 11 }}
                        tickLine={false}
                        axisLine={false}
                        angle={-45}
                        textAnchor="end"
                        height={60}
                      />
                      <YAxis
                        tick={{ fontSize: 12 }}
                        tickLine={false}
                        axisLine={false}
                        allowDecimals={false}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "hsl(var(--card))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "8px",
                        }}
                      />
                      <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                        {pointsByDisciplineForChart.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.fill} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-full text-muted-foreground">
                    No discipline data available
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Companies Overview
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Total Companies</span>
                  <Badge variant="secondary" className="text-lg px-3">
                    {stats.totalCompanies}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Total Users</span>
                  <Badge variant="secondary" className="text-lg px-3">
                    {stats.totalUsers}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Avg Users/Company</span>
                  <Badge variant="outline" className="text-lg px-3">
                    {stats.totalCompanies > 0
                      ? (stats.totalUsers / stats.totalCompanies).toFixed(1)
                      : 0}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <CircleDot className="h-5 w-5" />
                Points Summary
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Completion Rate</span>
                  <Badge
                    variant="secondary"
                    className="text-lg px-3 bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300"
                  >
                    {stats.totalPoints > 0
                      ? ((stats.closedPoints / stats.totalPoints) * 100).toFixed(1)
                      : 0}%
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Overdue Rate</span>
                  <Badge
                    variant="secondary"
                    className={`text-lg px-3 ${
                      stats.overduePoints > 0
                        ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300"
                        : "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300"
                    }`}
                  >
                    {stats.openPoints > 0
                      ? ((stats.overduePoints / stats.openPoints) * 100).toFixed(1)
                      : 0}%
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Avg Points/Meeting</span>
                  <Badge variant="outline" className="text-lg px-3">
                    {stats.totalMeetings + stats.totalSeries > 0
                      ? (stats.totalPoints / (stats.totalMeetings + stats.totalSeries)).toFixed(1)
                      : 0}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
}
