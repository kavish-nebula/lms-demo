// Profile question tests: node tests/backend/run.mjs profiling. The questions branch on the learner's field.
import { domainOf, normalizeAnswers, profileLines, questionById, questionsFor, roleKeyOf, roleLabelOf, type SetupAnswers } from "@/lib/setup";
import { SetupBody } from "@/server/validators";
import { courseContext } from "@/server/planner/context";
import { baselinePlan, type PlannerInput } from "@/server/planner/baseline";
import { plannerPrompt } from "@/server/planner/llm";
import { ROLE_BRIEF } from "@/lib/world";
import { fieldGroupOf } from "@/lib/field-group";
import { accentFor } from "@/lib/field-accent";

let failures = 0;
const check = (label: string, cond: unknown, extra?: unknown) => {
  if (!cond) failures++;
  console.log(`${cond ? "PASS" : "FAIL"} ${label}${!cond && extra !== undefined ? ` -> ${JSON.stringify(extra).slice(0, 300)}` : ""}`);
};
const ids = (a: SetupAnswers) => questionsFor(a).map((q) => q.id).join();
const opts = (a: SetupAnswers, id: Parameters<typeof questionById>[0]) => questionById(id, a).options.map((o) => o.v).join();

/* ---------------------------------------------------------------- branching */
check("no answers: field first, then the general questions", ids({}) === "domain,role,goal,experience,coding,firstStep,style", ids({}));
check("student: studies, subject and projects instead of role, years, tools", ids({ domain: "student" }) === "domain,studyLevel,studyField,project,goal,experience,coding,firstStep,style", ids({ domain: "student" }));
check("student: goals turn to studies and career", opts({ domain: "student" }, "goal") === "studies,portfolio,career,curious");
check("IT: the field's pack (role, years, tools, first job)", ids({ domain: "it" }) === "domain,role,years,tools,firstJob,goal,experience,coding,firstStep,style", ids({ domain: "it" }));
check("IT: roles from the IT pack", opts({ domain: "it" }, "role").startsWith("engineer,support,devops,data"));
check("retail: its own roles, tools and first jobs", opts({ domain: "retail" }, "role").startsWith("support,ecommerce") && opts({ domain: "retail" }, "tools").includes("helpdesk") && opts({ domain: "retail" }, "firstJob").startsWith("wismo"));
check("typed field: no tools question, general roles and first jobs", ids({ domain: "other", domainOther: "Logistics" }) === "domain,role,years,firstJob,goal,experience,coding,firstStep,style" && opts({ domain: "other" }, "firstJob").startsWith("repeat"));
check("healthcare: the tools question says practice data is made up", /made-up records/.test(questionById("tools", { domain: "healthcare" }).note ?? ""));
check("coding: worded for non-technical roles", questionById("coding", { domain: "retail", role: "support" }).q === "Have you ever written code or scripts?" && questionById("coding", { domain: "it", role: "engineer" }).q === "How much code have you written?");

/* ---------------------------------------------------------------- infer */
check("Python among the tools: the coding question is skipped", !ids({ domain: "it", tools: ["python"] }).includes("coding"));
check("…and coding is filled in as Python", normalizeAnswers({ domain: "it", tools: ["python"] }).coding === "python");
check("…shown to the planner as an answer", profileLines({ domain: "it", tools: ["python"] }).some((l) => l.id === "coding" && l.answer === "Python, regularly"));

/* ---------------------------------------------------------------- normalise */
const student: SetupAnswers = { domain: "student", studyLevel: "undergrad", studyField: "cs", project: "own", goal: "career", coding: "python" };
const switched = normalizeAnswers({ ...student, domain: "it", role: "engineer" });
check("switch student → IT: study answers dropped", !switched.studyLevel && !switched.studyField && !switched.project, switched);
check("…a student-only goal dropped, shared answers kept", !switched.goal && switched.coding === "python" && switched.role === "engineer", switched);
check("an invalid value is dropped", normalizeAnswers({ style: "analogies", firstStep: "example" }).style === undefined);
check("old answers stay valid (manufacturing + engineer)", normalizeAnswers({ domain: "manufacturing", role: "engineer", experience: "never" }).role === "engineer");
check("'None of these' stands alone", normalizeAnswers({ domain: "it", tools: ["python", "none"] }).tools?.join() === "none");
check("…and then nothing is inferred", normalizeAnswers({ domain: "it", tools: ["none"] }).coding === undefined);
check("tools from another field are dropped", normalizeAnswers({ domain: "retail", tools: ["helpdesk", "sensors"] }).tools?.join() === "helpdesk");
check("typed text kept only with 'Something else'", normalizeAnswers({ domain: "other", domainOther: "  Logistics " }).domainOther === "Logistics" && normalizeAnswers({ domain: "it", domainOther: "x" }).domainOther === undefined);
check("student subject typed", normalizeAnswers({ domain: "student", studyField: "other", studyFieldOther: "Psychology" }).studyFieldOther === "Psychology");
const parsed = SetupBody.parse({ answers: { ...student, domain: "retail", role: "support", years: "1-3", tools: ["helpdesk", "python"], firstJob: "wismo", extra: { fu1: "o2" }, field: "healthcare" } });
check("server: the validator checks shape only (services normalise with the derived result)", parsed.answers.studyLevel === "undergrad" && parsed.answers.extra?.fu1 === "o2", parsed.answers);
const cleaned = normalizeAnswers(parsed.answers);
check("server: normalising drops the stale branch, a stray pack match and unknown follow-up answers", !cleaned.studyLevel && cleaned.coding === "python" && cleaned.firstJob === "wismo" && !cleaned.field && !cleaned.extra, cleaned);

