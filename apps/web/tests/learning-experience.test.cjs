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

test('the lesson workspace shows the lesson alone, with no phase strip or guidance picker', () => {
  const React = require('react');
  const { renderToString } = require('react-dom/server');
  const { LearningWorkspace } = load('apps/web/src/components/learning/learning-workspace.tsx');
  const html = renderToString(React.createElement(LearningWorkspace, { children: React.createElement('div', null, 'Current activity') }));
  assert.ok(html.includes('Current activity'));
  assert.ok(!html.includes('Adaptive mode'));
  assert.ok(!html.includes('Module quiz'));
  assert.ok(!html.includes('Guidance level'));
});

test('the wide learning dock keeps only the focus sprint beside the lesson', () => {
  const React = require('react');
  const { renderToString } = require('react-dom/server');
  const { LearningFocusDock } = load('apps/web/src/components/learning/learning-focus-dock.tsx');
  const html = renderToString(React.createElement(LearningFocusDock, { courseId: 'ai-agent' }));
  assert.ok(html.includes('Focus sprint'));
  assert.ok(!html.includes('Current mission'));
  assert.ok(!html.includes('Learning tools'));
  assert.ok(!html.includes('XP on completion'));
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
  assert.ok(html.includes('The documented problem'));
  assert.ok(html.includes('Anthropic Claude Cookbooks'));
  assert.ok(html.includes('Open the solved implementation'));
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
  assert.ok(roleplay.includes('Enter the roleplay'));
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
  const { NextIntlClientProvider } = require('next-intl');
  const messages = JSON.parse(fs.readFileSync(path.join(root, 'packages/i18n/en.json'), 'utf8'));
  const { CourseJourney } = load('apps/web/src/components/learning/course-journey.tsx');
  const html = renderToString(React.createElement(NextIntlClientProvider, { locale: 'en', messages, timeZone: 'UTC' }, React.createElement(CourseJourney, { course })));
  assert.ok(html.includes('Make this course mine'));
  assert.ok(html.includes('/finale/capstone'));
  assert.equal((html.match(/class="stair-step"/g) ?? []).length, 6);
  assert.equal((html.match(/data-state="locked"/g) ?? []).length, 0);
  assert.ok(!html.includes('Try an experiment')); // the experiment lab was removed
  assert.ok(html.includes('FIRST MISSION'));
  assert.ok(html.includes('/enroll'));
  assert.ok(html.includes('Scout’s Brain'));
  assert.ok(!html.includes('Capability badges')); // the badges panel was removed from the course page
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
    assert.match(answer.text, /takes actions with tools/);
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
