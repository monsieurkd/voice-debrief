'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { updateRow, addRow, deleteRow, reclassifyRow } from '@/actions/debrief'
import { IconClose, IconPlus } from '@/components/ui'
import { SECTIONS, type EntityType } from '@/lib/constants'
import type { LoadedSession, ViewBlock } from '@/lib/session'

const UNDO_MS = 6000

/**
 * The editable doc — a projection over the structured rows. Each block binds 1:1
 * to a row via {entityType, id} held in React state (never rendered as text).
 * Verbs: edit (inline), add, delete (with client-side undo), reclassify (move).
 */
export function DebriefDoc({ initial }: { initial: LoadedSession }) {
  const [blocks, setBlocks] = useState<ViewBlock[]>(initial.blocks)
  const [undo, setUndo] = useState<{ block: ViewBlock; before: ViewBlock[] } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const nextTempId = useRef(-1)

  useEffect(() => {
    if (!undo) return
    const t = setTimeout(() => setUndo(null), UNDO_MS)
    return () => clearTimeout(t)
  }, [undo])

  const isBlock = (b: ViewBlock, et: EntityType, id: number) => b.entityType === et && b.id === id

  async function handleSaveEdit(et: EntityType, id: number, text: string) {
    const prev = blocks.find((b) => isBlock(b, et, id))?.text ?? text
    setBlocks((bs) => bs.map((b) => (isBlock(b, et, id) ? { ...b, text } : b)))
    try {
      await updateRow(et, id, text, initial.id)
    } catch {
      setBlocks((bs) => bs.map((b) => (isBlock(b, et, id) ? { ...b, text: prev } : b)))
      setError('Could not save that edit — the previous text is back. Try again.')
    }
  }

  async function handleCreate(et: EntityType, tempId: number, text: string) {
    // optimistic: show the text immediately, then swap the temp id for the real one
    setBlocks((bs) => bs.map((b) => (isBlock(b, et, tempId) ? { ...b, text } : b)))
    try {
      const { id } = await addRow(et, initial.id, text)
      setBlocks((bs) => bs.map((b) => (isBlock(b, et, tempId) ? { ...b, id, text } : b)))
    } catch {
      setBlocks((bs) => bs.filter((b) => !isBlock(b, et, tempId)))
      setError('Could not add that row — it was removed. Try again.')
    }
  }

  function handleAddNew(et: EntityType) {
    const tempId = nextTempId.current--
    setBlocks((bs) => [...bs, { entityType: et, id: tempId, text: '', tags: [] }])
  }

  function handleCancelNew(et: EntityType, tempId: number) {
    setBlocks((bs) => bs.filter((b) => !isBlock(b, et, tempId)))
  }

  async function handleDelete(et: EntityType, id: number) {
    const index = blocks.findIndex((b) => isBlock(b, et, id))
    if (index === -1) return
    const block = blocks[index]
    const before = blocks
    setBlocks((bs) => bs.filter((b) => !isBlock(b, et, id)))
    try {
      await deleteRow(et, id, initial.id)
      setUndo({ block, before }) // offer undo only once the server delete confirmed
    } catch {
      setBlocks((bs) => {
        const copy = [...bs]
        copy.splice(Math.min(index, copy.length), 0, block)
        return copy
      })
      setError('Could not delete that row — it is back. Try again.')
    }
  }

  async function handleReclassify(et: EntityType, id: number, to: EntityType) {
    if (et === to || id < 0) return
    try {
      const { id: newId } = await reclassifyRow(et, id, to, initial.id)
      setBlocks((bs) =>
        bs.map((b) =>
          isBlock(b, et, id)
            ? {
                ...b,
                entityType: to,
                id: newId,
                rationale: undefined,
                resolved: undefined,
                status: undefined,
                dueOn: undefined,
                goalTitle: undefined,
                kind: undefined,
                occurredAt: undefined,
              }
            : b,
        ),
      )
    } catch {
      setError('Could not move that row — it stays where it was. Try again.')
    }
  }

  async function handleUndo() {
    if (!undo) return
    const { block, before } = undo
    try {
      // Re-insert FIRST — if this fails the text must still exist somewhere
      // (it was deleted server-side), so we keep the undo toast armed.
      // Extras (dueOn/status/goal/rationale/kind/occurredAt) ride along, so
      // the row comes back as it was. Tag chips are still not restorable —
      // their tag_links are cleaned on delete.
      const { id } = await addRow(block.entityType, initial.id, block.text, {
        status: block.status as 'open' | 'done' | 'skipped' | undefined,
        dueOn: block.dueOn ?? undefined,
        goalTitle: block.goalTitle ?? undefined,
        rationale: block.rationale ?? undefined,
        resolved: block.resolved,
        kind: block.kind ?? undefined,
        occurredAt: block.occurredAt ?? undefined,
      })
      const at = before.findIndex((b) => isBlock(b, block.entityType, block.id))
      setBlocks((bs) => {
        // Splice into the CURRENT blocks, not the 6s-old `before` snapshot —
        // restoring the snapshot would clobber edits made during the window.
        const restored: ViewBlock = { ...block, id, tags: [] }
        const copy = [...bs]
        copy.splice(Math.min(Math.max(at, 0), copy.length), 0, restored)
        return copy
      })
      setUndo(null)
    } catch {
      setError('Undo failed — try again.')
      setUndo({ block, before }) // new object → the retry window re-arms
    }
  }

  const tags = Array.from(
    new Map(blocks.flatMap((b) => b.tags).map((t) => [`${t.kind}|${t.name.toLowerCase()}`, t])).values(),
  )

  return (
    <>
      <div className="flex flex-col gap-8">
        {SECTIONS.map((sec) => {
          const items = blocks.filter((b) => b.entityType === sec.entityType)
          return (
            <section key={sec.title}>
              <h2 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-on-surface-muted">
                <SectionIcon entityType={sec.entityType} className="h-4 w-4" />
                {sec.title}
              </h2>
              <ul className="flex flex-col gap-1">
                {items.length === 0 && <li className="px-2 py-1 text-sm text-on-surface-muted">Nothing here yet.</li>}
                {items.map((b) => (
                  <EditableBlock
                    key={b.id}
                    block={b}
                    onSave={(text) =>
                      b.id < 0 ? handleCreate(b.entityType, b.id, text) : handleSaveEdit(b.entityType, b.id, text)
                    }
                    onDelete={() => (b.id < 0 ? handleCancelNew(b.entityType, b.id) : handleDelete(b.entityType, b.id))}
                    onReclassify={(to) => handleReclassify(b.entityType, b.id, to)}
                  />
                ))}
                <li>
                  <button
                    onClick={() => handleAddNew(sec.entityType)}
                    className="mt-1 inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded-lg px-2 text-xs font-medium text-on-surface-muted transition-[background-color,transform] duration-[var(--dur-base)] ease-[var(--ease-standard)] hover:bg-surface-container hover:text-on-surface focus-visible:ring-2 focus-visible:ring-primary-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface active:scale-[0.97]"
                  >
                    <IconPlus className="h-3.5 w-3.5" />
                    add
                  </button>
                </li>
              </ul>
            </section>
          )
        })}
      </div>

      {tags.length > 0 && <p className="mt-8 text-sm text-on-surface-muted">{tags.map((t) => t.name).join(' · ')}</p>}

      {error && (
        <p
          role="alert"
          className="mt-4 rounded-lg bg-error-container px-3 py-2 text-sm text-on-error-container"
        >
          {error}{' '}
          <button onClick={() => setError(null)} className="underline">
            dismiss
          </button>
        </p>
      )}

      {undo && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 rounded-full bg-primary px-5 py-2.5 text-sm text-on-primary shadow-[0_20px_40px_-16px_rgba(87,95,101,0.6)]">
          Removed.{' '}
          <button onClick={handleUndo} className="font-semibold underline">
            Undo
          </button>
        </div>
      )}
    </>
  )
}

