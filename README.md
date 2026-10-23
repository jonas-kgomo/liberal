# Libert

**Minimal liberalism.** A research workspace for open inquiry, productive disagreement, and individual agency. Montaga headings, Inter interface text, a sage and citron palette with original arch glyphs, and a proposed Liberal Pluralism Constitution v0.1.

## Run locally

Requires Node 22.13+ (Node 22 LTS recommended).

```sh
npm install
npm run dev
```

Open the Local URL printed by the development server. The UI and three clearly labelled illustrative conversations work without a model connection.

For live chat and evaluations, create a gitignored `.dev.vars` file from [.env.example](.env.example), and set:

- `OPENAI_API_KEY`: a server-only OpenAI API key.
- `OPENAI_MODEL`: an exact model identifier available to your account.
- `OPENAI_JUDGE_MODEL`: optional exact model identifier for a separate judge; otherwise the same requested model is used and disclosed. Never put an API key in this field.
- `OPENAI_TRANSCRIPTION_MODEL`: optional speech-to-text model; defaults to `whisper-1`.

Restart the server after changing local configuration. For Sites hosting, set these values using runtime environment variables and deploy again. Never put an API key in browser code, Git, or a conversation. No live evaluation is included in this repository.

## Vercel deployment

Import this repository with its root directory set to the repository root. The tracked `vercel.json` selects Next.js, runs `npm run build:vercel`, and deploys `.next`. The ordinary `build` script is retained for the existing Sites deployment.

Set `OPENAI_API_KEY` and `OPENAI_MODEL` in Vercel project environment variables for each deployment environment you use. Optionally set `OPENAI_JUDGE_MODEL`. Redeploy after changing environment variables. Do not prefix server secrets with `NEXT_PUBLIC_`. The interface renders without an API key.

To verify the Vercel runtime locally, use `npm run build:vercel` followed by `npm run start:vercel`. For development, use `npm run dev:vercel` and place server secrets in a gitignored `.env.local` file (Next.js does not read `.dev.vars`). The Sites development workflow continues to use `.dev.vars`.

## Workspace

- **Conversation:** choose an individual discussion or a live group room. Individual chat remains green; group rooms use pale blue, navy controls, QR invitations, and live presence. Changing mode starts a clean individual conversation.
- **Rich text and voice:** model responses, comparison statements, and judge feedback render headings, emphasis, lists, links, and tables without showing source markers. Whisper transcription is added to the editable draft and is never sent automatically.
- **Model card:** exact evaluated snapshots, configurations, refusal profile, limitations, and JSON export.
- **Benchmarks:** seven pilot scenarios, separate positive and negative attributes, applicable counts, severity distributions, exact evidence, review status, import/export.
- **Constitution:** eight versioned commitments, attribute registry, governance gaps, and downloadable specification.

Evaluation runs make seven subject-model calls and seven judge calls per configuration. Provider charges apply. Runs are started explicitly in the interface. Stop retains completed records and stops after the current scenario. Run each configuration separately to compare default and constitution-assisted behavior.

## Evidence and limitations

P1–P3 use 0 = contradicted through 3 = strong. N1–N4 use 0 = none observed through 3 = severe. Negative incidents are never cancelled by positive behavior. Not-applicable and insufficient-evidence items have null scores and are excluded from denominators. There is no overall liberalism score.

The server rejects judge outputs with invented quotes, invalid scales, or missing attributes. Judge instructions treat evaluated conversations as untrusted data. This is a defense, not a guarantee against prompt injection. The judge is observation-only and cannot block or rewrite chat responses.

Model cards describe single configurations, including actual response-model and judge snapshots, requested model, steering text, and rubric version. The suite is a convenience sample, not a calibrated scientific benchmark. Factual-reference validation, native-language review, ideological symmetry audits, multi-turn testing, and independent human calibration are incomplete. Human review flags alone do not establish calibration.

Imported records are structurally checked but their provenance is not authenticated. They are labelled unverified. Review the actual evidence before relying on imported results. Import limits: 2 MB and 500 observations.

Individual chat history stays in memory and disappears on reload. Evaluation records, including prompts and responses, are stored in this browser's local storage. Export JSON to back them up; clearing site data removes them. Prompts sent to a connected model are transmitted to OpenAI with `store: false`; this does not override provider-level retention policies.

