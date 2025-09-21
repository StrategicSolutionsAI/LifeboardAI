import React, { useState, useRef, useEffect } from 'react';
import { 
  ArrowUpDown, 
  ArrowUp, 
  ArrowDown, 
  Calendar,
  AlertCircle,
  Clock,
  Hash,
  Type,
  Sparkles,
  ChevronDown
} from 'lucide-react';

export type SortOption = 
  | 'smart' // AI-suggested smart sort
  | 'priority' 
  | 'due-date' 
  | 'alphabetical' 
  | 'created-date'
  | 'modified-date';

export type SortDirection = 'asc' | 'desc';

interface SortControlsProps {
  currentSort: SortOption;
  currentDirection: SortDirection;
  onSortChange: (sort: SortOption, direction: SortDirection) => void;
  taskCount?: number;
  className?: string;
}

const sortOptions: { value: SortOption; label: string; icon: React.ReactNode; description: string }[] = [
  { 
    value: 'smart', 
    label: 'Smart Sort', 
    icon: <Sparkles size={16} />,
    description: 'AI-optimized: urgent & important first'
  },
  { 
    value: 'priority', 
    label: 'Priority', 
    icon: <AlertCircle size={16} />,
    description: 'Highest priority tasks first'
  },
  { 
    value: 'due-date', 
    label: 'Due Date', 
    icon: <Calendar size={16} />,
    description: 'Earliest deadlines first'
  },
  { 
    value: 'alphabetical', 
    label: 'Alphabetical', 
    icon: <Type size={16} />,
    description: 'A to Z task names'
  },
  { 
    value: 'created-date', 
    label: 'Date Added', 
    icon: <Clock size={16} />,
    description: 'Newest or oldest first'
  },
];

export function TaskSortControls({ 
  currentSort, 
  currentDirection, 
  onSortChange, 
  taskCount = 0,
  className = '' 
}: SortControlsProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  const currentOption = sortOptions.find(opt => opt.value === currentSort) || sortOptions[0];

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  const handleSortSelect = (option: SortOption) => {
    if (option === currentSort) {
      // If clicking the same sort, toggle direction
      onSortChange(option, currentDirection === 'asc' ? 'desc' : 'asc');
    } else {
      // New sort option, use intelligent default direction
      const defaultDirection = option === 'due-date' || option === 'priority' || option === 'smart' 
        ? 'asc'  // Earliest dates and highest priority first
        : option === 'created-date' 
        ? 'desc' // Newest first by default
        : 'asc'; // A-Z for alphabetical
      onSortChange(option, defaultDirection);
    }
    setIsOpen(false);
  };

  const toggleDirection = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSortChange(currentSort, currentDirection === 'asc' ? 'desc' : 'asc');
  };

  return (
    <div className={`relative ${className}`}>
      <div className="flex items-center gap-2">
        {/* Task count badge */}
        {taskCount > 0 && (
          <span className="text-xs font-medium text-theme-text-tertiary bg-theme-surface-raised px-2 py-0.5 rounded-full">
            {taskCount} {taskCount === 1 ? 'task' : 'tasks'}
          </span>
        )}

        {/* Sort dropdown */}
        <div ref={dropdownRef} className="relative">
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-theme-text-secondary hover:text-theme-text-primary bg-theme-surface hover:bg-theme-hover border border-theme-neutral-200 rounded-lg transition-all duration-150 shadow-sm hover:shadow"
          >
            {currentOption.icon}
            <span className="hidden sm:inline">{currentOption.label}</span>
            <ChevronDown 
              size={14} 
              className={`transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
            />
          </button>

          {/* Dropdown menu */}
          {isOpen && (
            <div className="absolute z-50 mt-2 w-72 bg-white rounded-xl shadow-xl border border-theme-neutral-200 overflow-hidden animate-in fade-in slide-in-from-top-1 duration-150">
              <div className="p-2">
                <div className="text-xs font-semibold text-theme-text-tertiary px-3 py-2 uppercase tracking-wider">
                  Sort Tasks By
                </div>
                {sortOptions.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => handleSortSelect(option.value)}
                    className={`w-full flex items-start gap-3 px-3 py-2.5 rounded-lg transition-all duration-150 ${
                      currentSort === option.value 
                        ? 'bg-theme-primary-50 text-theme-primary-700' 
                        : 'hover:bg-theme-hover text-theme-text-secondary hover:text-theme-text-primary'
                    }`}
                  >
                    <span className={`mt-0.5 ${currentSort === option.value ? 'text-theme-primary-600' : ''}`}>
                      {option.icon}
                    </span>
                    <div className="flex-1 text-left">
                      <div className="font-medium text-sm">{option.label}</div>
                      <div className={`text-xs mt-0.5 ${
                        currentSort === option.value ? 'text-theme-primary-600' : 'text-theme-text-tertiary'
                      }`}>
                        {option.description}
                      </div>
                    </div>
                    {currentSort === option.value && (
                      <div className="text-theme-primary-600 mt-0.5">
                        ✓
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Direction toggle */}
        <button
          onClick={toggleDirection}
          className="flex items-center gap-1.5 px-2.5 py-1.5 text-sm font-medium text-theme-text-secondary hover:text-theme-text-primary bg-theme-surface hover:bg-theme-hover border border-theme-neutral-200 rounded-lg transition-all duration-150 shadow-sm hover:shadow"
          title={currentDirection === 'asc' ? 'Sort ascending' : 'Sort descending'}
        >
          {currentDirection === 'asc' ? (
            <ArrowUp size={16} className="text-theme-primary-600" />
          ) : (
            <ArrowDown size={16} className="text-theme-primary-600" />
          )}
          <span className="hidden lg:inline text-xs">
            {currentDirection === 'asc' ? 'Ascending' : 'Descending'}
          </span>
        </button>
      </div>
    </div>
  );
}
