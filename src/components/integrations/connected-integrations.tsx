"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CalendarEvents } from "./calendar-events";
import { GoogleCalendarStatus } from "./google-calendar-status";
import { Button } from "@/components/ui/button";
import { PlusCircle, RefreshCw } from "lucide-react";
import { supabase } from "@/utils/supabase/client";

interface ConnectedIntegrationsProps {
  className?: string;
}

export function ConnectedIntegrations({ className }: ConnectedIntegrationsProps) {
  const [userId, setUserId] = useState<string | null>(null);
  const [hasGoogleCalendar, setHasGoogleCalendar] = useState<boolean>(false);
  const [hasWithings, setHasWithings] = useState<boolean>(false);
  const [withingsWeight, setWithingsWeight] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function getUserAndIntegrations() {
      try {
        setIsLoading(true);
        const { data: { user } } = await supabase.auth.getUser();
        
        if (user) {
          setUserId(user.id);
          
          // Check if the user has Google Calendar integration
          const { data: calData } = await supabase
            .from('user_integrations')
            .select('provider')
            .eq('user_id', user.id)
            .eq('provider', 'google_calendar')
            .single();

          setHasGoogleCalendar(!!calData);

          // Check Withings integration
          const { data: withingsData } = await supabase
            .from('user_integrations')
            .select('provider')
            .eq('user_id', user.id)
            .eq('provider', 'withings')
            .single();

          const hasWithingsIntegration = !!withingsData;
          setHasWithings(hasWithingsIntegration);

          if (hasWithingsIntegration) {
            try {
              const res = await fetch('/api/integrations/withings/metrics');
              if (res.ok) {
                const json = await res.json();
                if (json.weightKg !== undefined && json.weightKg !== null) {
                  const lbs = (json.weightKg * 2.20462).toFixed(1);
                  setWithingsWeight(`${lbs}`);
                }
              }
            } catch (e) {
              console.error('Failed to fetch Withings weight', e);
            }
          }
        }
      } catch (error) {
        console.error("Error fetching user and integrations:", error);
      } finally {
        setIsLoading(false);
      }
    }

    getUserAndIntegrations();
  }, []);
  
  const connectGoogleCalendar = () => {
    window.location.href = '/api/auth/google?redirectUrl=/dashboard';
  };

  const connectWithings = () => {
    window.location.href = '/api/auth/withings?redirectUrl=/dashboard';
  };

  return (
    <div className={className}>
      <Card className="overflow-hidden">
        <CardHeader className="bg-[#F6F6FC]">
          <CardTitle className="text-lg">Connected Integrations</CardTitle>
        </CardHeader>
        <CardContent className="p-5">
          {isLoading ? (
            <p className="text-sm text-gray-500">Loading integrations...</p>
          ) : (
            <div className="space-y-6">
              {/* Google Calendar Integration */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">🗓️</span>
                    <h3 className="text-[16px] font-medium text-[#171A1F]">Google Calendar</h3>
                  </div>
                  
                  {userId && <GoogleCalendarStatus userId={userId} />}
                </div>
                
                {hasGoogleCalendar ? (
                  <CalendarEvents maxEvents={3} />
                ) : (
                  <div className="flex flex-col items-center justify-center p-6 bg-gray-50 rounded-md">
                    <p className="text-sm text-gray-500 mb-3">Connect your Google Calendar to sync events</p>
                    <Button 
                      onClick={connectGoogleCalendar}
                      className="bg-[#5271F8] hover:bg-[#4060E8] text-white"
                    >
                      <PlusCircle className="h-4 w-4 mr-2" />
                      Connect Google Calendar
                    </Button>
                  </div>
                )}
              </div>
              
              {/* Withings Scale Integration */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">⚖️</span>
                    <h3 className="text-[16px] font-medium text-[#171A1F]">Withings Smart Scale</h3>
                  </div>

                  {hasWithings && (
                    <span className="text-sm text-green-600">Connected</span>
                  )}
                </div>

                {hasWithings ? (
                  <div className="flex flex-col items-center justify-center p-6 bg-gray-50 rounded-md">
                    {withingsWeight ? (
                      <p className="text-sm text-gray-700">Latest weight: <span className="font-medium">{withingsWeight} lbs</span></p>
                    ) : (
                      <p className="text-sm text-gray-500">Fetching latest weight...</p>
                    )}
                    <Button 
                      onClick={() => {
                        // Force refresh weight
                        setWithingsWeight(null);
                        fetch('/api/integrations/withings/metrics').then(async (res) => {
                          if (res.ok) {
                            const json = await res.json();
                            if (json.weightKg !== undefined && json.weightKg !== null) {
                              const lbs = (json.weightKg * 2.20462).toFixed(1);
                              setWithingsWeight(`${lbs}`);
                            }
                          }
                        });
                      }}
                      variant="outline"
                      className="mt-4 flex items-center gap-2"
                    >
                      <RefreshCw className="h-4 w-4" /> Refresh
                    </Button>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center p-6 bg-gray-50 rounded-md">
                    <p className="text-sm text-gray-500 mb-3">Connect your Withings smart scale to see weight data</p>
                    <Button 
                      onClick={connectWithings}
                      className="bg-[#5271F8] hover:bg-[#4060E8] text-white"
                    >
                      <PlusCircle className="h-4 w-4 mr-2" />
                      Connect Withings
                    </Button>
                  </div>
                )}
              </div>

              {/* You can add more integrations here */}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
