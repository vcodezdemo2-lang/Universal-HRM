import { useState } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { User, History, X, Save, Calendar, Clock, ArrowRight } from "lucide-react";

interface LeadDetailsModalProps {
  lead: any;
  isOpen: boolean;
  onClose: () => void;
  onUpdate: () => void;
}

const updateLeadSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Valid email is required"),
  phone: z.string().optional().or(z.literal("")),
  location: z.string().optional().or(z.literal("")),
  degree: z.string().optional().or(z.literal("")),
  domain: z.string().optional().or(z.literal("")),
  sessionDays: z.enum(["M,W,F", "T,T,S", "daily", "weekend", "custom"]).optional().or(z.literal("")),
  walkinDate: z.string().optional().refine((val) => !val || val === "" || /^\d{4}-\d{2}-\d{2}$/.test(val), {
    message: "Date must be in YYYY-MM-DD format"
  }),
  walkinTime: z.string().optional().refine((val) => !val || val === "" || /^\d{2}:\d{2}$/.test(val), {
    message: "Time must be in HH:MM format"
  }),
  status: z.string(),
  notes: z.string().optional(),
  changeReason: z.string().optional(),
  // Dynamic fields from bulk import
  yearOfPassing: z.string().optional().or(z.literal("")),
  collegeName: z.string().optional().or(z.literal("")),
  // HR workflow fields
  registrationAmount: z.string().optional().or(z.literal("")),
  pendingAmount: z.string().optional().or(z.literal("")),
});

type UpdateLeadForm = z.infer<typeof updateLeadSchema>;

const statusOptions = [
  { value: 'new', label: 'New' },
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'not_interested', label: 'Not Interested' },
  { value: 'not_available', label: 'Not Available' },
  { value: 'no_show', label: 'No Show' },
  { value: 'completed', label: 'Completed' },
  { value: 'reschedule', label: 'Reschedule' },
  { value: 'pending', label: 'Pending' },
  { value: 'ready_for_class', label: 'Ready for Class' },
  { value: 'pending_but_ready', label: 'Pending but Ready' },
];

