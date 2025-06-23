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
  dataSource?: string;
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
} 