// Create a real demo session via the full dual-model path (fast overview + strong
// extraction → store), the same logic runDebrief uses (minus revalidatePath).
import { env } from '../src/lib/env'
import { generateOverview } from '../src/lib/overview'
import { extractDebrief } from '../src/lib/extract'
import { storeSession } from '../src/lib/store'
import { sampleTranscripts } from '../src/lib/sample-transcripts'

async function main() {
  const transcript = sampleTranscripts[0].text
  console.log(`FAST overview (${env.LLM_SMALL_MODEL}) ‖ STRONG extraction (${env.LLM_MODEL}) — running concurrently…`)
  const overviewP = generateOverview(transcript)
  const payload = await extractDebrief(transcript)
  const fastOverview = await overviewP
  const overview = fastOverview ?? payload.overview
  const sid = await storeSession(transcript, payload, { overview })
  console.log('\n— FAST model overview —\n' + overview)
  console.log('\n— STRONG model rows —')
  console.log('events:', payload.events.length, '| reflections:', payload.reflections.length, '| decisions:', payload.decisions.length, '| next_steps:', payload.next_steps.length)
  console.log('\n✅ demo session stored → http://localhost:3000/session/' + sid)
  process.exit(0)
}
main().catch((e) => {
  console.error(e)
  process.exit(1)
})
