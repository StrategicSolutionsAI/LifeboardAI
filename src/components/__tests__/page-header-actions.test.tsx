import React, { useState } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { PageHeaderActions, PageHeaderActionsProvider } from '../page-header-actions'

function PageAction() {
  const [count, setCount] = useState(0)
  return <PageHeaderActions><button onClick={() => setCount(count + 1)}>Add {count}</button></PageHeaderActions>
}

it('keeps page-owned action state in the header and removes it when the page leaves', () => {
  const target = document.createElement('div')
  document.body.appendChild(target)
  const { rerender, unmount } = render(<PageHeaderActionsProvider target={target}><PageAction /></PageHeaderActionsProvider>)
  expect(target).toContainElement(screen.getByRole('button', { name: 'Add 0' }))
  fireEvent.click(screen.getByRole('button', { name: 'Add 0' }))
  expect(target).toContainElement(screen.getByRole('button', { name: 'Add 1' }))
  rerender(<PageHeaderActionsProvider target={target}><p>Next page</p></PageHeaderActionsProvider>)
  expect(target).toBeEmptyDOMElement()
  expect(screen.queryByRole('button', { name: /Add/ })).not.toBeInTheDocument()
  unmount()
  target.remove()
})

it('exposes actions when a page is rendered outside the application shell', () => {
  render(<PageAction />)
  fireEvent.click(screen.getByRole('button', { name: 'Add 0' }))
  expect(screen.getByRole('button', { name: 'Add 1' })).toBeInTheDocument()
})
