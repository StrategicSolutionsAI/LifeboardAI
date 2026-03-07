"use client"

import { useState, useMemo, useCallback } from 'react'
import {
  Plus, Trash2, Edit3, Phone, Mail, AlertTriangle,
  Cake, Users, ChevronLeft, X, Heart, Check, Send, Clock, UserPlus, Home,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useHousehold } from '@/hooks/use-household'
import type { WidgetInstance } from '@/types/widgets'

// ── Types ─────────────────────────────────────────────────────────────────

type Relationship = 'spouse' | 'child' | 'parent' | 'grandparent' | 'sibling' | 'pet' | 'other'

interface FamilyMember {
  id: string
  name: string
  relationship: Relationship
  birthday?: string
  phone?: string
  email?: string
  avatarColor: string
  allergens?: string[]
  medicalNotes?: string
  createdAt: string
}

interface FamilyMembersWidgetProps {
  widget: WidgetInstance
  onUpdate: (updates: Partial<WidgetInstance>) => void
}

// ── Constants ─────────────────────────────────────────────────────────────

const RELATIONSHIP_OPTIONS: { value: Relationship; label: string }[] = [
  { value: 'spouse', label: 'Spouse / Partner' },
  { value: 'child', label: 'Child' },
  { value: 'parent', label: 'Parent' },
  { value: 'grandparent', label: 'Grandparent' },
  { value: 'sibling', label: 'Sibling' },
  { value: 'pet', label: 'Pet' },
  { value: 'other', label: 'Other' },
]

const AVATAR_COLORS = [
  '#E57373', '#F06292', '#BA68C8', '#9575CD',
  '#7986CB', '#64B5F6', '#4FC3F7', '#4DD0E1',
  '#4DB6AC', '#81C784', '#AED581', '#FFD54F',
  '#FFB74D', '#FF8A65', '#A1887F', '#90A4AE',
]

const COMMON_ALLERGENS = [
  'Peanuts', 'Tree Nuts', 'Milk', 'Eggs', 'Wheat',
  'Soy', 'Fish', 'Shellfish', 'Sesame', 'Gluten',
]

// ── Helpers ───────────────────────────────────────────────────────────────

function getInitials(name: string): string {
  return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
}

function getRandomColor(): string {
  return AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)]
}

function getBirthdayCountdown(birthday: string): { daysUntil: number; age: number } {
  const now = new Date()
  const todayDate = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  // Parse manually to avoid UTC interpretation of date-only strings
  const [bdYear, bdMonth, bdDay] = birthday.split('-').map(Number)
  const thisYear = new Date(now.getFullYear(), bdMonth - 1, bdDay)
  const next = thisYear < todayDate
    ? new Date(now.getFullYear() + 1, bdMonth - 1, bdDay)
    : thisYear
  const daysUntil = Math.round((next.getTime() - todayDate.getTime()) / 86400000)
  const age = now.getFullYear() - bdYear - (todayDate < thisYear ? 1 : 0)
  return { daysUntil, age }
}

function getRelationshipBadgeColor(rel: Relationship): string {
  const colors: Record<Relationship, string> = {
    spouse: 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300',
    child: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
    parent: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
    grandparent: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
    sibling: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
    pet: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
    other: 'bg-gray-100 text-gray-700 dark:bg-gray-800/50 dark:text-gray-300',
  }
  return colors[rel]
}

// ── Component ─────────────────────────────────────────────────────────────

