// Live smoke test of the interview driver (small model). Runs 2 turns and prints
// the reflect-then-probe replies + which asked-fields each user message covered.
import { runInterviewTurn } from '../src/lib/interview'
import type OpenAI from 'openai'

async function main() {
  const base: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: 'assistant', content: "Hey — how'd today go?" },
    { role: 'user', content: 'Today was rough, the standup went sideways.' },
  ]
  const t1 = await runInterviewTurn({
    history: base,
    checklist: { events: false, decisions: false, next_steps: false },
    hints: {},
  })
  console.log('TURN 1 reply :', t1.reply)
  console.log('TURN 1 cover :', t1.covered)

  const history2: OpenAI.Chat.ChatCompletionMessageParam[] = [
    ...base,
    { role: 'assistant', content: t1.reply },
    { role: 'user', content: 'Sarah and I pushed the deadline to next week, but I am not sure it is realistic.' },
  ]
  const t2 = await runInterviewTurn({
    history: history2,
    checklist: { events: t1.covered.events, decisions: t1.covered.decisions, next_steps: t1.covered.next_steps },
    hints: { mood: 'low', engagement: 2 },
  })
  console.log('\nTURN 2 reply :', t2.reply)
  console.log('TURN 2 cover :', t2.covered)
  process.exit(0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
