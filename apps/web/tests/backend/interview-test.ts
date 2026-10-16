// Interview tests: node tests/backend/run.mjs interview. In-memory database, a stand-in for the language model.
import { courseTurn, interviewTurn, missingCourseSlots, missingSlots } from "@/server/profiling/interview";
import { resetAnalyseLimits } from "@/server/profiling/analyse";
import { getSessionUser } from "@/server/auth";
import { deleteUserData, getProfileDraft, saveProfile } from "@/server/repo";
import { getCourse } from "@/data";
import { interviewLines, normalizeAnswers, profilePart, roleKeyOf, type SetupAnswers } from "@/lib/setup";
import { courseContext } from "@/server/planner/context";
import { baselinePlan } from "@/server/planner/baseline";
import { plannerPrompt } from "@/server/planner/llm";
import { LlmError, type ChatRequest, type ChatResponse, type LlmTransport } from "@/server/ai/llm";

let failures = 0;
const check = (label: string, cond: unknown, extra?: unknown) => {
  if (!cond) failures++;
  console.log(`${cond ? "PASS" : "FAIL"} ${label}${!cond && extra !== undefined ? ` -> ${JSON.stringify(extra).slice(0, 300)}` : ""}`);
};
const reply = (body: unknown): ChatResponse => ({ model: "stub", choices: [{ finish_reason: "stop", message: { content: JSON.stringify(body) } }] });
const user = await getSessionUser();
const course = (await getCourse("ai-agent"))!;
await deleteUserData(user.id);
resetAnalyseLimits();

// the stand-in answers both kinds of call: the field reading, and the interviewer
const calls: ChatRequest[] = [];
let interviewer: (r: ChatRequest) => ChatResponse = () => reply({});
let field: () => ChatResponse = () => reply({ field: "none", confidence: 0.3, vocab: null, roles: [{ label: "Safety auditor", kind: "hands-on" }, { label: "HSE consultant", kind: "hands-on" }], firstJobs: ["Writing risk assessments", "Logging incidents"] });
const stub: LlmTransport = async (r) => {
  calls.push(r);
  return r.messages[0]!.content.startsWith("You help set up") ? field() : interviewer(r);
};
const lastCall = () => calls.filter((c) => c.messages[0]!.content.startsWith("You are Pip")).at(-1)!;
const lastPrompt = () => lastCall().messages[1]!.content;
/** Answers whatever is listed first among the missing facts, with its first two values (or examples of its own). */
const firstMissing = (r: ChatRequest) => {
  const lines = r.messages[1]!.content.split("FACTS STILL MISSING")[1]!.trim().split("\n");
  const m = /^- (\w+) \[[^\]]*\]( multi)?.*?: (.*)$/.exec(lines[0]!)!;
  const values = [...m[3]!.matchAll(/(\w[\w-]*) \(/g)].map((x) => x[1]!).slice(0, 2);
  const options = values.length >= 2 ? values.map((v) => ({ label: v, value: v })) : [{ label: "More practice", value: "custom" }, { label: "Nothing in particular", value: "custom" }];
  return reply({ ack: "Thanks.", next: { slot: m[1], q: `About ${m[1]}?`, options, multi: !!m[2] } });
};

/* ================================================================ profile stage */
let s = await interviewTurn(user.id, { answers: {}, needs: [] }, stub);
check("profile: nothing typed yet, no question from the model (the chat asks for the field)", s.question === null && !s.done && calls.length === 0);

