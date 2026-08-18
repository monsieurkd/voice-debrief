// Single-user v1 (spec §11): hardcode the seeded user.
export const USER_ID = 1

export type SectionKey = 'events' | 'decisions' | 'reflections' | 'next_steps'
export type EntityType = 'event' | 'decision' | 'reflection' | 'next_step'

// Drives the viewer's sections AND reclassify. `title` is the friendly header
// shown to the user (NEVER the table name); `primaryTextKey` is the column holding
// the block's main text in each table.
export interface SectionMeta {
  key: SectionKey
  entityType: EntityType
  title: string
  primaryTextKey: 'what' | 'summary' | 'content'
}

export const SECTIONS: SectionMeta[] = [
  { key: 'events', entityType: 'event', title: 'What happened', primaryTextKey: 'what' },
  { key: 'decisions', entityType: 'decision', title: 'What you decided', primaryTextKey: 'summary' },
  { key: 'reflections', entityType: 'reflection', title: 'On your mind', primaryTextKey: 'content' },
  { key: 'next_steps', entityType: 'next_step', title: 'Your move', primaryTextKey: 'content' },
]

export const SECTION_BY_KEY: Record<SectionKey, SectionMeta> = Object.fromEntries(
  SECTIONS.map((s) => [s.key, s]),
) as Record<SectionKey, SectionMeta>

export const SECTION_BY_ENTITY: Record<EntityType, SectionMeta> = Object.fromEntries(
  SECTIONS.map((s) => [s.entityType, s]),
) as Record<EntityType, SectionMeta>
