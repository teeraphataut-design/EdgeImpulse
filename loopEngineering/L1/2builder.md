# Loop Engineering Process

> **Cycle:** Goal → Context → Action → Check → Fix → Repeat → Review
>
> All paths are relative to the project root (the folder that contains `Skill.md`). See `Skill.md` § How the Files Work Together.

---

## Main Loop

```
main {
    think       ← Read context, resolve questions, plan tasks with acceptance checks   (Phase 1–3)
    for each task in TASK.md {
        build   ← Do exactly one task                                                  (Phase 4)
        verify  ← Run the task's checks, use failures as feedback, fix, re-check       (Phase 4)
        commit  ← Mark [x] only after all checks pass, then checkpoint                 (Phase 4)
    }
    review      ← Check every requirement end-to-end, then log the session            (Phase 5–6)
}
```

| Cycle step | Where it happens |
| --- | --- |
| Goal | Phase 1 — `L1/1requirment.md` |
| Context | Phase 1–2.5 — input files, prior state, developer answers |
| Action | Phase 4, step A — build one task |
| Check | Phase 4, step B — run the task's checks |
| Fix → Repeat | Phase 4, step C — fix and re-run the checks (within the Error Budget) |
| Review | Phase 5 — requirement-by-requirement review + human checkpoint |

---

## Startup Sequence — When Triggered to Start

Execute these steps **in order** every time you are triggered:

### Phase 1: Read

1. Read `Skill.md` — understand your **role, standards, and constraints**
2. Read `L1/1requirment.md` and `L1/3api-contract.md` — understand **what** to build and the **API contract**

### Phase 2: Think

3. Read `DECISION.md` — check prior design decisions (create empty if missing)
4. Read `TASK.md` — check current task status (create empty if missing)
5. Read `CLARIFICATIONS.md` and **only the latest session** in `SESSION.md` (its `Next` list is your starting point; older sessions are history) — create missing files as empty
6. Decide whether this is a **new start** or a **resume**:
   - **New start** — `TASK.md` is empty → continue to Phase 2.5
   - **Resume** — `TASK.md` has tasks → continue from the task marked `[/]`, otherwise the first `[ ]` task. Use the `Next` list of the latest session in `SESSION.md` as context. Go to Phase 2.5 only for **new** questions; do not re-ask questions already answered in `CLARIFICATIONS.md`
7. Summarize your understanding back to the human, including whether this is a new start or a resume and which task comes next

### Phase 2.5: Clarification Gate

> **Do NOT proceed to planning or building until every ambiguity is resolved.**

8. Review your understanding — identify anything that is **unclear, ambiguous, or assumed** about:
   - Architecture (page structure, component layout, data flow)
   - Tech stack (libraries, APIs, protocols, versions)
   - Scope (which features are in/out, edge cases)
   - Design (UI style, colors, responsive behavior)
   - **Conflicts between input files** (e.g. `L1/1requirment.md` vs. `L1/3api-contract.md`)
   - Any other aspect of the project
9. **Ask the developer** about every unclear point — list your questions explicitly and number them
10. **Wait for answers** — do not guess, do not assume, do not proceed. Record each answered question in `CLARIFICATIONS.md` (format in `Skill.md` § Output Format)
11. Repeat steps 8–10 until **every question you asked has a recorded answer** in `CLARIFICATIONS.md` and re-reading the input files raises no new question
12. State: "All questions resolved — proceeding to planning" before moving on

### Phase 3: Plan

13. Break the remaining work into small, ordered tasks. A task is small enough when it can be built and checked in one pass
14. Give **every task an acceptance check** — a concrete, observable result that proves the task is done (see § Task Format). A task without a check is not ready to start
15. Update `TASK.md` with the task list (mark pending items as `[ ]`)
16. Update `DECISION.md` with any new design decisions you made — decisions the developer made belong in `CLARIFICATIONS.md`

### Phase 4: Build → Verify → Fix (repeat for each task)

Run steps A–E for **one task**, then start again at A with the next task.

