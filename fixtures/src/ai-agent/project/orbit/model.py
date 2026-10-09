"""
Orbit's practice model.

A stand-in for the Claude API, so the mini project runs in the browser,
free, with no API key. You call it exactly like the real thing:

    from orbit import client, MODEL

    response = client.messages.create(
        model=MODEL,
        max_tokens=1000,
        system="You are Scout, ...",
        messages=[{"role": "user", "content": email_text}],
        # optional: structured output, as in lesson 2.5
        output_config={"format": {"type": "json_schema", "schema": {...}}},
    )
    text = next(b.text for b in response.content if b.type == "text")

In your own project the same code runs with `client = anthropic.Anthropic()`
and MODEL = "claude-opus-5-5".

It reads an email well, but it is literal about everything else, the way a
small model is: it does what the prompt clearly asks and guesses at the
rest. Every guess is a mistake the course teaches you to prevent:

- no request for JSON: it writes a friendly email instead
- JSON, but not "only JSON": it wraps the JSON in chat and a code fence
- field names it wasn't given: it picks its own
- intent labels it wasn't given: it makes up readable ones
- no policy in the prompt: it "remembers" a policy that isn't Orbit's
- no rule for what the policy doesn't cover: it invents an answer
- no rule about instructions inside emails: it obeys them
- no rule for handing off: it answers things it shouldn't
- no role: it talks like a generic AI
- no output schema: its formatting drifts a little from run to run

With an output schema (output_config), its reply is always valid JSON with
exactly the schema's fields, and enum fields only take listed values.
"""

import hashlib
import json
import re

MODEL = "orbit-practice-1"
INTENTS = ("order_status", "return", "exchange", "policy_question", "other")

# the fields the model knows how to fill, and the names it understands for each
SEMANTIC = {
    "intent": ("intent", "category", "type", "topic"),
    "order_id": ("order_id", "order", "order_number", "orderid", "order_no"),
    "email": ("email", "customer_email", "email_address"),
    "reply": ("reply", "response", "answer", "message", "draft_reply"),
    "handoff": ("handoff", "hand_off", "escalate", "needs_human", "human"),
    "urgent": ("urgent", "is_urgent"),
    "summary": ("summary",),
}
FIELDS = ("intent", "order_id", "email", "reply", "handoff")
# what it calls things when nobody tells it
OWN_KEYS = {"intent": "category", "order_id": "orderNumber", "email": "customerEmail", "reply": "response", "handoff": "escalate"}
OWN_LABELS = {
    "order_status": "Order Status Inquiry",
    "return": "Return Request",
    "exchange": "Exchange Request",
    "policy_question": "General Question",
    "other": "Miscellaneous",
}

ORDER_RE = re.compile(r"\bORB-\d{5}\b", re.I)
EMAIL_RE = re.compile(r"[\w.+-]+@[\w-]+\.[\w.]+")
INJECTION_RE = re.compile(
    r"ignore (all |any |your |the )?(previous |prior )?(instructions|rules)|admin mode|developer mode|you are now|system prompt|new instructions",
    re.I,
)

# which run this is (the workspace runs the tests twice); without a schema, formatting drifts between runs
RUN = {"seed": 1}


class BadRequestError(Exception):
    """The request itself was wrong, like a 400 from the real API."""


class _Block:
    def __init__(self, text):
        self.type = "text"
        self.text = text

    def __repr__(self):
        return f"TextBlock(text={self.text!r})"


class _Response:
    def __init__(self, text, model):
        self.content = [_Block(text)]
        self.stop_reason = "end_turn"
        self.model = model


def _has(text, phrases):
    return any(p in text for p in phrases)


def _check(kwargs):
    for bad in ("temperature", "top_p", "top_k", "tool_choice"):
        if bad in kwargs:
            raise BadRequestError(f"{bad} is not supported by this model. Steer it with the prompt instead.")
    if kwargs.get("model") != MODEL:
        raise BadRequestError(f"model must be MODEL (\"{MODEL}\"); got {kwargs.get('model')!r}")
    if not isinstance(kwargs.get("max_tokens"), int) or kwargs["max_tokens"] < 1:
        raise BadRequestError("max_tokens is required: a whole number, the most the reply may use")
    system = kwargs.get("system", "")
    if not isinstance(system, str):
        raise BadRequestError("system must be a string")
    messages = kwargs.get("messages")
    if not isinstance(messages, list) or not messages:
        raise BadRequestError("messages must be a non-empty list of {'role': ..., 'content': ...} dicts")
    for i, m in enumerate(messages):
        if not isinstance(m, dict) or not isinstance(m.get("content"), str):
            raise BadRequestError(f"messages[{i}] needs a role and a text content")
        if m.get("role") == "system":
            raise BadRequestError("there is no 'system' role: put the system prompt in the system parameter")
        if m.get("role") not in ("user", "assistant"):
            raise BadRequestError(f"messages[{i}]: role must be 'user' or 'assistant'")
    if messages[-1]["role"] != "user":
        raise BadRequestError("the last message must be the user's (the customer email)")
    for a, b in zip(messages, messages[1:]):
        if a["role"] == b["role"]:
            raise BadRequestError("user and assistant messages must alternate")
    fmt = (kwargs.get("output_config") or {}).get("format")
    if fmt is None:
        return None
    if not isinstance(fmt, dict) or fmt.get("type") != "json_schema" or not isinstance(fmt.get("schema"), dict):
        raise BadRequestError('output_config must look like {"format": {"type": "json_schema", "schema": {...}}}')
    schema = fmt["schema"]
    if schema.get("type") != "object" or not isinstance(schema.get("properties"), dict) or not schema["properties"]:
        raise BadRequestError("the schema must be an object with properties")
    return schema