export function FamilyMembersWidget({ widget, onUpdate }: FamilyMembersWidgetProps) {
  const members = useMemo(
    () => widget.familyMembersData?.members || [],
    [widget.familyMembersData?.members],
  )

  // Household state for invite UI
  const {
    household,
    members: householdMembers,
    isLoading: householdLoading,
    error: householdError,
    createHousehold,
    inviteMember,
    removeMember: removeHouseholdMember,
  } = useHousehold()

  const [view, setView] = useState<'list' | 'form' | 'detail'>('list')
  const [editingMember, setEditingMember] = useState<FamilyMember | null>(null)
  const [selectedMember, setSelectedMember] = useState<FamilyMember | null>(null)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteSending, setInviteSending] = useState(false)
  const [inviteSuccess, setInviteSuccess] = useState(false)

  // Form state
  const [formName, setFormName] = useState('')
  const [formRelationship, setFormRelationship] = useState<Relationship>('spouse')
  const [formBirthday, setFormBirthday] = useState('')
  const [formPhone, setFormPhone] = useState('')
  const [formEmail, setFormEmail] = useState('')
  const [formAvatarColor, setFormAvatarColor] = useState(getRandomColor)
  const [formAllergens, setFormAllergens] = useState<string[]>([])
  const [formMedicalNotes, setFormMedicalNotes] = useState('')
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

  const saveMembers = useCallback(
    (newMembers: FamilyMember[]) => {
      onUpdate({ familyMembersData: { members: newMembers } })
    },
    [onUpdate],
  )

  const resetForm = () => {
    setFormName('')
    setFormRelationship('spouse')
    setFormBirthday('')
    setFormPhone('')
    setFormEmail('')
    setFormAvatarColor(getRandomColor())
    setFormAllergens([])
    setFormMedicalNotes('')
    setEditingMember(null)
  }

  const openAddForm = () => {
    resetForm()
    setView('form')
  }

  const openEditForm = (member: FamilyMember) => {
    setEditingMember(member)
    setFormName(member.name)
    setFormRelationship(member.relationship)
    setFormBirthday(member.birthday || '')
    setFormPhone(member.phone || '')
    setFormEmail(member.email || '')
    setFormAvatarColor(member.avatarColor)
    setFormAllergens(member.allergens || [])
    setFormMedicalNotes(member.medicalNotes || '')
    setView('form')
  }

  const handleSave = () => {
    if (!formName.trim()) return

    const memberData: FamilyMember = {
      id: editingMember?.id || crypto.randomUUID(),
      name: formName.trim(),
      relationship: formRelationship,
      birthday: formBirthday || undefined,
      phone: formPhone.trim() || undefined,
      email: formEmail.trim() || undefined,
      avatarColor: formAvatarColor,
      allergens: formAllergens.length > 0 ? formAllergens : undefined,
      medicalNotes: formMedicalNotes.trim() || undefined,
      createdAt: editingMember?.createdAt || new Date().toISOString(),
    }

    const newMembers = editingMember
      ? members.map(m => (m.id === editingMember.id ? memberData : m))
      : [...members, memberData]

    saveMembers(newMembers)
    resetForm()
    setView('list')
  }

  const handleDelete = (id: string) => {
    saveMembers(members.filter(m => m.id !== id))
    setConfirmDelete(null)
    if (selectedMember?.id === id) {
      setSelectedMember(null)
      setView('list')
    }
  }

  const toggleAllergen = (allergen: string) => {
    setFormAllergens(prev =>
      prev.includes(allergen) ? prev.filter(a => a !== allergen) : [...prev, allergen],
    )
  }

  const handleSendInvite = async () => {
    if (!inviteEmail.trim()) return
    setInviteSending(true)
    setInviteSuccess(false)

    // Auto-create household if none exists
    if (!household) {
      const created = await createHousehold('My Family')
      if (!created) { setInviteSending(false); return }
    }

    const ok = await inviteMember(inviteEmail.trim())
    setInviteSending(false)
    if (ok) {
      setInviteEmail('')
      setInviteSuccess(true)
      setTimeout(() => setInviteSuccess(false), 3000)
    }
  }

  // ── List View ─────────────────────────────────────────────────────────

  if (view === 'list') {
    return (
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-theme-text-secondary" />
            <span className="text-sm font-medium text-theme-text-primary">
              {members.length} member{members.length !== 1 ? 's' : ''}
            </span>
          </div>
          <button
            onClick={openAddForm}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-theme-brand-tint-subtle text-theme-text-primary hover:bg-theme-brand-tint-light transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Member
          </button>
        </div>

        {/* Empty state */}
        {members.length === 0 && (
          <div className="text-center py-10">
            <div className="text-4xl mb-3">{"\uD83D\uDC68\u200D\uD83D\uDC69\u200D\uD83D\uDC67\u200D\uD83D\uDC66"}</div>
            <div className="text-sm font-medium text-theme-text-primary mb-1">
              No family members yet
            </div>
            <div className="text-xs text-theme-text-tertiary mb-4">
              Add your family to keep track of birthdays, contacts, and more.
            </div>
            <button
              onClick={openAddForm}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-theme-primary text-white hover:bg-theme-primary-600 transition-colors"
            >
              Add First Member
            </button>
          </div>
        )}

        {/* Member list */}
        <div className="space-y-2">
          {members.map(member => {
            const birthdayInfo = member.birthday ? getBirthdayCountdown(member.birthday) : null
            return (
              <div
                key={member.id}
                className="flex items-center gap-3 p-3 rounded-xl bg-theme-surface-raised hover:bg-theme-surface-alt transition-colors cursor-pointer"
                onClick={() => { setSelectedMember(member); setView('detail') }}
              >
                {/* Avatar */}
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-semibold flex-shrink-0"
                  style={{ backgroundColor: member.avatarColor }}
                >
                  {getInitials(member.name)}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-theme-text-primary truncate">
                      {member.name}
                    </span>
                    <span className={cn(
                      'px-1.5 py-0.5 rounded text-[10px] font-medium capitalize',
                      getRelationshipBadgeColor(member.relationship),
                    )}>
                      {member.relationship}
                    </span>
                  </div>
                  {birthdayInfo && (
                    <div className="text-xs text-theme-text-tertiary mt-0.5">
                      {birthdayInfo.daysUntil === 0
                        ? 'Birthday today!'
                        : `Birthday in ${birthdayInfo.daysUntil} day${birthdayInfo.daysUntil !== 1 ? 's' : ''}`}
                      {birthdayInfo.age > 0 && ` \u00B7 Age ${birthdayInfo.age}`}
                    </div>
                  )}
                </div>

                {/* Quick actions */}
                <div className="flex items-center gap-1">
                  {member.allergens && member.allergens.length > 0 && (
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                  )}
                  <button
                    aria-label={`Edit ${member.name}`}
                    onClick={(e) => { e.stopPropagation(); openEditForm(member) }}
                    className="p-1.5 rounded-lg hover:bg-theme-surface-alt transition-colors"
                  >
                    <Edit3 className="w-3.5 h-3.5 text-theme-text-tertiary" />
                  </button>
                </div>
              </div>
            )
          })}
        </div>

        {/* ── Invite to LifeboardAI ─────────────────────────────────────── */}
        <div className="border-t border-theme-neutral-300/60 pt-4 mt-4 space-y-3">
          <div className="flex items-center gap-2">
            <UserPlus className="w-4 h-4 text-theme-text-secondary" />
            <span className="text-xs font-medium text-theme-text-secondary uppercase tracking-wide">
              Invite to LifeboardAI
            </span>
          </div>

          <div className="flex gap-2">
            <input
              type="email"
              value={inviteEmail}
              onChange={e => setInviteEmail(e.target.value)}
              placeholder="family@email.com"
              aria-label="Email address to invite"
              onKeyDown={e => { if (e.key === 'Enter') handleSendInvite() }}
              className="flex-1 px-3 py-2 rounded-lg border border-theme-neutral-300 bg-theme-surface-base text-sm text-theme-text-primary placeholder:text-theme-text-subtle focus:outline-none focus:ring-2 focus:ring-theme-brand-tint-DEFAULT/50"
            />
            <button
              onClick={handleSendInvite}
              disabled={!inviteEmail.trim() || inviteSending}
              className="px-3 py-2 rounded-lg text-sm font-medium bg-theme-primary text-white hover:bg-theme-primary-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
            >
              <Send className="w-3.5 h-3.5" />
              {inviteSending ? 'Sending...' : 'Invite'}
            </button>
          </div>

          {inviteSuccess && (
            <div className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
              <Check className="w-3.5 h-3.5" />
              Invite sent successfully
            </div>
          )}

          {householdError && (
            <div className="text-xs text-red-500">{householdError}</div>
          )}

          {/* Loading skeleton */}
          {householdLoading && (
            <div className="space-y-2 animate-pulse">
              <div className="h-8 bg-theme-skeleton rounded-lg" />
              <div className="h-8 bg-theme-skeleton rounded-lg" />
            </div>
          )}

          {/* Pending invites */}
          {!householdLoading && householdMembers.filter(m => m.status === 'pending').length > 0 && (
            <div className="space-y-1.5">
              <div className="text-xs text-theme-text-tertiary">Pending invites</div>
              {householdMembers
                .filter(m => m.status === 'pending')
                .map(m => (
                  <div key={m.id} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-theme-surface-raised">
                    <Clock className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
                    <span className="text-xs text-theme-text-secondary truncate flex-1">
                      {m.invited_email || m.display_name}
                    </span>
                    <button
                      aria-label={`Cancel invite for ${m.invited_email || m.display_name}`}
                      onClick={() => removeHouseholdMember(m.id)}
                      className="text-[10px] text-red-500 hover:text-red-700 dark:hover:text-red-300 px-1.5 py-0.5 rounded font-medium flex-shrink-0 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                ))}
            </div>
          )}

          {/* Active household members */}
          {!householdLoading && householdMembers.filter(m => m.status === 'active').length > 1 && (
            <div className="space-y-1.5">
              <div className="text-xs text-theme-text-tertiary">Linked accounts</div>
              {householdMembers
                .filter(m => m.status === 'active')
                .map(m => (
                  <div key={m.id} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-theme-surface-raised">
                    <Home className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
                    <span className="text-xs text-theme-text-secondary truncate">
                      {m.display_name || m.invited_email}
                    </span>
                    <span className="text-[10px] text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 px-1.5 py-0.5 rounded font-medium ml-auto flex-shrink-0 capitalize">
                      {m.role}
                    </span>
                  </div>
                ))}
            </div>
          )}

          {/* Leave household (for non-admin members) */}
          {!householdLoading && household && householdMembers.some(m => m.status === 'active' && m.role === 'member' && m.user_id) && (
            (() => {
              const selfMember = householdMembers.find(m => m.status === 'active' && m.role === 'member')
              if (!selfMember) return null
              return (
                <button
                  onClick={() => removeHouseholdMember(selfMember.id)}
                  className="w-full text-xs text-theme-text-tertiary hover:text-red-500 transition-colors py-1"
                >
                  Leave household
                </button>
              )
            })()
          )}
        </div>
      </div>
    )
  }

  // ── Detail View ───────────────────────────────────────────────────────

  if (view === 'detail' && selectedMember) {
    const birthdayInfo = selectedMember.birthday ? getBirthdayCountdown(selectedMember.birthday) : null
    return (
      <div className="space-y-5">
        {/* Back button */}
        <button
          onClick={() => { setSelectedMember(null); setView('list') }}
          className="flex items-center gap-1 text-xs text-theme-text-secondary hover:text-theme-text-primary transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
          Back to list
        </button>

        {/* Profile header */}
        <div className="flex items-center gap-4">
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center text-white text-xl font-bold"
            style={{ backgroundColor: selectedMember.avatarColor }}
          >
            {getInitials(selectedMember.name)}
          </div>
          <div>
            <h3 className="text-lg font-semibold text-theme-text-primary">
              {selectedMember.name}
            </h3>
            <span className={cn(
              'px-2 py-0.5 rounded text-xs font-medium capitalize',
              getRelationshipBadgeColor(selectedMember.relationship),
            )}>
              {selectedMember.relationship}
            </span>
          </div>
        </div>

        {/* Birthday */}
        {birthdayInfo && selectedMember.birthday && (
          <div className="flex items-center gap-3 p-3 rounded-xl bg-theme-surface-raised">
            <Cake className="w-5 h-5 text-pink-500 flex-shrink-0" />
            <div>
              <div className="text-sm font-medium text-theme-text-primary">
                {(() => {
                  const [y, m, d] = selectedMember.birthday!.split('-').map(Number)
                  return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
                })()}
              </div>
              <div className="text-xs text-theme-text-tertiary">
                {birthdayInfo.daysUntil === 0
                  ? 'Birthday today!'
                  : `${birthdayInfo.daysUntil} day${birthdayInfo.daysUntil !== 1 ? 's' : ''} away`}
                {birthdayInfo.age > 0 && ` \u00B7 Turning ${birthdayInfo.age + (birthdayInfo.daysUntil > 0 ? 1 : 0)}`}
              </div>
            </div>
          </div>
        )}

        {/* Contact */}
        {(selectedMember.phone || selectedMember.email) && (
          <div className="space-y-2">
            <div className="text-xs font-medium text-theme-text-secondary uppercase tracking-wide">
              Contact
            </div>
            {selectedMember.phone && (
              <a
                href={`tel:${selectedMember.phone}`}
                className="flex items-center gap-3 p-3 rounded-xl bg-theme-surface-raised hover:bg-theme-surface-alt transition-colors"
              >
                <Phone className="w-4 h-4 text-theme-text-tertiary" />
                <span className="text-sm text-theme-text-primary">{selectedMember.phone}</span>
              </a>
            )}
            {selectedMember.email && (
              <a
                href={`mailto:${selectedMember.email}`}
                className="flex items-center gap-3 p-3 rounded-xl bg-theme-surface-raised hover:bg-theme-surface-alt transition-colors"
              >
                <Mail className="w-4 h-4 text-theme-text-tertiary" />
                <span className="text-sm text-theme-text-primary">{selectedMember.email}</span>
              </a>
            )}
          </div>
        )}

        {/* Allergens */}
        {selectedMember.allergens && selectedMember.allergens.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-medium text-theme-text-secondary uppercase tracking-wide">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
              Allergens
            </div>
            <div className="flex flex-wrap gap-1.5">
              {selectedMember.allergens.map(a => (
                <span
                  key={a}
                  className="px-2 py-1 rounded-md text-xs font-medium bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300"
                >
                  {a}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Medical notes */}
        {selectedMember.medicalNotes && (
          <div className="space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-medium text-theme-text-secondary uppercase tracking-wide">
              <Heart className="w-3.5 h-3.5 text-red-500" />
              Medical Notes
            </div>
            <div className="p-3 rounded-xl bg-theme-surface-raised text-sm text-theme-text-primary whitespace-pre-wrap">
              {selectedMember.medicalNotes}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 pt-2">
          <button
            onClick={() => openEditForm(selectedMember)}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium bg-theme-brand-tint-subtle text-theme-text-primary hover:bg-theme-brand-tint-light transition-colors"
          >
            <Edit3 className="w-4 h-4" />
            Edit
          </button>
          {confirmDelete === selectedMember.id ? (
            <button
              onClick={() => handleDelete(selectedMember.id)}
              className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300 hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors"
            >
              <Check className="w-4 h-4" />
              Confirm
            </button>
          ) : (
            <button
              aria-label={`Delete ${selectedMember.name}`}
              onClick={() => setConfirmDelete(selectedMember.id)}
              className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium bg-theme-surface-raised text-theme-text-secondary hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    )
  }

  // ── Add/Edit Form ─────────────────────────────────────────────────────

  return (
    <div className="space-y-5">
      {/* Back button */}
      <button
        onClick={() => { resetForm(); setView('list') }}
        className="flex items-center gap-1 text-xs text-theme-text-secondary hover:text-theme-text-primary transition-colors"
      >
        <ChevronLeft className="w-4 h-4" />
        Back to list
      </button>

      <h3 className="text-base font-semibold text-theme-text-primary">
        {editingMember ? 'Edit Member' : 'Add Family Member'}
      </h3>

      {/* Name */}
      <div>
        <label className="block text-xs font-medium text-theme-text-secondary mb-1.5">
          Name *
        </label>
        <input
          type="text"
          value={formName}
          onChange={e => setFormName(e.target.value)}
          placeholder="Full name"
          className="w-full px-3 py-2 rounded-lg border border-theme-neutral-300 bg-theme-surface-base text-sm text-theme-text-primary placeholder:text-theme-text-subtle focus:outline-none focus:ring-2 focus:ring-theme-brand-tint-DEFAULT/50"
        />
      </div>

      {/* Relationship */}
      <div>
        <label className="block text-xs font-medium text-theme-text-secondary mb-1.5">
          Relationship
        </label>
        <select
          value={formRelationship}
          onChange={e => setFormRelationship(e.target.value as Relationship)}
          className="w-full px-3 py-2 rounded-lg border border-theme-neutral-300 bg-theme-surface-base text-sm text-theme-text-primary focus:outline-none focus:ring-2 focus:ring-theme-brand-tint-DEFAULT/50"
        >
          {RELATIONSHIP_OPTIONS.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>

      {/* Avatar color */}
      <div>
        <label className="block text-xs font-medium text-theme-text-secondary mb-1.5">
          Avatar Color
        </label>
        <div className="flex flex-wrap gap-2">
          {AVATAR_COLORS.map(color => (
            <button
              key={color}
              aria-label={`Select avatar color ${color}`}
              onClick={() => setFormAvatarColor(color)}
              className={cn(
                'w-7 h-7 rounded-full transition-all',
                formAvatarColor === color ? 'ring-2 ring-offset-2 ring-theme-text-primary scale-110' : 'hover:scale-105',
              )}
              style={{ backgroundColor: color }}
            />
          ))}
        </div>
      </div>

      {/* Birthday */}
      <div>
        <label className="block text-xs font-medium text-theme-text-secondary mb-1.5">
          Birthday
        </label>
        <input
          type="date"
          value={formBirthday}
          onChange={e => setFormBirthday(e.target.value)}
          className="w-full px-3 py-2 rounded-lg border border-theme-neutral-300 bg-theme-surface-base text-sm text-theme-text-primary focus:outline-none focus:ring-2 focus:ring-theme-brand-tint-DEFAULT/50"
        />
      </div>

      {/* Phone */}
      <div>
        <label className="block text-xs font-medium text-theme-text-secondary mb-1.5">
          Phone
        </label>
        <input
          type="tel"
          value={formPhone}
          onChange={e => setFormPhone(e.target.value)}
          placeholder="(555) 123-4567"
          className="w-full px-3 py-2 rounded-lg border border-theme-neutral-300 bg-theme-surface-base text-sm text-theme-text-primary placeholder:text-theme-text-subtle focus:outline-none focus:ring-2 focus:ring-theme-brand-tint-DEFAULT/50"
        />
      </div>

      {/* Email */}
      <div>
        <label className="block text-xs font-medium text-theme-text-secondary mb-1.5">
          Email
        </label>
        <input
          type="email"
          value={formEmail}
          onChange={e => setFormEmail(e.target.value)}
          placeholder="email@example.com"
          className="w-full px-3 py-2 rounded-lg border border-theme-neutral-300 bg-theme-surface-base text-sm text-theme-text-primary placeholder:text-theme-text-subtle focus:outline-none focus:ring-2 focus:ring-theme-brand-tint-DEFAULT/50"
        />
      </div>

      {/* Allergens */}
      <div>
        <label className="block text-xs font-medium text-theme-text-secondary mb-1.5">
          Allergens
        </label>
        <div className="flex flex-wrap gap-1.5">
          {COMMON_ALLERGENS.map(a => (
            <button
              key={a}
              onClick={() => toggleAllergen(a)}
              className={cn(
                'px-2.5 py-1 rounded-md text-xs font-medium transition-colors',
                formAllergens.includes(a)
                  ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
                  : 'bg-theme-surface-raised text-theme-text-tertiary hover:text-theme-text-secondary',
              )}
            >
              {a}
            </button>
          ))}
        </div>
      </div>

      {/* Medical notes */}
      <div>
        <label className="block text-xs font-medium text-theme-text-secondary mb-1.5">
          Medical Notes
        </label>
        <textarea
          value={formMedicalNotes}
          onChange={e => setFormMedicalNotes(e.target.value)}
          placeholder="Any important medical info..."
          rows={3}
          className="w-full px-3 py-2 rounded-lg border border-theme-neutral-300 bg-theme-surface-base text-sm text-theme-text-primary placeholder:text-theme-text-subtle focus:outline-none focus:ring-2 focus:ring-theme-brand-tint-DEFAULT/50 resize-none"
        />
      </div>

      {/* Save / Cancel */}
      <div className="flex gap-2 pt-2">
        <button
          onClick={handleSave}
          disabled={!formName.trim()}
          className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium bg-theme-primary text-white hover:bg-theme-primary-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {editingMember ? 'Save Changes' : 'Add Member'}
        </button>
        <button
          onClick={() => { resetForm(); setView('list') }}
          className="px-4 py-2.5 rounded-xl text-sm font-medium bg-theme-surface-raised text-theme-text-secondary hover:bg-theme-surface-alt transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}
