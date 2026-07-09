import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import OnboardingStep1 from '../page'

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn() }),
}))

describe('OnboardingStep1 bucket chips', () => {
  // Regression: selected chips used `bg-theme-primary bg-opacity-10`, which
  // renders a solid brand background (opacity utilities don't apply to
  // CSS-variable hex colors) and made the label invisible.
  it('marks a selected chip with the readable brand-tint classes', () => {
    render(<OnboardingStep1 />)

    const chip = screen.getByRole('button', { name: 'Health' })
    fireEvent.click(chip)

    expect(chip.className).toContain('bg-theme-brand-tint')
    expect(chip.className).toContain('ring-theme-primary')
    expect(chip.className).not.toContain('bg-opacity')
  })

  it('returns a chip to the unselected style when toggled off', () => {
    render(<OnboardingStep1 />)

    const chip = screen.getByRole('button', { name: 'Work' })
    fireEvent.click(chip)
    fireEvent.click(chip)

    expect(chip.className).not.toContain('bg-theme-brand-tint')
  })
})
