import { useState } from "react";
import Sidebar from "@/components/Sidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { Search, Calendar, User, Phone, Mail, MapPin, GraduationCap, Clock, ChevronDown, ChevronUp, History, ArrowRight } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface Lead {
  id: number;
  name: string;
  email: string;
  phone: string;
  location: string;
  degree: string;
  domain: string;
  sessionDays: string;
  timing: string;
  walkinDate: string;
  walkinTime: string;
  status: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
  currentOwner: any;
  sourceManagerId: string;
  sourceManager: any;
  isActive: boolean;
}

interface LeadHistory {
  id: number;
  fromUserId: string;
  toUserId: string;
  previousStatus: string;
  newStatus: string;
  changeReason: string;
  changeData: any;
  changedAt: string;
  changedByUserId: string;
}

export default function MyCompletionPage() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");
  const [expandedLeadId, setExpandedLeadId] = useState<number | null>(null);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'status-completed';
      case 'pending':
        return 'status-pending';
      case 'ready_for_class':
        return 'status-ready-for-class';
      default:
        return 'status-completed';
    }
  };

  // Fetch my completed leads
  const { data, isLoading: dataLoading, error } = useQuery({
    queryKey: ["/api/my/completed", { search: searchTerm }],
    retry: false,
  });

  // Fetch lead history for expanded lead
  const { data: leadHistory } = useQuery({
    queryKey: ["/api/leads", expandedLeadId, "history"],
    retry: false,
    enabled: !!expandedLeadId,
  });

  // Filter leads based on search term
  const filteredLeads = data?.leads?.filter((lead: Lead) => 
    lead.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    lead.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    lead.phone?.includes(searchTerm)
  ) || [];

  if (isLoading || dataLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  if (error) {
    return (
      <div className="flex h-screen bg-background">
        <Sidebar />
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex items-center justify-center h-64">
            <Card>
              <CardContent className="p-8 text-center">
                <p className="text-destructive">Failed to load completed leads. Please try again.</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      
      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="bg-card border-b border-border px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-foreground" data-testid="heading-my-completion">
                My Completion
              </h1>
              <p className="text-sm text-muted-foreground">
                View leads you've completed and their current status in accounts processing
              </p>
            </div>
          </div>
        </header>

        {/* Search */}
        <div className="bg-card border-b border-border px-6 py-4">
          <div className="relative">
            <Input
              placeholder="Search by name, email, or phone..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full max-w-md pl-10"
              data-testid="input-search-completed"
            />
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          </div>
        </div>

        {/* Content */}
        <main className="flex-1 overflow-y-auto p-6">
          {/* Completed Leads List */}
          <div className="space-y-4">
          {filteredLeads.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <div className="flex flex-col items-center">
                  <History className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold text-foreground mb-2">
                    No Completed Leads
                  </h3>
                  <p className="text-muted-foreground">
                    {searchTerm 
                      ? "No completed leads match your search criteria." 
                      : "You haven't completed any leads yet. Completed leads will appear here."
                    }
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : (
            filteredLeads.map((lead: Lead) => (
              <Card key={lead.id} className="overflow-hidden">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-lg font-semibold text-foreground">
                        {lead.name}
                        <Badge className={`ml-3 ${getStatusColor(lead.status)}`}>
                          {lead.status.replace('_', ' ')}
                        </Badge>
                      </CardTitle>
                      <div className="flex flex-wrap gap-4 mt-2 text-sm text-muted-foreground">
                        <div className="flex items-center">
                          <Mail className="h-4 w-4 mr-1" />
                          {lead.email}
                        </div>
                        {lead.phone && (
                          <div className="flex items-center">
                            <Phone className="h-4 w-4 mr-1" />
                            {lead.phone}
                          </div>
                        )}
                        {lead.location && (
                          <div className="flex items-center">
                            <MapPin className="h-4 w-4 mr-1" />
                            {lead.location}
                          </div>
                        )}
                      </div>
                    </div>
                    <Collapsible>
                      <CollapsibleTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setExpandedLeadId(expandedLeadId === lead.id ? null : lead.id)}
                          data-testid={`button-expand-lead-${lead.id}`}
                        >
                          {expandedLeadId === lead.id ? (
                            <ChevronUp className="h-4 w-4" />
                          ) : (
                            <ChevronDown className="h-4 w-4" />
                          )}
                          Details
                        </Button>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <CardContent className="pt-4 border-t mt-4">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Lead Details */}
                            <div className="space-y-4">
                              <h4 className="font-semibold text-foreground">Complete Lead Information</h4>
                              
                              <div className="flex items-center text-sm">
                                <span className="font-medium mr-2">Lead ID:</span>
                                <span className="font-mono text-xs bg-muted px-2 py-1 rounded">#{lead.id}</span>
                              </div>
                              
                              {lead.degree && (
                                <div className="flex items-center text-sm">
                                  <GraduationCap className="h-4 w-4 mr-2 text-muted-foreground" />
                                  <span className="font-medium mr-2">Degree:</span>
                                  <span>{lead.degree}</span>
                                </div>
                              )}
                              
                              {lead.domain && (
                                <div className="flex items-center text-sm">
                                  <span className="font-medium mr-2">Domain:</span>
                                  <span>{lead.domain}</span>
                                </div>
                              )}
                              
                              {lead.sessionDays && (
                                <div className="flex items-center text-sm">
                                  <span className="font-medium mr-2">Session Days:</span>
                                  <span>{lead.sessionDays}</span>
                                </div>
                              )}
                              
                              {lead.timing && (
                                <div className="flex items-center text-sm">
                                  <Clock className="h-4 w-4 mr-2 text-muted-foreground" />
                                  <span className="font-medium mr-2">Timing:</span>
                                  <span>{lead.timing}</span>
                                </div>
                              )}
                              
                              {(lead.walkinDate || lead.walkinTime) && (
                                <div className="flex items-center text-sm">
                                  <Calendar className="h-4 w-4 mr-2 text-muted-foreground" />
                                  <span className="font-medium mr-2">Walk-in:</span>
                                  <span>
                                    {lead.walkinDate && lead.walkinTime
                                      ? `${lead.walkinDate} at ${lead.walkinTime}`
                                      : lead.walkinDate || lead.walkinTime
                                    }
                                  </span>
                                </div>
                              )}
                              
                              <div className="flex items-center text-sm">
                                <span className="font-medium mr-2">Status:</span>
                                <Badge className={`text-xs ${getStatusColor(lead.status)}`}>
                                  {lead.isActive ? 'Active' : 'Inactive'} - {lead.status.replace('_', ' ')}
                                </Badge>
                              </div>
                              
                              <div className="flex items-center text-sm">
                                <span className="font-medium mr-2">Created:</span>
                                <span className="text-muted-foreground">
                                  {new Date(lead.createdAt).toLocaleDateString()} at{' '}
                                  {new Date(lead.createdAt).toLocaleTimeString()}
                                </span>
                              </div>
                              
                              {lead.notes && (
                                <div className="text-sm">
                                  <span className="font-medium">Notes:</span>
                                  <p className="mt-1 text-muted-foreground">{lead.notes}</p>
                                </div>
                              )}
                            </div>

                            {/* Current Handler & Management */}
                            <div className="space-y-4">
                              <h4 className="font-semibold text-foreground">Handler & Management Details</h4>
                              
                              {lead.sourceManager ? (
                                <div className="flex items-center text-sm">
                                  <User className="h-4 w-4 mr-2 text-muted-foreground" />
                                  <span className="font-medium mr-2">Created by:</span>
                                  <span>
                                    {lead.sourceManager.firstName} {lead.sourceManager.lastName}
                                    <Badge variant="outline" className="ml-2 text-xs">
                                      {lead.sourceManager.role}
                                    </Badge>
                                  </span>
                                </div>
                              ) : (
                                <div className="flex items-center text-sm">
                                  <User className="h-4 w-4 mr-2 text-muted-foreground" />
                                  <span className="font-medium mr-2">Created by:</span>
                                  <span className="text-muted-foreground">System/Unknown</span>
                                </div>
                              )}
                              
                              {lead.currentOwner ? (
                                <div className="flex items-center text-sm">
                                  <User className="h-4 w-4 mr-2 text-muted-foreground" />
                                  <span className="font-medium mr-2">Currently assigned to:</span>
                                  <span>
                                    {lead.currentOwner.firstName} {lead.currentOwner.lastName}
                                    <Badge variant="outline" className="ml-2 text-xs">
                                      {lead.currentOwner.role}
                                    </Badge>
                                  </span>
                                </div>
                              ) : (
                                <div className="flex items-center text-sm">
                                  <User className="h-4 w-4 mr-2 text-muted-foreground" />
                                  <span className="font-medium mr-2">Currently assigned to:</span>
                                  <span className="text-muted-foreground">No handler assigned</span>
                                </div>
                              )}
                              
                              <div className="text-sm">
                                <span className="font-medium">Last Updated:</span>
                                <p className="text-muted-foreground">
                                  {new Date(lead.updatedAt).toLocaleDateString()} at{' '}
                                  {new Date(lead.updatedAt).toLocaleTimeString()}
                                </p>
                              </div>
                            </div>
                          </div>
                          
                          {/* Status Information */}
                          <div className="mt-6 p-4 bg-muted/50 rounded-lg">
                            <div className="flex items-center justify-between">
                              <div>
                                <h5 className="font-medium text-foreground">Current Status</h5>
                                <p className="text-sm text-muted-foreground mt-1">
                                  This lead has been forwarded to the accounts team and is being processed.
                                </p>
                              </div>
                              <Badge className={getStatusColor(lead.status)}>
                                {lead.status.replace('_', ' ')}
                              </Badge>
                            </div>
                          </div>

                          {/* Update History */}
                          <div className="mt-6 space-y-4">
                            <h4 className="font-semibold text-foreground flex items-center">
                              <History className="h-4 w-4 mr-2" />
                              Update History
                            </h4>
                            {leadHistory && leadHistory.length > 0 ? (
                              <div className="space-y-3">
                                {leadHistory.map((historyItem: any, index: number) => (
                                  <div key={historyItem.id} className="p-3 border border-border rounded-lg bg-card/50">
                                    <div className="flex items-start justify-between mb-2">
                                      <div className="flex items-center">
                                        <User className="h-4 w-4 mr-2 text-muted-foreground" />
                                        <span className="font-medium text-sm">
                                          {historyItem.changedByUser?.firstName} {historyItem.changedByUser?.lastName}
                                        </span>
                                        <Badge variant="outline" className="ml-2 text-xs">
                                          {historyItem.changedByUser?.role}
                                        </Badge>
                                      </div>
                                      <span className="text-xs text-muted-foreground">
                                        {new Date(historyItem.changedAt).toLocaleDateString()} at{' '}
                                        {new Date(historyItem.changedAt).toLocaleTimeString()}
                                      </span>
                                    </div>
                                    
                                    <div className="text-sm">
                                      <div className="flex items-center mb-1">
                                        <ArrowRight className="h-3 w-3 mr-2 text-muted-foreground" />
                                        <span>Status changed from </span>
                                        <Badge variant="outline" className="mx-1 text-xs">
                                          {historyItem.previousStatus}
                                        </Badge>
                                        <span> to </span>
                                        <Badge variant="outline" className="mx-1 text-xs">
                                          {historyItem.newStatus}
                                        </Badge>
                                      </div>
                                      
                                      {historyItem.changeReason && (
                                        <p className="text-muted-foreground mt-1">
                                          <strong>Reason:</strong> {historyItem.changeReason}
                                        </p>
                                      )}
                                      
                                      {historyItem.changeData && (
                                        <details className="mt-2">
                                          <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                                            View detailed changes
                                          </summary>
                                          <pre className="text-xs mt-1 p-2 bg-muted rounded overflow-x-auto">
                                            {JSON.stringify(JSON.parse(historyItem.changeData), null, 2)}
                                          </pre>
                                        </details>
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <p className="text-sm text-muted-foreground">
                                No history available for this lead.
                              </p>
                            )}
                          </div>
                        </CardContent>
                      </CollapsibleContent>
                    </Collapsible>
                  </div>
                </CardHeader>
              </Card>
            ))
          )}
          </div>
          
          {/* Summary */}
          {filteredLeads.length > 0 && (
            <Card className="mt-6">
              <CardContent className="p-6">
                <div className="text-center text-muted-foreground">
                  <p>
                    Showing {filteredLeads.length} of {data?.total || 0} completed leads
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </main>
      </div>
    </div>
  );
}