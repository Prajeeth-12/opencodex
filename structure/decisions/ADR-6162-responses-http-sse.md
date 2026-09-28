# ADR-6162 — decision recorded under "Responses HTTP/SSE"

- Contract owner: [transports/responses.md](../transports/responses.md#responses-httpsse)

## Decision record

- 목적과 의도: Let ordinary OpenAI-compatible clients use non-streaming Responses JSON through a canonical Codex account without weakening terminal correctness.
- 기존 구현 및 제약 조건: The public Responses surface permits omitted or false `stream`, while the canonical ChatGPT Codex endpoint accepts only SSE; passthrough rewrites, continuation publication, usage logging, and account outcomes must remain single-owner effects.
- 검토한 주요 대안: Reject non-streaming clients; teach each integration to request SSE; rebuild JSON independently from deltas; or require SSE upstream and fold the bounded, rewritten terminal snapshot.
- 선택한 방식: Preserve the client preference separately, classify the actual canonical send as streaming for retry/recovery, require the first terminal and every observed output index to validate under explicit frame/transcript/item-count caps, merge sparse terminal and done items by stable identity/order, then return the complete response object as JSON.
- 다른 대안 대신 이 방식을 선택한 이유: Reusing the existing inspector and rewrite pipeline preserves tool, reasoning, refusal, annotation, usage, model, and continuation semantics that a second delta assembler would inevitably duplicate and drift.
- 장점, 단점 및 영향: Compatible non-streaming clients work without changing `store`; malformed, truncated, stalled, oversized, contradictory, open-index, or rewrite-failed streams return 502 rather than partial success. Serving-state/cache/outcome effects wait for raw and rewritten validation. The path retains one raw transcript up to 32 MiB, admits at most 100,000 SSE frames and 10,000 completed items, processes reader chunks in 64 KiB slices, streams the rewritten pass into its assembler, releases raw reconstruction before JSON serialization, and marks request-log metadata as already inspected so the client JSON is not retained and parsed again. This has higher latency and bounded-but-larger memory use than SSE delivery.
