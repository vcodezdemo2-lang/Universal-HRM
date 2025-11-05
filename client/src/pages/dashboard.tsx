import { useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { isUnauthorizedError } from "@/lib/authUtils";
import Sidebar from "@/components/Sidebar";
import MetricsCard from "@/components/MetricsCard";
import StatusChart from "@/components/StatusChart";
import TrendChart from "@/components/TrendChart";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Users, Clock, CheckCircle, DollarSign, Upload, Search } from "lucide-react";
import BulkUploadModal from "@/components/BulkUploadModal";
import { useState } from "react";

export default function Dashboard() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading, user } = useAuth();
  const [showBulkUpload, setShowBulkUpload] = useState(false);

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

  const { data: metrics, isLoading: metricsLoading } = useQuery({
    queryKey: ["/api/metrics"],
    retry: false,
  });

  const { data: recentActivity } = useQuery({
    queryKey: ["/api/leads/recent"],
    retry: false,
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
                Dashboard Overview
              </h1>
              <p className="text-sm text-muted-foreground">
                Monitor leads, manage users, and track performance
              </p>
            </div>
            <div className="flex items-center space-x-4">
              <div className="relative">
                <Input
                  type="text"
                  placeholder="Global search..."
                  className="w-64 pl-10"
                  data-testid="input-global-search"
                />
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              </div>
              {user?.role === 'manager' && (
                <Button 
                  onClick={() => setShowBulkUpload(true)}
                  data-testid="button-bulk-upload"
                >
                  <Upload className="mr-2 h-4 w-4" />
                  Bulk Upload
                </Button>
              )}
            </div>
          </div>
        </header>

        {/* Dashboard Content */}
        <main className="flex-1 overflow-y-auto p-6">
          {/* Metrics Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <MetricsCard
              title="Total Leads"
              value={metrics?.totalLeads || 0}
              icon={Users}
              change="+12.5%"
              changeLabel="from last month"
              loading={metricsLoading}
              testId="metric-total-leads"
            />
            <MetricsCard
              title="Active in HR"
              value={metrics?.activeHR || 0}
              icon={Clock}
              change="-3.2%"
              changeLabel="processing time"
              changeType="negative"
              loading={metricsLoading}
              testId="metric-active-hr"
            />
            <MetricsCard
              title="Completed"
              value={metrics?.completed || 0}
              icon={CheckCircle}
              change="+8.1%"
              changeLabel="completion rate"
              loading={metricsLoading}
              testId="metric-completed"
            />
            {user?.role === 'manager' && (
              <MetricsCard
                title="Revenue Pipeline"
                value="128K"
                icon={DollarSign}
                change="+15.3%"
                changeLabel="projected growth"
                loading={metricsLoading}
                testId="metric-revenue"
              />
            )}
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            <StatusChart data={metrics?.statusDistribution} />
            <TrendChart />
          </div>

          {/* Recent Activity & Allocation Strategy */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-card border border-border rounded-lg">
              <div className="p-6 border-b border-border">
                <h3 className="text-lg font-semibold">Recent Activity</h3>
                <p className="text-sm text-muted-foreground">
                  Latest lead modifications and status changes
                </p>
              </div>
              <div className="divide-y divide-border">
                {!recentActivity?.length ? (
                  <div className="p-8 text-center text-muted-foreground">
                    No recent activity found
                  </div>
                ) : (
                  recentActivity.slice(0, 5).map((activity: any, index: number) => (
                    <div key={index} className="p-4 hover:bg-muted/50" data-testid={`activity-item-${index}`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center">
                            <Users className="h-4 w-4 text-primary-foreground" />
                          </div>
                          <div>
                            <p className="text-sm font-medium">{activity.description}</p>
                            <p className="text-xs text-muted-foreground">{activity.details}</p>
                          </div>
                        </div>
                        <span className="text-xs text-muted-foreground">{activity.timestamp}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
              <div className="p-4 border-t border-border">
                <Button variant="secondary" className="w-full">
                  View All Activity
                </Button>
              </div>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Allocation Strategy</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                  <div>
                    <p className="text-sm font-medium">Current Strategy</p>
                    <p className="text-xs text-muted-foreground">Round Robin</p>
                  </div>
                  <span className="status-badge status-ready-for-class">Active</span>
                </div>
                
                <div className="space-y-2">
                  <h4 className="text-sm font-medium">HR Load Balancing</h4>
                  <div className="space-y-3">
                    <div>
                      <div className="flex items-center justify-between text-sm mb-1">
                        <span>Sarah Johnson</span>
                        <span className="text-muted-foreground">23 leads</span>
                      </div>
                      <Progress value={76} className="h-2" />
                    </div>
                    <div>
                      <div className="flex items-center justify-between text-sm mb-1">
                        <span>Mike Chen</span>
                        <span className="text-muted-foreground">19 leads</span>
                      </div>
                      <Progress value={63} className="h-2" />
                    </div>
                    <div>
                      <div className="flex items-center justify-between text-sm mb-1">
                        <span>Lisa Wang</span>
                        <span className="text-muted-foreground">21 leads</span>
                      </div>
                      <Progress value={70} className="h-2" />
                    </div>
                  </div>
                </div>
                
                <Button className="w-full" data-testid="button-configure-strategy">
                  Configure Strategy
                </Button>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>

      {/* Modals */}
      {showBulkUpload && (
        <BulkUploadModal
          isOpen={showBulkUpload}
          onClose={() => setShowBulkUpload(false)}
        />
      )}
    </div>
  );
}
