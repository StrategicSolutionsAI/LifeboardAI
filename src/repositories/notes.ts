export const NOTE_SELECT_COLUMNS =
  [
    'id',
    'user_id',
    'title',
    'body',
    'is_pinned',
    'created_at',
    'updated_at',
  ].join(', ')

export function mapRowToNote(row: any) {
  return {
    id: row.id as string,
    title: row.title as string,
    body: row.body as string,
    isPinned: Boolean(row.is_pinned),
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  }
}
