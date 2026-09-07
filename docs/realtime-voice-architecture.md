# Provider-neutral realtime voice architecture

**Status:** proposed

**Last reviewed:** 2026-09-06

**Decision:** use LiveKit as the realtime media and agent orchestration layer;
keep speech recognition, language model, and speech synthesis providers
replaceable.

## Why this change

The current voice path is turn-based:

```text
record a complete clip
  -> upload and transcode it
  -> transcribe it
  -> generate the assistant's text
  -> synthesize a complete audio file
  -> begin playback
```

This path is reliable and remains a useful fallback, but its serialized waits
make it feel like exchanging voice messages. The target experience is a live
conversation: automatic turn-taking, early playback, visible listening state,
and the ability to interrupt the assistant without losing the transcript.

## Product goals

- Start listening as soon as the user enters voice mode and grants microphone
  access.
- Target less than one second from a completed user turn to audible assistant
  speech under healthy network conditions.
- Let the user interrupt assistant speech and resume naturally.
- Preserve finalized user and assistant turns in the existing journal.
- Keep text input available in the same conversation.
- Keep STT, LLM, and TTS providers configurable rather than making one model
  vendor part of the product architecture.
- Retain the existing tap-to-record flow as a fallback when realtime setup or
  connectivity fails.

## Non-goals for the first release

- Multi-person rooms.
- Phone or SIP calling.
- Offline voice conversations.
- Perfect simultaneous overlapping speech.
- Self-hosting the LiveKit media plane before usage justifies the operational
  cost.

## Chosen architecture

```text
Browser (Next.js)
  |  WebRTC audio, data, connection state
  v
LiveKit room
  |
  v
LiveKit Agent worker (Node.js / TypeScript)
  |-- streaming STT provider
  |-- configurable LLM provider
  |-- streaming TTS provider
  |-- turn detector, VAD, interruptions
  |
  +--> What I Mean application API
         |-- authorize guest or account
         |-- create/load conversation
         |-- persist finalized turns
         `-- apply rate and usage limits
```

LiveKit owns realtime transport, room state, media subscription, turn handling,
and agent lifecycle. What I Mean continues to own identity, personas,
conversation data, authorization, and product behavior.

The agent runs as a persistent worker process. It must not run inside a Vercel
request or a short-lived Next.js serverless function.

## Why LiveKit

LiveKit provides WebRTC transport and an agent framework without requiring the
conversation model to be OpenAI. It supports two useful engine families:

1. A streaming `STT -> LLM -> TTS` pipeline. This is the default because every
   stage can be replaced independently and finalized transcripts are easy to
   audit and persist.
2. A provider-native realtime speech model. This can be enabled later for
   providers that support it, without replacing the room, frontend, identity,
   or storage layers.

LiveKit Cloud is the preferred starting point. LiveKit is open source, so the
media plane can be self-hosted later if cost, compliance, or infrastructure
control requires it.

## Provider boundary

Application code should depend on a small configuration contract, not on a
provider-specific SDK:

```ts
type VoiceEngineConfig =
  | {
      mode: 'pipeline'
      stt: ProviderConfig
      llm: ProviderConfig
      tts: ProviderConfig
    }
  | {
      mode: 'realtime'
      realtime: ProviderConfig
    }
