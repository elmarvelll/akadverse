# Stuwart voice input

Stuwart reuses the shared AssemblyAI speech-to-text implementation. In Study Zone, press the microphone beside Send, allow microphone access, and speak. Transcription appears in the message draft. Press Stop, review or edit the text, then press Send. Recording never sends a chat message automatically; Send is disabled while connecting, recording, or finalizing.

Cancel removes the current unedited partial transcript while preserving completed turns and manual edits. Changing course, week, document, or conversation, or leaving Stuwart, disposes the recording session and releases the microphone.

## Configuration

Set `ASSEMBLYAI_API_KEY` on the server, using `.env` or `.env.local` locally and the deployment environment in production. Never use a `NEXT_PUBLIC_` variable for this key. Microphone access requires HTTPS or localhost and browser permission.

The authenticated `/api/speech/token` route issues a temporary provider token. The browser streams microphone audio directly to AssemblyAI using the existing audio worklet and session implementation. The permanent API key stays on the server. The integration does not add a database table.

Optional server settings are `SPEECH_MAX_RECORDING_SECONDS` (default 120) and `SPEECH_SILENCE_TIMEOUT_SECONDS` (default 45).

## Implementation

- `src/app/e-learning/student/study-zone/_components/StuwartPanel.tsx`: microphone controls, controlled draft, conversation context, and Send guard.
- `src/app/components/voice/useSpeechToText.ts`: shared draft integration and session cleanup.
- `src/app/components/voice/VoiceInputControls.tsx`: microphone, Stop, Cancel, and accessible status.
- `src/lib/speech/session.ts` and `draft.ts`: audio transport, lifecycle, and partial/final transcript reconciliation.
- `services/speech/assemblyai.ts` and `src/app/api/speech/`: temporary tokens and usage diagnostics.

## Focused verification

```sh
node --import tsx --experimental-test-module-mocks --test tests/speech/*.test.ts
```

The speech tests cover draft reconciliation, manual edits, Stop/Cancel behavior, audio conversion, session cleanup, token authorization, rate limiting, and provider failure handling. Restoration checks passed all 16 speech tests, TypeScript checking, and Stuwart component linting. A live microphone/provider session was not exercised as part of this restoration.

For manual acceptance, speak a question, check the live draft, Stop, edit, and Send once. Also check Cancel, denied microphone permission, switching conversations while recording, and a narrow mobile viewport. Verify the AssemblyAI key in the deployed environment before testing production.
