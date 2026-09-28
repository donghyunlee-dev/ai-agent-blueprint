# Architecture patterns

Choose one primary pattern and add another only when phase boundaries require it.

| Pattern | Use when | Main risk |
| --- | --- | --- |
| Pipeline | Each phase consumes the previous result | Early errors propagate |
| Fan-out/fan-in | Independent analyses can run concurrently | Duplicate work and merge conflicts |
| Expert pool | Only some specialists apply per request | Routing ambiguity |
| Producer-reviewer | Independent quality review materially improves output | Endless review loops |
| Supervisor | Work must be assigned dynamically as facts emerge | Central bottleneck |
| Hierarchical delegation | The domain naturally decomposes into nested work | Token and coordination explosion |

## Separation test

Create a custom agent only when at least one condition is strong:

- It needs distinct expertise or tool access.
- It can run independently and reduce elapsed time.
- Isolating its context improves accuracy.
- The role will be reused across workflows.
- It must independently review another agent's work.

Keep the work in the parent agent when the task is small, the same files must be edited, or handoff cost exceeds the likely benefit.

## Team sizing

- Small workflow: 2–3 agents.
- Medium workflow: 3–5 agents.
- Large workflow: 5–6 agents only with explicit ownership and dependencies.

Default to `max_depth = 1`. Recursive delegation is an exception because it increases cost and makes completion less predictable.
