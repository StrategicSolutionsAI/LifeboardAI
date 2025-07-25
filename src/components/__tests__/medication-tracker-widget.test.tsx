import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { MedicationTrackerWidget } from '../medication-tracker-widget'

// Mock Supabase client
jest.mock('@/utils/supabase/client', () => ({
  supabase: {
    auth: {
      getSession: jest.fn(),
      getUser: jest.fn(),
      signOut: jest.fn(),
    },
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => Promise.resolve({ data: [], error: null })),
      })),
    })),
  },
}))

describe('MedicationTrackerWidget', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('renders without crashing', () => {
    render(<MedicationTrackerWidget />)
    expect(screen.getByText('Medication Tracker')).toBeInTheDocument()
  })

  it('displays default medications', () => {
    render(<MedicationTrackerWidget />)
    expect(screen.getByText('Lisinopril')).toBeInTheDocument()
    expect(screen.getByText('Metformin')).toBeInTheDocument()
  })

  it('shows medication dosages', () => {
    render(<MedicationTrackerWidget />)
    expect(screen.getByText('10mg')).toBeInTheDocument()
    expect(screen.getByText('500mg')).toBeInTheDocument()
  })

  it('displays adherence percentage', () => {
    render(<MedicationTrackerWidget />)
    // Should show today's adherence percentage
    expect(screen.getByText(/\d+%/)).toBeInTheDocument()
  })

  it('shows add medication button', () => {
    render(<MedicationTrackerWidget />)
    expect(screen.getByRole('button', { name: /add medication/i })).toBeInTheDocument()
  })

  it('opens add medication sheet when button is clicked', () => {
    render(<MedicationTrackerWidget />)
    const addButton = screen.getByRole('button', { name: /add medication/i })
    fireEvent.click(addButton)
    expect(screen.getByText('Add New Medication')).toBeInTheDocument()
  })

  it('renders in compact mode', () => {
    render(<MedicationTrackerWidget compact={true} />)
    expect(screen.getByText('MEDICATION')).toBeInTheDocument()
  })

  it('applies custom className', () => {
    const { container } = render(<MedicationTrackerWidget className="custom-class" />)
    expect(container.firstChild).toHaveClass('custom-class')
  })
})