/**
 * Course-side text that the learner's setup answers select between, ported from
 * the prototype's content/world.js. On-screen cards only: narration and graded
 * questions are the same for everyone.
 *  - WORLD: each lesson's idea restated in the learner's own field ("In your world").
 *  - ROLE_HOOK / ROLE_BRIEF: why a module matters, and how to approach the capstone, by role.
 */
export type Domain = {
  label: string;
  trigger: string;
  item: string;
  items: string;
  junk: string;
  action: string;
  team: string;
};

export const DOMAINS: Record<"manufacturing" | "it" | "retail" | "finance", Domain> = {
  manufacturing: {
    label: "Manufacturing",
    trigger: "a sensor reading comes off the line",
    item: "a production record",
    items: "production records",
    junk: "a reading with no machine ID",
    action: "raising a maintenance ticket",
    team: "the shift lead",
  },
  it: {
    label: "IT services",
    trigger: "a new support ticket arrives",
    item: "a ticket",
    items: "tickets",
    junk: "a ticket with no customer on it",
    action: "paging the on-call engineer",
    team: "the service desk",
  },
  retail: {
    label: "Retail / e-commerce",
    trigger: "an order is placed",
    item: "an order",
    items: "orders",
    junk: "an order with no shipping address",
    action: "notifying the warehouse",
    team: "the fulfilment team",
  },
  finance: {
    label: "Finance",
    trigger: "an invoice lands in the inbox",
    item: "an invoice",
    items: "invoices",
    junk: "an invoice with no PO number",
    action: "posting it to the ledger",
    team: "accounts payable",
  },
};

/** A field the learner typed in: no hand-written nouns, so the card speaks generally under their label. */
export const customDomain = (label: string): Domain => ({
  label,
  trigger: "a new record arrives from one of your systems",
  item: "a record",
  items: "records",
  junk: "a record with a key field missing",
  action: "updating the system that needs it",
  team: "your team",
});

/**
 * Keyed by lesson id ("1.1"), each returns that lesson's idea restated for the
 * learner's field (Build Your First AI Agent). Every screen that shows one
 * skips the card when its lesson has no entry.
 */
export const WORLD: Record<string, (d: Domain) => string> = {
  "1.1": (d) => `In ${d.label}, an agent would read ${d.item}, decide what it needs, and act on its own, for example by ${d.action}, instead of waiting for someone to click through each step.`,
  "1.2": (d) => `If every one of your ${d.items} is handled the same way, a fixed workflow is enough. When each one needs looking into and a judgement call first, that's where an agent earns its cost.`,
  "1.3": (d) => `A good first agent in ${d.label} answers the questions ${d.team} gets ten times a day, by looking up ${d.items} instead of guessing.`,
  "1.4": (d) => `For ${d.label}: the model reads the request, tools look up ${d.items}, memory keeps what was already said, and planning breaks the job into steps.`,
  "2.3": (d) => `Tell the model exactly what ${d.item} looks like in ${d.label}, what a good answer contains, and the format you want back.`,
  "2.4": (d) => `A system prompt for ${d.label} names the role, the rules ${d.team} works by, and what to do when unsure, for example when ${d.junk} turns up.`,
  "2.5": (d) => `Ask for JSON with the same fields every time, so the code that handles your ${d.items} never has to guess where the answer is.`,
  "3.1": (d) => `In ${d.label}, one tool could fetch ${d.item} and another could handle ${d.action}. The model asks for a tool; your code runs it.`,
  "3.2": (d) => `Give each tool one job in ${d.label}, and say in its description exactly when to use it, so the model never reaches for the wrong one.`,
  "3.4": (d) => `Wrap the system that holds your ${d.items} in a tool that returns only the fields the model needs, and keep its keys in your code's environment.`,
  "3.5": (d) => `When the system that holds your ${d.items} times out, send the error back to the model so it can tell ${d.team} honestly instead of guessing.`,
  "4.1": (d) => `Short-term memory holds this conversation about ${d.item}; long-term memory holds what ${d.team} wants remembered next time. Store only what's needed.`,
  "4.2": (d) => `In a long thread about ${d.items}, pin the key facts, like the record's ID, so trimming old messages never drops them.`,
  "4.3": (d) => `Put the documents ${d.team} relies on into retrieval, so answers about ${d.items} quote your own rules, not the model's guesses.`,
  "4.4": (d) => `A request in ${d.label} becomes steps: find ${d.item}, check it, then act. If a step fails, the agent re-plans instead of pushing on.`,
  "4.5": (d) => `Think, act, observe: the agent reads ${d.item}, calls a tool, reads the result, and repeats until it's done or reaches its step limit.`,
  "5.1": (d) => `Scope your first ${d.label} agent to one job ${d.team} does every day, with a clear measure of success and a hand-off for everything else.`,
  "5.4": (d) => `When a test about ${d.items} fails, read the trace: which tool was called, with what input, and what came back.`,
  "5.5": (d) => `Build your test set from real ${d.items}, including the messy ones, such as ${d.junk}.`,
  "6.1": (d) => `In ${d.label}, anything hard to undo, like ${d.action}, should need a person's approval until the agent has earned trust.`,
  "6.2": (d) => `Track cost and time for every request. A sudden spike usually means one odd ${d.item} sent the agent round a loop.`,
  "6.3": (d) => `Put the agent behind an API that the tools ${d.team} already uses can call, with the key kept on the server.`,
};

