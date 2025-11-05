import { useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp } from "lucide-react";

interface TrendChartProps {
  data?: {
    labels: string[];
    datasets: Array<{
      label: string;
      data: number[];
      borderColor: string;
    }>;
  };
  loading?: boolean;
}

export default function TrendChart({ data, loading = false }: TrendChartProps) {
  const chartRef = useRef<HTMLCanvasElement>(null);
  const chartInstanceRef = useRef<any>(null);

  // Default data for demonstration
  const defaultData = {
    labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
    datasets: [
      {
        label: 'Leads Processed',
        data: [120, 190, 300, 250, 420, 380],
        borderColor: 'hsl(221, 83%, 53%)',
      },
      {
        label: 'Conversions',
        data: [80, 120, 200, 180, 290, 260],
        borderColor: 'hsl(142, 76%, 36%)',
      }
    ]
  };

  const chartData = data || defaultData;

  useEffect(() => {
    const loadChart = async () => {
      if (!chartRef.current || loading) return;

      // Dynamically import Chart.js to avoid SSR issues
      const { Chart, registerables } = await import('chart.js');
      Chart.register(...registerables);

      // Destroy existing chart if it exists
      if (chartInstanceRef.current) {
        chartInstanceRef.current.destroy();
      }

      const ctx = chartRef.current.getContext('2d');
      if (!ctx) return;

      chartInstanceRef.current = new Chart(ctx, {
        type: 'line',
        data: {
          labels: chartData.labels,
          datasets: chartData.datasets.map(dataset => ({
            label: dataset.label,
            data: dataset.data,
            borderColor: dataset.borderColor,
            backgroundColor: dataset.borderColor + '20', // Add transparency
            tension: 0.1,
            fill: false,
            borderWidth: 2,
            pointRadius: 4,
            pointHoverRadius: 6,
            pointBackgroundColor: dataset.borderColor,
            pointBorderColor: 'hsl(var(--background))',
            pointBorderWidth: 2,
          }))
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          interaction: {
            intersect: false,
            mode: 'index',
          },
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
              backgroundColor: 'hsl(var(--popover))',
              titleColor: 'hsl(var(--popover-foreground))',
              bodyColor: 'hsl(var(--popover-foreground))',
              borderColor: 'hsl(var(--border))',
              borderWidth: 1,
              cornerRadius: 8,
              displayColors: true,
              callbacks: {
                title: function(context) {
                  return `Month: ${context[0].label}`;
                },
                label: function(context) {
                  return `${context.dataset.label}: ${context.parsed.y.toLocaleString()}`;
                }
              }
            }
          },
          scales: {
            x: {
              grid: {
                color: 'hsl(var(--border))',
                drawBorder: false,
              },
              ticks: {
                color: 'hsl(var(--muted-foreground))',
                font: {
                  size: 11,
                },
              }
            },
            y: {
              beginAtZero: true,
              grid: {
                color: 'hsl(var(--border))',
                drawBorder: false,
              },
              ticks: {
                color: 'hsl(var(--muted-foreground))',
                font: {
                  size: 11,
                },
                callback: function(value) {
                  return typeof value === 'number' ? value.toLocaleString() : value;
                }
              }
            }
          },
          elements: {
            point: {
              hoverBorderWidth: 3,
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
  }, [chartData, loading]);

  if (loading) {
    return (
      <Card className="chart-container animate-pulse">
        <CardHeader>
          <CardTitle className="flex items-center">
            <TrendingUp className="mr-2 h-5 w-5" />
            Performance Trends
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64 bg-muted rounded"></div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="chart-container" data-testid="trend-chart">
      <CardHeader>
        <CardTitle className="flex items-center">
          <TrendingUp className="mr-2 h-5 w-5" />
          Performance Trends
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-64 relative">
          <canvas 
            ref={chartRef}
            data-testid="trend-chart-canvas"
          ></canvas>
        </div>
      </CardContent>
    </Card>
  );
}
