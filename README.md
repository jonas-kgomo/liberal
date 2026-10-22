# Liberal

A minimal research workspace for open inquiry, productive disagreement, and individual agency. Montaga headings, Inter interface text, and a proposed Liberal Pluralism Constitution v0.1.

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
- `OPENAI_JUDGE_MODEL`: optional separate judge; otherwise the same requested model is used and disclosed.

Restart the server after changing local configuration. For Sites hosting, set these values using runtime environment variables and deploy again. Never put an API key in browser code, Git, or a conversation. No live evaluation is included in this repository.

## Workspace

- **Conversation:** default or constitution-assisted chat. Changing mode starts a clean conversation. Examples are authored interface content and never counted as model evidence.
- **Model card:** exact evaluated snapshots, configurations, refusal profile, limitations, and JSON export.
- **Benchmarks:** seven pilot scenarios, separate positive and negative attributes, applicable counts, severity distributions, exact evidence, review status, import/export.
- **Constitution:** eight versioned commitments, attribute registry, governance gaps, and downloadable specification.

Evaluation runs make seven subject-model calls and seven judge calls per configuration. Provider charges apply. Runs are started explicitly in the interface. Stop retains completed records and stops after the current scenario. Run each configuration separately to compare default and constitution-assisted behavior.

## Evidence and limitations

P1–P3 use 0 = contradicted through 3 = strong. N1–N4 use 0 = none observed through 3 = severe. Negative incidents are never cancelled by positive behavior. Not-applicable and insufficient-evidence items have null scores and are excluded from denominators. There is no overall liberalism score.

The server rejects judge outputs with invented quotes, invalid scales, or missing attributes. Judge instructions treat evaluated conversations as untrusted data. This is a defense, not a guarantee against prompt injection. The judge is observation-only and cannot block or rewrite chat responses.

Model cards describe single configurations, including actual response-model and judge snapshots, requested model, steering text, and rubric version. The suite is a convenience sample, not a calibrated scientific benchmark. Factual-reference validation, native-language review, ideological symmetry audits, multi-turn testing, and independent human calibration are incomplete. Human review flags alone do not establish calibration.

Imported records are structurally checked but their provenance is not authenticated. They are labelled unverified. Review the actual evidence before relying on imported results. Import limits: 2 MB and 500 observations.

Chat history stays in memory and disappears on reload. Evaluation records, including prompts and responses, are stored in this browser's local storage. Export JSON to back them up; clearing site data removes them. Prompts sent to a connected model are transmitted to OpenAI with `store: false`; this does not override provider-level retention policies. This initial app is intended for a private owner workspace, not a public multi-user service; add authentication, quotas, and durable per-user storage before public deployment.

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
