import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  LayoutDashboard, 
  Users, 
  UserCog, 
  FileText, 
  History, 
  Settings,
  LogOut,
  Building2,
  UserCheck,
  ChevronDown,
  ChevronRight,
  CheckCircle
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

export default function Sidebar() {
  const [location] = useLocation();
  const { user } = useAuth();
  const [myLeadsExpanded, setMyLeadsExpanded] = useState(false);
  const [myCompletionExpanded, setMyCompletionExpanded] = useState(false);

  // Fetch my leads for HR users
  const { data: myLeadsData } = useQuery({
    queryKey: ["/api/my/leads", { limit: 5 }],
    enabled: (user as any)?.role === 'hr',
    retry: false,
  });

  // Fetch my completed leads for HR users
  const { data: myCompletedData } = useQuery({
    queryKey: ["/api/my/completed", { limit: 5 }],
    enabled: (user as any)?.role === 'hr' || (user as any)?.role === 'accounts',
    retry: false,
  });

  const handleLogout = () => {
    window.location.href = "/api/logout";
  };

  const navigation = [
    {
      name: "Overview",
      href: "/",
      icon: LayoutDashboard,
      current: location === "/",
    },
    {
      name: "Lead Management",
      href: "/leads",
      icon: Users,
      current: location === "/leads",
    },
    {
      name: "User Management",
      href: "/users",
      icon: UserCog,
      current: location === "/users",
      roleRequired: "manager",
    },
    {
      name: "Reports & Export",
      href: "/reports",
      icon: FileText,
      current: location === "/reports",
      roleRequired: ["admin", "manager"],
    },
    {
      name: "Audit Trail",
      href: "/audit",
      icon: History,
      current: location === "/audit",
    },
  ];

  const getUserInitials = () => {
    const userAny = user as any;
    if (userAny?.firstName && userAny?.lastName) {
      return `${userAny.firstName[0]}${userAny.lastName[0]}`.toUpperCase();
    }
    if (userAny?.fullName) {
      const names = userAny.fullName.split(' ');
      return names.length > 1 
        ? `${names[0][0]}${names[1][0]}`.toUpperCase()
        : names[0][0].toUpperCase();
    }
    return userAny?.username?.[0]?.toUpperCase() || 'U';
  };

  const getUserDisplayName = () => {
    const userAny = user as any;
    if (userAny?.fullName) return userAny.fullName;
    if (userAny?.firstName && userAny?.lastName) return `${userAny.firstName} ${userAny.lastName}`;
    return userAny?.username || 'User';
  };

  const hasAccess = (roleRequired?: string | string[]) => {
    const userAny = user as any;
    if (!roleRequired) return true;
    if (Array.isArray(roleRequired)) {
      return roleRequired.includes(userAny?.role || '');
    }
    return userAny?.role === roleRequired;
  };

  return (
    <div className="w-64 bg-card border-r border-border flex flex-col" data-testid="sidebar">
      {/* Header */}
      <div className="p-6 border-b border-border">
        <div className="flex items-center space-x-3">
          <Building2 className="h-8 w-8 text-primary" />
          <div>
            <h2 className="text-xl font-bold text-foreground">HRM Portal</h2>
            <p className="text-sm text-muted-foreground capitalize">
              {(user as any)?.role || 'User'} Dashboard
            </p>
          </div>
        </div>
      </div>
      
      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-2">
        {navigation.map((item) => {
          if (!hasAccess(item.roleRequired)) return null;
          
          return (
            <Link 
              key={item.name} 
              href={item.href}
              className={`sidebar-item ${item.current ? 'active' : ''}`}
              data-testid={`nav-${item.name.toLowerCase().replace(/\s+/g, '-')}`}
            >
              <item.icon className="w-5 h-5 mr-3" />
              {item.name}
            </Link>
          );
        })}
        
        {/* My Leads Section for HR Users */}
        {(user as any)?.role === 'hr' && (
          <div className="mt-6 pt-4 border-t border-border">
            <button
              onClick={() => setMyLeadsExpanded(!myLeadsExpanded)}
              className="w-full flex items-center justify-between p-2 text-sm text-muted-foreground hover:text-foreground hover:bg-accent rounded-md transition-colors"
              data-testid="button-my-leads-toggle"
            >
              <div className="flex items-center">
                <UserCheck className="w-4 h-4 mr-2" />
                <span>My Leads</span>
                {(myLeadsData as any)?.total > 0 && (
                  <Badge variant="secondary" className="ml-2 text-xs">
                    {(myLeadsData as any).total}
                  </Badge>
                )}
              </div>
              {myLeadsExpanded ? (
                <ChevronDown className="w-4 h-4" />
              ) : (
                <ChevronRight className="w-4 h-4" />
              )}
            </button>
            
            {myLeadsExpanded && (
              <div className="mt-2 space-y-1 pl-6">
                {(myLeadsData as any)?.leads?.length > 0 ? (
                  <>
                    {(myLeadsData as any).leads.slice(0, 3).map((lead: any) => (
                      <Link
                        key={lead.id}
                        href={`/my-leads`}
                        className="block px-2 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-accent rounded transition-colors truncate"
                        data-testid={`link-my-lead-${lead.id}`}
                      >
                        {lead.name} • {lead.status.replace('_', ' ')}
                      </Link>
                    ))}
                    {(myLeadsData as any).total > 3 && (
                      <Link
                        href="/my-leads"
                        className="block px-2 py-1 text-xs text-primary hover:text-primary/80 rounded transition-colors"
                        data-testid="link-view-all-my-leads"
                      >
                        View all {(myLeadsData as any).total} leads →
                      </Link>
                    )}
                  </>
                ) : (
                  <p className="px-2 py-1 text-xs text-muted-foreground">
                    No leads assigned yet
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {/* My Completion section for HR and Accounts users */}
        {((user as any)?.role === 'hr' || (user as any)?.role === 'accounts') && (
          <div className="mt-4">
            <button
              onClick={() => setMyCompletionExpanded(!myCompletionExpanded)}
              className="w-full flex items-center justify-between p-2 text-sm text-muted-foreground hover:text-foreground hover:bg-accent rounded-md transition-colors"
              data-testid="button-my-completion-toggle"
            >
              <div className="flex items-center">
                <CheckCircle className="w-4 h-4 mr-2" />
                <span>My Completion</span>
                {(myCompletedData as any)?.total > 0 && (
                  <Badge variant="secondary" className="ml-2 text-xs">
                    {(myCompletedData as any).total}
                  </Badge>
                )}
              </div>
              {myCompletionExpanded ? (
                <ChevronDown className="w-4 h-4" />
              ) : (
                <ChevronRight className="w-4 h-4" />
              )}
            </button>
            
            {myCompletionExpanded && (
              <div className="mt-2 space-y-1 pl-6">
                {(myCompletedData as any)?.leads?.length > 0 ? (
                  <>
                    {(myCompletedData as any).leads.slice(0, 3).map((lead: any) => (
                      <Link
                        key={lead.id}
                        href={`/my-completion`}
                        className="block px-2 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-accent rounded transition-colors truncate"
                        data-testid={`link-my-completed-${lead.id}`}
                      >
                        {lead.name} • {lead.status.replace('_', ' ')}
                      </Link>
                    ))}
                    {(myCompletedData as any).total > 3 && (
                      <Link
                        href="/my-completion"
                        className="block px-2 py-1 text-xs text-primary hover:text-primary/80 rounded transition-colors"
                        data-testid="link-view-all-my-completion"
                      >
                        View all {(myCompletedData as any).total} completed →
                      </Link>
                    )}
                  </>
                ) : (
                  <p className="px-2 py-1 text-xs text-muted-foreground">
                    No completed leads yet
                  </p>
                )}
              </div>
            )}
          </div>
        )}
      </nav>
      
      {/* User Profile */}
      <div className="p-4 border-t border-border">
        <div className="flex items-center space-x-3 mb-4">
          <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center">
            <span className="text-primary-foreground font-semibold text-sm">
              {getUserInitials()}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate" data-testid="text-user-name">
              {getUserDisplayName()}
            </p>
            <p className="text-xs text-muted-foreground capitalize" data-testid="text-user-role">
              {(user as any)?.role || 'User'}
            </p>
          </div>
        </div>
        
        <Button 
          variant="ghost" 
          className="w-full justify-start text-muted-foreground hover:text-foreground"
          onClick={handleLogout}
          data-testid="button-logout"
        >
          <LogOut className="w-4 h-4 mr-2" />
          Sign Out
        </Button>
      </div>
    </div>
  );
}