/* ---------------------------------------------------------------- derived */
check("student: role texts for students, labelled by study level", roleKeyOf(student) === "student" && roleLabelOf(student) === "an undergraduate");
check("pack roles map onto the course's role texts", roleKeyOf({ domain: "it", role: "devops" }) === "engineer" && roleKeyOf({ domain: "retail", role: "support" }) === "other" && roleKeyOf({ domain: "finance", role: "manager" }) === "manager");
check("pack role reads naturally", roleLabelOf({ domain: "retail", role: "support" }) === "someone in customer support");
check("student examples use coursework in their subject", domainOf(student)?.label === "Computer science / IT" && /forum/.test(domainOf(student)!.trigger));
check("new fields have their own examples", domainOf({ domain: "healthcare" })?.label === "Healthcare" && domainOf({ domain: "education" })?.label === "Education");

/* ---------------------------------------------------------------- baseline plan */
const ctx = await courseContext("ai-agent");
check("context: lessons with code are found from the content", ctx.codeLessons.includes("1.5") && !ctx.codeLessons.includes("1.1"), ctx.codeLessons);
const input = (answers: SetupAnswers, extra: Partial<PlannerInput> = {}): PlannerInput => ({ name: "Kavish", answers: normalizeAnswers(answers), supportOverride: "auto", pace: null, precheck: null, ...extra });
const lesson = (p: ReturnType<typeof baselinePlan>, id: string) => p.modules.flatMap((m) => m.lessons).find((l) => l.lessonId === id)!;

const newCoder = baselinePlan(input({ domain: "retail", role: "support", coding: "none", experience: "sometimes" }), ctx);
check("never coded: lessons with code start on extra help", lesson(newCoder, "1.5").support === "extra" && /code/.test(lesson(newCoder, "1.5").why), lesson(newCoder, "1.5"));
check("…lessons without code follow experience", lesson(newCoder, "1.1").support === "standard", lesson(newCoder, "1.1"));
const pythonist = baselinePlan(input({ domain: "it", role: "engineer", tools: ["python"], experience: "sometimes" }), ctx);
check("writes Python: lessons with code start lighter", lesson(pythonist, "2.2").support === "light");
const checked = baselinePlan(input({ domain: "retail", coding: "none" }, { precheck: { at: "2026-10-15", lessons: { "1.5": 2 } } }), ctx);
check("the quick check wins over the coding answer", lesson(checked, "1.5").support === "light" && /quick check/.test(lesson(checked, "1.5").why), lesson(checked, "1.5"));
const chosen = baselinePlan(input({ domain: "retail", coding: "none" }, { supportOverride: "standard" }), ctx);
check("a level the learner chose wins", lesson(chosen, "1.5").support === "standard");

const studentPlan = baselinePlan(input(student), ctx);
check("student plan: coursework examples and the student capstone brief", /forum/.test(lesson(studentPlan, "1.1").inYourWorld.body) && studentPlan.capstoneBrief === ROLE_BRIEF.student, { world: lesson(studentPlan, "1.1").inYourWorld, brief: studentPlan.capstoneBrief });
check("student plan summary names them by study level", /undergraduate/.test(studentPlan.summary), studentPlan.summary);
const veteran = baselinePlan(input({ domain: "finance", role: "analyst", years: "8plus" }), ctx);
check("summary mentions years in the field", /8 years or more/.test(veteran.summary), veteran.summary);

/* ---------------------------------------------------------------- planner prompt */
const studentPrompt = plannerPrompt({ ctx, input: input(student), previous: null, evidence: [], trigger: "enrol" }).user;
check("prompt (student): studies and subject, no role or tools", /Studies: Undergraduate/.test(studentPrompt) && /Subject: Computer science/.test(studentPrompt) && !/- Role:/.test(studentPrompt) && !/Tools you use/.test(studentPrompt), studentPrompt.slice(0, 500));
const itPrompt = plannerPrompt({ ctx, input: input({ domain: "it", role: "devops", tools: ["python", "cloud"], firstJob: "incidents" }), previous: null, evidence: [], trigger: "enrol" }).user;
check("prompt (IT): role, tools, first job and the inferred coding answer", /Role: DevOps \/ SRE/.test(itPrompt) && /Tools you use: Python, Cloud platforms/.test(itPrompt) && /First job for an agent: Summarising incidents/.test(itPrompt) && /Coding: Python, regularly/.test(itPrompt), itPrompt.slice(0, 600));
check("prompt (IT): no student questions", !/Studies:|Subject:/.test(itPrompt));

/* ---------------------------------------------------------------- quote group, colours */
check("field group (for Pip's quote): typed field is other; none without a field", fieldGroupOf({ domain: "retail" }) === "retail" && fieldGroupOf({ domain: "other", domainOther: "Logistics" }) === "other" && fieldGroupOf({ domain: "student" }) === "student" && fieldGroupOf({}) === null);
check("accent: field palettes only for fields with one", accentFor({ domain: "healthcare" }) === "healthcare" && accentFor({ domain: "student" }) === null && accentFor({ domain: "other" }) === null);

console.log("\nSTUDENT PROMPT (first lines):\n" + studentPrompt.split("\n").slice(0, 14).join("\n"));
console.log(`\n${failures ? `${failures} FAILED` : "ALL PASSED"}`);
process.exit(failures ? 1 : 0);