function EditableBlock({
  block,
  onSave,
  onDelete,
  onReclassify,
}: {
  block: ViewBlock
  onSave: (text: string) => void
  onDelete: () => void
  onReclassify: (to: EntityType) => void
}) {
  const isNew = block.id < 0
  const [editing, setEditing] = useState(isNew)
  const [draft, setDraft] = useState(block.text)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editing) inputRef.current?.focus()
  }, [editing])

  function save() {
    const t = draft.trim()
    setEditing(false)
    if (!t) {
      if (isNew) onDelete()
      return
    }
    if (isNew || t !== block.text) onSave(t)
  }

  function cancel() {
    if (isNew) {
      onDelete()
    } else {
      setDraft(block.text)
      setEditing(false)
    }
  }

  if (editing) {
    return (
      <li className="flex items-center gap-2 px-2 py-1">
        <input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              save()
            } else if (e.key === 'Escape') {
              e.preventDefault()
              cancel()
            }
          }}
          className="ambient-field w-full py-2 text-sm text-on-surface"
        />
        <button
          onClick={save}
          className="inline-flex min-h-11 cursor-pointer items-center rounded-lg px-2 text-xs font-medium text-on-secondary-container transition-[background-color,transform] duration-[var(--dur-base)] ease-[var(--ease-standard)] hover:bg-surface-container hover:text-on-surface focus-visible:ring-2 focus-visible:ring-primary-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface active:scale-[0.97]"
        >
          Save
        </button>
        <button
          onClick={cancel}
          className="inline-flex min-h-11 cursor-pointer items-center rounded-lg px-2 text-xs text-on-surface-muted transition-[background-color,transform] duration-[var(--dur-base)] ease-[var(--ease-standard)] hover:bg-surface-container hover:text-on-surface focus-visible:ring-2 focus-visible:ring-primary-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface active:scale-[0.97]"
        >
          Cancel
        </button>
      </li>
    )
  }

  return (
    <li className="group flex flex-col gap-0.5 rounded-xl px-3 py-2 hover:bg-surface-container">
      <div className="flex items-start gap-2">
        <span className="flex-1 text-sm leading-6 text-on-surface">{block.text}</span>
        {/* Hover reveals the controls on pointer devices; on touch there is no
            hover to reveal them — always show them when hover is unavailable
            or when anything inside the row holds focus. Every control uses a
            min-h-11 (44px) hit target and a visible focus-visible ring. */}
        <div className="flex items-center gap-1 rounded-lg opacity-0 transition group-focus-within:opacity-100 group-hover:opacity-100 focus-within:ring-2 focus-within:ring-primary-ring focus-within:ring-offset-2 focus-within:ring-offset-surface [@media(hover:none)]:opacity-100">
          <button
            onClick={() => {
              setDraft(block.text)
              setEditing(true)
            }}
            className="inline-flex min-h-11 cursor-pointer items-center rounded-lg px-2 text-xs text-on-surface-muted transition-[background-color,transform] duration-[var(--dur-base)] ease-[var(--ease-standard)] hover:bg-surface-container hover:text-on-surface focus-visible:ring-2 focus-visible:ring-primary-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface active:scale-[0.97]"
          >
            edit
          </button>
          {!isNew && (
            <select
              value={block.entityType}
              onChange={(e) => onReclassify(e.target.value as EntityType)}
              title="Move to another section"
              aria-label="Move to another section"
              className="min-h-11 cursor-pointer rounded-lg bg-transparent px-1.5 text-xs text-on-surface-muted transition-[background-color,transform] duration-[var(--dur-base)] ease-[var(--ease-standard)] hover:bg-surface-container hover:text-on-surface focus-visible:ring-2 focus-visible:ring-primary-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface active:scale-[0.97]"
            >
              {SECTIONS.map((s) => (
                <option key={s.entityType} value={s.entityType}>
                  move → {s.title}
                </option>
              ))}
            </select>
          )}
          <button
            onClick={onDelete}
            aria-label="Delete row"
            title="Delete row"
            className="inline-flex min-h-11 min-w-11 cursor-pointer items-center justify-center rounded-lg p-2 text-on-surface-muted transition-[background-color,color,transform] duration-[var(--dur-base)] ease-[var(--ease-standard)] hover:bg-error-container hover:text-error focus-visible:ring-2 focus-visible:ring-primary-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface active:scale-[0.97]"
          >
            <IconClose className="h-4 w-4" />
          </button>
        </div>
      </div>
      {block.entityType === 'decision' && block.rationale && (
        <span className="ml-6 text-xs text-on-surface-muted">{block.rationale}</span>
      )}
      {block.entityType === 'decision' && block.resolved === false && (
        <span className="ml-6 text-xs italic text-on-surface-muted">still open</span>
      )}
      {block.entityType === 'next_step' && (
        <span className="ml-6 text-xs text-on-surface-muted">
          {block.goalTitle && <>→ {block.goalTitle} </>}
          {block.dueOn && <>· due {block.dueOn} </>}
          {block.status === 'done' && '· done'}
          {block.status === 'skipped' && '· skipped'}
        </span>
      )}
    </li>
  )
}

// Distinct inline-SVG icon per section, for visual separation. (No icon dep.)
const SECTION_ICONS: Record<EntityType, ReactNode> = {
  event: (
    <>
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
    </>
  ),
  decision: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="m8 12 3 3 5-6" />
    </>
  ),
  reflection: <path d="M17.5 19a4.5 4.5 0 0 0 0-9 6 6 0 0 0-11.5 2A4 4 0 0 0 6 19Z" />,
  next_step: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M8 12h8M13 9l3 3-3 3" />
    </>
  ),
}

function SectionIcon({ entityType, className }: { entityType: EntityType; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      {SECTION_ICONS[entityType]}
    </svg>
  )
}
