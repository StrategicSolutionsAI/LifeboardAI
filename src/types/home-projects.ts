export interface HomeProject {
  id: string
  title: string
  description?: string
  category: ProjectCategory
  priority: ProjectPriority
  status: ProjectStatus
  room?: string
  estimatedHours?: number
  actualHours?: number
  dueDate?: string // ISO date string
  createdAt: string // ISO timestamp
  updatedAt: string // ISO timestamp
  notes?: string[]
  photos?: string[]
  completedAt?: string // ISO timestamp when marked complete
}

export type ProjectCategory = 
  | 'maintenance' 
  | 'repairs' 
  | 'improvements' 
  | 'seasonal' 
  | 'exterior' 
  | 'interior'

export type ProjectPriority = 
  | 'critical' 
  | 'high' 
  | 'medium' 
  | 'low'

export type ProjectStatus = 
  | 'planning' 
  | 'active' 
  | 'waiting' 
  | 'completed' 
  | 'on-hold'

export const PROJECT_CATEGORIES = {
  maintenance: { 
    icon: 'Settings', 
    color: 'teal', 
    label: 'Maintenance',
    description: 'Regular upkeep and preventive tasks'
  },
  repairs: { 
    icon: 'Wrench', 
    color: 'orange', 
    label: 'Repairs',
    description: 'Fixing broken or damaged items'
  },
  improvements: { 
    icon: 'Sparkles', 
    color: 'violet', 
    label: 'Improvements',
    description: 'Upgrades and enhancements'
  },
  seasonal: { 
    icon: 'Calendar', 
    color: 'green', 
    label: 'Seasonal',
    description: 'Time-sensitive seasonal tasks'
  },
  exterior: { 
    icon: 'Home', 
    color: 'blue', 
    label: 'Exterior',
    description: 'Outside of house and yard'
  },
  interior: { 
    icon: 'Sofa', 
    color: 'indigo', 
    label: 'Interior',
    description: 'Inside house projects'
  }
} as const

export const PROJECT_PRIORITIES = {
  critical: { 
    color: 'red', 
    urgent: true, 
    label: 'Critical',
    description: 'Immediate safety or major issues'
  },
  high: { 
    color: 'orange', 
    urgent: true, 
    label: 'High',
    description: 'Important, should be done soon'
  },
  medium: { 
    color: 'blue', 
    urgent: false, 
    label: 'Medium',
    description: 'Planned improvements'
  },
  low: { 
    color: 'gray', 
    urgent: false, 
    label: 'Low',
    description: 'Someday projects'
  }
} as const

export const PROJECT_STATUS = {
  planning: { 
    color: 'blue', 
    icon: 'CircleDot', 
    label: 'Planning',
    description: 'Ideas and planning phase'
  },
  active: { 
    color: 'orange', 
    icon: 'Play', 
    label: 'In Progress',
    description: 'Currently working on'
  },
  waiting: { 
    color: 'amber', 
    icon: 'Clock', 
    label: 'Waiting',
    description: 'Waiting for materials/weather/help'
  },
  completed: { 
    color: 'green', 
    icon: 'CheckCircle', 
    label: 'Completed',
    description: 'Finished successfully'
  },
  'on-hold': { 
    color: 'gray', 
    icon: 'Pause', 
    label: 'On Hold',
    description: 'Paused for budget/time reasons'
  }
} as const

export const ROOM_CATEGORIES = {
  kitchen: 'Kitchen',
  bathroom: 'Bathroom', 
  living_room: 'Living Room',
  bedroom: 'Bedroom',
  exterior: 'Exterior',
  garage: 'Garage/Storage',
  basement: 'Basement',
  attic: 'Attic',
  laundry: 'Laundry Room',
  office: 'Home Office',
  dining_room: 'Dining Room',
  other: 'Other'
} as const

export const PROJECT_TEMPLATES = {
  maintenance: [
    'Replace HVAC filter',
    'Clean gutters',
    'Service appliances',
    'Check smoke detectors',
    'Inspect roof',
    'Seal windows/doors',
    'Clean dryer vent'
  ],
  repairs: [
    'Fix leaky faucet',
    'Patch drywall hole',
    'Replace broken tiles',
    'Fix squeaky door',
    'Repair fence',
    'Fix electrical outlet',
    'Replace broken light fixture'
  ],
  improvements: [
    'Install new fixtures',
    'Paint room',
    'Update flooring',
    'Install shelving',
    'Upgrade kitchen hardware',
    'Add backsplash',
    'Install ceiling fan'
  ],
  seasonal: [
    'Winterize outdoor faucets',
    'Clean/store patio furniture',
    'Rake leaves',
    'Plant spring flowers',
    'Prepare garden beds',
    'Check heating system',
    'Inspect gutters before winter'
  ]
} as const