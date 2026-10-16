/**
 * The question packs behind "About you": once a learner names their field,
 * their next questions come from that field's pack (the role they hold, the
 * systems they use, the first job they would hand to an agent). Students get
 * their own branch in setup.ts instead. Values are stored, labels are shown;
 * a value, once used, is never renamed (saved answers refer to it).
 *
 * `as` maps a role to the role texts written for the course (ROLE_HOOK,
 * ROLE_BRIEF in world.ts); `who` is how the role reads in a sentence.
 */

export type RoleKey = "engineer" | "lead" | "manager" | "student" | "other";

export type PackOption = { v: string; label: string; free?: string; as?: RoleKey; who?: string };

export type FieldId = "it" | "manufacturing" | "retail" | "finance" | "healthcare" | "education";

export type Pack = {
  roles: PackOption[];
  tools: PackOption[];
  firstJobs: PackOption[];
  /** shown under the tools question, where the field needs it said */
  note?: string;
};

const lead: PackOption = { v: "lead", label: "Team lead", as: "lead", who: "a team lead" };
const otherRole: PackOption = { v: "other", label: "Something else", free: "Type your role — e.g. Data analyst", as: "other" };
const python: PackOption = { v: "python", label: "Python" };
const sheets: PackOption = { v: "sheets", label: "Spreadsheets" };
const noTools: PackOption = { v: "none", label: "None of these" };

export const PACKS: Record<FieldId, Pack> = {
  it: {
    roles: [
      { v: "engineer", label: "Developer / engineer", as: "engineer", who: "a developer" },
      { v: "support", label: "Support / service desk", as: "other", who: "someone on the service desk" },
      { v: "devops", label: "DevOps / SRE", as: "engineer", who: "a DevOps engineer" },
      { v: "data", label: "Data / analytics", as: "engineer", who: "a data specialist" },
      lead,
      { v: "manager", label: "IT manager", as: "manager", who: "an IT manager" },
      otherRole,
    ],
    tools: [python, { v: "js", label: "JavaScript / TypeScript" }, { v: "apis", label: "REST APIs" }, { v: "cloud", label: "Cloud platforms" }, { v: "ticketing", label: "Ticketing tools" }, noTools],
    firstJobs: [
      { v: "triage", label: "Sorting incoming tickets" },
      { v: "incidents", label: "Summarising incidents" },
      { v: "review", label: "Code review notes" },
      { v: "faq", label: "An internal FAQ helper" },
    ],
  },
  manufacturing: {
    roles: [
      { v: "process", label: "Production / process engineer", as: "engineer", who: "a process engineer" },
      { v: "maintenance", label: "Maintenance", as: "engineer", who: "someone in maintenance" },
      { v: "quality", label: "Quality", as: "other", who: "someone in quality" },
      { v: "supply", label: "Supply chain", as: "other", who: "someone in supply chain" },
      lead,
      { v: "manager", label: "Plant or shift manager", as: "manager", who: "a plant manager" },
      otherRole,
    ],
    tools: [{ v: "erp", label: "MES / ERP" }, { v: "sensors", label: "Sensors / SCADA" }, { v: "cmms", label: "Maintenance tickets" }, sheets, python, noTools],
    firstJobs: [
      { v: "alerts", label: "Maintenance alerts" },
      { v: "quality", label: "Quality reports" },
      { v: "handover", label: "Shift handover notes" },
      { v: "suppliers", label: "Supplier emails" },
    ],
  },
  retail: {
    roles: [
      { v: "support", label: "Customer support", as: "other", who: "someone in customer support" },
      { v: "ecommerce", label: "E-commerce", as: "other", who: "someone in e-commerce" },
      { v: "ops", label: "Operations", as: "other", who: "someone in operations" },
      { v: "marketing", label: "Marketing", as: "other", who: "someone in marketing" },
      lead,
      { v: "manager", label: "Store or ops manager", as: "manager", who: "a store manager" },
      otherRole,
    ],
    tools: [{ v: "store", label: "Online store platform" }, { v: "orders", label: "Order system" }, { v: "helpdesk", label: "Helpdesk" }, sheets, python, noTools],
    firstJobs: [
      { v: "wismo", label: "“Where is my order?” replies" },
      { v: "returns", label: "Handling returns" },
      { v: "product", label: "Product questions" },
      { v: "stock", label: "Stock alerts" },
    ],
  },
  finance: {
    roles: [
      { v: "accounts", label: "Accounts / payables", as: "other", who: "someone in accounts" },
      { v: "analyst", label: "Analyst", as: "engineer", who: "a financial analyst" },
      { v: "ops", label: "Operations", as: "other", who: "someone in finance operations" },
      { v: "compliance", label: "Compliance", as: "other", who: "someone in compliance" },
      lead,
      { v: "manager", label: "Finance manager", as: "manager", who: "a finance manager" },
      otherRole,
    ],
    tools: [{ v: "erp", label: "ERP" }, { v: "sheets", label: "Excel" }, { v: "email", label: "Invoices by email" }, { v: "bi", label: "Reporting / BI" }, python, noTools],
    firstJobs: [
      { v: "invoices", label: "Matching invoices" },
      { v: "reports", label: "Summarising reports" },
      { v: "compliance", label: "Compliance checks" },
      { v: "clients", label: "Client questions" },
    ],
  },
  healthcare: {
    roles: [
      { v: "clinician", label: "Clinician", as: "other", who: "a clinician" },
      { v: "admin", label: "Admin / front desk", as: "other", who: "someone on the front desk" },
      { v: "healthit", label: "Health IT", as: "engineer", who: "someone in health IT" },
      { v: "research", label: "Research", as: "other", who: "a researcher" },
      lead,
      { v: "manager", label: "Practice manager", as: "manager", who: "a practice manager" },
      otherRole,
    ],
    tools: [{ v: "scheduling", label: "Scheduling system" }, { v: "records", label: "Records system" }, { v: "forms", label: "Email and forms" }, sheets, python, noTools],
    firstJobs: [
      { v: "appointments", label: "Appointment questions" },
      { v: "scheduling", label: "Scheduling help" },
      { v: "documents", label: "Summarising documents" },
    ],
    note: "Practice in this course only ever uses made-up records, never real patient data.",
  },
  education: {
    roles: [
      { v: "teacher", label: "Teacher", as: "other", who: "a teacher" },
      { v: "admin", label: "School admin", as: "other", who: "someone in school admin" },
      { v: "designer", label: "Instructional designer", as: "other", who: "an instructional designer" },
      { v: "edtech", label: "EdTech / IT", as: "engineer", who: "someone in EdTech" },
      lead,
      { v: "manager", label: "School leader", as: "manager", who: "a school leader" },
      otherRole,
    ],
    tools: [{ v: "lms", label: "Learning platform (LMS)" }, { v: "forms", label: "Forms and surveys" }, { v: "email", label: "Email" }, sheets, python, noTools],
    firstJobs: [
      { v: "faq", label: "Answering student FAQs" },
      { v: "marking", label: "Marking support" },
      { v: "admin", label: "Course admin" },
    ],
  },
};

