"use client"

import { useState } from 'react'
import { Pill, CheckCircle, AlertTriangle, XCircle, Clock } from 'lucide-react'
import { RefinedWidgetBase } from './refined-widget-base'
import { cn } from '@/lib/utils'

interface Medication {
  id: string
  name: string
  dosage: string
  nextDose?: string
  status: 'taken' | 'upcoming' | 'missed' | 'skipped'
}

interface RefinedMedicationWidgetProps {
  className?: string
  onClick?: () => void
  compact?: boolean
}

export function RefinedMedicationWidget({ 
  className, 
  onClick, 
  compact = false 
}: RefinedMedicationWidgetProps) {
  // Mock data - in real app this would come from props/hooks
  const [medications] = useState<Medication[]>([
    {
      id: "1",
      name: "Lisinopril",
      dosage: "10mg",
      nextDose: "8:00 AM",
      status: "taken"
    },
    {
      id: "2", 
      name: "Metformin",
      dosage: "500mg",
      nextDose: "8:00 PM",
      status: "upcoming"
    },
    {
      id: "3",
      name: "Vitamin D",
      dosage: "1000 IU",
      nextDose: "12:00 PM",
      status: "missed"
    }
  ])

  // Calculate adherence
  const takenCount = medications.filter(m => m.status === 'taken').length
  const totalScheduled = medications.length
  const adherencePercentage = totalScheduled > 0 ? Math.round((takenCount / totalScheduled) * 100) : 0

  // Determine next medication
  const upcomingMeds = medications.filter(m => m.status === 'upcoming')
  const nextMed = upcomingMeds[0]

  // Determine status badge
  const getStatusBadge = () => {
    if (adherencePercentage >= 90) return { text: 'Excellent', variant: 'success' as const }
    if (adherencePercentage >= 70) return { text: 'Good', variant: 'info' as const }
    if (adherencePercentage >= 50) return { text: 'Fair', variant: 'warning' as const }
    return { text: 'Poor', variant: 'danger' as const }
  }

  // Progress color based on adherence
  const getProgressColor = () => {
    if (adherencePercentage >= 90) return 'high'
    if (adherencePercentage >= 70) return 'medium'
    if (adherencePercentage >= 50) return 'low'
    return 'low'
  }

  // Get status icon for individual medications
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'taken': return <CheckCircle className="w-3 h-3 text-green-600" />
      case 'upcoming': return <Clock className="w-3 h-3 text-blue-600" />
      case 'missed': return <XCircle className="w-3 h-3 text-red-600" />
      case 'skipped': return <AlertTriangle className="w-3 h-3 text-yellow-600" />
      default: return <Clock className="w-3 h-3 text-gray-400" />
    }
  }

  return (
    <RefinedWidgetBase
      title="Medication Tracker"
      icon={Pill}
      iconColor="indigo"
      primaryValue={`${takenCount}/${totalScheduled}`}
      primaryUnit="taken today"
      secondaryLabel="Adherence Rate"
      secondaryValue={`${adherencePercentage}%`}
      progress={adherencePercentage}
      progressColor={getProgressColor()}
      statusBadge={getStatusBadge()}
      onClick={onClick}
      className={className}
      size={compact ? "compact" : "normal"}
      variant="detailed"
    >
      {/* Next dose reminder */}
      {nextMed && (
        <div className="p-2 bg-blue-50 rounded-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="w-3 h-3 text-blue-600" />
              <span className="text-xs font-medium text-blue-800">Next Dose</span>
            </div>
            <span className="text-xs text-blue-600 font-semibold">{nextMed.nextDose}</span>
          </div>
          <div className="text-xs text-blue-700 mt-1">
            {nextMed.name} {nextMed.dosage}
          </div>
        </div>
      )}

      {/* Medication list */}
      <div className="space-y-2">
        <span className="text-xs font-semibold uppercase tracking-widest text-gray-600">
          Today's Schedule
        </span>
        {medications.slice(0, 3).map((med) => (
          <div key={med.id} className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              {getStatusIcon(med.status)}
              <span className="font-medium text-gray-700">
                {med.name}
              </span>
              <span className="text-gray-500">
                {med.dosage}
              </span>
            </div>
            <span className={cn(
              'text-xs font-medium',
              med.status === 'taken' && 'text-green-600',
              med.status === 'upcoming' && 'text-blue-600',
              med.status === 'missed' && 'text-red-600',
              med.status === 'skipped' && 'text-yellow-600'
            )}>
              {med.nextDose}
            </span>
          </div>
        ))}
        {medications.length > 3 && (
          <div className="text-xs text-gray-500 pt-1">
            +{medications.length - 3} more medication{medications.length - 3 !== 1 ? 's' : ''}
          </div>
        )}
      </div>
    </RefinedWidgetBase>
  )
}