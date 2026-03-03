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
  // Optional linkage to a task so the item can appear in both views
  linkedTaskId?: string;         // task id if this widget is mirrored as a task
  linkedTaskSource?: 'todoist' | 'supabase' | 'local';
  linkedTaskAutoCreated?: boolean; // whether the linked task was generated from this widget
  linkedTaskTitle?: string;      // cached task title for quick display
  linkedTaskConfig?: {
    enabled?: boolean;           // whether the widget should surface as a task
    title?: string;              // custom title when creating the task
    bucket?: string;             // preferred bucket for the mirrored task
    dueDate?: string;            // ISO date string (YYYY-MM-DD)
    startTime?: string;          // HH:mm string for start time
    endTime?: string;            // HH:mm string for end time
    allDay?: boolean;            // treat the mirrored task as all-day
    repeat?: 'none' | 'daily' | 'weekly' | 'weekdays' | 'monthly';
  };
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
  // Mood tracker specific data
  moodData?: {
    currentMood?: number;        // 1-5 scale (1=very poor, 5=excellent)
    moodNote?: string;           // optional note about mood
    lastUpdated?: string;        // ISO timestamp of last mood entry
    entries?: Array<{
      date: string;              // YYYY-MM-DD
      mood: number;              // 1-5
      note?: string;
      loggedAt: string;          // ISO timestamp
    }>;
    weeklyAverage?: number;
    currentStreak?: number;
    bestStreak?: number;
  };
  // Journal widget specific data
  journalData?: {
    todaysEntry?: string;        // today's journal entry text
    lastEntryDate?: string;      // ISO date string (YYYY-MM-DD) of last entry
    entryCount?: number;         // total number of entries made
  };
  // Gratitude journal specific data
  gratitudeData?: {
    gratitudeItems?: string[];   // array of things grateful for today
    lastEntryDate?: string;      // ISO date string (YYYY-MM-DD) of last entry
    entryCount?: number;         // total number of gratitude entries
  };
  // Meditation timer data
  meditationData?: {
    isActive?: boolean;         // whether timer is currently running
    startTime?: number;         // timestamp when timer was started
    duration?: number;          // duration in seconds
    completedSessions?: number; // number of completed sessions
    lastSessionDate?: string;   // ISO date string (YYYY-MM-DD) of last session
    totalMinutes?: number;      // total minutes meditated
    isPaused?: boolean;
    elapsedBeforePause?: number;
    completedToday?: boolean;
    sessionHistory?: Array<{
      date: string;             // YYYY-MM-DD
      duration: number;         // minutes completed
      completedAt: string;      // ISO timestamp
    }>;
    preferredDuration?: number; // last used duration in minutes
    currentStreak?: number;
    bestStreak?: number;
  };
  // Sleep tracker data
  sleepData?: {
    entries: Array<{
      date: string;             // YYYY-MM-DD
      bedtime: string;          // HH:mm
      wakeTime: string;         // HH:mm
      duration: number;         // hours (decimal, e.g. 7.5)
      quality: number;          // 1-5
      notes?: string;
    }>;
    weeklyAverage: number;
    currentStreak: number;
    bestStreak: number;
    sleepDebt: number;          // accumulated hours deficit vs target
  };
  // Breathwork session data
  breathworkData?: {
    isActive?: boolean;
    currentPattern?: string;    // '4-7-8' | '4-4-4-4' | '4-2-6'
    cyclesCompleted?: number;
    totalSessions?: number;
    totalMinutes?: number;
    lastSessionDate?: string;
    sessionHistory?: Array<{
      date: string;             // YYYY-MM-DD
      pattern: string;
      cycles: number;
      duration: number;         // minutes
    }>;
    preferredPattern?: string;
    currentStreak?: number;
    bestStreak?: number;
  };
  // Water intake tracking data
  waterData?: {
    entries: Array<{
      date: string;            // YYYY-MM-DD
      amount: number;          // in current unit (cups/ml/oz)
      beverage: string;        // 'water' | 'tea' | 'coffee' | 'juice' | 'sparkling' | 'other'
      loggedAt: string;        // ISO timestamp
    }>;
    weeklyAverage: number;
    currentStreak: number;
    bestStreak: number;
    preferredUnit?: string;    // 'cups' | 'ml' | 'oz'
  };
  // Steps tracking data
  stepsData?: {
    entries: Array<{
      date: string;            // YYYY-MM-DD
      steps: number;           // step count for this entry
      source: string;          // 'manual' | 'walk' | 'run' | 'hike' | 'other'
      loggedAt: string;        // ISO timestamp
    }>;
    weeklyAverage: number;
    currentStreak: number;
    bestStreak: number;
    totalSteps: number;        // lifetime total
  };
  // Heart rate tracking data
  heartRateData?: {
    entries: Array<{
      date: string;            // YYYY-MM-DD
      bpm: number;             // heart rate in BPM
      context: string;         // 'resting' | 'post-exercise' | 'morning' | 'evening'
      loggedAt: string;        // ISO timestamp
    }>;
    weeklyAverage: number;
    currentStreak: number;
    bestStreak: number;
    lowestRecorded?: number;
    highestRecorded?: number;
  };
  // Caffeine tracking data
  caffeineData?: {
    entries: Array<{
      date: string;            // YYYY-MM-DD
      amount: number;          // mg of caffeine
      beverage: string;        // 'coffee' | 'espresso' | 'tea' | 'energy_drink' | 'soda' | 'other'
      cups: number;            // number of cups/servings
      loggedAt: string;        // ISO timestamp
    }>;
    weeklyAverage: number;     // avg cups per day
    currentStreak: number;
    bestStreak: number;
    totalCaffeineMg: number;   // lifetime total mg
  };
  // Quit habit tracking data
  quitHabitData?: {
    habitName?: string;         // what habit they're quitting (e.g., "smoking", "drinking")
    quitDate?: string;          // ISO date string (YYYY-MM-DD) when they quit
    costPerDay?: number;        // optional: how much money spent per day on habit
    currency?: string;          // currency symbol (default: "$")
    relapses?: Array<{          // track any relapses
      date: string;             // ISO date string when relapse occurred
      note?: string;            // optional note about the relapse
    }>;
    milestones?: Array<{        // predefined milestones to celebrate
      days: number;             // number of days for this milestone
      label: string;            // milestone name (e.g., "1 Week", "1 Month")
      achieved?: boolean;       // whether this milestone has been reached
      achievedDate?: string;    // when it was achieved
    }>;
    motivationalNote?: string;  // personal motivation/reason for quitting
  };
  // Habit tracker data
  habitTrackerData?: {
    habitName: string;
    habitDescription?: string;
    startDate: string;              // ISO YYYY-MM-DD
    bestStreak: number;
    totalCompletions: number;
    completionHistory: string[];    // array of ISO date strings when completed
    milestones: Array<{
      days: number;
      label: string;
      emoji: string;
      achieved: boolean;
      achievedDate?: string;
    }>;
  };
  // Weight tracking data
  weightData?: {
    currentWeight?: number;       // current weight value
    startingWeight?: number;      // weight when starting tracking
    goalWeight?: number;          // target weight goal
    unit?: string;               // 'lbs' or 'kg'
    entries?: Array<{            // historical weight entries
      date: string;              // ISO date string (YYYY-MM-DD)
      weight: number;            // weight value
      note?: string;             // optional note about the entry
    }>;
    lastEntryDate?: string;      // ISO date string of last entry
    totalChange?: number;        // total weight change from starting weight
    goalProgress?: number;       // percentage toward goal (0-100)
  };
  // Home Projects data
  homeProjectsData?: {
    projects?: Array<{
      id: string
      title: string
      description?: string
      category: 'maintenance' | 'repairs' | 'improvements' | 'seasonal' | 'exterior' | 'interior'
      priority: 'critical' | 'high' | 'medium' | 'low'
      status: 'planning' | 'active' | 'waiting' | 'completed' | 'on-hold'
      room?: string
      estimatedHours?: number
      actualHours?: number
      dueDate?: string // ISO date string
      createdAt: string // ISO timestamp
      updatedAt: string // ISO timestamp
      notes?: string[]
      photos?: string[]
      completedAt?: string // ISO timestamp when marked complete
    }>
    activeCount?: number        // number of active projects
    completedThisMonth?: number // completed projects this month
    totalProjects?: number      // total number of projects
    completionRate?: number     // percentage of completed projects
    lastUpdated?: string        // ISO timestamp of last update
  };
} 
