import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Eye, Edit, History, MoreVertical, UserPlus, Trash2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface LeadTableProps {
  data?: {
    leads: any[];
    total: number;
  };
  loading?: boolean;
  onViewLead: (lead: any) => void;
  onPageChange: (page: number) => void;
  currentPage: number;
  onRefresh: () => void;
}

export default function LeadTable({
  data,
  loading = false,
  onViewLead,
  onPageChange,
  currentPage,
  onRefresh
}: LeadTableProps) {
  const [selectedLeads, setSelectedLeads] = useState<number[]>([]);
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Claim lead mutation for HR users
  const claimLeadMutation = useMutation({
    mutationFn: async (leadId: number) => {
      const response = await apiRequest("POST", `/api/leads/${leadId}/assign`, {
        reason: "Self-assigned from Lead Management"
      });
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Lead Claimed",
        description: `Successfully added lead to your assignments.`,
      });
      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ["/api/leads"] });
      queryClient.invalidateQueries({ queryKey: ["/api/my/leads"] });
      onRefresh();
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to Claim Lead",
        description: error.message || "An error occurred while claiming the lead.",
        variant: "destructive",
      });
    },
  });

  // Delete lead mutation for managers
  const deleteLeadMutation = useMutation({
    mutationFn: async (leadId: number) => {
      const response = await apiRequest("DELETE", `/api/leads/${leadId}`);
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Lead Deleted",
        description: "Lead has been successfully deleted.",
      });
      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ["/api/leads"] });
      queryClient.invalidateQueries({ queryKey: ["/api/my/leads"] });
      onRefresh();
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to Delete Lead",
        description: error.message || "An error occurred while deleting the lead.",
        variant: "destructive",
      });
    },
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'new':
        return 'status-new';
      case 'scheduled':
        return 'status-scheduled';
      case 'completed':
        return 'status-completed';
      case 'not_interested':
        return 'status-not-interested';
      case 'pending':
        return 'status-pending';
      case 'ready_for_class':
        return 'status-ready-for-class';
      default:
        return 'status-new';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
    
    if (diffInMinutes < 60) {
      return `${diffInMinutes} minutes ago`;
    } else if (diffInMinutes < 1440) {
      return `${Math.floor(diffInMinutes / 60)} hours ago`;
    } else {
      return `${Math.floor(diffInMinutes / 1440)} days ago`;
    }
  };

  const getUserInitials = (user: any) => {
    if (!user) return 'U';
    if (user.firstName && user.lastName) {
      return `${user.firstName[0]}${user.lastName[0]}`.toUpperCase();
    }
    if (user.fullName) {
      const names = user.fullName.split(' ');
      return names.length > 1 
        ? `${names[0][0]}${names[1][0]}`.toUpperCase()
        : names[0][0].toUpperCase();
    }
    return user.username?.[0]?.toUpperCase() || 'U';
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedLeads(data?.leads.map(lead => lead.id) || []);
    } else {
      setSelectedLeads([]);
    }
  };

  const handleSelectLead = (leadId: number, checked: boolean) => {
    if (checked) {
      setSelectedLeads(prev => [...prev, leadId]);
    } else {
      setSelectedLeads(prev => prev.filter(id => id !== leadId));
    }
  };

  const totalPages = data ? Math.ceil(data.total / 20) : 0;

  if (loading) {
    return (
      <Card className="overflow-hidden">
        <div className="p-6">
          <div className="animate-pulse space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-12 bg-muted rounded"></div>
            ))}
          </div>
        </div>
      </Card>
    );
  }

  if (!data?.leads?.length) {
    return (
      <Card>
        <div className="p-12 text-center">
          <h3 className="text-lg font-medium text-muted-foreground mb-2">
            No leads found
          </h3>
          <p className="text-muted-foreground mb-4">
            Try adjusting your filters or search terms.
          </p>
          <Button onClick={onRefresh}>Refresh</Button>
        </div>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden" data-testid="lead-table">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">
                <Checkbox
                  checked={selectedLeads.length === data.leads.length}
                  onCheckedChange={handleSelectAll}
                  data-testid="checkbox-select-all"
                />
              </TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Contact</TableHead>
              <TableHead>Location</TableHead>
              <TableHead>Degree</TableHead>
              <TableHead>Current Owner</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Last Updated</TableHead>
              <TableHead className="w-12">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.leads.map((lead) => (
              <TableRow key={lead.id} data-testid={`lead-row-${lead.id}`}>
                <TableCell>
                  <Checkbox
                    checked={selectedLeads.includes(lead.id)}
                    onCheckedChange={(checked) => handleSelectLead(lead.id, checked as boolean)}
                    data-testid={`checkbox-lead-${lead.id}`}
                  />
                </TableCell>
                <TableCell>
                  <div>
                    <p className="font-medium" data-testid={`text-lead-name-${lead.id}`}>
                      {lead.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      #{lead.id.toString().padStart(7, '0')}
                    </p>
                  </div>
                </TableCell>
                <TableCell>
                  <div>
                    <p className="text-sm">{lead.email}</p>
                    <p className="text-xs text-muted-foreground">{lead.phone}</p>
                  </div>
                </TableCell>
                <TableCell>{lead.location}</TableCell>
                <TableCell>{lead.degree}</TableCell>
                <TableCell>
                  {lead.currentOwner ? (
                    <div className="flex items-center space-x-2">
                      <div className="w-6 h-6 bg-primary rounded-full flex items-center justify-center">
                        <span className="text-primary-foreground text-xs">
                          {getUserInitials(lead.currentOwner)}
                        </span>
                      </div>
                      <span className="text-sm">
                        {lead.currentOwner.fullName || 
                         `${lead.currentOwner.firstName} ${lead.currentOwner.lastName}`.trim()}
                      </span>
                    </div>
                  ) : (
                    <span className="text-muted-foreground">Unassigned</span>
                  )}
                </TableCell>
                <TableCell>
                  <Badge 
                    className={`status-badge ${getStatusColor(lead.status)}`}
                    data-testid={`status-${lead.id}`}
                  >
                    {lead.status.replace('_', ' ')}
                  </Badge>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {formatTimeAgo(lead.updatedAt)}
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button 
                        variant="ghost" 
                        size="icon"
                        data-testid={`button-actions-${lead.id}`}
                      >
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => onViewLead(lead)}>
                        <Eye className="mr-2 h-4 w-4" />
                        View Details
                      </DropdownMenuItem>
                      <DropdownMenuItem>
                        <Edit className="mr-2 h-4 w-4" />
                        Edit Lead
                      </DropdownMenuItem>
                      <DropdownMenuItem>
                        <History className="mr-2 h-4 w-4" />
                        View History
                      </DropdownMenuItem>
                      {/* Delete Lead - only for managers and admins */}
                      {((user as any)?.role === 'manager' || (user as any)?.role === 'admin') && (
                        <DropdownMenuItem 
                          onClick={() => {
                            if (window.confirm(`Are you sure you want to delete lead "${lead.name}"? This action cannot be undone.`)) {
                              deleteLeadMutation.mutate(lead.id);
                            }
                          }}
                          disabled={deleteLeadMutation.isPending}
                          className="text-red-600 focus:text-red-600"
                          data-testid={`button-delete-lead-${lead.id}`}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          {deleteLeadMutation.isPending ? "Deleting..." : "Delete Lead"}
                        </DropdownMenuItem>
                      )}
                      {/* Add to My Leads - only for HR users with unassigned leads */}
                      {(user as any)?.role === 'hr' && !lead.currentOwnerId && (
                        <DropdownMenuItem 
                          onClick={() => claimLeadMutation.mutate(lead.id)}
                          disabled={claimLeadMutation.isPending}
                          data-testid={`button-claim-lead-${lead.id}`}
                        >
                          <UserPlus className="mr-2 h-4 w-4" />
                          {claimLeadMutation.isPending ? "Adding..." : "Add to My Leads"}
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      
      {/* Pagination */}
      <div className="px-6 py-4 border-t border-border flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          Showing {((currentPage - 1) * 20) + 1}-{Math.min(currentPage * 20, data.total)} of {data.total} leads
        </div>
        <div className="flex items-center space-x-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage <= 1}
            data-testid="button-prev-page"
          >
            Previous
          </Button>
          <span className="text-sm px-3 py-1">
            Page {currentPage} of {totalPages}
          </span>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage >= totalPages}
            data-testid="button-next-page"
          >
            Next
          </Button>
        </div>
      </div>
    </Card>
  );
}
