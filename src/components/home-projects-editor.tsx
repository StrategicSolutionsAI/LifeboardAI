"use client"

import { useState, useEffect } from 'react'
import { 
  Sheet, 
  SheetContent, 
  SheetHeader, 
  SheetTitle,
  SheetDescription,
  SheetClose 
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { 
  Plus, 
  Settings, 
  Wrench, 
  Sparkles, 
  Calendar, 
  Home, 
  CheckCircle, 
  Clock, 
  Play, 
  Pause, 
  CircleDot,
  Filter,
  SortAsc,
  Trash2,
  Edit3,
  X,
  AlertTriangle,
  Save,
  RotateCcw,
  ListChecks
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { 
  HomeProject, 
  ProjectCategory, 
  ProjectPriority, 
  ProjectStatus 
} from '@/types/home-projects'
import type { WidgetInstance } from '@/types/widgets'
import { 
  PROJECT_CATEGORIES, 
  PROJECT_PRIORITIES, 
  PROJECT_STATUS, 
  PROJECT_TEMPLATES,
  ROOM_CATEGORIES 
} from '@/types/home-projects'

interface HomeProjectsEditorProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  projects: HomeProject[]
  onProjectsChange: (projects: HomeProject[]) => void
  widget?: WidgetInstance
  onWidgetUpdate?: (widget: WidgetInstance) => void
  onAddToTasks?: (projectTitle: string, projectDescription?: string, dueDate?: string) => Promise<void>
}

export function HomeProjectsEditor({ 
  open, 
  onOpenChange, 
  projects, 
  onProjectsChange,
  widget,
  onWidgetUpdate,
  onAddToTasks
}: HomeProjectsEditorProps) {
  const [selectedProjects, setSelectedProjects] = useState<string[]>([])
  const [editingProject, setEditingProject] = useState<HomeProject | null>(null)
  const [filterStatus, setFilterStatus] = useState<ProjectStatus | 'all'>('all')
  const [filterPriority, setFilterPriority] = useState<ProjectPriority | 'all'>('all')
  const [sortBy, setSortBy] = useState<'priority' | 'dueDate' | 'status' | 'title'>('priority')
  const [searchQuery, setSearchQuery] = useState('')

  // Form state for new/editing project
  const [formData, setFormData] = useState<Partial<HomeProject>>({
    title: '',
    description: '',
    category: 'maintenance',
    priority: 'medium',
    status: 'planning',
    room: '',
    estimatedHours: 0,
    dueDate: '',
    notes: []
  })

  // Filter and sort projects
  const filteredProjects = projects
    .filter(project => {
      if (filterStatus !== 'all' && project.status !== filterStatus) return false
      if (filterPriority !== 'all' && project.priority !== filterPriority) return false
      if (searchQuery && !project.title.toLowerCase().includes(searchQuery.toLowerCase()) && 
          !project.description?.toLowerCase().includes(searchQuery.toLowerCase())) return false
      return true
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'priority':
          const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 }
          return priorityOrder[a.priority] - priorityOrder[b.priority]
        case 'dueDate':
          if (!a.dueDate && !b.dueDate) return 0
          if (!a.dueDate) return 1
          if (!b.dueDate) return -1
          return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()
        case 'status':
          const statusOrder = { critical: 0, active: 1, planning: 2, waiting: 3, 'on-hold': 4, completed: 5 }
          return statusOrder[a.status as keyof typeof statusOrder] - statusOrder[b.status as keyof typeof statusOrder]
        case 'title':
          return a.title.localeCompare(b.title)
        default:
          return 0
      }
    })

  // Get status icon
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
    
    return <IconComponent className={`w-4 h-4 text-${statusConfig.color}-600`} />
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

  // Handle project save
  const handleSaveProject = () => {
    if (!formData.title) return

    const now = new Date().toISOString()
    
    if (editingProject) {
      // Update existing project
      const updatedProjects = projects.map(p => 
        p.id === editingProject.id 
          ? { ...editingProject, ...formData, updatedAt: now }
          : p
      )
      onProjectsChange(updatedProjects)
    } else {
      // Add new project
      const newProject: HomeProject = {
        id: Date.now().toString(),
        title: formData.title!,
        description: formData.description,
        category: formData.category as ProjectCategory,
        priority: formData.priority as ProjectPriority,
        status: formData.status as ProjectStatus,
        room: formData.room,
        estimatedHours: formData.estimatedHours,
        dueDate: formData.dueDate,
        notes: formData.notes || [],
        createdAt: now,
        updatedAt: now
      }
      onProjectsChange([...projects, newProject])
    }

    // Reset form
    setFormData({
      title: '',
      description: '',
      category: 'maintenance',
      priority: 'medium',
      status: 'planning',
      room: '',
      estimatedHours: 0,
      dueDate: '',
      notes: []
    })
    setEditingProject(null)
  }

  // Handle project edit
  const handleEditProject = (project: HomeProject) => {
    setEditingProject(project)
    setFormData(project)
  }

  // Handle project delete
  const handleDeleteProject = (projectId: string) => {
    onProjectsChange(projects.filter(p => p.id !== projectId))
  }

  // Handle bulk actions
  const handleBulkStatusChange = (status: ProjectStatus) => {
    const updatedProjects = projects.map(p => 
      selectedProjects.includes(p.id) 
        ? { ...p, status, updatedAt: new Date().toISOString() }
        : p
    )
    onProjectsChange(updatedProjects)
    setSelectedProjects([])
  }

  const handleBulkDelete = () => {
    onProjectsChange(projects.filter(p => !selectedProjects.includes(p.id)))
    setSelectedProjects([])
  }

  // Reset form when switching tabs
  useEffect(() => {
    if (!editingProject) {
      setFormData({
        title: '',
        description: '',
        category: 'maintenance',
        priority: 'medium',
        status: 'planning',
        room: '',
        estimatedHours: 0,
        dueDate: '',
        notes: []
      })
    }
  }, [editingProject])

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-2xl">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5" />
            Manage Home Projects
          </SheetTitle>
          <SheetDescription>
            Add, edit, and organize your household maintenance and improvement projects.
          </SheetDescription>
        </SheetHeader>

        <Tabs defaultValue="projects" className="mt-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="projects">
              My Projects ({filteredProjects.length})
              {selectedProjects.length > 0 && (
                <span className="ml-1 px-1.5 py-0.5 text-xs bg-warm-100 text-warm-700 rounded">
                  {selectedProjects.length} selected
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="add">Quick Add</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
          </TabsList>

          <TabsContent value="projects" className="space-y-4">
            {/* Search and Filters */}
            <div className="space-y-3">
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Search projects..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="flex-1 px-3 py-2 border border-theme-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-warm-500"
                />
                {selectedProjects.length > 0 && (
                  <div className="flex gap-1">
                    <Button variant="outline" size="sm" onClick={() => handleBulkStatusChange('completed')}>
                      <CheckCircle className="w-4 h-4 mr-1" />
                      Complete
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => handleBulkStatusChange('active')}>
                      <Play className="w-4 h-4 mr-1" />
                      Activate
                    </Button>
                    <Button variant="destructive" size="sm" onClick={handleBulkDelete}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                )}
              </div>
              
              <div className="flex gap-2 flex-wrap">
                <select 
                  value={filterStatus} 
                  onChange={(e) => setFilterStatus(e.target.value as ProjectStatus | 'all')}
                  className="w-32 px-3 py-2 border border-theme-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-warm-500"
                >
                  <option value="all">All Status</option>
                  {Object.entries(PROJECT_STATUS).map(([key, config]) => (
                    <option key={key} value={key}>
                      {config.label}
                    </option>
                  ))}
                </select>

                <select 
                  value={filterPriority} 
                  onChange={(e) => setFilterPriority(e.target.value as ProjectPriority | 'all')}
                  className="w-32 px-3 py-2 border border-theme-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-warm-500"
                >
                  <option value="all">All Priority</option>
                  {Object.entries(PROJECT_PRIORITIES).map(([key, config]) => (
                    <option key={key} value={key}>
                      {config.label}
                    </option>
                  ))}
                </select>

                <select 
                  value={sortBy} 
                  onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
                  className="w-32 px-3 py-2 border border-theme-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-warm-500"
                >
                  <option value="priority">Priority</option>
                  <option value="dueDate">Due Date</option>
                  <option value="status">Status</option>
                  <option value="title">Title</option>
                </select>
              </div>
            </div>

            {/* Projects List */}
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {filteredProjects.map((project) => (
                <Card key={project.id} className="relative">
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <Checkbox
                        checked={selectedProjects.includes(project.id)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setSelectedProjects([...selectedProjects, project.id])
                          } else {
                            setSelectedProjects(selectedProjects.filter(id => id !== project.id))
                          }
                        }}
                      />
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          {getStatusIcon(project.status)}
                          <h4 className="font-medium text-theme-text-primary truncate">{project.title}</h4>
                          <Badge variant="outline" className={`bg-${PROJECT_PRIORITIES[project.priority].color}-50 text-${PROJECT_PRIORITIES[project.priority].color}-700 border-${PROJECT_PRIORITIES[project.priority].color}-200`}>
                            {PROJECT_PRIORITIES[project.priority].label}
                          </Badge>
                        </div>
                        
                        {project.description && (
                          <p className="text-sm text-theme-text-subtle mb-2">{project.description}</p>
                        )}
                        
                        <div className="flex items-center gap-4 text-xs text-theme-text-tertiary">
                          <div className="flex items-center gap-1">
                            {getCategoryIcon(project.category)}
                            <span className="capitalize">{project.category}</span>
                          </div>
                          {project.room && (
                            <span className="capitalize">{project.room}</span>
                          )}
                          {project.estimatedHours && (
                            <span>{project.estimatedHours}h est.</span>
                          )}
                          {project.dueDate && (
                            <span>Due {new Date(project.dueDate).toLocaleDateString()}</span>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex gap-1">
                        {onAddToTasks && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={async () => {
                              try {
                                const taskTitle = `${project.title}${project.room ? ` (${project.room})` : ''}`
                                await onAddToTasks(taskTitle, project.description, project.dueDate)
                                
                                // Mark project as active
                                const updatedProjects = projects.map(p => 
                                  p.id === project.id 
                                    ? { ...p, status: 'active' as ProjectStatus, updatedAt: new Date().toISOString() }
                                    : p
                                )
                                onProjectsChange(updatedProjects)
                              } catch (error) {
                                console.error('Failed to add project to tasks:', error)
                              }
                            }}
                            title="Add to Tasks"
                          >
                            <ListChecks className="w-4 h-4" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEditProject(project)}
                        >
                          <Edit3 className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteProject(project.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
              
              {filteredProjects.length === 0 && (
                <div className="text-center py-8 text-theme-text-tertiary">
                  No projects found. Try adjusting your filters or add a new project.
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="add" className="space-y-4">
            <div className="space-y-4">
              {/* Quick Templates */}
              {!editingProject && (
                <div className="space-y-3">
                  <h4 className="font-medium text-theme-text-primary">Quick Templates</h4>
                  <div className="grid grid-cols-2 gap-2">
                    {Object.entries(PROJECT_TEMPLATES).slice(0, 6).map(([category, templates]) => 
                      templates.slice(0, 1).map((template, index) => (
                        <button
                          key={`${category}-${index}`}
                          onClick={() => {
                            setFormData({
                              title: template,
                              description: '',
                              category: category as ProjectCategory,
                              priority: 'medium',
                              status: 'planning',
                              room: '',
                              estimatedHours: category === 'maintenance' ? 0.5 : category === 'repairs' ? 2 : 1,
                              dueDate: '',
                              notes: []
                            })
                          }}
                          className="p-3 text-left text-sm bg-theme-surface-alt hover:bg-theme-progress-track rounded-lg border border-theme-neutral-300 hover:border-theme-neutral-300 transition-colors"
                        >
                          <div className="flex items-center gap-2 mb-1">
                            {getCategoryIcon(category as ProjectCategory)}
                            <span className="font-medium text-theme-text-primary capitalize">{category}</span>
                          </div>
                          <div className="text-theme-text-subtle text-xs truncate">{template}</div>
                        </button>
                      ))
                    )}
                  </div>
                  <div className="border-b border-theme-neutral-300"></div>
                </div>
              )}
              
              {editingProject && (
                <div className="flex items-center gap-2 p-3 bg-warm-50 rounded-lg">
                  <Edit3 className="w-4 h-4 text-warm-600" />
                  <span className="text-sm text-warm-800">Editing: {editingProject.title}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setEditingProject(null)
                      setFormData({
                        title: '',
                        description: '',
                        category: 'maintenance',
                        priority: 'medium',
                        status: 'planning',
                        room: '',
                        estimatedHours: 0,
                        dueDate: '',
                        notes: []
                      })
                    }}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label htmlFor="title" className="block text-sm font-medium text-theme-text-body mb-1">Project Title</label>
                  <input
                    id="title"
                    type="text"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder="e.g., Fix leaky kitchen faucet"
                    className="w-full px-3 py-2 border border-theme-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-warm-500"
                  />
                </div>

                <div className="col-span-2">
                  <label htmlFor="description" className="block text-sm font-medium text-theme-text-body mb-1">Description</label>
                  <textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Additional details about the project..."
                    rows={3}
                    className="w-full px-3 py-2 border border-theme-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-warm-500"
                  />
                </div>

                <div>
                  <label htmlFor="category" className="block text-sm font-medium text-theme-text-body mb-1">Category</label>
                  <select 
                    value={formData.category} 
                    onChange={(e) => setFormData({ ...formData, category: e.target.value as ProjectCategory })}
                    className="w-full px-3 py-2 border border-theme-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-warm-500"
                  >
                    {Object.entries(PROJECT_CATEGORIES).map(([key, config]) => (
                      <option key={key} value={key}>
                        {config.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="priority" className="block text-sm font-medium text-theme-text-body mb-1">Priority</label>
                  <select 
                    value={formData.priority} 
                    onChange={(e) => setFormData({ ...formData, priority: e.target.value as ProjectPriority })}
                    className="w-full px-3 py-2 border border-theme-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-warm-500"
                  >
                    {Object.entries(PROJECT_PRIORITIES).map(([key, config]) => (
                      <option key={key} value={key}>
                        {config.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="status" className="block text-sm font-medium text-theme-text-body mb-1">Status</label>
                  <select 
                    value={formData.status} 
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as ProjectStatus })}
                    className="w-full px-3 py-2 border border-theme-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-warm-500"
                  >
                    {Object.entries(PROJECT_STATUS).map(([key, config]) => (
                      <option key={key} value={key}>
                        {config.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="room" className="block text-sm font-medium text-theme-text-body mb-1">Room</label>
                  <select 
                    value={formData.room} 
                    onChange={(e) => setFormData({ ...formData, room: e.target.value })}
                    className="w-full px-3 py-2 border border-theme-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-warm-500"
                  >
                    <option value="">Select room</option>
                    {Object.entries(ROOM_CATEGORIES).map(([key, label]) => (
                      <option key={key} value={key}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="hours" className="block text-sm font-medium text-theme-text-body mb-1">Estimated Hours</label>
                  <input
                    id="hours"
                    type="number"
                    min="0"
                    step="0.5"
                    value={formData.estimatedHours || ''}
                    onChange={(e) => setFormData({ ...formData, estimatedHours: parseFloat(e.target.value) || 0 })}
                    placeholder="0"
                    className="w-full px-3 py-2 border border-theme-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-warm-500"
                  />
                </div>

                <div>
                  <label htmlFor="dueDate" className="block text-sm font-medium text-theme-text-body mb-1">Due Date</label>
                  <input
                    id="dueDate"
                    type="date"
                    value={formData.dueDate}
                    onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                    className="w-full px-3 py-2 border border-theme-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-warm-500"
                  />
                </div>
              </div>

              <div className="flex gap-2">
                <Button onClick={handleSaveProject} className="flex-1">
                  <Save className="w-4 h-4 mr-2" />
                  {editingProject ? 'Update Project' : 'Add Project'}
                </Button>
                {editingProject && (
                  <Button variant="outline" onClick={() => setEditingProject(null)}>
                    <RotateCcw className="w-4 h-4 mr-2" />
                    Cancel
                  </Button>
                )}
              </div>
            </div>
          </TabsContent>


          <TabsContent value="settings" className="space-y-4">
            <div className="space-y-6">
              <div className="p-4 bg-theme-surface-alt rounded-lg">
                <h4 className="font-medium mb-4">Widget Appearance</h4>
                
                {/* Color Selection */}
                <div className="space-y-3">
                  <label className="block text-sm font-medium text-theme-text-body">Color</label>
                  <div className="grid grid-cols-6 gap-3">
                    {['blue', 'green', 'red', 'orange', 'purple', 'indigo', 'amber', 'teal', 'rose', 'cyan', 'yellow', 'sky'].map((color) => (
                      <button
                        key={color}
                        onClick={() => {
                          if (widget && onWidgetUpdate) {
                            onWidgetUpdate({ ...widget, color })
                          }
                        }}
                        className={`w-8 h-8 rounded-full border-2 transition-all ${
                          widget?.color === color 
                            ? 'border-theme-neutral-300 ring-2 ring-theme-neutral-300' 
                            : 'border-theme-neutral-300 hover:border-theme-neutral-300'
                        } bg-${color}-500`}
                        title={color}
                      />
                    ))}
                  </div>
                </div>

                {/* Daily Target */}
                <div className="space-y-3">
                  <label className="block text-sm font-medium text-theme-text-body">Daily Target</label>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => {
                        if (widget && onWidgetUpdate && widget.target > 1) {
                          onWidgetUpdate({ ...widget, target: widget.target - 1 })
                        }
                      }}
                      className="w-8 h-8 rounded-lg border border-theme-neutral-300 flex items-center justify-center text-theme-text-subtle hover:bg-theme-surface-alt"
                    >
                      -
                    </button>
                    <div className="flex-1 text-center">
                      <span className="text-2xl font-semibold">{widget?.target || 1}</span>
                      <span className="text-theme-text-tertiary ml-2">projects</span>
                    </div>
                    <button
                      onClick={() => {
                        if (widget && onWidgetUpdate) {
                          onWidgetUpdate({ ...widget, target: widget.target + 1 })
                        }
                      }}
                      className="w-8 h-8 rounded-lg border border-theme-neutral-300 flex items-center justify-center text-theme-text-subtle hover:bg-theme-surface-alt"
                    >
                      +
                    </button>
                  </div>
                </div>

                {/* Schedule */}
                <div className="space-y-3">
                  <label className="block text-sm font-medium text-theme-text-body">Schedule</label>
                  <div className="flex gap-2">
                    {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, index) => (
                      <button
                        key={index}
                        onClick={() => {
                          if (widget && onWidgetUpdate) {
                            const newSchedule = [...(widget.schedule || [true, true, true, true, true, true, true])]
                            newSchedule[index] = !newSchedule[index]
                            onWidgetUpdate({ ...widget, schedule: newSchedule })
                          }
                        }}
                        className={`w-10 h-10 rounded-full text-sm font-medium transition-all ${
                          widget?.schedule?.[index] !== false
                            ? `bg-${widget?.color || 'blue'}-500 text-white`
                            : 'bg-theme-progress-track text-theme-text-tertiary hover:bg-theme-skeleton'
                        }`}
                      >
                        {day}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  )
}