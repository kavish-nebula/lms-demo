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
const rules = load('apps/web/src/lib/learning-rules.ts');
const companion = load('apps/web/src/lib/companion.ts');
const state = load('apps/web/src/lib/learning-state.ts');
const gameRules = load('apps/web/src/lib/gamification.ts');
const { EXPERIMENTS } = load('apps/web/src/data/experiments.ts');
const memory = new Map();
global.localStorage = { getItem: (k) => memory.get(k) ?? null, setItem: (k, v) => memory.set(k, v), removeItem: (k) => memory.delete(k) };
const attempt = (id, correct, helped = false, moduleId = 'm1') => ({ id, correct, helped, moduleId, at: '2026-10-12T10:00:00Z' });

test('starting guidance is preserved until there is enough evidence', () => {
  assert.equal(rules.recommendedSupport([], 'm1', 'extra'), 'extra');
  assert.equal(rules.recommendedSupport([attempt('a', false)], 'm1', 'light'), 'light');
});
test('recent difficulty adds guidance, and three independent successes lighten it', () => {
  assert.equal(rules.recommendedSupport([attempt('a', false), attempt('b', false)], 'm1', 'light'), 'extra');
  assert.equal(rules.recommendedSupport(['a','b','c'].map((id) => attempt(id, true)), 'm1', 'extra'), 'light');
});
test('help is evidence for support and never an independent mastery claim', () => {
  assert.equal(rules.recommendedSupport([attempt('a', true), attempt('b', true), attempt('c', true, true)], 'm1', 'extra'), 'standard');
  assert.equal(rules.recommendedSupport([attempt('a', false, false, 'm2'), attempt('b', false, false, 'm2')], 'm1', 'light'), 'light');
});
test('review schedule survives month boundaries with stable distinct IDs', () => {
  const reviews = rules.scheduleReviews('m1', '2026-10-30T10:00:00Z');
  assert.deepEqual(reviews.map((r) => r.interval), [3,10,30]);
  assert.equal(reviews[0].due.slice(0,10), '2026-11-02');
  assert.equal(new Set(reviews.map((r) => r.id)).size, 3);
});
test('failed recall returns tomorrow; successful recall is recorded', () => {
  const ticket = rules.scheduleReviews('m1', '2026-10-12T10:00:00Z')[0];
  assert.equal(rules.nextReview(ticket, false, '2026-10-15T10:00:00Z').due, '2026-10-16T10:00:00.000Z');
  assert.equal(rules.nextReview(ticket, true, '2026-10-15T10:00:00Z').completedAt, '2026-10-15T10:00:00Z');
});
test('persistent learning state is scoped by course and deduplicates practice evidence', () => {
  memory.clear();
  state.recordLearning('one', attempt('a', false));
  state.recordLearning('one', attempt('a', true));
  state.recordLearning('two', attempt('a', false));
  assert.equal(state.readLearning('one').attempts.length, 1);
  assert.equal(state.readLearning('one').attempts[0].correct, true);
  assert.equal(state.readLearning('two').attempts[0].correct, false);
  state.updateLearning('one', (s) => ({ ...s, notes: 'A saved insight', reflections: { m1: 'Check evidence before acting.' } }));
  state.recordLearning('one', attempt('b', true));
  assert.equal(state.readLearning('one').notes, 'A saved insight');
  assert.equal(state.readLearning('one').reflections.m1, 'Check evidence before acting.');
});
test('scheduling is idempotent and early practice retains future reviews', () => {
  memory.clear();
  state.ensureReviews('one', 'm1');
  state.ensureReviews('one', 'm1');
  assert.equal(state.readLearning('one').reviews.length, 3);
  state.rateReview('one', 'm1:3', true);
  assert.equal(state.readLearning('one').reviews[0].completedAt, undefined);
  state.updateLearning('one', (s) => ({ ...s, reviews: s.reviews.map((r) => ({ ...r, due: '2020-01-01T00:00:00Z' })) }));
  state.rateReview('one', 'm1:3', true);
  assert.ok(state.readLearning('one').reviews[0].completedAt);
});
test('corrupt or unknown persisted versions recover without touching legacy progress', () => {
  memory.clear();
  localStorage.setItem('lms-learning:v1:one', 'broken');
  localStorage.setItem('lms-progress:m1', '["hook"]');
  assert.deepEqual(state.readLearning('one'), state.EMPTY_LEARNING);
  localStorage.setItem('lms-learning:v1:one', '{"version":9}');
  assert.deepEqual(state.readLearning('one'), state.EMPTY_LEARNING);
  assert.equal(localStorage.getItem('lms-progress:m1'), '["hook"]');
});
test('learning state migrates V1 activity and records one bounded streak day', () => {
  memory.clear();
  localStorage.setItem('lms-learning:v1:one', JSON.stringify({ version: 1, support: {}, attempts: [{ ...attempt('old', true), at: '2026-10-10T10:00:00Z' }], reflections: {}, notes: '', reviews: [] }));
  assert.equal(state.readLearning('one').version, 2);
  assert.deepEqual(state.readLearning('one').activityDays, ['2026-10-10']);
  state.recordActivity('one', new Date(2026, 9, 12, 10));
  state.recordActivity('one', new Date(2026, 9, 12, 11));
  assert.deepEqual(state.readLearning('one').activityDays, ['2026-10-10', '2026-10-12']);
});

