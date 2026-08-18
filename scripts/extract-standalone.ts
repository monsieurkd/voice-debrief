// Live smoke test of extraction against a sample transcript. REQUIRES ZAI_API_KEY
// in .env.local. Usage: npm run extract:test   (sample[0])
//                        npm run extract:test -- 1   (sample[1])
//                        npm run extract:test -- stdin   (paste, Ctrl-D)
import { extractDebrief, ExtractionError } from '../src/lib/extract'
import { sampleTranscripts } from '../src/lib/sample-transcripts'

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = []
  for await (const chunk of process.stdin) chunks.push(chunk as Buffer)
  return Buffer.concat(chunks).toString('utf8')
}

async function main() {
  const arg = process.argv[2] ?? '0'
  let transcript: string
  if (arg === 'stdin') {
    transcript = await readStdin()
  } else {
    const idx = Number(arg)
    transcript = sampleTranscripts[idx]?.text ?? sampleTranscripts[0].text
    console.log(`# sample[${idx}]: ${sampleTranscripts[idx]?.label ?? ''}\n`)
  }

  try {
    const payload = await extractDebrief(transcript)
    console.log(JSON.stringify(payload, null, 2))
  } catch (e) {
    if (e instanceof ExtractionError) {
      console.error('Extraction failed:', e.message)
      process.exit(2)
    }
    throw e
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
