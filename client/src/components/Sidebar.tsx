import { useState, useMemo } from "react";
import { Link, useLocation } from "wouter";
import { Users, FolderKanban, Settings, LogOut, ScanLine, Menu, X } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { clsx } from "clsx";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import type { UserRole } from "@shared/models/auth";

// Navigation items with role-based access - Sales & Production only
const allNavigation = [
  { name: 'Sales', href: '/sales', icon: Users, roles: ['ceo', 'sales'] as UserRole[] },
  { name: 'Production', href: '/production', icon: FolderKanban, roles: ['ceo', 'production'] as UserRole[] },
  { name: 'Customers', href: '/customers', icon: Users, roles: ['ceo', 'sales'] as UserRole[] },
  { name: 'Settings', href: '/settings', icon: Settings, roles: ['ceo', 'sales', 'production', 'accounting'] as UserRole[] },
];

// Get role display label
function getRoleLabel(role: UserRole | undefined): string {
  switch (role) {
    case 'ceo': return 'CEO Hub';
    case 'sales': return 'Sales Rep';
    case 'production': return 'Production';
    case 'accounting': return 'Accounting';
    default: return 'CEO Hub';
  }
}

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const [location] = useLocation();
  const { logout, user } = useAuth();

  // Filter navigation items based on user role
  const userRole = (user?.role as UserRole) || 'ceo';
  const navigation = useMemo(() => {
    return allNavigation.filter(item => item.roles.includes(userRole));
  }, [userRole]);

  return (
    <>
      <div className="p-6 flex items-center gap-3">
        <div className="bg-primary/10 p-2 rounded-lg border border-primary/20">
          <ScanLine className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="font-display font-bold text-lg leading-none">Scan2Plan-OS</h1>
          <span className="text-xs text-muted-foreground font-medium">{getRoleLabel(userRole)}</span>
        </div>
      </div>

      <nav className="flex-1 px-4 space-y-1.5 mt-4">
        {navigation.map((item) => {
          const isActive = location === item.href || (item.href === '/sales' && location === '/');
          return (
            <Link
              key={item.name}
              href={item.href}
              data-testid={`nav-${item.name.toLowerCase().replace(/\s+/g, '-')}`}
              className={clsx(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 group hover-elevate",
                isActive
                  ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20"
                  : "text-muted-foreground"
              )}
              onClick={onNavigate}
            >
              <item.icon className={clsx(
                "h-5 w-5 transition-colors",
                isActive ? "text-primary-foreground" : "text-muted-foreground group-hover:text-foreground"
              )} />
              {item.name}
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-border">
        <div className="flex items-center gap-3 mb-4 px-2">
          {user?.profileImageUrl && (
            <img src={user.profileImageUrl} alt="Profile" className="w-8 h-8 rounded-full ring-2 ring-border" />
          )}
          <div className="flex-1 overflow-hidden">
            <p className="text-sm font-medium truncate">{user?.firstName} {user?.lastName}</p>
            <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
          </div>
        </div>
        <Button
          variant="outline"
          className="w-full justify-start gap-2"
          onClick={() => logout()}
          data-testid="button-logout"
        >
          <LogOut className="h-4 w-4" />
          Log Out
        </Button>
      </div>
    </>
  );
}

export function Sidebar() {
  return (
    <div className="hidden md:flex flex-col w-64 bg-card border-r border-border h-screen sticky top-0">
      <SidebarContent />
    </div>
  );
}

export function MobileHeader() {
  const [open, setOpen] = useState(false);
  const [location] = useLocation();
  const { user } = useAuth();

  const userRole = (user?.role as UserRole) || 'ceo';
  const navigation = useMemo(() => {
    return allNavigation.filter(item => item.roles.includes(userRole));
  }, [userRole]);

  const currentPage = navigation.find(n => n.href === location) || navigation.find(n => n.href === '/sales');

  return (
    <div className="md:hidden flex items-center justify-between p-4 bg-card border-b border-border sticky top-0 z-50">
      <div className="flex items-center gap-3">
        <div className="bg-primary/10 p-1.5 rounded-lg border border-primary/20">
          <ScanLine className="h-5 w-5 text-primary" />
        </div>
        <span className="font-display font-bold text-sm">{currentPage?.name || 'Scan2Plan-OS'}</span>
      </div>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon" data-testid="button-mobile-menu">
            <Menu className="h-5 w-5" />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-64 p-0">
          <SidebarContent onNavigate={() => setOpen(false)} />
        </SheetContent>
      </Sheet>
    </div>
  );
}