interviewer = () => reply({ ack: "Safety consulting, great.", next: { slot: "role", q: "What kind of safety work do you do day to day?", options: [{ label: "Site audits", value: "custom", kind: "other" }, { label: "Running a consultancy", value: "custom", kind: "manager" }, { label: "Engineer", value: "engineer" }, { label: "Bogus", value: "not-a-value" }] } });
s = await interviewTurn(user.id, { answers: {}, needs: [], last: { slot: "domain", q: "What field do you work or study in?", text: "Safety consulting" } }, stub);
check("field: typed text becomes the field, read once", s.answers.domain === "other" && s.answers.domainOther === "Safety consulting" && s.derived?.forField === "safety consulting");
check("next: the model's question, for this learner", s.question?.slot === "role" && s.question.q.startsWith("What kind of safety work") && s.question.source === "ai", s.question);
check("next: options limited to values the course understands for this field (or the model's own roles)", s.question?.options.map((o) => o.value).join() === "custom,custom", s.question?.options);
check("profile prompt: person-level only, no course facts", !lastPrompt().includes("- goal [") && !lastPrompt().includes("- experience [") && !lastPrompt().includes("- firstJob [") && !/building AI agents/.test(lastCall().messages[0]!.content), lastPrompt().slice(0, 400));
check("profile prompt: the field's own roles are offered as values", lastPrompt().includes("r1 (Safety auditor)"));

interviewer = () => reply({ ack: "Got it.", next: { slot: "years", q: "How long have you been auditing sites?", options: [{ label: "Under a year", value: "lt1" }, { label: "A good while", value: "8plus" }] } });
s = await interviewTurn(user.id, { answers: s.answers, needs: s.needs, last: { slot: "role", q: s.question!.q, value: "custom", label: "Running a consultancy", kind: "manager" } }, stub);
check("own words: a role written by the model is kept with its role text", s.answers.role === "other" && s.answers.roleOther === "Running a consultancy" && roleKeyOf(s.answers) === "manager", s.answers);

interviewer = () => reply({ captured: { slot: "years", value: "4-7" }, ack: "Nice.", next: { slot: "coding", q: "Do you write any code in your safety work, like scripts for reports?", options: [{ label: "Not yet", value: "none" }, { label: "A few", value: "little" }] } });
s = await interviewTurn(user.id, { answers: s.answers, needs: s.needs, last: { slot: "years", q: s.question!.q, text: "about five years now" } }, stub);
check("typed: the model reads a typed answer as a value the course understands", s.answers.years === "4-7", s.answers.years);
check("agent: a question mentioning agents or scripts is asked as written (\"age\" inside \"agent\" is not personal)", s.question?.source === "ai");

interviewer = () => reply({ captured: { slot: "coding", value: "nonsense" }, ack: "", next: { slot: "firstStep", q: "When you pick up a new method, what helps first?", options: [{ label: "A worked example", value: "example" }, { label: "The idea", value: "idea" }] } });
s = await interviewTurn(user.id, { answers: s.answers, needs: s.needs, last: { slot: "coding", q: s.question!.q, text: "no idea" } }, stub);
check("typed: a capture the course doesn't understand is not stored (the transcript keeps their words)", !s.answers.coding && s.answers.interview!.at(-1)!.a === "no idea");

interviewer = () => reply({ ack: "Hm.", next: { slot: "domain", q: "Which field again?", options: [{ label: "A", value: "it" }, { label: "B", value: "retail" }] } });
const repeat = await interviewTurn(user.id, { answers: s.answers, needs: s.needs }, stub);
check("rejected: asking about something already answered falls back to the engine's question", repeat.question?.source === "rules" && repeat.question.slot !== "domain", repeat.question);
interviewer = () => reply({ next: { slot: repeat.question!.slot, q: "How old are you?", options: [{ label: "Under 30", value: "x" }, { label: "30+", value: "y" }] } });
check("rejected: personal questions are never asked", (await interviewTurn(user.id, { answers: s.answers, needs: s.needs }, stub)).question?.source === "rules");
interviewer = () => {
  throw new LlmError("rejected", "401");
};
check("model down: the engine's question for the next missing fact", (await interviewTurn(user.id, { answers: s.answers, needs: s.needs }, stub)).question?.source === "rules");
check("no key: the interview still runs on the engine's questions", (await interviewTurn(user.id, { answers: s.answers, needs: s.needs }, null)).question?.source === "rules");

