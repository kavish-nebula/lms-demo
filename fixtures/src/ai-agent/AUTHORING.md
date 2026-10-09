# Authoring guide: Build Your First AI Agent

This folder is the **source** of the course. You write compact JSON here; the build script expands it into the files the app reads, and the audio script turns every narration sentence into an MP3.

```
fixtures/src/ai-agent/
  course.json            course spine: modules, lessons, topic titles, finale steps (do not change ids)
  intro.json             the course preview video shown during enrolment: about a minute, building trust by
                         showing the end of the course (the finished agent working, what the learner will be
                         able to do, what it takes, what they'll walk away with); it does not tour the modules
  precheck.json          12 prior-knowledge questions asked before Module 1
  finale.json            mini project brief, final assessment, reflection prompts
  m1/ ... m6/
    video-1.1.json ...   one narrated slide video per lesson (5 per module)
    blocks.json          the module's other phases: hook, worked, guided, lab, review
    assessment.json      the module check that closes the module (phase 7)
```

The learner meets a module as numbered parts under side headings, in this order: **The problem** (hook), **Learn the ideas** (one part per lesson video), **See it work** (worked), **Build it** (guided), **Apply it** (lab), **Check yourself** (assessment) and **Make it stick** (review). Each part shows what the learner does in it, so keep counts sensible: 2 or 3 worked examples, 6 to 8 guided steps, 3 scenarios.

Commands (run from the repository root):

```
node fixtures/scripts/build-ai-agent.mjs --check m3   # validate one module, write nothing
node fixtures/scripts/build-ai-agent.mjs              # validate everything and write fixtures/*.json
python fixtures/scripts/make-audio.py                 # create missing narration MP3s in apps/web/public/audio
```

The checker prints every problem with its file and path. Fix them all until it prints `OK`.

---

## 1. The course in one paragraph

Learners are beginners to AI agents. Many can read a little Python; some never have. Every module follows **Orbit Outdoor**, a small online shop for hiking, camping and climbing gear, whose support team is drowning in "where is my order?" tickets. Across the course the learner builds **Scout**, Orbit's support agent. By Module 6 Scout reads a question, calls tools, remembers the conversation, follows policy, hands over to a person when it should, and runs behind an API with limits.

### The story world (keep it consistent)

| Who / what | Details |
|---|---|
| Maya Chen | Founder of Orbit Outdoor. Direct, impatient with jargon. |
| Leo Park | Support lead. Lives in the ticket queue; knows every customer complaint. |
| Priya Nair | Orbit's only developer. Helps the learner; dry humour. |
| Sam Okoro | Runs the warehouse; owns the stock sheet. |
| The learner | New on the team, building Scout. Address them as "you". |
| Scout | The agent the learner builds. |
| Orders | IDs like `ORB-10482`. An order has items, status, carrier, tracking number, total. |
| Carrier | ParcelPath, a tracking API that sometimes times out. |
| Policy | Returns within 30 days. Free return shipping on orders over $75. Refunds over $200 need a person to approve. Scout never promises what the policy doesn't say. |
| Scout's tools (by Module 5) | `get_order(order_id)`, `track_parcel(tracking_number)`, `check_stock(sku)`, `search_policy(query)`, `request_refund(order_id, amount, reason)` (needs approval over $200), `hand_off(summary)` |

Customers can be named (Ana, Tom, Grace, Ravi, Elena, Owen...). Keep it light and human; no brand names of real shops.

### Shared data (use these exact values everywhere)

Orbit's policy file, `docs/policy.md` in the learner's project:

```
# Orbit Outdoor policies
## Returns
You can return any unused item within 30 days of delivery for a full refund. Items must be unused and in their original packaging.
## Return shipping
Return shipping is free on orders over $75. Under $75, a $6.95 return label is taken off the refund.
## Refunds
Refunds go back to the original payment method within 5 business days of the return arriving. Refunds over $200 must be approved by a member of the support team.
## Exchanges
Exchanging for a different size is free if the new size is in stock.
## Shipping
Standard shipping takes 3 to 5 business days. Express takes 1 to 2 business days.
## Damaged items
Send a photo within 7 days of delivery and we send a replacement or a full refund.
```