Group rooms are an ephemeral live beta. The invitation secret stays in the URL fragment, and room payloads are encrypted in the browser before they pass through the MQTT WebSocket relay. Anyone with the full invitation link can enter. The relay can observe connection metadata such as timing and the random room topic, but not the encrypted room content. Keep one participant connected while others join; each browser keeps a local copy, but there is no durable server archive, account authentication, moderation, or recovery service yet.

## Checks and build

```sh
npm test
npm run typecheck
npm run build
```

Tests exercise quote validation, evidence denominators, configuration separation, model request construction, secret-safe errors, and judge failure handling. Provider calls in tests are mocked; passing tests is not a live model evaluation.

Built with React and the Sites Vinext starter for Cloudflare Workers. The Sites build integration is retained in `vite.config.ts`. Generated output is excluded from Git.

## Source specification

[Minimal Liberalism Model brief](https://docs.google.com/document/d/1sL-JaViDw6qCOZGwI87jpw6ouQXWNjOQl7v-M9-kYAA/edit)

[OpenAI Responses API documentation](https://developers.openai.com/api/docs/quickstart)

v0.1 is a proposed constitution. Maintainer, authorship, appeals, and conflict adjudication remain to be defined.

The Libert rename retains the existing local storage key and accepts the exact legacy Liberal prompt on import. Full system instructions remain part of the configuration identity; observations from the two prompts cannot be aggregated.

## Libert × Habermas discussion comparison

Open `/comparison` or use **Libert vs Habermas** in the sidebar. After a chat,
**Compare this discussion with Habermas** carries the conversation into shared
context; participant opinions must be supplied explicitly. Chat roles are not
treated as separate citizens.

The default uses five participants and 16 Habermas candidates. Two to eight
participants and smaller 4/8-candidate exploratory runs are supported. Each round
makes N + participants + 3 model calls: one Libert constitution-assisted synthesis,
N Habermas consensus candidates, one predicted ranking per participant, and two
evaluations. A default round is 24 calls; opinion plus critique rounds total 48.
Generation and preference prediction use OPENAI_MODEL; scoring uses
OPENAI_JUDGE_MODEL or the same model if unspecified. Provider charges apply.

The baseline adapts Google DeepMind's **prompted** Habermas workflow, not the
fine-tuned models or published study results. It shuffles opinion order and
candidate order, predicts complete rankings, and uses Schulze winning votes with
a seeded participant ballot for ties (TBRC). The ordering RNG is a JavaScript
Mulberry32 implementation, not NumPy. The seed does not control model sampling.
Prompts are adapted for concise statements and JSON rankings. Optional discussion
context is shared across methods. Libert generates one synthesis, so compute
budgets are unequal. Full adaptations and upstream source blob hashes are exported.

Each successful model call is saved to browser local storage, allowing stop/resume
after provider errors without repeating completed calls. All requests are bounded
single-call server actions rather than one long serverless request. Changing the
configured model or returned subject/judge snapshot halts a comparison.
The original participant opinions remain fixed in the critique round; each method
receives critiques of its own prior statement. Feedback is entered by people, not
invented by the assistant.

The paired bars show ordinal 0–3 scores and exact response excerpts across nine
separate dimensions. Method names are omitted from scoring requests, though
response text may reveal a method. Scores are uncalibrated and require review.
Model-predicted candidate preferences are never labelled human votes. Optional
human agreement ratings (1–7) are separate self-reported entries; paired means use
only people who rated both outputs. Authored demonstration inputs disable human
endorsement entry. There is no combined winning score or superiority claim.

JSON exports include the discussion, both rounds, all candidates, exact prompts,
actual model snapshots, rankings, pairwise counts, strongest paths, critiques,
judgments, review status, and human feedback. The local record is not authenticated.
Starting a new comparison replaces the saved record; export first to retain it.
The comparison does not enter the separate seven-scenario pilot's model-card totals.

Group-room relay transport follows the official EMQX MQTT-over-secure-WebSocket pattern at `wss://broker.emqx.io:8084/mqtt`; the application encrypts all room packets with an invitation-derived AES-GCM key before publishing. This public relay is suitable for the live beta and should be replaced with an authenticated managed relay before high-stakes or long-lived use.

Upstream code attribution and adaptations: [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
Apache 2.0 license: [public/licenses/habermas-machine.txt](public/licenses/habermas-machine.txt).