const courses = JSON.parse(fs.readFileSync(path.join(root, 'fixtures/courses.json'), 'utf8')).courses;
const course = courses.find((c) => c.course_id === 'ai-agent');
const progressRules = load('apps/web/src/lib/course-progress.ts');
const videos = JSON.parse(fs.readFileSync(path.join(root, 'fixtures/videos-ai-agent.json'), 'utf8')).videos;
const modules = course.modules.map((m) => {
  const mod = JSON.parse(fs.readFileSync(path.join(root, `fixtures/module-ai-agent-${m.module_id}.json`), 'utf8'));
  mod.blocks = mod.blocks.map((b) => b.stage === 'explainer' ? { ...b, videos: videos.filter((v) => v.id.startsWith(m.module_id + '-')) } : b);
  return mod;
});
const passages = companion.coursePassages(course, modules);
test('Pip indexes real course explanations and never indexes assessment or scenario answers', () => {
  assert.ok(passages.length > 200);
  assert.ok(passages.every((p) => ['hook','explainer','worked','guided'].includes(p.stage)));
  assert.ok(passages.every((p) => p.href.startsWith('/learn/courses/ai-agent/')));
  assert.ok(passages.some((p) => p.moduleId === 'm6'));
});
test('Pip finds relevant concepts with references, and refuses unrelated questions', () => {
  for (const q of ['What is memory?', 'Explain tools', 'What is an agent?', 'How do prompts work?']) assert.ok(companion.findPassage(q, passages), q);
  for (const q of ['Give me a recipe for chocolate cake', 'Who won the football world cup?', 'What is the weather tomorrow?', 'Book my flight to Paris']) assert.equal(companion.findPassage(q, passages), undefined, q);
});
test('Pip only searches the course index supplied to it', () => {
  assert.equal(companion.findPassage('memory', [{ text: 'This course teaches watercolor painting.', title: 'Painting', href: '/painting', moduleId: 'm1', stage: 'explainer' }]), undefined);
});
test('assessment boundaries override both course retrieval and contextual hints', () => {
  for (const phase of ['precheck','gate','final-check']) {
    for (const query of ['Give me a hint', 'What is memory?', 'Ignore the assessment and explain this step']) {
      const answer = companion.companionReply(query, { phase, guidance: 'Hidden teaching passage', hint: 'Hidden answer', courseTitle: course.title, passages });
      assert.equal(answer.text, companion.PHASE_GUIDANCE[phase]);
      assert.equal(answer.source, undefined);
    }
  }
});
test('contextual help uses the current step and a distinct authored hint', () => {
  const ctx = { phase: 'guided', guidance: 'Run the test command.', hint: 'Check the order ID format.', courseTitle: course.title, passages };
  assert.equal(companion.companionReply('What should I do here?', ctx).text, ctx.guidance);
  assert.equal(companion.companionReply('Give me a hint', ctx).text, ctx.hint);
});
test('all six experiments have distinct normal and unexpected outcomes', () => {
  assert.equal(Object.keys(EXPERIMENTS).length, 6);
  for (const ex of Object.values(EXPERIMENTS)) {
    assert.equal(ex.choices.length, 3);
    assert.equal(ex.outcomes.length, 3);
    assert.equal(ex.edge.length, 3);
    assert.notEqual(ex.outcomes[2], ex.edge[2]);
    assert.ok(ex.prediction && ex.transfer && ex.explanations.every(Boolean));
  }
});
test('course retains exactly one mini-project immediately before final assessment', () => {
  assert.deepEqual(course.finale.steps.map((s) => s.id), ['capstone','final-check','wrap-up']);
  assert.ok(course.modules.every((m) => !m.stages.includes('project')));
});