Sample orders (`data/orders.json` from Module 5 on; earlier modules may mention them):

| Order | Customer | Items | Total | Status | Tracking |
|---|---|---|---|---|---|
| ORB-10482 | Ana Ruiz, ana@example.com | Trailhead 2P tent, green (TENT-2P-GRN) | $240.00 | shipped | ParcelPath PP-88213 |
| ORB-10517 | Grace Liu, grace@example.com | Ridge hiking boots, size 38 (BOOT-RDG-38) | $165.00 | delivered 62 days ago | PP-87102 |
| ORB-10533 | Ravi Shah, ravi@example.com | Summit sleeping bag (BAG-SUM-REG), foam mat (MAT-FOAM) | $188.00 | processing | none yet |
| ORB-10560 | Elena Petrova, elena@example.com | Dynamic climbing rope 60 m (ROPE-DYN-60) | $189.00 | in transit | PP-90417 |
| ORB-10588 | Owen Hart, owen@example.com | Storm shell jacket, size L (JKT-STORM-L) | $310.00 | delivered 5 days ago | PP-90955 |

Stock (`check_stock`): TENT-2P-GRN 4, TENT-3P-GRN 0, BOOT-RDG-39 2, BOOT-RDG-38 0, JKT-STORM-M 3, JKT-STORM-L 1.

### The learner's project, module by module

Every guided practice builds on the last one, in one folder called `scout`. Keep to this plan:

| Module | Guided practice produces |
|---|---|
| 1 | `scout/` folder, a virtual environment, `anthropic` installed, `ANTHROPIC_API_KEY` set, `hello.py` (first model call), `chat.py` (a terminal chatbot that keeps the conversation in a `messages` list). It can talk but not act. |
| 2 | `prompts.py` with `SCOUT_SYSTEM` (role, rules, tone, the policy facts) and `classify.py`, which turns three sample customer emails into JSON (`intent`, `order_id`, `urgent`, `summary`) with a JSON schema. |
| 3 | `tools.py` with `calculate(expression)` (safe, uses `ast`, no `eval`), `read_file(name)` (only inside `docs/`), their `TOOLS` definitions and a `run_tool(name, input)` dispatcher; `docs/policy.md`; `agent.py` with the tool loop, `MAX_STEPS = 6` and errors returned with `is_error`. |
| 4 | `memory.py`: the conversation kept across turns, trimmed to recent turns while a `facts` dict keeps key details (order number, name); `search_policy(query)` tool that scores chunks of `docs/policy.md` by shared words and returns the top 2; Scout's system prompt asks it to plan before acting. |
| 5 | The full Scout project: `data/orders.json`, tools `get_order`, `track_parcel` (fake, can time out), `check_stock`, `search_policy`, `request_refund`, `hand_off`; a trace log of every step; `tests/cases.json` (10+ cases) and `evaluate.py` that prints a pass rate. |
| 6 | `guards.py` (step limit, spend limit, refund approval over $200, a check for instructions hidden in customer text) and `server.py`: FastAPI `POST /chat` with a session id, JSON logs with latency, tokens and cost per request. |

### Voice

- Plain, warm, direct. Short sentences. Explain every term the first time it appears.
- Concrete before abstract: start from Orbit's problem, then name the idea.
- No hype ("revolutionary", "game-changing"), no filler ("it's worth noting"), no em-dashes in narration.
- Honest about limits: models can be wrong, agents cost money, some jobs don't need an agent.

---

## 2. Facts and code conventions (use exactly these)

Python 3.11+, the official Anthropic SDK, model `claude-opus-5-5`.

