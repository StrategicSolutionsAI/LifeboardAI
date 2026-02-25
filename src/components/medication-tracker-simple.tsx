"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { 
  Pill, 
  Plus, 
  Clock, 
  AlertTriangle, 
  CheckCircle, 
  XCircle, 
  Edit,
  Trash2
} from "lucide-react"
import { cn } from "@/lib/utils"

interface Medication {
  id: string
  name: string
  dosage: string
  frequency: string
  pillsRemaining?: number
  totalPills?: number
  color: string
  nextDose?: string
  takenToday?: boolean
}

interface MedicationTrackerWidgetProps {
  className?: string
  compact?: boolean
}

export function MedicationTrackerWidget({ className, compact = false }: MedicationTrackerWidgetProps) {
  const [medications, setMedications] = useState<Medication[]>([])

  const [isAddMedicationOpen, setIsAddMedicationOpen] = useState(false)
  const [newMedication, setNewMedication] = useState({
    name: '',
    dosage: '',
    frequency: 'Once daily',
    pillsRemaining: '',
    totalPills: ''
  })

  // Calculate today's adherence
  const totalMedications = medications.length
  const takenToday = medications.filter(med => med.takenToday).length
  const adherencePercentage = totalMedications > 0 ? Math.round((takenToday / totalMedications) * 100) : 100

  // Get medications needing refills (less than 7 days supply)
  const refillNeeded = medications.filter(med => {
    if (!med.pillsRemaining || !med.totalPills) return false
    const daysRemaining = med.pillsRemaining / 1 // Assuming 1 pill per day for simplicity
    return daysRemaining <= 7
  })

  const markDoseTaken = (medicationId: string) => {
    setMedications(prev => prev.map(med => 
      med.id === medicationId ? { ...med, takenToday: true } : med
    ))
  }

  const addMedication = () => {
    if (!newMedication.name || !newMedication.dosage) return

    const medication: Medication = {
      id: Date.now().toString(),
      name: newMedication.name,
      dosage: newMedication.dosage,
      frequency: newMedication.frequency,
      pillsRemaining: newMedication.pillsRemaining ? parseInt(newMedication.pillsRemaining) : undefined,
      totalPills: newMedication.totalPills ? parseInt(newMedication.totalPills) : undefined,
      color: "blue",
      nextDose: "8:00 AM",
      takenToday: false
    }

    setMedications(prev => [...prev, medication])
    setNewMedication({
      name: '',
      dosage: '',
      frequency: 'Once daily',
      pillsRemaining: '',
      totalPills: ''
    })
    setIsAddMedicationOpen(false)
  }

  const deleteMedication = (medicationId: string) => {
    setMedications(prev => prev.filter(med => med.id !== medicationId))
  }

  if (compact) {
    return (
      <Card className={cn("p-4", className)}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-fuchsia-100 rounded-lg flex items-center justify-center">
              <Pill className="w-4 h-4 text-fuchsia-600" />
            </div>
            <div>
              <p className="text-xs font-medium text-[#8e99a8]">MEDICATION</p>
              <p className="text-sm font-semibold text-[#314158]">
                {medications.length > 0 ? `${adherencePercentage}% Today` : 'Tracker'}
              </p>
            </div>
          </div>
          {refillNeeded.length > 0 && (
            <Badge variant="outline" className="text-orange-600 border-orange-200">
              {refillNeeded.length} Refill{refillNeeded.length > 1 ? 's' : ''}
            </Badge>
          )}
        </div>
        
        {medications.length > 0 ? (
          <div className="space-y-2">
            <p className="text-xs text-[#8e99a8]">Today's medications:</p>
            {medications.slice(0, 2).map((med) => (
              <div key={med.id} className="flex items-center justify-between text-xs">
                <span className="text-[#4a5568]">{med.name}</span>
                <div className="flex items-center space-x-1">
                  {med.takenToday ? (
                    <CheckCircle className="w-3 h-3 text-green-500" />
                  ) : (
                    <XCircle className="w-3 h-3 text-[#8e99a8]" />
                  )}
                  <span className="text-[#8e99a8]">{med.nextDose}</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-2">
            <p className="text-xs text-[#8e99a8] mb-1">No medications added</p>
            <p className="text-xs text-[#8e99a8]">Click to add your first medication</p>
          </div>
        )}
      </Card>
    )
  }

  return (
    <div className={cn("space-y-6", className)}>
      {/* Header with Add Button */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Pill className="w-5 h-5 text-fuchsia-600" />
          <h2 className="text-lg font-semibold text-[#314158]">Medication Tracker</h2>
        </div>
        <Sheet open={isAddMedicationOpen} onOpenChange={setIsAddMedicationOpen}>
          <SheetTrigger asChild>
            <Button size="sm">
              <Plus className="w-4 h-4 mr-2" />
              Add Medication
            </Button>
          </SheetTrigger>
          <SheetContent>
            <SheetHeader>
              <SheetTitle>Add New Medication</SheetTitle>
              <SheetDescription>
                Add a new medication to track doses and refills
              </SheetDescription>
            </SheetHeader>
            <div className="space-y-4 mt-6">
              <div>
                <label className="text-sm font-medium text-[#4a5568]">Medication Name</label>
                <Input
                  value={newMedication.name}
                  onChange={(e) => setNewMedication(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g., Lisinopril"
                  className="mt-1"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-[#4a5568]">Dosage</label>
                <Input
                  value={newMedication.dosage}
                  onChange={(e) => setNewMedication(prev => ({ ...prev, dosage: e.target.value }))}
                  placeholder="e.g., 10mg"
                  className="mt-1"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-[#4a5568]">Frequency</label>
                <select 
                  value={newMedication.frequency}
                  onChange={(e) => setNewMedication(prev => ({ ...prev, frequency: e.target.value }))}
                  className="mt-1 w-full px-3 py-2 border border-[#dbd6cf] rounded-md focus:outline-none focus:ring-2 focus:ring-[#bb9e7b]"
                >
                  <option value="Once daily">Once daily</option>
                  <option value="Twice daily">Twice daily</option>
                  <option value="Three times daily">Three times daily</option>
                  <option value="As needed">As needed</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-[#4a5568]">Total Pills</label>
                  <Input
                    type="number"
                    value={newMedication.totalPills}
                    onChange={(e) => setNewMedication(prev => ({ ...prev, totalPills: e.target.value }))}
                    placeholder="30"
                    className="mt-1"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-[#4a5568]">Pills Remaining</label>
                  <Input
                    type="number"
                    value={newMedication.pillsRemaining}
                    onChange={(e) => setNewMedication(prev => ({ ...prev, pillsRemaining: e.target.value }))}
                    placeholder="15"
                    className="mt-1"
                  />
                </div>
              </div>
              <div className="flex space-x-3 pt-4">
                <Button onClick={addMedication} className="flex-1">
                  Add Medication
                </Button>
                <Button variant="outline" onClick={() => setIsAddMedicationOpen(false)} className="flex-1">
                  Cancel
                </Button>
              </div>
            </div>
          </SheetContent>
        </Sheet>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-[#8e99a8]">Today's Adherence</p>
              <p className="text-2xl font-bold text-[#314158]">{adherencePercentage}%</p>
            </div>
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
              adherencePercentage >= 90 ? 'bg-green-100' : 
              adherencePercentage >= 70 ? 'bg-yellow-100' : 'bg-red-100'
            }`}>
              {adherencePercentage >= 90 ? 
                <CheckCircle className="w-5 h-5 text-green-600" /> :
                adherencePercentage >= 70 ?
                <AlertTriangle className="w-5 h-5 text-yellow-600" /> :
                <XCircle className="w-5 h-5 text-red-600" />
              }
            </div>
          </div>
          <div className="mt-2 bg-[#ebe5de] rounded-full h-2">
            <div 
              className={`h-2 rounded-full ${
                adherencePercentage >= 90 ? 'bg-green-500' : 
                adherencePercentage >= 70 ? 'bg-yellow-500' : 'bg-red-500'
              }`}
              style={{ width: `${adherencePercentage}%` }}
            />
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-[#8e99a8]">Doses Taken</p>
              <p className="text-2xl font-bold text-[#314158]">
                {takenToday}/{totalMedications}
              </p>
            </div>
            <div className="w-10 h-10 bg-[#f5ede4] rounded-lg flex items-center justify-center">
              <Pill className="w-5 h-5 text-[#9a7b5a]" />
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-[#8e99a8]">Refills Needed</p>
              <p className="text-2xl font-bold text-[#314158]">{refillNeeded.length}</p>
            </div>
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
              refillNeeded.length === 0 ? 'bg-green-100' : 'bg-orange-100'
            }`}>
              <AlertTriangle className={`w-5 h-5 ${
                refillNeeded.length === 0 ? 'text-green-600' : 'text-orange-600'
              }`} />
            </div>
          </div>
        </Card>
      </div>

      {/* Today's Schedule */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Today's Schedule</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {medications.map((medication) => (
              <div key={medication.id} className="flex items-center justify-between p-3 bg-[#faf8f5] rounded-lg">
                <div className="flex items-center space-x-3">
                  <div className={`w-3 h-3 rounded-full ${
                    medication.takenToday ? 'bg-green-500' : 'bg-[#ebe5de]'
                  }`} />
                  <div>
                    <p className="font-medium text-[#314158]">{medication.name}</p>
                    <p className="text-sm text-[#8e99a8]">
                      {medication.dosage} • {medication.frequency}
                      {medication.nextDose && ` • Next: ${medication.nextDose}`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  {!medication.takenToday ? (
                    <Button 
                      size="sm" 
                      onClick={() => markDoseTaken(medication.id)}
                    >
                      Mark Taken
                    </Button>
                  ) : (
                    <Badge variant="outline" className="text-green-600 border-green-200">
                      Taken
                    </Badge>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => deleteMedication(medication.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
            {medications.length === 0 && (
              <div className="text-center py-8">
                <Pill className="w-12 h-12 text-[#8e99a8] mx-auto mb-4" />
                <h3 className="font-semibold text-[#314158] mb-2">No medications added</h3>
                <p className="text-[#8e99a8]">Add your first medication to start tracking</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Refills Needed */}
      {refillNeeded.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center space-x-2">
              <AlertTriangle className="w-5 h-5 text-orange-600" />
              <span>Refills Needed</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {refillNeeded.map((medication) => {
                const daysRemaining = medication.pillsRemaining! / 1 // Assuming 1 pill per day
                
                return (
                  <div key={medication.id} className="flex items-center justify-between p-3 border border-orange-200 rounded-lg">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                        <AlertTriangle className="w-5 h-5 text-orange-600" />
                      </div>
                      <div>
                        <h4 className="font-semibold text-[#314158]">{medication.name}</h4>
                        <p className="text-sm text-orange-600">
                          {Math.floor(daysRemaining)} days remaining ({medication.pillsRemaining} pills)
                        </p>
                      </div>
                    </div>
                    <Button size="sm" className="bg-orange-600 hover:bg-orange-700">
                      Order Refill
                    </Button>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
