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

export const DOMAINS: Record<"manufacturing" | "it" | "retail" | "finance" | "healthcare" | "education", Domain> = {
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
    label: "IT & software",
    trigger: "a new support ticket arrives",
    item: "a ticket",
    items: "tickets",
    junk: "a ticket with no customer on it",
    action: "paging the on-call engineer",
    team: "the service desk",
  },
  retail: {
    label: "Retail & e-commerce",
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
  // practice only ever uses made-up records: the profile question says so too
  healthcare: {
    label: "Healthcare",
    trigger: "a patient asks to book an appointment",
    item: "an appointment request",
    items: "appointment requests",
    junk: "a request with no preferred date",
    action: "updating the clinic schedule",
    team: "the front desk",
  },
  education: {
    label: "Education",
    trigger: "a parent emails about a deadline",
    item: "a message from a parent",
    items: "messages from parents",
    junk: "a message with no student name",
    action: "updating the class tracker",
    team: "the school office",
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

/** A student's coursework, under their subject: the same nouns whatever they study, so it reads naturally for any field. */
export const studentDomain = (label: string): Domain => ({
  label,
  trigger: "a classmate posts a question on the course forum",
  item: "a forum question",
  items: "forum questions",
  junk: "a question with no module code",
  action: "tagging the teaching assistant",
  team: "your study group",
});

/**
 * Keyed by lesson id ("1.1"), each returns that lesson's idea restated for the
 * learner's field (Build Your First AI Agent). Every screen that shows one
 * skips the card when its lesson has no entry.
 */
export const WORLD: Record<string, (d: Domain) => string> = {
  "1.1": (d) => `In ${d.label}, an agent reads ${d.item}, decides, and acts, like ${d.action}.`,
  "1.2": (d) => `If all your ${d.items} are handled the same way, use a workflow. If each needs judgement, use an agent.`,
  "1.3": (d) => `A good first agent answers what ${d.team} is asked daily, using real ${d.items}.`,
  "1.4": (d) => `The model reads the request. Tools look up ${d.items}, memory keeps context, planning makes steps.`,
  "2.3": (d) => `Tell the model what ${d.item} looks like, what a good answer has, and the format.`,
  "2.4": (d) => `Name the role, the rules ${d.team} follows, and what to do with ${d.junk}.`,
  "2.5": () => `Ask for JSON with the same fields every time, so your code never guesses.`,
  "3.1": (d) => `One tool fetches ${d.item}, another handles ${d.action}. The model asks, your code runs it.`,
  "3.2": () => `Give each tool one job and say exactly when to use it.`,
  "3.4": (d) => `Wrap the system for your ${d.items} in a tool that returns only needed fields. Keep keys in your code.`,
  "3.5": (d) => `If the system for your ${d.items} times out, send the error to the model so it tells ${d.team} honestly.`,
  "4.1": (d) => `Short-term memory holds this chat about ${d.item}. Long-term memory holds what ${d.team} needs next time.`,
  "4.2": (d) => `In long threads about ${d.items}, pin key facts like the ID so trimming never drops them.`,
  "4.3": (d) => `Put ${d.team}’s documents into retrieval, so answers quote your rules, not guesses.`,
  "4.4": (d) => `Find ${d.item}, check it, then act. If a step fails, the agent re-plans.`,
  "4.5": (d) => `The agent reads ${d.item}, calls a tool, reads the result, and repeats until done.`,
  "5.1": (d) => `Scope your first agent to one daily job for ${d.team}, with a clear success measure.`,
  "5.4": () => `When a test fails, read the trace: which tool, what input, what came back.`,
  "5.5": (d) => `Build your test set from real ${d.items}, including messy ones like ${d.junk}.`,
  "6.1": (d) => `Anything hard to undo, like ${d.action}, needs a person’s approval at first.`,
  "6.2": (d) => `Track cost and time per request. A spike often means one odd ${d.item} caused a loop.`,
  "6.3": (d) => `Put the agent behind an API that ${d.team}’s tools can call. Keep the key on the server.`,
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
    engineer: "You’ll build it. Know when an agent beats a script.",
    lead: "Learn when an agent is worth it and when a workflow will do.",
    manager: "Learn what an agent can do, what it costs, and where it fails.",
    student: "Agents are an in-demand skill. You’ll build one to show.",
    other: "See which routine lookups and decisions an agent could take on.",
  },
  2: {
    engineer: "Prompts are your spec. Clear prompts and schemas make a model reliable.",
    lead: "Learn the rules and facts that stop invented answers.",
    manager: "Learn why AI states false things confidently, and what fixes it.",
    student: "Good prompting is a skill employers test for.",
    other: "Learn to ask a model for exactly what you need.",
  },
  3: {
    engineer: "Tools connect agents to real systems. Get schemas and errors right.",
    lead: "Most production failures are tool failures. This is your checklist.",
    manager: "Tools let an agent act, and add risk. See where controls go.",
    student: "Here a chatbot becomes an agent. You’ll write its tools.",
    other: "The agent gets tools to look things up and act, safely.",
  },
  4: {
    engineer: "Context is a budget. Learn what to keep and how to stop loops.",
    lead: "Make the agent remember the right things and nothing more.",
    manager: "Memory raises privacy questions. See what an agent should store.",
    student: "You’ll build retrieval and the think, act, observe loop.",
    other: "See how an agent remembers, searches documents, and works step by step.",
  },
  5: {
    engineer: "Build small, trace every run, measure with a test set.",
    lead: "Build a pass rate your team trusts before you ship.",
    manager: "Learn to read the numbers behind “is it ready?”.",
    student: "Your portfolio piece: a tested agent with a score you can explain.",
    other: "Put it all together and check if it’s good enough.",
  },
  6: {
    engineer: "Limits, logs, and a real endpoint turn a demo into a service.",
    lead: "Set the minimum guardrails and monitoring your team needs.",
    manager: "Know which cost and risk limits to require before launch.",
    student: "Deploy your agent and keep it safe and affordable.",
    other: "See what it takes to run an agent safely for real people.",
  },
};

export const ROLE_BRIEF: Record<RoleKey, string> = {
  engineer: "Build it as if you’re on call for it.",
  lead: "Build the version your team would copy.",
  manager: "Build one to see what a complete one contains.",
  student: "Build what you’d show in an interview.",
  other: "Build something you could explain in two minutes.",
};
