/**
 * Get the current date in YYYY-MM-DD format using local timezone
 * This ensures consistent date handling across the application
 */
export function getCurrentLocalDate(): string {
  const now = new Date()
  return now.getFullYear() + '-' + 
         String(now.getMonth() + 1).padStart(2, '0') + '-' + 
         String(now.getDate()).padStart(2, '0')
}

/**
 * Format a date string for display
 */
export function formatDateForDisplay(dateString: string): string {
  return new Date(dateString + 'T00:00:00').toLocaleDateString('en-US', { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  })
}
