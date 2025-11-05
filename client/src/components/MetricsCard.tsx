import { Card, CardContent } from "@/components/ui/card";
import { LucideIcon } from "lucide-react";

interface MetricsCardProps {
  title: string;
  value: number | string;
  icon: LucideIcon;
  change?: string;
  changeLabel?: string;
  changeType?: 'positive' | 'negative';
  loading?: boolean;
  testId?: string;
}

export default function MetricsCard({ 
  title, 
  value, 
  icon: Icon, 
  change, 
  changeLabel, 
  changeType = 'positive',
  loading = false,
  testId 
}: MetricsCardProps) {
  if (loading) {
    return (
      <Card className="metric-card animate-pulse" data-testid={testId}>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div className="space-y-2">
              <div className="h-4 bg-muted rounded w-20"></div>
              <div className="h-8 bg-muted rounded w-16"></div>
            </div>
            <div className="w-12 h-12 bg-muted rounded-lg"></div>
          </div>
          <div className="mt-4">
            <div className="h-3 bg-muted rounded w-24"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const formatValue = (val: number | string) => {
    if (typeof val === 'number') {
      return val.toLocaleString();
    }
    return val;
  };

  const getChangeColor = () => {
    if (!change) return '';
    if (changeType === 'positive') {
      return change.startsWith('+') ? 'text-green-600' : 'text-red-600';
    } else {
      return change.startsWith('-') ? 'text-green-600' : 'text-red-600';
    }
  };

  return (
    <Card className="metric-card" data-testid={testId}>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <p className="text-3xl font-bold text-foreground" data-testid={`${testId}-value`}>
              {formatValue(value)}
            </p>
          </div>
          <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
            <Icon className="text-primary text-xl h-6 w-6" />
          </div>
        </div>
        {change && changeLabel && (
          <div className="mt-4 flex items-center text-sm">
            <span className={`font-medium ${getChangeColor()}`}>{change}</span>
            <span className="text-muted-foreground ml-1">{changeLabel}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
