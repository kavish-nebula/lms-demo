"""
Scout's Prompt Engine
=====================

Every email to Orbit Outdoor's support inbox passes through this file before
Scout answers it. For each email, your engine:

  1. asks the model about it                 ask_model(ticket)
  2. turns the model's reply into fields      parse_reply(text)
  3. decides what Scout does                  decide(result, ticket)

decide() must return a dict with exactly these keys:

  intent    one of INTENTS
  order_id  the order number, like "ORB-10482", or None
  email     the customer's email address if they gave one, or None
  reply     what Scout says to the customer
  action    "reply", "ask_for_order" or "handoff"

A ticket is a dict: {"id": ..., "from": ..., "subject": ..., "body": ...}.

Run tries the sample emails. Run tests plays ten hidden emails, twice.

`client` works like anthropic.Anthropic() (lessons 1.5 and 2.5), but runs a
small practice model in your browser: it does what your prompt clearly asks
and guesses at everything else. Read its replies in the preview; every guess
it makes is something the course showed you how to prevent.
"""

import json

from orbit import MODEL, POLICY, client  # POLICY is docs/policy.md, as text

INTENTS = ["order_status", "return", "exchange", "policy_question", "other"]

# Who Scout is, and the rules it works by.
SYSTEM_PROMPT = """You are a helpful assistant. Answer the customer's email."""


def ask_model(ticket):
    """Send one email to the model and return its text reply."""
    response = client.messages.create(
        model=MODEL,
        max_tokens=1000,
        system=SYSTEM_PROMPT,
        messages=[{"role": "user", "content": ticket["body"]}],
    )
    return next(b.text for b in response.content if b.type == "text")


def parse_reply(text):
    """Turn the model's reply into a dict with the fields you asked for."""
    return json.loads(text)


def decide(result, ticket):
    """What Scout does with the model's answer."""
    return {
        "intent": result.get("intent"),
        "order_id": result.get("order_id"),
        "email": result.get("email"),
        "reply": result.get("reply", ""),
        "action": "reply",
    }