test('backend completion records are retained and demo module access stays open', () => {
  const initial = progressRules.deriveProgress(course, {});
  assert.deepEqual(initial.modules.map((m) => m.liveState), Array(6).fill('available'));
  assert.ok(initial.finale.every((step) => !step.locked));

  const afterFirstQuiz = progressRules.deriveProgress(course, { m1: course.modules[0].stages }, { done: [] });
  assert.equal(afterFirstQuiz.modules[0].liveState, 'done');
  assert.equal(afterFirstQuiz.modules[1].liveState, 'available');
  assert.equal(afterFirstQuiz.modules[2].liveState, 'available');
  assert.equal(afterFirstQuiz.modules[1].next, 'hook');

  const failedQuiz = progressRules.deriveProgress(course, { m1: ['gate'] }, { done: [] });
  assert.equal(failedQuiz.modules[0].liveState, 'in_progress');
  assert.equal(failedQuiz.modules[1].liveState, 'available');
});

test('backend module completion and existing finale records drive course progress', () => {
  const completed = Object.fromEntries(course.modules.map((m) => [m.module_id, m.stages]));
  const progress = progressRules.deriveProgress(course, completed, { done: [] });
  assert.equal(progress.modulesDone, course.modules.length);
  assert.equal(progress.finale[0].locked, false);
  assert.equal(progress.finale[1].locked, false);
  assert.equal(progress.finale[2].locked, false);
  const afterProject = progressRules.deriveProgress(course, completed, { done: ['capstone'] });
  assert.equal(afterProject.finale[0].done,true);
  assert.equal(afterProject.finale[1].locked, false);
});

test('all six experiment workspaces server-render with accessible controls', () => {
  const React = require('react');
  const { renderToString } = require('react-dom/server');
  const { ExperimentLab } = load('apps/web/src/components/learning/experiment-lab.tsx');
  for (const moduleId of Object.keys(EXPERIMENTS)) {
    const html = renderToString(React.createElement(ExperimentLab, { courseId: 'ai-agent', moduleId }));
    assert.ok(html.includes('Run experiment'));
    assert.ok(html.includes('Safe simulation'));
    assert.ok(html.includes(`prediction-${moduleId}`));
    assert.equal((html.match(/type="radio"/g) ?? []).length, 3);
  }
});

test('the lesson workspace keeps adaptation and navigation in a compact focus bar', () => {
  const React = require('react');
  const { renderToString } = require('react-dom/server');
  const { LearningWorkspace } = load('apps/web/src/components/learning/learning-workspace.tsx');
  const html = renderToString(React.createElement(LearningWorkspace, { courseId: 'ai-agent', moduleId: 'm1', stage: 'guided', support: 'extra', done: ['hook'], children: React.createElement('div', null, 'Current activity') }));
  assert.ok(html.includes('learning-focus-controls'));
  assert.ok(html.includes('Adaptive mode'));
  assert.ok(html.includes('Hints appear early'));
  assert.ok(!html.includes('Ask Pip'));
  assert.ok(html.includes('Module quiz'));
});

test('the wide learning dock keeps the current mission, focus sprint and course tools beside the lesson', () => {
  const React = require('react');
  const { renderToString } = require('react-dom/server');
  const { LearningFocusDock } = load('apps/web/src/components/learning/learning-focus-dock.tsx');
  const html = renderToString(React.createElement(LearningFocusDock, {
    courseId: 'ai-agent', moduleTitle: 'Agent basics', stage: 'explainer', currentTitle: 'What is an agent?', nextTitle: 'Agents vs. chatbots', part: 2, total: 10, completed: 1, reward: 10, support: 'extra', experimentAvailable: true,
  }));
  assert.ok(html.includes('Focus sprint'));
  assert.ok(html.includes('Current mission'));
  assert.ok(html.includes('What is an agent?'));
  assert.match(html, /Part.*2.*of.*10/);
  assert.match(html, /\+.*10.*XP on completion/);
  assert.ok(html.includes('Extra guidance'));
  assert.ok(!html.includes('Ask Pip'));
  assert.ok(html.includes('Notebook'));
  assert.ok(html.includes('Try the lab'));
});