- **A. Build** — Mark the task `[/]` in `TASK.md`, then do only that task
- **B. Check** — Run the task's acceptance check **and** the standard checks (see § Verification Checks). Record what you ran and what you saw — do not mark a check as passed without evidence
- **C. Fix** — If any check fails, use the error message or the observed difference as feedback, fix, and go back to **B**. Re-run **all** checks for the task, not only the one that failed, so a fix does not break something else. Count every fix attempt against the **Error Budget** (§ Stop Conditions)
- **D. Commit** — Only when every check passes, mark the task `[x]` in `TASK.md`. If the change affects an earlier task, re-run that task's acceptance check too
- **E. Checkpoint** — When the task completes a **milestone** (e.g. login page done, dashboard done), update `SESSION.md` and stop at the **Human Checkpoint**

### Phase 5: Review

Run this after the last task in `TASK.md` is `[x]`.

17. Go through `L1/1requirment.md` section by section and mark each requirement **pass / fail** with evidence (which file, which check). Include every answer recorded in `CLARIFICATIONS.md` and every rule in `Skill.md` § Backend & Security Standards
18. Do one final security pass — XSS vectors (`innerHTML` with server data), tokens in `console.log` or `localStorage`, unvalidated server values
19. Any **fail** becomes a new `[ ]` task in `TASK.md` with its own acceptance check → go back to Phase 4
20. When everything passes, report the review result to the human and wait for confirmation (§ Human Checkpoint)

### Phase 6: Log

21. Update `SESSION.md` — log what was done, what files changed, and why (format in `Skill.md` § Output Format). The `Next` list is where the next session starts
22. Log a session **every time you stop**, for any reason: milestone, Phase 5 done, error budget reached, the human says stop, or the conversation is about to end. An unlogged session cannot be resumed

---

## Task Format

Each task in `TASK.md` uses the format from `Skill.md` § Output Format, with one `Verify` line underneath:

```markdown
- [ ] Create login.html + login.css
  - Verify: page renders the username/password fields and the "Login to Dashboard" button at 320px and 1280px; empty submit shows an error message
- [ ] Create auth.js login chain
  - Verify: valid login stores token, refreshToken, customerId, deviceId in sessionStorage and opens dashboard.html; wrong password shows "Invalid username or password"
```

A good `Verify` line is **observable** (something you or the human can see, run, or read) and **traceable** to a line in `L1/1requirment.md`, `L1/3api-contract.md`, `Skill.md`, or `CLARIFICATIONS.md`.

---

## Verification Checks

Run these in step B for every task, in addition to the task's own `Verify` line. Pick the strongest check you can actually run — **running something beats reading the code**.

| Check | How (strongest first) |
| --- | --- |
| Syntax | Run a syntax check if a tool is available (e.g. `node --check js/<file>.js`); otherwise load the page and confirm the browser console shows no errors; reading the code is the last resort |
| Behavior | Open the page in a browser and perform the `Verify` action. If you cannot open a browser, give the human exact steps and **wait for their result** (§ Human Checkpoint) |
| API | Compare every request path, header, and body with `L1/3api-contract.md` |
| Standards | Compare with the relevant rules in `Skill.md` (design, security, error handling) |
| Security | No `innerHTML` with server data, no tokens in logs or `localStorage`, every server value validated before rendering |

When a check depends on the human (e.g. a real device, real credentials), the human's reply is the check result. Treat a failure they report exactly like a failed check in step C.

---

----------------- | -------------------------------- |
| `Skill.md`            | Role, standards & constraints    |
| `L1/1requirment.md`   | Requirements & scope             |
| `L1/3api-contract.md` | API contract & schemas           |
| `DECISION.md`         | Prior design decisions           |
| `TASK.md`             | Current task list                |
| `SESSION.md`          | Session history                  |
| `CLARIFICATIONS.md`   | Requirement clarifications & Q&A |

---

## Output (Write / Update)

| File                 | When                                  | What to update                                   |
| -------------------- | ------------------------------------- | ------------------------------------------------ |
| `CLARIFICATIONS.md`  | Phase 2.5, and whenever the human answers a new question | Question, answer, impact          |
| `TASK.md`            | Phase 3, Phase 4 (A, D), Phase 5 (19) | Tasks with `Verify` lines; `[ ]` → `[/]` → `[x]` |
| `DECISION.md`        | Phase 3, and whenever you make a design decision | Context, decision, alternatives       |
| `SESSION.md`         | Phase 4 (E), Phase 6                  | Done, files changed, next                        |