```python
# setup (lesson 1.5)
python -m venv .venv
.venv\Scripts\activate          # Windows
source .venv/bin/activate       # macOS / Linux
pip install anthropic
# set the key as an environment variable, never in code:
#   Windows PowerShell:  $env:ANTHROPIC_API_KEY = "sk-ant-..."
#   macOS / Linux:       export ANTHROPIC_API_KEY="sk-ant-..."

import anthropic
client = anthropic.Anthropic()            # reads ANTHROPIC_API_KEY
MODEL = "claude-opus-5-5"

response = client.messages.create(
    model=MODEL,
    max_tokens=16000,                     # a ceiling, not a target
    system="You are Scout, Orbit Outdoor's support assistant. ...",
    messages=[{"role": "user", "content": "Where is my order ORB-10482?"}],
)
# The reply can contain several blocks (the model may think first), so take the text block:
text = next(b.text for b in response.content if b.type == "text")
```

Tools and the tool loop:

```python
TOOLS = [{
    "name": "get_order",
    "description": "Look up an Orbit order by its ID (like ORB-10482). Returns status, items, carrier and tracking number.",
    "input_schema": {
        "type": "object",
        "properties": {"order_id": {"type": "string", "description": "Order ID, e.g. ORB-10482"}},
        "required": ["order_id"],
    },
}]

messages = [{"role": "user", "content": question}]
for step in range(MAX_STEPS):                       # always a step limit
    response = client.messages.create(model=MODEL, max_tokens=16000,
                                      system=SYSTEM, tools=TOOLS, messages=messages)
    messages.append({"role": "assistant", "content": response.content})
    if response.stop_reason != "tool_use":
        break
    results = []
    for block in response.content:
        if block.type == "tool_use":
            try:
                output = run_tool(block.name, block.input)
                results.append({"type": "tool_result", "tool_use_id": block.id, "content": output})
            except Exception as err:
                results.append({"type": "tool_result", "tool_use_id": block.id,
                                "content": f"Error: {err}", "is_error": True})
    messages.append({"role": "user", "content": results})   # all results in one message
```

Structured output:

```python
response = client.messages.create(
    model=MODEL, max_tokens=16000,
    messages=[{"role": "user", "content": email_text}],
    output_config={"format": {"type": "json_schema", "schema": {
        "type": "object",
        "properties": {
            "intent": {"type": "string", "enum": ["where_is_order", "return", "product_question", "other"]},
            "order_id": {"type": ["string", "null"]},
            "urgent": {"type": "boolean"},
        },
        "required": ["intent", "order_id", "urgent"],
        "additionalProperties": False,
    }}},
)
data = json.loads(next(b.text for b in response.content if b.type == "text"))
# or with Pydantic: client.messages.parse(..., output_format=Ticket) -> response.parsed_output
```

Other facts:

- Server-side web search tool: `{"type": "web_search_20260209", "name": "web_search", "max_uses": 3}`.
- Do **not** teach `temperature`, `top_p` or forcing a tool with `tool_choice` `any`/`tool`: current models reject them. The model decides (`auto`); steer it with the prompt and the tool description.
- Prices per million tokens (input / output): Claude Opus 5.5 $4 / $20, Claude Sonnet 5.5 $2 / $10, Claude Haiku 5.5 $0.10 / $0.50. Context window: 1 million tokens. A token is roughly three quarters of a word.
- The ideas are the same with any provider (OpenAI, Google, open models). Say so once where it matters; the code uses Anthropic's SDK.
- Retrieval in this course is kept simple: split Orbit's policy into chunks, score chunks by matching words (or with embeddings and a vector store in real projects such as Chroma or pgvector), put the best 2 or 3 into the prompt.
- Deployment in Module 6 uses FastAPI (`pip install fastapi uvicorn`), one `POST /chat` endpoint.

---

## 3. Narration: written to be spoken

Every slide's narration is a list of `sentences`. A text-to-speech voice reads them, and the slide reveals items as the voice reaches them. So:

- One idea per sentence, usually 8 to 25 words. Never more than 35.
- No symbols the voice will stumble on: write "percent", "dollars", "to", "and", "versus". Write "eighteen hundred dollars", not "$1,800". Write "O R B one oh four eight two" only if the ID must be read; usually say "her order number".
- Don't read code aloud character by character. Describe it: "We call the messages create method with the model, a system prompt and the user's question."
- No markdown, emoji, brackets or quotes-within-quotes in narration.
- Acronyms the voice reads well: API, LLM, JSON, RAG, URL, SDK. Say "react, short for reason and act" the first time for ReAct.
- 3 to 8 sentences per slide. A video has 6 to 9 slides and runs about 4 to 6 minutes.

---

## 4. Videos: `m{N}/video-{N}.{k}.json`

One file per lesson, `k` = 1..5, matching the lesson ids in `course.json`.

```json
{
  "lesson": "3.1",
  "title": "What is tool calling?",
  "notes": ["Three key ideas from the lesson,", "each one sentence,", "shown under the video and on the course page."],
  "quizAfter": 3,
  "slides": [ ...6 to 9 slides... ],
  "midQuiz": [ ...2 questions about slides 0..quizAfter... ],
  "endQuiz": [ ...2 questions about the whole video... ]
}
```

- `quizAfter` is the 0-based index of the slide after which `midQuiz` pauses the video. Put it roughly in the middle.
- Quiz question: `{"q": "...", "options": ["...", "...", "..."], "correct": 1, "explain": "why the answer is right", "hint": "a nudge that does not give the answer away"}`. Exactly 3 options, `correct` is 0-based. Make wrong options plausible.
- First slide is always `title` with `kicker` "Module N · Lesson k". Last slide is always `recap`.
- Use at least 4 different slide kinds per video. Prefer visual kinds (`hub`, `cycle`, `flow`, `chat`, `compare`, `cards`, `table`) over `bullets`.

### Cues

Every slide has `sentences`. An item with `"cue": n` appears when the voice reaches sentence `n` (0-based). Rules the checker enforces:

- `0 <= cue < sentences.length`.
- In lists, cues go up (or stay equal) from item to item.
- `define`: the card shows at sentence 0; each part has a cue; the analogy appears at `last part cue + 1`, so that sentence must exist.
- Leave sentence 0 as an intro to the slide where you can, so items appear as they are talked about.

### Slide kinds

All slides: `"kind"`, `"title"`, `"sentences"`. Kind-specific fields:

| kind | fields |
|---|---|
| `title` | `icon`, `kicker`, `sub` |
| `compare` | `left` and `right`: `{label, tone: "bad"|"ok"|"info", cue, points: [3 or 4 short strings]}` |
| `define` | `term`, `definition`, `parts: [{text, cue}]` (2-4), `analogy: {label, text}` |
| `flow` | `run` (optional true: nodes turn green as the voice moves on), `nodes: [{kind, icon, label, sub, cue}]` (2-5), `note: {text, cue}` |
| `bullets` | `lead`, `bullets: [{icon, text, cue}]` (3-5), `aside: {icon, label, text, cue}` |
| `example` | `scenario`, `steps: [{time, icon, text, cue}]` (3-5), `result: {text, cue}` |
| `cards` | `tags` (optional, 3 labels for the rows), `cards: [{icon, title, flow: [3 strings], cue}]` (exactly 3 cards) |
| `table` | `columns: [2-4 strings]`, `rows: [{cells, tone?: "bad", cue}]` (2-5), `note: {text, cue}` |
| `code` | `lead`, `rows: [{code, out, cue}]` (2-4; `code` is one short line, `out` says what it does or returns), `aside: {icon, label, text, cue}` |
| `recap` | `points: [{text, cue}]` (3-5) |
| `hub` | `center: {icon, label, sub}`, `spokes: [{icon, label, sub, cue}]` (3-6), `note` (optional `{text, cue}`) |
| `cycle` | `center: {label, sub}`, `steps: [{icon, label, sub, cue}]` (3-5, drawn round a loop), `note` (optional) |
| `chat` | `messages: [{role: "user"|"agent"|"tool"|"system", label?, text, cue}]` (3-6), `aside` (optional) |

Keep on-slide text short: labels 1-4 words, `sub` up to 6 words, bullet and point text up to 14 words, code rows up to 60 characters.

