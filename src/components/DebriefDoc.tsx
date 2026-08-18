'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { updateRow, addRow, deleteRow, reclassifyRow } from '@/actions/debrief'
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
      const { id } = await addRow(block.entityType, initial.id, block.text)
      const at = before.findIndex((b) => isBlock(b, block.entityType, block.id))
      setBlocks((bs) => {
        // Splice into the CURRENT blocks, not the 6s-old `before` snapshot —
        // restoring the snapshot would clobber edits made during the window.
        // (Slice-1 limitation: only the text returns; tag chips and
        // type-specific extras do not.)
        const restored: ViewBlock = {
          ...block,
          id,
          tags: [],
          rationale: undefined,
          resolved: undefined,
          status: undefined,
          dueOn: undefined,
          goalTitle: undefined,
          kind: undefined,
          occurredAt: undefined,
        }
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
              <h2 className="mb-3 flex items-center gap-1.5 border-b border-zinc-200 pb-1 text-xs font-semibold uppercase tracking-wide text-zinc-400 dark:border-zinc-800">
                <SectionIcon entityType={sec.entityType} className="h-3.5 w-3.5" />
                {sec.title}
              </h2>
              <ul className="flex flex-col gap-1">
                {items.length === 0 && <li className="px-2 py-1 text-sm text-zinc-400">Nothing here yet.</li>}
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
                    className="mt-1 px-2 text-xs text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
                  >
                    + add
                  </button>
                </li>
              </ul>
            </section>
          )
        })}
      </div>

      {tags.length > 0 && <p className="mt-8 text-sm text-zinc-500">{tags.map((t) => t.name).join(' · ')}</p>}

      {error && (
        <p
          role="alert"
          className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300"
        >
          {error}{' '}
          <button onClick={() => setError(null)} className="underline">
            dismiss
          </button>
        </p>
      )}

      {undo && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 rounded-lg bg-zinc-900 px-4 py-2 text-sm text-white shadow-lg dark:bg-zinc-100 dark:text-zinc-900">
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
          className="w-full rounded border border-zinc-300 bg-white px-2 py-1 text-sm outline-none focus:border-zinc-900 dark:border-zinc-700 dark:bg-zinc-900"
        />
        <button onClick={save} className="text-xs font-medium text-zinc-600 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-zinc-100">
          Save
        </button>
        <button onClick={cancel} className="text-xs text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200">
          Cancel
        </button>
      </li>
    )
  }

  return (
    <li className="group flex flex-col gap-0.5 rounded-md px-2 py-1.5 hover:bg-zinc-50 dark:hover:bg-zinc-900">
      <div className="flex items-start gap-2">
        <span className="flex-1 text-sm leading-6 text-zinc-800 dark:text-zinc-200">{block.text}</span>
        <div className="flex items-center gap-2 opacity-0 transition group-hover:opacity-100">
          <button
            onClick={() => {
              setDraft(block.text)
              setEditing(true)
            }}
            className="text-xs text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
          >
            edit
          </button>
          {!isNew && (
            <select
              value={block.entityType}
              onChange={(e) => onReclassify(e.target.value as EntityType)}
              title="Move to another section"
              className="bg-transparent text-xs text-zinc-400 outline-none hover:text-zinc-900 dark:hover:text-zinc-100"
            >
              {SECTIONS.map((s) => (
                <option key={s.entityType} value={s.entityType}>
                  move → {s.title}
                </option>
              ))}
            </select>
          )}
          <button onClick={onDelete} className="text-xs text-zinc-400 hover:text-red-600">
            ✕
          </button>
        </div>
      </div>
      {block.entityType === 'decision' && block.rationale && (
        <span className="ml-6 text-xs text-zinc-400 dark:text-zinc-500">{block.rationale}</span>
      )}
      {block.entityType === 'decision' && block.resolved === false && (
        <span className="ml-6 text-xs italic text-zinc-400">still open</span>
      )}
      {block.entityType === 'next_step' && (
        <span className="ml-6 text-xs text-zinc-400">
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