/** A skipped field: the role list the course has always had (students included). Its values stay valid in saved answers. */
export const GENERAL_ROLES: PackOption[] = [
  { v: "engineer", label: "Engineer / developer", as: "engineer", who: "an engineer" },
  lead,
  { v: "manager", label: "Manager", as: "manager", who: "a manager" },
  { v: "student", label: "Student", as: "student", who: "a student" },
  otherRole,
];

/**
 * A field the learner typed that matches no pack, before (or without) the
 * model's own roles for it: they said they work in it, so no "Student".
 */
export const GENERAL_WORK_ROLES: PackOption[] = [
  { v: "specialist", label: "Specialist / practitioner", as: "other", who: "a specialist" },
  { v: "consultant", label: "Consultant / advisor", as: "other", who: "a consultant" },
  { v: "engineer", label: "Engineer / technical", as: "engineer", who: "an engineer" },
  lead,
  { v: "manager", label: "Manager", as: "manager", who: "a manager" },
  { v: "owner", label: "Owner / founder", as: "manager", who: "a business owner" },
  otherRole,
];

/** Roles every list ends with, after a field's own: team lead, manager, something else. */
export const COMMON_ROLES: PackOption[] = [lead, { v: "manager", label: "Manager", as: "manager", who: "a manager" }, otherRole];

export const GENERAL_JOBS: PackOption[] = [
  { v: "repeat", label: "Answering repeated questions" },
  { v: "summarise", label: "Summarising documents" },
  { v: "route", label: "Routing requests" },
  { v: "update", label: "Updating records" },
];

export const packOf = (domain: string | null | undefined): Pack | null => (domain && domain in PACKS ? PACKS[domain as FieldId] : null);
