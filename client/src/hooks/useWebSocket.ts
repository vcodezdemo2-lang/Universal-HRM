import { useEffect, useRef, useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { queryClient } from '@/lib/queryClient';

interface WebSocketMessage {
  type: string;
  data: any;
}

export function useWebSocket() {
  const { toast } = useToast();
  const wsRef = useRef<WebSocket | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected' | 'error'>('disconnected');
  const reconnectTimeoutRef = useRef<number>();
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5;

  const connect = () => {
    try {
      setConnectionStatus('connecting');
      
      // Use current domain with ws/wss protocol
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const host = window.location.host;
      const wsUrl = `${protocol}//${host}/ws`;
      
      console.log('Connecting to WebSocket:', wsUrl);
      
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('WebSocket connected successfully');
        setConnectionStatus('connected');
        reconnectAttempts.current = 0;
        
        toast({
          title: "Connected",
          description: "Real-time notifications are now active",
          variant: "default",
        });
      };

      ws.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);
          console.log('WebSocket message received:', message);
          
          // Handle different notification types
          switch (message.type) {
            case 'lead_created':
              toast({
                title: "New Lead",
                description: `A new lead "${message.data.name}" has been created`,
                variant: "default",
              });
              break;
              
            case 'lead_updated':
              toast({
                title: "Lead Updated",
                description: `Lead "${message.data.name}" status changed to ${message.data.status}`,
                variant: "default",
              });
              break;
              
            case 'bulk_upload_completed':
              toast({
                title: "Bulk Upload Complete",
                description: `Successfully uploaded ${message.data.count} leads`,
                variant: "default",
              });
              break;
              
            case 'user_created':
              toast({
                title: "New User",
                description: `New ${message.data.role} user "${message.data.fullName}" has been created`,
                variant: "default",
              });
              break;
              
            case 'lead_deleted':
              toast({
                title: "Lead Deleted",
                description: `Lead "${message.data.name}" has been permanently deleted`,
                variant: "default",
              });
              // Invalidate queries to refresh the data
              queryClient.invalidateQueries({ queryKey: ["/api/leads"] });
              queryClient.invalidateQueries({ queryKey: ["/api/my/leads"] });
              queryClient.invalidateQueries({ queryKey: ["/api/metrics"] });
              break;
              
            case 'lead_unassigned':
              toast({
                title: "Lead Unassigned",
                description: `Lead "${message.data.name}" has been returned to Lead Management`,
                variant: "default",
              });
              // Invalidate queries to refresh the data
              queryClient.invalidateQueries({ queryKey: ["/api/leads"] });
              queryClient.invalidateQueries({ queryKey: ["/api/my/leads"] });
              queryClient.invalidateQueries({ queryKey: ["/api/metrics"] });
              break;
              
            case 'system_notification':
              toast({
                title: message.data.title || "System Notification",
                description: message.data.message,
                variant: message.data.variant || "default",
              });
              break;
              
            default:
              console.log('Unknown notification type:', message.type);
          }
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };

      ws.onclose = () => {
        console.log('WebSocket connection closed');
        setConnectionStatus('disconnected');
        wsRef.current = null;
        
        // Attempt to reconnect if not manually closed
        if (reconnectAttempts.current < maxReconnectAttempts) {
          reconnectAttempts.current += 1;
          const delay = Math.pow(2, reconnectAttempts.current) * 1000; // Exponential backoff
          
          console.log(`Attempting to reconnect in ${delay}ms (attempt ${reconnectAttempts.current}/${maxReconnectAttempts})`);
          
          reconnectTimeoutRef.current = window.setTimeout(() => {
            connect();
          }, delay);
        } else {
          toast({
            title: "Connection Lost",
            description: "Real-time notifications are not available. Please refresh the page.",
            variant: "destructive",
          });
        }
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        setConnectionStatus('error');
      };

    } catch (error) {
      console.error('Error creating WebSocket connection:', error);
      setConnectionStatus('error');
    }
  };

  const disconnect = () => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.close();
    }
    
    wsRef.current = null;
    setConnectionStatus('disconnected');
  };

  const sendMessage = (type: string, data: any) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      const message = JSON.stringify({ type, data });
      wsRef.current.send(message);
      console.log('Sent WebSocket message:', { type, data });
    } else {
      console.warn('WebSocket not connected, unable to send message');
    }
  };

  useEffect(() => {
    // Only connect when we're in an authenticated context
    if (typeof window !== 'undefined') {
      connect();
    }
    
    return () => {
      disconnect();
    };
  }, []);

  return {
    connectionStatus,
    sendMessage,
    connect,
    disconnect
  };
}