/**
 * MONOLITH OS - Agent Service WebSocket Hook
 * Provides real-time connection to the Agent Service
 * Falls back gracefully when service is unavailable
 */

import { useState, useEffect, useCallback, useRef } from 'react';

const AGENT_SERVICE_WS_URL = import.meta.env.VITE_AGENT_SERVICE_WS_URL || 'ws://localhost:3001';
const RECONNECT_DELAY = 5000; // 5 seconds
const MAX_RECONNECT_ATTEMPTS = 10;
const HEARTBEAT_INTERVAL = 25000; // 25 seconds (server sends ping every 30s)

/**
 * Hook for connecting to the Agent Service via WebSocket
 * @param {Object} options - Configuration options
 * @param {boolean} options.autoConnect - Whether to connect automatically (default: true)
 * @param {function} options.onTaskQueued - Callback when a task is queued
 * @param {function} options.onTaskCompleted - Callback when a task is completed
 * @param {function} options.onTaskFailed - Callback when a task fails
 * @param {function} options.onEscalation - Callback when an escalation occurs
 * @param {function} options.onSystemReady - Callback when system becomes ready
 */
export function useAgentService(options = {}) {
  const {
    autoConnect = true,
    onTaskQueued,
    onTaskCompleted,
    onTaskFailed,
    onEscalation,
    onEscalationResolved,
    onHandoffCreated,
    onAgentError,
    onSystemReady,
    onMessage
  } = options;

  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionError, setConnectionError] = useState(null);
  const [clientId, setClientId] = useState(null);
  const [agentSystemReady, setAgentSystemReady] = useState(false);
  const [lastMessage, setLastMessage] = useState(null);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);

  const wsRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const heartbeatIntervalRef = useRef(null);
  const pendingRequestsRef = useRef(new Map()); // requestId -> { resolve, reject }

  // Generate unique request ID
  const generateRequestId = useCallback(() => {
    return `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }, []);

  // Send message through WebSocket
  const sendMessage = useCallback((action, payload = {}) => {
    return new Promise((resolve, reject) => {
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
        reject(new Error('WebSocket not connected'));
        return;
      }

      const requestId = generateRequestId();
      const message = JSON.stringify({ action, payload, requestId });

      // Store pending request
      pendingRequestsRef.current.set(requestId, { resolve, reject });

      // Set timeout for response
      setTimeout(() => {
        if (pendingRequestsRef.current.has(requestId)) {
          pendingRequestsRef.current.delete(requestId);
          reject(new Error('Request timeout'));
        }
      }, 10000);

      try {
        wsRef.current.send(message);
      } catch (error) {
        pendingRequestsRef.current.delete(requestId);
        reject(error);
      }
    });
  }, [generateRequestId]);

  // Handle incoming messages
  const handleMessage = useCallback((event) => {
    try {
      const message = JSON.parse(event.data);
      const { type, data } = message;

      setLastMessage(message);

      // Handle response to our requests
      if (type === 'response' && data?.requestId) {
        const pending = pendingRequestsRef.current.get(data.requestId);
        if (pending) {
          pendingRequestsRef.current.delete(data.requestId);
          if (data.success) {
            pending.resolve(data.data);
          } else {
            pending.reject(new Error(data.error || 'Request failed'));
          }
        }
        return;
      }

      // Handle different message types
      switch (type) {
        case 'connected':
          setClientId(data.clientId);
          setAgentSystemReady(data.agentSystemReady);
          console.log('[WS] Connected to Agent Service:', data.clientId);
          break;

        case 'systemReady':
          setAgentSystemReady(true);
          onSystemReady?.(data);
          break;

        case 'taskQueued':
          onTaskQueued?.(data.task);
          break;

        case 'taskCompleted':
          onTaskCompleted?.(data);
          break;

        case 'taskFailed':
          onTaskFailed?.(data);
          break;

        case 'escalation':
          onEscalation?.(data.escalation);
          break;

        case 'escalationResolved':
          onEscalationResolved?.(data.escalation);
          break;

        case 'handoffCreated':
          onHandoffCreated?.(data);
          break;

        case 'agentError':
          onAgentError?.(data);
          break;

        case 'error':
          console.error('[WS] Server error:', data.message);
          break;

        default:
          // Generic message handler
          onMessage?.(message);
      }
    } catch (error) {
      console.error('[WS] Error parsing message:', error);
    }
  }, [onTaskQueued, onTaskCompleted, onTaskFailed, onEscalation,
      onEscalationResolved, onHandoffCreated, onAgentError, onSystemReady, onMessage]);

  // Connect to WebSocket
  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN || isConnecting) {
      return;
    }

    setIsConnecting(true);
    setConnectionError(null);

    try {
      const ws = new WebSocket(AGENT_SERVICE_WS_URL);

      ws.onopen = () => {
        console.log('[WS] Connected to Agent Service');
        setIsConnected(true);
        setIsConnecting(false);
        setConnectionError(null);
        setReconnectAttempts(0);

        // Start heartbeat
        heartbeatIntervalRef.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            sendMessage('ping').catch(() => {});
          }
        }, HEARTBEAT_INTERVAL);
      };

      ws.onmessage = handleMessage;

      ws.onerror = (error) => {
        console.error('[WS] Connection error:', error);
        setConnectionError('Connection error');
      };

      ws.onclose = (event) => {
        console.log('[WS] Connection closed:', event.code, event.reason);
        setIsConnected(false);
        setIsConnecting(false);
        setClientId(null);
        setAgentSystemReady(false);

        // Clear heartbeat
        if (heartbeatIntervalRef.current) {
          clearInterval(heartbeatIntervalRef.current);
          heartbeatIntervalRef.current = null;
        }

        // Reject all pending requests
        for (const [, pending] of pendingRequestsRef.current) {
          pending.reject(new Error('Connection closed'));
        }
        pendingRequestsRef.current.clear();

        // Attempt reconnect if not intentional close
        if (event.code !== 1000 && reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
          setConnectionError('Connection lost, reconnecting...');
          reconnectTimeoutRef.current = setTimeout(() => {
            setReconnectAttempts(prev => prev + 1);
            connect();
          }, RECONNECT_DELAY);
        } else if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
          setConnectionError('Max reconnection attempts reached');
        }
      };

      wsRef.current = ws;
    } catch (error) {
      console.error('[WS] Failed to create connection:', error);
      setIsConnecting(false);
      setConnectionError(error.message);
    }
  }, [isConnecting, reconnectAttempts, handleMessage, sendMessage]);

  // Disconnect from WebSocket
  const disconnect = useCallback(() => {
    // Clear reconnect timeout
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    // Clear heartbeat
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
      heartbeatIntervalRef.current = null;
    }

    // Close WebSocket
    if (wsRef.current) {
      wsRef.current.close(1000, 'Client disconnect');
      wsRef.current = null;
    }

    setIsConnected(false);
    setIsConnecting(false);
    setClientId(null);
    setAgentSystemReady(false);
    setReconnectAttempts(0);
  }, []);

  // API methods
  const getStatus = useCallback(() => {
    return sendMessage('getStatus');
  }, [sendMessage]);

  const queueTask = useCallback((task) => {
    return sendMessage('queueTask', { task });
  }, [sendMessage]);

  const getCEOQueue = useCallback(() => {
    return sendMessage('getCEOQueue');
  }, [sendMessage]);

  const resolveEscalation = useCallback((escalationId, decision) => {
    return sendMessage('resolveEscalation', { escalationId, decision });
  }, [sendMessage]);

  const getDailySummary = useCallback(() => {
    return sendMessage('getDailySummary');
  }, [sendMessage]);

  const startWorkflow = useCallback((workflowId, context) => {
    return sendMessage('startWorkflow', { workflowId, context });
  }, [sendMessage]);

  const getWorkflowStatus = useCallback((instanceId) => {
    return sendMessage('getWorkflowStatus', { instanceId });
  }, [sendMessage]);

  const subscribe = useCallback((events) => {
    return sendMessage('subscribe', { events });
  }, [sendMessage]);

  // Auto-connect on mount
  useEffect(() => {
    if (autoConnect) {
      connect();
    }

    return () => {
      disconnect();
    };
  }, [autoConnect, connect, disconnect]);

  return {
    // Connection state
    isConnected,
    isConnecting,
    connectionError,
    clientId,
    agentSystemReady,
    lastMessage,
    reconnectAttempts,

    // Connection methods
    connect,
    disconnect,

    // API methods
    getStatus,
    queueTask,
    getCEOQueue,
    resolveEscalation,
    getDailySummary,
    startWorkflow,
    getWorkflowStatus,
    subscribe,

    // Raw send
    sendMessage
  };
}

/**
 * Simplified hook for just connection status
 */
export function useAgentServiceStatus() {
  const [status, setStatus] = useState({
    connected: false,
    agentSystemReady: false,
    error: null
  });

  const { isConnected, agentSystemReady, connectionError } = useAgentService({
    autoConnect: true
  });

  useEffect(() => {
    setStatus({
      connected: isConnected,
      agentSystemReady,
      error: connectionError
    });
  }, [isConnected, agentSystemReady, connectionError]);

  return status;
}

export default useAgentService;