`flow` node `kind` (sets its colour): `user`, `llm`, `tool`, `memory`, `output`, `guard`, `trigger`, `data`, `logic`, `action`.

### Icon names

`bot brain wrench message sparkles globe calculator key shield server cloud rocket gauge dollar layers target repeat list-checks git-branch users terminal plug bug book lock folder settings play chart thumbs-up help timer package truck receipt check json cpu history link hand scale lightbulb flask award map workflow zap boxes send table form clock webhook bell-off download pencil split arrow-right x-circle eye alert file headset filter copy database code calendar shop factory user mail search`

---

## 5. The module's other phases: `m{N}/blocks.json`

```json
{ "hook": {...}, "worked": {...}, "guided": {...}, "lab": {...}, "review": {...} }
```

The nine phases of the course and where they live:

| Phase | Where | Stage id |
|---|---|---|
| 1 Real problem (hook) | every module | `hook` |
| 2 Concept | every module (the videos) | `explainer` |
| 3 Worked example | every module | `worked` |
| 4 Guided practice | every module | `guided` |
| 5 Scenario | every module | `lab` |
| 6 Mini project | once, after all modules | finale `capstone` |
| 7 Mastery gate | once, after all modules | finale `final-check` |
| 8 Reflection | once, after all modules | finale `wrap-up` |
| 9 Spaced review | every module | `review` |

Topic titles shown to learners come from `course.json`; your `hook.title` and `guided.title` should match them.

### Diagrams (`pipeline`)

Hooks and worked examples animate a diagram of boxes and arrows.

```json
"pipeline": {
  "nodes": [
    {"id": "user",  "kind": "user",  "label": "Customer",    "sub": "asks about order", "x": 0,   "y": 60},
    {"id": "scout", "kind": "llm",   "label": "Scout",       "sub": "decides",          "x": 230, "y": 60},
    {"id": "order", "kind": "tool",  "label": "get_order",   "sub": "order lookup",     "x": 460, "y": 0},
    {"id": "reply", "kind": "output","label": "Reply",       "sub": "to customer",      "x": 460, "y": 120}
  ],
  "edges": [
    {"id": "e1", "source": "user", "target": "scout"},
    {"id": "e2", "source": "scout", "target": "order"},
    {"id": "e3", "source": "scout", "target": "reply"}
  ]
}
```

- Boxes are 196 wide and 68 tall. Space columns 230 apart (x = 0, 230, 460, 690, 920) and rows 110 to 120 apart. At most 5 columns and 3 rows.
- Arrows run from a box's right edge to the next box's left edge, so lay the flow out left to right.
- Node `kind`: `user`, `llm`, `tool`, `memory`, `api`, `guard`, `output`, `plan`, `data`, `logic`.
- Labels up to 18 characters, `sub` up to 22.

A **step** changes states. States: `idle`, `running`, `ok`, `error`. Steps are cumulative: a node keeps its state until a later step changes it.

```json
{"caption": "Scout calls get_order with ORB-10482.", "nodes": {"scout": "ok", "order": "running"}, "edges": {"e2": "running"}}
```

### `hook` (phase 1: the real problem)

The hook is what makes the learner want the module. Open on a real, specific failure at Orbit, show the team's messages, ask the learner to commit to a guess, then replay what happened.

It plays full screen with nothing else on screen: the opening (the `film` below; a hook without one shows a cold open from `kicker`, `title` and `why`, the team chat from `messages`, and what it cost from `stat`, over `narration`), the learner's call (`prompt`, the diagram, `hunches`, then "how sure are you?"), the replay and the verdict (`wrap_correct` or `wrap_wrong`, then `wrap_point` as the module's core idea). `stat` is split on ` · `; a number of 10 or more in a part rolls up, so write parts like `400 tickets` or `$1,800 by Monday`. Start `wrap_correct` and `wrap_wrong` with "Exactly.", "Right." or "Not quite." if you like; the verdict drops that opener under its own headline.