```

The initial implementation uses `pipeline`. A future `realtime` implementation
may use any LiveKit-supported speech-to-speech provider. Provider capabilities
are not identical, so the common interface should cover only product needs:
streaming audio, finalized turns, interruption, text input, and errors.

Secrets live only in the agent environment or application server. Never send
model-provider credentials to the browser.

## Session lifecycle

1. The user presses **Start talking** or the microphone control.
2. The browser requests a short-lived LiveKit room token from What I Mean.
3. The token endpoint resolves the current account or creates/uses a guest,
   creates a conversation if necessary, and embeds only trusted identifiers in
   room metadata.
4. The browser joins the room and publishes its microphone track.
5. LiveKit dispatches the configured agent worker into that room.
6. The agent loads the selected persona and recent conversation context from a
   server-authorized application endpoint.
7. LiveKit detects the end of the user's turn. Streaming STT supplies the
   finalized text, the LLM begins generating, and streaming TTS starts playback
   as soon as audio is available.
8. The agent sends finalized user and assistant turns to the application API.
9. If the user speaks during assistant playback, the agent cancels pending
   speech, truncates the unheard response where supported, and begins the new
   turn.
10. Leaving voice mode disconnects the room and releases the microphone, while
    the conversation remains available as text.

## Turn-taking defaults

- Start with LiveKit's recommended semantic turn detector plus VAD.
- Prefer patient endpointing for this product: reflective pauses are expected
  and should not be mistaken for the end of a thought.
- Enable interruptions, but tune the minimum speech duration so coughs and
  background noise do not constantly cancel replies.
- Enable preemptive generation only after measuring false end-of-turn rates.
- Stop local playback immediately when an interruption is confirmed.

These values must be configuration, not scattered UI constants. Tune them from
observed sessions rather than intuition alone.

## Persistence and consistency

The database remains the source of truth for the journal; a LiveKit room is
ephemeral transport state.

- Assign every finalized turn a client-generated idempotency key.
- Persist the user turn before treating the assistant turn as durable.
- Store only finalized transcripts in `messages`; interim captions remain
  ephemeral UI state.
- Associate every write with a server-validated user id and conversation id.
- On interruption, store only text corresponding to audio the user actually
  heard when the provider exposes that boundary. Otherwise mark the assistant
  message as interrupted rather than pretending it completed.
- Retry persistence independently from audio playback so a temporary database
  failure does not freeze the live conversation.
- Flush outstanding finalized events before normal room shutdown, with a
  server-side retry path for abnormal disconnects.

The existing guest-to-account adoption behavior must continue to work because
the application, not LiveKit, owns the conversation records.

## Security and abuse controls

- The room-token endpoint must call `currentUserOrGuest()` and issue a
  short-lived token scoped to one room.
- Room names and metadata must use opaque ids; do not include email addresses,
  prompts, or transcript contents.
- The agent must authenticate to private application endpoints using a
  dedicated service credential.
- Every conversation read/write must verify ownership on the application
  server. LiveKit metadata is routing context, not authorization.
- Enforce concurrent-session, session-duration, transcription, model-token,
  and synthesized-audio budgets per user.
- Do not log raw audio by default. Document retention explicitly before adding
  recording or observability that captures content.
- Validate text and tool inputs at the application boundary. The model must not
  choose trusted user or conversation identifiers.

## Runtime and deployment

The system has three deployable units:

| Unit | Responsibility | Initial hosting |
|---|---|---|
| Next.js application | UI, auth, room-token endpoint, journal APIs | Existing web host |
| LiveKit media plane | WebRTC rooms and media routing | LiveKit Cloud |
| Agent worker | Turn detection and model pipeline | Persistent Node.js host or LiveKit Cloud |

The agent worker should live in this repository under a separate package or
workspace, for example `agent/`, while retaining its own start, test, and deploy
commands. Local development connects the Next.js app and local agent to a
development LiveKit project.

Expected configuration groups (exact names will be chosen during
implementation):

```text
LIVEKIT_URL
LIVEKIT_API_KEY
LIVEKIT_API_SECRET
VOICE_ENGINE=pipeline|realtime
VOICE_STT_*
VOICE_LLM_*
VOICE_TTS_*
AGENT_APP_SERVICE_TOKEN
APP_INTERNAL_URL
```

## Failure behavior

| Failure | User experience |
|---|---|
| Microphone denied | Keep text chat available and explain how to enable it |
| LiveKit connection fails | Offer reconnect and tap-to-record fallback |
| Agent does not join | Time out visibly, clean up the room, allow retry |
| STT fails | Keep listening state accurate and ask the user to repeat or type |
| LLM fails | Preserve the user's finalized transcript and retry safely |
| TTS fails | Show the assistant text and let the conversation continue |
| Network switches or sleeps | Attempt bounded reconnect without duplicating turns |
| Database write fails | Continue audio when safe and retry the idempotent write |

## Delivery phases

### Phase 0: measurement

- Add timestamps for speech end, final transcript, first LLM token, first audio,
  playback start, and interruption stop.
- Record aggregate latency and error metrics without recording raw audio.
- Establish the current tap-to-record baseline.

### Phase 1: isolated proof of concept

- Create a development LiveKit project and TypeScript agent worker.
- Join a room from a minimal development-only screen.
- Prove two-way streaming audio, automatic turn detection, and interruption.
- Use temporary in-memory history; do not modify the journal yet.

### Phase 2: product integration

- Add the authenticated room-token endpoint.
- Connect the existing chat screen and personas.
- Persist finalized turns idempotently into the existing schema.
- Support typed messages inside the live session.
- Preserve the current recorder as fallback.

### Phase 3: resilience and tuning

- Add reconnect, worker-unavailable, provider-timeout, and partial-TTS handling.
- Tune endpointing and interruptions using measured conversations.
- Add per-user usage budgets and operational dashboards.
- Test mobile Safari, Chrome, Firefox, headphones, speakers, noisy rooms, and
  network changes.

### Phase 4: provider experiments

- Benchmark at least two options for each pipeline stage.
- Compare cost, first-audio latency, transcription quality, emotional tone,
  interruption accuracy, and failure rate.
- Add a native realtime engine only through the `VoiceEngineConfig` boundary.

## Acceptance criteria for the first realtime release

- A guest can enter voice mode without signing up.
- The microphone is released whenever the session ends or the component
  unmounts.
- The assistant begins speaking with a measured p50 below one second after a
  clear end of turn on the primary deployment path.
- Speaking over the assistant stops audible playback promptly and starts a new
  turn.
- Refreshing the page shows the same finalized transcript in the journal.
- Duplicate transport events cannot create duplicate messages.
- Text chat and the existing recorded-audio fallback still work when realtime
  services are unavailable.
- Changing a configured provider does not require changes to the chat UI,
  authentication, or database code.

## Open decisions

- Which providers should be used for the first STT, LLM, and TTS benchmark?
- Should the agent worker call an internal application API or share the Drizzle
  data layer directly? The internal API is the safer initial boundary.
- What maximum session duration and per-user spend budget should the public
  demo enforce?
- Should interrupted assistant turns be visible in the journal or omitted?
- When should LiveKit Cloud be replaced or supplemented by self-hosting?

## References

- [LiveKit pipeline types](https://docs.livekit.io/agents/models/pipelines/)
- [LiveKit turn handling](https://docs.livekit.io/agents/logic/turns/)
- [LiveKit turn-taking tuning](https://docs.livekit.io/agents/logic/turns/tuning/)
- [LiveKit React starter](https://docs.livekit.io/frontends/start/starter-apps/react/)
- [LiveKit deployment guidance](https://docs.livekit.io/deploy/custom/deployments/)
- [OpenAI Realtime integration through LiveKit](https://docs.livekit.io/agents/models/realtime/plugins/openai/)
