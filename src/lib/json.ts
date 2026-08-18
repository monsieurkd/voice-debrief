import type { ZodError } from 'zod'

/** Tolerant JSON extraction: strips ```json fences and isolates the outermost {...}. */
export function safeJsonParse(raw: string): unknown {
  let s = raw.trim()
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (fence) s = fence[1].trim()
  const first = s.indexOf('{')
  const last = s.lastIndexOf('}')
  if (first !== -1 && last !== -1 && last > first) s = s.slice(first, last + 1)
  return JSON.parse(s)
}

/** Flatten Zod issues into a short bulleted list to feed back to the model on retry. */
export function summarizeZodIssues(error: ZodError): string {
  return error.issues
    .slice(0, 6)
    .map((i) => `- ${i.path.join('.') || '(root)'}: ${i.message}`)
    .join('\n')
}
