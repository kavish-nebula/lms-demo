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

export const WORLD: Record<string, (d: Domain) => string> = {
  "1.1": (d) => `Your trigger would be “${d.trigger}”. Nothing runs until that happens — then one run carries ${d.item} all the way to ${d.action}.`,
  "1.2": (d) => `Here, each of your ${d.items} is one item. Tidy its fields once, up front, and stop the junk — ${d.junk} — before it ever reaches ${d.team}.`,
  "1.3": (d) => `The same four parts in your world: ${d.trigger} → tidy the fields → stop ${d.junk} → ${d.action}.`,
  "2.1": (d) => `An expression runs once for each of your ${d.items}: trim it, fix its case, reformat its date — so every record looks the same before anything compares them.`,
  "2.2": (d) => `Set gives every one of your ${d.items} the same field names and fills gaps with a default, so ${d.team} never sees two spellings of the same thing.`,
  "2.3": (d) => `Normalise first, then guard: ${d.junk} stops at the first filter, repeats stop at the second, and only clean records get as far as ${d.action}.`,
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

export const ROLE_HOOK: Record<number, Record<RoleKey, string>> = {
  1: {
    engineer: "You are the one who gets the 7 AM message. This module is how you make a failure like this loud instead of silent.",
    lead: "Your team owns pipelines like this one. This module shows what “done” has to include so nobody finds out from the founder.",
    manager: "You don’t need to build it — you need to know what to ask for. Watch where this went wrong and what a safe version contains.",
    student: "This is the kind of real failure first jobs are made of. By the end you will have built the fix yourself.",
    other: "Whatever your day looks like, someone relies on work like this running unattended. This module shows what makes it safe to rely on.",
  },
  2: {
    engineer: "Messy exports are most of real integration work. This module gives you an order of operations you can repeat.",
    lead: "Data-quality problems reach your team as “the CRM is wrong”. This is the pattern to standardise on.",
    manager: "When someone reports “only 376 of 500 made it”, this module is how you know that is the right answer.",
    student: "Cleaning data is the unglamorous skill every employer needs. You will build a pipeline that can explain every rejection.",
    other: "Most decisions in your work sit on data someone else exported. This module is how you make that data trustworthy before it is used.",
  },
};

export const ROLE_BRIEF: Record<RoleKey, string> = {
  engineer: "Build it as if you will be on call for it.",
  lead: "Build it as the reference your team would copy.",
  manager: "Build it once, so you know what a complete one contains.",
  student: "Build it as the piece you would walk through in an interview.",
  other: "Build it as something you could hand to a colleague and explain in two minutes.",
};
