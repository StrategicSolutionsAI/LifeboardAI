export interface WidgetTemplate {
  id: string;
  name: string;
  description: string;
  icon: any; // string name or React component (lucide icon)
  category: string;
  unit: string;          // e.g. "ounces", "steps"
  units?: string[];      // optional list of alternative units
  defaultTarget: number; // suggested starting goal
  color?: string;
  dataSource?: string;   // optional: "manual", "fitbit", etc.
}

export interface WidgetInstance extends WidgetTemplate {
  instanceId: string;            // unique per added widget
  target: number;                // user-selected daily/period target
  schedule: boolean[];           // length 7, Monday-Sunday active flags
  color: string;                 // chosen colour (Tailwind or hex)
  rewardTimesPerMonth?: number;  // optional: how many successes per month
  rewardDollarPerGoal?: number;  // optional: dollars per achieved goal
  dataSource?: string;           // e.g. "Apple Health", "Manual"
  createdAt: string;             // ISO timestamp
  // Birthday widget specific data
  birthdayData?: {
    friendName: string;          // name of the friend
    birthDate: string;           // ISO date string (YYYY-MM-DD)
  };
  // Event widget specific data
  eventData?: {
    eventName: string;           // name of the event
    eventDate: string;           // ISO date string (YYYY-MM-DD)
    description?: string;        // optional event description
  };
  // Holiday widget specific data
  holidayData?: {
    holidayName: string;         // name of the holiday
    holidayDate: string;         // ISO date string (YYYY-MM-DD)
  };
} 