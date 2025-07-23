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
}

interface MedicationTrackerWidgetProps {
  className?: string
  compact?: boolean
}

export function MedicationTrackerWidget({ className, showControls = true, compact = false }: MedicationTrackerWidgetProps) {
  const [medications, setMedications] = useState<Medication[]>([
    {
      id: "1",
      name: "Lisinopril",
      dosage: "10mg",
      frequency: "Once daily",
      times: ["08:00"],
      startDate: "2024-01-01",
      refillDate: "2024-02-15",
      pillsRemaining: 15,
      totalPills: 30,
      instructions: "Take with food",
      color: "blue",
      isActive: true
    },
    {
      id: "2", 
      name: "Metformin",
      dosage: "500mg",
      frequency: "Twice daily",
      times: ["08:00", "20:00"],
      startDate: "2024-01-01",
      refillDate: "2024-02-10",
      pillsRemaining: 8,
      totalPills: 60,
      instructions: "Take with meals",
      color: "green",
      isActive: true
    }
  ])

  const [doseLogs, setDoseLogs] = useState<DoseLog[]>([])
  const [isAddMedicationOpen, setIsAddMedicationOpen] = useState(false)
  const [selectedMedication, setSelectedMedication] = useState<Medication | null>(null)

  // Get today's date string
  const today = new Date().toISOString().split('T')[0]
  const currentTime = new Date()

  // Calculate today's adherence
  const todaysScheduledDoses = medications.flatMap(med => 
    med.times.map(time => ({
      medicationId: med.id,
      medicationName: med.name,
      scheduledTime: `${today}T${time}:00`,
      time: time
    }))
  )

  const todaysTakenDoses = doseLogs.filter(log => 
    log.scheduledTime.startsWith(today) && log.status === 'taken'
  ).length

  const adherencePercentage = todaysScheduledDoses.length > 0 
    ? Math.round((todaysTakenDoses / todaysScheduledDoses.length) * 100)
    : 100

  // Get upcoming doses (next 4 hours)
  const upcomingDoses = todaysScheduledDoses.filter(dose => {
    const doseTime = new Date(`${today}T${dose.time}:00`)
    const timeDiff = doseTime.getTime() - currentTime.getTime()
    return timeDiff > 0 && timeDiff <= 4 * 60 * 60 * 1000 // Next 4 hours
  }).slice(0, 3)

  // Get medications needing refills (less than 7 days supply)
  const refillNeeded = medications.filter(med => {
    if (!med.pillsRemaining || !med.totalPills) return false
    const dailyDoses = med.times.length
    const daysRemaining = med.pillsRemaining / dailyDoses
    return daysRemaining <= 7
  })

  const markDoseTaken = (medicationId: string, scheduledTime: string) => {
    const newLog: DoseLog = {
      id: Date.now().toString(),
      medicationId,
      scheduledTime,
      takenTime: new Date().toISOString(),
      status: 'taken'
    }
    setDoseLogs(prev => [...prev, newLog])
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
              <p className="text-xs font-medium text-gray-500">MEDICATION</p>
              <p className="text-sm font-semibold text-gray-900">{adherencePercentage}% Today</p>
            </div>
          </div>
          {refillNeeded.length > 0 && (
            <Badge variant="outline" className="text-orange-600 border-orange-200">
              {refillNeeded.length} Refill{refillNeeded.length > 1 ? 's' : ''}
            </Badge>
          )}
        </div>
        
        {upcomingDoses.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs text-gray-500">Next doses:</p>
            {upcomingDoses.map((dose, idx) => (
              <div key={idx} className="flex items-center justify-between text-xs">
                <span className="text-gray-700">{dose.medicationName}</span>
                <span className="text-gray-500">{dose.time}</span>
              </div>
            ))}
          </div>
        )}
      </Card>
    )
  }

  return (
    <Card className={cn("w-full max-w-4xl", className)}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center space-x-2">
            <Pill className="w-5 h-5 text-fuchsia-600" />
            <span>Medication Tracker</span>
          </CardTitle>
          <Dialog open={isAddMedicationOpen} onOpenChange={setIsAddMedicationOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="w-4 h-4 mr-2" />
                Add Medication
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Add New Medication</DialogTitle>
                <DialogDescription>
                  Add a new medication to track doses and refills
                </DialogDescription>
              </DialogHeader>
              <AddMedicationForm 
                onSave={(med) => {
                  setMedications(prev => [...prev, { ...med, id: Date.now().toString() }])
                  setIsAddMedicationOpen(false)
                }}
                onCancel={() => setIsAddMedicationOpen(false)}
              />
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>

      <CardContent>
        <Tabs defaultValue="today" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="today">Today</TabsTrigger>
            <TabsTrigger value="medications">Medications</TabsTrigger>
            <TabsTrigger value="refills">Refills</TabsTrigger>
            <TabsTrigger value="history">History</TabsTrigger>
          </TabsList>

          <TabsContent value="today" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500">Today's Adherence</p>
                    <p className="text-2xl font-bold text-gray-900">{adherencePercentage}%</p>
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
                <Progress value={adherencePercentage} className="mt-2" />
              </Card>

              <Card className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500">Doses Taken</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {todaysTakenDoses}/{todaysScheduledDoses.length}
                    </p>
                  </div>
                  <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                    <Pill className="w-5 h-5 text-blue-600" />
                  </div>
                </div>
              </Card>

              <Card className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500">Refills Needed</p>
                    <p className="text-2xl font-bold text-gray-900">{refillNeeded.length}</p>
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

            <div className="space-y-4">
              <h3 className="font-semibold text-gray-900">Today's Schedule</h3>
              <div className="space-y-2">
                {todaysScheduledDoses.map((dose, idx) => {
                  const isTaken = doseLogs.some(log => 
                    log.medicationId === dose.medicationId && 
                    log.scheduledTime === dose.scheduledTime &&
                    log.status === 'taken'
                  )
                  const medication = medications.find(m => m.id === dose.medicationId)
                  
                  return (
                    <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center space-x-3">
                        <div className={`w-3 h-3 rounded-full ${
                          isTaken ? 'bg-green-500' : 'bg-gray-300'
                        }`} />
                        <div>
                          <p className="font-medium text-gray-900">{dose.medicationName}</p>
                          <p className="text-sm text-gray-500">{medication?.dosage} at {dose.time}</p>
                        </div>
                      </div>
                      {!isTaken && (
                        <Button 
                          size="sm" 
                          onClick={() => markDoseTaken(dose.medicationId, dose.scheduledTime)}
                        >
                          Mark Taken
                        </Button>
                      )}
                      {isTaken && (
                        <Badge variant="outline" className="text-green-600 border-green-200">
                          Taken
                        </Badge>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="medications" className="space-y-4">
            <div className="grid gap-4">
              {medications.filter(med => med.isActive).map((medication) => (
                <Card key={medication.id} className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start space-x-3">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center bg-${medication.color}-100`}>
                        <Pill className={`w-5 h-5 text-${medication.color}-600`} />
                      </div>
                      <div>
                        <h4 className="font-semibold text-gray-900">{medication.name}</h4>
                        <p className="text-sm text-gray-500">{medication.dosage} • {medication.frequency}</p>
                        <div className="flex items-center space-x-4 mt-2">
                          <div className="flex items-center space-x-1">
                            <Clock className="w-4 h-4 text-gray-400" />
                            <span className="text-sm text-gray-600">
                              {medication.times.join(', ')}
                            </span>
                          </div>
                          {medication.pillsRemaining && (
                            <div className="flex items-center space-x-1">
                              <Pill className="w-4 h-4 text-gray-400" />
                              <span className="text-sm text-gray-600">
                                {medication.pillsRemaining} pills left
                              </span>
                            </div>
                          )}
                        </div>
                        {medication.instructions && (
                          <p className="text-sm text-gray-500 mt-1">{medication.instructions}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Button variant="ghost" size="sm">
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="sm">
                        <Settings className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="refills" className="space-y-4">
            {refillNeeded.length === 0 ? (
              <div className="text-center py-8">
                <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
                <h3 className="font-semibold text-gray-900 mb-2">All medications well-stocked</h3>
                <p className="text-gray-500">No refills needed at this time</p>
              </div>
            ) : (
              <div className="space-y-4">
                {refillNeeded.map((medication) => {
                  const dailyDoses = medication.times.length
                  const daysRemaining = medication.pillsRemaining! / dailyDoses
                  
                  return (
                    <Card key={medication.id} className="p-4 border-orange-200">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                            <AlertTriangle className="w-5 h-5 text-orange-600" />
                          </div>
                          <div>
                            <h4 className="font-semibold text-gray-900">{medication.name}</h4>
                            <p className="text-sm text-orange-600">
                              {Math.floor(daysRemaining)} days remaining ({medication.pillsRemaining} pills)
                            </p>
                            {medication.refillDate && (
                              <p className="text-sm text-gray-500">
                                Refill due: {new Date(medication.refillDate).toLocaleDateString()}
                              </p>
                            )}
                          </div>
                        </div>
                        <Button size="sm" className="bg-orange-600 hover:bg-orange-700">
                          Order Refill
                        </Button>
                      </div>
                    </Card>
                  )
                })}
              </div>
            )}
          </TabsContent>

          <TabsContent value="history" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card className="p-4">
                <h4 className="font-semibold text-gray-900 mb-3">7-Day Adherence</h4>
                <div className="space-y-2">
                  {Array.from({ length: 7 }, (_, i) => {
                    const date = new Date()
                    date.setDate(date.getDate() - i)
                    const dateStr = date.toISOString().split('T')[0]
                    const dayName = date.toLocaleDateString('en-US', { weekday: 'short' })
                    
                    // Mock adherence data
                    const adherence = Math.floor(Math.random() * 30) + 70
                    
                    return (
                      <div key={i} className="flex items-center justify-between">
                        <span className="text-sm text-gray-600">{dayName}</span>
                        <div className="flex items-center space-x-2">
                          <div className="w-16 bg-gray-200 rounded-full h-2">
                            <div 
                              className={`h-2 rounded-full ${
                                adherence >= 90 ? 'bg-green-500' : 
                                adherence >= 70 ? 'bg-yellow-500' : 'bg-red-500'
                              }`}
                              style={{ width: `${adherence}%` }}
                            />
                          </div>
                          <span className="text-sm font-medium text-gray-900 w-10">
                            {adherence}%
                          </span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </Card>

              <Card className="p-4">
                <h4 className="font-semibold text-gray-900 mb-3">Recent Activity</h4>
                <div className="space-y-3">
                  {doseLogs.slice(-5).reverse().map((log) => {
                    const medication = medications.find(m => m.id === log.medicationId)
                    const time = new Date(log.takenTime || log.scheduledTime)
                    
                    return (
                      <div key={log.id} className="flex items-center space-x-3">
                        <div className={`w-2 h-2 rounded-full ${
                          log.status === 'taken' ? 'bg-green-500' : 'bg-red-500'
                        }`} />
                        <div className="flex-1">
                          <p className="text-sm text-gray-900">{medication?.name}</p>
                          <p className="text-xs text-gray-500">
                            {time.toLocaleString()}
                          </p>
                        </div>
                        <Badge variant={log.status === 'taken' ? 'default' : 'destructive'}>
                          {log.status}
                        </Badge>
                      </div>
                    )
                  })}
                </div>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}

function AddMedicationForm({ onSave, onCancel }: { 
  onSave: (medication: Omit<Medication, 'id'>) => void
  onCancel: () => void 
}) {
  const [formData, setFormData] = useState({
    name: '',
    dosage: '',
    frequency: 'Once daily',
    times: ['08:00'],
    startDate: new Date().toISOString().split('T')[0],
    instructions: '',
    color: 'blue',
    totalPills: '',
    pillsRemaining: ''
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSave({
      ...formData,
      isActive: true,
      totalPills: formData.totalPills ? parseInt(formData.totalPills) : undefined,
      pillsRemaining: formData.pillsRemaining ? parseInt(formData.pillsRemaining) : undefined
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label htmlFor="name">Medication Name</Label>
        <Input
          id="name"
          value={formData.name}
          onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
          required
        />
      </div>

      <div>
        <Label htmlFor="dosage">Dosage</Label>
        <Input
          id="dosage"
          placeholder="e.g., 10mg, 1 tablet"
          value={formData.dosage}
          onChange={(e) => setFormData(prev => ({ ...prev, dosage: e.target.value }))}
          required
        />
      </div>

      <div>
        <Label htmlFor="frequency">Frequency</Label>
        <Select value={formData.frequency} onValueChange={(value) => 
          setFormData(prev => ({ ...prev, frequency: value }))
        }>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="Once daily">Once daily</SelectItem>
            <SelectItem value="Twice daily">Twice daily</SelectItem>
            <SelectItem value="Three times daily">Three times daily</SelectItem>
            <SelectItem value="Four times daily">Four times daily</SelectItem>
            <SelectItem value="As needed">As needed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="totalPills">Total Pills</Label>
          <Input
            id="totalPills"
            type="number"
            value={formData.totalPills}
            onChange={(e) => setFormData(prev => ({ ...prev, totalPills: e.target.value }))}
          />
        </div>
        <div>
          <Label htmlFor="pillsRemaining">Pills Remaining</Label>
          <Input
            id="pillsRemaining"
            type="number"
            value={formData.pillsRemaining}
            onChange={(e) => setFormData(prev => ({ ...prev, pillsRemaining: e.target.value }))}
          />
        </div>
      </div>

      <div>
        <Label htmlFor="instructions">Instructions (Optional)</Label>
        <Textarea
          id="instructions"
          placeholder="e.g., Take with food"
          value={formData.instructions}
          onChange={(e) => setFormData(prev => ({ ...prev, instructions: e.target.value }))}
        />
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit">Add Medication</Button>
      </DialogFooter>
    </form>
  )
}
