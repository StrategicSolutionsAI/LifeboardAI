"use client"

import { useState, useEffect } from 'react'
import { Hammer, Settings, Wrench, Sparkles, Calendar, Home, CheckCircle, Clock, Play, Pause, CircleDot, Plus, AlertTriangle, ChevronRight, Check, CalendarDays, ListPlus } from 'lucide-react'
import { RefinedWidgetBase } from './refined-widget-base'
import { HomeProjectsEditor } from './home-projects-editor'
import { cn } from '@/lib/utils'
import type { WidgetInstance } from '@/types/widgets'
import type { HomeProject, ProjectCategory, ProjectPriority, ProjectStatus } from '@/types/home-projects'
import { PROJECT_CATEGORIES, PROJECT_PRIORITIES, PROJECT_STATUS, PROJECT_TEMPLATES } from '@/types/home-projects'

interface HomeProjectsWidgetProps {
  widget: WidgetInstance
  className?: string
  onClick?: () => void
  compact?: boolean
  onUpdate?: (widget: WidgetInstance) => void
  onAddToTasks?: (projectTitle: string, projectDescription?: string, dueDate?: string) => Promise<void>
}

export function HomeProjectsWidget({ 
  widget,
  className, 
  onClick, 
  compact = false,
  onUpdate,
  onAddToTasks
}: HomeProjectsWidgetProps) {
  const [editorOpen, setEditorOpen] = useState(false)
  
  // Initialize projects from widget data or use mock data
  const [projects, setProjects] = useState<HomeProject[]>(
    widget.homeProjectsData?.projects || [
      {
        id: "1",
        title: "Replace HVAC filter",
        description: "Monthly maintenance - kitchen unit",
        category: "maintenance" as ProjectCategory,
        priority: "high" as ProjectPriority,
        status: "active" as ProjectStatus,
        room: "kitchen",
        estimatedHours: 0.5,
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // Next week
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: "2",
        title: "Fix leaky bathroom faucet",
        description: "Main bathroom sink dripping",
        category: "repairs" as ProjectCategory,
        priority: "critical" as ProjectPriority,
        status: "planning" as ProjectStatus,
        room: "bathroom",
        estimatedHours: 2,
        createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(), // 2 days ago
        updatedAt: new Date().toISOString()
      },
      {
        id: "3",
        title: "Install new kitchen backsplash",
        description: "Subway tile backsplash project",
        category: "improvements" as ProjectCategory,
        priority: "medium" as ProjectPriority,
        status: "waiting" as ProjectStatus,
        room: "kitchen",
        estimatedHours: 8,
        createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(), // 5 days ago
        updatedAt: new Date().toISOString()
      },
      {
        id: "4",
        title: "Clean gutters",
        description: "Fall maintenance before winter",
        category: "seasonal" as ProjectCategory,
        priority: "high" as ProjectPriority,
        status: "completed" as ProjectStatus,
        room: "exterior",
        estimatedHours: 3,
        actualHours: 2.5,
        createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
        updatedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
        completedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString()
      }
    ]
  )

  // Calculate metrics
  const activeProjects = projects.filter(p => p.status === 'active' || p.status === 'planning')
  const completedProjects = projects.filter(p => p.status === 'completed')
  const urgentProjects = projects.filter(p => 
    (p.priority === 'critical' || p.priority === 'high') && 
    p.status !== 'completed'
  )
  
  const totalProjects = projects.length
  const completionRate = totalProjects > 0 ? Math.round((completedProjects.length / totalProjects) * 100) : 0
  
  // Get next priority project
  const sortedActiveProjects = activeProjects.sort((a, b) => {
    const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 }
    return priorityOrder[a.priority] - priorityOrder[b.priority]
  })
  const nextProject = sortedActiveProjects[0]

  // Get status badge info
  const getStatusBadge = () => {
    if (urgentProjects.length > 0) {
      return { text: `${urgentProjects.length} Urgent`, variant: 'danger' as const }
    }
    if (activeProjects.length > 3) {
      return { text: `${activeProjects.length} Active`, variant: 'warning' as const }
    }
    if (activeProjects.length > 0) {
      return { text: `${activeProjects.length} Active`, variant: 'info' as const }
    }
    return { text: 'All Complete', variant: 'success' as const }
  }

  // Get progress color based on completion rate and urgency
  const getProgressColor = () => {
    if (urgentProjects.length > 0) return 'low' // Red for urgent items
    if (completionRate >= 80) return 'high'     // Green for high completion
    if (completionRate >= 60) return 'medium'   // Yellow for medium completion
    return 'low'                                 // Red for low completion
  }

  // Get smart status label for project
  const getSmartStatusLabel = (project: HomeProject) => {
    if (!project.dueDate) return PROJECT_PRIORITIES[project.priority].label

    const dueDate = new Date(project.dueDate)
    const today = new Date()
    const diffTime = dueDate.getTime() - today.getTime()
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

    if (diffDays < 0) {
      const overdueDays = Math.abs(diffDays)
      return `${overdueDays} day${overdueDays > 1 ? 's' : ''} overdue`
    } else if (diffDays === 0) {
      return 'Due today'
    } else if (diffDays === 1) {
      return 'Due tomorrow'
    } else if (diffDays <= 7) {
      return `Due in ${diffDays} days`
    } else {
      return PROJECT_PRIORITIES[project.priority].label
    }
  }

  // Get smart status color
  const getSmartStatusColor = (project: HomeProject) => {
    if (!project.dueDate) return PROJECT_PRIORITIES[project.priority].color

    const dueDate = new Date(project.dueDate)
    const today = new Date()
    const diffTime = dueDate.getTime() - today.getTime()
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

    if (diffDays < 0) return 'red'        // Overdue
    if (diffDays === 0) return 'orange'   // Due today
    if (diffDays <= 3) return 'amber'     // Due soon
    return PROJECT_PRIORITIES[project.priority].color
  }

  // Get project status icon
  const getStatusIcon = (status: ProjectStatus) => {
    const statusConfig = PROJECT_STATUS[status]
    const iconMap = {
      CheckCircle,
      Clock,
      Play,
      Pause,
      CircleDot,
      Settings,
      AlertTriangle
    } as const
    const IconComponent = iconMap[statusConfig.icon as keyof typeof iconMap] || CircleDot
    
    return <IconComponent className={`w-3 h-3 text-${statusConfig.color}-600`} />
  }

  // Get priority color
  const getPriorityColor = (priority: ProjectPriority) => {
    return PROJECT_PRIORITIES[priority].color
  }

  // Get category icon
  const getCategoryIcon = (category: ProjectCategory) => {
    const categoryConfig = PROJECT_CATEGORIES[category]
    const iconMap = {
      Settings,
      Wrench,
      Sparkles,
      Calendar,
      Home,
      CheckCircle
    } as const
    const IconComponent = iconMap[categoryConfig.icon as keyof typeof iconMap] || Settings
    
    return <IconComponent className="w-4 h-4" />
  }

  // Update widget data only when projects are modified through the editor
  const updateWidgetData = (newProjects: HomeProject[]) => {
    if (onUpdate) {
      const activeCount = newProjects.filter(p => p.status === 'active' || p.status === 'planning').length
      const completedCount = newProjects.filter(p => p.status === 'completed').length
      const completionRate = newProjects.length > 0 ? Math.round((completedCount / newProjects.length) * 100) : 0
      
      const updatedWidget: WidgetInstance = {
        ...widget,
        homeProjectsData: {
          projects: newProjects,
          activeCount: activeCount,
          completedThisMonth: completedCount, // Simplified - in real app would filter by month
          totalProjects: newProjects.length,
          completionRate: completionRate,
          lastUpdated: new Date().toISOString()
        }
      }
      onUpdate(updatedWidget)
    }
  }

  // Handle projects change from editor
  const handleProjectsChange = (newProjects: HomeProject[]) => {
    setProjects(newProjects)
    updateWidgetData(newProjects)
  }

  // Quick action: Mark project as completed
  const handleQuickComplete = (projectId: string) => {
    const updatedProjects = projects.map(p => 
      p.id === projectId 
        ? { ...p, status: 'completed' as ProjectStatus, completedAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
        : p
    )
    setProjects(updatedProjects)
    updateWidgetData(updatedProjects)
  }

  // Quick action: Snooze project (move due date by 7 days)
  const handleQuickSnooze = (projectId: string) => {
    const snoozeDate = new Date()
    snoozeDate.setDate(snoozeDate.getDate() + 7)
    
    const updatedProjects = projects.map(p => 
      p.id === projectId 
        ? { ...p, dueDate: snoozeDate.toISOString().split('T')[0], updatedAt: new Date().toISOString() }
        : p
    )
    setProjects(updatedProjects)
    updateWidgetData(updatedProjects)
  }

  // Quick action: Add project to tasks
  const handleAddToTasks = async (projectId: string) => {
    if (!onAddToTasks) return
    
    const project = projects.find(p => p.id === projectId)
    if (!project) return

    try {
      const taskTitle = `${project.title}${project.room ? ` (${project.room})` : ''}`
      const taskDescription = project.description
      const dueDate = project.dueDate || undefined

      await onAddToTasks(taskTitle, taskDescription, dueDate)
      
      // Optionally mark project as active since it's now in tasks
      const updatedProjects = projects.map(p => 
        p.id === projectId 
          ? { ...p, status: 'active' as ProjectStatus, updatedAt: new Date().toISOString() }
          : p
      )
      setProjects(updatedProjects)
      updateWidgetData(updatedProjects)
    } catch (error) {
      console.error('Failed to add project to tasks:', error)
    }
  }

  // Handle widget click to open editor
  const handleWidgetClick = () => {
    if (onClick) {
      onClick()
    } else {
      setEditorOpen(true)
    }
  }

  return (
    <>
      <RefinedWidgetBase
      title="Today's Projects"
      icon={Hammer}
      iconColor="blue"
      primaryValue={urgentProjects.length > 0 ? urgentProjects.length.toString() : "Ready"}
      primaryUnit={urgentProjects.length > 0 ? "need attention" : "to start"}
      secondaryLabel={urgentProjects.length > 0 ? "Action Needed" : "Next Steps"}
      secondaryValue={urgentProjects.length > 0 ? "Overdue or critical items" : `${activeProjects.length} projects planned`}
      progress={completionRate}
      progressColor={getProgressColor()}
      statusBadge={getStatusBadge()}
      onClick={handleWidgetClick}
      className={className}
      size={compact ? 'compact' : 'normal'}
    >
      {/* Extended content for larger widgets */}
      {!compact && (
        <div className="space-y-3">
          {/* Next Priority Project */}
          {nextProject && (
            <div className="border-t border-theme-neutral-300 pt-3">
              <div className="bg-theme-surface-alt rounded-lg p-3 hover:bg-theme-progress-track transition-colors group">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-medium text-theme-text-subtle uppercase tracking-wide">Next Priority:</span>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity ml-auto">
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleQuickComplete(nextProject.id)
                      }}
                      className="p-1 rounded text-green-600 hover:bg-green-100 transition-colors"
                      title="Mark Complete"
                    >
                      <Check className="w-3 h-3" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleQuickSnooze(nextProject.id)
                      }}
                      className="p-1 rounded text-warm-600 hover:bg-warm-100 transition-colors"
                      title="Snooze 7 days"
                    >
                      <CalendarDays className="w-3 h-3" />
                    </button>
                    {onAddToTasks && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleAddToTasks(nextProject.id)
                        }}
                        className="p-1 rounded text-amber-600 hover:bg-amber-100 transition-colors"
                        title="Add to Tasks"
                      >
                        <ListPlus className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>
                <div className="flex items-start justify-between gap-2 cursor-pointer" onClick={(e) => {
                  e.stopPropagation()
                  setEditorOpen(true)
                }}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      {getStatusIcon(nextProject.status)}
                      <span className="text-sm font-medium text-theme-text-primary truncate">
                        {nextProject.title}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-theme-text-tertiary flex-wrap">
                      <div className="flex items-center gap-1">
                        {getCategoryIcon(nextProject.category)}
                        <span className="capitalize">{nextProject.category}</span>
                      </div>
                      <span className={`px-1.5 py-0.5 rounded text-xs font-medium bg-${getSmartStatusColor(nextProject)}-100 text-${getSmartStatusColor(nextProject)}-700 whitespace-nowrap`}>
                        {getSmartStatusLabel(nextProject)}
                      </span>
                      {nextProject.room && (
                        <span className="capitalize">{nextProject.room}</span>
                      )}
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-theme-text-tertiary" />
                </div>
              </div>
            </div>
          )}

          {/* Today's Focus */}
          <div className="border-t border-theme-neutral-300 pt-3">
            {urgentProjects.length > 0 ? (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="w-4 h-4 text-red-600" />
                  <span className="text-sm font-medium text-red-800">Needs Immediate Attention</span>
                </div>
                <div className="text-xs text-red-700">
                  {urgentProjects.length} critical or overdue {urgentProjects.length === 1 ? 'project' : 'projects'} require action today
                </div>
              </div>
            ) : activeProjects.length > 0 ? (
              <div className="bg-warm-50 border border-warm-200 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle className="w-4 h-4 text-warm-600" />
                  <span className="text-sm font-medium text-warm-800">Ready to Work</span>
                </div>
                <div className="text-xs text-warm-700">
                  {activeProjects.length} {activeProjects.length === 1 ? 'project' : 'projects'} planned and ready to start
                </div>
              </div>
            ) : (
              <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle className="w-4 h-4 text-green-600" />
                  <span className="text-sm font-medium text-green-800">All Caught Up</span>
                </div>
                <div className="text-xs text-green-700">
                  No urgent projects! Great work staying on top of things.
                </div>
              </div>
            )}
          </div>

          {/* Smart Actions */}
          <div className="border-t border-theme-neutral-300 pt-3">
            <div className="flex items-center justify-between">
              <div className="text-sm text-theme-text-subtle">
                {urgentProjects.length > 0 
                  ? "Focus on urgent items first" 
                  : activeProjects.length > 0 
                    ? "Pick a project to work on"
                    : "All projects completed!"
                }
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  setEditorOpen(true)
                }}
                className="px-3 py-1.5 text-xs font-medium text-warm-700 bg-warm-50 hover:bg-warm-100 rounded-lg border border-warm-200 hover:border-warm-300 transition-colors flex items-center gap-1"
              >
                {urgentProjects.length > 0 ? (
                  <>
                    <AlertTriangle className="w-3 h-3" />
                    Fix Issues
                  </>
                ) : activeProjects.length > 0 ? (
                  <>
                    <Play className="w-3 h-3" />
                    Start Working
                  </>
                ) : (
                  <>
                    <Plus className="w-3 h-3" />
                    Add Project
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </RefinedWidgetBase>

    <HomeProjectsEditor
      open={editorOpen}
      onOpenChange={setEditorOpen}
      projects={projects}
      onProjectsChange={handleProjectsChange}
      widget={widget}
      onWidgetUpdate={onUpdate}
      onAddToTasks={onAddToTasks}
    />
    </>
  )
}