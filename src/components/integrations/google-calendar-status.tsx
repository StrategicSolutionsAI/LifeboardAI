"use client";

import { useEffect, useState } from "react";
import { CheckCircle, XCircle, Loader2 } from "lucide-react";

interface GoogleCalendarStatusProps {
  userId: string;
}

export function GoogleCalendarStatus({ userId }: GoogleCalendarStatusProps) {
  const [status, setStatus] = useState<'loading' | 'connected' | 'disconnected'>('loading');

  useEffect(() => {
    async function checkIntegrationStatus() {
      try {
        const response = await fetch(`/api/integrations/status?provider=google_calendar&userId=${userId}`);
        const data = await response.json();
        
        if (data.connected) {
          setStatus('connected');
        } else {
          setStatus('disconnected');
        }
      } catch (error) {
        console.error("Error checking integration status:", error);
        setStatus('disconnected');
      }
    }

    checkIntegrationStatus();
  }, [userId]);

  return (
    <div className="flex items-center gap-2">
      {status === 'loading' && (
        <><Loader2 className="h-4 w-4 animate-spin text-[#5271F8]" /> <span>Checking status...</span></>
      )}
      {status === 'connected' && (
        <><CheckCircle className="h-4 w-4 text-green-500" /> <span className="text-green-600">Connected</span></>
      )}
      {status === 'disconnected' && (
        <><XCircle className="h-4 w-4 text-gray-400" /> <span className="text-gray-500">Not connected</span></>
      )}
    </div>
  );
}
