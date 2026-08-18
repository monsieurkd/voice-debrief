import { z } from 'zod'

// Single source of truth for what the strong-model extraction must return.
// Tags are embedded PER-ITEM (not a flat top-level list): the polymorphic
// tag_links table needs to know which row each tag binds to, and the model
// cannot emit row ids it doesn't know — so tags ride along with each item and
// the action wires them to each just-inserted row's id.

const tagRef = z.object({
  kind: z.enum(['person', 'project', 'topic']),
  name: z.string().min(1).max(80),
})

export const extractionEvent = z.object({
  what: z.string().min(1).max(400),
  occurred_at: z.string().max(40).nullable().optional(), // free-form; resolved to timestamptz at store time
  tags: z.array(tagRef).default([]),
})

// A reflection is a THOUGHT / worry / idea — NOT an action. (Actions = next_steps.)
export const extractionReflection = z.object({
  content: z.string().min(1).max(600),
  kind: z.enum(['worry', 'idea', 'gratitude', 'realization', 'other']).optional(),
  tags: z.array(tagRef).default([]),
})

export const extractionDecision = z.object({
  summary: z.string().min(1).max(400),
  rationale: z.string().max(600).optional(), // surfaced as ⚠ doubt in the viewer
  resolved: z.boolean().default(false), // unresolved (false) is valid, valuable data
  tags: z.array(tagRef).default([]),
})

export const extractionNextStep = z.object({
  content: z.string().min(1).max(400),
  status: z.enum(['open', 'done', 'skipped']).default('open'),
  due_on: z.string().max(40).optional(), // resolved to date at store time
  goal: z.string().max(120).optional(), // goal TITLE (resolved later), never an id
  tags: z.array(tagRef).default([]),
})

export const extractionPayload = z.object({
  overview: z.string().min(1).max(280), // the 2-liner
  mood: z.enum(['low', 'neutral', 'high']).nullable().optional(),
  energy: z.number().int().min(1).max(5).nullable().optional(),
  pace: z.enum(['rushed', 'measured', 'detailed']).nullable().optional(),
  engagement: z.number().int().min(1).max(5).nullable().optional(),
  tone: z.string().max(40).nullable().optional(),
  events: z.array(extractionEvent).default([]),
  reflections: z.array(extractionReflection).default([]),
  decisions: z.array(extractionDecision).default([]),
  next_steps: z.array(extractionNextStep).default([]),
})

export type ExtractionPayload = z.infer<typeof extractionPayload>
export type ExtractionEvent = z.infer<typeof extractionEvent>
export type ExtractionReflection = z.infer<typeof extractionReflection>
export type ExtractionDecision = z.infer<typeof extractionDecision>
export type ExtractionNextStep = z.infer<typeof extractionNextStep>
export type TagRef = z.infer<typeof tagRef>