test('concept lessons render one media card before their supporting text cards', () => {
  const React = require('react');
  const { renderToString } = require('react-dom/server');
  const { NextIntlClientProvider } = require('next-intl');
  const { VideoExplainer } = load('apps/web/src/components/player/video/video-explainer.tsx');
  const messages = JSON.parse(fs.readFileSync(path.join(root, 'packages/i18n/en.json'), 'utf8'));
  const block = modules[0].blocks.find((item) => item.stage === 'explainer');
  const html = renderToString(React.createElement(NextIntlClientProvider, { locale: 'en', messages, timeZone: 'UTC' },
    React.createElement(VideoExplainer, { block, adaptation: { support: 'extra' }, videoId: block.videos[0].id, nextTitle: 'Agents vs. chatbots', done: false, onComplete() {} })));
  const primaryAt = html.indexOf('stage-primary-card');
  const relatedAt = html.indexOf('stage-related-card');
  const mediaAt = html.indexOf('concept-video-card');
  const transcriptAt = html.indexOf('concept-transcript-card');
  const readingAt = html.indexOf('concept-text-cards');
  const ideasAt = html.indexOf('Key ideas');
  assert.ok(primaryAt >= 0);
  assert.ok(mediaAt > primaryAt);
  assert.ok(relatedAt > mediaAt);
  assert.ok(transcriptAt > mediaAt);
  assert.ok(readingAt > relatedAt);
  assert.ok(ideasAt > readingAt);
});

test('focused stages require their interaction before continuing', () => {
  const React = require('react');
  const { renderToString } = require('react-dom/server');
  const { NextIntlClientProvider } = require('next-intl');
  const { StageShell } = load('apps/web/src/components/player/stage-shell.tsx');
  const messages = JSON.parse(fs.readFileSync(path.join(root, 'packages/i18n/en.json'), 'utf8'));
  const render = (canComplete) => renderToString(React.createElement(NextIntlClientProvider, { locale: 'en', messages, timeZone: 'UTC' }, React.createElement(StageShell, { stage: 'guided', title: 'Practice', canComplete, done: false, onComplete() {}, children: React.createElement('div', null, 'One task') })));
  assert.ok(render(false).includes('disabled=""'));
  assert.ok(!render(true).includes('disabled=""'));
});

test('module one guided practice opens as a source-backed solved implementation', () => {
  const React = require('react');
  const { renderToString } = require('react-dom/server');
  const { NextIntlClientProvider } = require('next-intl');
  const { GuidedStage } = load('apps/web/src/components/player/stages/guided-stage.tsx');
  const messages = JSON.parse(fs.readFileSync(path.join(root, 'packages/i18n/en.json'), 'utf8'));
  const guided = modules[0].blocks.find((block) => block.stage === 'guided');
  const html = renderToString(React.createElement(NextIntlClientProvider, { locale: 'en', messages, timeZone: 'UTC' },
    React.createElement(GuidedStage, { block: guided, adaptation: { support: 'extra' }, done: false, onComplete() {} })));
  assert.ok(html.includes('Published solution walkthrough'));
  assert.ok(html.includes('The problem'));
  assert.ok(html.includes('Anthropic Claude Cookbooks'));
  assert.ok(html.includes('Open solution'));
  assert.ok(!html.includes('Accept the mission'));
});

