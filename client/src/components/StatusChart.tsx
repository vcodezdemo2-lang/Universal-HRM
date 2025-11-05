import { useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PieChart } from "lucide-react";

interface StatusChartProps {
  data?: Record<string, number>;
  loading?: boolean;
}

export default function StatusChart({ data, loading = false }: StatusChartProps) {
  const chartRef = useRef<HTMLCanvasElement>(null);
  const chartInstanceRef = useRef<any>(null);

  useEffect(() => {
    const loadChart = async () => {
      if (!chartRef.current || loading || !data) return;

      // Dynamically import Chart.js to avoid SSR issues
      const { Chart, registerables } = await import('chart.js');
      Chart.register(...registerables);

      // Destroy existing chart if it exists
      if (chartInstanceRef.current) {
        chartInstanceRef.current.destroy();
      }

      const ctx = chartRef.current.getContext('2d');
      if (!ctx) return;

      // Prepare data for the chart
      const labels = Object.keys(data);
      const values = Object.values(data);
      
      // Define colors for different statuses
      const statusColors: Record<string, string> = {
        new: 'hsl(221, 83%, 53%)',
        scheduled: 'hsl(48, 96%, 53%)',
        completed: 'hsl(142, 76%, 36%)',
        not_interested: 'hsl(0, 85%, 60%)',
        pending: 'hsl(25, 95%, 53%)',
        ready_for_class: 'hsl(159, 78%, 44%)',
        not_available: 'hsl(15, 85%, 60%)',
        no_show: 'hsl(345, 85%, 60%)',
        reschedule: 'hsl(60, 85%, 60%)',
        pending_but_ready: 'hsl(180, 85%, 60%)',
      };

      const backgroundColors = labels.map(label => 
        statusColors[label] || 'hsl(210, 14%, 83%)'
      );

      chartInstanceRef.current = new Chart(ctx, {
        type: 'doughnut',
        data: {
          labels: labels.map(label => label.replace('_', ' ').toUpperCase()),
          datasets: [{
            data: values,
            backgroundColor: backgroundColors,
            borderWidth: 2,
            borderColor: 'hsl(var(--background))',
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              position: 'bottom',
              labels: {
                padding: 20,
                usePointStyle: true,
                font: {
                  size: 12,
                },
                color: 'hsl(var(--foreground))',
              }
            },
            tooltip: {
              callbacks: {
                label: function(context) {
                  const total = context.dataset.data.reduce((a: number, b: number) => a + b, 0);
                  const percentage = Math.round((context.parsed / total) * 100);
                  return `${context.label}: ${context.parsed} (${percentage}%)`;
                }
              }
            }
          },
          elements: {
            arc: {
              borderWidth: 2,
            }
          }
        }
      });
    };

    loadChart();

    // Cleanup function
    return () => {
      if (chartInstanceRef.current) {
        chartInstanceRef.current.destroy();
        chartInstanceRef.current = null;
      }
    };
  }, [data, loading]);

  if (loading) {
    return (
      <Card className="chart-container animate-pulse">
        <CardHeader>
          <CardTitle className="flex items-center">
            <PieChart className="mr-2 h-5 w-5" />
            Lead Status Distribution
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64 bg-muted rounded"></div>
        </CardContent>
      </Card>
    );
  }

  if (!data || Object.keys(data).length === 0) {
    return (
      <Card className="chart-container">
        <CardHeader>
          <CardTitle className="flex items-center">
            <PieChart className="mr-2 h-5 w-5" />
            Lead Status Distribution
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64 flex items-center justify-center text-muted-foreground">
            <div className="text-center">
              <PieChart className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No data available</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="chart-container" data-testid="status-chart">
      <CardHeader>
        <CardTitle className="flex items-center">
          <PieChart className="mr-2 h-5 w-5" />
          Lead Status Distribution
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-64 relative">
          <canvas 
            ref={chartRef} 
            data-testid="status-chart-canvas"
          ></canvas>
        </div>
      </CardContent>
    </Card>
  );
}
