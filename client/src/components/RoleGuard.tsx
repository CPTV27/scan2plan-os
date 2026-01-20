import type { UserRole } from "@shared/models/auth";

interface RoleGuardProps {
  children: React.ReactNode;
  allowedRoles: UserRole[];
  redirectTo?: string;
}

export function RoleGuard({ children, allowedRoles: _allowedRoles, redirectTo: _redirectTo = "/" }: RoleGuardProps) {
  return <>{children}</>;
}

export function hasRole(userRole: UserRole | undefined, allowedRoles: UserRole[]): boolean {
  return true;
}