The replay steps through `reveal.steps` on the diagram. Each step's `caption` is spoken (the audio script reads ids digit by digit and code names like `get_order` as words) and shown lit word by word; the next step waits for the voice to finish, and the learner can step back. So write each caption as one or two spoken sentences. `reveal.narration` is the written summary of the same story; it is not spoken.

```json
"hook": {
  "kicker": "Monday, 9:04 AM",
  "title": "<topic title from course.json>",
  "why": "Two or three sentences that set the scene in the learner's shoes.",
  "stat": "A short, sharp number line, e.g. 400 tickets · 0 orders looked up",
  "narration": "The scene as it would be spoken, 4 to 7 sentences, ending with the question.",
  "messages": [{"who": "Leo — support lead", "av": "L", "at": "9:01 AM", "text": "chat-style, lowercase is fine"}],
  "prompt": "Before anything is explained: <the question>?",
  "hunches": [{"id": "a", "label": "..."}, {"id": "b", "label": "..."}, {"id": "c", "label": "..."}],
  "correct": "b",
  "pipeline": { ... },
  "reveal": {
    "narration": "What really happened, 4 to 7 sentences.",
    "steps": [ {"caption": "...", "nodes": {...}, "edges": {...}}, ...5 to 8 steps... ]
  },
  "wrap_correct": "Feedback when the guess was right.",
  "wrap_wrong": "Feedback when it was wrong: what actually failed.",
  "wrap_point": "The one idea this module will teach, in a sentence."
}
```

3 or 4 messages; 3 hunches, all plausible. The reveal must make the right answer visible on the diagram (an `error` state, a missing box, a skipped arrow).

#### `hook.film`: the opening as scenes the learner plays through

With `"film": {"shots": [...]}` the opening is a short illustrated film the learner moves through at their own pace: the failure happens in the tools where it happened, and in most scenes the learner makes it happen (sends the message, opens the inbox, holds the button while the weekend passes). 3 to 5 shots, and nothing leaves the screen until the learner presses Continue.

Every shot has a `type`, a `label` (the on-screen chyron, at most 48 characters) and a `say`: one spoken line (at most 110 characters) that is also the caption under the picture, lit word by word as the voice reads it. Scenes that wait for the learner also have a `then`: the line spoken and shown once they have acted, the payoff. Scenes with a button name it in `act` (at most 34 characters). Write `say` and `then` to be heard: short, second person where the learner acts, no ids, code or amounts in figures. The audio script makes `hook-m{N}-s{i}.mp3` and `hook-m{N}-s{i}-then.mp3` from them, and `hook-m{N}-r{k}.mp3` from each replay caption.

| `type` | The learner | Shows | Fields |
| --- | --- | --- | --- |
| `site-chat` | sends the first three `asks` (no `act`) | the shop's site and its chatbot giving the same `reply` each time, then a counter climbing to `count` | `url`, `product`, `asks` (3 or more), `reply`, `count`, `countLabel`, `then` |
| `tickets` | taps `act` | the helpdesk inbox, empty, then flooding | `count`, `subjects`, `tag`, `act`, `then` |
| `phone` | watches | the phone buzzing, each of `notes` landing large beside it | `time`, `notes` (1 to 3 `{who, av, at, text}`, text at most 110 characters) |
| `email` | taps `act` | a customer email, then the agent typing its reply with `highlight` marked | `from`, `address`, `subject`, `body`, `meta`, `replyBy`, `reply`, `highlight`, `act`, `then` |
| `doc-vs-reply` | taps the wrong phrase in the reply (no `act`; "Show me" after misses) | the source document beside the agent's reply, then ≠ and a stamp | `doc` and `reply` (each `{title, text, highlight}`, plus `heading` on `doc`; `reply.highlight` is what they must find), `stamp`, `then` |
| `parcel-map` | taps `act` to track the parcel | the agent's "delivered" claim, then the truck stopping at `stop` (0 to 1) and the truth | `from`, `to`, `hub`, `stop`, `claim`, `truth`, `act`, `then` |
| `terminal` | watches | a log printing line by line | `title`, `lines` (`{time, text, tone}`, tone `ok`, `warn`, `err` or `dim`; spaces line columns up); optional `badge`, `flood` (`{text, count}`, the last line repeating) |
| `long-chat` | holds `act` down to keep the chat going | the conversation scrolling until message `key` is gone and message `ask` lands | `customer`, `agent`, `messages` (`{from: "customer" or "agent", text}`), `key`, `ask`, `keep` (messages visible at once), `act`, `then` |
| `test-grid` | taps `act` to run the tests | a pass/fail grid filling | `total`, `passed`, `countdown`, `act`, `then` |
| `timelapse` | holds `act` down to make time pass | a clock racing while a bill and a step count climb | `startDay`, `startTime`, `hours`, `amount`, `steps`, `error`, `act`, `then` |
| `numbers` | watches | the `stat` parts landing one by one | none |

