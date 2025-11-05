import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { UserCheck, Search, Filter, Clock, Phone, Mail, MapPin, Edit, Save, X, Trash2, Plus, ChevronDown, ChevronUp, Calendar, User, Building2, GraduationCap, Timer } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { insertLeadSchema } from "@shared/schema";

// Edit lead form schema - Uses shared schema with UI-specific fields
const editLeadSchema = insertLeadSchema.extend({
  walkinDate: z.string().optional().refine((val) => !val || val === "" || /^\d{4}-\d{2}-\d{2}$/.test(val), {
    message: "Date must be in YYYY-MM-DD format"
  }),
  walkinTime: z.string().optional().refine((val) => !val || val === "" || /^\d{2}:\d{2}$/.test(val), {
    message: "Time must be in HH:MM format"
  }),
  changeReason: z.string().min(1, "Please provide a reason for this change"),
  yearOfPassing: z.string().optional(),
  collegeName: z.string().optional(),
  registrationAmount: z.string().optional(),
  pendingAmount: z.string().optional()
});

// Create lead form schema - Uses shared schema with UI validation
const createLeadSchema = insertLeadSchema.extend({
  walkinDate: z.string().optional().refine((val) => !val || val === "" || /^\d{4}-\d{2}-\d{2}$/.test(val), {
    message: "Date must be in YYYY-MM-DD format"
  }),
  walkinTime: z.string().optional().refine((val) => !val || val === "" || /^\d{2}:\d{2}$/.test(val), {
    message: "Time must be in HH:MM format"
  })
});

type EditLeadForm = z.infer<typeof editLeadSchema>;
type CreateLeadForm = z.infer<typeof createLeadSchema>;

