import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Building2, Users, BarChart3, Shield } from "lucide-react";

export default function Landing() {
  const handleLogin = () => {
    window.location.href = "/login";
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/10 to-secondary/10 dark:from-primary/5 dark:to-secondary/5">
      <div className="container mx-auto px-4 py-16">
        {/* Header */}
        <div className="text-center mb-16">
          <div className="flex items-center justify-center mb-6">
            <Building2 className="h-12 w-12 text-primary mr-3" />
            <h1 className="text-4xl font-bold text-foreground">HRM Portal</h1>
          </div>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Advanced Lead Management System for HR Teams
          </p>
          <p className="text-lg text-muted-foreground mt-4">
            Streamline your lead management process with role-based access control, 
            real-time analytics, and automated workflows.
          </p>
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-16">
          <Card className="text-center">
            <CardContent className="pt-6">
              <Users className="h-12 w-12 text-primary mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Multi-Role Management</h3>
              <p className="text-muted-foreground">
                Support for Manager, HR, Accounts, and Admin roles with granular permissions
              </p>
            </CardContent>
          </Card>

          <Card className="text-center">
            <CardContent className="pt-6">
              <BarChart3 className="h-12 w-12 text-primary mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Real-time Analytics</h3>
              <p className="text-muted-foreground">
                Interactive dashboards with live metrics and performance tracking
              </p>
            </CardContent>
          </Card>

          <Card className="text-center">
            <CardContent className="pt-6">
              <Shield className="h-12 w-12 text-primary mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Audit Trail</h3>
              <p className="text-muted-foreground">
                Complete audit trail for all lead modifications and status changes
              </p>
            </CardContent>
          </Card>
        </div>

        {/* CTA Section */}
        <Card className="max-w-md mx-auto">
          <CardContent className="pt-6">
            <div className="text-center space-y-6">
              <h2 className="text-2xl font-bold">Get Started</h2>
              <p className="text-muted-foreground">
                Sign in to access your HRM dashboard and start managing leads efficiently.
              </p>
              <Button 
                onClick={handleLogin}
                size="lg" 
                className="w-full"
                data-testid="button-login"
              >
                Sign In to Portal
              </Button>
              <div className="text-center mt-4">
                <p className="text-sm text-muted-foreground mb-2">
                  HR Staff Login
                </p>
                <Button 
                  variant="outline"
                  size="sm"
                  onClick={() => window.location.href = "/login"}
                  data-testid="button-staff-login"
                >
                  Staff Login with Password
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