export const ROLES: Record<"engineer" | "lead" | "manager" | "student", string> = {
  engineer: "an engineer",
  lead: "a team lead",
  manager: "a manager",
  student: "a student",
};

/** "a" or "an" in front of a role the learner typed. */
export const customRole = (label: string) => `${/^[aeiou]/i.test(label) ? "an" : "a"} ${label}`;

type RoleKey = keyof typeof ROLES | "other";

/** Keyed by module number, why that module matters for each role (Build Your First AI Agent). */
export const ROLE_HOOK: Record<number, Record<RoleKey, string>> = {
  1: {
    engineer: "You'll be the one building it. Knowing when an agent beats a script or a workflow saves you from building the wrong thing.",
    lead: "Your team will be asked for \"an AI agent\". This module helps you tell when one is worth it and when a workflow will do.",
    manager: "You don't need to code it. You need to know what an agent can do, what it costs and where it fails, so you can ask the right questions.",
    student: "Agents are one of the most asked-about skills in tech right now. By the end of this course you'll have built one to show.",
    other: "Whatever your work, some of it is lookups and routine decisions. This module shows which of those an agent could take on.",
  },
  2: {
    engineer: "Prompts are your agent's spec. Clear system prompts and JSON schemas turn a chatty model into a part you can build on.",
    lead: "Invented answers are a process problem as much as a model problem. This module shows the rules and facts that prevent them.",
    manager: "When an AI tool states something false with confidence, this module is how you understand why, and what fixes it.",
    student: "Prompting well is a skill employers test for. You'll learn what makes a model reliable, not just impressive.",
    other: "You'll learn how to ask a model for exactly what you need, in a shape you can use.",
  },
  3: {
    engineer: "Tool calling is where agents meet real systems. Get the schemas and error handling right and everything else gets easier.",
    lead: "Most agent failures in production are tool failures. This module is the checklist your team should build to.",
    manager: "Tools are what let an agent act, and also what makes it risky. This module shows where the controls go.",
    student: "This is the moment a chatbot becomes an agent. You'll write tools and watch the model decide when to use them.",
    other: "Here the agent gets hands: tools to look things up and do things. You'll see what keeps that safe.",
  },
  4: {
    engineer: "Context is a budget. You'll learn what to keep, what to retrieve and how to stop a loop before it runs away.",
    lead: "Customers notice when an agent forgets. This module is how you make it remember the right things and nothing more.",
    manager: "Memory raises privacy questions as well as quality ones. You'll see what an agent should and shouldn't store.",
    student: "Retrieval and the think, act, observe loop come up in every agent interview. You'll build both, small enough to understand completely.",
    other: "You'll see how an agent remembers, looks things up in your documents and works through a task step by step.",
  },
  5: {
    engineer: "Build in small steps, trace every run, measure with a test set. This is the routine that gets agents to production.",
    lead: "A pass rate your team trusts is what lets you say \"ship it\". This module shows how to build one.",
    manager: "38 out of 60 isn't a model problem until the traces say so. You'll learn to read the numbers behind \"is it ready?\".",
    student: "This is your portfolio piece: a complete agent with tests and a score you can explain.",
    other: "You'll put every part together into one working agent and learn how to tell whether it's good enough.",
  },
  6: {
    engineer: "Limits, logs and a real endpoint: the difference between a demo and a service you'd be on call for.",
    lead: "Guardrails and monitoring are what let your team sleep. This module sets the minimum you should accept.",
    manager: "Cost, risk and accountability live here. You'll know which limits to insist on before anything goes live.",
    student: "Shipping is the part most tutorials skip. You'll deploy your agent and know how to keep it safe and affordable.",
    other: "You'll see what it takes to run an agent safely for real people, and where to go next.",
  },
};

export const ROLE_BRIEF: Record<RoleKey, string> = {
  engineer: "Build it as if you will be on call for it.",
  lead: "Build it as the reference your team would copy.",
  manager: "Build it once, so you know what a complete one contains.",
  student: "Build it as the piece you would walk through in an interview.",
  other: "Build it as something you could hand to a colleague and explain in two minutes.",
};
