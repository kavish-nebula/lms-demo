/* Run from the repo root: node --test apps/web/tests/learning-experience.test.cjs */
/* eslint-disable @typescript-eslint/no-require-imports -- Node's CommonJS test loader transpiles isolated pure modules. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const root = path.resolve(__dirname, '../../..');
const cache = new Map();
function load(file) {
  const resolved = path.resolve(root, file);
  if (cache.has(resolved)) return cache.get(resolved).exports;
  const mod = { exports: {} };
  cache.set(resolved, mod);
  const output = ts.transpileModule(fs.readFileSync(resolved, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  const localRequire = (id) => {
    if (id.endsWith('.css')) return {};
    if (id.startsWith('.') || id.startsWith('@/')) {
      const base = id.startsWith('@/') ? path.join(root, 'apps/web/src', id.slice(2)) : path.resolve(path.dirname(resolved), id);
      const source = ['.ts', '.tsx', '.js'].map((ext) => base + ext).find((p) => fs.existsSync(p));
      if (!source) throw new Error(`Cannot resolve ${id}`);
      return load(path.relative(root, source));
    }
    return require(id);
  };
  new Function('require', 'module', 'exports', output)(localRequire, mod, mod.exports);
  return mod.exports;
}
const memory = new Map();
global.localStorage = { getItem: (k) => memory.get(k) ?? null, setItem: (k, v) => memory.set(k, v), removeItem: (k) => memory.delete(k) };

test('discovery chat turns evidence into quick-check scores without guessing unseen skills', () => {
  const discovery = load('apps/web/src/lib/discovery.ts');
  const skills = ['1', '2', '3'].map((key) => ({ key, moduleId: `m${key}`, title: `Skill ${key}`, probes: [] }));
  const evidence = discovery.cleanEvidence(
    [
      { skill: '1', level: 1, note: 'partly' },
      { skill: '1', level: 2, note: 'later, clearly' },
      { skill: '2', level: 0, note: 'not yet' },
      { skill: '9', level: 2, note: 'unknown skill is dropped' },
      { skill: '3', level: 5, note: 'bad level is dropped' },
    ],
    skills,
  );
  assert.equal(evidence.length, 3);
  assert.deepEqual(discovery.lessonsFromEvidence(evidence, skills), { 1: 2, 2: 0 });
  assert.ok(!('3' in discovery.lessonsFromEvidence(evidence, skills)), 'a skill the chat never reached stays unknown');
  const profile = discovery.profileFromLevels(discovery.bestLevels(evidence), skills);
  assert.deepEqual(profile.strengths, ['Skill 1']);
  assert.deepEqual(profile.focus, ['Skill 2']);
});

test('discovery fallback scores free text by the idea, and "not sure" never counts as knowing', () => {
  const discovery = load('apps/web/src/lib/discovery.ts');
  const idea = 'It can decide on steps and use tools to act toward a goal';
  assert.equal(discovery.scoreByOverlap('An agent decides its own steps and uses tools to act toward a goal', idea), 2);
  assert.equal(discovery.scoreByOverlap("I'm not sure", idea), 0);
  assert.equal(discovery.scoreByOverlap('', idea), 0);
});

test('profiling: live questions keep the profile slots, with a built-in fallback', () => {
  const profiling = load('apps/web/src/lib/profiling.ts');
  assert.deepEqual(profiling.SLOTS, ['context', 'field', 'experience', 'subrole', 'usecase', 'goal']);
  const ans = (slot, label, tag) => ({ slot, question: 'q', label, tag });

  // a model-written question: open slots get tags from labels plus "Something else"
  const sub = profiling.cleanGenerated('subrole', {
    ack: 'Nursing, that is busy work.',
    question: 'Which part of nursing are you in?',
    why: 'So examples come from your ward.',
    options: [{ label: 'Ward nursing', value: 'x' }, { label: 'ICU', value: 'x' }, { label: 'Community care', value: 'x' }, { label: 'Other', value: 'other' }],
  });
  assert.equal(sub.source, 'ai');
  assert.deepEqual(sub.options.map((o) => o.tag), ['subrole:ward-nursing', 'subrole:icu', 'subrole:community-care', 'subrole:other']);
  assert.ok(sub.options.at(-1).freeText, 'the screen offers its own "Something else"');

  // fixed slots must keep their values, whatever the wording
  const exp = profiling.cleanGenerated('experience', {
    question: 'Have you used AI tools on the ward?',
    why: 'So we start at the right level.',
    options: [{ label: 'Never', value: 'beginner' }, { label: 'Tried a chatbot', value: 'some-exposure' }, { label: 'Use it weekly', value: 'working-with-it' }, { label: 'I build them', value: 'advanced' }],
  });
  assert.deepEqual(exp.options.map((o) => o.tag), ['level:beginner', 'level:some-exposure', 'level:working-with-it', 'level:advanced']);
  assert.equal(profiling.cleanGenerated('goal', { question: 'Goal?', options: [{ label: 'A', value: 'fame' }, { label: 'B', value: 'riches' }] }), null, 'made-up values fall back to the bank');
  assert.equal(profiling.cleanGenerated('subrole', { question: '', options: [] }), null);

  // the bank, used first and whenever the model can't answer
  const finance = [ans('field', 'Finance', 'domain:finance')];
  assert.equal(profiling.bankQuestion('subrole', finance).text, 'What do you study or do in finance?');
  assert.doesNotMatch(JSON.stringify(profiling.bankQuestion('goal', [])), /get a job|career switch|new role/i);
  assert.ok(profiling.bankQuestion('subrole', [ans('field', 'Law', 'domain:law')]).options.some((o) => o.label === 'Exploring a personal interest'), 'unknown fields get general options');
  assert.ok(profiling.bankQuestion('field', []).options.at(-1).freeText);

  const p = profiling.profileFromAnswers([
    ans('field', 'Healthcare', 'domain:healthcare'),
    ans('experience', 'Tried a chatbot', 'level:some-exposure'),
    ans('subrole', 'Ward nursing', 'subrole:ward-nursing'),
    ans('usecase', 'Shift handover notes', 'usecase:shift-handover-notes'),
    ans('goal', 'Make my shifts easier', 'goal:do-my-current-job-better'),
  ]);
  assert.deepEqual([p.setup.domain, p.setup.domainOther, p.setup.experience, p.setup.goal], ['other', 'Healthcare', 'little', 'work']);
  assert.deepEqual([p.setup.subRole, p.setup.useCase, p.setup.goalDetail], ['Ward nursing', 'Shift handover notes', 'Make my shifts easier']);
  assert.equal(p.tags.length, 5);
  assert.equal(profiling.profileFromAnswers([ans('field', 'Finance', 'domain:finance')]).setup.domain, 'finance');
});

test('mission: choices show the idea held per module, and the tone follows the learner', () => {
  const mission = load('apps/web/src/lib/mission.ts');
  // tone: never more playful than the person's working life
  assert.equal(mission.audienceOf({ role: 'student' }), 'learner');
  assert.equal(mission.audienceOf({ subRole: 'Hospital administration director' }), 'executive');
  assert.equal(mission.audienceOf({ experience: 'regularly', subRole: 'Ward nursing' }), 'executive');
  assert.equal(mission.audienceOf({ subRole: 'K-12 teaching', experience: 'little' }), 'professional');

  // one item per module: gentler first item for newcomers, the second for experienced learners
  const items = ['1', '1', '2', '2'].map((lesson, i) => ({ id: `p${i + 1}`, lesson }));
  assert.deepEqual(mission.pickItems(items, 'never').map((i) => i.id), ['p1', 'p3']);
  assert.deepEqual(mission.pickItems(items, 'regularly').map((i) => i.id), ['p2', 'p4']);

  const key = {
    m1: { item: 'p1', skill: '1', means: { x1: 'a', x2: 'b' }, correct: 'b', ideas: { a: 'It runs on a bigger model', b: 'It decides steps and uses tools' } },
    m2: { item: 'p3', skill: '2', means: { y1: 'a', y2: 'b' }, correct: 'a', ideas: { a: 'It predicts the next token', b: 'It looks answers up' } },
    m3: { item: 'p5', skill: '3', means: { z1: 'a', z2: 'b' }, correct: 'a', ideas: { a: 'Your code runs the tool', b: 'The model runs it itself' } },
  };
  const titles = { 1: 'Intro', 2: 'LLMs', 3: 'Tools' };
  const a = (moment, option, switches = 0) => ({ moment, option, ms: 5000, switches });
  const plain = mission.scoreMission(key, [a('m1', 'x2'), a('m2', 'y1', 3), a('m3', null)], null, titles);
  assert.deepEqual(plain.lessons, { 1: 2, 2: 1, 3: 0 }, 'steady right = 2, right after wavering = 1, not sure = 0');
  assert.deepEqual(plain.ideas[0], { skill: '1', title: 'Intro', held: 'It decides steps and uses tools', accurate: true, sure: true });
  assert.equal(plain.ideas[2].held, 'Not sure yet');

  // the "why" separates understanding from a lucky pick
  assert.equal(mission.scoreMission(key, [a('m1', 'x2')], { moment: 'm1', level: 0 }, titles).lessons['1'], 1, 'right pick, no reasoning');
  assert.equal(mission.scoreMission(key, [a('m3', 'z2')], { moment: 'm3', level: 2 }, titles).lessons['3'], 1, 'wrong pick, right reasoning');
  const wrong = mission.scoreMission(key, [a('m1', 'x1')], null, titles);
  assert.equal(wrong.ideas[0].held, 'It runs on a bigger model', 'the misconception itself is kept for the planner');

  const profile = mission.missionProfile(plain.ideas, plain.lessons);
  assert.deepEqual([profile.strengths, profile.focus], [['Intro'], ['Tools']]);
  assert.equal(mission.missionSignals([a('m1', null), a('m2', 'y1', 2)], { moment: 'm2', text: 'because it predicts', voice: true }).notSure, 1);
  assert.equal(mission.backdropOf('Healthcare').motif, 'health');
});

test('mission: the answer key is checked against the wording, not just the model labels', () => {
  const mission = load('apps/web/src/lib/mission.ts');
  const ideas = [
    { id: 'a', text: 'It always runs on a bigger language model' },
    { id: 'b', text: 'It replies faster than a chatbot' },
    { id: 'c', text: 'It can decide on steps and use tools to act toward a goal' },
  ];
  // wording from a real audit-firm story
  const story = ['It provides responses much faster than the old chatbot.', 'It can plan steps and call tools to achieve a goal.', 'It simply runs on a much larger model than before.'];
  const right = mission.alignOptions(story.map((text, i) => ({ text, means: ['b', 'c', 'a'][i] })), ideas);
  assert.deepEqual(right, { means: ['b', 'c', 'a'], changed: false }, 'correct labels stay');
  const slipped = mission.alignOptions(story.map((text, i) => ({ text, means: ['b', 'a', 'c'][i] })), ideas);
  assert.deepEqual(slipped.means, ['b', 'c', 'a'], 'two swapped labels are put back');
  assert.equal(slipped.changed, true);

  const tools = [
    { id: 'a', text: 'The language model runs it inside itself' },
    { id: 'b', text: 'The customer runs it in their browser' },
    { id: 'c', text: 'Your code runs it and sends the result back to the model' },
  ];
  const school = ['Have the parent\u2019s web browser execute the search whenever an email arrives.', 'Have our program run the search and return the found records back.', 'Direct the language model itself to execute the file lookup internally.'];
  assert.deepEqual(mission.alignOptions(school.map((text, i) => ({ text, means: ['c', 'a', 'b'][i] })), tools).means, ['b', 'c', 'a']);
});

test('narration: a recording must say the line it was asked to say', () => {
  const { matchesTranscript } = load('apps/web/src/lib/transcript.ts');
  const line = 'Answer five short questions. Each new question is written for you, based on your last answer.';
  assert.ok(matchesTranscript(line, 'Answer five short questions, each new question is written for you based on your last answer.'));
  assert.ok(matchesTranscript('Priya asks: “Why that one?”', 'Priya asks, why that one?'), 'punctuation and quotes do not matter');
  assert.equal(matchesTranscript(line, 'How is your daily schedule typically structured?'), false, 'a made-up reply is refused');
  assert.equal(matchesTranscript('Press Begin when you are ready.', 'Read this in a natural, clear everyday voice at a normal pace. Press Begin when you are ready.'), false, 'spoken instructions are refused');
  assert.equal(matchesTranscript(line, ''), false);
});

test('your agent: named from the task and built piece by piece as the learner goes', () => {
  const agent = load('apps/web/src/lib/agent-build.ts');
  assert.equal(agent.agentNameFor('Scheduling follow-up appointments'), 'Follow-up Scheduler', 'long names keep their first topic word');
  assert.equal(agent.agentNameFor('Writing parent emails'), 'Parent Email Writer');
  assert.equal(agent.agentNameFor('Reconciliation'), 'Reconciliation Helper');
  assert.equal(agent.agentNameFor('', 'Healthcare'), 'Healthcare Assistant');
  assert.equal(agent.agentNameFor(null, null), null);

  const modules = ['m1', 'm2', 'm3', 'm4', 'm5', 'm6'].map((id) => ({ module_id: id, title: `Module ${id}`, liveState: 'available' }));
  const answers = { domain: 'other', domainOther: 'Healthcare', subRole: 'Clinic reception', useCase: 'Scheduling follow-up appointments' };
  const states = (b) => [...b.setup, ...b.parts].map((p) => ({ built: 'B', building: '*', next: 'n', later: '.' })[p.state]).join('');

  const fresh = agent.agentBlueprint({ answers: {}, precheck: null, enrolled: false, modules });
  assert.equal(fresh.name, null);
  assert.equal(fresh.current.key, 'job');
  assert.match(fresh.needs, /Tell me about your work/);

  const aboutYou = agent.agentBlueprint({ answers, precheck: null, enrolled: false, phase: 'profile', modules });
  assert.equal(aboutYou.name, 'Follow-up Scheduler');
  assert.equal(aboutYou.purpose, 'Scheduling follow-up appointments · Clinic reception');
  assert.match(aboutYou.needs, /Finish About you/, 'once the task is known, only finishing is left');

  const mission = agent.agentBlueprint({ answers, precheck: null, enrolled: false, phase: 'precheck', modules });
  assert.equal(states(mission), 'B*n......', 'job built, skills being built, roadmap next');
  assert.equal(mission.said, "I'm Follow-up Scheduler. I'll help with scheduling follow-up appointments.");

  const precheck = { at: 'x', source: 'activity', lessons: {}, activity: { strengths: ['Giving Your Agent Tools'] } };
  const midModule2 = agent.agentBlueprint({
    answers: { ...answers, agentName: 'Dr. Booker' },
    precheck,
    enrolled: true,
    modules: modules.map((m, i) => ({ ...m, liveState: i === 0 ? 'done' : i === 1 ? 'in_progress' : 'available' })),
    resume: { href: '/learn/courses/ai-agent/m2/explainer', moduleIndex: 2, title: 'What is an LLM?', minutesLeft: 12 },
  });
  assert.equal(midModule2.name, 'Dr. Booker', 'their own name wins');
  assert.equal(states(midModule2), 'BBBB*n...');
  assert.equal(midModule2.current.label, 'Brain');
  assert.match(midModule2.said, /decide my own steps/);
  assert.match(midModule2.needs, /give me a brain/);
  assert.deepEqual(midModule2.next, { label: 'What is an LLM?', href: '/learn/courses/ai-agent/m2/explainer', minutes: 12 });
  assert.equal(midModule2.setup[1].detail, 'Giving Your Agent Tools', 'starting skills come from the Mission');

  const done = agent.agentBlueprint({ answers, precheck, enrolled: true, modules: modules.map((m) => ({ ...m, liveState: 'done' })), resume: null });
  assert.equal(done.builtCount, 6);
  assert.equal(done.needs, null);
  assert.match(done.said, /live and safe/);
});

test('companion: says where the learner is, reacts to answers, and stays quiet over videos', () => {
  const g = load('apps/web/src/lib/guide-lines.ts');
  assert.match(g.phaseLine('profile'), /^Hi! I'm your agent/);
  assert.match(g.phaseLine('intro'), /preview video/);
  assert.match(g.phaseLine('precheck'), /what you already know/);
  assert.match(g.phaseLine('customize'), /your plan/);
  // fixed sentences, so each is recorded once and plays instantly
  assert.equal(g.answerReaction('field', 'IT or software'), "Great. I'll use examples from your field.");
  assert.equal(g.answerReaction('field', 'Healthcare'), g.answerReaction('field', 'IT or software'));
  assert.ok(g.FIXED_LINES.includes(g.answerReaction('subrole', 'K-12 teaching')), 'reactions are recorded ahead');
  assert.ok(g.FIXED_LINES.length >= 10 && g.FIXED_LINES.every((l) => l && !l.includes('undefined')));
  assert.equal(g.answerReaction('goal', null), "No problem, let's skip that one.");
  assert.match(g.stageLine('hook'), /real problem/);
  assert.equal(g.stageLine('project'), null);
  // every line is fixed, so all of them can be recorded once ahead
  for (const p of ['profile', 'intro', 'precheck', 'customize', 'build']) assert.ok(g.FIXED_LINES.includes(g.phaseLine(p)));
  assert.ok(g.FIXED_LINES.includes(g.stageLine('hook')));
  assert.ok(g.QUIET_STAGES.has('explainer'), 'videos have their own sound');
  // everything is spoken, so it stays short
  for (const line of [g.phaseLine('profile'), g.phaseLine('precheck'), g.BUILD_READY_LINE]) {
    for (const sentence of line.split(/(?<=[.!?])\s+/)) assert.ok(sentence.split(/\s+/).length <= 16, `short sentence: ${sentence}`);
  }
});

test('the chat reads how someone learns from how they interact', () => {
  const discovery = load('apps/web/src/lib/discovery.ts');
  const r = (text, seconds = 10, extra = {}) => ({ seconds, words: text.split(/\s+/).length, voice: false, chip: false, text, ...extra });
  const helped = discovery.summarizeSignals([r('Can you give me a hint?'), r("I'm not sure"), r('maybe it checks the order')]);
  assert.equal(helped.helpAsks, 1);
  assert.equal(helped.notSure, 1);
  assert.deepEqual([discovery.inferLearning(helped).firstStep, discovery.inferLearning(helped).style], ['example', 'steps']);
  const quick = discovery.summarizeSignals([r('it looks up the order', 6), r('use a tool', 5, { voice: true })]);
  assert.equal(quick.voiceReplies, 1);
  assert.deepEqual([discovery.inferLearning(quick).firstStep, discovery.inferLearning(quick).style], ['try', 'short']);
  assert.ok(discovery.isLearningPrefs({ firstStep: 'idea', style: 'steps', note: 'n' }));
  assert.ok(!discovery.isLearningPrefs({ firstStep: 'video', style: 'steps' }));
});


test('Pip starts with a simple introduction and inclusive learning contexts', () => {
  const React = require('react');
  const { renderToString } = require('react-dom/server');
  const { NextIntlClientProvider } = require('next-intl');
  const { LiveProfileStep } = load('apps/web/src/components/enroll/live-profile-step.tsx');
  const messages = JSON.parse(fs.readFileSync(path.join(root, 'packages/i18n/en.json'), 'utf8'));
  const html = renderToString(React.createElement(NextIntlClientProvider, { locale: 'en', messages, timeZone: 'UTC' }, React.createElement(LiveProfileStep, { courseId: 'ai-agent', name: 'Learner', answers: {}, setAnswers() {}, needs: [], setNeeds() {}, continueLabel: 'Continue', async onDone() {} })));
  assert.ok(html.includes('Pip · Your learning companion'));
  assert.ok(html.includes('Start with Pip'));
  assert.ok(!html.includes('I’ll read each question'));
  for (const label of ['School student', 'College or university student', 'Teacher or staff', 'Working professional']) assert.ok(html.includes(label));
});

test('activities show one compact task with media and reflection on demand', () => {
  const React = require('react');
  const { renderToString } = require('react-dom/server');
  const { ActivityEditor, ActivitySummary } = load('apps/web/src/components/enroll/adaptive-preparation.tsx');
  const task = { id: 'library-flow', title: 'Arrange a book search', scene: 'Your school library needs a helper to find available books.', instruction: 'Put these steps in order.', kind: 'arrange', artifact: 'Ask before reserving. Use the library catalogue.', skills: ['1.1'], imagePrompt: 'A fictional school library with a book catalogue.', items: [{ id: 'search', text: 'Search the catalogue' }, { id: 'ask', text: 'Read the request' }, { id: 'confirm', text: 'Ask before reserving' }] };
  const session = { id: 'test-session', task, rounds: 0, feedback: '', done: false, summary: 'We’ll practise tool checks together.', strengths: ['Clear goals'], focus: ['Tool checks'], evidence: [] };
  const html = renderToString(React.createElement(ActivityEditor, { session, task, onSession() {}, async onReload() {} }));
  assert.ok(html.includes('Your step order'));
  const order = html.match(/<ol[^>]*aria-label="Your step order"[\s\S]*?<\/ol>/)[0];
  for (const item of task.items) assert.equal(order.split(item.text).length - 1, 1, 'each action appears once in the order');
  assert.ok(!html.includes('<audio') && !html.includes('<img'), 'media is loaded only on request');
  assert.ok(!html.includes('Your working material') && !html.includes('Explain your approach'));
  assert.match(html, /<details[^>]*><summary[^>]*>Add a note or reflection/);
  assert.match(html, /<details[^>]*><summary[^>]*>Task details/);
  assert.ok(!html.includes('checked=""'), 'no confidence or help response is invented');
  const summary = renderToString(React.createElement(ActivitySummary, { session, onDone() {} }));
  assert.match(summary, /<details[^>]*><summary/);
  assert.ok(!summary.includes('Lesson 1.1'));
});

test('scenario workflow keeps real editing history and restores only available actions', () => {
  const { emptyWorkspace, editWorkspace, restoreWorkspace } = load('apps/web/src/lib/scenario-workspace-state.ts');
  let draft = emptyWorkspace();
  draft = editWorkspace(draft, { type: 'add', itemId: 'confirm' });
  draft = editWorkspace(draft, { type: 'add', itemId: 'lookup' });
  assert.equal(editWorkspace(draft, { type: 'add', itemId: 'lookup' }), draft, 'duplicate clicks cannot add duplicate actions');
  draft = editWorkspace(draft, { type: 'move', itemId: 'lookup', position: 0 });
  draft = editWorkspace(draft, { type: 'edit', text: 'Check first. Ask before booking.' });
  assert.deepEqual(draft.selected, ['lookup', 'confirm']);
  assert.deepEqual(draft.events.map((event) => event.type), ['add', 'add', 'move', 'edit']);
  const restored = restoreWorkspace({ ...draft, selected: ['lookup', 'unknown', 'lookup', 'confirm'], events: [...draft.events, { type: 'add', itemId: 'unknown' }, { type: 'move', itemId: 'lookup', position: 999 }] }, ['lookup', 'confirm']);
  assert.deepEqual(restored, draft, 'refresh preserves the configuration and discards unavailable or malformed history');
  for (let n = 0; n < 100; n++) draft = editWorkspace(draft, { type: 'edit', text: `Configuration ${n}` });
  assert.equal(draft.events.length, 79, 'trace stays bounded with room for an actual run');
  assert.equal(draft.text, 'Configuration 99');
  assert.deepEqual(restoreWorkspace(null, ['lookup']), emptyWorkspace());
});

test('prerequisites render narrated HTML diagrams without photo or video requests', () => {
  const React = require('react');
  const { renderToString } = require('react-dom/server');
  const { NarratedSlides } = load('apps/web/src/components/enroll/narrated-slides.tsx');
  const slide = { title: 'Check before you act', caption: 'A tool reads the calendar.', narration: 'Your assistant checks the calendar before proposing an appointment.', steps: ['Read request', 'Check calendar', 'Ask for confirmation'], animation: 'sequence' };
  const html = renderToString(React.createElement(NarratedSlides, { session: { id: 'slide-session', title: 'Your starting point', slides: [slide, slide, slide, slide] }, onDone() {} }));
  assert.ok(html.includes('Slide diagram') && html.includes('Check calendar'));
  assert.ok(html.includes('<audio') && html.includes('kind=audio'));
  assert.ok(!html.includes('<img') && !html.includes('<video') && !html.includes('kind=image'));
  assert.ok(html.includes('Read the narration') && html.includes(slide.narration));
  assert.ok(html.includes('Previous slide') && html.includes('Next slide'));
});

test('the mission embeds its challenge in an operational animated workspace', () => {
  const React = require('react');
  const { renderToString } = require('react-dom/server');
  const { ScenarioWorkspace } = load('apps/web/src/components/enroll/scenario-workspace.tsx');
  const task = { id: 'clinic-run', title: 'Run your booking assistant', scene: 'An appointment request arrives at your clinic desk.', instruction: 'Build a safe workflow and run your assistant.', kind: 'simulation', artifact: 'The calendar is the source of availability. Ask before booking.', items: [{ id: 'lookup', text: 'Check calendar' }, { id: 'confirm', text: 'Ask for confirmation' }], workspace: { name: 'Clinic desk', incomingLabel: 'New request', request: 'Please find an appointment next week.', agentLabel: 'Your assistant', outputLabel: 'Activity log', state: 'A request is waiting.', instructionPlaceholder: 'Set a boundary…', runLabel: 'Run assistant' } };
  const session = { id: 'scenario-session', task, feedback: 'The calendar returned two possible slots.', configuration: { text: 'Ask before booking.', selected: ['lookup'] } };
  const html = renderToString(React.createElement(ScenarioWorkspace, { session, task, onSession() {}, async onReload() {} }));
  assert.ok(html.includes('New request') && html.includes(task.workspace.request));
  assert.ok(html.includes('Your workflow') && html.includes('Action tray') && html.includes('Run assistant'));
  assert.ok(html.includes('Move Check calendar down') && html.includes('Remove Check calendar'));
  assert.ok(html.includes('Ask before booking.') && html.includes(session.feedback));
  assert.ok(html.includes('scenario-run-track') && html.includes('draggable='));
  assert.ok(!html.includes('type="radio"') && !html.includes('Your draft') && !html.includes('How did it feel?'));
});
