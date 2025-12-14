import { ReactNode } from "react";
import { Redirect } from "wouter";
import { useAuth, Permissions } from "@/contexts/auth-context";
import Layout from "./layout";
import { Shield } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface ProtectedRouteProps {
  children: ReactNode;
  requiredPermission?: keyof Permissions;
  requiredPermissions?: (keyof Permissions)[];
  requireAny?: boolean;
  fallbackMessage?: string;
}

export function ProtectedRoute({
  children,
  requiredPermission,
  requiredPermissions,
  requireAny = false,
  fallbackMessage = "You don't have permission to access this page.",
}: ProtectedRouteProps) {
  const { user, permissions, isLoading } = useAuth();

  if (isLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-96">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </Layout>
    );
  }

  if (!user) {
    return <Redirect to="/users" />;
  }

  if (!permissions) {
    return <Redirect to="/users" />;
  }

  const permissionsToCheck: (keyof Permissions)[] = [];
  if (requiredPermission) {
    permissionsToCheck.push(requiredPermission);
  }
  if (requiredPermissions) {
    permissionsToCheck.push(...requiredPermissions);
  }

  if (permissionsToCheck.length > 0) {
    const hasPermission = requireAny
      ? permissionsToCheck.some((p) => permissions[p])
      : permissionsToCheck.every((p) => permissions[p]);

    if (!hasPermission) {
      return (
        <Layout>
          <div className="flex items-center justify-center h-96 p-6">
            <Card className="max-w-md w-full border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950">
              <CardContent className="pt-6">
                <div className="flex flex-col items-center text-center gap-4">
                  <div className="p-3 rounded-full bg-amber-100 dark:bg-amber-900">
                    <Shield className="h-8 w-8 text-amber-600 dark:text-amber-400" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-amber-800 dark:text-amber-200 mb-2">
                      Access Restricted
                    </h2>
                    <p className="text-amber-700 dark:text-amber-300 text-sm">
                      {fallbackMessage}
                    </p>
                  </div>
                  <Button variant="outline" onClick={() => window.history.back()} data-testid="button-go-back">
                    Go Back
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </Layout>
      );
    }
  }

  return <>{children}</>;
}

export function RequirePermission({
  children,
  permission,
  fallback = null,
}: {
  children: ReactNode;
  permission: keyof Permissions;
  fallback?: ReactNode;
}) {
  const { permissions } = useAuth();

  if (!permissions || !permissions[permission]) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}

export function RequireAnyPermission({
  children,
  permissions: requiredPerms,
  fallback = null,
}: {
  children: ReactNode;
  permissions: (keyof Permissions)[];
  fallback?: ReactNode;
}) {
  const { permissions } = useAuth();

  if (!permissions) {
    return <>{fallback}</>;
  }

  const hasAny = requiredPerms.some((p) => permissions[p]);
  if (!hasAny) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}
