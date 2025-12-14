import { useState } from "react";
import { useParams, useLocation } from "wouter";
import Layout from "@/components/layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Building2, 
  Users, 
  BarChart3, 
  Mail, 
  Phone,
  Globe,
  MapPin,
  Loader2,
  Save,
  Pencil,
  X,
  FolderKanban,
  Target,
  CalendarDays,
  ArrowLeft,
  ChevronRight,
  User
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { ROLE_DISPLAY_NAMES, ROLE_COLORS, Role, useAuth, useHasPermission, CompanyRole, COMPANY_ROLE_DISPLAY_NAMES, COMPANY_ROLE_COLORS } from "@/contexts/auth-context";

interface Company {
  id: string;
  name: string;
  code: string | null;
  description: string | null;
  logo: string | null;
  website: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  country: string | null;
  industry: string | null;
  size: string | null;
  createdAt: string;
}

interface Employee {
  id: string;
  name: string;
  email: string;
  avatar: string | null;
  isActive: boolean;
  roles: Role[];
  companyRole: CompanyRole | null;
}

interface CompanyStats {
  employeeCount: number;
  projectCount: number;
  openPointsCount: number;
  meetingsThisMonth: number;
}

const INDUSTRY_OPTIONS = [
  { value: "construction", label: "Construction" },
  { value: "architecture", label: "Architecture" },
  { value: "engineering", label: "Engineering" },
  { value: "consulting", label: "Consulting" },
  { value: "other", label: "Other" },
];

const SIZE_OPTIONS = [
  { value: "small", label: "Small (1-50)" },
  { value: "medium", label: "Medium (51-200)" },
  { value: "large", label: "Large (201-1000)" },
  { value: "enterprise", label: "Enterprise (1000+)" },
];

