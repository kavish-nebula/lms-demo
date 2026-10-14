"""
Runs the learner's prompt engine over a batch of tickets and reports what
happened at every step, as JSON. Used by the workspace (in the browser) and
by fixtures/scripts/check-project.mjs (with a local Python). Not shown to the
learner.
"""

import importlib
import json
import sys
import traceback

LEARNER_MODULES = ("prompt_engine",)


def _safe(value):
    """JSON-safe copy of whatever the learner returned."""
    try:
        return json.loads(json.dumps(value, default=str))
    except (TypeError, ValueError):
        return repr(value)


def _where(exc):
    """The last line of the learner's own code in a traceback, if any."""
    frames = [f for f in traceback.extract_tb(exc.__traceback__) if f.filename.endswith("prompt_engine.py")]
    return f"prompt_engine.py, line {frames[-1].lineno}" if frames else None


def _shown(request):
    """The request as the preview shows it: the system prompt, the messages, and the output schema if any."""
    shown = [{"role": "system", "content": str(request.get("system", ""))}] if request.get("system") else []
    shown += [{"role": str(m.get("role")), "content": str(m.get("content"))} for m in request.get("messages", []) if isinstance(m, dict)]
    if request.get("output_config"):
        shown.append({"role": "output schema", "content": json.dumps(request["output_config"], indent=2, default=str)})
    return shown


def run(tickets_json, seeds_json="[1]"):
    for name in list(sys.modules):
        if name in LEARNER_MODULES or name == "orbit" or name.startswith("orbit."):
            del sys.modules[name]
    from orbit import model

    try:
        engine = importlib.import_module("prompt_engine")
    except Exception as exc:  # a syntax error, or an error at import time
        return json.dumps({"fatal": f"{type(exc).__name__}: {exc}", "where": _where(exc) or "prompt_engine.py", "records": []})

    records = []
    for seed in json.loads(seeds_json):
        model.RUN["seed"] = seed
        for ticket in json.loads(tickets_json):
            rec = {"ticket": ticket["id"], "seed": seed, "step": "ask_model"}
            log = model.client.messages.log
            seen = len(log)
            try:
                text = engine.ask_model(dict(ticket))
                if len(log) > seen:
                    rec["messages"] = _shown(log[-1]["request"])
                rec["raw"] = text if isinstance(text, str) else repr(text)
                rec["step"] = "parse_reply"
                parsed = engine.parse_reply(text)
                rec["parsed"] = _safe(parsed)
                rec["step"] = "decide"
                rec["decision"] = _safe(engine.decide(parsed, dict(ticket)))
                rec["step"] = "done"
            except Exception as exc:
                if "messages" not in rec and len(log) > seen:
                    rec["messages"] = _shown(log[-1]["request"])
                rec["error"] = f"{type(exc).__name__}: {exc}"
                rec["where"] = _where(exc)
            records.append(rec)
    return json.dumps({"records": records})


if __name__ == "__main__":
    # python run.py tickets.json [seeds]: for checking the project with a local Python
    with open(sys.argv[1], encoding="utf-8") as f:
        tickets = f.read()
    print(run(tickets, sys.argv[2] if len(sys.argv) > 2 else "[1]"))
