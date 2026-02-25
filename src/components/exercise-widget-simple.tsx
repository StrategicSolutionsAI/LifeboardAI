"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { 
  Activity, 
  Target, 
  Calendar, 
  Clock, 
  Flame, 
  Plus,
  Check,
  X,
  Edit3,
  Trophy,
  Zap,
  TrendingUp,
  Award,
  Star
} from "lucide-react"

interface WorkoutSession {
  id: string
  date: string
  type: string
  duration: number
  intensity: 'low' | 'medium' | 'high'
  calories?: number
  completed: boolean
}

interface ExerciseGoals {
  weeklyWorkouts: number
  weeklyMinutes: number
  preferredTypes: string[]
}

interface WorkoutTemplate {
  id: string
  name: string
  type: string
  duration: number
  intensity: 'low' | 'medium' | 'high'
  description: string
  exercises?: string[]
}

interface Achievement {
  id: string
  name: string
  description: string
  icon: any
  unlocked: boolean
  unlockedAt?: string
}

interface ExerciseWidgetProps {
  onClose?: () => void
}

const WORKOUT_TYPES = [
  'Cardio', 'Strength Training', 'Yoga', 'Pilates', 'Running', 
  'Cycling', 'Swimming', 'HIIT', 'Dance', 'Sports', 'Walking', 'Other'
]

const WORKOUT_TEMPLATES: WorkoutTemplate[] = [
  {
    id: 'quick-cardio',
    name: 'Quick Cardio Blast',
    type: 'Cardio',
    duration: 20,
    intensity: 'high',
    description: 'High-intensity cardio to get your heart pumping',
    exercises: ['Jumping Jacks', 'Burpees', 'Mountain Climbers', 'High Knees']
  },
  {
    id: 'strength-basics',
    name: 'Basic Strength',
    type: 'Strength Training',
    duration: 30,
    intensity: 'medium',
    description: 'Essential strength exercises for beginners',
    exercises: ['Push-ups', 'Squats', 'Lunges', 'Plank']
  },
  {
    id: 'morning-yoga',
    name: 'Morning Flow',
    type: 'Yoga',
    duration: 25,
    intensity: 'low',
    description: 'Gentle yoga flow to start your day',
    exercises: ['Sun Salutation', 'Warrior Poses', 'Child\'s Pose', 'Savasana']
  },
  {
    id: 'hiit-power',
    name: 'HIIT Power Session',
    type: 'HIIT',
    duration: 25,
    intensity: 'high',
    description: 'Intense interval training for maximum results',
    exercises: ['Burpees', 'Jump Squats', 'Push-ups', 'Sprint Intervals']
  },
  {
    id: 'recovery-walk',
    name: 'Recovery Walk',
    type: 'Walking',
    duration: 45,
    intensity: 'low',
    description: 'Easy-paced walk for active recovery',
    exercises: ['Brisk Walk', 'Light Stretching']
  }
]

const ACHIEVEMENT_TEMPLATES: Achievement[] = [
  {
    id: 'first-workout',
    name: 'Getting Started',
    description: 'Complete your first workout',
    icon: Star,
    unlocked: false
  },
  {
    id: 'week-warrior',
    name: 'Week Warrior',
    description: 'Complete your weekly workout goal',
    icon: Trophy,
    unlocked: false
  },
  {
    id: 'streak-3',
    name: '3-Day Streak',
    description: 'Work out 3 days in a row',
    icon: Zap,
    unlocked: false
  },
  {
    id: 'streak-7',
    name: 'Week Streak',
    description: 'Work out 7 days in a row',
    icon: Award,
    unlocked: false
  },
  {
    id: 'century',
    name: 'Century Club',
    description: 'Complete 100 total workouts',
    icon: TrendingUp,
    unlocked: false
  }
]