export default function CompanyDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const canManageUsers = useHasPermission("canManageUsers");
  
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<Partial<Company>>({});

  const { data: company, isLoading: isLoadingCompany } = useQuery<Company>({
    queryKey: ["/api/companies", id],
    queryFn: async () => {
      const response = await fetch(`/api/companies/${id}`);
      if (!response.ok) throw new Error("Company not found");
      return response.json();
    },
    enabled: !!id,
  });

  const { data: employees = [], isLoading: isLoadingEmployees } = useQuery<Employee[]>({
    queryKey: ["/api/companies", id, "employees"],
    queryFn: async () => {
      const response = await fetch(`/api/companies/${id}/employees`);
      if (!response.ok) return [];
      return response.json();
    },
    enabled: !!id,
  });

  const { data: stats } = useQuery<CompanyStats>({
    queryKey: ["/api/companies", id, "stats"],
    queryFn: async () => {
      const response = await fetch(`/api/companies/${id}/stats`);
      if (!response.ok) throw new Error("Failed to fetch stats");
      return response.json();
    },
    enabled: !!id,
  });

  const updateMutation = useMutation({
    mutationFn: async (data: Partial<Company>) => {
      return apiRequest("PATCH", `/api/companies/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/companies", id] });
      toast({ title: "Company updated successfully" });
      setIsEditing(false);
    },
    onError: () => {
      toast({ title: "Failed to update company", variant: "destructive" });
    },
  });

  const handleEdit = () => {
    if (company) {
      setEditForm({
        name: company.name,
        code: company.code,
        description: company.description,
        website: company.website,
        email: company.email,
        phone: company.phone,
        address: company.address,
        city: company.city,
        country: company.country,
        industry: company.industry,
        size: company.size,
      });
      setIsEditing(true);
    }
  };

  const handleSave = () => {
    updateMutation.mutate(editForm);
  };

  const handleCancel = () => {
    setIsEditing(false);
    setEditForm({});
  };

  if (isLoadingCompany) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </Layout>
    );
  }

  if (!company) {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center h-64 gap-4">
          <p className="text-muted-foreground">Company not found</p>
          <Button variant="outline" onClick={() => setLocation("/users")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Users
          </Button>
        </div>
      </Layout>
    );
  }

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  return (
    <Layout>
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
          <Button 
            variant="link" 
            className="p-0 h-auto text-muted-foreground hover:text-foreground"
            onClick={() => setLocation("/users")}
            data-testid="link-users"
          >
            Users & Companies
          </Button>
          <ChevronRight className="h-4 w-4" />
          <span className="text-foreground">{company.name}</span>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 rounded-lg bg-primary/10 flex items-center justify-center">
              <Building2 className="h-8 w-8 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold" data-testid="text-company-name">{company.name}</h1>
              {company.code && (
                <p className="text-muted-foreground" data-testid="text-company-code">Code: {company.code}</p>
              )}
            </div>
          </div>
          {canManageUsers && !isEditing && (
            <Button onClick={handleEdit} variant="outline" data-testid="button-edit-company">
              <Pencil className="h-4 w-4 mr-2" />
              Edit Company
            </Button>
          )}
        </div>

        <Tabs defaultValue="profile" className="space-y-6">
          <TabsList>
            <TabsTrigger value="profile" className="gap-2" data-testid="tab-profile">
              <Building2 className="h-4 w-4" />
              Profile
            </TabsTrigger>
            <TabsTrigger value="employees" className="gap-2" data-testid="tab-employees">
              <Users className="h-4 w-4" />
              Employees ({employees.length})
            </TabsTrigger>
            <TabsTrigger value="dashboard" className="gap-2" data-testid="tab-dashboard">
              <BarChart3 className="h-4 w-4" />
              Dashboard
            </TabsTrigger>
          </TabsList>

          <TabsContent value="profile" className="space-y-6">
            {isEditing ? (
              <Card>
                <CardHeader>
                  <CardTitle>Edit Company Profile</CardTitle>
                  <CardDescription>Update company information</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="name">Company Name *</Label>
                      <Input
                        id="name"
                        value={editForm.name || ""}
                        onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                        data-testid="input-company-name"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="code">Company Code</Label>
                      <Input
                        id="code"
                        value={editForm.code || ""}
                        onChange={(e) => setEditForm({ ...editForm, code: e.target.value })}
                        data-testid="input-company-code"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                      id="description"
                      value={editForm.description || ""}
                      onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                      rows={3}
                      data-testid="input-company-description"
                    />
                  </div>

                  <Separator />

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="email">Email</Label>
                      <Input
                        id="email"
                        type="email"
                        value={editForm.email || ""}
                        onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                        data-testid="input-company-email"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="phone">Phone</Label>
                      <Input
                        id="phone"
                        value={editForm.phone || ""}
                        onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                        data-testid="input-company-phone"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="website">Website</Label>
                      <Input
                        id="website"
                        value={editForm.website || ""}
                        onChange={(e) => setEditForm({ ...editForm, website: e.target.value })}
                        data-testid="input-company-website"
                      />
                    </div>
                  </div>

                  <Separator />

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="address">Address</Label>
                      <Input
                        id="address"
                        value={editForm.address || ""}
                        onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
                        data-testid="input-company-address"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="city">City</Label>
                      <Input
                        id="city"
                        value={editForm.city || ""}
                        onChange={(e) => setEditForm({ ...editForm, city: e.target.value })}
                        data-testid="input-company-city"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="country">Country</Label>
                      <Input
                        id="country"
                        value={editForm.country || ""}
                        onChange={(e) => setEditForm({ ...editForm, country: e.target.value })}
                        data-testid="input-company-country"
                      />
                    </div>
                  </div>

                  <Separator />

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="industry">Industry</Label>
                      <Select
                        value={editForm.industry || ""}
                        onValueChange={(value) => setEditForm({ ...editForm, industry: value })}
                      >
                        <SelectTrigger data-testid="select-company-industry">
                          <SelectValue placeholder="Select industry" />
                        </SelectTrigger>
                        <SelectContent>
                          {INDUSTRY_OPTIONS.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="size">Company Size</Label>
                      <Select
                        value={editForm.size || ""}
                        onValueChange={(value) => setEditForm({ ...editForm, size: value })}
                      >
                        <SelectTrigger data-testid="select-company-size">
                          <SelectValue placeholder="Select size" />
                        </SelectTrigger>
                        <SelectContent>
                          {SIZE_OPTIONS.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="flex gap-2 justify-end">
                    <Button variant="outline" onClick={handleCancel} data-testid="button-cancel-edit">
                      <X className="h-4 w-4 mr-2" />
                      Cancel
                    </Button>
                    <Button 
                      onClick={handleSave} 
                      disabled={updateMutation.isPending || !editForm.name}
                      data-testid="button-save-company"
                    >
                      {updateMutation.isPending ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Save className="h-4 w-4 mr-2" />
                      )}
                      Save Changes
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Building2 className="h-5 w-5" />
                      Company Information
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {company.description && (
                      <div>
                        <p className="text-sm text-muted-foreground">Description</p>
                        <p>{company.description}</p>
                      </div>
                    )}
                    {company.industry && (
                      <div>
                        <p className="text-sm text-muted-foreground">Industry</p>
                        <Badge variant="secondary">
                          {INDUSTRY_OPTIONS.find(o => o.value === company.industry)?.label || company.industry}
                        </Badge>
                      </div>
                    )}
                    {company.size && (
                      <div>
                        <p className="text-sm text-muted-foreground">Company Size</p>
                        <Badge variant="outline">
                          {SIZE_OPTIONS.find(o => o.value === company.size)?.label || company.size}
                        </Badge>
                      </div>
                    )}
                    {!company.description && !company.industry && !company.size && (
                      <p className="text-muted-foreground text-sm">No company information available</p>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Mail className="h-5 w-5" />
                      Contact Information
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {company.email && (
                      <div className="flex items-center gap-2">
                        <Mail className="h-4 w-4 text-muted-foreground" />
                        <a href={`mailto:${company.email}`} className="text-primary hover:underline">
                          {company.email}
                        </a>
                      </div>
                    )}
                    {company.phone && (
                      <div className="flex items-center gap-2">
                        <Phone className="h-4 w-4 text-muted-foreground" />
                        <span>{company.phone}</span>
                      </div>
                    )}
                    {company.website && (
                      <div className="flex items-center gap-2">
                        <Globe className="h-4 w-4 text-muted-foreground" />
                        <a 
                          href={company.website.startsWith('http') ? company.website : `https://${company.website}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:underline"
                        >
                          {company.website}
                        </a>
                      </div>
                    )}
                    {(company.address || company.city || company.country) && (
                      <div className="flex items-start gap-2">
                        <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                        <div>
                          {company.address && <p>{company.address}</p>}
                          {(company.city || company.country) && (
                            <p>{[company.city, company.country].filter(Boolean).join(", ")}</p>
                          )}
                        </div>
                      </div>
                    )}
                    {!company.email && !company.phone && !company.website && !company.address && !company.city && !company.country && (
                      <p className="text-muted-foreground text-sm">No contact information available</p>
                    )}
                  </CardContent>
                </Card>
              </div>
            )}
          </TabsContent>

          <TabsContent value="employees" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Employee Directory
                </CardTitle>
                <CardDescription>
                  {employees.length} employee{employees.length !== 1 ? 's' : ''} in this company
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isLoadingEmployees ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : employees.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">
                    No employees found in this company
                  </p>
                ) : (
                  <div className="space-y-4">
                    {employees.map((employee) => (
                      <div 
                        key={employee.id} 
                        className="flex items-center justify-between p-4 rounded-lg border hover:bg-muted/50 cursor-pointer transition-colors"
                        onClick={() => setLocation(`/profile`)}
                        data-testid={`card-employee-${employee.id}`}
                      >
                        <div className="flex items-center gap-3">
                          <Avatar>
                            <AvatarFallback className="bg-primary/10 text-primary">
                              {getInitials(employee.name)}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium">{employee.name}</p>
                            <p className="text-sm text-muted-foreground">{employee.email}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {employee.companyRole && (
                            <Badge 
                              variant="outline"
                              className={COMPANY_ROLE_COLORS[employee.companyRole]}
                            >
                              {COMPANY_ROLE_DISPLAY_NAMES[employee.companyRole]}
                            </Badge>
                          )}
                          {employee.roles.map((role) => (
                            <Badge 
                              key={role} 
                              variant="secondary"
                              className={ROLE_COLORS[role]}
                            >
                              {ROLE_DISPLAY_NAMES[role]}
                            </Badge>
                          ))}
                          {!employee.isActive && (
                            <Badge variant="outline" className="text-muted-foreground">
                              Inactive
                            </Badge>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="dashboard" className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Employees</p>
                      <p className="text-3xl font-bold" data-testid="stat-employee-count">
                        {stats?.employeeCount ?? 0}
                      </p>
                    </div>
                    <div className="h-12 w-12 rounded-full bg-blue-500/10 flex items-center justify-center">
                      <Users className="h-6 w-6 text-blue-500" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Projects</p>
                      <p className="text-3xl font-bold" data-testid="stat-project-count">
                        {stats?.projectCount ?? 0}
                      </p>
                    </div>
                    <div className="h-12 w-12 rounded-full bg-green-500/10 flex items-center justify-center">
                      <FolderKanban className="h-6 w-6 text-green-500" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Open Points</p>
                      <p className="text-3xl font-bold" data-testid="stat-open-points">
                        {stats?.openPointsCount ?? 0}
                      </p>
                    </div>
                    <div className="h-12 w-12 rounded-full bg-yellow-500/10 flex items-center justify-center">
                      <Target className="h-6 w-6 text-yellow-500" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Meetings This Month</p>
                      <p className="text-3xl font-bold" data-testid="stat-meetings-month">
                        {stats?.meetingsThisMonth ?? 0}
                      </p>
                    </div>
                    <div className="h-12 w-12 rounded-full bg-purple-500/10 flex items-center justify-center">
                      <CalendarDays className="h-6 w-6 text-purple-500" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Company Activity</CardTitle>
                <CardDescription>Overview of company performance and activity</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground text-sm">
                  More detailed analytics and charts will be available in future updates.
                </p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}
