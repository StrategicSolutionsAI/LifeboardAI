"use client";

import { useState, useEffect } from "react";
import { format, parseISO } from "date-fns";
import { Calendar, Clock, MapPin, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface CalendarEvent {
  id: string;
  summary: string;
  start: {
    dateTime: string;
    date?: string;
    timeZone?: string;
  };
  end: {
    dateTime: string;
    date?: string;
    timeZone?: string;
  };
  location?: string;
  htmlLink: string;
}

interface CalendarEventsProps {
  maxEvents?: number;
}

export function CalendarEvents({ maxEvents = 5 }: CalendarEventsProps) {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchEvents() {
      try {
        setLoading(true);
        const now = new Date();
        const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
        
        const response = await fetch(
          `/api/integrations/google/calendar/events?timeMin=${now.toISOString()}&timeMax=${nextWeek.toISOString()}&maxResults=${maxEvents}`
        );
        
        if (!response.ok) {
          throw new Error('Failed to fetch calendar events');
        }
        
        const data = await response.json();
        setEvents(data.events || []);
        setError(null);
      } catch (err) {
        console.error('Error fetching events:', err);
        setError('Unable to load calendar events');
        setEvents([]);
      } finally {
        setLoading(false);
      }
    }

    fetchEvents();
  }, [maxEvents]);

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-[#5271F8]" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <p className="text-red-500">{error}</p>
        <p className="text-sm text-gray-500 mt-2">
          Make sure you've connected your Google Calendar.
        </p>
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500">No upcoming events found</p>
      </div>
    );
  }

  function formatEventTime(event: CalendarEvent) {
    // For all-day events
    if (event.start.date) {
      return format(parseISO(event.start.date), 'MMM d, yyyy');
    }
    
    // For regular events with time
    if (event.start.dateTime) {
      return format(parseISO(event.start.dateTime), 'MMM d, h:mm a');
    }
    
    return 'Time not specified';
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="text-lg flex items-center">
          <Calendar className="mr-2 h-5 w-5 text-[#5271F8]" />
          Upcoming Calendar Events
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {events.map((event) => (
            <div 
              key={event.id} 
              className="border-b border-gray-100 pb-3 last:border-0 last:pb-0"
            >
              <a 
                href={event.htmlLink} 
                target="_blank" 
                rel="noopener noreferrer"
                className="block hover:bg-gray-50 rounded-md p-2 -mx-2 transition-colors"
              >
                <h3 className="font-medium text-[#171A1F]">{event.summary}</h3>
                <div className="flex items-center text-[#6B7280] text-sm mt-1">
                  <Clock className="h-3.5 w-3.5 mr-1.5" />
                  {formatEventTime(event)}
                </div>
                {event.location && (
                  <div className="flex items-center text-[#6B7280] text-sm mt-1">
                    <MapPin className="h-3.5 w-3.5 mr-1.5" />
                    <span className="truncate">{event.location}</span>
                  </div>
                )}
              </a>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