export function ExerciseWidget({ onClose }: ExerciseWidgetProps) {
  const [goals, setGoals] = useState<ExerciseGoals>({
    weeklyWorkouts: 3,
    weeklyMinutes: 150,
    preferredTypes: ['Cardio', 'Strength Training']
  })
  
  const [workouts, setWorkouts] = useState<WorkoutSession[]>([])
  const [achievements, setAchievements] = useState<Achievement[]>(ACHIEVEMENT_TEMPLATES)
  const [isAddingWorkout, setIsAddingWorkout] = useState(false)
  const [editingGoals, setEditingGoals] = useState(false)
  const [showTemplates, setShowTemplates] = useState(false)
  const [showAchievements, setShowAchievements] = useState(false)
  
  const [newWorkout, setNewWorkout] = useState({
    type: '',
    duration: 30,
    intensity: 'medium' as const,
    calories: ''
  })

  // Get current week's workouts
  const getCurrentWeekWorkouts = () => {
    const now = new Date()
    const startOfWeek = new Date(now.setDate(now.getDate() - now.getDay()))
    startOfWeek.setHours(0, 0, 0, 0)
    
    return workouts.filter(workout => {
      const workoutDate = new Date(workout.date)
      return workoutDate >= startOfWeek && workout.completed
    })
  }

  const currentWeekWorkouts = getCurrentWeekWorkouts()
  const completedWorkouts = currentWeekWorkouts.length
  const totalMinutes = currentWeekWorkouts.reduce((sum, workout) => sum + workout.duration, 0)
  const workoutProgress = Math.min((completedWorkouts / goals.weeklyWorkouts) * 100, 100)
  const minutesProgress = Math.min((totalMinutes / goals.weeklyMinutes) * 100, 100)

  // Get today's workouts
  const getTodayWorkouts = () => {
    const today = new Date().toDateString()
    return workouts.filter(workout => new Date(workout.date).toDateString() === today)
  }

  const todayWorkouts = getTodayWorkouts()

  // Calculate current workout streak
  const getWorkoutStreak = () => {
    const sortedWorkouts = workouts
      .filter(w => w.completed)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    
    let streak = 0
    let currentDate = new Date()
    currentDate.setHours(0, 0, 0, 0)
    
    for (const workout of sortedWorkouts) {
      const workoutDate = new Date(workout.date)
      workoutDate.setHours(0, 0, 0, 0)
      
      const diffDays = Math.floor((currentDate.getTime() - workoutDate.getTime()) / (1000 * 60 * 60 * 24))
      
      if (diffDays === streak) {
        streak++
        currentDate.setDate(currentDate.getDate() - 1)
      } else if (diffDays > streak) {
        break
      }
    }
    
    return streak
  }

  const currentStreak = getWorkoutStreak()

  // Get this week's workout days
  const getWeeklyWorkoutDays = () => {
    const now = new Date()
    const startOfWeek = new Date(now.setDate(now.getDate() - now.getDay()))
    startOfWeek.setHours(0, 0, 0, 0)
    
    const weekDays = []
    for (let i = 0; i < 7; i++) {
      const day = new Date(startOfWeek)
      day.setDate(startOfWeek.getDate() + i)
      const hasWorkout = workouts.some(workout => {
        const workoutDate = new Date(workout.date)
        return workoutDate.toDateString() === day.toDateString() && workout.completed
      })
      weekDays.push({ date: day, hasWorkout })
    }
    return weekDays
  }

  const weeklyWorkoutDays = getWeeklyWorkoutDays()

  // Check and unlock achievements
  const checkAchievements = (newWorkoutCount: number) => {
    const totalWorkouts = workouts.filter(w => w.completed).length + 1
    const newAchievements = [...achievements]
    let hasNewAchievement = false

    // First workout
    if (totalWorkouts === 1 && !newAchievements.find(a => a.id === 'first-workout')?.unlocked) {
      const achievement = newAchievements.find(a => a.id === 'first-workout')
      if (achievement) {
        achievement.unlocked = true
        achievement.unlockedAt = new Date().toISOString()
        hasNewAchievement = true
      }
    }

    // Weekly goal
    if (newWorkoutCount >= goals.weeklyWorkouts && !newAchievements.find(a => a.id === 'week-warrior')?.unlocked) {
      const achievement = newAchievements.find(a => a.id === 'week-warrior')
      if (achievement) {
        achievement.unlocked = true
        achievement.unlockedAt = new Date().toISOString()
        hasNewAchievement = true
      }
    }

    // Streak achievements
    if (currentStreak >= 3 && !newAchievements.find(a => a.id === 'streak-3')?.unlocked) {
      const achievement = newAchievements.find(a => a.id === 'streak-3')
      if (achievement) {
        achievement.unlocked = true
        achievement.unlockedAt = new Date().toISOString()
        hasNewAchievement = true
      }
    }

    if (currentStreak >= 7 && !newAchievements.find(a => a.id === 'streak-7')?.unlocked) {
      const achievement = newAchievements.find(a => a.id === 'streak-7')
      if (achievement) {
        achievement.unlocked = true
        achievement.unlockedAt = new Date().toISOString()
        hasNewAchievement = true
      }
    }

    // Century club
    if (totalWorkouts >= 100 && !newAchievements.find(a => a.id === 'century')?.unlocked) {
      const achievement = newAchievements.find(a => a.id === 'century')
      if (achievement) {
        achievement.unlocked = true
        achievement.unlockedAt = new Date().toISOString()
        hasNewAchievement = true
      }
    }

    if (hasNewAchievement) {
      setAchievements(newAchievements)
    }
  }

  const handleAddWorkout = () => {
    if (!newWorkout.type) return

    const workout: WorkoutSession = {
      id: Date.now().toString(),
      date: new Date().toISOString(),
      type: newWorkout.type,
      duration: newWorkout.duration,
      intensity: newWorkout.intensity,
      calories: newWorkout.calories ? parseInt(newWorkout.calories) : undefined,
      completed: true
    }

    setWorkouts(prev => [...prev, workout])
    checkAchievements(completedWorkouts + 1)
    setNewWorkout({ type: '', duration: 30, intensity: 'medium', calories: '' })
    setIsAddingWorkout(false)
  }

  const handleQuickWorkout = (type: string) => {
    const workout: WorkoutSession = {
      id: Date.now().toString(),
      date: new Date().toISOString(),
      type,
      duration: 30,
      intensity: 'medium',
      completed: true
    }
    setWorkouts(prev => [...prev, workout])
    checkAchievements(completedWorkouts + 1)
  }

  const handleTemplateWorkout = (template: WorkoutTemplate) => {
    const workout: WorkoutSession = {
      id: Date.now().toString(),
      date: new Date().toISOString(),
      type: template.type,
      duration: template.duration,
      intensity: template.intensity,
      completed: true
    }
    setWorkouts(prev => [...prev, workout])
    checkAchievements(completedWorkouts + 1)
    setShowTemplates(false)
  }

  const getProgressColor = (progress: number) => {
    if (progress >= 100) return 'bg-green-500'
    if (progress >= 75) return 'bg-[#bb9e7b]'
    if (progress >= 50) return 'bg-yellow-500'
    return 'bg-[#ebe5de]'
  }

  // Widget view (compact)
  if (!onClose) {
    return (
      <Card className="h-full">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Activity className="h-4 w-4" />
            Exercise Tracker
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Progress Bars */}
          <div className="space-y-2">
            <div className="flex justify-between text-xs">
              <span>Workouts</span>
              <span>{completedWorkouts}/{goals.weeklyWorkouts}</span>
            </div>
            <div className="w-full bg-[#ebe5de] rounded-full h-2">
              <div 
                className={`h-2 rounded-full transition-all ${getProgressColor(workoutProgress)}`}
                style={{ width: `${workoutProgress}%` }}
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between text-xs">
              <span>Minutes</span>
              <span>{totalMinutes}/{goals.weeklyMinutes}</span>
            </div>
            <div className="w-full bg-[#ebe5de] rounded-full h-2">
              <div 
                className={`h-2 rounded-full transition-all ${getProgressColor(minutesProgress)}`}
                style={{ width: `${minutesProgress}%` }}
              />
            </div>
          </div>

          {/* Streak and Today's Status */}
          <div className="pt-2 border-t space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-[#6b7688]">Streak</span>
              <Badge variant={currentStreak > 0 ? "default" : "outline"} className="text-xs">
                <Zap className="h-3 w-3 mr-1" />
                {currentStreak} day{currentStreak !== 1 ? 's' : ''}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-[#6b7688]">Today</span>
              {todayWorkouts.length > 0 ? (
                <Badge variant="secondary" className="text-xs">
                  <Check className="h-3 w-3 mr-1" />
                  {todayWorkouts.length} workout{todayWorkouts.length > 1 ? 's' : ''}
                </Badge>
              ) : (
                <Badge variant="outline" className="text-xs">
                  No workouts yet
                </Badge>
              )}
            </div>
          </div>

          {/* Weekly Calendar */}
          <div className="pt-2">
            <div className="text-xs text-[#6b7688] mb-2">This Week</div>
            <div className="flex gap-1">
              {weeklyWorkoutDays.map((day, index) => {
                const dayName = ['S', 'M', 'T', 'W', 'T', 'F', 'S'][index]
                return (
                  <div key={index} className="flex-1 text-center">
                    <div className="text-xs text-[#8e99a8] mb-1">{dayName}</div>
                    <div className={`w-6 h-6 rounded-full mx-auto flex items-center justify-center text-xs ${
                      day.hasWorkout 
                        ? 'bg-green-500 text-white' 
                        : 'bg-[#ebe5de] text-[#8e99a8]'
                    }`}>
                      {day.hasWorkout ? <Check className="h-3 w-3" /> : day.date.getDate()}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="flex gap-1 pt-2">
            {goals.preferredTypes.slice(0, 2).map(type => (
              <Button
                key={type}
                size="sm"
                variant="outline"
                className="text-xs flex-1"
                onClick={() => handleQuickWorkout(type)}
              >
                + {type}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  // Full modal view
  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Activity className="h-6 w-6" />
          <h1 className="text-2xl font-bold">Exercise Tracker</h1>
        </div>
        <Button variant="outline" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Goals Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5" />
              Weekly Goals
            </CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setEditingGoals(!editingGoals)}
            >
              <Edit3 className="h-4 w-4 mr-2" />
              Edit Goals
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {editingGoals ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-sm font-medium mb-2">Weekly Workouts</div>
                  <Input
                    type="number"
                    min="1"
                    max="14"
                    value={goals.weeklyWorkouts}
                    onChange={(e) => setGoals(prev => ({ 
                      ...prev, 
                      weeklyWorkouts: parseInt(e.target.value) || 1 
                    }))}
                  />
                </div>
                <div>
                  <div className="text-sm font-medium mb-2">Weekly Minutes</div>
                  <Input
                    type="number"
                    min="30"
                    max="1000"
                    value={goals.weeklyMinutes}
                    onChange={(e) => setGoals(prev => ({ 
                      ...prev, 
                      weeklyMinutes: parseInt(e.target.value) || 30 
                    }))}
                  />
                </div>
              </div>
              <div>
                <div className="text-sm font-medium mb-2">Preferred Workout Types</div>
                <div className="flex flex-wrap gap-2 mt-2">
                  {WORKOUT_TYPES.map(type => (
                    <Badge
                      key={type}
                      variant={goals.preferredTypes.includes(type) ? "default" : "outline"}
                      className="cursor-pointer"
                      onClick={() => {
                        setGoals(prev => ({
                          ...prev,
                          preferredTypes: prev.preferredTypes.includes(type)
                            ? prev.preferredTypes.filter(t => t !== type)
                            : [...prev.preferredTypes, type]
                        }))
                      }}
                    >
                      {type}
                    </Badge>
                  ))}
                </div>
              </div>
              <Button onClick={() => setEditingGoals(false)}>
                Save Goals
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-[#9a7b5a]">{completedWorkouts}</div>
                <div className="text-sm text-[#6b7688]">of {goals.weeklyWorkouts} workouts</div>
                <div className="w-full bg-[#ebe5de] rounded-full h-2 mt-2">
                  <div 
                    className={`h-2 rounded-full transition-all ${getProgressColor(workoutProgress)}`}
                    style={{ width: `${workoutProgress}%` }}
                  />
                </div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">{totalMinutes}</div>
                <div className="text-sm text-[#6b7688]">of {goals.weeklyMinutes} minutes</div>
                <div className="w-full bg-[#ebe5de] rounded-full h-2 mt-2">
                  <div 
                    className={`h-2 rounded-full transition-all ${getProgressColor(minutesProgress)}`}
                    style={{ width: `${minutesProgress}%` }}
                  />
                </div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-600">
                  {Math.round(totalMinutes / Math.max(completedWorkouts, 1))}
                </div>
                <div className="text-sm text-[#6b7688]">avg minutes/workout</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-orange-600">
                  {currentWeekWorkouts.reduce((sum, w) => sum + (w.calories || 0), 0)}
                </div>
                <div className="text-sm text-[#6b7688]">calories burned</div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Achievements Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Trophy className="h-5 w-5" />
              Achievements
            </CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowAchievements(!showAchievements)}
            >
              {showAchievements ? 'Hide' : 'Show'} All
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {achievements
              .filter(achievement => showAchievements || achievement.unlocked)
              .map(achievement => {
                const Icon = achievement.icon
                return (
                  <div
                    key={achievement.id}
                    className={`p-4 rounded-lg border-2 transition-all ${
                      achievement.unlocked
                        ? 'border-yellow-300 bg-yellow-50'
                        : 'border-[#dbd6cf] bg-[#faf8f5] opacity-60'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-full ${
                        achievement.unlocked ? 'bg-yellow-200' : 'bg-[#ebe5de]'
                      }`}>
                        <Icon className={`h-4 w-4 ${
                          achievement.unlocked ? 'text-yellow-600' : 'text-[#8e99a8]'
                        }`} />
                      </div>
                      <div>
                        <div className="font-medium text-sm">{achievement.name}</div>
                        <div className="text-xs text-[#6b7688]">{achievement.description}</div>
                        {achievement.unlocked && achievement.unlockedAt && (
                          <div className="text-xs text-yellow-600 mt-1">
                            Unlocked {new Date(achievement.unlockedAt).toLocaleDateString()}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
          </div>
        </CardContent>
      </Card>

      {/* Workout Templates Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5" />
              Workout Templates
            </CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowTemplates(!showTemplates)}
            >
              {showTemplates ? 'Hide' : 'Show'} Templates
            </Button>
          </div>
        </CardHeader>
        {showTemplates && (
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {WORKOUT_TEMPLATES.map(template => (
                <div
                  key={template.id}
                  className="p-4 border rounded-lg hover:bg-[#faf8f5] cursor-pointer transition-colors"
                  onClick={() => handleTemplateWorkout(template)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="font-medium">{template.name}</div>
                      <div className="text-sm text-[#6b7688] mt-1">{template.description}</div>
                      <div className="flex items-center gap-4 mt-2 text-xs text-[#8e99a8]">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {template.duration} min
                        </span>
                        <Badge className={`text-xs ${
                          template.intensity === 'low' ? 'bg-green-100 text-green-800' :
                          template.intensity === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-red-100 text-red-800'
                        }`}>
                          {template.intensity}
                        </Badge>
                        <span>{template.type}</span>
                      </div>
                      {template.exercises && (
                        <div className="mt-2">
                          <div className="text-xs text-[#8e99a8] mb-1">Exercises:</div>
                          <div className="text-xs text-[#6b7688]">
                            {template.exercises.join(', ')}
                          </div>
                        </div>
                      )}
                    </div>
                    <Button size="sm" variant="outline">
                      Start
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        )}
      </Card>

      {/* Add Workout Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5" />
            Log Workout
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isAddingWorkout ? (
            <div className="space-y-4">
              <div>
                <div className="text-sm font-medium mb-2">Workout Type</div>
                <div className="flex flex-wrap gap-2">
                  {WORKOUT_TYPES.map(type => (
                    <Badge
                      key={type}
                      variant={newWorkout.type === type ? "default" : "outline"}
                      className="cursor-pointer"
                      onClick={() => setNewWorkout(prev => ({ ...prev, type }))}
                    >
                      {type}
                    </Badge>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-sm font-medium mb-2">Duration (minutes)</div>
                  <Input
                    type="number"
                    min="5"
                    max="300"
                    value={newWorkout.duration}
                    onChange={(e) => setNewWorkout(prev => ({ 
                      ...prev, 
                      duration: parseInt(e.target.value) || 30 
                    }))}
                  />
                </div>
                <div>
                  <div className="text-sm font-medium mb-2">Calories (optional)</div>
                  <Input
                    type="number"
                    min="0"
                    value={newWorkout.calories}
                    onChange={(e) => setNewWorkout(prev => ({ 
                      ...prev, 
                      calories: e.target.value 
                    }))}
                    placeholder="e.g. 300"
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <Button onClick={handleAddWorkout} disabled={!newWorkout.type}>
                  <Check className="h-4 w-4 mr-2" />
                  Log Workout
                </Button>
                <Button variant="outline" onClick={() => setIsAddingWorkout(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2">
                {goals.preferredTypes.map(type => (
                  <Button
                    key={type}
                    variant="outline"
                    size="sm"
                    onClick={() => handleQuickWorkout(type)}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Quick {type}
                  </Button>
                ))}
              </div>
              <Button 
                variant="default" 
                onClick={() => setIsAddingWorkout(true)}
                className="w-full"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Detailed Workout
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Workouts */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Recent Workouts
          </CardTitle>
        </CardHeader>
        <CardContent>
          {workouts.length === 0 ? (
            <div className="text-center py-8 text-[#8e99a8]">
              <Activity className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No workouts logged yet</p>
              <p className="text-sm">Start by adding your first workout above!</p>
            </div>
          ) : (
            <div className="space-y-3">
              {workouts
                .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                .slice(0, 10)
                .map(workout => (
                  <div
                    key={workout.id}
                    className="flex items-center justify-between p-3 border rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <Check className="h-4 w-4 text-green-600" />
                      <div>
                        <div className="font-medium">{workout.type}</div>
                        <div className="text-sm text-[#6b7688] flex items-center gap-2">
                          <Clock className="h-3 w-3" />
                          {workout.duration} min
                          {workout.calories && (
                            <>
                              <Flame className="h-3 w-3" />
                              {workout.calories} cal
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="text-sm text-[#8e99a8]">
                      {new Date(workout.date).toLocaleDateString()}
                    </div>
                  </div>
                ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