export default function MyLeadsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [editingLeadId, setEditingLeadId] = useState<number | null>(null);
  const [expandedLeadId, setExpandedLeadId] = useState<number | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

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

  // Fetch my leads
  const { data, isLoading, error } = useQuery({
    queryKey: ["/api/my/leads"],
    retry: false,
  });

  // Update lead mutation
  const updateLeadMutation = useMutation({
    mutationFn: async ({ leadId, data }: { leadId: number; data: EditLeadForm }) => {
      const response = await apiRequest('PUT', `/api/leads/${leadId}`, data);
      return response.json();
    },
    onSuccess: (data, variables) => {
      toast({
        title: "Lead Updated",
        description: `Lead updated successfully${variables.data.status === 'completed' ? ' and forwarded to accounts team' : ''}.`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/my/leads"] });
      queryClient.invalidateQueries({ queryKey: ["/api/leads"] });
      queryClient.invalidateQueries({ queryKey: ["/api/my/completed"] });
      setEditingLeadId(null);
      setExpandedLeadId(null);
    },
    onError: (error) => {
      toast({
        title: "Update Failed", 
        description: "Failed to update lead. Please try again.",
        variant: "destructive",
      });
    }
  });

  // Delete lead mutation for HR users
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
      queryClient.invalidateQueries({ queryKey: ["/api/my/leads"] });
      queryClient.invalidateQueries({ queryKey: ["/api/leads"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to Delete Lead",
        description: error.message || "An error occurred while deleting the lead.",
        variant: "destructive",
      });
    },
  });

  // Create lead mutation for HR users
  const createLeadMutation = useMutation({
    mutationFn: async (data: CreateLeadForm) => {
      const response = await apiRequest("POST", `/api/leads`, data);
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Lead Created",
        description: "New lead has been successfully created and assigned to you.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/my/leads"] });
      queryClient.invalidateQueries({ queryKey: ["/api/leads"] });
      setIsCreateModalOpen(false);
      createForm.reset();
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to Create Lead",
        description: error.message || "An error occurred while creating the lead.",
        variant: "destructive",
      });
    },
  });

  // Edit form
  const form = useForm<EditLeadForm>({
    resolver: zodResolver(editLeadSchema),
    defaultValues: {
      name: '',
      email: '',
      phone: '',
      location: '',
      degree: '',
      domain: '',
      sessionDays: '',
      walkinDate: '',
      walkinTime: '',
      timing: '',
      status: 'new',
      notes: '',
      changeReason: '',
      yearOfPassing: '',
      collegeName: '',
      registrationAmount: '',
      pendingAmount: ''
    }
  });

  const createForm = useForm<CreateLeadForm>({
    resolver: zodResolver(createLeadSchema),
    defaultValues: {
      name: '',
      email: '',
      phone: '',
      location: '',
      degree: '',
      domain: '',
      sessionDays: '',
      timing: '',
      notes: ''
    }
  });

  const handleEditLead = (lead: any) => {
    setEditingLeadId(lead.id);
    form.reset({
      name: lead.name ?? '',
      email: lead.email ?? '',
      phone: lead.phone ?? '',
      location: lead.location ?? '',
      degree: lead.degree ?? '',
      domain: lead.domain ?? '',
      sessionDays: lead.sessionDays ?? '',
      walkinDate: lead.walkinDate ?? '',
      walkinTime: lead.walkinTime ?? '',
      timing: lead.timing ?? '',
      status: lead.status,
      notes: lead.notes ?? '',
      changeReason: '',
      yearOfPassing: lead.yearOfPassing ?? '',
      collegeName: lead.collegeName ?? '',
      registrationAmount: lead.registrationAmount ?? '',
      pendingAmount: lead.pendingAmount ?? ''
    });
  };

  const handleToggleExpand = (leadId: number) => {
    setExpandedLeadId(expandedLeadId === leadId ? null : leadId);
  };

  const handleSubmitEdit = (data: EditLeadForm) => {
    if (editingLeadId) {
      updateLeadMutation.mutate({ leadId: editingLeadId, data });
    }
  };

  const handleCancelEdit = () => {
    setEditingLeadId(null);
    form.reset();
  };

  const leads = (data as any)?.leads || [];
  const total = (data as any)?.total || 0;

  // Filter leads based on search and status
  const filteredLeads = leads.filter((lead: any) => {
    const matchesSearch = !searchTerm || 
      lead.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lead.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lead.phone.includes(searchTerm);
    
    const matchesStatus = statusFilter === "all" || lead.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center space-x-3">
          <UserCheck className="w-8 h-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold">My Leads</h1>
            <p className="text-muted-foreground">Loading your assigned leads...</p>
          </div>
        </div>
        <div className="grid gap-4">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-6">
                <div className="h-4 bg-muted rounded w-1/3 mb-2"></div>
                <div className="h-3 bg-muted rounded w-1/2"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    const errorMessage = (error as any)?.message || error?.toString() || 'Unknown error';
    const isAccessDenied = errorMessage.includes('403') || errorMessage.includes('HR users only') || errorMessage.includes('HR and accounts users only');
    
    return (
      <div className="space-y-6">
        <div className="flex items-center space-x-3">
          <UserCheck className="w-8 h-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold">My Leads</h1>
            <p className="text-muted-foreground">Your assigned leads</p>
          </div>
        </div>
        <Card>
          <CardContent className="p-6 text-center">
            {isAccessDenied ? (
              <div className="space-y-2">
                <h3 className="text-lg font-semibold text-destructive">Access Denied</h3>
                <p className="text-muted-foreground">
                  This page is only available to HR and accounts users. Please contact your manager if you believe this is an error.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                <h3 className="text-lg font-semibold">Failed to Load Leads</h3>
                <p className="text-muted-foreground">
                  Unable to load your leads at this time. Please try again or contact support if the problem persists.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="page-my-leads">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <UserCheck className="w-8 h-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold" data-testid="heading-my-leads">My Leads</h1>
            <p className="text-muted-foreground">
              {total > 0 ? `${total} lead${total !== 1 ? 's' : ''} assigned to you` : 'No leads assigned yet'}
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-3">
          {/* Create Lead button - only for HR users */}
          {user?.role === 'hr' && (
            <Button
              onClick={() => setIsCreateModalOpen(true)}
              className="flex items-center space-x-2"
              data-testid="button-create-lead"
            >
              <Plus className="w-4 h-4" />
              <span>Create Lead</span>
            </Button>
          )}
          {total > 0 && (
            <Badge variant="outline" className="text-lg px-3 py-1" data-testid="badge-total-count">
              {total} Total
            </Badge>
          )}
        </div>
      </div>

      {/* Filters */}
      {total > 0 && (
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input
              placeholder="Search leads by name, email, or phone..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
              data-testid="input-search-leads"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-48" data-testid="select-status-filter">
              <Filter className="w-4 h-4 mr-2" />
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="new">New</SelectItem>
              <SelectItem value="scheduled">Scheduled</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="not_interested">Not Interested</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="ready_for_class">Ready for Class</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Leads Grid */}
      {filteredLeads.length > 0 ? (
        <div className="grid gap-4">
          {filteredLeads.map((lead: any) => (
            <Card key={lead.id} className="hover:shadow-md transition-shadow" data-testid={`card-lead-${lead.id}`}>
              <CardHeader className="pb-3 cursor-pointer" onClick={() => handleToggleExpand(lead.id)}>
                <div className="flex items-start justify-between">
                  <div className="space-y-1 flex-1">
                    <div className="flex items-center space-x-2">
                      <CardTitle className="text-lg" data-testid={`text-lead-name-${lead.id}`}>
                        {lead.name}
                      </CardTitle>
                      {expandedLeadId === lead.id ? (
                        <ChevronUp className="w-4 h-4 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-muted-foreground" />
                      )}
                    </div>
                    <CardDescription className="flex items-center space-x-2">
                      <span data-testid={`text-lead-email-${lead.id}`}>{lead.email}</span>
                      {lead.degree && (
                        <>
                          <span>•</span>
                          <span className="text-xs bg-muted px-2 py-1 rounded" data-testid={`badge-lead-degree-${lead.id}`}>
                            {lead.degree}
                          </span>
                        </>
                      )}
                    </CardDescription>
                  </div>
                  <div className="flex items-center space-x-2" onClick={(e) => e.stopPropagation()}>
                    <Badge 
                      className={`status-badge ${getStatusColor(lead.status)}`}
                      data-testid={`status-${lead.id}`}
                    >
                      {lead.status.replace('_', ' ')}
                    </Badge>
                    {lead.createdAt && (
                      <div className="flex items-center text-xs text-muted-foreground">
                        <Clock className="w-3 h-3 mr-1" />
                        <span>
                          Added {new Date(lead.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEditLead(lead);
                      }}
                      data-testid={`button-edit-${lead.id}`}
                    >
                      <Edit className="w-3 h-3 mr-1" />
                      Edit
                    </Button>
                    {/* Delete button - only for HR users */}
                    {user?.role === 'hr' && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (window.confirm(`Are you sure you want to delete lead "${lead.name}"? This action cannot be undone.`)) {
                            deleteLeadMutation.mutate(lead.id);
                          }
                        }}
                        disabled={deleteLeadMutation.isPending}
                        className="text-red-600 hover:text-red-700 border-red-200 hover:border-red-300"
                        data-testid={`button-delete-${lead.id}`}
                      >
                        <Trash2 className="w-3 h-3 mr-1" />
                        {deleteLeadMutation.isPending ? "Deleting..." : "Delete"}
                      </Button>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                {/* Basic Info - Always Visible */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                  <div className="flex items-center space-x-2">
                    <Phone className="w-4 h-4 text-muted-foreground" />
                    <span data-testid={`text-lead-phone-${lead.id}`}>{lead.phone || 'Not provided'}</span>
                  </div>
                  {lead.location && (
                    <div className="flex items-center space-x-2">
                      <MapPin className="w-4 h-4 text-muted-foreground" />
                      <span className="truncate" data-testid={`text-lead-location-${lead.id}`}>
                        {lead.location}
                      </span>
                    </div>
                  )}
                  {lead.sessionDays && (
                    <div className="flex items-center space-x-2">
                      <Calendar className="w-4 h-4 text-muted-foreground" />
                      <span data-testid={`text-lead-session-days-${lead.id}`}>{lead.sessionDays}</span>
                    </div>
                  )}
                </div>
                
                {/* Expanded Details */}
                {expandedLeadId === lead.id && (
                  <div className="mt-4 border-t pt-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* Personal Information */}
                      <div className="space-y-3">
                        <h4 className="font-semibold text-sm flex items-center">
                          <User className="w-4 h-4 mr-2" />
                          Personal Information
                        </h4>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Email:</span>
                            <span data-testid={`expanded-email-${lead.id}`}>{lead.email}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Phone:</span>
                            <span data-testid={`expanded-phone-${lead.id}`}>{lead.phone || 'Not provided'}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Location:</span>
                            <span data-testid={`expanded-location-${lead.id}`}>{lead.location || 'Not provided'}</span>
                          </div>
                        </div>
                      </div>

                      {/* Academic & Professional */}
                      <div className="space-y-3">
                        <h4 className="font-semibold text-sm flex items-center">
                          <GraduationCap className="w-4 h-4 mr-2" />
                          Academic & Professional
                        </h4>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Degree:</span>
                            <span data-testid={`expanded-degree-${lead.id}`}>{lead.degree || 'Not provided'}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Domain:</span>
                            <span data-testid={`expanded-domain-${lead.id}`}>{lead.domain || 'Not provided'}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">College Name:</span>
                            <span data-testid={`expanded-college-name-${lead.id}`}>{lead.collegeName || 'Not provided'}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Year of Passing:</span>
                            <span data-testid={`expanded-year-of-passing-${lead.id}`}>{lead.yearOfPassing || 'Not provided'}</span>
                          </div>
                        </div>
                      </div>

                      {/* Session Information */}
                      <div className="space-y-3">
                        <h4 className="font-semibold text-sm flex items-center">
                          <Calendar className="w-4 h-4 mr-2" />
                          Session Information
                        </h4>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Session Days:</span>
                            <span data-testid={`expanded-session-days-${lead.id}`}>{lead.sessionDays || 'Not set'}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Timing:</span>
                            <span data-testid={`expanded-timing-${lead.id}`}>{lead.timing || 'Not set'}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Walk-in Date:</span>
                            <span data-testid={`expanded-walkin-date-${lead.id}`}>{lead.walkinDate || 'Not set'}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Walk-in Time:</span>
                            <span data-testid={`expanded-walkin-time-${lead.id}`}>{lead.walkinTime || 'Not set'}</span>
                          </div>
                        </div>
                      </div>

                      {/* Additional Information */}
                      <div className="space-y-3">
                        <h4 className="font-semibold text-sm flex items-center">
                          <Building2 className="w-4 h-4 mr-2" />
                          Additional Information
                        </h4>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Status:</span>
                            <Badge className={`status-badge ${getStatusColor(lead.status)}`}>
                              {lead.status.replace('_', ' ')}
                            </Badge>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Registration Amount:</span>
                            <span data-testid={`expanded-registration-amount-${lead.id}`}>
                              {lead.registrationAmount ? `₹${parseFloat(lead.registrationAmount).toFixed(2)}` : 'Not set'}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Pending Amount:</span>
                            <span data-testid={`expanded-pending-amount-${lead.id}`}>
                              {lead.pendingAmount ? `₹${parseFloat(lead.pendingAmount).toFixed(2)}` : 'Not set'}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Created:</span>
                            <span>{new Date(lead.createdAt).toLocaleDateString()}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Updated:</span>
                            <span>{new Date(lead.updatedAt).toLocaleDateString()}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    {lead.notes && (
                      <div className="mt-4">
                        <h4 className="font-semibold text-sm mb-2">Notes</h4>
                        <div className="p-3 bg-muted rounded text-sm">
                          <p data-testid={`expanded-notes-${lead.id}`}>{lead.notes}</p>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="p-8 text-center">
            <UserCheck className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            {total === 0 ? (
              <div className="space-y-2">
                <h3 className="text-lg font-semibold" data-testid="text-no-leads-title">
                  No leads assigned yet
                </h3>
                <p className="text-muted-foreground" data-testid="text-no-leads-description">
                  Once leads are assigned to you, they will appear here for easy management.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                <h3 className="text-lg font-semibold">No matching leads found</h3>
                <p className="text-muted-foreground">
                  Try adjusting your search terms or filters.
                </p>
                <Button 
                  variant="outline" 
                  onClick={() => {
                    setSearchTerm("");
                    setStatusFilter("all");
                  }}
                  data-testid="button-clear-filters"
                >
                  Clear Filters
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Edit Lead Dialog */}
      <Dialog open={editingLeadId !== null} onOpenChange={(open) => !open && handleCancelEdit()}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Edit Lead</DialogTitle>
            <DialogDescription>
              Update lead status and add notes. Changes will be tracked in the audit trail.
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmitEdit)} className="space-y-4">
              {/* Basic Information */}
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Name *</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Full name"
                          {...field}
                          data-testid="input-edit-name"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email *</FormLabel>
                      <FormControl>
                        <Input
                          type="email"
                          placeholder="Email address"
                          {...field}
                          data-testid="input-edit-email"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Phone</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Phone number"
                          {...field}
                          data-testid="input-edit-phone"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="location"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Location</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Location"
                          {...field}
                          data-testid="input-edit-location"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="degree"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Degree</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="e.g., BE/CSE, MBA"
                          {...field}
                          data-testid="input-edit-degree"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="domain"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Domain</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="e.g., Technology, Marketing"
                          {...field}
                          data-testid="input-edit-domain"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
              {/* Academic Information */}
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="yearOfPassing"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Year of Passing</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="e.g., 2023"
                          {...field}
                          data-testid="input-edit-year-of-passing"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="collegeName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>College Name</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="e.g., ABC University"
                          {...field}
                          data-testid="input-edit-college-name"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Financial Information */}
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="registrationAmount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Registration Amount</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="e.g., 5000.00"
                          {...field}
                          data-testid="input-edit-registration-amount"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="pendingAmount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Pending Amount</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="e.g., 2000.00"
                          {...field}
                          data-testid="input-edit-pending-amount"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
              {/* Session Information */}
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="sessionDays"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Session Days</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-edit-session-days">
                            <SelectValue placeholder="Select session pattern" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="M,W,F">M,W,F (Monday, Wednesday, Friday)</SelectItem>
                          <SelectItem value="T,T,S">T,T,S (Tuesday, Thursday, Saturday)</SelectItem>
                          <SelectItem value="daily">Daily (Monday to Saturday)</SelectItem>
                          <SelectItem value="weekend">Weekend Only</SelectItem>
                          <SelectItem value="custom">Custom Schedule</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="timing"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Timing</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="e.g., 9:00 AM - 5:00 PM"
                          {...field}
                          data-testid="input-edit-timing"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="walkinDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Walk-in Date</FormLabel>
                      <FormControl>
                        <Input
                          type="date"
                          {...field}
                          data-testid="input-edit-walkin-date"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="walkinTime"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Walk-in Time</FormLabel>
                      <FormControl>
                        <Input
                          type="time"
                          {...field}
                          data-testid="input-edit-walkin-time"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-edit-status">
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="new">New</SelectItem>
                        <SelectItem value="scheduled">Scheduled</SelectItem>
                        <SelectItem value="completed">Completed</SelectItem>
                        <SelectItem value="not_interested">Not Interested</SelectItem>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="ready_for_class">Ready for Class</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notes</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Add any notes about this lead..."
                        className="resize-none"
                        rows={3}
                        {...field}
                        data-testid="textarea-edit-notes"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="changeReason"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Reason for Change</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Briefly explain the reason for this update..."
                        {...field}
                        data-testid="input-change-reason"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleCancelEdit}
                  data-testid="button-cancel-edit"
                >
                  <X className="w-4 h-4 mr-2" />
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={updateLeadMutation.isPending}
                  data-testid="button-save-edit"
                >
                  <Save className="w-4 h-4 mr-2" />
                  {updateLeadMutation.isPending ? "Saving..." : "Save Changes"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Create Lead Modal */}
      <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Create New Lead</DialogTitle>
            <DialogDescription>
              Add a new lead that will be automatically assigned to you.
            </DialogDescription>
          </DialogHeader>
          <Form {...createForm}>
            <form onSubmit={createForm.handleSubmit((data) => createLeadMutation.mutate(data))} className="space-y-4">
              <FormField
                control={createForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name *</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Enter lead's full name"
                        {...field}
                        data-testid="input-create-name"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={createForm.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email *</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        placeholder="Enter email address"
                        {...field}
                        data-testid="input-create-email"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={createForm.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Enter phone number"
                        {...field}
                        data-testid="input-create-phone"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={createForm.control}
                name="location"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Location</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Enter location"
                        {...field}
                        data-testid="input-create-location"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={createForm.control}
                  name="degree"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Degree</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="e.g., MBA, BE/CSE"
                          {...field}
                          data-testid="input-create-degree"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={createForm.control}
                  name="domain"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Domain</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="e.g., Technology"
                          {...field}
                          data-testid="input-create-domain"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={createForm.control}
                  name="sessionDays"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Session Days</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-create-session-days">
                            <SelectValue placeholder="Select session pattern" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="M,W,F">M,W,F (Monday, Wednesday, Friday)</SelectItem>
                          <SelectItem value="T,T,S">T,T,S (Tuesday, Thursday, Saturday)</SelectItem>
                          <SelectItem value="daily">Daily (Monday to Saturday)</SelectItem>
                          <SelectItem value="weekend">Weekend Only</SelectItem>
                          <SelectItem value="custom">Custom Schedule</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={createForm.control}
                  name="timing"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Timing</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="e.g., 9:00 AM - 5:00 PM"
                          {...field}
                          data-testid="input-create-timing"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={createForm.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notes</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Add any initial notes about this lead..."
                        rows={3}
                        {...field}
                        data-testid="input-create-notes"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsCreateModalOpen(false)}
                  data-testid="button-cancel-create"
                >
                  <X className="w-4 h-4 mr-2" />
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={createLeadMutation.isPending}
                  data-testid="button-save-create"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  {createLeadMutation.isPending ? "Creating..." : "Create Lead"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}