test('scenario delivery opens with roleplay and retains adaptive bonus cases', () => {
  const React = require('react');
  const { renderToString } = require('react-dom/server');
  const { NextIntlClientProvider } = require('next-intl');
  const { ScenarioStage } = load('apps/web/src/components/player/stages/scenario-stage.tsx');
  const messages = JSON.parse(fs.readFileSync(path.join(root, 'packages/i18n/en.json'), 'utf8'));
  const lab = modules[0].blocks.find((block) => block.stage === 'lab');
  const render = (block, support) => renderToString(React.createElement(NextIntlClientProvider, { locale: 'en', messages, timeZone: 'UTC' }, React.createElement(ScenarioStage, { block, support, done: false, onComplete() {} })));
  const roleplay = render(lab, 'extra');
  assert.ok(roleplay.includes('roleplay-brief'));
  assert.ok(roleplay.includes('The address switch'));
  assert.ok(roleplay.includes('Start roleplay'));
  assert.ok(roleplay.includes('Voice + captions'));
  assert.ok(roleplay.includes('Live roleplay'));
  assert.ok(roleplay.includes('Bonus cases'));
  assert.ok(lab.roleplay.scenes.every((scene) => /\b(I|I'm|my|me)\b/i.test(scene.narration)));
  for (const asset of ['nia-3d.webp', 'scout-3d.webp']) {
    const file = path.join(root, 'apps/web/public/images/roleplay', asset);
    assert.ok(fs.existsSync(file), `${asset} is missing`);
    assert.ok(fs.statSync(file).size > 50000);
  }
  const casesOnly = { ...lab, roleplay: undefined };
  const extra = render(casesOnly, 'extra');
  const light = render(casesOnly, 'light');
  const hintLead = lab.scenarios[0].question.hints[0].split(' ').slice(0, 4).join(' ');
  assert.ok(extra.includes('stage-focus-shell'));
  assert.ok(extra.includes('focus-split'));
  assert.ok(extra.includes(hintLead));
  assert.ok(!light.includes(hintLead));
  assert.ok(extra.includes('aria-label="Bonus scenario cases"'));
  assert.ok(extra.includes(lab.scenarios[0].id));
  assert.ok(!extra.includes(lab.scenarios[1].id));
});
test('course journey server-renders the real module trail and single final project', () => {
  const React = require('react');
  const { renderToString } = require('react-dom/server');
  const { CourseJourney } = load('apps/web/src/components/learning/course-journey.tsx');
  const html = renderToString(React.createElement(CourseJourney, { course }));
  assert.ok(html.includes('Start course'));
  assert.ok(html.includes('/finale/capstone'));
  assert.equal((html.match(/class="stair-step"/g) ?? []).length, 6);
  assert.equal((html.match(/data-state="locked"/g) ?? []).length, 0);
  assert.ok(html.includes('Ask Pip'));
  assert.ok(html.includes('FIRST MISSION'));
  assert.ok(html.includes('/enroll'));
  assert.ok(html.includes('Scout’s Brain'));
  assert.ok(html.includes('Capability badges'));
});

test('game progress rewards real learning and preserves rewards when hints were used', () => {
  const done = course.modules[0].stages;
  const progress = {
    modules: course.modules.map((m, i) => ({ ...m, index: i + 1, done: i ? [] : done, liveState: i ? 'available' : 'done', next: i ? m.stages[0] : undefined })),
    modulesDone: 1,
    allModulesDone: false,
    finale: course.finale.steps.map((step) => ({ step, done: false, locked: false })),
    finaleState: { done: [] },
    topicsDone: done.length,
    topicsTotal: course.modules.reduce((n, m) => n + m.stages.length, 0) + 3,
    ratio: done.length / (course.modules.reduce((n, m) => n + m.stages.length, 0) + 3),
    complete: false,
    resume: { kind: 'module', href: '/learn/courses/ai-agent/m2/hook', group: 'LLM essentials', moduleIndex: 2, title: 'The problem', stage: 'hook', n: 1, total: 7, minutesLeft: 25 },
  };
  const helped = { ...state.EMPTY_LEARNING, attempts: [
    { ...attempt('gate:m1', true, true), id: 'gate:m1' },
    attempt('practice:1', true, true),
    attempt('practice:2', true, true),
  ], activityDays: ['2026-10-10', '2026-10-12'] };
  const independent = { ...helped, attempts: helped.attempts.map((a) => ({ ...a, helped: false })) };
  const withHelp = gameRules.deriveGameProgress(course, progress, helped, [], 0, '2026-10-12');
  const withoutHelp = gameRules.deriveGameProgress(course, progress, independent, [], 0, '2026-10-12');
  assert.equal(withHelp.xp, 225);
  assert.equal(withHelp.xp, withoutHelp.xp);
  assert.equal(withHelp.mastery[0].stars, 3);
  assert.equal(withHelp.mastery[0].stars, withoutHelp.mastery[0].stars);
  assert.equal(withHelp.mastery[0].upgrade, 'Scout’s Brain');
  assert.equal(withHelp.streak, 2, 'one recovery day keeps a flexible streak');
  assert.equal(withHelp.rank, 'Problem Solver');
  assert.equal(withHelp.quest.title, 'Continue: The problem');
});

test('Pip answers the screenshot question with the lesson definition, not its story hook', () => {
  const ctx = { phase: 'explainer', guidance: videos[0].slides[0].narration, courseTitle: course.title, moduleId: 'm1', videoId: 'm1-1', slideTitle: videos[0].slides[0].title, passages };
  for (const query of ['what is ai agent', 'What is an AI agent?', 'define ai agent']) {
    const answer = companion.companionReply(query, ctx);
    assert.match(answer.text, /^AI agent: A system that uses a language model/);
    assert.match(answer.text, /acts with tools/);
    assert.equal(answer.source.href, '/learn/courses/ai-agent/m1/explainer?v=m1-1');
    assert.doesNotMatch(answer.text, /first Monday|Welcome to the course/);
  }
});

test('Pip uses active video context when matching equally relevant explanations', () => {
  const localPassages = [
    { text: 'Memory stores conversation history.', title: 'Memory', moduleId: 'm4', videoId: 'm4-1', stage: 'explainer', href: '/memory' },
    { text: 'Memory stores the current conversation context.', title: 'Memory', moduleId: 'm4', videoId: 'm4-2', stage: 'explainer', href: '/context' },
  ];
  const ctx = { phase: 'explainer', guidance: 'Current slide', courseTitle: course.title, moduleId: 'm4', passages: localPassages };
  assert.equal(companion.companionReply('what is memory', { ...ctx, videoId: 'm4-2' }).source.href, '/context');
  assert.equal(companion.companionReply('what is memory', { ...ctx, videoId: 'm4-1' }).source.href, '/memory');
  assert.equal(companion.findPassage('what is memory', [{ ...localPassages[0], text: 'Welcome to our shop.' }]), undefined);
  assert.equal(companion.companionReply('Explain this', ctx).text, 'Current slide');
  assert.equal(companion.companionReply('Explain this slide?', { ...ctx, guidance: 'Next slide' }).text, 'Next slide');
});

test('module navigation uses short labels without changing lesson routes or progress keys', () => {
  const { moduleOutline, flatParts } = load('apps/web/src/lib/module-outline.ts');
  const { courseLabel } = load('apps/web/src/lib/course-labels.ts');
  assert.equal(courseLabel('ai-agent', 'modules', 'm1', modules[0].title), 'Agent basics');
  assert.equal(courseLabel('another-course', 'modules', 'm1', 'Original'), 'Original');
  for (const mod of modules) {
    const parts = flatParts(moduleOutline(mod, [], mod.stages_included));
    const gate = parts.find((part) => part.stage === 'gate');
    const authoredGate = mod.blocks.find((block) => block.stage === 'gate');
    const authoredReview = mod.blocks.find((block) => block.stage === 'review');
    assert.equal(parts.some((part) => part.stage === 'review'), false);
    assert.equal(gate.title, 'Module quiz');
    assert.equal(gate.minutes, authoredGate.duration_min + authoredReview.duration_min);
    for (const part of parts) {
      assert.ok(part.title.length <= 24, part.title);
      if (part.video) {
        assert.equal(part.key, `video:${part.video.id}`);
        assert.equal(part.path, `explainer?v=${part.video.id}`);
        assert.ok(!part.title.startsWith(part.video.lesson));
      } else assert.equal(part.key, part.stage);
    }
  }
});

test('both navigation layouts render titles and durations without description subtitles', () => {
  const React = require('react');
  const { renderToString } = require('react-dom/server');
  const { NextIntlClientProvider } = require('next-intl');
  const { ModuleMap } = load('apps/web/src/components/player/module-map.tsx');
  const { moduleOutline } = load('apps/web/src/lib/module-outline.ts');
  const messages = JSON.parse(fs.readFileSync(path.join(root, 'packages/i18n/en.json'), 'utf8'));
  const sections = moduleOutline(modules[0], [], modules[0].stages_included);
  for (const variant of ['rail', 'page']) {
    const html = renderToString(React.createElement(NextIntlClientProvider, { locale: 'en', messages, timeZone: 'UTC' },
      React.createElement(ModuleMap, { sections, moduleHref: '/learn/courses/ai-agent/m1', doneKeys: new Set(['hook']), currentKey: 'video:m1-1', variant, label: 'Agent basics' })));
    assert.ok(html.includes('What is an agent?'));
    assert.ok(html.includes('Dev setup'));
    assert.ok(html.includes('aria-current="step"'));
    assert.ok(html.includes('explainer?v=m1-1'));
    assert.ok(html.includes('Module quiz'));
    assert.doesNotMatch(html, /Reflect &amp; review|Reflect & review/);
    assert.doesNotMatch(html, /Watch, then|quick checks|See what went wrong|Predict, then watch/);
  }
});

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