Open with a scene the learner acts in, and end on `numbers` so the cost lands last. `node fixtures/scripts/build-ai-agent.mjs --check mN` validates the fields.

### `worked` (phase 3: worked example)

2 or 3 examples, each tied to a lesson. The learner predicts, then watches the run caption by caption.

```json
"worked": {
  "examples": [{
    "lesson": "3.1",
    "title": "Watch Scout call one tool",
    "intro": "One sentence on what this run shows.",
    "narration": "The run told as a story, 4 to 7 sentences (shown as a transcript).",
    "predict": {
      "stem": "What will Scout do first?",
      "options": [{"text": "...", "correct": true}, {"text": "..."}, {"text": "..."}],
      "rationale": "Why, shown after the prediction."
    },
    "pipeline": { ... },
    "steps": [ {"caption": "...", "show": ["user"], "nodes": {"user": "ok"}, "edges": {}}, ...4 to 7 steps... ]
  }]
}
```

`show` (optional) lists node ids that appear from this step on, so the diagram can build up. If no step has `show`, every node is visible from the start. An edge appears once both its ends are visible.

### `guided` (phase 4: guided practice)

Numbered steps the learner does on their own machine, with exact code to copy.

```json
"guided": {
  "title": "<topic title from course.json>",
  "situation": "Why we are building this today, in Orbit's terms (2-3 sentences).",
  "intro": "One sentence on what you'll have at the end.",
  "before": {"items": ["What you need before starting, e.g. **Python 3.11** installed"], "downloads": []},
  "steps": [{
    "title": "Create the file",
    "body": "What this step is for, one or two sentences.",
    "actions": ["Open your editor and create **agent.py** in the project folder.", "Paste the code below."],
    "values": [{"label": "agent.py", "value": "import anthropic\n..."}],
    "check": "What the learner should see if it worked.",
    "tip": "The most likely mistake and how to fix it."
  }],
  "finish": {"title": "...", "body": "...", "checklist": ["...", "..."]}
}
```

- 6 to 9 steps. In `actions`, **bold** names a file, button or menu; `` `code` `` is something to type.
- `values[].value` is copied as-is (multi-line is fine, use `\n`). Code must be complete and runnable at that step. Build on the previous module's files where it makes sense (`agent.py`, `tools.py`).
- Every step has `check`. Give a `tip` on any step with a likely mistake.

### `lab` (phase 5: scenarios)

Three realistic situations the learner has not seen yet. Each asks for a decision and explains it. Tie each to a lesson; cover at least two different lessons.

```json
"lab": {
  "title": "<topic title from course.json>",
  "intro": "One or two sentences framing the three situations.",
  "scenarios": [{
    "lesson": "3.5",
    "title": "The tracking API is down",
    "situation": "Three or four sentences describing what is happening.",
    "context": {"label": "Scout's trace", "lines": ["> track_parcel(PP-88213)", "< Error: timeout after 10s"]},
    "stem": "What should Scout tell the customer?",
    "options": [
      {"text": "...", "correct": true, "why": "Why this works."},
      {"text": "...", "why": "Why this falls short."},
      {"text": "...", "why": "Why this falls short."}
    ],
    "hints": ["A first nudge.", "A stronger nudge."],
    "debrief": "What an experienced builder would do and why, 2-3 sentences."
  }]
}
```

