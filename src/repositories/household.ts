import type { Household, HouseholdMember } from '@/types/household'

export const HOUSEHOLD_SELECT_COLUMNS = 'id, name, created_by, family_roster'

export const HOUSEHOLD_MEMBER_SELECT_COLUMNS =
  'id, household_id, user_id, role, status, invited_email, display_name, invited_at, joined_at, invite_token'

export function mapRowToHousehold(row: any): Household {
  return {
    id: row.id,
    name: row.name,
    createdBy: row.created_by,
    familyRoster: Array.isArray(row.family_roster) ? row.family_roster : [],
  }
}

export function mapRowToHouseholdMember(row: any, viewerIsAdmin: boolean): HouseholdMember {
  return {
    id: row.id,
    householdId: row.household_id,
    userId: row.user_id ?? null,
    role: row.role,
    status: row.status,
    invitedEmail: row.invited_email ?? null,
    displayName: row.display_name ?? null,
    invitedAt: row.invited_at,
    joinedAt: row.joined_at ?? null,
    inviteToken: viewerIsAdmin && row.status === 'pending' ? row.invite_token ?? null : null,
  }
}
