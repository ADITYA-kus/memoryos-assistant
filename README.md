# Northstar Assistant

A separate customer chatbot integrating the hosted MemoryOS API through the
published `memoryo-sdk@0.1.1`. It is not a replacement MemoryOS backend or a
special extraction client.

## Run and deploy

Use a separate Clerk application for this assistant. Set the variables from
`.env.example` in `.env.local` or your deployment provider. Keep
`MEMORYOS_API_KEY`, `OPENAI_API_KEY` and `CLERK_SECRET_KEY` server-only.

```bash
npm ci
npm run dev
```

The local app runs on port 3001. Deploy this repository separately from the
marketing site. It uses the real hosted MemoryOS URL by default; no local SDK
link or local memory service is required.

## Integration boundaries

- Clerk's server-verified user ID maps to `assistant:<userId>` on every request.
  A browser-supplied MemoryOS identity is not accepted. Starting a new chat does
  not create a new memory identity.
- Retrieval uses the customer's message and returns typed context, clarification
  and source-review fields. The existing model prompt was not changed to rescue
  MemoryOS behavior. Authority, permissions and transitions remain backend-owned.
- Clarifications use `answerClarification()`. Missing-alternative source reviews
  use `answerSourceReview()` with the backend's opaque version and the user's
  clicked action. No natural-language confirmation regex is used here.
- Reviews appear inside the existing assistant conversation. `keep_current` or
  `dismiss` closes the pending interpretation without changing stored memory or
  raising authority. Stale/foreign responses disable the old card and ask for a
  refresh; the browser is not the authority for expiry or ownership.
- `restate` leaves the review pending and focuses the normal composer. Only the
  next actual user message goes through ordinary `add()` ingestion. The UI does
  not mark this as completed storage or automatically submit a replacement.
- Model output still streams. Review metadata is sent before tokens and before
  the queued-write acknowledgement. The app does not poll extraction jobs or
  wait for extraction before producing an answer.

## Verification

```bash
npm test
npm run lint
npx tsc --noEmit
npm run build
```

Tests use the installed published SDK with controlled HTTP/model responses;
they cover server identity, answer validation, backend error statuses, old
clarification compatibility, streaming order and review-card presentation.
They are not real-model accuracy, browser sign-in, load, or holdout evaluations.

After deployment, test with a signed-in account: state a default preference,
then express uncertainty between that preference and an alternative. Once
background processing completes, ask about the preference again. If MemoryOS
recognized uncertainty without a usable alternative, its review should appear
in chat. Choose **State it again**: the review must stay pending and the composer
must focus without a memory write. Submit your actual new statement normally.

Asynchronous ingestion has no immediate read-your-writes guarantee. This review
fallback does not guarantee semantic recognition of every wording, suppress all
pending-property context, or link restatement ingestion atomically to closing
the old review. See the [MemoryOS review contract](https://docs.memoryo.dev/api-reference/retrieve#review-an-uncertain-source-statement-in-your-existing-chat).
