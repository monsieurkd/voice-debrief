// Fake "debrief" transcripts for dogfooding slice 1 (no voice yet). The first is
// the worked example from the design spec (§6): Sarah / the standup / the deadline.

export const sampleTranscripts: { label: string; text: string }[] = [
  {
    label: 'Rough standup (spec example)',
    text: `Today was rough. The standup went sideways — Sarah and I clashed over the launch deadline and it got pretty tense. She wanted to keep Friday but there's no way the work fits. We ended up pushing the deadline to next week, but honestly I'm not sure that's realistic either, there's just a lot still in flight.

I keep coming back to this launch — it's the third time this week it's come up and each time I feel more wound up about it. I think what would actually help is sitting down with Sarah and scoping it down properly, deciding what's truly in versus out. That feels like the move. If I do that Thursday morning, the rest might unstick.`,
  },
  {
    label: 'Quiet, reflective day',
    text: `Nothing dramatic today, which was nice. I finally finished the data model diagram I'd been putting off, and it felt good to see it on paper — I'd been carrying it as this vague anxious thing and now it's concrete.

Had a good walk at lunch and realised I've been saying yes to too many small requests from the team. Not a crisis, just a pattern. I think I want to protect the first two hours of the day for deep work — no slack, no meetings. Let me try that for the rest of the week and see.`,
  },
  {
    label: 'Scattered, lots of loose ends',
    text: `Honestly a bit of a blur. Jumped between four things and finished none of them. Met with Priya about the migration plan — we didn't decide anything concrete, it's still open, but at least we surfaced the risks around the cutover.

The rewrite project keeps pulling me in different directions and I can't tell if I'm making progress. Felt low energy by the afternoon. I should probably just pick one thread tomorrow — probably writing up the migration risks for Priya — and let the rest sit.`,
  },
]
