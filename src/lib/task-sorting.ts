import { parse, parseISO, isValid } from 'date-fns';
import type { Task } from '@/hooks/use-tasks';

export type SortOption = 
  | 'smart'
  | 'priority' 
  | 'due-date' 
  | 'alphabetical' 
  | 'created-date'
  | 'modified-date';

export type SortDirection = 'asc' | 'desc';

// Extend the Task type to include additional fields from Todoist API
interface ExtendedTask extends Task {
  priority?: number;
  labels?: string[];
  project_id?: string;
}

/**
 * Smart sorting algorithm that prioritizes tasks based on multiple factors
 * Priority order:
 * 1. Overdue tasks (past due date)
 * 2. Tasks due today
 * 3. High priority tasks
 * 4. Tasks due tomorrow
 * 5. Tasks with due dates (sorted by date)
 * 6. Tasks without due dates (sorted by priority, then alphabetically)
 */
function getSmartScore(task: Task & Partial<ExtendedTask>): number {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  
  let score = 0;
  
  // Parse due date
  if (task.due?.date) {
    try {
      const dueDate = parse(task.due.date, 'yyyy-MM-dd', new Date());
      if (isValid(dueDate)) {
        const daysDiff = Math.floor((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        
        if (daysDiff < 0) {
          // Overdue - highest priority
          score = 10000 + Math.abs(daysDiff) * 10; // More overdue = higher score
        } else if (daysDiff === 0) {
          // Due today - very high priority
          score = 9000;
        } else if (daysDiff === 1) {
          // Due tomorrow - high priority
          score = 8000;
        } else if (daysDiff <= 7) {
          // Due within a week
          score = 7000 - daysDiff * 100;
        } else {
          // Has due date but later
          score = 5000 - Math.min(daysDiff, 30) * 10;
        }
      }
    } catch (e) {
      // Invalid date format, treat as no due date
    }
  }
  
  // Add priority score (Todoist priority: 1 = highest, 4 = lowest)
  if (task.priority) {
    const priorityBonus = (5 - task.priority) * 100;
    score += priorityBonus;
  }
  
  // Tasks with hour slots get a small boost (they're scheduled)
  if (task.hourSlot) {
    score += 50;
  }
  
  // Tasks with labels might be categorized/important
  if (task.labels && task.labels.length > 0) {
    score += 10 * task.labels.length;
  }
  
  return score;
}

/**
 * Sort tasks based on the selected option and direction
 */
export function sortTasks<T extends Task>(
  tasks: T[], 
  sortBy: SortOption, 
  direction: SortDirection
): T[] {
  const sorted = [...tasks].sort((a, b) => {
    let comparison = 0;
    
    switch (sortBy) {
      case 'smart':
        comparison = getSmartScore(b) - getSmartScore(a);
        break;
        
      case 'priority':
        // Todoist priority: 1 is highest, 4 is lowest
        // No priority should be treated as lowest
        const aPriority = (a as any).priority || 5;
        const bPriority = (b as any).priority || 5;
        comparison = aPriority - bPriority;
        break;
        
      case 'due-date':
        // Tasks without due dates go to the end
        if (!a.due?.date && !b.due?.date) {
          comparison = 0;
        } else if (!a.due?.date) {
          comparison = 1;
        } else if (!b.due?.date) {
          comparison = -1;
        } else {
          try {
            const aDate = parse(a.due.date, 'yyyy-MM-dd', new Date());
            const bDate = parse(b.due.date, 'yyyy-MM-dd', new Date());
            comparison = aDate.getTime() - bDate.getTime();
          } catch {
            comparison = 0;
          }
        }
        break;
        
      case 'alphabetical':
        comparison = a.content.toLowerCase().localeCompare(b.content.toLowerCase());
        break;
        
      case 'created-date':
        if (a.created_at && b.created_at) {
          try {
            const aDate = parseISO(a.created_at);
            const bDate = parseISO(b.created_at);
            comparison = bDate.getTime() - aDate.getTime(); // Newest first by default
          } catch {
            comparison = 0;
          }
        }
        break;
        
      case 'modified-date':
        if (a.updated_at && b.updated_at) {
          try {
            const aDate = parseISO(a.updated_at);
            const bDate = parseISO(b.updated_at);
            comparison = bDate.getTime() - aDate.getTime(); // Most recently modified first
          } catch {
            comparison = 0;
          }
        }
        break;
    }
    
    // Apply sort direction
    if (direction === 'desc' && sortBy !== 'smart') {
      comparison = -comparison;
    }
    
    return comparison;
  });
  
  return sorted;
}

/**
 * Get a human-readable description of the current sort
 */
export function getSortDescription(sortBy: SortOption, direction: SortDirection): string {
  const directionText = direction === 'asc' ? 'ascending' : 'descending';
  
  switch (sortBy) {
    case 'smart':
      return 'Sorted by urgency and importance';
    case 'priority':
      return `Sorted by priority (${direction === 'asc' ? 'highest first' : 'lowest first'})`;
    case 'due-date':
      return `Sorted by due date (${direction === 'asc' ? 'earliest first' : 'latest first'})`;
    case 'alphabetical':
      return `Sorted alphabetically (${direction === 'asc' ? 'A to Z' : 'Z to A'})`;
    case 'created-date':
      return `Sorted by creation date (${direction === 'asc' ? 'oldest first' : 'newest first'})`;
    case 'modified-date':
      return `Sorted by last modified (${direction === 'asc' ? 'oldest first' : 'newest first'})`;
    default:
      return 'Custom sort';
  }
}

/**
 * Save sort preferences to localStorage
 */
export function saveSortPreference(sortBy: SortOption, direction: SortDirection) {
  if (typeof window !== 'undefined') {
    localStorage.setItem('lifeboard-task-sort', JSON.stringify({ sortBy, direction }));
  }
}

/**
 * Load sort preferences from localStorage
 */
export function loadSortPreference(): { sortBy: SortOption; direction: SortDirection } | null {
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem('lifeboard-task-sort');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return null;
      }
    }
  }
  return null;
}
