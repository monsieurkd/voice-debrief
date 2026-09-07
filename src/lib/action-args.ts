import { z } from 'zod'

/**
 * Server-action arguments arrive over HTTP and are fully client-controlled.
 * TypeScript signatures are compile-time only. Every action parses its args
 * through this before touching the DB or an LLM. Invalid input throws a
 * generic error (details stay in server logs) so nothing about internals
 * leaks back to the caller.
 */
export function parseArgs<T>(schema: z.ZodType<T>, args: unknown, label: string): T {
  const res = schema.safeParse(args)
  if (!res.success) {
    console.warn(
      `[action:${label}] rejected invalid args:`,
      res.error.issues.map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`).join('; '),
    )
    throw new Error('Invalid request.')
  }
  return res.data
}
