Habermas Machine — third-party attribution

Copyright 2025 Google LLC
Copyright 2024 DeepMind Technologies Limited

Source: https://github.com/google-deepmind/habermas_machine
Licensed under Apache License 2.0. See public/licenses/habermas-machine.txt.

Libert adapts the prompted mediation workflow and translates the Schulze
winning-votes algorithm to JavaScript. Changes include connected OpenAI models,
adapted output prompts, optional shared discussion context, Mulberry32 ordering,
explicit human critique input, resumable steps and an independent comparison rubric.
It does not use the fine-tuned models or report the original study's results.
Source file blob identifiers are recorded in lib/deliberation.mjs.

Interface dependencies added for group rooms and rich text

- MQTT.js 5.16.1 — MIT License — https://github.com/mqttjs/MQTT.js
- node-qrcode 1.5.4 — MIT License — https://github.com/soldair/node-qrcode
- react-markdown 10.1.0 — MIT License — https://github.com/remarkjs/react-markdown
- remark-gfm 4.0.1 — MIT License — https://github.com/remarkjs/remark-gfm

Group rooms use the public EMQX test broker over secure WebSocket as an encrypted live relay. Room content is encrypted in the browser before publication; the broker is not a durable Libert data store.
