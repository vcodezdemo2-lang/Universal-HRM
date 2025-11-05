import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import Sidebar from "@/components/Sidebar";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Search, History, User, ArrowRight } from "lucide-react";

export default function Audit() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading, user } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedLeadId, setSelectedLeadId] = useState<number | null>(null);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      toast({
        title: "Unauthorized",
        description: "You are logged out. Logging in again...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/login";
      }, 500);
      return;
    }
  }, [isAuthenticated, isLoading, toast]);

  const { data: leads } = useQuery({
    queryKey: ["/api/leads", { search: searchTerm, limit: 50 }],
    retry: false,
    enabled: !!searchTerm,
  });

  const { data: leadHistory } = useQuery({
    queryKey: [`/api/leads/${selectedLeadId}/history`],
    retry: false,
    enabled: !!selectedLeadId,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'new':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400';
      case 'scheduled':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400';
      case 'completed':
        return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400';
      case 'not_interested':
        return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400';
      case 'pending':
        return 'bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-400';
      case 'ready_for_class':
        return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-400';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      
      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="bg-card border-b border-border px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-foreground" data-testid="text-page-title">
                Audit Trail
              </h1>
              <p className="text-sm text-muted-foreground">
                Track all lead modifications and ownership transfers
              </p>
            </div>
          </div>
        </header>

        {/* Search */}
        <div className="bg-card border-b border-border px-6 py-4">
          <div className="relative">
            <Input
              type="text"
              placeholder="Search leads by name, email, or phone..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full max-w-md pl-10"
              data-testid="input-search-audit"
            />
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          </div>
        </div>

        {/* Content */}
        <main className="flex-1 overflow-y-auto p-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Lead Search Results */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Search className="mr-2 h-5 w-5" />
                  Search Results
                </CardTitle>
              </CardHeader>
              <CardContent>
                {!searchTerm ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <History className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>Enter a search term to find leads and view their audit trail</p>
                  </div>
                ) : !leads?.leads?.length ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <p>No leads found matching "{searchTerm}"</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {leads.leads.map((lead: any) => (
                      <div
                        key={lead.id}
                        className={`p-3 border rounded-lg cursor-pointer transition-colors hover:bg-muted/50 ${
                          selectedLeadId === lead.id ? 'border-primary bg-primary/5' : 'border-border'
                        }`}
                        onClick={() => setSelectedLeadId(lead.id)}
                        data-testid={`lead-item-${lead.id}`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="font-medium">{lead.name}</h4>
                          <Badge className={getStatusColor(lead.status)}>
                            {lead.status}
                          </Badge>
                        </div>
                        <div className="text-sm text-muted-foreground">
                          <p>{lead.email}</p>
                          <p>{lead.phone}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Audit Trail */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <History className="mr-2 h-5 w-5" />
                  Audit Trail
                </CardTitle>
              </CardHeader>
              <CardContent>
                {!selectedLeadId ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <User className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>Select a lead to view its complete audit trail</p>
                  </div>
                ) : !leadHistory?.length ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <p>No history found for this lead</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {leadHistory.map((entry: any, index: number) => (
                      <div
                        key={entry.id}
                        className="border-l-2 border-primary pl-4 pb-4"
                        data-testid={`history-entry-${index}`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center space-x-2">
                            {entry.previousStatus && entry.newStatus && (
                              <>
                                <Badge variant="outline" className="text-xs">
                                  {entry.previousStatus}
                                </Badge>
                                <ArrowRight className="h-3 w-3 text-muted-foreground" />
                                <Badge className={`text-xs ${getStatusColor(entry.newStatus)}`}>
                                  {entry.newStatus}
                                </Badge>
                              </>
                            )}
                          </div>
                        </div>
                        
                        <div className="text-sm">
                          <p className="font-medium text-foreground">
                            {entry.changeReason || 'Status updated'}
                          </p>
                          <p className="text-muted-foreground mt-1">
                            Changed by: {entry.changedBy?.fullName || entry.changedBy?.firstName || 'System'}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {formatDate(entry.changedAt)}
                          </p>
                        </div>

                        {entry.changeData && (
                          <details className="mt-2">
                            <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">
                              View Details
                            </summary>
                            <pre className="text-xs text-muted-foreground mt-1 bg-muted p-2 rounded overflow-x-auto">
                              {JSON.stringify(JSON.parse(entry.changeData), null, 2)}
                            </pre>
                          </details>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    </div>
  );
}
