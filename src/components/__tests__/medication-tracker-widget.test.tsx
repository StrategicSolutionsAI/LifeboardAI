import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { MedicationTrackerWidget } from '@/features/widgets/components/medication-tracker-simple'

// This suite used to import medication-tracker-widget.tsx — a prototype that
// nothing rendered. The widget registry binds `medication` to
// medication-tracker-simple, so the old tests passed against dead code while
// the shipped component had no coverage at all. They now run against the real
// one, which starts with an empty medication list (the prototype seeded mock
// Lisinopril/Metformin rows, so those assertions are gone).

describe('MedicationTrackerWidget (the one the registry renders)', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('renders without crashing', () => {
    render(<MedicationTrackerWidget />)
    expect(screen.getByText('Medication Tracker')).toBeInTheDocument()
  })

  it('starts with no medications', () => {
    render(<MedicationTrackerWidget />)
    expect(screen.queryByText('Lisinopril')).not.toBeInTheDocument()
  })

  it('reports 100% adherence when nothing is due', () => {
    render(<MedicationTrackerWidget />)
    expect(screen.getByText('100%')).toBeInTheDocument()
  })

  it('shows add medication button', () => {
    render(<MedicationTrackerWidget />)
    expect(
      screen.getAllByRole('button', { name: /add medication/i }).length
    ).toBeGreaterThan(0)
  })

  it('opens add medication sheet when button is clicked', () => {
    render(<MedicationTrackerWidget />)
    fireEvent.click(
      screen.getAllByRole('button', { name: /add medication/i })[0]
    )
    expect(screen.getByText('Add New Medication')).toBeInTheDocument()
  })

  it('renders in compact mode', () => {
    render(<MedicationTrackerWidget compact={true} />)
    expect(screen.getByText('MEDICATION')).toBeInTheDocument()
  })

  it('applies custom className', () => {
    const { container } = render(
      <MedicationTrackerWidget className="custom-class" />
    )
    expect(container.firstChild).toHaveClass('custom-class')
  })
})