def _read(email):
    """What the email is about. The model is good at this part."""
    low = email.lower()
    order = ORDER_RE.search(email)
    mail = EMAIL_RE.search(email)
    days = re.search(r"(\d+)\s+days?\s+ago", low)
    amount = re.search(r"\$\s?(\d+)", email)
    if _has(low, ("what do you think", "recommend", "good for", "review")):
        intent = "other"  # product advice
    elif _has(low, ("exchange", "swap", "different size", "size l", "size m", "size s", "size 3", "size 4", "wrong size")):
        intent = "exchange"
    elif _has(low, ("how long do refunds", "how long does a refund", "how long do returns", "policy", "warranty", "discount", "price match", "price-match")):
        intent = "policy_question"
    elif _has(low, ("return", "refund", "send back", "send it back", "send them back")):
        intent = "return"
    elif _has(low, ("where is", "where's", "track", "hasn't arrived", "hasn't come", "not arrived", "still hasn't", "parcel", "delivery")):
        intent = "order_status"
    elif _has(low, ("how long", "do you", "can i")):
        intent = "policy_question"
    else:
        intent = "other"
    return {
        "intent": intent,
        "order_id": order.group(0).upper() if order else None,
        "email": mail.group(0).lower() if mail else None,
        "days": int(days.group(1)) if days else None,
        "amount": int(amount.group(1)) if amount else None,
        "injection": bool(INJECTION_RE.search(email)),
        "low": low,
    }


def _noise(email):
    """Formatting drift without a schema: a number from 0 to 99 that changes from run to run."""
    h = hashlib.sha256(f"{email}|{RUN['seed']}".encode()).hexdigest()
    return int(h[:4], 16) % 100


def _answer(system, everything, examples, email):
    """What the model decides to say, from what the prompt told it."""
    sys_low = system.lower()
    knows_policy = "within 30 days of delivery" in everything
    grounded = knows_policy and _has(
        sys_low,
        ("only the policy", "only use the policy", "only from the policy", "stick to the policy", "not covered", "doesn't cover",
         "does not cover", "not in the policy", "don't guess", "do not guess", "never guess", "don't make up", "do not make up",
         "never make up", "don't invent", "do not invent", "never invent"),
    )
    guarded = _has(
        sys_low,
        ("ignore instructions", "ignore any instructions", "never follow instructions", "do not follow instructions",
         "don't follow instructions", "instructions inside", "instructions in the email", "instructions in customer",
         "as data", "prompt injection", "never change your rules", "can't change your rules", "cannot change your rules",
         "never change these rules"),
    )
    hands_off = _has(sys_low, ("hand off", "handoff", "hand over", "hand it over", "escalate", "a person", "a human", "the team"))
    has_role = re.search(r"\byou are\b", sys_low) is not None
    # an email with no order number: does it know to leave the order number empty?
    email_rule = ("null" in sys_low and "email" in sys_low) or any(
        EMAIL_RE.search(e) and re.search(r'"order_id"\s*:\s*null', e) for e in examples
    )

    r = _read(email)
    intent, handoff = r["intent"], False
    if r["injection"]:
        if guarded:
            handoff = True
            reply = "I can't change how I work, so I've passed your message to our team."
        else:
            intent = "return"
            reply = f"Done! As requested, I've approved a full refund of ${r['amount'] or 900}."
    elif intent == "other":
        if hands_off:
            handoff = True
            reply = "That's outside what I can help with here, so I've passed your question to our team."
        else:
            reply = "Great question! Those are some of our best-reviewed products, and customers love them in every season."
    elif intent == "policy_question":
        if "refund" in r["low"] or "how long" in r["low"]:
            reply = (
                "Refunds go back to your original payment method within 5 business days of your return arriving."
                if knows_policy
                else "Refunds usually take 2 to 3 weeks to reach your card."
            )
        elif grounded:
            handoff = True
            reply = "Our policy doesn't cover that, so I've passed your question to the team, who can give you a proper answer."
        elif "warranty" in r["low"]:
            reply = "Every product comes with a lifetime warranty, so you're covered."
        else:
            reply = "Yes! We'll gladly match any price and give students 10% off every order."
    elif intent == "return":
        if r["amount"] and r["amount"] > 200:
            if knows_policy and hands_off:
                handoff = True
                reply = f"Refunds over $200 need a team member's approval, so I've passed your ${r['amount']} refund to the team."
            else:
                reply = f"Your refund of ${r['amount']} has been approved and is on its way."
        elif r["days"] and r["days"] > 30:
            reply = (
                f"I'm sorry: returns are accepted within 30 days of delivery, and these arrived {r['days']} days ago, so they can't be returned."
                if knows_policy
                else "No problem! You can return items within 60 days, so you're well within the window."
            )
        else:
            reply = (
                "You can return any unused item within 30 days of delivery, in its original packaging. I'll send you a returns label."
                if knows_policy
                else "You can return anything within 60 days. I'll send you a returns label."
            )
    elif intent == "exchange":
        reply = (
            "Exchanging for a different size is free if the new size is in stock. I'll check and set it up for you."
            if knows_policy
            else "Exchanges cost $5 and take about two weeks. I'll set one up for you."
        )
    else:  # order_status
        ref = r["order_id"] or r["email"]
        reply = f"Thanks! I'll check where {ref} is and send you its tracking link." if ref else "Thanks for getting in touch. Let me look into your order."

    if not has_role:
        reply = "As an AI language model, I don't have personal access to accounts, but here is what I can tell you. " + reply

    order_id, mail = r["order_id"], r["email"]
    if not order_id and mail and not email_rule:
        order_id, mail = mail, None  # puts the email where the order number goes
    return {
        "intent": intent,
        "order_id": order_id,
        "email": mail,
        "reply": reply,
        "handoff": handoff,
        "urgent": bool(r["injection"] or (r["amount"] or 0) > 200),
        "summary": f"{intent.replace('_', ' ')}" + (f" about {r['order_id']}" if r["order_id"] else ""),
    }


