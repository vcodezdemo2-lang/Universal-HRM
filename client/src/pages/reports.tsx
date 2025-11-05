import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import Sidebar from "@/components/Sidebar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Download, FileSpreadsheet, Filter } from "lucide-react";

export default function Reports() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading, user } = useAuth();
  const [filters, setFilters] = useState({
    status: '',
    hrId: '',
    accountsId: '',
    fromDate: '',
    toDate: '',
    format: 'csv'
  });

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

  // Check if user has admin or manager role
  if ((user as any)?.role !== 'admin' && (user as any)?.role !== 'manager') {
    return (
      <div className="flex h-screen bg-background">
        <Sidebar />
        <div className="flex-1 flex items-center justify-center">
          <Card className="w-full max-w-md mx-4">
            <CardContent className="pt-6 text-center">
              <h2 className="text-xl font-bold mb-2">Access Denied</h2>
              <p className="text-muted-foreground">
                You don't have permission to access reports and exports.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const handleExport = async () => {
    try {
      const queryParams = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value) queryParams.append(key, value);
      });

      const response = await fetch(`/api/export?${queryParams.toString()}`, {
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error('Export failed');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const fileExtension = filters.format === 'xlsx' ? 'xlsx' : 'csv';
      a.download = `leads_export_${new Date().toISOString().split('T')[0]}.${fileExtension}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: "Export Successful",
        description: "Your export has been downloaded successfully.",
      });
    } catch (error) {
      toast({
        title: "Export Failed",
        description: "There was an error exporting your data.",
        variant: "destructive",
      });
    }
  };

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
                Reports & Export
              </h1>
              <p className="text-sm text-muted-foreground">
                Generate and download comprehensive reports
              </p>
            </div>
          </div>
        </header>

        {/* Export Form */}
        <main className="flex-1 overflow-y-auto p-6">
          <div className="max-w-2xl mx-auto">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <FileSpreadsheet className="mr-2 h-5 w-5" />
                  Export Configuration
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Date Range */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="fromDate">From Date</Label>
                    <Input
                      id="fromDate"
                      type="date"
                      value={filters.fromDate}
                      onChange={(e) => setFilters(prev => ({ ...prev, fromDate: e.target.value }))}
                      data-testid="input-from-date"
                    />
                  </div>
                  <div>
                    <Label htmlFor="toDate">To Date</Label>
                    <Input
                      id="toDate"
                      type="date"
                      value={filters.toDate}
                      onChange={(e) => setFilters(prev => ({ ...prev, toDate: e.target.value }))}
                      data-testid="input-to-date"
                    />
                  </div>
                </div>

                {/* Filters */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="status">Status Filter</Label>
                    <Select 
                      value={filters.status} 
                      onValueChange={(value) => setFilters(prev => ({ ...prev, status: value }))}
                    >
                      <SelectTrigger data-testid="select-status-filter">
                        <SelectValue placeholder="All Statuses" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Statuses</SelectItem>
                        <SelectItem value="new">New</SelectItem>
                        <SelectItem value="scheduled">Scheduled</SelectItem>
                        <SelectItem value="completed">Completed</SelectItem>
                        <SelectItem value="not_interested">Not Interested</SelectItem>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="ready_for_class">Ready for Class</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div>
                    <Label htmlFor="format">Export Format</Label>
                    <Select 
                      value={filters.format} 
                      onValueChange={(value) => setFilters(prev => ({ ...prev, format: value }))}
                    >
                      <SelectTrigger data-testid="select-export-format">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="csv">CSV</SelectItem>
                        <SelectItem value="xlsx">Excel (XLSX)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Export Button */}
                <div className="pt-4">
                  <Button 
                    onClick={handleExport} 
                    className="w-full"
                    data-testid="button-export"
                  >
                    <Download className="mr-2 h-4 w-4" />
                    Export Data
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Export Information */}
            <Card className="mt-6">
              <CardHeader>
                <CardTitle>Export Information</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 text-sm">
                  <p><strong>Included Columns:</strong></p>
                  <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-4">
                    <li>Lead name, email, phone, location, degree</li>
                    <li>Domain, walk-in date/time, session days</li>
                    <li>Current status and owner information</li>
                    <li>HR name, accounts handler, manager name</li>
                    <li>Creation and modification timestamps</li>
                  </ul>
                  
                  <p className="pt-3"><strong>File Format:</strong></p>
                  <p className="text-muted-foreground">
                    CSV files can be opened in Excel, Google Sheets, or any spreadsheet application.
                    XLSX files are native Excel format with better formatting support.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    </div>
  );
}