let a: SetupAnswers = s.answers;
let needs: string[] = [];
let guard = 0;
interviewer = firstMissing;
let q = (await interviewTurn(user.id, { answers: a, needs }, stub)).question;
while (q && guard++ < 15) {
  const st = await interviewTurn(user.id, { answers: a, needs, last: { slot: q.slot, q: q.q, value: q.multi ? [q.options[0]!.value] : q.options[0]!.value, label: q.options[0]!.label } }, stub);
  a = st.answers;
  needs = st.needs;
  q = st.question;
}
const asked = (a.interview ?? []).filter((t) => t.slot !== "domain");
check("profile end: done when nothing person-level is missing, within the cap", !q && asked.length <= 9 && missingSlots(a, needs, s.derived).length === 0, asked.map((t) => t.slot));
check("profile end: never asked a course fact", !asked.some((t) => ["goal", "experience", "firstJob"].includes(t.slot)), asked.map((t) => t.slot));
check("profile end: comfort asked like the rest and stored as needs", asked.some((t) => t.slot === "needs"));
check("profile end: the draft holds the whole interview", ((await getProfileDraft(user.id))?.answers.interview?.length ?? 0) === (a.interview?.length ?? 0));
await saveProfile(user.id, normalizeAnswers(a, s.derived), needs, s.derived);

/* ================================================================ course stage */
calls.length = 0;
interviewer = () => reply({ ack: "", next: { slot: "goal", q: "What would you like Build Your First AI Agent to do for your consultancy?", options: [{ label: "Use it with clients", value: "work" }, { label: "Understand agents", value: "ideas" }] } });
let c = await courseTurn(user.id, course, { answers: {} }, stub);
check("course: the first question is the model's, about this course", c.question?.slot === "goal" && c.question.source === "ai" && /Build Your First AI Agent/.test(c.question.q));
check("course prompt: course outline and their profile", lastPrompt().includes('COURSE: "Build Your First AI Agent"') && lastPrompt().includes("Module 1 (m1)") && lastPrompt().includes("roleOther: Running a consultancy"), lastPrompt().slice(0, 400));
check("course prompt: only course facts are missing (goal, experience, first job, known modules, expectations)", ["- goal [", "- experience [", "- firstJob [", "- known [", "- expect ["].every((x) => lastPrompt().includes(x)) && !lastPrompt().includes("- coding ["));

interviewer = () => reply({ ack: "Using it with clients makes sense.", next: { slot: "known", q: "Which parts of the course do you already know?", options: [{ label: "Agent basics", value: "m1" }, { label: "LLM essentials", value: "m2" }, { label: "None of it", value: "none" }], multi: true } });
c = await courseTurn(user.id, course, { answers: c.answers, last: { slot: "goal", q: c.question!.q, value: "work", label: "Use it with clients" } }, stub);
check("course: a tapped answer is kept", c.answers.goal === "work");
check("course: known modules are offered from the outline, several at once", c.question?.slot === "known" && c.question.multi === true && c.question.options.some((o) => o.value === "m2"));