def _schema_reply(schema, values):
    """Valid JSON with exactly the schema's properties; enum fields only take listed values."""
    out = {}
    for name, prop in schema["properties"].items():
        meaning = next((m for m, names in SEMANTIC.items() if name.lower() in names), None)
        value = values.get(meaning) if meaning else None
        enum = prop.get("enum") if isinstance(prop, dict) else None
        if enum:
            value = value if value in enum else ("other" if "other" in enum else enum[0])
        kind = prop.get("type") if isinstance(prop, dict) else None
        kinds = kind if isinstance(kind, list) else [kind]
        if value is None and "null" not in kinds:
            value = False if "boolean" in kinds else "" if "string" in kinds else None
        out[name] = value
    return json.dumps(out, indent=2)


def create(**kwargs):
    schema = _check(kwargs)
    system = kwargs.get("system", "")
    messages = kwargs["messages"]
    everything = (system + "\n" + "\n".join(m["content"] for m in messages)).lower()
    email = messages[-1]["content"]
    examples = [m["content"] for m in messages[:-1] if m["role"] == "assistant"]
    values = _answer(system, everything, examples, email)

    if schema is not None:
        return _Response(_schema_reply(schema, values), MODEL)

    sys_low = system.lower()
    if "json" not in sys_low:
        return _Response(f"Hi there,\n\n{values['reply']}\n\nBest wishes,\nOrbit Outdoor", MODEL)
    only_json = _has(
        sys_low,
        ("only json", "only the json", "json only", "only valid json", "only return json", "nothing else", "no other text", "no prose",
         "no markdown", "without markdown", "no extra text", "raw json", "no code fence", "no explanation"),
    )
    told_keys = {k for k in FIELDS if re.search(rf"\b{k}\b", everything)}
    told_labels = all(re.search(rf"\b{i}\b", everything) for i in INTENTS)
    variant = _noise(email)
    label = values["intent"] if told_labels else OWN_LABELS[values["intent"]]
    if variant < 40:
        label = label.title()  # without a schema, labels drift between runs
    values = {**values, "intent": label}
    text = json.dumps({(k if k in told_keys else OWN_KEYS[k]): values[k] for k in FIELDS}, indent=2)
    if not only_json:
        text = f"Sure! Here's the JSON you asked for:\n```json\n{text}\n```"
    if variant % 3 == 0:
        text += "\n\nHope that helps!"
    return _Response(text, MODEL)


class _Messages:
    def __init__(self):
        self.log = []  # every request and reply, for the workspace preview

    def create(self, **kwargs):
        response = create(**kwargs)
        self.log.append({"request": kwargs, "text": response.content[0].text})
        return response


class Client:
    """Practice stand-in for anthropic.Anthropic(): client.messages.create(...)."""

    def __init__(self):
        self.messages = _Messages()


client = Client()