export default function LeadDetailsModal({ lead, isOpen, onClose, onUpdate }: LeadDetailsModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("details");

  const form = useForm<UpdateLeadForm>({
    resolver: zodResolver(updateLeadSchema),
    defaultValues: {
      name: lead?.name || "",
      email: lead?.email || "",
      phone: lead?.phone || "",
      location: lead?.location || "",
      degree: lead?.degree || "",
      domain: lead?.domain || "",
      sessionDays: lead?.sessionDays || undefined,
      walkinDate: lead?.walkinDate || "",
      walkinTime: lead?.walkinTime || "",
      status: lead?.status || "new",
      notes: lead?.notes || "",
      changeReason: "",
      // Dynamic fields from bulk import
      yearOfPassing: lead?.yearOfPassing || "",
      collegeName: lead?.collegeName || "", 
      // HR workflow fields
      registrationAmount: lead?.registrationAmount || "",
      pendingAmount: lead?.pendingAmount || "",
    },
  });

  const { data: leadHistory } = useQuery({
    queryKey: [`/api/leads/${lead?.id}/history`],
    enabled: !!lead?.id && isOpen,
    retry: false,
  });

  const updateLeadMutation = useMutation({
    mutationFn: async (data: UpdateLeadForm) => {
      const response = await apiRequest("PUT", `/api/leads/${lead.id}`, data);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Lead Updated",
        description: "Lead information has been updated successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/leads"] });
      queryClient.invalidateQueries({ queryKey: ["/api/my/leads"] });
      queryClient.invalidateQueries({ queryKey: ["/api/my/completed"] });
      queryClient.invalidateQueries({ queryKey: [`/api/leads/${lead.id}/history`] });
      onUpdate();
      onClose();
    },
    onError: (error: Error) => {
      if (isUnauthorizedError(error)) {
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
      toast({
        title: "Update Failed",
        description: error.message || "There was an error updating the lead",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: UpdateLeadForm) => {
    // If status is changing to scheduled, validate required fields
    if (data.status === 'scheduled' && lead.status !== 'scheduled') {
      if (!data.walkinDate || !data.walkinTime || !data.domain || !data.sessionDays) {
        toast({
          title: "Missing Information",
          description: "Walk-in date, time, domain, and session days are required for scheduled status",
          variant: "destructive",
        });
        return;
      }
    }

    updateLeadMutation.mutate(data);
  };

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
    return new Date(dateString).toLocaleString();
  };

  const currentStatus = form.watch("status");
  const isScheduledStatus = currentStatus === 'scheduled';

  if (!lead) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto" data-testid="lead-details-modal">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <div className="flex items-center">
              <User className="mr-2 h-5 w-5" />
              Lead Details - {lead.name}
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              data-testid="button-close-lead-details"
            >
              <X className="h-4 w-4" />
            </Button>
          </DialogTitle>
          <div className="flex items-center space-x-2">
            <Badge className={`status-badge ${getStatusColor(lead.status)}`}>
              {lead.status.replace('_', ' ')}
            </Badge>
            <span className="text-sm text-muted-foreground">
              ID: #{lead.id.toString().padStart(7, '0')}
            </span>
          </div>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="details" data-testid="tab-details">Details</TabsTrigger>
            <TabsTrigger value="history" data-testid="tab-history">History</TabsTrigger>
          </TabsList>

          <TabsContent value="details" className="space-y-4">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                {/* Basic Information */}
                <Card>
                  <CardHeader>
                    <CardTitle>Basic Information</CardTitle>
                  </CardHeader>
                  <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Name</FormLabel>
                          <FormControl>
                            <Input {...field} data-testid="input-name" />
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
                          <FormLabel>Email</FormLabel>
                          <FormControl>
                            <Input {...field} type="email" data-testid="input-email" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="phone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Phone</FormLabel>
                          <FormControl>
                            <Input {...field} data-testid="input-phone" />
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
                            <Input {...field} data-testid="input-location" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="degree"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Degree</FormLabel>
                          <FormControl>
                            <Input {...field} data-testid="input-degree" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="status"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Status</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger data-testid="select-status">
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {statusOptions.map((option) => (
                                <SelectItem key={option.value} value={option.value}>
                                  {option.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </CardContent>
                </Card>

                {/* Scheduling Information */}
                {isScheduledStatus && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center">
                        <Calendar className="mr-2 h-4 w-4" />
                        Scheduling Information
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="walkinDate"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Walk-in Date *</FormLabel>
                            <FormControl>
                              <Input {...field} type="date" data-testid="input-walkin-date" />
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
                            <FormLabel>Walk-in Time *</FormLabel>
                            <FormControl>
                              <Input {...field} type="time" data-testid="input-walkin-time" />
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
                            <FormLabel>Domain *</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="e.g., Technology, Business" data-testid="input-domain" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="sessionDays"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Session Days *</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger data-testid="select-session-days">
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
                    </CardContent>
                  </Card>
                )}

                {/* Additional Information */}
                <Card>
                  <CardHeader>
                    <CardTitle>Additional Information</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {!isScheduledStatus && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name="domain"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Domain</FormLabel>
                              <FormControl>
                                <Input {...field} placeholder="e.g., Technology, Business" data-testid="input-domain" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="sessionDays"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Session Days</FormLabel>
                              <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl>
                                  <SelectTrigger data-testid="select-session-days-additional">
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
                      </div>
                    )}

                    {/* Dynamic fields from bulk import - always visible for HR */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="yearOfPassing"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Year of Passing</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="e.g., 2023" data-testid="input-year-of-passing" />
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
                              <Input {...field} placeholder="e.g., ABC University" data-testid="input-college-name" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    {/* HR workflow fields */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="registrationAmount"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Registration Amount</FormLabel>
                            <FormControl>
                              <Input {...field} type="number" step="0.01" placeholder="e.g., 5000.00" data-testid="input-registration-amount" />
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
                              <Input {...field} type="number" step="0.01" placeholder="e.g., 2000.00" data-testid="input-pending-amount" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <FormField
                      control={form.control}
                      name="notes"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Notes</FormLabel>
                          <FormControl>
                            <Textarea
                              {...field}
                              placeholder="Add any additional notes..."
                              rows={3}
                              data-testid="textarea-notes"
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
                              {...field}
                              placeholder="Briefly describe the reason for this update..."
                              data-testid="input-change-reason"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </CardContent>
                </Card>

                <div className="flex justify-end space-x-3 pt-4 border-t border-border">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={onClose}
                    data-testid="button-cancel-update"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={updateLeadMutation.isPending}
                    data-testid="button-save-lead"
                  >
                    {updateLeadMutation.isPending ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-foreground mr-2"></div>
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="mr-2 h-4 w-4" />
                        Save Changes
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </Form>
          </TabsContent>

          <TabsContent value="history" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <History className="mr-2 h-5 w-5" />
                  Audit Trail
                </CardTitle>
              </CardHeader>
              <CardContent>
                {!leadHistory || !Array.isArray(leadHistory) || !leadHistory.length ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <History className="h-12 w-12 mx-auto mb-4 opacity-50" />
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
                                  {entry.previousStatus.replace('_', ' ')}
                                </Badge>
                                <ArrowRight className="h-3 w-3 text-muted-foreground" />
                                <Badge className={`text-xs ${getStatusColor(entry.newStatus)}`}>
                                  {entry.newStatus.replace('_', ' ')}
                                </Badge>
                              </>
                            )}
                          </div>
                        </div>
                        
                        <div className="text-sm space-y-1">
                          <p className="font-medium text-foreground">
                            {entry.changeReason || 'Status updated'}
                          </p>
                          <div className="flex items-center space-x-4 text-muted-foreground">
                            <span className="flex items-center">
                              <User className="h-3 w-3 mr-1" />
                              {entry.changedBy?.fullName || entry.changedBy?.firstName || 'System'}
                            </span>
                            <span className="flex items-center">
                              <Clock className="h-3 w-3 mr-1" />
                              {formatDate(entry.changedAt)}
                            </span>
                          </div>
                        </div>

                        {entry.changeData && (
                          <details className="mt-2">
                            <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">
                              View Details
                            </summary>
                            <pre className="text-xs text-muted-foreground mt-1 bg-muted p-2 rounded overflow-x-auto">
                              {(() => {
                                try {
                                  // If changeData is already an object, use it directly
                                  const data = typeof entry.changeData === 'string' 
                                    ? JSON.parse(entry.changeData) 
                                    : entry.changeData;
                                  return JSON.stringify(data, null, 2);
                                } catch (error) {
                                  // If parsing fails, show as-is
                                  return entry.changeData;
                                }
                              })()}
                            </pre>
                          </details>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
