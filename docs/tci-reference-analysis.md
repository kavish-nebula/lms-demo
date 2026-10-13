# TCI learner experience review

This review covers the product documentation and learner-facing source in the `tci-main` reference archive. The archive contains 510 entries. Vendor packages, generated media indexes, fixtures, and server implementation details were inventoried but are not treated as learner experience patterns.

## Learner walkthrough in the reference

1. **Welcome and onboarding** — the mascot introduces itself, the learner chooses a daily goal, and the product explains the learning path, teacher updates, streaks, and earned currency.
2. **Today** — one greeting card combines the daily goal, streak, energy, a clear continue action, new teacher material, a focus timer, the timetable, and subjects.
3. **Star map** — subjects become visual paths. The current mission is obvious, completed nodes show mastery, later nodes remain locked, and rewards or reviews break up the path.
4. **Module player** — content unlocks in a short sequence: slides, interactive 3D material, a game, then a quiz. The learner stays in one full-screen task at a time.
5. **Practice** — questions appear one at a time, missed questions return, hints increase gradually, explanations can be read aloud, and the mascot reacts to progress.
6. **Completion** — a short reward sequence shows learning energy, accuracy, streak movement, and daily quest progress.
7. **Class feed** — material shared by teachers is grouped into new and earlier items and can include presentations, audio recaps, interactive lessons, homework, and results.
8. **Copilot and settings** — the learner can ask by text or voice, receive a guided walkthrough, choose a language, enable read-aloud, replay onboarding, and control sound and theme.

## What suits this LMS

| Pattern | Decision | Reason |
|---|---|---|
| One current mission | Use | Reduces choice overload inside a course and keeps the learner oriented. |
| Short focus sprint | Use | Lets a learner make a small time commitment without blocking browser controls or punishing interruptions. |
| One activity per viewport | Use | Helps video, practice, scenarios, and quizzes hold attention without long page scrolling. |
| Visible next step and module progress | Use | Makes effort and direction clear while the learner is working. |
| Contextual course companion | Use | Pip already searches only course material and respects assessment boundaries. |
| Interactive labs and predictions | Use | Active decisions and immediate outcomes fit the existing adaptive course better than decorative mini-games. |
| Quiz-gated module unlocks | Use | Mastery has a direct purpose: passing opens the next module. |
| XP, streaks, mastery, and capability rewards | Use carefully | Reward course actions and skill growth without ranking learners against one another. |
| Teacher transmissions | Add with backend | Valuable for school deployments, but the current client-only prototype has no real teacher or class feed. |
| Audio recap, read-aloud, and language choice | Add next | Useful for accessibility and different learning contexts; requires authored audio or a governed speech pipeline. |
| Mood check-in | Add only with policy | It needs clear disclosure, retention rules, teacher permissions, and an escalation policy for minors. |
| Cosmetic store and virtual currency | Defer | It can pull attention away from course mastery and requires careful school-age product rules. |
| Public learner leaderboards | Avoid | They can discourage struggling learners and expose comparison data. Prefer personal bests and cohort goals. |
| Forced full-screen focus with exit counting | Avoid | A learner-controlled timer supports focus without coercive monitoring. |

## Implemented in the course player

- The player now uses a wide-screen learning layout instead of leaving the right side empty.
- The main lesson expands up to a wider reading and activity surface.
- A persistent learning dock appears on large displays with:
  - a learner-controlled 10, 15, or 25 minute focus sprint;
  - the current mission, part count, module completion, XP reward, and next step;
  - the current adaptive support level;
  - direct actions for Pip, the course notebook, and the experiment when available.
- Focus state is stored per course under `lms-focus:v1:<courseId>` and survives route changes and reloads.
- The notebook and experiment can be opened from the dock without losing the current lesson.
- Existing small-screen behavior stays focused: the extra dock is hidden and the main lesson uses the available width.

## Recommended next school integration

The next meaningful school feature is a real **Instructor updates** service, not a static card. Each update should include a class scope, course or module target, material type, publish time, due date when relevant, opened state, and safe attachment metadata. The learner can then see a compact “From your teacher” item in the course page and open it in the correct module context. Audio recap and multilingual support should follow the same content model so a teacher publishes one governed course resource rather than a separate feed-only asset.
