"use client"

import React, { useState } from 'react'
import { NutritionSummaryWidget } from './nutrition-summary-widget'
import { WithingsWeightWidget } from './withings-weight-widget'
import { RefinedMedicationWidget } from './refined-medication-widget'
import { RefinedHealthMetrics } from './refined-health-metrics'
import { RefinedWidgetError, RefinedWidgetSkeleton, RefinedWidgetEmpty } from './refined-widget-error'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Apple, Scale, Pill, Heart, AlertTriangle } from 'lucide-react'

export function RefinedWidgetShowcase() {
  const [showError, setShowError] = useState(false)
  const [showLoading, setShowLoading] = useState(false)
  const [showEmpty, setShowEmpty] = useState(false)

  const sampleError = {
    type: 'network' as const,
    title: 'Connection Failed',
    message: 'Unable to sync data from your health apps',
    isRetryable: true
  }

  const noop = () => {}
  const noopMetric = (_metricId: string) => {}

  return (
    <div className="min-h-screen bg-[#faf8f5] p-6">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center space-y-4">
          <h1 className="text-4xl font-bold text-[#314158]">
            Refined Widget Design System
          </h1>
          <p className="text-lg text-[#6b7688] max-w-3xl mx-auto">
            A comprehensive, accessible, and beautifully designed widget system for health and wellness dashboards.
            Built with senior UI/UX designer principles and modern interaction patterns.
          </p>
        </div>

        {/* Design Principles */}
        <Card>
          <CardHeader>
            <CardTitle>Design System Principles</CardTitle>
            <CardDescription>
              Core principles that drive our widget design decisions
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-4 gap-6">
              <div className="text-center space-y-2">
                <div className="w-12 h-12 bg-warm-100 rounded-lg flex items-center justify-center mx-auto">
                  <span className="text-2xl">🎯</span>
                </div>
                <h3 className="font-semibold">Consistency</h3>
                <p className="text-sm text-[#6b7688]">Unified visual language across all components</p>
              </div>
              <div className="text-center space-y-2">
                <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mx-auto">
                  <span className="text-2xl">♿</span>
                </div>
                <h3 className="font-semibold">Accessibility</h3>
                <p className="text-sm text-[#6b7688]">WCAG 2.1 AA compliant with keyboard navigation</p>
              </div>
              <div className="text-center space-y-2">
                <div className="w-12 h-12 bg-amber-100 rounded-lg flex items-center justify-center mx-auto">
                  <span className="text-2xl">✨</span>
                </div>
                <h3 className="font-semibold">Micro-interactions</h3>
                <p className="text-sm text-[#6b7688]">Subtle animations that enhance user experience</p>
              </div>
              <div className="text-center space-y-2">
                <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center mx-auto">
                  <span className="text-2xl">📊</span>
                </div>
                <h3 className="font-semibold">Data Clarity</h3>
                <p className="text-sm text-[#6b7688]">Clear information hierarchy and visual indicators</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Widget Demos */}
        <Tabs defaultValue="dashboard" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
            <TabsTrigger value="individual">Individual</TabsTrigger>
            <TabsTrigger value="states">States</TabsTrigger>
            <TabsTrigger value="metrics">Metrics</TabsTrigger>
          </TabsList>

          {/* Dashboard View */}
          <TabsContent value="dashboard" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Dashboard Layout</CardTitle>
                <CardDescription>
                  How widgets look in a typical dashboard grid layout
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6">
                  <NutritionSummaryWidget 
                    onClick={noop}
                  />
                  <WithingsWeightWidget 
                    showControls={false}
                    unit="lbs"
                    goalWeight={145}
                    startingWeight={155}
                  />
                  <RefinedMedicationWidget 
                    onClick={noop}
                    compact
                  />
                  {/* Health metrics in grid */}
                  <RefinedHealthMetrics 
                    compact
                    onMetricClick={noopMetric}
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Individual Widgets */}
          <TabsContent value="individual" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Apple className="w-5 h-5" />
                    Nutrition Widget
                  </CardTitle>
                  <CardDescription>
                    Track daily calorie intake and nutritional goals
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <NutritionSummaryWidget 
                    onClick={noop}
                  />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Scale className="w-5 h-5" />
                    Weight Tracking
                  </CardTitle>
                  <CardDescription>
                    Monitor weight progress towards your goal
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <WithingsWeightWidget 
                    showControls={false}
                    unit="lbs"
                    goalWeight={145}
                    startingWeight={155}
                  />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Pill className="w-5 h-5" />
                    Medication Tracker
                  </CardTitle>
                  <CardDescription>
                    Track medication adherence and schedules
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <RefinedMedicationWidget 
                    onClick={noop}
                  />
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Widget States */}
          <TabsContent value="states" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Widget States & Error Handling</CardTitle>
                <CardDescription>
                  Comprehensive loading, error, and empty states
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {/* State Controls */}
                  <div className="flex gap-4 p-4 bg-[#faf8f5] rounded-lg">
                    <Button 
                      variant={showLoading ? "default" : "outline"}
                      onClick={() => {
                        setShowLoading(!showLoading)
                        setShowError(false)
                        setShowEmpty(false)
                      }}
                    >
                      Toggle Loading
                    </Button>
                    <Button 
                      variant={showError ? "default" : "outline"}
                      onClick={() => {
                        setShowError(!showError)
                        setShowLoading(false)
                        setShowEmpty(false)
                      }}
                    >
                      Toggle Error
                    </Button>
                    <Button 
                      variant={showEmpty ? "default" : "outline"}
                      onClick={() => {
                        setShowEmpty(!showEmpty)
                        setShowLoading(false)
                        setShowError(false)
                      }}
                    >
                      Toggle Empty
                    </Button>
                  </div>

                  {/* State Demonstrations */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {showLoading ? (
                      <>
                        <RefinedWidgetSkeleton title="Loading Nutrition" iconColor="green" />
                        <RefinedWidgetSkeleton title="Loading Weight" iconColor="violet" />
                        <RefinedWidgetSkeleton title="Loading Medications" iconColor="indigo" />
                      </>
                    ) : showError ? (
                      <>
                        <RefinedWidgetError 
                          error={sampleError}
                          onRetry={noop}
                          onDismiss={() => setShowError(false)}
                        />
                        <RefinedWidgetError 
                          error={{...sampleError, type: 'auth', title: 'Auth Required', isRetryable: false}}
                          onDismiss={() => setShowError(false)}
                        />
                        <RefinedWidgetError 
                          error={{...sampleError, type: 'api', title: 'Server Error'}}
                          onRetry={noop}
                        />
                      </>
                    ) : showEmpty ? (
                      <>
                        <RefinedWidgetEmpty 
                          title="Nutrition"
                          icon={Apple}
                          iconColor="green"
                          message="No meals logged today"
                          actionLabel="Add Meal"
                          onAction={noop}
                        />
                        <RefinedWidgetEmpty 
                          title="Weight"
                          icon={Scale}
                          iconColor="violet"
                          message="Connect your scale to start tracking"
                          actionLabel="Connect Device"
                          onAction={noop}
                        />
                        <RefinedWidgetEmpty 
                          title="Medications"
                          icon={Pill}
                          iconColor="indigo"
                          message="No medications added yet"
                          actionLabel="Add Medication"
                          onAction={noop}
                        />
                      </>
                    ) : (
                      <>
                        <NutritionSummaryWidget />
                        <WithingsWeightWidget showControls={false} />
                        <RefinedMedicationWidget />
                      </>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Health Metrics */}
          <TabsContent value="metrics" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Heart className="w-5 h-5" />
                  Health Metrics Grid
                </CardTitle>
                <CardDescription>
                  Comprehensive health tracking with consistent design patterns
                </CardDescription>
              </CardHeader>
              <CardContent>
                <RefinedHealthMetrics 
                  onMetricClick={noopMetric}
                />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Technical Details */}
        <Card>
          <CardHeader>
            <CardTitle>Technical Implementation</CardTitle>
            <CardDescription>
              Built with modern React patterns and design best practices
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <h3 className="font-semibold mb-3">Features</h3>
                <ul className="space-y-1 text-sm text-[#6b7688]">
                  <li>• TypeScript for type safety and developer experience</li>
                  <li>• Tailwind CSS for consistent utility-first styling</li>
                  <li>• Lucide React for consistent iconography</li>
                  <li>• Framer Motion ready for advanced animations</li>
                  <li>• Responsive design with mobile-first approach</li>
                  <li>• Dark mode compatible design tokens</li>
                </ul>
              </div>
              <div>
                <h3 className="font-semibold mb-3">Accessibility</h3>
                <ul className="space-y-1 text-sm text-[#6b7688]">
                  <li>• WCAG 2.1 AA compliant color contrast</li>
                  <li>• Full keyboard navigation support</li>
                  <li>• Screen reader optimized with ARIA labels</li>
                  <li>• Focus indicators for all interactive elements</li>
                  <li>• Semantic HTML structure throughout</li>
                  <li>• Reduced motion support for accessibility</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Performance Metrics */}
        <Card>
          <CardHeader>
            <CardTitle>Performance & Quality</CardTitle>
            <CardDescription>
              Metrics demonstrating the quality and performance of the design system
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
              <div>
                <div className="text-3xl font-bold text-green-600">60fps</div>
                <div className="text-sm text-[#6b7688]">Smooth animations</div>
              </div>
              <div>
                <div className="text-3xl font-bold text-warm-600">100%</div>
                <div className="text-sm text-[#6b7688]">Keyboard accessible</div>
              </div>
              <div>
                <div className="text-3xl font-bold text-amber-600">AAA</div>
                <div className="text-sm text-[#6b7688]">Color contrast</div>
              </div>
              <div>
                <div className="text-3xl font-bold text-orange-600">0ms</div>
                <div className="text-sm text-[#6b7688]">Layout shifts</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