---

## Human Checkpoint

Pause, report to the human, and **wait for their reply** before continuing when:

- You are **unsure** about a design decision
- A task has **security implications**
- You have completed a **milestone** (e.g. login page done, dashboard done) — give the human the exact steps to verify it
- A check needs the human (real device, real credentials, a browser you cannot open)
- You need to **deviate** from the current plan
- Phase 5 review is complete

Treat the human's reply as feedback: approval → continue; a reported problem → a failed check in Phase 4 step C; a new instruction → record it in `CLARIFICATIONS.md` and update `TASK.md`.

---

## Stop Conditions

**Done** — the loop ends successfully only when **all** of these are true:

- All tasks in `TASK.md` are marked `[x]`
- The Phase 5 review shows every requirement in `L1/1requirment.md` as **pass**
- The human has confirmed the Phase 5 review

**Halt** — stop immediately, log the session (Phase 6), and escalate to the human when **any** of these happens:

- The human explicitly says to stop
- **Error Budget:** A blocking error in the current task cannot be resolved after **3 total fix attempts**. If the **same error** (matched by error message or root cause) appears in **2 of those 3 attempts**, stop immediately — the approach is fundamentally wrong. In all cases: escalate to the human with a summary of what was tried and why it failed. The budget resets for each new task
- A **security risk** is found (see `Skill.md` § Development Constraints)

---

## Rules

- Do **one task** at a time — a task is a single entry in `TASK.md`. One task may touch multiple related files (e.g. `login.html` + `login.css`), but do not combine tasks from different features
- Never mark a task `[x]` before its checks pass — "written" is not "done"
- If unsure, follow the **Clarification Gate** (Phase 2.5) protocol
- If there is an error, use the **error message as feedback** and fix in the next loop
- After finishing, **summarize** all files created or modified

---

## Example

**Trigger**: "Start building L1"

**Agent response**:

1. ✅ Read `Skill.md` — Role: AI Developer, Stack: HTML/CSS/JS + ThingsBoard
2. ✅ Read `L1/1requirment.md` — Goal: build login + dashboard pages
3. ✅ Read `L1/3api-contract.md` — Host, endpoints, WS subscription, sensor ranges
4. ✅ Read `DECISION.md` — Empty, no prior decisions
5. ✅ Read `TASK.md` — Empty → **new start**
6. ✅ Read `SESSION.md` and `CLARIFICATIONS.md` — Empty, first session

**Summary**: New start. Building a 2-page IoT dashboard. Login page authenticates via ThingsBoard REST API. Dashboard page shows real-time telemetry via WebSocket.

**Clarification Gate**: 1. … 2. … *(wait for answers, record them in `CLARIFICATIONS.md`)*

**TASK.md updated**:
```
- [ ] Create common.css with CSS variables and base styles
  - Verify: all colors, spacing, radii and fonts are CSS variables; Inter loads; no console errors
- [ ] Create login.html + login.css
  - Verify: fields + "Login to Dashboard" button render at 320px / 768px / 1280px
- [ ] Create auth.js module (login, token refresh, get credentials)
  - Verify: valid login fills sessionStorage and opens dashboard.html; wrong password shows a friendly error
- [ ] Create dashboard.html + dashboard.css
  - Verify: 4 widget areas + Logout render at 320px / 768px / 1280px
- [ ] Create ws.js module (WebSocket telemetry subscription)
  - Verify: browser shows incoming telemetry; disconnect triggers 1s, 2s, 4s… reconnect
- [ ] Create rpc.js module (device RPC commands)
  - Verify: toggle sends the RPC from L1/3api-contract.md; device offline shows "Device not responding"
- [ ] Integration test: login → dashboard → live data
  - Verify: human confirms live values and LED toggle on the real device
```

**Starting task 1**: mark `[/]` → create `common.css` → run checks → mark `[x]`…
