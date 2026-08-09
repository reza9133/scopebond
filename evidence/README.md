# Evidence fixtures

`example/` holds one worked set of the four documents ScopeBond's `rule()`
fetches during adjudication, for a milestone that should land on
`PARTIALLY_MET`:

| File | Plays the role of |
|---|---|
| `brief.json` | `brief_url` — pinned at construction |
| `delivery-manifest.json` | `delivery_url` — locked at `submit_delivery()` |
| `client-feedback.json` | `client_feedback_url` — locked at `open_dispute()`, optional |

There is no `reference-tests.json` in this example because
`reference_tests_url` is optional; the contract passes
`"[NO REFERENCE TESTS SUPPLIED]"` to the prompt when it's empty.

These are fabricated fixtures for prompt and schema testing — `example-org`,
the repository, and the demo URL are not real services. If you use this
project as a template, replace the fixtures with your own milestone's actual
brief and evidence, and make sure every URL is commit-pinned (a specific Git
commit or an immutable content hash, not a floating branch) — a source that
can change between one validator's fetch and another's is the easiest way to
manufacture honest validator disagreement.
