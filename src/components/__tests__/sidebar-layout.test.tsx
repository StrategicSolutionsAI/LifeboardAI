import React from 'react'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { SidebarLayout } from '../sidebar-layout'

let mockPathname = '/email'
const mockRouter = { push: jest.fn(), prefetch: jest.fn() }
jest.mock('next/navigation', () => ({ usePathname: () => mockPathname, useRouter: () => mockRouter }))
jest.mock('@/utils/supabase/client', () => ({ supabase: { auth: { signOut: jest.fn() } } }))
jest.mock('@/lib/auth-cleanup', () => ({ clearAllUserCaches: jest.fn() }))
jest.mock('@/lib/prefetch-calendar', () => ({ prefetchCalendarExperience: jest.fn() }))
jest.mock('@/lib/prefetch-dashboard', () => ({ prefetchDashboardExperience: jest.fn() }))
jest.mock('@/lib/prefetch-notes', () => ({ prefetchNotes: jest.fn() }))
jest.mock('@/lib/prefetch-tasks', () => ({ prefetchAllTasks: jest.fn(), prefetchTasksExperience: jest.fn() }))
jest.mock('@/lib/prefetch-user-prefs', () => ({ prefetchUserPreferences: jest.fn(), prefetchGreetingName: jest.fn() }))

beforeEach(() => {
  mockPathname = '/email'
  global.fetch = jest.fn().mockResolvedValue({ json: async () => ({ unreadCount: 0, connected: false }) })
})

it('identifies secondary routes in More and in the navigation sheet', async () => {
  const { rerender } = render(<SidebarLayout><p>Page content</p></SidebarLayout>)
  const more = screen.getByRole('button', { name: 'More navigation options' })
  expect(more).toHaveAttribute('aria-current', 'true')
  fireEvent.click(more)
  const dialog = await screen.findByRole('dialog', { name: 'Navigation' })
  expect(within(dialog).getByRole('link', { name: 'Email' })).toHaveAttribute('aria-current', 'page')
  expect(within(dialog).getByRole('link', { name: 'Budget' })).not.toHaveAttribute('aria-current')
  // Bottom-bar destinations are not repeated inside the sheet.
  expect(within(dialog).queryByRole('link', { name: 'Tasks' })).not.toBeInTheDocument()
  fireEvent.click(within(dialog).getByRole('button', { name: 'Close' }))
  await waitFor(() => expect(more).toHaveFocus())
  mockPathname = '/tasks'
  rerender(<SidebarLayout><p>Tasks content</p></SidebarLayout>)
  expect(screen.getByRole('button', { name: 'More navigation options' })).not.toHaveAttribute('aria-current')
  expect(within(screen.getByRole('navigation', { name: 'Mobile navigation' })).getByRole('link', { name: 'Tasks' })).toHaveAttribute('aria-current', 'page')
})

it('keeps sign out in the account menu instead of the page title', async () => {
  render(<SidebarLayout><p>Page content</p></SidebarLayout>)
  expect(screen.queryByRole('button', { name: 'Sign out' })).not.toBeInTheDocument()
  fireEvent.pointerDown(screen.getByRole('button', { name: 'Account menu' }), { button: 0, ctrlKey: false })
  // Radix also supports a keyboard opening gesture without pointer-event shims.
  fireEvent.keyDown(screen.getByRole('button', { name: 'Account menu' }), { key: 'Enter' })
  expect(await screen.findByRole('menuitem', { name: 'Sign out' })).toBeInTheDocument()
})