`context` is optional evidence shown in a monospace panel (a trace, a log, a chat, a config). Exactly one option is correct.

### `m{N}/assessment.json` (phase 7: the module check)

Closes the module, before the spaced review. Six questions: one per lesson in order, then a scenario at another small business that draws on two or more lessons (`"transfer": true`). Test judgement in a concrete situation, not recall of wording, and never reuse a video's own quiz questions. Four options each, all plausible; the build rotates the right answer through every position, so put it wherever you like. Pass mark 80% overall; a missed lesson links back to its video.

```json
{
  "title": "Module check: <the module's core idea, at most 60 characters>",
  "summary": "One sentence on what it covers, at most 140 characters.",
  "items": [
    {"lesson": "3.1", "stem": "A concrete Orbit situation, then the question (at most 260 characters)", "options": ["...", "...", "...", "..."], "correct": 2, "explain": "Why the right answer is right and the tempting one wrong (at most 300)."},
    ...one per lesson...,
    {"lesson": "3.5", "transfer": true, "stem": "...", "options": ["...", "...", "...", "..."], "correct": 0, "explain": "..."}
  ]
}
```

### `review` (phase 9: spaced review)

Three short questions that return after 3, 10 and 30 days, each a little harder and set in a new Orbit situation.

```json
"review": {
  "variants": [
    {"after_days": 3,  "title": "Health check · Scout", "stem": "...", "options": [{"text": "...", "correct": true}, {"text": "..."}, {"text": "..."}], "rationale": "..."},
    {"after_days": 10, ...},
    {"after_days": 30, ...}
  ]
}
```

---

## 6. The mini project: `project/`

The course finale's mini project, "Build Scout's prompt engine", is built and tested in the browser (`/learn/courses/ai-agent/finale/capstone/workspace`). The brief (title, scene, requirements, edge cases, reactions) is `finale.json` `capstone` as before; the workspace is `project/`:

| File | What it is |
|---|---|
| `prompt_engine.py` | The starter the learner edits. Three functions: `ask_model(ticket)`, `parse_reply(text)`, `decide(result, ticket)`. Keep it short and working, but failing. |
| `docs/policy.md` | Orbit's policy, word for word from section 1. Shown read-only; `orbit.POLICY` reads it. |
| `orbit/model.py` | The practice model, hidden from the learner. `client.messages.create(model=MODEL, max_tokens=..., system=..., messages=..., output_config=...)` with the real API's shape and errors (no `temperature`, no `system` role in `messages`). Deterministic: it reads emails well and follows only what the prompt clearly says; each gap produces one realistic mistake (see its docstring). An output schema makes its reply valid JSON with only the schema's fields and enum values. |
| `run.py` | The harness the workspace runs (hidden). Do not change its output shape without changing `apps/web/src/components/project`. |
| `tickets.json` | `samples` (shown, with what Scout should do) and `hidden` (the tests; their `expect` stays on the server). Use the shared data from section 1: customers, order numbers, products. |
| `solution/prompt_engine.py` | The reference solution. Never shipped. |

Rules:

- The seven `requirements` in `finale.json` are graded as r1 to r7 in that order (`apps/web/src/lib/project-grade.ts`): fields, intent, order number or email, policy, routing, same answer twice, voice. Reword them freely; keep the order and the meaning.
- Every `hidden` ticket's `expect` gives `intent` (or a list), `order_id`, `email`, `action` (`reply`, `ask_for_order` or `handoff`), and optionally `include`/`exclude` phrases for the reply and `critical: true` (failing it fails the project).
- After any change, run `node fixtures/scripts/check-project.mjs` (needs Python 3.10+): the starter must fail and the reference solution must score 100%, on the samples too. Then `node fixtures/scripts/build-ai-agent.mjs` writes `fixtures/project-ai-agent.json` (the browser's copy, no hidden answers) and `fixtures/project-ai-agent-tests.json` (server only).
