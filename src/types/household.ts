import type { WidgetInstance } from './widgets'

export type RosterMember = NonNullable<WidgetInstance['familyMembersData']>['members'][number]

export interface Household {
  id: string
  name: string
  createdBy: string
  familyRoster: RosterMember[]
}

export interface HouseholdMember {
  id: string
  householdId: string
  userId: string | null
  role: 'admin' | 'member'
  status: 'pending' | 'active'
  invitedEmail: string | null
  displayName: string | null
  invitedAt: string
  joinedAt: string | null
  /** Present only for admins viewing a pending invite, to re-share its link. */
  inviteToken: string | null
}