interviewer = () => reply({ ack: "Good to know.", next: { slot: "expect", q: "Anything you'd like the course to focus on, or skip?", options: [{ label: "More hands-on", value: "custom" }, { label: "Skip the theory", value: "custom" }] } });
c = await courseTurn(user.id, course, { answers: c.answers, last: { slot: "known", q: c.question!.q, value: ["m1", "m2"], label: "Agent basics, LLM essentials" } }, stub);
check("course: modules they know are stored", c.answers.known?.join() === "m1,m2");
interviewer = firstMissing;
c = await courseTurn(user.id, course, { answers: c.answers, last: { slot: "expect", q: c.question!.q, text: "Mostly hands-on, I already know the theory" } }, stub);
check("course: what they want from it, in their words", c.answers.expect === "Mostly hands-on, I already know the theory");
let cq = c.question;
guard = 0;
while (cq && guard++ < 8) {
  c = await courseTurn(user.id, course, { answers: c.answers, last: { slot: cq.slot, q: cq.q, value: cq.multi ? [cq.options[0]!.value] : cq.options[0]!.value, label: cq.options[0]!.label } }, stub);
  cq = c.question;
}
const courseAsked = c.answers.courseInterview ?? [];
check("course end: four or five questions, then done", c.done && courseAsked.length >= 4 && courseAsked.length <= 5, courseAsked.map((t) => t.slot));
check("course end: none of the profile questions again", !courseAsked.some((t) => ["role", "years", "coding", "firstStep", "style", "needs", "domain"].includes(t.slot)));
check("course answers stay out of the profile", !profilePart(c.answers).known && !profilePart(c.answers).goal && !profilePart(c.answers).courseInterview);
check("course reply: only the course answers, the profile stays on the server", !c.answers.roleOther && !c.answers.domain && c.answers.goal === "work");
check("planner: sees the course questions in their words", interviewLines(c.answers, "courseInterview").some((l) => l.includes("Mostly hands-on")));
interviewer = () => {
  throw new LlmError("busy", "503");
};
const fallback = await courseTurn(user.id, course, { answers: {} }, stub);
check("course, model down: the engine's question for the first course fact", fallback.question?.source === "rules" && fallback.question.slot === "goal");
check("course, rules for known modules: the outline's modules", missingCourseSlots({ ...c.answers, courseInterview: [] }, null, course).find((x) => x.slot === "known")?.values.length === course.modules.length + 1);

/* ================================================================ the plan uses the course answers */
const ctx = await courseContext("ai-agent");
const fit: SetupAnswers = { domain: "it", role: "engineer", experience: "sometimes", known: ["m1", "m2"], expect: "Mostly hands-on, I already know the theory", courseInterview: [{ slot: "known", q: "Which parts do you know?", a: "Agent basics, LLM essentials" }] };
const fp = baselinePlan({ name: "Kavish", answers: fit, supportOverride: "auto", pace: null, precheck: null }, ctx);
const fm1 = fp.modules.find((m) => m.moduleId === "m1")!;
check("plan: a module they know is a quick refresher with a lighter touch", fm1.emphasis === "skim" && fm1.lessons.every((l) => l.support === "light" && l.why.includes("already know")), fm1);
check("plan: modules they don't know stay standard", fp.modules.find((m) => m.moduleId === "m3")!.emphasis === "standard");
const chose = baselinePlan({ name: "Kavish", answers: fit, supportOverride: "extra", pace: null, precheck: null }, ctx);
check("plan: a help level they chose still wins", chose.modules[0]!.lessons.every((l) => l.support === "extra"));
const fprompt = plannerPrompt({ ctx, input: { name: "Kavish", answers: fit, supportOverride: "auto", pace: null, precheck: null }, previous: null, evidence: [], trigger: "enrol" }).user;
check("AI planner: sees the modules they know, what they want, and the course questions", fprompt.includes("already know: m1, m2") && fprompt.includes("Mostly hands-on") && fprompt.includes("Enrolment questions for this course"), fprompt.slice(0, 800));

/* ================================================================ students */
await deleteUserData(user.id);
calls.length = 0;
field = () => reply({ field: "student", confidence: 0.9, vocab: null });
interviewer = () => reply({ ack: "Computer science, nice.", next: { slot: "studyLevel", q: "Which year are you in?", options: [{ label: "Undergraduate", value: "undergrad" }, { label: "Postgraduate", value: "postgrad" }] } });
const st = await interviewTurn(user.id, { answers: {}, needs: [], last: { slot: "domain", q: "What field do you work or study in?", text: "Studying computer science" } }, stub);
check("student: their field becomes their subject, and the student questions follow", st.answers.domain === "student" && st.answers.studyFieldOther === "Studying computer science" && st.question?.slot === "studyLevel", st.answers);
await deleteUserData(user.id);
const rules = await interviewTurn(user.id, { answers: {}, needs: [], last: { slot: "domain", q: "?", text: "I'm a student" } }, null);
check("student: spotted by the rules too, without a model", rules.answers.domain === "student");

console.log(`\n${failures ? `${failures} FAILED` : "ALL PASSED"}`);
process.exit(failures ? 1 : 0);
