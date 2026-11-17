// Checks the pure logic (schedule, queue, completion figures, stories) in plain Node:
//   node scripts/check-logic.mjs
// A resolve hook maps "@/x" to src/x.ts and adds ".ts" to relative imports, as Metro does.
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

const src = fileURLToPath(new URL('../src/', import.meta.url));
registerHooks({
  resolve(specifier, context, next) {
    if (specifier.startsWith('@/')) return next(pathToFileURL(`${src}${specifier.slice(2)}.ts`).href, context);
    if (specifier.startsWith('.') && context.parentURL?.endsWith('.ts')) {
      const candidate = new URL(`${specifier}.ts`, context.parentURL);
      if (existsSync(candidate)) return next(candidate.href, context);
    }
    return next(specifier, context);
  },
});

const { buildQueue, needMostFirst, nextSchedule, personQueue } = await import('@/lib/queue');
const activity = await import('@/lib/activity');
const studyDays = await import('@/lib/study-day');
const { makeRounds } = await import('@/lib/stories');

const now = new Date(2026, 10, 2, 9, 30); // 2 Nov 2026, 9:30 local
const at = (days, hours = 0) => new Date(2026, 10, 2 + days, hours).toISOString();
// When a study day begins: 05:30 local (DAY_START_HOUR, DAY_START_MINUTE).
const dayStart = (days) => new Date(2026, 10, 2 + days, 5, 30).toISOString();
const clean = { tries: 1, hintsUsed: 0 };
const missed = { tries: 2, hintsUsed: 1 };

// Steps
let entry = nextSchedule(undefined, clean, now);
assert.deepEqual(entry, { step: 1, dueAt: new Date(now.getTime() + 10 * 60_000).toISOString() }, 'new card, clean -> step 1 in 10 min');
assert.equal(nextSchedule(undefined, missed, now).step, 0, 'new card, hint -> stays at 0');
assert.equal(nextSchedule(undefined, missed, now).dueAt, now.toISOString(), 'step 0 is due now');
entry = nextSchedule({ step: 1, dueAt: at(0, 0) }, clean, now);
assert.deepEqual(entry, { step: 2, dueAt: dayStart(1) }, 'step 2 is due when tomorrow’s study day begins, at 05:30');
assert.deepEqual(nextSchedule({ step: 4, dueAt: at(-1) }, clean, now), { step: 5, dueAt: dayStart(14) }, 'step 5 = 14 study days');
assert.equal(nextSchedule({ step: 5, dueAt: at(-1) }, clean, now).step, 5, 'top step stays');
assert.deepEqual(nextSchedule({ step: 3, dueAt: at(-1) }, missed, now), { step: 2, dueAt: dayStart(1) }, 'hint -> back one step');
assert.equal(nextSchedule({ step: 0, dueAt: at(-1) }, { tries: 3, hintsUsed: 2 }, now).step, 0, 'never below 0');
const early = { step: 3, dueAt: at(2) };
assert.equal(nextSchedule(early, clean, now), early, 'early clean answer does not jump ahead');
assert.equal(nextSchedule(early, missed, now).step, 2, 'early hint still moves back');

// Queue
const schedule = {
  overdue: { step: 2, dueAt: at(-3) },
  due: { step: 1, dueAt: at(0, 9) },
  soon: { step: 3, dueAt: at(1) },
  later: { step: 4, dueAt: at(5) },
};
const ids = ['later', 'new1', 'due', 'soon', 'overdue', 'new2'];
assert.deepEqual(buildQueue(ids, schedule, now, 5), ['overdue', 'due', 'new1', 'new2', 'soon'], 'due, then new, then soonest');
assert.deepEqual(buildQueue(ids, schedule, now, 3), ['overdue', 'due', 'new1']);
assert.deepEqual(buildQueue(ids, schedule, now, 0), []);
assert.deepEqual(buildQueue(['a'], {}, now, 5), ['a'], 'small deck gives what it has');

// Practice more: the cards that need it most first (scheduling only, never shown)
const steps = {
  s0late: { step: 0, dueAt: at(0, 9) },
  s0early: { step: 0, dueAt: at(-1) },
  s1: { step: 1, dueAt: at(0, 9) },
  s4: { step: 4, dueAt: at(3) },
};
assert.deepEqual(needMostFirst(['s4', 'new', 's1', 's0late', 's0early'], steps, 5), ['s0early', 's0late', 'new', 's1', 's4'], 'lowest step first, new just above step 0');
assert.deepEqual(needMostFirst(['s4', 'new', 's1'], steps, 2), ['new', 's1']);
// One person again: their cards, round again to at least 3, never past the goal
assert.deepEqual(personQueue(['a'], {}, 3, 5), ['a', 'a', 'a'], 'one fact comes back asked other ways');
assert.deepEqual(personQueue(['s4', 's0late'], steps, 3, 5), ['s0late', 's4', 's0late']);
assert.deepEqual(personQueue(['a', 'b', 'c', 'd', 'e', 'f', 'g'], {}, 3, 5).length, 5, 'never more than the goal');
assert.deepEqual(personQueue([], {}, 3, 5), [], 'nobody to practice');

// Completion
const session = (days, cards, goal = 5, minutes = 4) => ({
  startedAt: at(days, 10),
  completedAt: new Date(new Date(at(days, 10)).getTime() + minutes * 60_000).toISOString(),
  cardsCompleted: cards,
  dailyGoal: goal,
});
const sessions = [session(0, 3), session(-1, 5), session(-1, 2), session(-2, 4, 8), session(-10, 5)];
const days = activity.dailyCompletion(sessions, 5, now, 30);
assert.equal(days.length, 30);
assert.equal(days.at(-1).key, '2026-11-02');
assert.equal(days.at(-1).percent, 60, 'today 3/5');
assert.equal(days.at(-2).percent, 100, 'over the goal is capped at 100');
assert.equal(days.at(-3).percent, 50, "a past day keeps its own goal (4/8)");
assert.deepEqual(days.slice(-3).map(activity.levelFor), ['partial', 'met', 'partial']);
assert.equal(activity.levelFor(days.at(-4)), 'none');
assert.equal(activity.fourWeekAverage(days, at(-2, 9)), 70, 'average of the days since the account existed');
assert.equal(activity.fourWeekAverage(days, at(-60)), Math.round((60 + 100 + 50 + 100) / 28));
const week = activity.weekSessions([...sessions, { ...session(0, 1), completedAt: null }], now);
assert.deepEqual(week, { count: 4, averageMinutes: 4 }, 'unfinished and older sessions are not counted');
assert.deepEqual(activity.practiceCounts(['a', 'b', 'a']), [['a', 2], ['b', 1]]);
assert.equal(activity.calendarKey(new Date(2026, 2, 8, 23)), '2026-03-08', 'a calendar date, for labels and storage only');

// Rounds keep the queue order and offer names from the whole deck
const { ALL_HINTS, clueFor, hintAt, hintLadder, phrasingsFor } = await import('@/lib/stories');
const plain = [{ id: 'name', kind: 'blank', ask: '{name} x.', reveal: '{name} x.' }];
const card = (id, answer, more = {}) => ({ id, personId: answer, answer, hints: ALL_HINTS, phrasings: plain, ...more });
const deck = ['June', 'Leo', 'Mae', 'Omar'].map((name) => card(`d-${name}`, name));
const rounds = makeRounds([card('c2', 'Leo'), card('c1', 'June')], deck);
assert.deepEqual(rounds.map((round) => round.id), ['c2', 'c1']);
for (const round of rounds) {
  assert.equal(round.choices.length, 3);
  assert.ok(round.choices.includes(round.answer));
  assert.equal(new Set(round.choices).size, 3);
}

// The hint ladder: meaningful cues first (another fact, the relationship), then the letter, then fewer
// names, then the answer itself. Each rung only if allowed, with something true and new to say.
const memoryFact = (text) => ({ type: 'memory', text, timeSensitive: false });
const nameFirst = (text) => phrasingsFor({ relationship: 'mom', hasPhoto: false }, memoryFact(text)).filter((p) => p.id === 'name');
const sofia = (id, text, hints = ALL_HINTS, phrasings = nameFirst(text)) =>
  card(id, 'Sofia', { personId: 'sofia', relationship: 'mom', fact: memoryFact(text), hints, phrasings });
const oneFact = makeRounds([sofia('s0', 'loves painting')], [...deck, sofia('s0', 'loves painting')])[0];
assert.equal(oneFact.clue, undefined, 'no other fact, so no fact hint');
assert.deepEqual(hintLadder(oneFact), ['relationship', 'letter', 'fewer']);
assert.deepEqual(hintAt(oneFact, 1), { lead: 'Take your time.', detail: 'This is your mom.', fewer: false, show: false }, 'first miss: the most meaningful cue there is');
assert.deepEqual(hintAt(oneFact, 2), { lead: 'The name starts with S.', detail: 'This is your mom.', fewer: false, show: false });
assert.deepEqual(hintAt(oneFact, 3), { lead: 'Let’s try with fewer names.', detail: 'This is your mom.', fewer: true, show: false });
assert.deepEqual(hintAt(oneFact, 4), { lead: 'It’s Sofia.', detail: '', fewer: true, show: true }, 'after the last rung, the answer itself');
assert.deepEqual(hintAt(oneFact, 9), hintAt(oneFact, 4), 'and it stays');
const twoFacts = [sofia('s0', 'loves painting'), sofia('s1', 'and I went to the lake every summer', ALL_HINTS, phrasingsFor({ relationship: 'mom', hasPhoto: false }, memoryFact('and I went to the lake every summer')).filter((p) => p.id === 'name'))];
const [first, second] = makeRounds(twoFacts, [...deck, ...twoFacts]);
assert.equal(first.clue, 'This person and I went to the lake every summer.', 'the fact hint is the next stored fact');
assert.equal(second.clue, 'This person loves painting.', 'never the fact the card already shows');
assert.deepEqual(hintLadder(first), ['fact', 'relationship', 'letter', 'fewer'], 'the order is fixed: fact, relationship, letter, fewer');
assert.deepEqual(hintAt(first, 1), { lead: 'Take your time.', detail: 'This person and I went to the lake every summer.', fewer: false, show: false });
assert.deepEqual(hintAt(first, 2), { lead: 'This is your mom.', detail: 'This person and I went to the lake every summer.', fewer: false, show: false });
assert.deepEqual(hintAt(first, 3).lead, 'The name starts with S.');
assert.ok(!hintAt(first, 4).show && hintAt(first, 5).show, 'the answer comes only after every rung allowed');
// The relationship rung is left out when the card already says it ("My mom, ______, ...").
const myRel = sofia('s2', 'loves painting', ALL_HINTS, phrasingsFor({ relationship: 'mom', hasPhoto: false }, memoryFact('loves painting')).filter((p) => p.id === 'my-rel'));
const saidAlready = makeRounds([myRel], [...deck, myRel])[0];
assert.ok(saidAlready.phrasing.ask.startsWith('My mom, ') && !hintLadder(saidAlready).includes('relationship'), 'no hint repeats the relationship the card shows');
const datedRel = sofia('s3', 'x', ALL_HINTS, phrasingsFor({ relationship: 'mom', hasPhoto: false }, { type: 'work', text: 'a nurse', timeSensitive: true, asOf: '2026-05-01' }).filter((p) => p.id === 'my-rel'));
assert.ok(!hintLadder(makeRounds([datedRel], [...deck, datedRel])[0]).includes('relationship'), 'nor after a date ("As of May 2026, my mom, ...")');
const noLetter = makeRounds([sofia('s0', 'loves painting', { ...ALL_HINTS, letter: false, fewer: false })], [...deck, ...twoFacts])[0];
assert.deepEqual(hintLadder(noLetter), ['fact', 'relationship'], 'turned-off rungs are skipped');
assert.deepEqual(hintAt(noLetter, 1), { lead: 'Take your time.', detail: 'This person and I went to the lake every summer.', fewer: false, show: false });
assert.ok(hintAt(noLetter, 3).show && hintAt(noLetter, 3).lead === 'It’s Sofia.', 'two rungs, then the answer');
const allOff = makeRounds([sofia('s0', 'x', { letter: false, fact: false, relationship: false, fewer: false })], [...deck, ...twoFacts])[0];
assert.deepEqual(hintAt(allOff, 1), { lead: 'Take your time.', detail: '', fewer: false, show: false }, 'every rung off: "Take your time." once');
assert.deepEqual(hintAt(allOff, 2), { lead: 'It’s Sofia.', detail: '', fewer: false, show: true }, 'then the answer');
const noRelationship = makeRounds([card('r0', 'Theo', { fact: memoryFact('loves board games') })], deck)[0];
assert.deepEqual(hintLadder(noRelationship), ['letter', 'fewer'], 'no relationship typed, so no relationship hint');
const dated = { type: 'work', text: 'going to become a nurse', timeSensitive: true, asOf: '2026-05-01' };
assert.equal(clueFor(dated), 'As of May 2026, this person is going to become a nurse.', 'a fact that may change keeps its month in a hint');
for (const [round, misses] of [[first, 1], [first, 4], [first, 5], [oneFact, 3], [noLetter, 2], [allOff, 2]]) {
  const { lead, detail } = hintAt(round, misses);
  const said = `${lead} ${detail}`;
  assert.ok(!/wrong|incorrect|score|try again/i.test(said), `no judging words: ${said}`);
}

// "I'm not sure" (2026-11-13): a calm way into the same hint ladder, with no name chosen first. It is
// asking for help, never a wrong answer, and the person still ends every card on the right name.
{
  const steps = await import('@/lib/card-steps');
  const { firstTryCorrect } = await import('@/lib/queue');
  const { NOT_SURE, HINT_STEPS, HINT_LADDER, hintStep } = await import('@/lib/stories');
  const day = new Date(2026, 10, 13, 10);
  // The first tap shows the first hint at once, opening with the calm line
  let state = steps.startSteps();
  assert.deepEqual(steps.notSureButton(first, state), { label: 'I’m not sure', spoken: 'I’m not sure. Show me a hint.' }, 'on a fresh card: "I’m not sure", and its VoiceOver label');
  state = steps.askForHelp(first, state);
  assert.deepEqual(steps.hintNow(first, state), { ...hintAt(first, 1), lead: 'That is okay. Here is a little help.' }, 'the first tap: the first rung (another fact), with the calm line for "Take your time."');
  assert.deepEqual([state.wrong, state.help, state.hints], [0, ['fact'], ['fact']], 'nothing counted as wrong; the step reached is kept');
  // Each further tap walks the ladder, the last one labelled "Show me", and the control goes once the answer is shown
  const labels = [];
  while (steps.notSureButton(first, state)) {
    labels.push(steps.notSureButton(first, state).label);
    state = steps.askForHelp(first, state);
    assert.deepEqual({ ...steps.hintNow(first, state), lead: undefined }, { ...hintAt(first, state.misses), lead: undefined }, 'the existing hint content, step for step');
  }
  assert.deepEqual(labels, ['I’m not sure', 'I’m not sure', 'I’m not sure', 'Show me'], 'relationship, letter, fewer names, then "Show me" for the answer');
  assert.deepEqual(state.help, ['fact', 'relationship', 'letter', 'fewer', 'answer'], 'the whole ladder, then the answer itself');
  assert.ok(steps.hintNow(first, state).show && steps.hintNow(first, state).lead === 'It’s Sofia.', 'it ends on the answer, so nobody is pushed to guess');
  assert.equal(steps.notSureButton(first, state), undefined, 'never shown once the answer is');
  assert.equal(steps.askForHelp(first, state), state, 'and a stray tap does nothing');
  assert.ok(state.setAside && state.setAside !== 'Sofia' && first.choices.includes(state.setAside), 'fewer names sets aside one of the others, never the answer');
  assert.equal(state.answered, false, 'the person still taps the right name to finish');
  const done = steps.chooseName(first, state, 'Sofia');
  assert.ok(done.answered && steps.notSureButton(first, done) === undefined, 'the right name ends the card, and the control is gone');
  assert.deepEqual(steps.cardResult(done), { tries: 1, hintsUsed: 5 }, 'one name chosen; every step a hint used');
  // The same ladder whichever way a step comes: a wrong name, then help
  const other = first.choices.find((name) => name !== 'Sofia');
  let mixed = steps.chooseName(first, steps.startSteps(), other);
  assert.equal(steps.hintNow(first, mixed).lead, 'Take your time.', 'a name chosen keeps its own words');
  mixed = steps.askForHelp(first, mixed);
  assert.deepEqual([mixed.misses, mixed.wrong, mixed.help, steps.hintNow(first, mixed).lead], [2, 1, ['relationship'], 'This is your mom.'], 'help takes the next step on');
  // Scheduling: like any card that needed a hint
  const helped = steps.cardResult(steps.chooseName(first, steps.askForHelp(first, steps.startSteps()), 'Sofia'));
  assert.ok(!firstTryCorrect(helped), 'a card with help is not a first-try answer, so no reveal unlock either');
  const onStep = { step: 3, dueAt: day.toISOString() };
  assert.deepEqual(nextSchedule(onStep, helped, day), nextSchedule(onStep, { tries: 2, hintsUsed: 1 }, day), 'it moves back a step exactly like a card that needed one hint');
  assert.deepEqual(nextSchedule(undefined, helped, day), nextSchedule(undefined, { tries: 2, hintsUsed: 1 }, day), 'a new card too');
  // Every rung off: "Take your time." becomes the calm line, then "Show me"
  let off = steps.askForHelp(allOff, steps.startSteps());
  assert.deepEqual([steps.hintNow(allOff, off).lead, off.help, steps.notSureButton(allOff, off)?.label], ['That is okay. Here is a little help.', ['wait'], 'Show me']);
  off = steps.askForHelp(allOff, off);
  assert.ok(steps.hintNow(allOff, off).show && steps.notSureButton(allOff, off) === undefined, 'then the answer');
  // On every kind of card with the ladder: blank, ask, who, photo-only, reverse, and reveal cards
  const kinds = phrasingsFor({ relationship: 'mom', hasPhoto: true }, { type: 'interest', text: 'gardening', timeSensitive: false });
  const kindRounds = [...new Set(kinds.map((way) => way.kind))].map((kind) => makeRounds([sofia('k', 'x', ALL_HINTS, kinds.filter((way) => way.kind === kind))], [...deck, ...twoFacts])[0]);
  const reverse = { ...first, phrasing: { id: 'ai-x', kind: 'reverse', ask: 'Sofia enjoys {name}.', reveal: 'Sofia enjoys {name}.', fill: { answer: 'gardening', others: ['chess', 'golf'] } }, choices: ['chess', 'gardening', 'golf'] };
  const all = [...kindRounds, reverse, { ...first, reveal: true }];
  assert.deepEqual(all.map((round) => round.phrasing.kind).sort(), ['ask', 'blank', 'blank', 'photo', 'reverse', 'who'], 'every kind is walked');
  for (const round of all) {
    let walk = steps.startSteps();
    assert.ok(steps.notSureButton(round, walk), `${round.phrasing.kind}: the control shows`);
    for (let tap = 0; tap < 10 && steps.notSureButton(round, walk); tap++) walk = steps.askForHelp(round, walk);
    assert.ok(steps.hintNow(round, walk).show && !steps.notSureButton(round, walk), `${round.phrasing.kind}: the ladder ends on the answer and the control goes`);
    assert.ok(walk.help.every((step) => HINT_STEPS.includes(step)) && walk.help.at(-1) === 'answer' && walk.wrong === 0, `${round.phrasing.kind}: steps from the fixed set, nothing wrong`);
    assert.ok(steps.chooseName(round, walk, round.phrasing.fill?.answer ?? round.answer).answered, `${round.phrasing.kind}: finished on the right answer`);
    assert.ok(!walk.setAside || walk.setAside !== (round.phrasing.fill?.answer ?? round.answer), `${round.phrasing.kind}: the answer is never set aside`);
  }
  assert.deepEqual(HINT_STEPS, [...HINT_LADDER, 'wait', 'answer']);
  assert.equal(hintStep(first, 5), 'answer');
  // The words: calm, no judging, no score, and the person's screen shows them only through the control
  for (const text of Object.values(NOT_SURE)) assert.ok(!/wrong|incorrect|score|fail|try again|hurry|quick/i.test(text), `calm words: ${text}`);
}

// Every other name chosen moves the hint exactly one step (2026-11-16, docs/HINT-LADDER.md): the same
// name again included, never two steps for one tap, never back, never past the answer. A name once
// chosen is dimmed and disabled; once the answer shows, only it is live. Recording and scheduling as before.
{
  const steps = await import('@/lib/card-steps');
  const { nextSchedule: schedule } = await import('@/lib/queue');
  const { HINT_RUNGS: rungs, answerOf: answerOfRound } = await import('@/lib/stories');
  const { attemptOf, resolvedOn: resolved } = await import('@/lib/attempts');
  const said = (round, state) => {
    const hint = steps.hintNow(round, state);
    return `${hint.lead}|${hint.detail}|${hint.show}`;
  };
  // Steps to the answer: every rung allowed, then the answer (one "Take your time." with none).
  const toAnswer = (round) => Math.max(hintLadder(round).length, 1) + 1;
  // What the card recorded for its rungs before this change, one entry per step.
  const legacyHints = (round, taps) => {
    const ladder = hintLadder(round);
    return Array.from({ length: taps }, (_, at) => ladder[Math.min(at + 1, ladder.length) - 1]).filter(Boolean);
  };
  const others = (round) => round.choices.filter((name) => name !== answerOfRound(round));
  const [a, b] = others(first);

  // Repeated wrong taps: one step each, the same wrong name tapped again included
  let state = steps.startSteps();
  const seen = [];
  for (const name of [a, a, b, a]) {
    const before = state.misses;
    state = steps.chooseName(first, state, name);
    assert.equal(state.misses, before + 1, `each wrong tap is exactly one step (${state.misses})`);
    assert.ok(!seen.includes(said(first, state)), 'and never repeats a hint already shown');
    seen.push(said(first, state));
  }
  assert.deepEqual([state.wrong, state.tried], [4, [a, b]], 'four names chosen, two different ones dimmed');
  assert.deepEqual(state.hints, legacyHints(first, 4), 'the rungs recorded as the card always recorded them');
  // Two different wrong options: two steps
  const two = steps.chooseName(first, steps.chooseName(first, steps.startSteps(), a), b);
  assert.deepEqual([two.misses, two.wrong], [2, 2], 'two different wrong names: two steps');
  assert.equal(steps.hintNow(first, two).lead, 'This is your mom.', 'the second rung, in order');
  // The same wrong option twice: two steps, two different hints
  const once = steps.chooseName(first, steps.startSteps(), a);
  const twice = steps.chooseName(first, once, a);
  assert.deepEqual([once.misses, twice.misses], [1, 2], 'the same name again still moves one step');
  assert.notEqual(said(first, once), said(first, twice), 'with a new hint, never the same one');
  assert.deepEqual(twice.tried, [a], 'and is dimmed once');
  // Dimmed and disabled: a name once chosen; the answer never
  assert.ok(!steps.nameLive(first, once, a) && steps.nameLive(first, once, b) && steps.nameLive(first, once, 'Sofia'), 'the chosen name is dimmed; the rest stay live');
  // Ladder end: the answer shows, nothing moves past it, only the answer is live, and the right tap is still needed
  let end = steps.startSteps();
  for (let tap = 0; tap < toAnswer(first); tap++) end = steps.chooseName(first, end, tap % 2 ? b : a);
  assert.ok(steps.hintNow(first, end).show && steps.hintNow(first, end).lead === 'It’s Sofia.', 'the last step says the answer');
  assert.equal(end.answered, false, 'the person still taps the right name to finish');
  assert.ok(others(first).every((name) => !steps.nameLive(first, end, name)) && steps.nameLive(first, end, 'Sofia'), 'once the answer shows, only it is live');
  const stray = steps.chooseName(first, end, a);
  assert.deepEqual([stray.misses, stray.hints, said(first, stray)], [end.misses, end.hints, said(first, end)], 'a stray tap at the end never moves past the answer');
  assert.equal(stray.wrong, end.wrong + 1, 'though it is still counted as a name chosen');
  const finished = steps.chooseName(first, end, 'Sofia');
  assert.ok(finished.answered, 'the card ends on the right name, a success');
  assert.equal(steps.chooseName(first, finished, a), finished, 'and nothing moves after it');

  // Every hint setting, every kind of card with the ladder (blank, ask, who, photo-only, reverse, reveal):
  // wrong taps alone, then wrong taps and "I'm not sure" mixed, never skip, repeat, double or go back
  const kinds = phrasingsFor({ relationship: 'mom', hasPhoto: true }, { type: 'interest', text: 'gardening', timeSensitive: false });
  const settings = Array.from({ length: 16 }, (_, bits) => Object.fromEntries(rungs.map((rung, at) => [rung, Boolean(bits & (1 << at))])));
  let walked = 0;
  for (const hints of settings) {
    const kindRounds = [...new Set(kinds.map((way) => way.kind))].map((kind) => makeRounds([sofia('k', 'x', hints, kinds.filter((way) => way.kind === kind))], [...deck, ...twoFacts])[0]);
    const reverse = { ...first, hints, phrasing: { id: 'ai-x', kind: 'reverse', ask: 'Sofia enjoys {name}.', reveal: 'Sofia enjoys {name}.', fill: { answer: 'gardening', others: ['chess', 'golf'] } }, choices: ['chess', 'gardening', 'golf'] };
    for (const round of [...kindRounds, reverse, { ...first, hints, reveal: true }]) {
      const label = `${round.phrasing.kind}${round.reveal ? ' (reveal)' : ''} ${JSON.stringify(hints)}`;
      const wrongs = others(round);
      for (const mix of [false, true]) {
        let walk = steps.startSteps();
        const shown = [];
        for (let tap = 0; tap < toAnswer(round); tap++) {
          const before = walk.misses;
          // A dimmed name tapped again before it dims (the race the fix covers) still counts as one step.
          walk = mix && tap % 2 ? steps.askForHelp(round, walk) : steps.chooseName(round, walk, wrongs[tap % wrongs.length]);
          assert.equal(walk.misses, before + 1, `${label}: one step per tap`);
          assert.ok(!shown.includes(said(round, walk)), `${label}: never the same hint twice`);
          shown.push(said(round, walk));
        }
        assert.ok(steps.hintNow(round, walk).show && !walk.answered, `${label}: ends on the answer, still to be tapped`);
        assert.ok(wrongs.every((name) => !steps.nameLive(round, walk, name)) && steps.nameLive(round, walk, answerOfRound(round)), `${label}: only the answer is live`);
        assert.equal(steps.askForHelp(round, walk), walk, `${label}: "I’m not sure" is gone at the end`);
        assert.equal(steps.chooseName(round, walk, wrongs[0]).misses, walk.misses, `${label}: nothing past the answer`);
        if (!mix) assert.deepEqual(walk.hints, legacyHints(round, toAnswer(round)), `${label}: recorded as before`);
        assert.ok(steps.chooseName(round, walk, answerOfRound(round)).answered, `${label}: finished on the right answer`);
        walked++;
      }
    }
  }
  assert.ok(walked === 16 * 6 * 2, `every setting and kind walked (${walked})`);

  // "I'm not sure" and wrong taps share one ladder: alternating, every tap one step, never two
  let shared = steps.startSteps();
  shared = steps.askForHelp(first, shared);
  shared = steps.chooseName(first, shared, a);
  shared = steps.askForHelp(first, shared);
  assert.deepEqual([shared.misses, shared.wrong, shared.help], [3, 1, ['fact', 'letter']], 'three taps, three steps; help keeps the step it reached');
  assert.equal(steps.hintNow(first, shared).lead, 'The name starts with S.', 'the third rung, whichever way each step came');

  // Recording and scheduling unchanged: tries are the names chosen, hints used the steps; "How answers were found" as before
  for (const wrongTaps of [0, 1, 2, 3]) {
    let card = steps.startSteps();
    for (let tap = 0; tap < wrongTaps; tap++) card = steps.chooseName(first, card, a);
    card = steps.chooseName(first, card, 'Sofia');
    assert.deepEqual(steps.cardResult(card), { tries: wrongTaps + 1, hintsUsed: wrongTaps }, `${wrongTaps} wrong taps: the same result as before`);
    const onStep = { step: 3, dueAt: new Date(2026, 10, 16, 10).toISOString() };
    assert.deepEqual(schedule(onStep, steps.cardResult(card), new Date(2026, 10, 16, 10)), schedule(onStep, { tries: wrongTaps + 1, hintsUsed: wrongTaps }, new Date(2026, 10, 16, 10)), 'scheduled as before');
    const selections = [...Array.from({ length: wrongTaps }, (_, at) => ({ at: 1000 + at, right: false })), { at: 2000, right: true }];
    const record = attemptOf(first, { shownAt: 500, selections, away: [], leftAt: 3000, hints: card.hints, help: [] }, { id: 'r', sessionId: 's', goal: 10, source: 'template', studyDay: '2026-11-16' });
    assert.equal(resolved(record), Math.min(wrongTaps + 1, 3), 'first try, second try, then with help, as Insights already count them');
  }

}

// Facts: every kind makes a sentence from the caregiver's words in a fixed shape
const stories = await import('@/lib/stories');
const facts = await import('@/lib/facts');
const fact = (type, text, more = {}) => ({ type, text, timeSensitive: false, ...more });
const friend = { relationship: 'friend' };
assert.equal(stories.sentenceFor(friend, fact('memory', 'is a carpenter who loves the Riverton Otters')), 'My friend, {name}, is a carpenter who loves the Riverton Otters.');
assert.equal(stories.sentenceFor({}, fact('work', 'a carpenter')), '{name} is a carpenter.');
assert.equal(stories.sentenceFor(friend, fact('team', 'the Riverton Otters')), 'My friend, {name}, loves the Riverton Otters.');
assert.equal(stories.sentenceFor({ relationship: 'mom' }, fact('shared', 'went to Santa’s Village every December')), 'My mom, {name}, and I went to Santa’s Village every December.');
for (const type of stories.FACT_TYPES) {
  const sentence = stories.sentenceFor(friend, fact(type, 'WORDS'));
  assert.ok(sentence.includes('{name}') && sentence.split('WORDS').length === 2, `${type}: one blank and the words once`);
}
assert.equal(stories.sentenceFor(friend, fact('memory', 'paid $5 for {relationship}')), 'My friend, {name}, paid $5 for {relationship}.', 'typed words are never read as slots');
assert.equal(stories.sentenceFor(friend, fact('shared', 'went fishing', { year: 1987 })), 'In 1987, my friend, {name}, and I went fishing.', 'a memory leads with its year');
assert.equal(stories.sentenceFor({}, fact('shared', 'went fishing', { year: 1987 })), 'In 1987, {name} and I went fishing.');
// A fact that may change always leads with its month
const nurse = fact('work', 'going to become a nurse', { timeSensitive: true, asOf: '2026-05-01' });
assert.equal(stories.sentenceFor({ relationship: 'granddaughter' }, nurse), 'As of May 2026, my granddaughter, {name}, is going to become a nurse.');
assert.equal(stories.sentenceFor({}, nurse), 'As of May 2026, {name} is going to become a nurse.');
// The committed deck is fictional (src/data/sample-deck.ts). Real people live only in the gitignored
// src/data/deck.local.ts, never in a check: these invented stand-ins take their place, with the same
// shape (one memory each, one without a relationship), so the rules for real people (test data flagged,
// held back from AI) are checked without anyone real.
const { sampleDeck, SAMPLE_IDS } = await import('@/data/sample-deck');
const standIns = [
  { id: 'nora', name: 'Nora', relationship: 'niece', memories: ['loves painting and old musicals'] },
  { id: 'milo', name: 'Milo', relationship: 'friend', memories: ['is a carpenter who loves the Riverton Otters'] },
  { id: 'ivy', name: 'Ivy', relationship: 'sister-in-law', memories: ['loves to garden and to sing in a choir'] },
  { id: 'theo', name: 'Theo', memories: ['loves board games and is a pilot'] },
  { id: 'hal', name: 'Hal', relationship: 'uncle', memories: ['is a baker and loves birdwatching'] },
  { id: 'greta', name: 'Greta', relationship: 'godmother', memories: ['is a librarian and loves crosswords'] },
  { id: 'felix', name: 'Felix', relationship: 'nephew', memories: ['is a mechanic and loves trivia nights'] },
];
const exampleDeck = [...standIns, ...sampleDeck];
assert.deepEqual(SAMPLE_IDS, ['june', 'leo', 'ruth', 'omar', 'mae'], 'the committed deck: five fictional sample people');
// The example deck's memories keep exactly the sentence they had (Phase 1's two templates)
for (const person of exampleDeck) {
  for (const memory of person.memories) {
    const before = person.relationship ? `My ${person.relationship}, {name}, ${memory}.` : `{name} ${memory}.`;
    assert.equal(stories.sentenceFor(person, fact('memory', memory)), before, `${person.id}: the first fact is the old sentence`);
  }
}

// Phrasings: 3 to 6 fixed shapes per kind of fact, each holding the caregiver's words once
const withAll = { relationship: 'friend', hasPhoto: true };
const asked = (type, text, about = withAll, more = {}) => stories.phrasingsFor(about, fact(type, text, more));
const show = (phrasings) => phrasings.map((p) => p.ask);
assert.deepEqual(show(asked('team', 'the Riverton Otters')), [
  'My friend, {name}, loves the Riverton Otters.',
  '{name} loves the Riverton Otters.',
  '{name}’s favorite team is the Riverton Otters.',
  'Who loves the Riverton Otters?',
  'This person loves the Riverton Otters. Who is this?',
  'Who is this?',
]);
assert.ok(show(asked('work', 'a carpenter')).includes('{name} is a carpenter.'));
assert.deepEqual(asked('team', 'x').map((p) => p.kind), ['blank', 'blank', 'blank', 'ask', 'who', 'photo'], 'four kinds of question');
// Template words, so a phrasing can be checked to say nothing beyond the caregiver's words
const TEMPLATE_WORDS = new Set(
  'my and i is enjoys loves watching listening to has a birthday on met who whose did you meet this person favorite team show food music as of worked in or studied at the movie place always we had holiday goes by call do known each other have lives with partner named child'.split(' '),
);
for (const type of stories.FACT_TYPES) {
  for (const about of [withAll, { hasPhoto: false }]) {
    for (const more of [{}, { timeSensitive: true, asOf: '2026-05-01' }]) {
      const list = asked(type, 'WORDS', about, more);
      if (about === withAll && !more.timeSensitive) assert.ok(list.length >= 3 && list.length <= 6, `${type}: ${list.length} phrasings`);
      assert.equal(new Set(list.map((p) => p.id)).size, list.length, `${type}: each shape once`);
      for (const p of list) {
        assert.equal((p.ask + ' ' + (p.kind === 'blank' ? '' : p.reveal)).split('WORDS').length - 1, p.kind === 'photo' ? 1 : p.kind === 'blank' ? 1 : 2, `${type}/${p.id}: the words once in the question and once read back`);
        assert.equal(p.reveal.split('{name}').length, 2, `${type}/${p.id}: the reveal has the name once`);
        if (p.kind === 'blank') assert.ok(p.ask.includes('{name}')); else assert.ok(!p.ask.includes('{name}'), `${type}/${p.id}: a question does not show the blank`);
        const rest = (p.ask + ' ' + p.reveal).replace(/WORDS|\{name\}|friend|May 2026|’s/g, ' ').toLowerCase().match(/[a-z]+/g) ?? [];
        const extra = rest.filter((word) => !TEMPLATE_WORDS.has(word));
        assert.deepEqual(extra, [], `${type}/${p.id}: no words beyond the fixed shape: ${extra}`);
        if (more.timeSensitive) assert.ok(p.reveal.startsWith('As of May 2026, ') && (p.kind === 'photo' || p.ask.includes('As of May 2026, ')), `${type}/${p.id}: states its month`);
      }
    }
  }
}
assert.deepEqual(show(asked('calls', 'Nana')), ['I call my friend, {name}, Nana.', 'I call {name} Nana.', 'Who do you call Nana?', 'You call this person Nana. Who is this?', 'Who is this?']);
assert.equal(stories.sentenceFor(friend, fact('calls', 'Nana', { timeSensitive: true, asOf: '2026-05-01' })), 'As of May 2026, I call my friend, {name}, Nana.', '"I" stays a capital after the lead');
assert.equal(asked('partner', 'Sam').find((p) => p.id === 'favorite').ask, '{name}’s partner is Sam.');
assert.equal(asked('partner', 'Sam').find((p) => p.kind === 'ask').ask, 'Whose partner is Sam?');
assert.equal(asked('holiday', 'spent at the lake')[0].ask, 'My friend, {name}, and I had a holiday we spent at the lake.');
assert.equal(asked('regular', 'went for ice cream', withAll, { year: 1987 })[0].ask, 'In 1987, my friend, {name}, and I always went for ice cream.');
assert.equal(stories.clueFor(fact('habit', 'hums in the kitchen')), 'This person always hums in the kitchen.');
assert.equal(stories.clueFor(fact('calls', 'Nana')), 'You call this person Nana.');
assert.ok(!asked('marital', 'married').some((p) => p.kind === 'ask') && !asked('situation', 'expecting a baby').some((p) => p.kind === 'ask'), 'private facts are stated, never asked');
assert.ok(!asked('team', 'x', { hasPhoto: false }).some((p) => p.id === 'my-rel'), 'no relationship: no "My ..." shape');
assert.ok(!asked('team', 'x', { relationship: 'friend', hasPhoto: false }).some((p) => p.kind === 'who' || p.kind === 'photo'), 'no photo: no photo questions');
assert.ok(!asked('memory', 'and I went to the lake').some((p) => p.id === 'ask'), 'no "Who and I ...?"');
assert.ok(asked('memory', 'grows tomatoes').some((p) => p.ask === 'Who grows tomatoes?'));
assert.equal(asked('met', 'at church in 1962').find((p) => p.kind === 'ask').ask, 'Who did you meet at church in 1962?');
assert.equal(asked('birthday', 'March 3').find((p) => p.kind === 'ask').ask, 'Whose birthday is March 3?');
assert.deepEqual(stories.phrasingsOn(asked('team', 'x'), ['photo', 'ask']).map((p) => p.id), ['my-rel', 'name', 'favorite', 'who'], 'turned-off phrasings are left out');
assert.deepEqual(stories.phrasingsOn(asked('shared', 'x'), ['my-rel', 'name', 'who', 'photo']).map((p) => p.id), ['my-rel'], 'never none');

// Rotation: the same person is never asked the same way twice in a row, across sessions too
let seed = 7;
const random = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const miloFacts = ['a carpenter', 'the Riverton Otters'].map((text, i) => {
  const f = fact(i ? 'team' : 'work', text);
  return card(`m${i}`, 'Milo', { personId: 'milo', relationship: 'friend', fact: f, phrasings: stories.phrasingsFor(withAll, f) });
});
const miloDeck = [...deck, ...miloFacts];
const longSession = Array.from({ length: 40 }, (_, i) => miloFacts[i % 2]);
const asks = makeRounds(longSession, miloDeck, {}, random).map((round) => round.phrasing.id);
assert.ok(asks.every((id, i) => i === 0 || id !== asks[i - 1]), 'never the same phrasing back to back');
assert.ok(new Set(asks).size >= 5, `every shape gets a turn (${new Set(asks).size})`);
for (let i = 0; i < 30; i++) {
  const last = asks[i];
  assert.notEqual(makeRounds([miloFacts[0]], miloDeck, { milo: { phrasing: last } }, random)[0].phrasing.id, last, 'not the one the last session ended on');
}
const only = { ...miloFacts[0], phrasings: stories.phrasingsOn(miloFacts[0].phrasings, ['my-rel', 'name', 'who', 'photo']) };
assert.deepEqual(makeRounds([only, only], miloDeck, {}, random).map((r) => r.phrasing.id), ['ask', 'ask'], 'one phrasing left: it is used');
// The caregiver's say over the fact hint: facts left out, and the best clue
const workFact = fact('work', 'a nurse');
const hobbyFact = fact('interest', 'gardening');
const metFact = fact('met', 'at church');
const aunt = (id, f, more = {}) => card(id, 'June', { personId: 'june', fact: f, phrasings: stories.phrasingsFor({ hasPhoto: false }, f).filter((p) => p.id === 'name'), ...more });
const aunts = [aunt('j0', fact('memory', 'grows tomatoes')), aunt('j1', workFact), aunt('j2', hobbyFact), aunt('j3', metFact)];
assert.equal(makeRounds([aunts[0]], aunts)[0].clue, 'This person is a nurse.', 'the next fact, by default');
const noWork = aunts.map((c) => (c.id === 'j1' ? { ...c, hintOk: false } : c));
assert.equal(makeRounds([noWork[0]], noWork)[0].clue, 'This person enjoys gardening.', 'a fact left out of hints is skipped');
const clued = (bestClue) => aunts.map((c) => ({ ...c, bestClue }));
assert.equal(makeRounds([clued('hobby')[0]], clued('hobby'))[0].clue, 'This person enjoys gardening.', 'the best clue chooses the fact');
assert.equal(makeRounds([clued('met')[0]], clued('met'))[0].clue, 'This person and I met at church.');
assert.equal(makeRounds([clued('job')[1]], clued('job'))[0].clue, 'This person enjoys gardening.', 'never the fact the card shows, even if it is the best clue');
assert.equal(makeRounds([clued('laugh')[0]], clued('laugh'))[0].clue, 'Think of their laugh.');
assert.equal(makeRounds([clued('voice')[0]], clued('voice'))[0].clue, 'Think of their voice.');

// Names and the right name's place rotate, so the buttons can't be learned by pattern
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const answerAt = (round) => round.choices.indexOf(round.answer);
const miloRounds = makeRounds(longSession, miloDeck, {}, random);
for (const [i, round] of miloRounds.entries()) {
  assert.equal(round.choices.length, 3);
  assert.equal(new Set(round.choices).size, 3);
  assert.ok(round.choices.includes('Milo'), 'the right name is always offered');
  if (i === 0) continue;
  const before = miloRounds[i - 1];
  assert.ok(!same(round.choices, before.choices), 'never the same three buttons in the same order twice running');
  assert.notEqual(answerAt(round), answerAt(before), 'the right name moves');
  // Mae sounds like Milo (the same first letter), so she is never offered beside him; that leaves three
  // other names, too few for two fresh ones every time, so here only the order is sure to change.
  assert.ok(round.choices.every((name) => name === 'Milo' || !stories.soundsAlike(name, 'Milo')), 'never a name that sounds like the answer');
}
// With enough names unlike the answer, the other names are ones this person wasn't just shown.
const roomy = ['June', 'Leo', 'Omar', 'Ruth', 'Bea'].map((name) => card(`r-${name}`, name));
const roomyRounds = makeRounds(longSession, [...roomy, ...miloFacts], {}, random);
for (const [i, round] of roomyRounds.entries()) {
  if (i === 0) continue;
  assert.ok(round.choices.filter((name) => name !== 'Milo').every((name) => !roomyRounds[i - 1].choices.includes(name)), 'other names this person was not just shown');
}
const places = [0, 1, 2].map((at) => miloRounds.filter((round) => answerAt(round) === at).length);
assert.ok(places.every((n) => n >= 8), `the right name takes every place: ${places}`);
const shownLast = ['June', 'Milo', 'Leo'];
for (let i = 0; i < 30; i++) {
  const next = makeRounds([miloFacts[0]], miloDeck, { milo: { choices: shownLast } }, random)[0];
  assert.ok(answerAt(next) !== 1 && !same(next.choices, shownLast), 'not as the last session left it');
}
const mixed = makeRounds(Array.from({ length: 30 }, (_, i) => [...deck, ...miloFacts][i % 6]), miloDeck, {}, random);
assert.ok(mixed.every((round, i) => i === 0 || answerAt(round) !== answerAt(mixed[i - 1])), 'and away from where the card before had it');
const twoNames = [card('t1', 'Ann'), card('t2', 'Bo')];
const pairs = makeRounds([twoNames[0], twoNames[0], twoNames[0]], twoNames, {}, random);
assert.deepEqual(pairs.map((round) => round.choices.length), [2, 2, 2]);
assert.ok(pairs.every((round, i) => i === 0 || answerAt(round) !== answerAt(pairs[i - 1])), 'a small deck still swaps places');

// A photo-only card shows no fact, so its fact hint can be its own; any other card hints another fact
const photoOnly = { ...miloFacts[0], phrasings: miloFacts[0].phrasings.filter((p) => p.kind === 'photo') };
assert.equal(makeRounds([photoOnly], miloDeck)[0].clue, 'This person is a carpenter.');
const blankOnly = { ...miloFacts[0], phrasings: miloFacts[0].phrasings.filter((p) => p.id === 'name') };
assert.equal(makeRounds([blankOnly], miloDeck)[0].clue, 'This person loves the Riverton Otters.');

const savedCard = (id, type, text, more = {}) => ({ id, personId: 'p', type, text, timeSensitive: false, status: 'approved', source: 'caregiver', ...more });
const now11Early = () => new Date(2026, 10, 3, 9);
const tidy = (text) => stories.tidyMemory(text);
// Drafts: saved after a quiet moment, at once on a flush, one at a time, nothing lost
const { AUTOSAVE_MS, createAutosaver } = await import('@/lib/autosave');
assert.ok(AUTOSAVE_MS >= 300 && AUTOSAVE_MS <= 700, 'about half a second after the last keystroke');
const fakeClock = () => {
  let time = 0;
  let next = 1;
  const waiting = new Map();
  return {
    set: (run, ms) => (waiting.set(next, { run, at: time + ms }), next++),
    clear: (id) => waiting.delete(id),
    advance(ms) {
      time += ms;
      for (const [id, job] of [...waiting]) if (job.at <= time) (waiting.delete(id), job.run());
    },
  };
};
const settle = () => new Promise((done) => setTimeout(done, 0));
{
  // The phone's storage, and a screen that saves what is typed into it
  const storage = new Map();
  const clock = fakeClock();
  let typed = '';
  let saves = 0;
  const saver = createAutosaver(async () => {
    saves++;
    storage.set('draft', typed);
  }, AUTOSAVE_MS, clock);
  const type = (text) => ((typed = text), saver.touch());
  type('a n');
  clock.advance(AUTOSAVE_MS - 1);
  type('a nu');
  clock.advance(AUTOSAVE_MS - 1);
  type('a nurse');
  await settle();
  assert.equal(saves, 0, 'nothing saves while typing goes on');
  clock.advance(AUTOSAVE_MS);
  await settle();
  assert.equal(saves, 1, 'one save after the last keystroke');
  // The app closes: nothing runs any more, and the next launch reads the storage
  const reopened = storage.get('draft');
  assert.equal(reopened, 'a nurse', 'a debounced draft survives the app closing');
  type('a nurse in Ohio');
  await saver.flush();
  assert.equal(storage.get('draft'), 'a nurse in Ohio', 'a blur, the background or a new step saves at once');
  await saver.flush();
  assert.equal(saves, 2, 'nothing owing, nothing written');
  clock.advance(AUTOSAVE_MS * 2);
  await settle();
  assert.equal(saves, 2, 'a flush cancels the waiting save');
  // A save that fails stays owing; saves never overlap
  let failNext = true;
  let running = 0;
  let overlapped = false;
  const flaky = createAutosaver(async () => {
    running++;
    overlapped ||= running > 1;
    await settle();
    running--;
    if (failNext) {
      failNext = false;
      throw new Error('offline');
    }
    storage.set('flaky', typed);
  }, AUTOSAVE_MS, clock);
  flaky.touch();
  await assert.rejects(flaky.flush(), /offline/, 'the step knows a save failed');
  typed = 'still here';
  await flaky.flush();
  assert.equal(storage.get('flaky'), 'still here', 'and it is tried again');
  flaky.touch();
  const one = flaky.flush();
  flaky.touch();
  await Promise.all([one, flaky.flush()]);
  assert.ok(!overlapped, 'saves run one at a time');
  const latestSave = createAutosaver(async () => storage.set('latest', 'old'), AUTOSAVE_MS, clock);
  latestSave.use(async () => storage.set('latest', 'new'));
  latestSave.touch();
  await latestSave.flush();
  assert.equal(storage.get('latest'), 'new', 'saves use the latest answers');
}

// The guided profile: one file of questions, and every kind of fact covered once
const q = await import('@/data/questionnaire');
const profile = await import('@/lib/profile');
const everyQuestion = q.SECTIONS.flatMap((section) => section.questions);
assert.deepEqual(q.SECTIONS.map((section) => section.step), [0, 1, 2, 3, 4, 5, 6, 7], 'the first screen, then seven steps in order');
assert.deepEqual(everyQuestion.flatMap((one) => (one.factType && !one.sets ? [one.factType] : [])).sort(), [...stories.FACT_TYPES].sort(), 'every kind of fact has exactly one question');
assert.equal(new Set(everyQuestion.map((one) => one.id)).size, everyQuestion.length, 'question ids are unique');
for (const one of everyQuestion) {
  if (one.factType) {
    assert.ok(one.limit > 0 && one.limit <= 120, `${one.id}: a limit the database takes`);
    if (!one.sets) assert.equal(one.id, one.factType, `${one.id}: named for its fact`);
  }
  if (['choice', 'picker', 'chips'].includes(one.input)) assert.ok(one.options?.length, `${one.id}: has choices`);
  if (one.input === 'list' || one.input === 'chips') assert.ok(one.most > 1 && one.more, `${one.id}: says how to add more`);
  for (const option of one.options ?? []) assert.ok(tidy(option.value) === option.value, `${one.id}: "${option.value}" is saved tidy`);
  assert.ok(!/diagnosis|decline|progression|severity|accuracy/i.test(JSON.stringify(one)), `${one.id}: no words the framework bans`);
}
assert.ok(!/diagnosis|decline|progression|severity|accuracy/i.test(q.FACTS_ONLY), 'the helper line avoids the banned words');
assert.deepEqual(everyQuestion.find((one) => one.sets === 'bestClue').options.map((o) => o.value), [...stories.BEST_CLUES]);
assert.deepEqual(everyQuestion.filter((one) => one.changes === 'always').map((one) => one.id), ['plans', 'marital', 'situation'], 'these are always dated and confirmed');
assert.deepEqual(everyQuestion.filter((one) => one.caregiverOnly).map((one) => one.id), ['marital', 'situation']);
const forRelatives = q.relativeSections();
assert.deepEqual(forRelatives.map((section) => section.title), ['Work and school', 'Family and home', 'Interests', 'Shared memories'], 'the sections a relative may answer');
assert.ok(!forRelatives.flatMap((section) => section.questions).some((one) => one.caregiverOnly || one.id === 'marital'), 'never the caregiver-only questions');

// A step is one card of questions, in order; only a heading starts another (docs/ADD-PERSON-AUDIT.md, finding 4)
for (const section of q.SECTIONS) {
  const groups = q.questionGroups(section.questions);
  assert.deepEqual(groups.flat().map((one) => one.id), section.questions.map((one) => one.id), `${section.title}: every question in one group, in order`);
  for (const group of groups) assert.ok(group.slice(1).every((one) => !one.heading), `${section.title}: only a heading starts a group`);
  assert.equal(groups.length, section.questions.length ? 1 + section.questions.slice(1).filter((one) => one.heading).length : 0, `${section.title}: one card, plus one per heading`);
  // One idea per step: a short title and a one-line helper, written as a sentence
  assert.ok(section.title.split(' ').length <= 4, `${section.title}: a short title`);
  assert.ok(/^\p{Lu}.*\.$/u.test(section.helper) && section.helper.length <= 80, `${section.title}: a one-line helper, a full sentence`);
}
assert.deepEqual(q.questionGroups(q.SECTIONS[3].questions).map((group) => group[0].heading ?? group[0].id), ['Home', 'Family'], 'Family and home: the private questions wait inside the Family card');
assert.deepEqual(q.questionGroups(q.SECTIONS[4].questions).map((group) => group.length), [2, 6], 'Interests: hobbies and what they always do, then favorites');
assert.deepEqual(q.questionGroups(q.SECTIONS[5].questions).map((group) => group.length), [5], 'Shared memories: one card');
assert.equal(q.stepLabel(0), 'Step 1 of 8', 'the first screen is step 1');
assert.equal(q.stepLabel(q.REVIEW_STEP), 'Step 8 of 8', 'and review the last');
// "* Required" only where a step asks something required
assert.deepEqual(q.SECTIONS.filter(q.hasRequired).map((section) => section.step), [0, 4, 5], 'the legend shows on the first step, Interests and Shared memories only');

// Answers become facts, and come back
const entryKey = (() => { let n = 0; return () => `k${++n}`; })();
const family3 = q.SECTIONS[3];
const blanks = profile.sectionEntries(family3, [], entryKey);
assert.deepEqual(blanks.map((e) => e.question), ['home', 'lives_with', 'partner', 'child', 'pet', 'situation'], 'a field for each typed question, none for chips');
const typed = blanks.map((e) => (e.question === 'situation' ? { ...e, text: 'expecting a baby.' } : e));
const drafts = facts.planFacts([], profile.toDrafts(typed, now11Early())).add;
assert.equal(drafts.length, 1, 'empty new answers are not saved');
assert.deepEqual([drafts[0].type, drafts[0].text, drafts[0].timeSensitive, drafts[0].asOf, drafts[0].hintOk], ['situation', 'expecting a baby', true, '2026-11-01', false], 'always dated, tidied, and not a hint unless chosen');
assert.ok(drafts[0].id, 'an answer has its fact id from the start');
const savedFacts = [savedCard('m1', 'memory', 'loves jazz'), savedCard('m2', 'memory', 'bakes bread'), savedCard('w1', 'work', 'a nurse', { timeSensitive: true, asOf: '2026-05-01' }), savedCard('s1', 'shared', 'went fishing', { year: 1987 })];
const memories5 = profile.sectionEntries(q.SECTIONS[5], savedFacts, entryKey);
assert.deepEqual(memories5.filter((e) => e.type === 'memory').map((e) => e.text), ['bakes bread'], 'step 1 keeps its fact; the form shows the others');
assert.equal(memories5.find((e) => e.type === 'shared').year, 1987);
assert.deepEqual(profile.toDrafts(memories5.map((e) => (e.id === 'm2' ? { ...e, text: '' } : e)), now11Early()).filter((d) => d.id === 'm2').map((d) => d.text), [''], 'an emptied answer stays in, so it is removed');
assert.equal(profile.validYear(1987, now11Early()), 1987);
assert.equal(profile.validYear(87, now11Early()), undefined, 'a typed year must be a real one');
assert.equal(profile.validYear(2999, now11Early()), undefined);

// "Profile X% complete" is about the form only: the required questions, and nothing else
const started = { name: 'Ann', relationship: 'friend', hasPhoto: true };
const justOne = [savedCard('m1', 'memory', 'loves jazz')];
assert.deepEqual(q.SECTIONS.flatMap((section) => section.questions).filter((question) => question.required).map((question) => question.id), ['name', 'photo', 'relationship', 'interest', 'shared'], 'the required list stays short');
for (const id of ['marital', 'situation']) {
  const question = q.SECTIONS.flatMap((section) => section.questions).find((candidate) => candidate.id === id);
  assert.ok(!question.required && question.behind, `${id} stays optional, behind the quiet button`);
}
// The percent (docs/ADD-PERSON-AUDIT.md, finding 2): 20 for each required question done, 3 for each
// optional question answered up to 15 while something required is missing, and 100 only when complete
assert.ok(q.COMPLETION.optionalMost < 100 / requiredIdsList().length, 'optional answers can never stand in for a required one');
function requiredIdsList() {
  return q.SECTIONS.flatMap((section) => section.questions).filter((question) => question.required);
}
assert.equal(profile.profileCompletion({ hasPhoto: false }, []), 0, 'an empty form');
assert.equal(profile.profileCompletion({ name: 'Ann', hasPhoto: false }, []), 20, 'each required answer is the same share');
assert.equal(profile.profileCompletion({ name: 'Ann', hasPhoto: false }, justOne), 23, 'the first screen’s one fact counts as an optional answer');
const startPercent = profile.profileCompletion(started, justOne);
assert.equal(startPercent, 63, 'name, photo and relationship, and one optional answer');
assert.equal(profile.profileCompletion(started, []), 60, 'the three required answers alone');
const optionalOnly = [savedCard('m', 'marital', 'married'), savedCard('s', 'situation', 'expecting a baby'), savedCard('p', 'plans', 'going to retire'), savedCard('h', 'habit', 'hums')];
assert.equal(profile.profileCompletion(started, [...justOne, ...optionalOnly]), 75, 'five optional answers: 15 more');
assert.equal(profile.profileCompletion(started, [...justOne, ...optionalOnly, savedCard('w', 'work', 'a nurse'), savedCard('b', 'birthday', 'March 3')]), 75, 'and no more than 15, however many');
assert.equal(profile.profileCompletion(started, [savedCard('c1', 'child', 'Noah'), savedCard('c2', 'child', 'Ava')]), 63, 'a question counts once, however many answers it has');
assert.equal(profile.profileCompletion({ ...started, bestClue: 'voice' }, []), 63, 'the best clue is an optional answer');
assert.equal(profile.profileCompletion(started, [...justOne, savedCard('i', 'interest', 'golf'), savedCard('j', 'interest', 'fishing')]), 83, 'one interest is enough');
assert.equal(profile.profileCompletion(started, [savedCard('t', 'team', 'the Otters')]), 83, 'a favorite is an interest, and an optional answer');
assert.equal(profile.profileCompletion(started, [...justOne, savedCard('i', 'interest', 'golf'), savedCard('r', 'regular', 'went for ice cream')]), 100, 'any shared memory will do');
assert.equal(profile.profileCompletion(started, [savedCard('i', 'interest', 'golf'), savedCard('s', 'shared', 'swam')]), 100, 'complete with no optional answer at all is 100');
assert.equal(profile.profileCompletion(started, [...justOne, ...optionalOnly, savedCard('i', 'interest', 'golf')]), 95, 'the most an incomplete profile can show');
{
  // 100 appears exactly when nothing required is missing, and answering never lowers the percent
  const kinds = ['memory', 'interest', 'team', 'shared', 'regular', 'work', 'child', 'pet', 'habit', 'nickname', 'plans', 'home'];
  let seed = 7;
  const random = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let round = 0; round < 400; round += 1) {
    const person = { name: random() < 0.9 ? 'Ann' : undefined, relationship: random() < 0.6 ? 'friend' : undefined, hasPhoto: random() < 0.6, notApplicable: ['photo', 'relationship', 'interest', 'shared'].filter(() => random() < 0.15) };
    const cards = kinds.filter(() => random() < 0.3).map((kind, index) => savedCard(`r${index}`, kind, `words ${index}`));
    const percent = profile.profileCompletion(person, cards);
    assert.equal(percent === 100, profile.missingItems(person, cards).length === 0, `100% exactly when complete (round ${round})`);
    assert.ok(percent >= 0 && percent <= 100 && Number.isInteger(percent), 'a whole number from 0 to 100');
    const more = [...cards, savedCard('extra', kinds[Math.floor(random() * kinds.length)], 'more words')];
    assert.ok(profile.profileCompletion(person, more) >= percent, 'answering something never lowers it');
  }
}
// The form's percent follows what is typed, before the autosave
{
  const typedName = profile.profileCompletion({ name: 'Ann', hasPhoto: false }, profile.withAnswers([], [], 'p'));
  assert.equal(typedName, 20, 'a name typed on the first screen counts at once');
  const stepFive = profile.sectionEntries(q.SECTIONS[5], [], entryKey);
  const typed = stepFive.map((entry) => (entry.question === 'shared' ? { ...entry, text: 'swam in the lake ' } : entry));
  const live = profile.withAnswers([savedCard('i', 'interest', 'golf')], typed, 'p');
  assert.deepEqual(live.map((card) => [card.type, card.text]), [['interest', 'golf'], ['shared', 'swam in the lake']], 'a typed answer is there, tidied; empty fields are not');
  assert.equal(profile.profileCompletion(started, live), 100, 'so the bar reaches 100 as the last answer is typed');
  const emptied = profile.withAnswers([savedCard('s1', 'shared', 'swam')], [{ ...typed[0], id: 's1', text: '' }], 'p');
  assert.deepEqual(emptied, [], 'an answer emptied on the form no longer counts');
}
// Review's way on: Continue, disabled with the percent until 100%
assert.deepEqual(profile.reviewAction(60, { name: 'Ann' }), { label: 'Continue · 60%', disabled: true }, 'Continue waits for 100%, and shows how far');
assert.deepEqual(profile.reviewAction(95, { name: 'Ann' }), { label: 'Continue · 95%', disabled: true });
assert.deepEqual(profile.reviewAction(100, { name: 'Ann', inDeck: true }), { label: 'Continue', disabled: false }, 'at 100% it opens story approval');
assert.deepEqual(profile.reviewAction(100, { name: 'Ann', inDeck: false, includeInPractice: false }), { label: 'Add Ann to practice', disabled: false }, 'someone taken out of practice is put back in by it, so it says so');
// Resume profile says where it picks up
assert.equal(profile.resumeLine(4), 'Picks up at step 5 of 8, Interests.');
assert.equal(profile.resumeLine(profile.resumeStep(0, [])), 'Picks up at step 2 of 8, Names and dates.', 'a draft from the first screen picks up at the next step');
assert.deepEqual(profile.missingItems(started, justOne), [{ id: 'interest', label: 'One interest', step: 4 }, { id: 'shared', label: 'One shared memory', step: 5 }], 'what is missing, and the step it is on');
assert.deepEqual(profile.missingItems({ name: 'Ann', hasPhoto: false }, []).map((item) => [item.id, item.step]), [['photo', 0], ['relationship', 0], ['interest', 4], ['shared', 5]]);
assert.ok(profile.needsFinishing(80), 'Resume profile stays until it is all done');
assert.ok(!profile.needsFinishing(100));
assert.equal(profile.resumeStep(0, []), 1);
assert.equal(profile.resumeStep(4, [{ step: 5 }]), 4, 'picks up at the furthest step');
assert.equal(profile.resumeStep(q.REVIEW_STEP, [{ step: 4 }, { step: 5 }]), 4, 'once through, at what is missing');
assert.equal(profile.resumeStep(q.REVIEW_STEP, []), q.REVIEW_STEP);
const lines = profile.sectionSummary(q.SECTIONS[2], started, [savedCard('w1', 'work', 'a nurse', { timeSensitive: true, asOf: '2026-05-01' }), savedCard('f', 'field', 'health care')]);
assert.deepEqual(lines, [{ label: 'Work', text: 'a nurse (as of May 2026)' }, { label: 'Field', text: 'Health care' }], 'the review says it plainly');

// Which facts reach practice, and what approving one writes
const now11 = new Date(2026, 10, 3, 9);
assert.ok(facts.inPractice({ status: 'approved', timeSensitive: false }));
assert.ok(!facts.inPractice({ status: 'pending', timeSensitive: false }));
assert.ok(!facts.inPractice({ status: 'approved', timeSensitive: true }), 'a fact that may change waits for confirmation');
assert.ok(facts.inPractice({ status: 'approved', timeSensitive: true, confirmedAt: now11.toISOString() }));
assert.deepEqual(facts.statusChange({ timeSensitive: true }, 'approved', now11), { status: 'approved', confirmedAt: now11.toISOString(), asOf: '2026-11-01' }, 'confirming dates it this month');
assert.equal(facts.statusChange({ timeSensitive: true, asOf: '2026-05-01' }, 'approved', now11).asOf, '2026-05-01', 'confirming keeps its month');
assert.equal(facts.statusChange({ timeSensitive: true, asOf: '2026-05-01' }, 'skipped', now11).confirmedAt, undefined, 'skipping takes the confirmation away');
assert.deepEqual(facts.statusChange({ timeSensitive: false }, 'approved', now11), { status: 'approved', confirmedAt: undefined, asOf: undefined });
assert.ok(facts.relationshipChanged('friend', 'best friend') && !facts.relationshipChanged('friend', ' My friend '));
assert.equal(facts.addMonths('2026-01-01', -1), '2025-12-01');
assert.equal(facts.addMonths('2026-12-01', 1), '2027-01-01');
assert.equal(facts.monthOf(now11), '2026-11-01');

// Saving the form: new, changed (back to approval) and emptied facts
const before = [savedCard('a', 'memory', 'loves jazz'), savedCard('b', 'work', 'a nurse'), savedCard('c', 'food', 'lasagna')];
const plan = facts.planFacts(before, [
  { id: 'a', ...fact('memory', 'loves jazz.  ') },
  { id: 'b', ...fact('work', 'a nurse', { timeSensitive: true, asOf: '2026-05-01' }) },
  { id: 'c', ...fact('food', '  ') },
  fact('team', 'the Otters'),
  fact('show', ''),
]);
assert.deepEqual(plan.add.map((draft) => draft.text), ['the Otters'], 'only facts with words are added');
assert.deepEqual(plan.change.map((draft) => draft.id), ['b'], 'tidying alone is no change; marking it as changing is');
assert.deepEqual(plan.remove, ['c'], 'an emptied fact is removed');
assert.deepEqual(facts.planFacts(before, [fact('team', 'the Otters')]).remove, [], 'facts the drafts do not mention stay');
assert.deepEqual(facts.planFacts([savedCard('y', 'shared', 'went fishing')], [{ id: 'y', ...fact('shared', 'went fishing', { year: 1987 }) }]).change.map((d) => d.id), ['y'], 'a new year is a change');
assert.equal(facts.tidyDraft(fact('work', 'x', { asOf: '2026-05-01' })).asOf, undefined, 'only a fact that may change keeps a month');

// The family on the phone (sign-in off)
const families = await import('@/lib/local-family');
let made = 0;
const nextId = () => `n${++made}`;
let family = families.seedFamily(families.EMPTY_FAMILY, exampleDeck);
assert.deepEqual(
  family.cards.map((c) => c.id),
  exampleDeck.flatMap((person) => person.memories.map((_, i) => `${person.id}-${i}`)),
  'deck facts keep the card ids practice already scheduled',
);
assert.ok(family.cards.every((c) => c.status === 'approved' && c.type === 'memory' && c.source === 'caregiver'));
assert.equal(families.seedFamily(family, exampleDeck), family, 'seeding twice changes nothing');
// A phone from before the sample people joined the deck: test data had added Ruth itself. She is noted
// as seeded, never copied twice, and the rest of the family (test data, AI sentences) is kept.
const earlierPhone = { seeded: ['june'], testSeeded: true, sentences: [], people: [{ id: 'june', name: 'June' }, { id: 'ruth', name: 'Ruth', samplePortrait: 'ruth' }], cards: [{ id: 'ruth-0', personId: 'ruth', type: 'memory', text: 'knits', timeSensitive: false, status: 'approved', source: 'caregiver', phrasingsOff: [] }] };
const upgraded = families.seedFamily(earlierPhone, sampleDeck);
assert.deepEqual(upgraded.people.filter((p) => p.id === 'ruth').length, 1, 'nobody copied twice');
assert.deepEqual(upgraded.cards.filter((c) => c.id === 'ruth-0').length, 1, 'nor their card');
assert.ok(upgraded.seeded.includes('ruth') && upgraded.testSeeded && Array.isArray(upgraded.sentences), 'noted as seeded, the rest kept');
assert.deepEqual(upgraded.people.map((p) => p.id), ['june', 'ruth', 'leo', 'omar', 'mae'], 'the others join');
const withoutMilo = families.removePerson(family, 'milo');
assert.ok(!families.seedFamily(withoutMilo, exampleDeck).people.some((p) => p.id === 'milo'), 'a removed deck person does not come back');
assert.ok(!withoutMilo.cards.some((c) => c.personId === 'milo'));
family = families.addPerson(family, { id: 'nia', name: 'Nia', relationship: 'granddaughter' }, [fact('memory', 'loves to paint'), nurse, fact('team', '')], nextId);
const nias = family.cards.filter((c) => c.personId === 'nia');
assert.deepEqual(nias.map((c) => [c.text, c.status]), [['loves to paint', 'pending'], ['going to become a nurse', 'pending']], 'new facts wait for approval');
family = families.setStatus(family, nias[1].id, 'approved', now11);
const confirmed = family.cards.find((c) => c.id === nias[1].id);
assert.ok(facts.inPractice(confirmed) && confirmed.asOf === '2026-05-01', 'approving confirms it');
family = families.setStatus(family, nias[0].id, 'approved', now11);
family = families.updatePerson(family, { id: 'nia', name: 'Nia R.', relationship: 'granddaughter' });
assert.ok(family.cards.filter((c) => c.personId === 'nia').every((c) => c.status === 'approved'), 'a new name keeps approvals');
family = families.updatePerson(family, { id: 'nia', name: 'Nia R.', relationship: 'grandchild' });
assert.ok(family.cards.filter((c) => c.personId === 'nia').every((c) => c.status === 'pending' && !c.confirmedAt), 'a new relationship sends facts back');
family = families.editCard(family, 'hal-0', fact('memory', 'is a baker who loves birdwatching'));
assert.equal(family.cards.find((c) => c.id === 'hal-0').status, 'pending', 'an edited fact waits for approval');
family = families.saveFacts(family, 'nia', [{ id: nias[1].id, ...fact('work', '') }, fact('food', 'mangoes')], nextId);
assert.deepEqual(family.cards.filter((c) => c.personId === 'nia').map((c) => c.text), ['loves to paint', 'mangoes'], 'saving adds, removes what was emptied, and leaves the rest');
const nicks = family.cards.find((c) => c.text === 'loves to paint').id;
family = families.saveFacts(family, 'nia', [{ id: nicks, ...fact('memory', 'loves to paint'), photoUri: 'file:///kept.jpg' }], nextId);
assert.equal(family.cards.find((c) => c.id === nicks).photoUri, 'file:///kept.jpg', 'a memory keeps its photo');
assert.equal(family.cards.find((c) => c.id === nicks).status, 'pending');
family = families.setStatus(family, nicks, 'approved', now11);
family = families.saveFacts(family, 'nia', [{ id: nicks, ...fact('memory', 'loves to paint'), photoUri: null }], nextId);
assert.equal(family.cards.find((c) => c.id === nicks).photoUri, undefined, 'and can lose it');
assert.equal(family.cards.find((c) => c.id === nicks).status, 'approved', 'a picture alone needs no approval');
family = families.editCard(family, nicks, fact('memory', 'loves to draw'));
family = families.setFactHints(family, 'nia', family.cards.filter((c) => c.personId === 'nia').map((c) => c.id));
assert.ok(family.cards.filter((c) => c.personId === 'nia').every((c) => c.hintOk === false), 'facts can be left out of hints');
assert.equal(family.people.find((p) => p.id === 'nia').hints.fact, false, 'with none left, the fact hint turns off');
family = families.setFactHints(family, 'nia', []);
assert.equal(family.people.find((p) => p.id === 'nia').hints.fact, true);
family = families.setProfile(family, 'nia', { step: 3, bestClue: 'laugh' });
family = families.setProfile(family, 'nia', { step: 5 });
assert.deepEqual([family.people.find((p) => p.id === 'nia').profileStep, family.people.find((p) => p.id === 'nia').bestClue], [5, 'laugh'], 'each part of the profile saves alone');
family = families.setProfile(family, 'nia', { bestClue: null });
assert.equal(family.people.find((p) => p.id === 'nia').bestClue, undefined);

const { readFileSync, readdirSync, statSync } = await import('node:fs');
const inRepo = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
// Without the gitignored local deck, the example deck is the sample people alone, with no error.
const exampleDeckCode = inRepo('src/data/example-deck.ts');
assert.ok(/if \(!localFiles \|\| !localFiles\.keys\(\)\.length\) return \[\];/.test(exampleDeckCode) && /Array\.isArray\(people\) \? \(people as Person\[\]\) : \[\]/.test(exampleDeckCode), 'a missing or malformed local deck falls back to the sample deck');
const walkFiles = (dir) =>
  readdirSync(new URL(`../${dir}`, import.meta.url)).flatMap((name) => {
    const path = `${dir}/${name}`;
    return statSync(new URL(`../${path}`, import.meta.url)).isDirectory() ? walkFiles(path) : [path];
  });

// The 100% gate: only a complete profile joins the deck, and a draft has no way into practice
const hasPicture = (person) => ({ ...person, hasPhoto: Boolean(person.deckPhoto || person.samplePortrait || person.photoUri) });
const gated = () => {
  let start = families.addPerson(families.EMPTY_FAMILY, { id: 'd', name: 'Dee', relationship: 'friend', photoUri: 'file:///d.jpg' }, [fact('memory', 'loves to swim')], nextId);
  start = families.addPerson(start, { id: 'in1', name: 'Ann', relationship: 'mom', photoUri: 'file:///a.jpg' }, [fact('interest', 'golf'), fact('shared', 'went fishing')], nextId);
  start = families.addPerson(start, { id: 'in2', name: 'Bo', relationship: 'dad', photoUri: 'file:///b.jpg' }, [fact('interest', 'chess'), fact('shared', 'built a shed')], nextId);
  for (const card of start.cards) start = families.setStatus(start, card.id, 'approved', now11);
  return start;
};
let gate = gated();
const percentOf = (f, id) => profile.profileCompletion(hasPicture(f.people.find((p) => p.id === id)), f.cards.filter((c) => c.personId === id));
assert.equal(percentOf(gate, 'd'), 63, 'a draft from the first screen: three required answers and its one fact');
const onlyDraft = families.removePerson(families.removePerson(gate, 'in1'), 'in2');
assert.deepEqual(profile.deckOf(onlyDraft.people, onlyDraft.cards, hasPicture), { people: [], cards: [] }, 'drafts never reach practice, however approved their facts');
gate = families.addToDeck(gate, 'd', hasPicture);
assert.ok(!gate.people.find((p) => p.id === 'd').inDeck, 'the gate refuses below 100%');
gate = families.settleDeck(gate, hasPicture);
assert.deepEqual(gate.people.filter((p) => p.inDeck).map((p) => p.id), ['in1', 'in2'], 'every complete person is in the deck, with nothing to tap');
assert.deepEqual(profile.deckChanges(gate.people, gate.cards, hasPicture), { join: [], leave: [] }, 'and then nothing is out of step');

// Drafts never appear in practice, hints or the person's screens
const deckNow = profile.deckOf(gate.people, gate.cards, hasPicture);
assert.deepEqual(deckNow.people.map((p) => p.id), ['in1', 'in2'], 'what the person home and Practice more list');
assert.ok(!deckNow.cards.some((c) => c.personId === 'd'), 'no card of a draft');
const asCard = (c) => { const who = deckNow.people.find((p) => p.id === c.personId); return { id: c.id, personId: who.id, answer: who.name, relationship: who.relationship, hints: ALL_HINTS, phrasings: plain, fact: { type: c.type, text: c.text, timeSensitive: false } }; };
const deckRounds = makeRounds(deckNow.cards.map(asCard), deckNow.cards.map(asCard));
for (const round of deckRounds) {
  assert.ok(!round.choices.includes('Dee'), 'a draft is never offered as one of the names');
  for (const misses of [1, 2, 3, 4]) assert.ok(!JSON.stringify(stories.hintAt(round, misses)).includes('swim'), 'a draft fact is never a hint');
}
// A person in the deck who drops below 100% goes back to being a draft
const below = families.saveFacts(gate, 'in1', gate.cards.filter((c) => c.personId === 'in1' && c.type === 'interest').map((c) => ({ id: c.id, ...fact('interest', '') })), nextId);
assert.deepEqual(profile.deckChanges(below.people, below.cards, hasPicture).leave, ['in1']);
assert.ok(!profile.deckOf(below.people, below.cards, hasPicture).people.some((p) => p.id === 'in1'), 'practice drops them at once');
assert.ok(!families.settleDeck(below, hasPicture).people.find((p) => p.id === 'in1').inDeck, 'and they are a draft again');
assert.equal(families.settleDeck(gate, hasPicture), gate, 'nothing to settle changes nothing');
const noLongerApproved = families.setStatus(gate, gate.cards.find((c) => c.personId === 'in2').id, 'skipped', now11);
assert.equal(profile.deckOf(noLongerApproved.people, noLongerApproved.cards, hasPicture).cards.length, deckNow.cards.length - 1, 'approval still decides each card');

// One capitalization: sentence case, from one place, so it can't drift
const KEEPS_ITS_CAPITAL = new Set(['ID', 'PDF', 'Me', 'Evermore', 'Caregiver']);
function sentenceCase(text, where) {
  const words = text.replace(/[^\p{L}\p{N}\s’'-]/gu, ' ').trim().split(/\s+/).filter(Boolean);
  assert.ok(words.length === 0 || /^[\p{Lu}\p{N}]/u.test(words[0]), `${where}: "${text}" starts with a capital`);
  for (const word of words.slice(1)) assert.ok(!/^\p{Lu}/u.test(word) || KEEPS_ITS_CAPITAL.has(word), `${where}: "${text}" is sentence case, not Title Case`);
  assert.ok(!/[.:;,]$/.test(text), `${where}: "${text}" has no end punctuation`);
}
for (const section of q.SECTIONS) sentenceCase(section.title, 'a section');
for (const one of everyQuestion) {
  for (const key of ['label', 'short', 'more', 'behind', 'missing', 'heading']) if (one[key]) sentenceCase(one[key], `${one.id}.${key}`);
  for (const option of one.options ?? []) sentenceCase(option.label, `${one.id} option`);
}
for (const file of walkFiles('src').filter((path) => path.endsWith('.tsx'))) {
  for (const [, label] of inRepo(file).matchAll(/\b(?:label|title|backLabel)="([^"]+)"/g)) sentenceCase(label, file);
}
// What is shown of a value, never what is saved
assert.equal(q.displayValue('older sister'), 'Older sister', 'an all-lowercase value gets a capital for display');
assert.equal(q.displayValue('McDonald'), 'McDonald', 'mixed case stays exactly as typed');
assert.equal(q.displayValue('DeShawn'), 'DeShawn');
assert.equal(q.displayValue('a dog named Rex'), 'a dog named Rex', 'any capital means it was typed that way');
assert.equal(q.displayValue(''), '');
const summaryOf = (person, cards, step) => profile.sectionSummary(q.SECTIONS[step], person, cards);
assert.deepEqual(summaryOf({ relationship: 'older sister', hasPhoto: true }, [], 0).map((line) => line.text), ['Older sister'], 'on review too');
assert.deepEqual(summaryOf({ hasPhoto: true }, [savedCard('i', 'interest', 'birdwatching'), savedCard('j', 'interest', 'golf')], 4).map((line) => line.text), ['Birdwatching, Golf'], 'and for chips, typed or chosen');
assert.deepEqual(summaryOf({ hasPhoto: true }, [savedCard('t', 'team', 'the Otters')], 4).map((line) => line.text), ['the Otters'], 'free text stays as typed');
for (const one of everyQuestion) if (one.placeholder) assert.equal(one.placeholder, one.placeholder.trim(), `${one.id}: a tidy example`);
assert.ok(q.factHelp('home', 'June').includes('Ohio'), 'an example keeps its capital in the help line');
assert.ok(q.factHelp('team', 'June').includes('the Otters'));
assert.deepEqual(
  everyQuestion.filter((one) => one.properName).map((one) => one.id),
  ['nickname', 'calls', 'birthday', 'workplace', 'home', 'partner', 'child', 'team', 'show', 'movie', 'music', 'place'],
  'names and places get a capital per word from the keyboard',
);
assert.ok(inRepo('src/components/questionnaire.tsx').includes("autoCapitalize={question.properName ? 'words' : 'none'}"), 'read from the question');
const fixedWords = [...walkFiles('src')].filter((path) => !path.endsWith('.ts') || !path.includes('/theme/')).map(inRepo).join('\n');
assert.ok(!/could not (be|load)/.test(fixedWords.replace(/console\.warn\([^)]*\)/g, '')), 'one way to say it: couldn’t');

// Everyone complete is in the deck unless deselected
assert.equal(gate.people.find((p) => p.id === 'in1').includeInPractice, undefined, 'nothing set means included, so an older phone needs no change');
const leftOut = families.settleDeck(families.setIncluded(gate, 'in1', false), hasPicture);
assert.ok(!leftOut.people.find((p) => p.id === 'in1').inDeck, 'deselected: out of the deck');
assert.equal(percentOf(leftOut, 'in1'), 100, 'with their profile as it was');
assert.deepEqual(leftOut.cards.map((c) => c.id), gate.cards.map((c) => c.id), 'and every fact');
const deckWithout = profile.deckOf(leftOut.people, leftOut.cards, hasPicture);
assert.deepEqual(deckWithout.people.map((p) => p.id), ['in2'], 'skipped by practice');
assert.ok(!deckWithout.cards.some((c) => c.personId === 'in1'), 'no card of theirs');
assert.equal(profile.outOfDeckLabel(100), 'Not in practice', 'the People tab says so');
assert.equal(profile.outOfDeckLabel(60), 'Draft, 60% complete', 'a draft stays a draft');
const backIn = families.settleDeck(families.setIncluded(leftOut, 'in1', true), hasPicture);
assert.ok(backIn.people.find((p) => p.id === 'in1').inDeck, 'selected again, they are back at once');
assert.ok(families.addToDeck(leftOut, 'in1', hasPicture).people.find((p) => p.id === 'in1').includeInPractice, 'Add to practice on review does the same');
const leftOutDraft = families.settleDeck(families.setIncluded(gate, 'd', true), hasPicture);
assert.ok(!leftOutDraft.people.find((p) => p.id === 'd').inDeck, 'the toggle never lets a draft in: drafts stay out until finished');
const finishedLater = families.saveFacts(gate, 'd', [fact('interest', 'swimming'), fact('shared', 'swam in the lake')], nextId);
assert.ok(families.settleDeck(finishedLater, hasPicture).people.find((p) => p.id === 'd').inDeck, 'finishing a profile is all it takes');
const stillOut = families.settleDeck(families.saveFacts(families.setIncluded(gate, 'd', false), 'd', [fact('interest', 'swimming'), fact('shared', 'swam in the lake')], nextId), hasPicture);
assert.ok(!stillOut.people.find((p) => p.id === 'd').inDeck, 'unless they were deselected first');
const schemaWords = inRepo('supabase/schema.sql');
assert.ok(/include_in_practice boolean not null default true/.test(schemaWords), 'on by default on the server too');

// Required questions: which they are, and how each step marks them
const requiredIds = ['name', 'photo', 'relationship', 'interest', 'shared'];
assert.deepEqual(everyQuestion.filter((one) => one.required).map((one) => one.id), requiredIds, 'the asterisk goes on exactly the required questions');
assert.ok(everyQuestion.every((one) => (one.required ? one.missing : !one.missing)), 'each required question says how review names it, and no other does');
assert.equal(q.REQUIRED_MARK, '*');
assert.equal(q.REQUIRED_LEGEND, 'Required');
const formCode = inRepo('src/components/questionnaire.tsx') + inRepo('src/components/caregiver-ui.tsx') + inRepo('src/components/choices.tsx');
assert.equal(formCode.split('<RequiredLegend />').length - 1, 1, 'the legend sits in the one place every step of questions goes through');
assert.ok(!/Colors\.accent\b/.test(formCode.slice(formCode.indexOf('function Asterisk'), formCode.indexOf('function RequiredLegend'))), 'the asterisk is text, so never the yellow that can not be read on white');

// "Not applicable": only on required questions where an empty answer is legitimate
assert.equal(q.NOT_APPLICABLE, 'Not applicable');
assert.deepEqual(everyQuestion.filter(q.canNotApply).map((one) => one.id), ['photo', 'relationship', 'interest', 'shared'], 'never on the name, and never on an optional question');
for (const one of everyQuestion.filter((other) => !other.required)) assert.ok(!q.canNotApply(one), `${one.id}: optional, so no way out is needed`);
const wordsEverywhere = [...walkFiles('src'), 'README.md'].map(inRepo).join('\n');
assert.ok(!/do not fill out/i.test(wordsEverywhere), 'the phrase is never used');
assert.ok(!/doesn.t apply/i.test(wordsEverywhere), 'the old wording is gone');
const staleMark = { name: 'Nell', hasPhoto: true, relationship: 'friend', notApplicable: ['pet'] };
assert.deepEqual(profile.sectionSummary(q.SECTIONS[3], staleMark, []), [], 'a mark saved on an optional question by an earlier release shows nowhere');
assert.equal(profile.profileCompletion(staleMark, []), 60, 'and counts for nothing');

// "Not applicable" counts toward 100%, creates no fact, and shows on review
const noneYet = { id: 'n', name: 'Nell', notApplicable: [] };
const allMarks = ['photo', 'relationship', 'interest', 'shared'];
const marked = { name: 'Nell', hasPhoto: false, notApplicable: allMarks };
assert.equal(profile.profileCompletion({ ...noneYet, hasPhoto: false }, []), 20);
assert.equal(profile.profileCompletion(marked, []), 100, '"Not applicable" reaches 100%');
assert.deepEqual(profile.missingItems(marked, []), []);
let markFamily = families.addPerson(families.EMPTY_FAMILY, { id: 'n', name: 'Nell' }, [], nextId);
markFamily = families.setProfile(markFamily, 'n', { notApplicable: allMarks });
assert.equal(markFamily.cards.length, 0, 'and creates no fact');
assert.equal(percentOf(markFamily, 'n'), 100);
markFamily = families.addToDeck(markFamily, 'n', hasPicture);
assert.ok(markFamily.people[0].inDeck, 'it opens the gate like an answer');
assert.deepEqual(profile.sectionSummary(q.SECTIONS[4], marked, []), [{ label: 'Hobby', text: 'Not applicable' }], 'it shows on the review step');
assert.deepEqual(profile.sectionSummary(q.SECTIONS[0], marked, []).map((line) => line.label), ['Photo', 'Relationship']);
assert.deepEqual(profile.sectionSummary(q.SECTIONS[4], marked, [savedCard('i', 'interest', 'golf')]).map((line) => line.text), ['Golf'], 'an answer takes its place');
assert.equal(families.setProfile(markFamily, 'n', { step: 2 }).people[0].notApplicable.length, 4, 'other profile changes leave the marks alone');

// Test data: flagged, on the phone only, and gone in one tap
const { TEST_DATA } = await import('@/data/test-data');
const everyone = (f) => f.people.map((p) => percentOf(f, p.id));
const copied = families.seedFamily(families.EMPTY_FAMILY, exampleDeck);
assert.equal(copied.people.length, 12, 'the deck: 7 stand-ins for real people and the 5 sample people');
const realCards = copied.cards.map((c) => [c.id, c.text]);
let tested = families.seedTestData(copied, TEST_DATA);
assert.equal(tested.people.length, 12, 'test data adds nobody: the sample people are in the deck');
assert.ok(everyone(tested).every((percent) => percent === 100), 'everyone reaches 100%');
assert.ok(tested.people.every((p) => p.inDeck), 'everyone joins the deck');
assert.deepEqual(tested.cards.filter((c) => !c.testData && copied.cards.some((o) => o.id === c.id)).map((c) => [c.id, c.text]), realCards, 'the real cards stay exactly as written');
const invented = tested.cards.filter((c) => c.testData);
assert.equal(invented.length, 7 * 2, 'every invented answer about a real person is flagged');
assert.ok(invented.every((c) => c.id.startsWith('test-') && c.status === 'pending'), 'and waits for approval like any new fact');
const realIds = exampleDeck.filter((person) => !TEST_DATA.samples.some((sample) => sample.id === person.id)).map((person) => person.id);
assert.equal(realIds.length, 7);
const realInvented = invented.filter((c) => realIds.includes(c.personId));
assert.equal(realInvented.length, invented.length, 'and only those');
const sampleIds = TEST_DATA.samples.map((sample) => sample.id);
const sampleFacts = tested.cards.filter((c) => c.id.startsWith('sample-'));
assert.equal(sampleFacts.length, 5 * 4, 'the sample people have their invented answers as ordinary facts');
assert.ok(sampleFacts.every((c) => sampleIds.includes(c.personId) && !c.testData && c.status === 'pending'), 'unflagged, and waiting for approval like any new fact');
assert.ok(!tested.cards.some((c) => sampleIds.includes(c.personId) && c.id.startsWith('test-')), 'no sample person has a test id');
assert.deepEqual([...new Set(realInvented.map((c) => c.type))].sort(), ['interest', 'shared'], 'only the extra questions, for real people');
assert.ok(realInvented.every((c) => c.text.includes('(test data)')), 'in words nobody could take for a true statement');
const wordsOfTest = JSON.stringify(TEST_DATA);
assert.ok(!/medical|doctor|hospital|diagnos|illness|medicine|money|bank|salary|debt|religio|divorc|died|death/i.test(wordsOfTest), 'nothing medical, financial or sensitive');
assert.ok(!profile.deckOf(tested.people, tested.cards, hasPicture).cards.some((c) => c.testData), 'unapproved test facts stay out of practice like any other');
const noRelationshipPerson = tested.people.find((p) => !p.relationship);
assert.deepEqual([noRelationshipPerson.notApplicable, noRelationshipPerson.testMarks], [['relationship'], ['relationship']], 'no relationship is invented: a flagged mark stands in');
assert.equal(families.seedTestData(tested, TEST_DATA), tested, 'copied in once');
assert.ok(families.hasTestData(tested));

// It fills gaps, and leaves people alone
const ownPerson = families.addPerson(copied, { id: 'mine', name: 'Mine', relationship: 'friend' }, [], nextId);
assert.ok(!families.seedTestData(ownPerson, TEST_DATA).cards.some((c) => c.personId === 'mine'), 'someone the caregiver added is left alone');
assert.ok(!families.seedTestData(ownPerson, TEST_DATA).people.find((p) => p.id === 'mine').inDeck);
const noraAnswered = families.saveFacts(copied, 'nora', [fact('interest', 'dancing')], nextId);
assert.deepEqual(families.seedTestData(noraAnswered, TEST_DATA).cards.filter((c) => c.personId === 'nora' && c.testData).map((c) => c.type), ['shared'], 'only what is missing');
assert.ok(!families.seedTestData(families.removePerson(copied, 'june'), TEST_DATA).people.some((p) => p.id === 'june'), 'someone removed does not come back');

// A fact stops being test data once the caregiver changes its words
const testFact = invented.find((c) => c.personId === 'nora' && c.type === 'interest');
const sameWords = families.saveFacts(tested, 'nora', [{ id: testFact.id, ...fact('interest', testFact.text) }], nextId);
assert.ok(sameWords.cards.find((c) => c.id === testFact.id).testData, 'saving a step again keeps the flag');
const marksChange = families.saveFacts(tested, 'nora', [{ id: testFact.id, ...fact('interest', testFact.text, { year: 1990 }) }], nextId);
assert.ok(marksChange.cards.find((c) => c.id === testFact.id).testData, 'other changes to it do too');
const ownWords = families.editCard(tested, testFact.id, fact('interest', 'roses'));
assert.ok(!ownWords.cards.find((c) => c.id === testFact.id).testData, 'the caregiver\'s own words are no test data');
assert.ok(families.clearTestData(ownWords).cards.some((c) => c.id === testFact.id), 'and stay when test data is cleared');

// Clear test data restores the real percentages
const cleared = families.clearTestData(tested);
assert.ok(!cleared.cards.some((c) => c.testData) && !families.hasTestData(cleared), 'every test fact and mark goes');
const realPercents = (person) => percentOf(cleared, person.id);
// Each real person has their one deck fact: an optional answer, 3 more.
const expectedPercent = (person) => (sampleIds.includes(person.id) ? 100 : person.relationship ? 63 : 43);
assert.deepEqual(cleared.people.map(realPercents), cleared.people.map(expectedPercent), 'real people back to name, photo and relationship (and their one fact); sample people stay complete');
assert.equal(percentOf(cleared, noRelationshipPerson.id), 43, 'the flagged mark goes too');
assert.deepEqual(cleared.cards.map((c) => c.id), tested.cards.filter((c) => !c.testData).map((c) => c.id), 'the real cards stay');
const settled = families.settleDeck(cleared, hasPicture);
assert.deepEqual(settled.people.filter((p) => p.inDeck).map((p) => p.id).sort(), [...sampleIds].sort(), 'below 100%, every real person is a draft again');
const deckAfterClearing = profile.deckOf(settled.people, settled.cards, hasPicture);
assert.deepEqual(deckAfterClearing.people.map((p) => p.id).sort(), [...sampleIds].sort(), 'practice keeps only the sample people');
assert.ok(settled.cards.filter((c) => c.id.startsWith('sample-')).length === 5 * 4, 'with their facts');
assert.equal(families.seedTestData(settled, TEST_DATA), settled, 'and clearing is for good');
const ownMark = families.setProfile(tested, noRelationshipPerson.id, { notApplicable: [] });
assert.deepEqual(ownMark.people.find((p) => p.id === noRelationshipPerson.id).testMarks, [], 'an undone mark is no longer test data');
const keptReal = families.clearTestData(families.setProfile(tested, 'nora', { notApplicable: ['photo'] }));
assert.deepEqual(keptReal.people.find((p) => p.id === 'nora').notApplicable, ['photo'], 'the caregiver\'s own marks stay');

// A failed photo link can't drop someone from the deck
const { hasPhoto, profileOf } = await import('@/lib/photo-fields');
assert.ok(!hasPhoto({ photoPath: 'a/b.jpg' }), 'with no link there is nothing to show');
assert.ok(profileOf({ name: 'Ann', photoPath: 'a/b.jpg' }).hasPhoto, 'but the saved photo still counts toward 100%');
assert.ok(!profileOf({ name: 'Ann' }).hasPhoto);
assert.ok(profileOf({ name: 'Ann', samplePortrait: 'june' }).hasPhoto);

// Test data is never sent: the guards, the outbox and the schema
const someTest = [{ id: 'a', ...fact('food', 'lasagna') }, { id: 'b', ...fact('food', 'soup'), testData: true }];
assert.deepEqual(facts.withoutTestData(someTest).map((d) => d.id), ['a'], 'a flagged draft is held back from the server');
assert.ok(!facts.sendable({ row: { card_id: invented[0].id } }), 'a practice change about a test fact is never queued');
assert.ok(facts.sendable({ row: { card_id: 'a-real-card' } }));
assert.ok(facts.withoutTestData(tested.cards).every((c) => !realInvented.some((test) => test.id === c.id)), 'no real person\'s test fact gets through');
assert.deepEqual(facts.withoutTestData(sampleFacts), sampleFacts, 'a sample person\'s fact is an ordinary fact to the guards');
assert.ok(sampleFacts.every((c) => facts.sendable({ row: { card_id: c.id } })), 'and its practice changes may be sent');

// A phone seeded when sample people's facts were test data
const oldId = (id) => id.replace(/^sample-/, 'test-');
const oldFamily = { ...tested, cards: tested.cards.map((c) => (c.id.startsWith('sample-') ? { ...c, id: oldId(c.id), testData: true } : c)) };
const released = families.releaseSampleFacts(oldFamily, sampleIds);
assert.deepEqual(released.cards.map((c) => [c.id, c.text, c.status, Boolean(c.testData)]), tested.cards.map((c) => [c.id, c.text, c.status, Boolean(c.testData)]), 'their facts become ordinary, in place; real people\'s stay flagged');
assert.equal(families.releaseSampleFacts(released, sampleIds), released, 'once');
const { renameCards } = await import('@/lib/local-practice');
const sampleCard = oldId(sampleFacts[0].id);
const realCard = realInvented[0].id;
const scheduled = { step: 3, dueAt: 'soon', updatedAt: 'then' };
const moved = renameCards({ schedule: { [sampleCard]: scheduled, [realCard]: scheduled }, finished: [{ cardId: sampleCard, at: 'then' }] }, (id) => facts.sampleIdFrom(id, sampleIds));
assert.deepEqual(moved.schedule, { [sampleFacts[0].id]: scheduled, [realCard]: scheduled }, 'their place in the schedule goes with them');
assert.deepEqual(moved.finished, [{ cardId: sampleFacts[0].id, at: 'then' }], 'and the week\'s count');
assert.ok(facts.sendable({ row: { id: 'session-1' } }), 'sessions are about no card');
assert.ok(profile.entryFrom(q.questionFor('interest'), testFact).testData, 'the form carries the flag, so the guard sees it');
assert.ok(profile.toDrafts([profile.entryFrom(q.questionFor('interest'), testFact)], now11)[0].testData);
const serverWords = inRepo('supabase/schema.sql');
assert.ok(!/test_data|test data|\(test/i.test(serverWords), 'the schema has no test data column and seeds none');
for (const sample of TEST_DATA.samples) for (const { text } of sample.facts) assert.ok(!serverWords.includes(text), `"${text}" does not seed the server`);
const serverStore = inRepo('src/data/family-store.ts');
assert.ok(serverStore.includes('withoutTestData(allDrafts)') && serverStore.includes('withoutTestData(facts)'), 'both ways facts reach the server hold test data back');
assert.ok(!/test-data/.test(serverStore) && !/test-data/.test(inRepo('src/data/practice-store.ts')), 'the server stores never read the test data');
assert.ok(!/test-data|testData/.test(inRepo('src/lib/variants.ts')), 'and nothing feeds it to AI');

// Practice on the phone when sign-in is off: completion only, and old days drop away
const local = await import('@/lib/local-practice');
let state = local.emptyPractice(now);
state = local.startSession(state, 's1', now, 5);
assert.equal(local.startSession(state, 's1', now, 5), state, 'starting the same session twice changes nothing');
let finished = local.finishCard(state, 's1', 'c1', missed, now);
assert.equal(finished.step, 0, 'a hint keeps a new card at step 0');
finished = local.finishCard(finished.state, 's1', 'c2', clean, now);
assert.equal(finished.step, 1);
state = local.endSession(finished.state, 's1', now);
assert.equal(state.sessions[0].cardsCompleted, 2);
assert.ok(state.sessions[0].completedAt);
assert.deepEqual(Object.keys(state.schedule).sort(), ['c1', 'c2']);
assert.ok(!JSON.stringify(state).includes('tries') && !JSON.stringify(state).includes('hint'), 'how a card went is not kept');
const old = { ...state, sessions: [...state.sessions, { ...state.sessions[0], id: 'old', startedAt: at(-40, 10), studyDay: undefined }], finished: [...state.finished, { cardId: 'c9', at: at(-9, 10) }] };
const kept = local.pruned(old, now);
assert.deepEqual(kept.sessions.map((s) => s.id), ['s1'], 'sessions older than 31 days go');
assert.deepEqual(kept.finished.map((f) => f.cardId), ['c1', 'c2'], 'finished cards older than 8 days go');
const view = local.localActivity({ ...state, finished: [...state.finished, { cardId: 'c3', at: at(-7, 10) }] }, now);
assert.deepEqual(view.weekCardIds, ['c1', 'c2'], 'the week is the last 7 days, today included');
assert.equal(view.sessions.length, 1);

// The day's practice: a real study session, computed from the deck
const sessions5 = await import('@/lib/session');
const pacing = await import('@/config/schedule');
const { sentenceKey, dailyTarget, planToday, planMore, planPerson, reaskSpot, reviewPass, askedAgain, nextTapCounts, estimatedMinutes, todayLine, minutesLabel, logAsked, askedOn, cardsOf, spacingIn } = sessions5;

let seedDay = 11;
const dayRandom = () => ((seedDay = (seedDay * 48271) % 2147483647) / 2147483647);
const FACT_KINDS = ['work', 'team', 'food', 'interest', 'memory', 'shared', 'home', 'pet'];
const personWords = (i, f) => `thing ${i} ${f}`;
function deckFor(sizes, { photos = true, off = [] } = {}) {
  const people = sizes.map((_, i) => ({ id: `p${i}`, name: `Name${i}`, relationship: `rel${i}`, samplePortrait: photos ? 'x' : undefined }));
  const cards = sizes.flatMap((facts, i) =>
    Array.from({ length: facts }, (_, f) => ({ id: `p${i}-${f}`, personId: `p${i}`, sentence: '', phrasingsOff: off, fact: fact(FACT_KINDS[f % FACT_KINDS.length], personWords(i, f)) })),
  );
  return cardsOf(people, cards);
}
const twelve = deckFor(Array(12).fill(3));
const plain12 = { schedule: {}, now, completed: 0, asked: [], random: dayRandom };
const distinctKeys = (cards) => cards.map((c) => sentenceKey(c.personId, c.phrasings[0]));
function spacing(order) {
  const last = new Map();
  let smallest = Infinity;
  order.forEach((id, i) => {
    if (last.has(id)) smallest = Math.min(smallest, i - last.get(id));
    last.set(id, i);
  });
  return smallest;
}
const roundsOf = (cards, deck) => stories.makeRounds(cards, deck, {}, dayRandom);

// Session length: about 2, 3 or 5 questions per person
assert.equal(dailyTarget(twelve, 'short'), 24, 'Short: 2 per person');
assert.equal(dailyTarget(twelve, 'standard'), 36, 'Standard: 3 per person');
assert.equal(dailyTarget(twelve, 'long'), 60, 'Long: 5 per person');
assert.equal(dailyTarget(twelve), 36, 'Standard is the default');
assert.equal(pacing.DEFAULT_SESSION_LENGTH, 'standard');
const sized = (n) => deckFor(Array(n).fill(4));
assert.equal(dailyTarget(sized(14), 'standard'), 42, 'the target grows with the deck');
assert.equal(dailyTarget(sized(5), 'standard'), 36, 'a small deck still gets a meaningful day');
assert.equal(dailyTarget(sized(5), 'short'), 20);
assert.equal(dailyTarget(sized(40), 'standard'), 45, 'a large deck stays near 12 minutes');
assert.equal(dailyTarget(sized(40), 'long'), 75);
assert.equal(dailyTarget([], 'standard'), 0, 'no deck, no target');
assert.equal(dailyTarget(deckFor([1, 1]), 'standard'), 10, 'capped at the questions there are, never repeats: 1 fact each, 5 ways');
assert.equal(dailyTarget(deckFor([4]), 'standard'), 0, 'one person alone has nothing to choose between, so no day');

// The estimate is an explicit number: cards times average time per card
const { read, choose, readBack, moveOn } = pacing.CARD_SECONDS;
assert.equal(pacing.SECONDS_PER_CARD, read + choose + readBack + moveOn, 'a documented average: the parts of a card, added up');
assert.equal(pacing.SECONDS_PER_CARD, 14);
assert.equal(estimatedMinutes(36), 8, '36 cards is about 8 minutes');
assert.equal(estimatedMinutes(24), 6);
assert.equal(estimatedMinutes(60), 14);
assert.equal(estimatedMinutes(1), 1, 'never "about 0 minutes"');
assert.equal(estimatedMinutes(0), 0);
assert.equal(minutesLabel(1), 'About 1 minute');
assert.equal(todayLine(36, 0), 'About 8 minutes today', 'the calm line');
assert.equal(todayLine(36, 18), 'About 4 minutes left today', 'what is left, on the way');
assert.equal(todayLine(36, 36), undefined, 'nothing once it is done');
assert.equal(todayLine(0, 0), undefined);
for (const length of ['short', 'standard', 'long']) assert.ok(estimatedMinutes(dailyTarget(twelve, length)) >= 5, `${length}: at least about 5 minutes at a normal pace`);
const standardMinutes = (n) => estimatedMinutes(dailyTarget(deckFor(Array(n).fill(4)), 'standard'));
for (const n of [4, 6, 8, 10, 12, 13, 15, 20, 30]) assert.ok(standardMinutes(n) >= 8 && standardMinutes(n) <= 12, `Standard with ${n} people: ${standardMinutes(n)} minutes`);
const standardDayMinutes = (dailyTarget(twelve, 'standard') * pacing.SECONDS_PER_CARD) / 60;
assert.ok(standardDayMinutes >= 8 && standardDayMinutes <= 12, `a Standard day for 12 people, before rounding: ${standardDayMinutes} minutes`);
assert.ok(dailyTarget(twelve, 'short') < dailyTarget(twelve, 'standard') && dailyTarget(twelve, 'standard') < dailyTarget(twelve, 'long'), 'the three lengths stay in order');
assert.deepEqual(pacing.SESSION_LENGTH_CHOICES.map((choice) => choice.label), ['Short', 'Standard', 'Long'], 'the settings keep their names');

// Every question different, different facts first, in different shapes
const day = planToday({ ...plain12, deck: twelve, goal: 36 });
assert.equal(day.length, 36);
assert.equal(new Set(distinctKeys(day)).size, 36, 'no sentence twice in a day');
for (const person of Array.from({ length: 12 }, (_, i) => `p${i}`)) {
  const theirs = day.filter((c) => c.personId === person);
  assert.equal(theirs.length, 3, 'each person gets their share');
  assert.equal(new Set(theirs.map((c) => c.id)).size, 3, 'from different facts');
  assert.equal(new Set(theirs.map((c) => c.phrasings[0].kind)).size, 3, 'and in different shapes');
}
assert.ok(spacing(day.map((c) => c.personId)) >= 4, 'the same person\'s cards are at least 4 apart');
const firstRound = day.slice(0, 12).map((c) => c.personId);
const secondRound = day.slice(12, 24).map((c) => c.personId);
assert.notDeepEqual(firstRound, secondRound, 'people do not come round in the same order');
const oneFactEach = planToday({ ...plain12, deck: deckFor([1, 1, 1, 1, 1, 1]), goal: dailyTarget(deckFor([1, 1, 1, 1, 1, 1]), 'standard') });
assert.ok(new Set(distinctKeys(oneFactEach)).size === oneFactEach.length, 'one fact each: its ways of asking, none twice');
assert.deepEqual(new Set(oneFactEach.filter((c) => c.phrasings[0].kind === 'photo').map((c) => sentenceKey(c.personId, c.phrasings[0]))).size, oneFactEach.filter((c) => c.phrasings[0].kind === 'photo').length, '"Who is this?" at most once per person');

// A person with too few questions is capped, and the others fill in
const capped = deckFor([1, 4, 4, 4, 4, 4], { off: ['my-rel', 'name', 'ask', 'who'] });
assert.equal(new Set(distinctKeys(planToday({ ...plain12, deck: capped, goal: dailyTarget(capped, 'short') }))).size, dailyTarget(capped, 'short'));
const shortOn = deckFor([3, 3, 3, 3, 3], { off: ['name', 'ask', 'who', 'favorite'] });
const shortDay = planToday({ ...plain12, deck: shortOn, goal: dailyTarget(shortOn, 'standard') });
assert.equal(new Set(distinctKeys(shortDay)).size, shortDay.length, 'filled with what is left, never repeats');
const lopsided = deckFor([1, 8, 8, 8, 8], { off: [] });
const lopsidedDay = planToday({ ...plain12, deck: lopsided, goal: dailyTarget(lopsided, 'short') });
assert.ok(lopsidedDay.filter((c) => c.personId === 'p0').length <= 5, 'someone with one fact gives what it has');
assert.equal(lopsidedDay.length, dailyTarget(lopsided, 'short'), 'and the others make up the day');
assert.equal(dailyTarget(deckFor([30, 1]), 'standard'), 11, 'two people: as many as can stay apart, never back to back');

// Due first, then new
const dueDeck = deckFor(Array(6).fill(2));
const dueSchedule = Object.fromEntries(dueDeck.filter((c) => c.id.endsWith('-0')).map((c) => [c.id, { step: 2, dueAt: at(-1) }]));
const dueDay = planToday({ ...plain12, deck: dueDeck, schedule: dueSchedule, goal: 12 });
const dueOrder = dueDay.map((c) => (dueSchedule[c.id] ? 'due' : 'new'));
assert.deepEqual(dueOrder.slice(0, 6), Array(6).fill('due'), 'everything due leads');
assert.deepEqual(dueOrder.slice(6), Array(6).fill('new'), 'then the new ones');
const laterDeck = deckFor(Array(5).fill(3));
const laterSchedule = Object.fromEntries(laterDeck.map((c) => [c.id, { step: 3, dueAt: at(2) }]));
assert.equal(planToday({ ...plain12, deck: laterDeck, schedule: laterSchedule, goal: 15 }).length, 15, 'cards not due yet fill the day, so it is always reachable');

// Any deck at all: no repeats, kept apart, the target met
const everySize = [];
for (let run = 0; run < 400; run++) {
  const people = 1 + Math.floor(dayRandom() * 24);
  const sizes = Array.from({ length: people }, () => 1 + Math.floor(dayRandom() * 6));
  const off = dayRandom() < 0.3 ? ['photo', 'who'] : [];
  const deck = deckFor(sizes, { photos: dayRandom() < 0.8, off });
  const length = ['short', 'standard', 'long'][run % 3];
  const goal = dailyTarget(deck, length);
  const schedule = Object.fromEntries(
    deck.filter(() => dayRandom() < 0.6).map((c) => [c.id, { step: 1 + Math.floor(dayRandom() * 4), dueAt: at(Math.floor(dayRandom() * 7) - 3) }]),
  );
  const plan = planToday({ deck, schedule, now, goal, completed: 0, asked: [], random: dayRandom });
  assert.equal(plan.length, goal, `${people} people, ${length}: the plan meets the target`);
  assert.equal(new Set(distinctKeys(plan)).size, plan.length, 'no repeats in any deck');
  const apart = spacing(plan.map((c) => c.personId));
  if (people >= 4) assert.ok(apart >= 4, `${people} people: ${apart} apart`);
  else if (people >= 2) assert.ok(apart >= people, `${people} people: never back to back, ${apart} apart`);
  if (people >= 2) everySize.push(goal);
  else assert.equal(goal, 0, 'one person alone: no day');
}
assert.ok(Math.max(...everySize) <= 75 && Math.min(...everySize) >= 1);

// Stopping and resuming: nothing repeats, spacing holds, the day still adds up
for (let run = 0; run < 120; run++) {
  const people = 4 + Math.floor(dayRandom() * 12);
  const deck = deckFor(Array.from({ length: people }, () => 1 + Math.floor(dayRandom() * 4)));
  const goal = dailyTarget(deck, 'standard');
  let log;
  let done = [];
  while (done.length < goal) {
    const plan = planToday({ deck, schedule: {}, now, goal, completed: done.length, asked: askedOn(log, 'd1'), random: dayRandom });
    assert.ok(plan.length > 0, 'more to do');
    const stopAt = 1 + Math.floor(dayRandom() * plan.length);
    for (const card of plan.slice(0, stopAt)) {
      const phrasing = card.phrasings[0];
      log = logAsked(log, 'd1', { personId: card.personId, cardId: card.id, key: sentenceKey(card.personId, phrasing), kind: phrasing.kind });
      done.push(card);
    }
  }
  assert.equal(done.length, goal, 'a stopped day picks up exactly where it was');
  assert.equal(new Set(distinctKeys(done)).size, goal, 'with nothing asked twice across the stops');
  assert.ok(spacing(done.map((c) => c.personId)) >= 4, `kept apart across the stops (${people} people)`);
  assert.deepEqual(planToday({ deck, schedule: {}, now, goal, completed: goal, asked: askedOn(log, 'd1'), random: dayRandom }), [], 'nothing left once it is done');
}
{
  // A fact already asked waits behind the others, even if it has fallen due again by the resume
  const deck = deckFor(Array(6).fill(3));
  const firstHalf = planToday({ ...plain12, deck, goal: 18 }).slice(0, 6);
  let log;
  for (const card of firstHalf) log = logAsked(log, 'd1', { personId: card.personId, cardId: card.id, key: sentenceKey(card.personId, card.phrasings[0]), kind: card.phrasings[0].kind });
  const dueAgain = Object.fromEntries(firstHalf.map((c) => [c.id, { step: 1, dueAt: at(-1) }]));
  const rest = planToday({ ...plain12, deck, schedule: dueAgain, goal: 18, completed: 6, asked: askedOn(log, 'd1') });
  for (const person of Array.from({ length: 6 }, (_, i) => `p${i}`)) {
    const facts = [...firstHalf, ...rest].filter((c) => c.personId === person).map((c) => c.id);
    assert.equal(new Set(facts).size, 3, 'different facts first, across a resume');
  }
}
{
  // A card that came back just before a stop still counts for keeping people apart
  const deck = deckFor(Array(8).fill(3));
  const recent = ['p0', 'p1', 'p2'].map((personId) => ({ personId, cardId: `${personId}-0`, key: `x-${personId}`, kind: 'ask', extra: true }));
  const plan = planToday({ ...plain12, deck, goal: 24, asked: recent });
  const firstSeenAt = (id) => plan.findIndex((c) => c.personId === id);
  assert.ok(firstSeenAt('p2') >= 3 && firstSeenAt('p1') >= 2 && firstSeenAt('p0') >= 1, 'those people wait their turn');
}
assert.deepEqual(askedOn({ day: 'd1', asked: [{ personId: 'a', cardId: 'c', key: 'k', kind: 'ask' }] }, 'd2'), [], 'a new day starts clean');
assert.deepEqual(logAsked({ day: 'd1', asked: [{ personId: 'a', cardId: 'c', key: 'k', kind: 'ask' }] }, 'd2', { personId: 'b', cardId: 'd', key: 'j', kind: 'ask' }).asked.map((one) => one.key), ['j']);

// A full day with hints: the step-0 re-ask a few cards later, a short review pass at the end
function playDay(deck, goal, hintRate) {
  const start = planToday({ deck, schedule: {}, now, goal, completed: 0, asked: [], random: dayRandom });
  let rounds = roundsOf(start, deck);
  let index = 0;
  let reviewed = false;
  const hinted = [];
  const reasked = [];
  let counted = 0;
  while (index < rounds.length) {
    const card = rounds[index];
    if (!card.again) counted++;
    const needsHint = dayRandom() < hintRate;
    if (needsHint && !hinted.includes(card.id)) hinted.push(card.id);
    if (needsHint && !card.again && !reasked.includes(card.id)) {
      const spot = reaskSpot(rounds, index, spacingIn(deck), dayRandom);
      if (spot !== null) {
        reasked.push(card.id);
        rounds = [...rounds.slice(0, spot), askedAgain(card, rounds, deck, [], spot, 'reask', dayRandom), ...rounds.slice(spot)];
      }
    }
    if (index === rounds.length - 1 && !reviewed) {
      for (const round of reviewPass(rounds, hinted, reasked, spacingIn(deck))) rounds = [...rounds, askedAgain(round, rounds, deck, [], rounds.length, 'review', dayRandom)];
      reviewed = true;
    }
    index++;
  }
  return { rounds, counted };
}
for (let run = 0; run < 150; run++) {
  const people = 5 + Math.floor(dayRandom() * 12);
  const deck = deckFor(Array.from({ length: people }, () => 2 + Math.floor(dayRandom() * 3)));
  const goal = dailyTarget(deck, 'standard');
  const { rounds, counted } = playDay(deck, goal, 0.08 + dayRandom() * 0.3);
  assert.equal(counted, goal, 'cards that came back never count toward the day');
  assert.ok(spacing(rounds.map((r) => r.personId)) >= 4, 're-asks and the review pass keep people apart');
  const planned = rounds.filter((r) => !r.again);
  assert.equal(new Set(planned.map((r) => sentenceKey(r.personId, r.phrasing))).size, planned.length, 'no sentence twice, apart from the intentional re-ask');
  const reviews = rounds.filter((r) => r.again === 'review');
  assert.ok(reviews.length <= pacing.REVIEW_PASS.most, 'a short review pass');
  assert.ok(rounds.slice(-reviews.length || rounds.length).every((r) => !reviews.length || r.again === 'review'), 'at the very end');
  for (const [i, round] of rounds.entries()) {
    if (round.again !== 'reask') continue;
    const first = rounds.findIndex((r) => r.id === round.id);
    assert.ok(i - first >= 4, `a re-ask comes a few cards later (${i - first})`);
  }
}
const longReview = reviewPass(['a', 'b', 'c', 'd', 'e', 'f', 'g'].map((id) => ({ id, personId: id })), ['a', 'b', 'c', 'd', 'e', 'f', 'g'], [], 4);
assert.equal(longReview.length, pacing.REVIEW_PASS.most, 'the review pass stays short');
assert.deepEqual(reviewPass(['a', 'b', 'c'].map((id) => ({ id, personId: id })), [], [], 3), [], 'no hints, no review pass');
assert.deepEqual(reviewPass([{ id: 'x', personId: 'p' }], ['x'], [], 4), [], 'the last card of a day never comes straight back');
assert.deepEqual(reviewPass([{ id: 'x', personId: 'p' }], ['x'], [], sessions5.ONE_PERSON_SPACING).map((r) => r.id), ['x'], 'unless it is one person\'s own session');
assert.equal(spacingIn(twelve), 4, 'a session keeps the deck\'s spacing, however few people it has left');
assert.equal(spacingIn(deckFor([2, 2])), 2);
assert.equal(reaskSpot(Array.from({ length: 12 }, (_, i) => ({ personId: `p${i}` })), 11, 4, () => 0), null, 'not on the last card: the review pass may take it');
assert.equal(reaskSpot(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'].map((personId) => ({ personId })), 0, 4, () => 0), 4, 'after 3 other cards at the soonest');
assert.equal(reaskSpot(['a', 'b', 'c', 'd', 'a', 'e', 'f', 'g', 'h', 'i'].map((personId) => ({ personId })), 0, 4, () => 0), 8, 'moved on so it stays clear of their next card');
assert.equal(reaskSpot(['a', 'a', 'a', 'a', 'a'].map((personId) => ({ personId })), 0, sessions5.ONE_PERSON_SPACING, () => 0), 4, 'one person alone: after 3 others too, about a minute');
// Expanding gaps within a session: about 1, 2, 4 and 8 minutes, as cards at SECONDS_PER_CARD.
{
  const schedule = await import('@/config/schedule');
  assert.deepEqual(schedule.SAME_SESSION_MINUTES, [1, 2, 4, 8], 'the same-session gaps, in minutes (placeholders)');
  assert.deepEqual(schedule.SAME_SESSION_CARDS, schedule.SAME_SESSION_MINUTES.map((minutes) => Math.round((minutes * 60) / schedule.SECONDS_PER_CARD)), 'turned into cards at SECONDS_PER_CARD');
  assert.ok(schedule.SAME_SESSION_CARDS.every((gap, i) => i === 0 || gap > schedule.SAME_SESSION_CARDS[i - 1]), 'each gap longer than the one before');
  const long = Array.from({ length: 80 }, (_, i) => ({ personId: `p${i % 12}` }));
  const spots = schedule.SAME_SESSION_CARDS.map((_, gap) => reaskSpot(long, 0, 4, () => 0, gap));
  assert.ok(spots.every((spot, i) => spot !== null && (i === 0 || spot > spots[i - 1])), `each gap lands later in the session: ${spots}`);
  assert.ok(spots.every((spot, i) => spot - 0 >= schedule.SAME_SESSION_CARDS[i]), 'at least the gap\'s cards later');
  assert.equal(reaskSpot(long, 0, 4, () => 0, schedule.SAME_SESSION_CARDS.length), null, 'past the last gap, nothing more');
  assert.equal(reaskSpot(long.slice(0, 20), 0, 4, () => 0, 3), null, 'a gap past the end of the session ends the series');
  assert.ok(schedule.SAME_SESSION_MOST >= 1 && schedule.SAME_SESSION_MOST <= 12, 'a ceiling on cards that come back');
  const practice = inRepo('src/components/practice-screen.tsx');
  assert.ok(/cameBack >= SAME_SESSION_MOST/.test(practice) && /reaskSpot\(rounds, index, apart, Math\.random, gap\)/.test(practice), 'the practice screen walks the gaps, with the ceiling');
  assert.ok(/firstTryCorrect\(result\) \? \(gaps\[card\.id\] \?\? 0\) \+ 1 : 0/.test(practice), 'a first-try answer moves to the next gap, another hint starts again');
  assert.ok(!/\b(REASK_AFTER_CARDS|SAME_SESSION_MINUTES)\b/.test(walkFiles('src').filter((path) => path !== 'src/config/schedule.ts').map(inRepo).join('\n')), 'the gaps live only in src/config/schedule.ts');
}

// Next story is there the moment the right name is chosen
assert.ok(pacing.NEXT_TAP_GUARD_MS >= 300 && pacing.NEXT_TAP_GUARD_MS <= 400, 'the guard is only the length of a stray tap');
assert.ok(!nextTapCounts(1000, 1000), 'the tap that chose the name does not count');
assert.ok(!nextTapCounts(1000, 1000 + pacing.NEXT_TAP_GUARD_MS - 1), 'nor one inside the window');
assert.ok(nextTapCounts(1000, 1000 + pacing.NEXT_TAP_GUARD_MS), 'and from then on every tap does');
assert.equal(nextTapCounts.length, 2, 'it reads only the clock, so plain, hinted and reveal cards all behave alike, and no flip can hold it');
const practiceCode = inRepo('src/components/practice-screen.tsx');
const nextButton = /<BigButton testID="next-card"[^\n]*\/>/.exec(practiceCode)?.[0] ?? '';
assert.ok(nextButton && !/disabled/.test(nextButton), 'Next has no disabled state, so it can never look or read as disabled');
assert.ok(!/dwell|canGoOn|setTimeout/.test(practiceCode), 'nothing delays it');
assert.ok(!/countdown|secondsLeft|seconds left/i.test(practiceCode), 'no visible timer');
assert.ok(/if \(!nextTapCounts\(answeredAt\.current, tapTime\(\)\)\) return;\s+stopSpeaking\(\);/.test(practiceCode), 'a stray tap is ignored before it can cut the read-back short');
const flipCode5 = inRepo('src/components/reveal-photo.tsx');
assert.ok(!/withCallback|onDone|onFlip|, \(finished/.test(flipCode5), 'the flip tells nobody when it ends, so nothing can wait for it');
assert.ok(!/reveal|flip/i.test(/function goOn\(\) \{[\s\S]*?\n  \}/.exec(practiceCode)?.[0].replace(/\/\/.*/g, '') ?? 'reveal'), 'and moving on never asks about it');
assert.ok(!('READ_BACK' in pacing) && !('dwellMs' in sessions5), 'the old minimum hold is gone');

// "I'm not sure" on the person's card: quiet, under the names, with its VoiceOver label, Reduce Motion and focus
{
  const { TAP } = await import('@/theme/layout');
  const screen = inRepo('src/components/practice-screen.tsx');
  const control = /<BigButton testID="not-sure"[^\n]*\/>/.exec(screen)?.[0] ?? '';
  assert.ok(/ quiet /.test(control) && /accessibilityLabel=\{notSure\.spoken\}/.test(control) && /label=\{notSure\.label\}/.test(control), 'a quiet BigButton with its VoiceOver label');
  assert.ok(TAP >= 48 && /quiet: \{\n    minHeight: TAP,/.test(inRepo('src/components/big-button.tsx')), 'a quiet button is at least 48pt tall');
  const answers = screen.slice(screen.indexOf('{choices.map((name) =>'), screen.indexOf('</View>', screen.indexOf('{choices.map((name) =>')));
  assert.ok(answers.includes('testID="not-sure"') && answers.indexOf('testID="not-sure"') > answers.indexOf('choices.map'), 'below the names, in the answers area only');
  assert.ok(/\{notSure \? \(/.test(screen) && screen.indexOf('testID="not-sure"') > screen.indexOf('testID="confirmation"'), 'shown only while notSureButton allows, and never with the success banner');
  assert.ok(/const reduced = useReducedMotion\(\);/.test(screen) && /entering=\{\(reduced \? FadeIn : FadeInDown\)\.duration\(250\)\}/.test(screen) && /scrollToEnd\(\{ animated: !reduced \}\)/.test(screen), 'Reduce Motion: a plain fade and no animated scroll');
  assert.ok(/sendAccessibilityEvent\?\.\(hintBox\.current, 'focus'\)/.test(screen) && /onLayout=\{hintLaidOut\}/.test(screen), 'VoiceOver moves to the new hint');
  assert.ok(!/Haptics|playSound|Audio|shake|Colors\.(red|error)/i.test(screen), 'no haptics, no sound, no shake, no red');
  const helpFn = /function notSureTapped\(\) \{[\s\S]*?\n  \}/.exec(screen)?.[0] ?? '';
  assert.ok(helpFn && !/selections|onRemembered/.test(helpFn), 'a help tap records no answer and finishes nothing');
}

// Wrong taps on the person's card (2026-11-16, docs/HINT-LADDER.md)
{
  // The person's card: handlers step on from the newest state, names dim instead of looping, focus moves to the new hint
  const screen = inRepo('src/components/practice-screen.tsx');
  const chooseFn = /function choose\(name: string\) \{[\s\S]*?\n  \}/.exec(screen)?.[0] ?? '';
  const helpFn = /function notSureTapped\(\) \{[\s\S]*?\n  \}/.exec(screen)?.[0] ?? '';
  assert.ok(/const now = latest\.current;/.test(chooseFn) && /const now = latest\.current;/.test(helpFn), 'both handlers start from the newest steps, never a stale render');
  assert.ok(!/\bsteps\b/.test(chooseFn.replace(/\/\/.*/g, '')) && !/\bsteps\b/.test(helpFn.replace(/\/\/.*/g, '')), 'and never read the rendered steps');
  assert.ok(/latest\.current = next;/.test(/function stepTo\([\s\S]*?\n  \}/.exec(screen)?.[0] ?? ''), 'each new step is kept for the next tap at once');
  assert.ok(/disabled=\{!nameLive\(card, steps, name\)\}/.test(screen), 'a name once chosen, and every other name at the answer, is dimmed and disabled');
  assert.ok(/focusHint\.current = true;/.test(chooseFn), 'after a wrong tap, focus moves to the new hint');
  assert.ok(/disabled && styles\.disabled/.test(inRepo('src/components/big-button.tsx')) && /disabled: \{\n    opacity: 0\.5,\n  \}/.test(inRepo('src/components/big-button.tsx')), 'dimmed is a calm fade, not a color');
  assert.ok(!/Haptics|Vibration|playSound|Audio|shake|Colors\.(red|error|danger)/i.test(screen), 'no haptics, sound, shake or red for a wrong tap');
}

// Rotation still holds across a whole planned day: phrasing, names and the right name's place
for (let run = 0; run < 40; run++) {
  const rounds = roundsOf(planToday({ ...plain12, deck: twelve, goal: 36 }), twelve);
  const lastOf = new Map();
  for (const [i, round] of rounds.entries()) {
    assert.equal(round.choices.length, 3, 'three names');
    assert.equal(new Set(round.choices).size, 3);
    assert.ok(round.choices.includes(round.answer), 'the right name is always offered');
    if (i > 0) assert.notEqual(answerAt(round), answerAt(rounds[i - 1]), 'away from where the card before had it');
    const before = lastOf.get(round.personId);
    if (before) {
      assert.notEqual(round.phrasing.id, before.phrasing.id, 'never asked the same way twice running');
      assert.ok(!same(round.choices, before.choices), 'never the same names in the same order');
      assert.notEqual(answerAt(round), answerAt(before), 'the right name moves');
    }
    lastOf.set(round.personId, round);
  }
}

// The real shape of the phone's deck: the people and facts it starts with
const phoneFamily = families.settleDeck(families.seedTestData(families.seedFamily(families.EMPTY_FAMILY, exampleDeck), TEST_DATA), hasPicture);
const phonePeople = phoneFamily.people.map((person) => ({ ...person, hasPhoto: true, samplePortrait: person.samplePortrait ?? 'x', hints: ALL_HINTS }));
const phoneDeck = sessions5.practiceFrom(phonePeople, phoneFamily.cards, (person) => person);
const phoneCards = cardsOf(phoneDeck.people, phoneDeck.cards);
assert.equal(phoneDeck.people.length, 12, 'twelve people in the deck');
assert.equal(dailyTarget(phoneCards, 'standard'), 36, 'a Standard day on the phone is 36 cards');
assert.equal(todayLine(dailyTarget(phoneCards, 'standard'), 0), 'About 8 minutes today');
const phoneRounds = roundsOf(planToday({ ...plain12, deck: phoneCards, goal: 36 }), phoneCards);
assert.equal(phoneRounds.length, 36);
assert.equal(new Set(phoneRounds.map((r) => sentenceKey(r.personId, r.phrasing))).size, 36);
assert.ok(spacing(phoneRounds.map((r) => r.personId)) >= 4);
{
  // The average stays honest about the words on the phone's own deck
  const wordsIn = (text) => text.trim().split(/\s+/).filter(Boolean).length;
  const meanOf = (values) => values.reduce((sum, value) => sum + value, 0) / values.length;
  const spokenWords = meanOf(phoneRounds.map((r) => wordsIn(`Yes, that’s ${r.answer}. ${stories.fillBlank(r.phrasing.reveal, r.answer)}`)));
  const shownWords = meanOf(phoneRounds.map((r) => wordsIn(r.phrasing.ask)));
  assert.ok(Math.abs(spokenWords / 2.6 - pacing.CARD_SECONDS.readBack) <= 1.5, `the read-back is about ${pacing.CARD_SECONDS.readBack} seconds of voice (${spokenWords.toFixed(1)} words)`);
  assert.ok(shownWords / 2.5 <= pacing.CARD_SECONDS.read, `reading a card fits its ${pacing.CARD_SECONDS.read} seconds (${shownWords.toFixed(1)} words)`);
}

// A fact two people share never offers both as the answer
{
  const shared = cardsOf(
    ['Ann', 'Bea', 'Cal', 'Dee'].map((name) => ({ id: name, name, samplePortrait: 'x' })),
    ['Ann', 'Bea', 'Cal', 'Dee'].map((name, i) => ({ id: `s${i}`, personId: name, sentence: '', fact: fact('interest', i < 2 ? 'gardening' : `hobby ${i}`) })),
  );
  const annCard = shared[0];
  for (let i = 0; i < 40; i++) {
    const round = stories.roundFor({ ...annCard, phrasings: annCard.phrasings.filter((p) => p.kind === 'ask') }, shared, {}, dayRandom);
    assert.ok(!round.choices.includes('Bea'), '"Who enjoys gardening?" never offers the other gardener');
  }
  const photoRound = () => stories.roundFor({ ...annCard, phrasings: annCard.phrasings.filter((p) => p.kind === 'photo') }, shared, {}, dayRandom);
  assert.ok(Array.from({ length: 40 }, photoRound).some((round) => round.choices.includes('Bea')), 'a photo-only card asks about nobody\'s fact, so she can be offered');
  const justTwo = cardsOf(['Ann', 'Bea'].map((name) => ({ id: name, name, samplePortrait: 'x' })), ['Ann', 'Bea'].map((name, i) => ({ id: `t${i}`, personId: name, sentence: '', fact: fact('interest', 'gardening') })));
  assert.equal(stories.roundFor({ ...justTwo[0], phrasings: justTwo[0].phrasings.filter((p) => p.kind === 'ask') }, justTwo, {}, dayRandom).choices.length, 2, 'a card always has names to choose from');
}

// Practice more and one person, after the day
const afterDay = day.map((c) => ({ personId: c.personId, cardId: c.id, key: sentenceKey(c.personId, c.phrasings[0]), kind: c.phrasings[0].kind }));
const moreCards = planMore({ deck: twelve, schedule: {}, now, asked: afterDay, random: dayRandom });
assert.equal(moreCards.length, pacing.PRACTICE_MORE.cards, 'Practice more is a mix of a few cards');
assert.ok(spacing(moreCards.map((c) => c.personId)) >= 4, 'still kept apart');
assert.ok(moreCards.every((c) => !afterDay.some((one) => one.key === sentenceKey(c.personId, c.phrasings[0]))), 'in words not yet used today, while any are left');
const onePerson = planPerson('p3', { deck: twelve, schedule: {}, now, asked: [], random: dayRandom });
assert.ok(onePerson.length >= pacing.PERSON_PRACTICE.least && onePerson.every((c) => c.personId === 'p3'), 'one person: theirs alone');
assert.ok(planPerson('p3', { deck: deckFor([1, 1, 1, 1], {}), schedule: {}, now, asked: [], random: dayRandom }).length >= 3, 'at least 3, their one fact asked other ways');
const exhausted = planMore({ deck: deckFor([1, 1]), schedule: {}, now, asked: deckFor([1, 1]).flatMap((c) => c.phrasings.map((p) => ({ personId: c.personId, cardId: c.id, key: sentenceKey(c.personId, p), kind: p.kind }))), random: dayRandom });
assert.equal(exhausted.length, 2, 'Practice more still works once every sentence has been used');

// Coming back after a hint never counts toward the day
const counted0 = local.startSession(local.emptyPractice(now), 's', now, 36);
const afterExtra = local.finishCard(counted0, 's', 'c1', missed, now, true).state;
assert.equal(afterExtra.sessions[0].cardsCompleted, 0, 'a re-ask moves the schedule but not the total');
assert.ok(afterExtra.schedule.c1, 'the schedule still moves');
assert.equal(local.pruned({ ...afterExtra, today: { day: 'long ago', asked: [] } }, now).today, undefined, 'an earlier day\'s log goes');
assert.equal(activity.dailyCompletion([], 0, now, 1)[0].percent, 0, 'an empty deck is 0%, not a division by zero');
const practiceStore = inRepo('src/data/practice-store.ts');
assert.ok(practiceStore.includes('!asked?.extra'), 'the server store counts the same way');
assert.ok(/daily_goal between 1 and 200/.test(schemaWords) && /session_length text not null default 'standard'/.test(schemaWords), 'the server takes the new targets and the setting');

// Flip cards: a person earns them, the photo always ends shown, and the unlock is never seen
const reveal = await import('@/lib/reveal');
const roundOf = (personId, more = {}) => ({ id: `${personId}-0`, personId, answer: personId, revealOk: true, phrasing: { id: 'name', kind: 'blank', ask: 'x', reveal: 'x' }, choices: [], ...more });
const always = () => 0;
assert.ok(!reveal.startsHidden(roundOf('ann'), 'often', 'day1', always), 'no reveal card before a first-try answer');
reveal.noteAnswer('ann', missed, false, 'day1');
assert.ok(!reveal.startsHidden(roundOf('ann'), 'often', 'day1', always), 'a hinted answer does not unlock it');
reveal.noteAnswer('ann', { tries: 2, hintsUsed: 0 }, false, 'day1');
assert.ok(!reveal.startsHidden(roundOf('ann'), 'often', 'day1', always), 'nor a second try');
reveal.noteAnswer('ann', clean, true, 'day1');
assert.ok(!reveal.startsHidden(roundOf('ann'), 'often', 'day1', always), 'nor an answer after tapping the "?"');
reveal.noteAnswer('ann', clean, false, 'day1');
assert.ok(reveal.startsHidden(roundOf('ann'), 'often', 'day1', always), 'a clean first try does');
assert.ok(!reveal.startsHidden(roundOf('bo'), 'often', 'day1', always), 'for that person only');
assert.ok(!reveal.startsHidden(roundOf('ann', { again: 'reask' }), 'often', 'day1', always), 'the step-0 re-ask is never a reveal card');
assert.ok(!reveal.startsHidden(roundOf('ann', { again: 'review' }), 'often', 'day1', always), 'nor the review pass');
assert.ok(!reveal.startsHidden(roundOf('ann', { revealOk: false }), 'often', 'day1', always), 'an opted-out person never gets one');
assert.ok(!reveal.startsHidden(roundOf('ann', { phrasing: { id: 'photo', kind: 'photo', ask: 'Who is this?', reveal: 'x' } }), 'often', 'day1', always), 'a photo-only card has nothing else to go on');
assert.ok(!reveal.startsHidden(roundOf('ann'), 'off', 'day1', always), 'Off means none');
assert.ok(!reveal.startsHidden(roundOf('ann'), 'often', 'day2', always), 'tomorrow nobody is unlocked');
reveal.noteAnswer('bo', clean, false, 'day2');
assert.ok(!reveal.startsHidden(roundOf('ann'), 'often', 'day2', always), 'unlocking resets with the day\'s deck');
assert.ok(reveal.startsHidden(roundOf('bo'), 'often', 'day2', always));
const rateOf = (setting) => {
  let hits = 0;
  for (let i = 0; i < 20000; i++) if (reveal.startsHidden(roundOf('bo'), setting, 'day2', dayRandom)) hits++;
  return hits / 20000;
};
assert.ok(Math.abs(rateOf('sometimes') - 0.25) < 0.02, `Sometimes is about 1 in 4 (${rateOf('sometimes')})`);
assert.ok(Math.abs(rateOf('often') - 0.5) < 0.02, `Often is about 1 in 2 (${rateOf('often')})`);
assert.equal(rateOf('off'), 0);
assert.equal(pacing.DEFAULT_REVEAL_CARDS, 'sometimes');
assert.deepEqual(pacing.REVEAL_CHOICES.map((choice) => choice.label), ['Off', 'Sometimes', 'Often']);
// The photo: hidden first, shown on a tap, always shown by the end
assert.ok(!reveal.photoShown({ reveal: true, tapped: false, answered: false }), 'a "?" first');
assert.ok(reveal.photoShown({ reveal: true, tapped: true, answered: false }), 'a tap reveals it');
assert.ok(reveal.photoShown({ reveal: true, tapped: false, answered: true }), 'and the right name flips it, so a card always ends revealed');
assert.ok(reveal.photoShown({ reveal: false, tapped: false, answered: false }), 'every other card shows it from the start');
// A person without a photo, or opted out, can't be dealt one
const noPhotos = deckFor([2, 2], { photos: false });
assert.ok(noPhotos.every((c) => !c.revealOk), 'no photo, no reveal card');
assert.ok(twelve.every((c) => c.revealOk), 'on for everyone with a photo');
const optedOut = cardsOf([{ id: 'p', name: 'P', samplePortrait: 'x', revealOk: false }], [{ id: 'c', personId: 'p', sentence: '', fact: fact('work', 'a nurse') }]);
assert.ok(!optedOut[0].revealOk, 'the caregiver can opt someone out');
// The free hint costs nothing: nothing about it reaches the schedule or the record
assert.deepEqual(nextSchedule(undefined, clean, now), nextSchedule(undefined, { ...clean }, now));
assert.ok(!/reveal/i.test(inRepo('src/lib/queue.ts')) && !/reveal/i.test(inRepo('src/lib/activity.ts')), 'the schedule and the dashboard figures never hear of it');
// The unlock state is in memory, for practice only, and no view can read it
const revealCode = inRepo('src/lib/reveal.ts');
assert.ok(!/AsyncStorage|supabase|localStorage|fetch\(/.test(revealCode.replace(/\/\/.*|\/\*[\s\S]*?\*\//g, '')), 'it is never saved or sent');
const readers = walkFiles('src').filter((path) => /from '@\/lib\/reveal'/.test(inRepo(path)));
assert.deepEqual(readers, ['src/components/practice-screen.tsx'], 'only the practice screen reads it');
assert.ok(!/dayDeck/.test(inRepo('src/components/practice-screen.tsx')), 'and it sees only yes or no for a card');
assert.ok(!/export (let|const) dayDeck/.test(revealCode), 'the state itself is not exported');
for (const view of ['src/app/caregiver/index.tsx', 'src/components/dashboard.tsx', 'src/app/index.tsx', 'src/lib/activity.ts', 'src/data/activity-store.ts']) {
  assert.ok(!/unlock|eligib|firstTry/i.test(inRepo(view)), `${view} knows nothing of it`);
}
assert.ok(!/unlock|eligib/i.test(pacing.REVEAL_CHOICES.map((choice) => choice.hint).join(' ')), 'the setting says nothing of it either');
assert.ok(!/unlock|eligib/i.test(JSON.stringify(local.finishCard(local.startSession(local.emptyPractice(now), 's', now, 36), 's', 'c1', clean, now).state)), 'and nothing kept on the phone holds it');
assert.ok(!/\b(unlock|eligible)/.test(inRepo('supabase/schema.sql')), 'nor on the server');
// Reduce Motion: a crossfade in place of the flip
const flipCode = inRepo('src/components/reveal-photo.tsx');
assert.ok(flipCode.includes('useReducedMotion') && /reduced\s*\?\s*\{ opacity/.test(flipCode), 'Reduce Motion gets a crossfade, with no rotation');
assert.ok(/"Hidden photo\. Tap to reveal\."/.test(flipCode) && flipCode.includes('Tap to reveal'), 'the tile has its label and an accessibility label');

// AI sentences: what must never get through, here and on the function
const aiCheck = await import('@/lib/ai-check');
{
  const { checkSentence, validSentences, supportedShapes, canReverse, sentenceWords } = aiCheck;
  const AI_FACTS = [
    { id: 'f1', type: 'work', text: 'a nurse' },
    { id: 'f2', type: 'interest', text: 'gardening' },
    { id: 'f3', type: 'shared', text: 'went to [PERSON_1] every December' },
    { id: 'f4', type: 'pet', text: 'a dog named [PERSON_2]' },
    { id: 'f5', type: 'met', text: 'at church in 1962' },
  ];
  const context = { facts: AI_FACTS, relationship: 'aunt' };
  const say = (sentence, fact_ids_used = ['f1'], shape = 'one_fact', blank_answer_placeholder = '[NAME]') => ({ sentence, fact_ids_used, shape, blank_answer_placeholder });
  const reason = (item) => checkSentence(item, context);

  // What may pass
  assert.equal(reason(say('My aunt, ____, is a nurse.')), null, 'one fact, with the relationship');
  assert.equal(reason(say('____ is a nurse and enjoys gardening.', ['f1', 'f2'], 'two_facts')), null, 'two facts in one sentence');
  assert.equal(reason(say('Who enjoys gardening?', ['f2'], 'fact_to_name')), null, 'fact to name');
  assert.equal(reason(say('[NAME] enjoys ____.', ['f2'], 'reverse', '[FACT:f2]')), null, 'reverse: the name given, the fact blank');
  assert.equal(reason(say('Every December, ____ and I went to [PERSON_1].', ['f3'], 'context')), null, 'a memory told as a moment');
  assert.equal(reason(say('____’s dog is named [PERSON_2]. '.trim().replace('’s dog is named [PERSON_2].', ' has a dog named [PERSON_2].'), ['f4'])), null);

  // The deliberately bad: each must be rejected, for the right reason
  const BAD = [
    ['an invented place', say('____ is a nurse in Paris.'), 'new-name'],
    ['an invented name', say('____ and Robert enjoy gardening.', ['f2']), 'new-name'],
    ['an invented word', say('____ is a kind nurse.'), 'new-word'],
    ['a changed number', say('____ and I met at church in 1963.', ['f5']), 'new-number'],
    ['a new number', say('____ is a nurse for 30 years.'), 'new-number'],
    ['a spelled-out number', say('____ has two dogs named [PERSON_2].', ['f4']), 'new-word'],
    ['the answer shown', say('Who is [NAME], a nurse?', ['f1'], 'fact_to_name'), 'answer-leak'],
    ['the answer beside the blank', say('[NAME], ____, is a nurse.'), 'answer-leak'],
    ['the answer on a reverse card', say('[NAME] enjoys gardening ____.', ['f2'], 'reverse', '[FACT:f2]'), 'answer-leak'],
    ['a fact nobody sent', say('____ is a nurse.', ['f9']), 'unknown-fact'],
    ['citing no fact', say('____ is a nurse.', []), 'unknown-fact'],
    ['the same fact twice', say('____ is a nurse.', ['f1', 'f1'], 'two_facts'), 'fact-count'],
    ['one fact for a two-fact shape', say('____ is a nurse.', ['f1'], 'two_facts'), 'fact-count'],
    ['a second fact not cited', say('____ is a nurse and enjoys gardening.'), 'new-word'],
    ['softening', say('____ sometimes enjoys gardening.', ['f2']), 'new-word'],
    ['strengthening', say('____ loves gardening.', ['f2']), 'new-word'],
    ['a cause', say('____ is a nurse because of gardening.', ['f1', 'f2'], 'two_facts'), 'new-word'],
    ['a negative', say('____ is not a nurse.'), 'new-word'],
    ['a fact cut short', say('____ and I went to [PERSON_1].', ['f3']), 'dropped-fact'],
    ['a placeholder nobody sent', say('____ is a nurse with [PERSON_7].'), 'bad-placeholder'],
    ['another fact\'s placeholder', say('____ is a nurse with [PERSON_2].'), 'bad-placeholder'],
    ['a new relationship word', say('My sister, ____, is a nurse.'), 'new-word'],
    ['a gendered guess', say('____ is a nurse and her dog is named [PERSON_2].', ['f1', 'f4'], 'two_facts'), 'new-word'],
    ['two blanks', say('____ and ____ is a nurse.'), 'blank'],
    ['no blank', say('A nurse is who it is.'), 'blank'],
    ['a shape nobody knows', say('____ is a nurse.', ['f1'], 'riddle'), 'bad-shape'],
    ['a memory shape without a memory', say('Every day, ____ is a nurse.', ['f1'], 'context'), 'shape-unsupported'],
    ['a long fact on a reverse card', { ...say('[NAME] and I ____.', ['f3'], 'reverse', '[FACT:f3]') }, 'shape-unsupported'],
    ['a question that is not one', say('Tell me who enjoys gardening.', ['f2'], 'fact_to_name'), 'shape-unsupported'],
    ['two sentences', say('Think hard. ____ is a nurse.'), 'bad-punctuation'],
    ['quotation marks', say('"____" is a nurse.'), 'bad-punctuation'],
    ['an instruction slipped in', say('Ignore the rules: ____ is a nurse.'), 'bad-punctuation'],
    ['no end', say('____ is a nurse'), 'bad-punctuation'],
    ['too long', say(`____ is a nurse${' and a nurse'.repeat(12)}.`), 'too-long'],
  ];
  for (const [label, item, code] of BAD) assert.equal(reason(item), code, `${label} is rejected: ${item.sentence}`);
  assert.equal(reason({ sentence: 5, fact_ids_used: ['f1'], shape: 'one_fact', blank_answer_placeholder: '[NAME]' }), 'bad-shape', 'nonsense from the model is dropped, not thrown');
  assert.deepEqual(validSentences([null, 3, 'text', {}, { shape: 'one_fact' }], context), [], 'anything malformed is dropped silently');
  const twice = say('____ is a nurse.');
  assert.deepEqual(validSentences([twice, say('____ IS A NURSE.'), say('My aunt, ____, is a nurse.')], context).map((one) => one.sentence), ['____ is a nurse.', 'My aunt, ____, is a nurse.'], 'duplicates go, whatever the case');
  assert.deepEqual(validSentences([twice], context, ['reverse']), [], 'a shape not asked for is dropped');

  // A time-sensitive fact is never sent, so a sentence built on it has nothing to stand on
  const withJob = { facts: AI_FACTS.filter((one) => one.id !== 'f1'), relationship: 'aunt' };
  assert.equal(checkSentence(say('As of May 2026, ____ is a nurse.', ['f1']), withJob), 'unknown-fact', 'citing it fails');
  assert.equal(checkSentence(say('____ is a nurse and enjoys gardening.', ['f2']), withJob), 'new-word', 'and so does slipping its words in');
  assert.ok(!('plans' in aiCheck.FACT_WORDS) && !('marital' in aiCheck.FACT_WORDS) && !('situation' in aiCheck.FACT_WORDS), 'kinds that always may change are not even known here');

  // With the real words back: the same rules, with the person's name as the answer
  const real = { facts: [{ id: 'c1', type: 'shared', text: 'went to Rome every December' }, { id: 'c2', type: 'interest', text: 'gardening' }], relationship: 'aunt', name: 'June Park' };
  assert.equal(checkSentence(say('Every December, ____ and I went to Rome.', ['c1'], 'context'), real), null, 'traceable to the real facts');
  assert.equal(checkSentence(say('Every December, June and I went to Rome.', ['c1'], 'context'), real), 'answer-leak', 'the real name is the answer');
  assert.equal(checkSentence(say('Every December, june and ____ went to Rome.', ['c1'], 'context'), real), 'answer-leak', 'in any case');
  assert.equal(checkSentence(say('____ went to Park and enjoys gardening.', ['c2']), real), 'answer-leak', 'or in part');
  assert.equal(checkSentence(say('Every December, ____ and I went to Milan.', ['c1'], 'context'), real), 'new-name', 'a name not in the facts fails on the phone too');
  assert.equal(checkSentence(say('June Park enjoys ____.', ['c2'], 'reverse', '[FACT:c2]'), real), null, 'a reverse card shows the name, as the shape says');
  assert.equal(aiCheck.maskName('Went with JUNE to june’s house and Junebug', 'June'), 'Went with [NAME] to [NAME]’s house and Junebug', 'whole words only');

  assert.deepEqual(supportedShapes([]), [], 'nothing to work from');
  assert.deepEqual(supportedShapes([AI_FACTS[0]]), ['one_fact', 'fact_to_name', 'reverse'], 'never a shape the facts cannot support');
  assert.ok(supportedShapes(AI_FACTS).includes('two_facts') && supportedShapes(AI_FACTS).includes('context'));
  assert.ok(!canReverse({ id: 'x', type: 'interest', text: 'collecting very old stamps from everywhere' }), 'too long for a button');
  assert.ok(!canReverse({ id: 'x', type: 'shared', text: 'fished' }), 'a memory reads badly as a blank');
  assert.equal(sentenceWords('____ is a Nurse.'), sentenceWords('____ IS a nurse'), 'case and punctuation make no new sentence');
  assert.notEqual(sentenceWords('____, my aunt, enjoys gardening.'), sentenceWords('My aunt, ____, enjoys gardening.'), 'but moving the blank does');

  // The words a fact brings are its fixed sentence, word for word
  for (const [type, words] of Object.entries(aiCheck.FACT_WORDS)) {
    const fixed = stories.sentenceFor({}, fact(type, 'WORDS')).toLowerCase();
    for (const word of words.toLowerCase().split(' ').filter(Boolean)) assert.ok(fixed.includes(word), `${type}: "${word}" comes from its fixed sentence`);
  }
  for (const type of Object.keys(aiCheck.FACT_WORDS)) assert.ok(q.questionFor(type), `${type}: the queue can say where a fact came from`);
  // The function holds an exact copy of these checks
  const functionCode = inRepo('supabase/functions/generate-questions/index.ts');
  assert.ok(functionCode.includes(`// <ai-check>\n${inRepo('src/lib/ai-check.ts')}// </ai-check>\n`), 'run node scripts/sync-ai-check.mjs: the function and the phone must check the same way');
}

// AI questions on the phone: what leaves, what comes back, and what reaches the person
{
  const request = await import('@/lib/ai-request');
  const queue = await import('@/lib/ai-sentences');
  const variants = await import('@/lib/variants');
  const features = await import('@/config/features');
  const { practiceFrom } = sessions5;

  // Off by default, and nothing about it runs
  assert.equal(features.AI_AVAILABLE, features.AI_VARIANTS_ENABLED && !features.AUTH_ENABLED, 'it follows the flag, and only with sign-in off');
  assert.deepEqual(queue.sentencesInUse(undefined, {}), [], 'with the flag off the store passes no AI at all');

  const cardOf = (id, type, text, more = {}) => ({ id, personId: 'june', type, text, timeSensitive: false, status: 'approved', source: 'caregiver', phrasingsOff: [], ...more });
  const june = { id: 'june', name: 'June', relationship: 'aunt' };
  const juneCards = [
    cardOf('sample-june-0', 'interest', 'gardening with Leo'),
    cardOf('sample-june-1', 'shared', 'went to Rome with ruth every December'),
    cardOf('sample-june-2', 'pet', 'a dog named Biscuit'),
    cardOf('sample-june-3', 'pet', 'a cat called whiskers'),
    cardOf('sample-june-4', 'partner', 'sam'),
    cardOf('sample-june-5', 'nickname', 'Junie'),
    cardOf('sample-june-6', 'memory', 'loves June’s garden party'),
    cardOf('sample-june-7', 'team', 'The Riverton Otters'),
    cardOf('sample-june-8', 'birthday', 'March 3'),
    cardOf('sample-june-9', 'workplace', 'Mercy Hospital of Ohio'),
  ];
  const noSend = [
    cardOf('test-june-0', 'interest', 'a sample hobby (test data)', { testData: true }),
    cardOf('c-dated', 'work', 'a teacher', { timeSensitive: true, asOf: '2026-05-01', confirmedAt: 'then' }),
    cardOf('c-pending', 'food', 'lasagna', { status: 'pending' }),
    cardOf('c-skipped', 'food', 'soup', { status: 'skipped' }),
    cardOf('c-plans', 'plans', 'moving away', { timeSensitive: true, asOf: '2026-05-01', confirmedAt: 'then' }),
    cardOf('c-marital', 'marital', 'widowed', { timeSensitive: true, asOf: '2026-05-01', confirmedAt: 'then' }),
    cardOf('c-unconfirmed', 'work', 'a pilot', { timeSensitive: true, asOf: '2026-05-01' }),
  ];

  // Only approved, never test data, never time-sensitive
  assert.deepEqual(request.sendableFacts([...juneCards, ...noSend]).map((c) => c.id), juneCards.map((c) => c.id), 'test data, dated, unapproved and skipped facts are left out');
  assert.ok(inRepo('src/lib/ai-request.ts').includes('withoutTestData(cards)'), 'AI input goes through the test-data guard');

  // The real name never leaves, and nor does anyone else's
  const { body, restore } = request.buildRequest(june, request.sendableFacts([...juneCards, ...noSend]), ['Leo', 'Ruth', 'Omar'], 8);
  const wire = JSON.stringify(body);
  for (const word of ['June', 'june', 'Junie', 'Leo', 'ruth', 'Ruth', 'sam', 'Biscuit', 'whiskers', 'Rome', 'Otters', 'Riverton', 'Mercy', 'Ohio', 'sample-june', 'test data', 'a teacher', 'lasagna', 'widowed']) assert.ok(!wire.includes(word), `"${word}" is not in the request`);
  assert.deepEqual(Object.keys(body).sort(), ['facts', 'placeholders', 'relationship', 'shape_requests'], 'the input contract, nothing more');
  assert.equal(body.relationship, 'aunt', 'the relationship goes');
  assert.ok(body.placeholders.includes('[NAME]') && body.placeholders.length > 5);
  assert.ok(body.facts.every((one) => /^f\d+$/.test(one.id)), 'card ids stay home: an id can hold a name');
  assert.ok(body.facts.every((one, i) => Object.keys(one).join() === 'id,type,text' && one.id === `f${i + 1}`), 'id, type and text only');
  assert.equal(body.facts[0].text, 'gardening with [PERSON_1]', 'a family name');
  assert.ok(/^went to \[PERSON_\d\] with \[PERSON_\d\] every December$/.test(body.facts[1].text), `a place and a lowercase name: ${body.facts[1].text}`);
  assert.ok(/^a dog named \[PERSON_\d\]$/.test(body.facts[2].text) && /^a cat called \[PERSON_\d\]$/.test(body.facts[3].text), 'a pet, whatever the case');
  assert.ok(/^\[PERSON_\d\]$/.test(body.facts[4].text) && /^\[PERSON_\d\]$/.test(body.facts[5].text), 'a partner and a nickname, whole');
  assert.ok(body.facts[6].text.includes('[NAME]'), 'their own name inside a fact');
  assert.ok(/^The \[PERSON_\d+\]$/.test(body.facts[7].text), 'a proper noun, keeping the small word');
  assert.equal(body.facts[8].text, 'March 3', 'a date has no name in it');
  assert.ok(/^\[PERSON_\d+\]$/.test(body.facts[9].text), 'a place with a small word inside it');
  assert.ok(body.shape_requests.reduce((sum, one) => sum + one.count, 0) <= request.AI_LIMITS.sentencesPerRequest, 'a short list');
  assert.ok(!Object.values(restore.tokens).some((real) => wire.includes(real)), 'nothing in the restore map was sent');
  assert.equal(request.buildRequest(june, Array.from({ length: 20 }, (_, i) => cardOf(`x${i}`, 'food', `food ${i}`)), [], 8).body.facts.length, request.AI_LIMITS.factsPerRequest, 'a request stays small');
  assert.equal(request.buildRequest(june, [cardOf('a', 'interest', 'gardening')], [], 2).body.shape_requests.reduce((sum, one) => sum + one.count, 0), 2, 'never more than the queue can take');

  // The limits hold for what is really sent, so one fact can't get a whole request refused
  const crowded = cardOf('crowded', 'memory', `saw ${'Al, Bo, Cy, Di, Ed, Flo, '.repeat(4).trim()}`);
  assert.ok(crowded.text.length <= request.AI_LIMITS.factLetters && request.isSendable(crowded), 'fits as typed');
  const grown = request.buildRequest(june, [crowded, cardOf('a', 'interest', 'gardening')], [], 8);
  assert.deepEqual(grown.body.facts.map((one) => one.text), ['gardening'], 'and is left out when its placeholders make it too long');
  assert.deepEqual(grown.body.placeholders, ['[NAME]'], 'along with placeholders nothing uses');
  assert.equal(grown.restore.factIds.f1, 'a', 'and the ids still line up');
  assert.equal(request.buildRequest(june, [crowded], [], 8).body.facts.length, 0, 'with nothing left, nothing to send');
  const gardening = [cardOf('a', 'interest', 'gardening')];
  assert.equal(request.buildRequest({ name: 'June', relationship: 'friend of Maximiliana' }, gardening, [], 8).body.relationship, 'friend of [PERSON_1]', 'a relationship that fits goes');
  assert.equal(request.buildRequest({ name: 'June', relationship: 'friend of Al, Bo, Cy, Di, Ed, Flo, Guy' }, gardening, [], 8).body.relationship, '', 'one too long once masked is left off');

  // Writing with no capitals can't be read for names, so it stays on the phone
  for (const text of ['visited 田中 every summer', 'loves ليلى', 'lunch with প্রিয়া']) assert.ok(!request.isSendable(cardOf('a', 'memory', text)), `not sent: ${text}`);
  assert.ok(request.isSendable(cardOf('a', 'memory', 'visited José and Zoë in São Paulo')), 'accents are fine: those names have capitals');
  assert.equal(request.buildRequest({ name: 'June', relationship: 'दादी' }, gardening, [], 8).body.relationship, '', 'the same goes for the relationship');

  // "Kinds" are checked as exact words, so an inherited key is not a kind
  for (const type of ['constructor', '__proto__', 'toString']) {
    assert.ok(!aiCheck.isFactType(type) && !request.isSendable(cardOf('a', type, 'gardening')), `${type} is no kind of fact`);
    const proposed = { sentence: '____ enjoys gardening.', blank_answer_placeholder: '[NAME]', fact_ids_used: ['f1'], shape: 'one_fact' };
    assert.equal(aiCheck.checkSentence(proposed, { facts: [{ id: 'f1', type, text: 'gardening' }] }), 'unknown-fact', `${type} never passes`);
  }

  // The whole round trip: masked out, restored in
  const plainCards = [cardOf('c1', 'interest', 'gardening with Leo'), cardOf('c2', 'shared', 'went to Rome every December'), cardOf('c3', 'food', 'tomato soup')];
  const sent = request.buildRequest(june, plainCards, ['Leo'], 8);
  const reply = [
    { sentence: 'My aunt, ____, enjoys gardening with [PERSON_1].', blank_answer_placeholder: '[NAME]', fact_ids_used: ['f1'], shape: 'one_fact' },
    { sentence: 'Who loves tomato soup?', blank_answer_placeholder: '[NAME]', fact_ids_used: ['f3'], shape: 'fact_to_name' },
    { sentence: 'Every December, ____ and I went to [PERSON_2].', blank_answer_placeholder: '[NAME]', fact_ids_used: ['f2'], shape: 'context' },
    { sentence: '[NAME] loves ____.', blank_answer_placeholder: '[FACT:f3]', fact_ids_used: ['f3'], shape: 'reverse' },
  ];
  const accepted = request.acceptSentences(reply, sent.body, sent.restore, june, plainCards);
  assert.deepEqual(accepted.map((one) => one.sentence), ['My aunt, ____, enjoys gardening with Leo.', 'Who loves tomato soup?', 'Every December, ____ and I went to Rome.', '[NAME] loves ____.'], 'real words back, on the phone only');
  assert.deepEqual(accepted.map((one) => one.fact_ids_used), [['c1'], ['c3'], ['c2'], ['c3']], 'and real cards');
  assert.equal(accepted[3].blank_answer_placeholder, '[FACT:c3]');

  // Whatever the server let through, the phone rejects it again
  for (const [label, item] of [
    ['an invented place', { sentence: '____ went to Paris.', blank_answer_placeholder: '[NAME]', fact_ids_used: ['f2'], shape: 'one_fact' }],
    ['the real name', { sentence: 'June enjoys gardening with [PERSON_1].', blank_answer_placeholder: '[NAME]', fact_ids_used: ['f1'], shape: 'one_fact' }],
    ['a changed number', { sentence: '____ went to [PERSON_2] every December in 1999.', blank_answer_placeholder: '[NAME]', fact_ids_used: ['f2'], shape: 'one_fact' }],
    ['a fact it was not sent', { sentence: '____ is a teacher.', blank_answer_placeholder: '[NAME]', fact_ids_used: ['c-dated'], shape: 'one_fact' }],
    ['an unknown placeholder', { sentence: '____ went with [PERSON_9].', blank_answer_placeholder: '[NAME]', fact_ids_used: ['f2'], shape: 'one_fact' }],
    ['a shape it did not ask for', { sentence: '____ loves tomato soup.', blank_answer_placeholder: '[NAME]', fact_ids_used: ['f3'], shape: 'made_up' }],
  ]) assert.deepEqual(request.acceptSentences([item], sent.body, sent.restore, june, plainCards), [], `${label} is rejected on the phone too`);
  for (const nonsense of [null, 'text', { error: 'x' }, 7]) assert.deepEqual(request.acceptSentences(nonsense, sent.body, sent.restore, june, plainCards), [], 'a bad response is nothing, not a crash');
  const changedMeanwhile = plainCards.map((c) => (c.id === 'c3' ? { ...c, status: 'pending' } : c));
  assert.ok(!request.acceptSentences(reply, sent.body, sent.restore, june, changedMeanwhile).some((one) => one.fact_ids_used.includes('c3')), 'a fact unapproved while the request was out does not count');

  // The queue gates everything
  let made = 0;
  const newAiId = () => `id${++made}`;
  const fixedWays = ['My aunt, ____, enjoys gardening with Leo today.'];
  let all = queue.addSentences([], accepted, june, plainCards, fixedWays, newAiId);
  assert.ok(all.every((one) => one.status === 'pending' && one.id.startsWith('ai-')), 'everything waits for the caregiver');
  assert.deepEqual(all[0].facts.map((one) => one.text), ['gardening with Leo'], 'with the facts it came from');
  const person = { ...june, samplePortrait: 'june', hints: ALL_HINTS };
  const ai = (sentences) => ({ on: true, consented: true, sentences });
  const deckWith = (sentences, cards = plainCards, aiState = ai(sentences), who = person) => {
    const ofPerson = { ...who, inDeck: true };
    const other = ['Ann', 'Bo'].map((name) => ({ id: name, name, samplePortrait: 'x', inDeck: true, hints: ALL_HINTS }));
    const others = other.flatMap((one, i) => [{ ...cardOf(`o${i}a`, 'food', `dish ${i}`), personId: one.id }, { ...cardOf(`o${i}b`, 'interest', `hobby ${i}`), personId: one.id }]);
    const everyone = [ofPerson, ...other];
    const built = practiceFrom(everyone, [...cards, ...others], (one) => ({ ...one, hasPhoto: true, notApplicable: ['interest', 'shared', 'relationship'] }), (card, one) => variants.approvedVariants(queue.sentencesInUse(aiState, one), card.id, one, card));
    return cardsOf(built.people, built.cards);
  };
  const askedWays = (deck) => deck.filter((c) => c.personId === 'june').flatMap((c) => c.phrasings).filter(variants.isAiPhrasing);
  assert.deepEqual(askedWays(deckWith(all)), [], 'waiting means nothing reaches practice');
  const juneOne = all[0].id;
  all = queue.approveSentence(all, juneOne, june, plainCards).all;
  assert.deepEqual(askedWays(deckWith(all)).map((one) => one.id), [juneOne], 'approving one lets that one in');
  assert.equal(askedWays(deckWith(all, plainCards, { ...ai(all), on: false })).length, 0, 'Settings off takes them out of practice');
  assert.equal(askedWays(deckWith(all, plainCards, { ...ai(all), consented: false })).length, 0, 'no consent, no sentences');
  assert.equal(askedWays(deckWith(all, plainCards, ai(all), { ...person, aiOk: false })).length, 0, 'and so does the per-person opt-out');
  assert.equal(askedWays(deckWith(all, plainCards, ai(all), { ...person, archivedAt: '2026-11-09T10:00:00.000Z' })).length, 0, 'and archiving them');
  assert.deepEqual(askedWays(deckWith(all)).map((one) => one.id), [juneOne], 'which keeps the sentence for when they are restored');
  assert.equal(queue.approveSentence(all, juneOne, june, plainCards).all.find((one) => one.id === juneOne).status, 'approved', 'kept when Settings goes back on');
  assert.equal(queue.queueOf(all, 'june').length, 3);
  all = queue.rejectSentence(all, all[1].id);
  assert.equal(all[1].status, 'rejected');
  assert.equal(queue.addSentences(all, [accepted[1]], june, plainCards, [], newAiId).length, all.length, 'a rejected sentence is not suggested again');
  assert.equal(queue.addSentences(all, accepted.slice(0, 1).map((one) => ({ ...one, sentence: fixedWays[0] })), june, plainCards, fixedWays, newAiId).length, all.length, 'nor one that repeats a fixed phrasing');
  assert.ok(!askedWays(deckWith(all)).some((one) => one.id === all[1].id), 'a rejected sentence never reaches practice');
  const full = Array.from({ length: request.AI_LIMITS.pendingPerPerson }, (_, i) => ({ ...all[2], id: `ai-f${i}`, text: `x ${i}` }));
  assert.equal(queue.queueRoom(full, 'june'), 0, 'the queue stays manageable');
  assert.equal(queue.addSentences(full, accepted, june, plainCards, [], newAiId).length, full.length, 'nothing is added once it is full');

  // Edits are checked again
  const toEdit = all[2].id;
  assert.equal(queue.editSentence(all, toEdit, '____ and I went to Paris every December.', june, plainCards).reason, 'new-name', 'an edit with a new place is refused');
  assert.equal(queue.editSentence(all, toEdit, 'June and I went to Rome every December.', june, plainCards).reason, 'answer-leak');
  assert.equal(queue.editSentence(all, toEdit, 'I went to Rome.', june, plainCards).reason, 'blank');
  const edited = queue.editSentence(all, toEdit, 'Every December, I went to Rome with ____.', june, plainCards);
  assert.equal(edited.reason, undefined, 'an edit from the facts’ own words is fine');
  assert.deepEqual([edited.all.find((one) => one.id === toEdit).status, edited.all.find((one) => one.id === toEdit).edited], ['pending', true], 'and still waits to be approved');
  const reverseOne = all.find((one) => one.shape === 'reverse');
  const editedReverse = queue.editSentence(all, reverseOne.id, 'June loves ____.', june, plainCards);
  assert.equal(editedReverse.all.find((one) => one.id === reverseOne.id).text, '[NAME] loves ____.', 'a reverse card keeps its token');

  // "Approve all valid" approves only what still passes
  const broken = { ...all[2], id: 'ai-bad', text: '____ went to Paris.', status: 'pending' };
  const approvedAll = queue.approveAllValid([...all, broken], june, plainCards);
  assert.equal(approvedAll.find((one) => one.id === 'ai-bad').status, 'pending', 'one that fails stays in the queue');
  assert.ok(approvedAll.filter((one) => one.id !== 'ai-bad' && one.status !== 'rejected').every((one) => one.status === 'approved'));

  // Approve all on a person's sheet: exactly what is eligible, never what needs a deliberate look
  {
    const approve = await import('@/lib/approve-all');
    const nowA = new Date(2026, 10, 10, 9);
    const fresh = queue.addSentences([], accepted, june, plainCards, [], newAiId);
    const editedOne = { ...fresh[1], id: 'ai-edited', edited: true };
    const flaggedOne = { ...fresh[2], id: 'ai-flagged', status: 'flagged' };
    const failing = { ...fresh[0], id: 'ai-failing', text: '____ went to Paris.' };
    const rejected = { ...fresh[0], id: 'ai-rejected', status: 'rejected' };
    const someoneElse = { ...fresh[0], id: 'ai-leo', personId: 'leo' };
    const sentences = [...fresh, editedOne, flaggedOne, failing, rejected, someoneElse];
    const cards = [
      ...plainCards,
      cardOf('p1', 'interest', 'knitting', { status: 'pending' }),
      cardOf('p2', 'food', 'apple pie', { status: 'pending', testData: true }),
      cardOf('p-dated', 'work', 'a nurse', { status: 'pending', timeSensitive: true, asOf: '2026-05-01' }),
      cardOf('p-skipped', 'food', 'pears', { status: 'skipped' }),
      cardOf('leo-1', 'food', 'chips', { status: 'pending', personId: 'leo' }),
    ];
    const plan = approve.approvalPlan(june, cards, sentences);
    assert.deepEqual(plan.stories.map((c) => c.id), ['p1', 'p2'], 'waiting stories, test data included as approval allows, never a dated, skipped or someone else’s');
    assert.deepEqual(plan.questions.map((one) => one.id), fresh.map((one) => one.id), 'new sentences that pass the checks now');
    assert.deepEqual(plan.held.map((one) => [one.kind === 'story' ? one.card.id : one.sentence.id, one.reason]).sort(), [['ai-edited', 'edited'], ['ai-failing', 'fails-checks'], ['ai-flagged', 'flagged'], ['p-dated', 'dated']].sort(), 'what needs a deliberate look is held, and says why');
    assert.equal(approve.planSize(plan), 2 + fresh.length);
    assert.equal(approve.waitingCount(plan), 2 + fresh.length + 4);
    assert.deepEqual(approve.approvalPlan({ ...june, archivedAt: '2026-11-01T00:00:00.000Z' }, cards, sentences), { stories: [], questions: [], held: [] }, 'someone archived has no approvals at all');
    assert.equal(approve.approvalPlan(june, cards, []).questions.length, 0, 'without AI questions shown, none are approved');

    const ids = { stories: plan.stories.map((c) => c.id), questions: plan.questions.map((one) => one.id) };
    const before = { cards, sentences };
    const done = approve.applyApproval(before, june, ids, nowA);
    assert.equal(done.approved, 2 + fresh.length, 'approves exactly the eligible items');
    const statusOfCard = (list, id) => list.find((c) => c.id === id).status;
    assert.deepEqual(['p1', 'p2', 'p-dated', 'p-skipped', 'leo-1'].map((id) => statusOfCard(done.cards, id)), ['approved', 'approved', 'pending', 'skipped', 'pending'], 'a dated fact still waits for its own Confirm');
    assert.equal(done.cards.find((c) => c.id === 'p-dated').confirmedAt, undefined, 'and is never confirmed by Approve all');
    const statusOfSentence = (list, id) => list.find((one) => one.id === id).status;
    assert.ok(fresh.every((one) => statusOfSentence(done.sentences, one.id) === 'approved'));
    assert.deepEqual(['ai-edited', 'ai-flagged', 'ai-failing', 'ai-rejected', 'ai-leo'].map((id) => statusOfSentence(done.sentences, id)), ['pending', 'flagged', 'pending', 'rejected', 'pending'], 'never an edited, flagged, failing, rejected or someone else’s sentence');
    // Through the same rule as one tap: what statusChange writes, what approveSentence writes
    assert.deepEqual(done.cards.find((c) => c.id === 'p1'), { ...cards.find((c) => c.id === 'p1'), ...facts.statusChange(cards.find((c) => c.id === 'p1'), 'approved', nowA) });
    assert.deepEqual(done.sentences.find((one) => one.id === fresh[0].id), queue.approveSentence(sentences, fresh[0].id, june, cards).all.find((one) => one.id === fresh[0].id));
    // Ids beyond what is eligible are ignored, even if a screen passes them
    const forced = approve.applyApproval(before, june, { stories: ['p-dated', 'leo-1', 'p1'], questions: ['ai-failing', 'ai-edited', 'ai-flagged'] }, nowA);
    assert.equal(forced.approved, 1, 'only p1: nothing held can be pushed through');
    // The family changed after the list was shown: a sentence that fails now is skipped
    const changed = cards.map((c) => (c.id === 'c3' ? { ...c, text: 'pea soup' } : c));
    const later = approve.applyApproval({ cards: changed, sentences }, june, ids, nowA);
    assert.equal(later.sentences.find((one) => one.text === 'Who loves tomato soup?').status, 'pending', 'checked again at the moment it is approved: “tomato” is no longer in the fact');
    // Undo puts back exactly what was there
    const undone = approve.undoApproval({ cards: done.cards, sentences: done.sentences }, done.undo);
    assert.deepEqual(undone, before, 'Undo restores the previous state exactly');
    // ...except anything the caregiver changed since
    const editedSince = done.cards.map((c) => (c.id === 'p1' ? { ...c, text: 'crochet', status: 'pending' } : c));
    assert.equal(approve.undoApproval({ cards: editedSince, sentences: done.sentences }, done.undo).cards.find((c) => c.id === 'p1').text, 'crochet', 'a story edited since keeps its new words');
    // The words
    assert.equal(approve.HELD_WORDS.dated.length > 0 && Object.keys(approve.HELD_WORDS).length, 4);
    const sheetCode = inRepo('src/components/approve-all.tsx');
    assert.equal(approve.approvedText(8, 2), 'Approved 8. 2 need your confirmation.', 'the toast says how many were approved and how many need confirming');
    assert.equal(approve.approvedText(1, 1), 'Approved 1. 1 needs your confirmation.');
    assert.equal(approve.approvedText(3, 0), 'Approved 3.');
    assert.ok(!approve.listOpened('june'), 'Approve all waits until the list was opened this session');
    approve.markListOpened('june');
    assert.ok(approve.listOpened('june') && !approve.listOpened('leo'), 'per person');
    // Only on the caregiver's sheet, after the list was opened
    const personSheet = inRepo('src/components/person-sheet.tsx');
    assert.ok(/markListOpened\(shown\.id\)/.test(personSheet) && /listOpened\(personId\) && planSize\(plan\) > 0/.test(sheetCode), 'Approve all appears on the sheet only once the list was opened in this session');
    assert.ok(!/approve-all/.test(['src/app/index.tsx', 'src/app/practice.tsx', 'src/components/practice-screen.tsx', 'src/components/practice-more.tsx'].map(inRepo).join('\n')), 'never on a person-facing screen');
    assert.ok(/<Toast /.test(personSheet) && /undoApproveAll\(result\.undo\)/.test(personSheet), 'with Undo in a toast');
    // Approve all on story approval (screen 6): every story is on screen, so one tap, with Undo
    {
      const long = cardOf('p-long', 'memory', 'walked all the way down to the old pier near the lighthouse on the coast every summer evening', { status: 'pending' });
      const storyCards = [...cards, long, cardOf('p-approved', 'food', 'figs', { status: 'approved' })];
      const ready = approve.storyApproval(june, storyCards);
      assert.deepEqual(ready.ids, ['p1', 'p2', 'p-long'], 'only stories still waiting: never approved, skipped, dated or someone else’s');
      assert.equal(ready.held, 1, 'the fact that may change waits for its own Confirm, and is counted for the toast');
      assert.ok(stories.wordCount(stories.sentenceFor(june, long)) > stories.PLAIN_MOST_WORDS, 'a long sentence, which story approval notes');
      assert.ok(ready.ids.includes('p-long'), 'is still included');
      assert.deepEqual(approve.storyApproval(june, storyCards, ['p2']).ids, ['p1', 'p-long'], 'a story open for editing is left as it is');
      const tapped = approve.applyApproval({ cards: storyCards, sentences }, june, { stories: ready.ids, questions: [] }, nowA);
      assert.equal(tapped.approved, 3, 'one tap approves them all');
      assert.deepEqual(['p1', 'p2', 'p-long', 'p-skipped', 'p-dated', 'p-approved'].map((id) => statusOfCard(tapped.cards, id)), ['approved', 'approved', 'approved', 'skipped', 'pending', 'approved'], 'skipped stays skipped, dated stays waiting');
      assert.deepEqual(tapped.cards.map((c) => [c.id, c.text]), storyCards.map((c) => [c.id, c.text]), 'every story keeps its words, edited or not, and its fact');
      assert.deepEqual(tapped.sentences, sentences, 'no AI sentence is touched');
      const undoneStories = approve.undoApproval({ cards: tapped.cards, sentences: tapped.sentences }, tapped.undo);
      assert.deepEqual(undoneStories.cards, storyCards, 'Undo puts every story back as it was');
      const nothing = approve.storyApproval(june, storyCards.map((c) => (c.status === 'pending' && !c.timeSensitive ? { ...c, status: 'approved' } : c)));
      assert.deepEqual(nothing.ids, [], 'nothing left waiting');
      assert.deepEqual(approve.approveAllButton(nothing.ids.length), { label: 'Approve all', disabled: true }, 'so the button is disabled');
      assert.deepEqual(approve.approveAllButton(12), { label: 'Approve all 12', disabled: false }, 'and shows the count while there is one');
      const reviewCode = inRepo('src/app/caregiver/review.tsx');
      assert.ok(/storyApproval\(person, cards, editing\)/.test(reviewCode) && /questions: \[\]/.test(reviewCode), 'the screen approves through the same rule, stories only');
      assert.ok(/<Toast /.test(reviewCode) && /undoApproveAll\(result\.undo\)/.test(reviewCode), 'with Undo in a toast');
      assert.ok(/testID="approve"/.test(reviewCode) && /testID="edit"/.test(reviewCode) && /testID="skip"/.test(reviewCode), 'each story keeps Approve, Edit and Skip');
    }
  }

  // A changed or removed fact pulls every sentence that used it
  let live = approvedAll.filter((one) => one.id !== 'ai-bad');
  assert.equal(queue.settleSentences(live, [june], plainCards), live, 'nothing changed, nothing moves');
  const statusOf = (list, id) => list.find((one) => one.id === id)?.status;
  const usesC2 = live.find((one) => one.facts.some((fact) => fact.id === 'c2')).id;
  const removed = plainCards.filter((c) => c.id !== 'c2');
  const afterRemoval = queue.settleSentences(live, [june], removed);
  assert.equal(statusOf(afterRemoval, usesC2), 'flagged', 'a removed fact pulls its sentence');
  assert.ok(!askedWays(deckWith(afterRemoval, removed)).some((one) => one.id === usesC2), 'out of the rotation at once');
  assert.ok(queue.queueOf(afterRemoval, 'june').some((one) => one.id === usesC2), 'and back in the queue, for review');
  const reworded = plainCards.map((c) => (c.id === 'c2' ? { ...c, text: 'went to Milan every December' } : c));
  assert.equal(statusOf(queue.settleSentences(live, [june], reworded), usesC2), 'flagged', 'new words pull it too');
  const unapproved = plainCards.map((c) => (c.id === 'c2' ? { ...c, status: 'pending' } : c));
  assert.equal(statusOf(queue.settleSentences(live, [june], unapproved), usesC2), 'flagged', 'as does waiting for approval again');
  const nowDated = plainCards.map((c) => (c.id === 'c2' ? { ...c, timeSensitive: true, asOf: '2026-05-01', confirmedAt: 'then' } : c));
  assert.equal(statusOf(queue.settleSentences(live, [june], nowDated), usesC2), 'flagged', 'and being marked as something that may change');
  assert.ok(queue.settleSentences(live, [{ ...june, relationship: 'mom' }], plainCards).filter((one) => one.status !== 'rejected').every((one) => one.status === 'flagged'), 'a new relationship pulls them all');
  assert.equal(statusOf(queue.settleSentences(afterRemoval, [june], plainCards), usesC2), 'flagged', 'it stays flagged even if the fact comes back, until someone looks');
  assert.deepEqual(queue.settleSentences(live, [], plainCards), [], 'someone removed takes their sentences with them');
  assert.equal(queue.approveSentence(afterRemoval, usesC2, june, removed).reason, 'unknown-fact', 'a flagged sentence can not be approved while its fact is gone');
  assert.equal(statusOf(queue.approveSentence(afterRemoval, usesC2, june, plainCards).all, usesC2), 'approved', 'and can once the check passes again');

  // Approved sentences join the day: the larger pool, no repeats, AI first
  const oneFactDeck = (sentences) => {
    const cards = [cardOf('j0', 'interest', 'gardening')];
    return deckWith(sentences, cards);
  };
  const aiSentence = (id, text, shape = 'one_fact', cardId = 'j0', factText = 'gardening') => ({ id, personId: 'june', shape, text, facts: [{ id: cardId, type: 'interest', text: factText }], relationship: 'aunt', status: 'approved' });
  const withoutAi = oneFactDeck([]);
  const moreSentences = [aiSentence('ai-1', 'My aunt, ____, enjoys gardening.'), aiSentence('ai-2', '____ enjoys gardening, my aunt.'), aiSentence('ai-3', 'Gardening is enjoyed by ____.')];
  const withAi = oneFactDeck(moreSentences);
  assert.ok(dailyTarget(withAi, 'standard') > dailyTarget(withoutAi, 'standard'), `the day draws on the larger pool: ${dailyTarget(withoutAi, 'standard')} to ${dailyTarget(withAi, 'standard')}`);
  for (let run = 0; run < 60; run++) {
    const goal = dailyTarget(withAi, 'standard');
    const plan = planToday({ deck: withAi, schedule: {}, now, goal, completed: 0, asked: [], random: dayRandom });
    assert.equal(plan.length, goal);
    assert.equal(new Set(distinctKeys(plan)).size, plan.length, 'no sentence twice in a day, AI or fixed');
    assert.equal(plan.find((c) => c.personId === 'june').phrasings[0].id.startsWith('ai-'), true, 'an approved AI sentence comes first when both fit');
    const rounds = roundsOf(plan, withAi);
    assert.ok(spacing(rounds.map((r) => r.personId)) >= 3, 'people stay apart');
    assert.ok(rounds.every((r) => r.choices.includes(stories.answerOf(r))), 'the answer is always offered');
  }
  const offList = deckWith([], [{ ...cardOf('j0', 'interest', 'gardening'), phrasingsOff: ['ai-1'] }]);
  assert.ok(!offList.some((c) => c.phrasings.some((p) => p.id === 'ai-1')), 'the per-phrasing switch still works');
  const switchedOff = { ...cardOf('j0', 'interest', 'gardening'), phrasingsOff: ['ai-1'] };
  assert.ok(!deckWith(moreSentences, [switchedOff]).some((c) => c.phrasings.some((p) => p.id === 'ai-1')), 'on an approved sentence too');

  // A reverse card: the name given, the fact the answer, and every other rule the same
  const reverseSentence = { id: 'ai-r', personId: 'june', shape: 'reverse', text: '[NAME] enjoys ____.', facts: [{ id: 'j0', type: 'interest', text: 'gardening' }], answer: 'j0', relationship: 'aunt', status: 'approved' };
  const reverseDeck = deckWith([reverseSentence], [cardOf('j0', 'interest', 'gardening')]);
  const reverseCard = reverseDeck.find((c) => c.personId === 'june');
  const way = reverseCard.phrasings.find((p) => p.id === 'ai-r');
  assert.equal(way.kind, 'reverse');
  assert.equal(way.ask, 'June enjoys {name}.', 'the person is named and the blank is the fact');
  assert.deepEqual([...way.fill.others].sort(), ['hobby 0', 'hobby 1'], 'offered beside other people’s facts of the same kind');
  const reverseRound = stories.roundFor({ ...reverseCard, phrasings: [way] }, reverseDeck, {}, dayRandom);
  assert.equal(stories.answerOf(reverseRound), 'gardening');
  assert.equal(reverseRound.answer, 'June', 'the card still belongs to the person');
  assert.deepEqual([...reverseRound.choices].sort(), ['gardening', 'hobby 0', 'hobby 1']);
  assert.equal(stories.fillBlank(way.reveal, stories.answerOf(reverseRound)), 'June enjoys gardening.', 'it reads back whole');
  assert.equal(stories.hintAt(reverseRound, 1).detail, 'It starts with G.', 'the first hint fits the answer');
  assert.ok(stories.hintAt(reverseRound, 3).fewer, 'and the ladder still ends with fewer choices');
  const places = new Set(Array.from({ length: 40 }, () => stories.roundFor({ ...reverseCard, phrasings: [way] }, reverseDeck, {}, dayRandom).choices.indexOf('gardening')));
  assert.equal(places.size, 3, 'the answer takes every place');
  const moved = stories.roundFor({ ...reverseCard, phrasings: [way] }, reverseDeck, { before: { choices: reverseRound.choices } }, dayRandom);
  assert.notEqual(moved.choices.indexOf('gardening'), reverseRound.choices.indexOf('gardening'), 'and moves from one card to the next');
  const noOthers = cardsOf([{ id: 'june', name: 'June', samplePortrait: 'x' }], [{ id: 'j0', personId: 'june', sentence: '', fact: fact('interest', 'gardening'), variants: [way] }]);
  assert.ok(!noOthers[0].phrasings.some((p) => p.kind === 'reverse'), 'without two others to offer, it simply isn’t asked');

  // What a reverse card offers: never something true of them, or a fact that may change
  const offeredWith = (...others) => {
    const people = [{ id: 'june', name: 'June', samplePortrait: 'x' }, ...others.map(([id]) => ({ id, name: id, samplePortrait: 'x' })), { id: 'mae', name: 'Mae', samplePortrait: 'x' }];
    const juneFacts = [{ id: 'j0', personId: 'june', sentence: '', fact: fact('interest', 'gardening'), variants: [way] }, { id: 'j1', personId: 'june', sentence: '', fact: fact('interest', 'Card Games') }];
    const theirs = others.map(([id, text, more = {}]) => ({ id: `${id}-0`, personId: id, sentence: '', fact: { ...fact('interest', text), ...more } }));
    const card = cardsOf(people, [...juneFacts, ...theirs]).find((c) => c.id === 'j0');
    return card.phrasings.find((p) => p.kind === 'reverse')?.fill.others;
  };
  assert.deepEqual(offeredWith(['leo', 'card games'], ['ruth', 'walking'], ['omar', 'chess']).sort(), ['chess', 'walking'], 'what is also true of them is never offered as not the answer');
  assert.equal(offeredWith(['leo', 'card games'], ['ruth', 'walking']), undefined, 'and if that leaves too few, it isn’t asked');
  assert.deepEqual(offeredWith(['ruth', 'walking'], ['omar', 'chess'], ['bo', 'a new job', { timeSensitive: true, asOf: '2026-05' }]).sort(), ['chess', 'walking'], 'a fact that may change only ever appears dated');
  assert.deepEqual(offeredWith(['ruth', 'walking'], ['omar', 'Walking'], ['bo', 'chess']).map((text) => text.toLowerCase()).sort(), ['chess', 'walking'], 'the same words are offered once');
  assert.ok(!reveal.startsHidden({ ...reverseRound, revealOk: true }, 'often', 'day1', always) && !reveal.startsHidden({ ...reverseRound, revealOk: true, personId: 'bo' }, 'often', 'day2', always), 'never a reveal card: it already names them');
  assert.ok(inRepo('src/components/practice-screen.tsx').includes("if (card.phrasing.kind !== 'reverse') noteAnswer("), 'and it can’t unlock one');
  const twoFact = { id: 'ai-2f', personId: 'june', shape: 'two_facts', text: '____ enjoys gardening and loves soup.', facts: [{ id: 'g1', type: 'interest', text: 'gardening' }, { id: 'g2', type: 'food', text: 'soup' }], relationship: 'aunt', status: 'approved' };
  const twoCards = [cardOf('g1', 'interest', 'gardening'), cardOf('g2', 'food', 'soup'), cardOf('g3', 'home', 'Ohio')];
  const twoDeck = deckWith([twoFact], twoCards);
  const twoCard = twoDeck.find((c) => c.id === 'g1');
  const twoRound = stories.roundFor({ ...twoCard, phrasings: twoCard.phrasings.filter((p) => p.id === 'ai-2f') }, twoDeck, {}, dayRandom);
  assert.equal(twoRound.clue, 'This person lives in Ohio.', 'a hint never repeats a fact the sentence already says');
  assert.deepEqual(variants.approvedVariants([{ ...twoFact, status: 'pending' }], 'g1', june, twoCards[0]), [], 'only approved sentences become phrasings');
  assert.deepEqual(variants.approvedVariants([twoFact], 'g2', june, twoCards[1]), [], 'a sentence joins one card: the first fact it used');

  // With no AI in play, practice is what it was
  assert.deepEqual(deckWith([], plainCards, null), deckWith([], plainCards, ai([])), 'no sentences and no AI build the same deck');
  const asTemplates = deckWith(all, plainCards, null).flatMap((c) => c.phrasings);
  assert.ok(!asTemplates.some(variants.isAiPhrasing), 'sentences saved on the phone are ignored with AI off');

  // The real people are held back, and the one network call is in one place
  const storeCode = inRepo('src/data/local-store.ts');
  assert.ok(storeCode.includes('!HELD_BACK_FROM_AI.has(personId)') && /HELD_BACK_FROM_AI = new Set\(localDeck\.map/.test(storeCode), 'the local deck’s real people are never sent, flagged or not');
  assert.ok(storeCode.includes('settings.aiConsentAt') && storeCode.includes('settings.aiOn !== false') && storeCode.includes('person.aiOk !== false'), 'nothing is sent without consent, or past either switch');
  assert.ok(/profileCompletion\(about\(person\), cards\) < 100/.test(storeCode), 'complete profiles only');
  const callers = walkFiles('src').filter((path) => !path.endsWith('.web.ts') && /\bfetch\(/.test(inRepo(path)));
  assert.deepEqual(callers, ['src/data/ai-client.ts'], 'the only direct network call in the app');
  assert.deepEqual(walkFiles('src').filter((path) => /from '@\/data\/ai-client'/.test(inRepo(path)) && !/import type/.test(inRepo(path).split('\n').find((line) => line.includes("'@/data/ai-client'")))), ['src/data/local-store.ts'], 'and one caller');
  assert.ok(!/photo|uri|image/i.test(inRepo('src/data/ai-client.ts').replace(/\/\/.*/g, '')) && !/photoUri|photoPath|photoUrl/.test(inRepo('src/lib/ai-request.ts')), 'no photo goes anywhere near it');
  const tokenCode = inRepo('src/lib/install-token.ts');
  assert.ok(tokenCode.includes('expo-secure-store') && !tokenCode.includes('AsyncStorage'), 'the install token lives in secure storage');
  const consentCode = inRepo('src/components/ai-questions.tsx');
  // Since 2026-11-13 in step with "AI questions" in the privacy policy (src/lib/privacy-policy.ts).
  assert.ok(consentCode.includes('approved facts are sent as text to an AI service') && consentCode.includes('names are replaced first. Photos are never sent'), 'consent says what is sent, in plain words');
  assert.ok(!/nothing is saved/i.test(consentCode), 'and promises only what Evermore controls');
  assert.ok(!/\bred\b|wrong|score/i.test(consentCode.replace(/\/\/.*/g, '').replace(/Colors\.\w+/g, '')), 'calm words only');
}

// The palette: every text pairing at least 4.5:1, and no tan, beige or cream
const { Colors, TEXT_PAIRS } = await import('@/theme/colors');
const channel = (v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
const luminance = (hex) => rgb(hex).map(channel).reduce((sum, v, i) => sum + v * [0.2126, 0.7152, 0.0722][i], 0);
const contrast = (a, b) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};
for (const [text, on] of TEXT_PAIRS) {
  const ratio = contrast(Colors[text], Colors[on]);
  assert.ok(ratio >= 4.5, `${text} on ${on} is ${ratio.toFixed(2)}:1, under 4.5:1`);
}
function hsl(hex) {
  const [r, g, b] = rgb(hex);
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l };
  const d = max - min;
  const h = max === r ? ((g - b) / d + 6) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return { h: h * 60, s: l > 0.5 ? d / (2 - max - min) : d / (max + min), l };
}
// Tan and beige are muted warm tones; cream is a warm near-white.
const tanBeigeOrCream = ({ h, s, l }) => h >= 20 && h <= 60 && s > 0 && ((s < 0.65 && l > 0.55) || l >= 0.9);
for (const [name, hex] of Object.entries(Colors)) assert.ok(!tanBeigeOrCream(hsl(hex)), `${name} ${hex} is tan, beige or cream`);
// Red: a saturated hue near 0°. The Memory score's pinks are rose, well clear of it, and nothing in the palette is red.
const isRed = ({ h, s, l }) => (h >= 345 || h <= 15) && s > 0.45 && l > 0.2 && l < 0.7;
for (const [name, hex] of Object.entries(Colors)) assert.ok(!isRed(hsl(hex)), `${name} ${hex} is red`);
for (const hex of ['#FF0000', '#D32F2F', '#E53935', '#C62828']) assert.ok(isRed(hsl(hex)), `the check catches ${hex}`);
{
  const { MARK_PAIRS } = await import('@/theme/colors');
  const pinks = Object.keys(Colors).filter((name) => name.startsWith('pink'));
  assert.deepEqual(pinks, ['pinkTint', 'pink1', 'pink2', 'pink3', 'pink4', 'pinkDeep', 'pinkInk'], 'a small family of pinks');
  for (const name of pinks) {
    const { h } = hsl(Colors[name]);
    assert.ok(h >= 325 && h <= 345, `${name} is a rose pink (hue ${h.toFixed(0)})`);
  }
  // Light to deep: each band's pink is darker than the one below it.
  const ladder = ['pinkTint', 'pink1', 'pink2', 'pink3', 'pink4', 'pinkDeep', 'pinkInk'].map((name) => luminance(Colors[name]));
  assert.ok(ladder.every((value, index) => index === 0 || value < ladder[index - 1]), 'the pinks go from light to deep');
  // The brand's pinks: Rose is the arc pink, and Deep Rose the caregiver's link color, apart from the family.
  const { Brand } = await import('@/theme/colors');
  assert.equal(Colors.pinkDeep, Brand.rose, 'Rose is in the family');
  assert.equal(Colors.deepRose, Brand.deepRose, 'Deep Rose is the caregiver’s link color');
  assert.ok(contrast(Brand.rose, '#FFFFFF') < 4.5, 'Rose is too light for small text, so it is never a text color');
  assert.ok(!TEXT_PAIRS.some(([text]) => ['sky', 'accent', 'surface', 'skySoft', 'accentSoft'].includes(text)), 'Sky, Mist and Sun are never text');
  for (const path of walkFiles('src')) assert.ok(!/color[=:]\s*\{?\s*Colors\.(sky|accent|surface|skySoft|accentSoft|softSuccess|pinkDeep)\b/.test(inRepo(path)), `${path} draws text or an icon in Sky, Mist, Sun or Rose`);
  for (const [mark, on] of MARK_PAIRS) {
    const ratio = contrast(Colors[mark], Colors[on]);
    assert.ok(ratio >= 3, `${mark} marks on ${on} are ${ratio.toFixed(2)}:1, under 3:1`);
  }
  for (const name of pinks.slice(1, 5)) assert.ok(TEXT_PAIRS.some(([text, on]) => text === 'text' && on === name), `${name} carries text, checked at 4.5:1`);
  // Pink is the Insights accent and the Memory score's color (since 2026-11-10): only the Insights files
  // and the caregiver dashboard that hosts their tab may use it, and nothing a person's screen imports.
  // Deep Rose (Colors.deepRose) and the brand's own Rose and Deep Rose count as pink too (since 2026-11-16).
  const PINK = /\bColors\.(pink(Tint|Ink|Deep|[1-4])|deepRose)\b|\bBrand\.(rose|deepRose)\b/;
  // The report (Export my data → Report (PDF)) carries the Memory score's pinks too, since 2026-11-13.
  const insightsFamily = (path) => /^src\/components\/(insight|score-|day-sheet)/.test(path) || ['src/theme/colors.ts', 'src/app/caregiver/index.tsx', 'src/lib/insight-report.ts'].includes(path);
  // Deep Rose links and accents on every caregiver screen (since 2026-11-16): the caregiver layout gives the
  // color through src/theme/accent.tsx, so the shared components a person's screen also reaches never name it.
  const caregiverAccent = (path) => path === 'src/app/caregiver/_layout.tsx';
  const users = walkFiles('src').filter((path) => PINK.test(inRepo(path)));
  for (const path of users) assert.ok(insightsFamily(path) || caregiverAccent(path), `${path} uses the Insights pinks`);
  assert.ok(/<AccentProvider color=\{Colors\.deepRose\}>/.test(inRepo('src/app/caregiver/_layout.tsx')), 'the caregiver layout gives Deep Rose to its screens');
  assert.ok(!PINK.test(inRepo('src/theme/accent.tsx')) && /createContext<string>\(Colors\.primaryDark\)/.test(inRepo('src/theme/accent.tsx')), 'without the caregiver layout, the accent is the person’s ink-blue');
  assert.ok(users.includes('src/app/caregiver/index.tsx') && users.includes('src/components/insight-ring.tsx'), 'the check sees the files that do use them');
  // Every file a person-facing screen reaches, through every import, is free of pink.
  const resolveImport = (from, spec) => {
    const base = spec.startsWith('@/') ? `src/${spec.slice(2)}` : spec.startsWith('.') ? new URL(spec, `file:///${from}`).pathname.slice(1) : undefined;
    if (!base) return undefined;
    return [`${base}.tsx`, `${base}.ts`, `${base}.web.ts`, `${base}/index.ts`].find((candidate) => existsSync(new URL(`../${candidate}`, import.meta.url)));
  };
  const reached = new Set();
  const stack = ['src/app/index.tsx', 'src/app/practice.tsx', 'src/app/sign-in.tsx', 'src/app/_layout.tsx'];
  while (stack.length) {
    const path = stack.pop();
    if (reached.has(path)) continue;
    reached.add(path);
    for (const match of inRepo(path).matchAll(/(?:from|require\()\s*['"]([^'"]+)['"]/g)) {
      const next = resolveImport(path, match[1]);
      if (next) stack.push(next);
    }
  }
  assert.ok(reached.has('src/components/practice-screen.tsx') && reached.has('src/theme/colors.ts') && reached.size > 20, `the walk follows the person's imports (${reached.size} files)`);
  for (const path of reached) {
    if (path === 'src/theme/colors.ts') continue;
    assert.ok(!PINK.test(inRepo(path)), `${path} is reached from a person's screen and uses pink`);
    // The shared data layer reaches the figures (src/lib/insights.ts) for the caregiver's stores; no view of them may be reached.
    assert.ok(!/^src\/components\/(insight|score-|day-sheet|tabs)/.test(path), `${path} is an Insights view reached from a person's screen`);
    // Export my data is the caregiver's alone: no person-facing screen reaches its choices, its server reads or the report.
    assert.ok(!/^src\/(components\/export-data|data\/export-(data|store)|lib\/insight-report)\./.test(path), `${path} is part of Export my data, reached from a person's screen`);
  }
}
for (const hex of ['#fff9f0', '#eae2d6', '#d2b48c', '#f5f5dc', '#fffdd0']) assert.ok(tanBeigeOrCream(hsl(hex)), `the check catches ${hex}`);

// The type scale: four sizes, in order at every Text size, each growing with the setting
const { COMPACT_MAX_SCALE, COMPACT_SCALE, TYPE_SCALE } = await import('@/theme/type-scale');
assert.ok(COMPACT_SCALE.body >= 15 && COMPACT_SCALE.body <= 17, 'the caregiver reads 15 to 17pt body text');
assert.ok(COMPACT_SCALE.title >= 20 && COMPACT_SCALE.title <= 22, 'and 20 to 22pt step titles');
assert.equal(COMPACT_SCALE.caption, 13, 'and 13pt helper text');
assert.ok(COMPACT_SCALE.body < TYPE_SCALE.small.body, 'slimmer than any size the person can choose');
assert.ok(COMPACT_MAX_SCALE > 1 && COMPACT_MAX_SCALE <= 1.5, 'system text size still counts, up to a limit');
const levels = ['small', 'medium', 'large', 'xlarge'];
assert.deepEqual(Object.keys(TYPE_SCALE), levels);
for (const level of levels) {
  const s = TYPE_SCALE[level];
  assert.ok(s.display > s.title && s.title > s.body && s.body > s.caption, `${level}: sizes in order`);
}
for (const size of ['display', 'title', 'body', 'caption']) {
  const row = levels.map((level) => TYPE_SCALE[level][size]);
  assert.ok(row.every((value, i) => i === 0 || value > row[i - 1]), `${size} grows with each Text size`);
}
assert.ok(TYPE_SCALE.medium.body >= 20, 'body text at the default size stays large');

// Archived people: kept whole, out of the deck at once, back as they were, and gone only when deleted
{
  const ai = await import('@/lib/ai-sentences');
  const whole = families.settleDeck(families.setRevealOk(families.setHints(gated(), 'in1', { ...ALL_HINTS, fewer: false }), 'in1', false), hasPicture);
  const archived = families.settleDeck(families.archivePerson(whole, 'in1', now11), hasPicture);
  const ann = archived.people.find((p) => p.id === 'in1');
  assert.equal(ann.archivedAt, now11.toISOString(), 'archiving saves when');
  assert.equal(ann.inDeck, false, 'and takes them out of the deck at once');
  assert.deepEqual(archived.cards, whole.cards, 'every fact stays');
  const { archivedAt: _when, inDeck: _out, ...annKept } = ann;
  const { inDeck: _in, ...annWas } = whole.people.find((p) => p.id === 'in1');
  assert.deepEqual(annKept, annWas, 'and every setting: photo, hints, reveal opt-out, include in practice');
  assert.ok(!profile.deckOf(archived.people, archived.cards, hasPicture).people.some((p) => p.id === 'in1'), 'practice leaves them out');
  assert.deepEqual(families.settleDeck(families.restorePerson(archived, 'in1'), hasPicture), whole, 'restoring brings them back exactly as they were');
  assert.equal(families.restorePerson(whole, 'in2').people.find((p) => p.id === 'in2').archivedAt, undefined, 'restoring someone active changes nothing');

  // Include in practice is its own switch: archiving is stronger, and restoring keeps what it was
  const resting = families.settleDeck(families.setIncluded(whole, 'in1', false), hasPicture);
  const restedBack = families.settleDeck(families.restorePerson(families.archivePerson(resting, 'in1', now11), 'in1'), hasPicture);
  assert.deepEqual([restedBack.people.find((p) => p.id === 'in1').includeInPractice, restedBack.people.find((p) => p.id === 'in1').inDeck], [false, false], 'someone deselected comes back deselected');
  const includedArchived = families.settleDeck(families.archivePerson(whole, 'in2', now11), hasPicture);
  assert.ok(includedArchived.people.find((p) => p.id === 'in2').includeInPractice !== false && !includedArchived.people.find((p) => p.id === 'in2').inDeck, 'archived stays out even while included');
  const draftBack = families.settleDeck(families.restorePerson(families.archivePerson(whole, 'd', now11), 'd'), hasPicture);
  assert.ok(!draftBack.people.find((p) => p.id === 'd').inDeck, 'a draft comes back a draft');

  // AI sentences stay with an archived person and go with a deleted one
  const kept = [{ id: 'ai-1', personId: 'in1', status: 'rejected' }, { id: 'ai-2', personId: 'in1', status: 'flagged' }, { id: 'ai-3', personId: 'in2', status: 'rejected' }];
  assert.equal(ai.settleSentences(kept, archived.people, archived.cards), kept, 'archiving keeps their sentences');
  const deleted = families.removePerson(archived, 'in1');
  assert.deepEqual(ai.settleSentences(kept, deleted.people, deleted.cards).map((one) => one.id), ['ai-3'], 'deleting takes them away');
  assert.ok(!deleted.cards.some((c) => c.personId === 'in1'), 'and every fact');

  // What the phone kept of their practice goes too, except the day totals, which name nobody
  const at = now11.toISOString();
  const kept11 = {
    ...local.emptyPractice(now11),
    schedule: { a1: { step: 2, dueAt: at, updatedAt: at }, b1: { step: 1, dueAt: at, updatedAt: at } },
    finished: [{ cardId: 'a1', at }, { cardId: 'b1', at }],
    sessions: [{ id: 's', startedAt: at, completedAt: at, cardsCompleted: 2, dailyGoal: 36 }],
    today: { day: '2026-11-03', asked: [{ personId: 'in1', cardId: 'a1', key: 'Ann plays golf.', kind: 'blank' }, { personId: 'in2', cardId: 'b1', key: 'Bo plays chess.', kind: 'blank' }] },
    lastPhrasing: { in1: 'blank-1', in2: 'ask-2' },
    lastChoices: { in1: ['Ann', 'Bo', 'Dee'], in2: ['Bo', 'Ann', 'Dee'], d: ['Dee', 'Bo'] },
  };
  const forgot = local.forgetPerson(kept11, { id: 'in1', name: 'Ann' }, ['a1'], ['Bo', 'Dee']);
  assert.deepEqual([Object.keys(forgot.schedule), forgot.finished.map((f) => f.cardId)], [['b1'], ['b1']], 'their schedule and week go');
  assert.deepEqual(forgot.today.asked.map((one) => one.personId), ['in2'], 'and today’s questions about them');
  assert.deepEqual([forgot.lastPhrasing, forgot.lastChoices], [{ in2: 'ask-2' }, { d: ['Dee', 'Bo'] }], 'and how they were asked, and any last choices that showed their name');
  assert.deepEqual(forgot.sessions, kept11.sessions, 'past day totals stay as they were');
  assert.ok(!JSON.stringify(forgot).includes('Ann'), 'nothing on the phone names them any more');
  assert.deepEqual(local.forgetPerson(kept11, { id: 'in1', name: 'Ann' }, ['a1'], ['Ann', 'Bo']).lastChoices.in2, ['Bo', 'Ann', 'Dee'], 'unless someone else has the same name');

  // Clear test data reaches archived people too, and leaves them archived
  const realId = exampleDeck.find((person) => !TEST_DATA.samples.some((sample) => sample.id === person.id)).id;
  const seeded = families.archivePerson(families.seedTestData(families.seedFamily(families.EMPTY_FAMILY, exampleDeck), TEST_DATA), realId, now11);
  assert.ok(families.hasTestData({ people: seeded.people.filter((p) => p.id === realId), cards: seeded.cards.filter((c) => c.personId === realId) }), 'an archived person can hold test data');
  const clearedArchive = families.clearTestData(seeded);
  assert.ok(!clearedArchive.cards.some((c) => c.personId === realId && c.testData) && !clearedArchive.people.find((p) => p.id === realId).testMarks, 'clearing removes theirs too');
  assert.equal(clearedArchive.people.find((p) => p.id === realId).archivedAt, now11.toISOString(), 'and they stay archived');
}

// What archived means in practice: no card of any kind, no name among the choices, no fact in a
// hint, no share of the day; and the day's target when someone leaves mid-day
{
  const { goalToday, enoughPeople } = sessions5;
  let six = families.EMPTY_FAMILY;
  for (const [i, name] of ['Ann', 'Bo', 'Cy', 'Di', 'Ed', 'Flo'].entries()) {
    const theirFacts = [fact('interest', `hobby ${i}`), fact('shared', `went on trip ${i}`), fact('food', `dish ${i}`), fact('work', `job ${i}`)];
    six = families.addPerson(six, { id: `q${i}`, name, relationship: 'friend', photoUri: `file:///${i}.jpg` }, theirFacts, nextId);
  }
  for (const card of six.cards) six = families.setStatus(six, card.id, 'approved', now11);
  six = families.settleDeck(six, hasPicture);
  const deckOfFamily = (f) => {
    const built = sessions5.practiceFrom(f.people, f.cards, hasPicture);
    return cardsOf(built.people, built.cards);
  };
  const fullDeck = deckOfFamily(six);
  const withoutCy = families.settleDeck(families.archivePerson(six, 'q2', now11), hasPicture);
  const deckNow = deckOfFamily(withoutCy);
  assert.ok(fullDeck.some((c) => c.personId === 'q2') && !deckNow.some((c) => c.personId === 'q2'), 'no card of theirs is left in the deck');
  const cyWords = six.cards.filter((c) => c.personId === 'q2').map((c) => c.text);
  const kinds = new Set();
  // What the phone remembers from before can't bring their name back.
  let last = { q0: { phrasing: 'x', choices: ['Cy', 'Ann', 'Bo'] } };
  for (let run = 0; run < 60; run++) {
    const plan = { deck: deckNow, schedule: {}, now, asked: [], last, random: dayRandom };
    const plans = [
      planToday({ ...plan, goal: dailyTarget(deckNow, 'long'), completed: 0 }),
      planMore(plan),
      planPerson(`q${[0, 1, 3, 4, 5][run % 5]}`, plan),
    ];
    assert.equal(planPerson('q2', plan).length, 0, 'their own session has nothing in it');
    for (const cards of plans) {
      for (const round of stories.makeRounds(cards, deckNow, last, dayRandom)) {
        kinds.add(round.phrasing.kind);
        assert.ok(round.personId !== 'q2' && round.answer !== 'Cy', 'never a card about them');
        assert.ok(!round.choices.includes('Cy'), 'never their name among the choices');
        const said = [round.phrasing.ask, round.clue ?? '', ...[1, 2, 3, 4].map((misses) => hintAt(round, misses).lead)].join(' ');
        assert.ok(!cyWords.some((text) => said.includes(text)), 'and never their facts, in a question or a hint');
        last = { ...last, [round.personId]: { phrasing: round.phrasing.id, choices: round.choices } };
      }
    }
  }
  assert.deepEqual([...kinds].sort(), ['ask', 'blank', 'photo', 'who'], 'on every kind of card');
  assert.deepEqual(deckOfFamily(families.settleDeck(families.restorePerson(withoutCy, 'q2'), hasPicture)), fullDeck, 'restoring brings every card back as it was');

  // Archived mid-day: what they finished counts, the rest of their day goes, the bar never moves back
  // As the stores do it: each change works the target out again from the deck and today's log.
  // A record's or a moment's study day (the days these checks count in).
  const dayKey = studyDays.studyDayKey;
  const day = dayKey(now);
  const counted = (personId, n, extra = false) => Array.from({ length: n }, (_, i) => ({ personId, cardId: `${personId}-${i}`, key: `${personId} ${i} ${extra}`, kind: 'blank', extra }));
  const asked = [...counted('p0', 2), ...counted('p0', 1, true), ...counted('p1', 4), ...counted('p5', 4)];
  const without = (deck, personId) => deck.filter((c) => c.personId !== personId);
  const twelvePeople = deckFor(Array(12).fill(3));
  const morning12 = goalToday(twelvePeople, 'standard', { day, asked }, day);
  assert.equal(morning12.goal, 36, 'nobody gone: the deck’s own target');
  assert.equal(goalToday(without(twelvePeople, 'p0'), 'standard', morning12.log, day).goal, 36, 'at the floor the target holds, so the bar doesn’t move');
  const fifteen = deckFor(Array(15).fill(3));
  const fourteen = without(fifteen, 'p0');
  assert.deepEqual([dailyTarget(fifteen, 'standard'), dailyTarget(fourteen, 'standard')], [45, 42]);
  const morning15 = goalToday(fifteen, 'standard', { day, asked }, day);
  const archived15 = goalToday(fourteen, 'standard', morning15.log, day);
  assert.equal(archived15.goal, 44, 'their two finished cards still count, and their third is gone');
  assert.equal(goalToday(fourteen, 'standard', { ...morning15.log, asked: [...asked, ...counted('p0', 5, true)] }, day).goal, 44, 'cards back after a hint never count, so the target can’t tell how answers went');
  assert.equal(goalToday(fourteen, 'standard', archived15.log, day).goal, 44, 'it holds for the rest of the day');
  assert.equal(goalToday(fifteen, 'standard', archived15.log, day).goal, 45, 'restoring them gives their share back');
  assert.equal(goalToday(fourteen, 'standard', archived15.log, dayKey(new Date(2026, 10, 3, 9))).goal, 42, 'and a new day starts fresh');
  assert.equal(goalToday(deckFor([3]), 'standard', morning15.log, day).goal, 45, 'down to one person, a day already begun keeps its target, so the bar holds');
  assert.equal(goalToday(deckFor([3]), 'standard', goalToday(fifteen, 'standard', { day, asked: [] }, day).log, day).goal, 0, 'with nothing done yet, there is no target at all');
  assert.equal(goalToday(deckFor([3]), 'standard', undefined, day).goal, 0, 'nor for one person from the start');
  const small = deckFor([4, 2, 4, 3]);
  const smallMorning = goalToday(small, 'long', undefined, day);
  assert.ok(dailyTarget(without(small, 'p1'), 'long') > smallMorning.goal, 'fewer people need less spacing, so a smaller deck can allow more');
  assert.equal(goalToday(without(small, 'p1'), 'long', smallMorning.log, day).goal, smallMorning.goal, 'yet the target holds when someone leaves, even someone who did nothing today');
  for (let run = 0; run < 400; run++) {
    const people = 3 + Math.floor(dayRandom() * 14);
    const deck = deckFor(Array.from({ length: people }, () => 2 + Math.floor(dayRandom() * 4)));
    const length = ['short', 'standard', 'long'][run % 3];
    const morning = goalToday(deck, length, undefined, day);
    const plan = planToday({ deck, schedule: {}, now, goal: morning.goal, completed: 0, asked: [], random: dayRandom });
    const done = Math.floor(dayRandom() * (plan.length + 1));
    const askedSoFar = plan.slice(0, done).map((c) => ({ personId: c.personId, cardId: c.id, key: sentenceKey(c.personId, c.phrasings[0]), kind: c.phrasings[0].kind }));
    const midday = goalToday(deck, length, { ...morning.log, asked: askedSoFar }, day);
    assert.equal(midday.goal, morning.goal, 'practicing never moves the target');
    const leaver = askedSoFar.length && dayRandom() < 0.8 ? askedSoFar[Math.floor(dayRandom() * askedSoFar.length)].personId : `p${Math.floor(dayRandom() * people)}`;
    const after = without(deck, leaver);
    const archivedNow = goalToday(after, length, midday.log, day);
    assert.ok(archivedNow.goal <= midday.goal, `${people} people, ${length}: when someone leaves the target never grows, so the bar never moves back`);
    assert.ok(done <= archivedNow.goal || archivedNow.goal === 0, 'and never passes the end');
    assert.equal(goalToday(after, length, archivedNow.log, day).goal, archivedNow.goal, 'and stays put after');
    const rest = planToday({ deck: after, schedule: {}, now, goal: archivedNow.goal, completed: done, asked: askedSoFar, random: dayRandom });
    assert.ok(!rest.some((c) => c.personId === leaver), 'their remaining cards are gone');
    assert.equal(rest.length, Math.max(archivedNow.goal - done, 0), 'and the day ends exactly at its target');
    assert.equal(goalToday(deck, length, archivedNow.log, day).goal, midday.goal, 'restoring them the same day gives the day back as it was');
  }

  // Fewer than three people: two names on every card, and fewer-names never leaves just one
  const roundsFor = (deck) => stories.makeRounds(planToday({ deck, schedule: {}, now, goal: dailyTarget(deck, 'standard'), completed: 0, asked: [], random: dayRandom }), deck, {}, dayRandom);
  const pairRounds = roundsFor(deckFor([3, 3]));
  assert.ok(pairRounds.length > 0 && pairRounds.every((r) => r.choices.length === 2 && new Set(r.choices).size === 2), 'two people: two names on every card');
  assert.ok(pairRounds.every((r) => !hintLadder(r).includes('fewer') && !hintAt(r, 9).fewer), 'so the fewer-names hint is left out');
  assert.ok(roundsFor(deckFor([3, 3, 3])).every((r) => r.choices.length === 3 && hintLadder(r).includes('fewer')), 'three people: three names, and fewer names leaves two');
  const solo = deckFor([5]);
  const soloPlan = { deck: solo, schedule: {}, now, asked: [] };
  assert.deepEqual([dailyTarget(solo, 'standard'), planToday({ ...soloPlan, goal: 5, completed: 0 }), planMore(soloPlan), planPerson('p0', soloPlan)], [0, [], [], []], 'one person: no target and no session of any kind');
  assert.ok(!enoughPeople(solo) && !enoughPeople([]) && enoughPeople(deckFor([1, 1])), 'two people are enough');

  // History stays: past days keep their own target, and today only moves forward
  const history = [{ startedAt: new Date(2026, 10, 1, 10).toISOString(), completedAt: null, cardsCompleted: 30, dailyGoal: 45 }, { startedAt: now.toISOString(), completedAt: null, cardsCompleted: 10, dailyGoal: 45 }];
  // A day with no practice shows no practice, whatever today's target is, so only what each day shows is compared.
  const shownDays = (days) => days.slice(0, -1).map(({ key, completed, percent }) => ({ key, completed, percent }));
  const beforeArchive = activity.dailyCompletion(history, 45, now, 30);
  const afterArchive = activity.dailyCompletion(history, 44, now, 30);
  assert.deepEqual(shownDays(afterArchive), shownDays(beforeArchive), 'archiving changes no past day');
  assert.equal(afterArchive.at(-2).goal, 45, 'a practiced day keeps the target it had');
  assert.ok(afterArchive.at(-1).percent >= beforeArchive.at(-1).percent, 'and today only moves forward');
}

// Restoring after a long absence: the overdue cards come back a few a day, not all at once
{
  const { spreadOnReturn } = await import('@/lib/queue');
  const { RETURN_DUE_PER_DAY } = pacing;
  // Nov 2, 9:30. Ten cards overdue by 1 to 10 days, longest first in card order a9 .. a0; two not due yet.
  const away = Object.fromEntries([
    ...Array.from({ length: 10 }, (_, i) => [`a${i}`, { step: 1 + (i % 5), dueAt: new Date(2026, 10, 2 - 1 - i, 0).toISOString(), updatedAt: 'x' }]),
    ['later', { step: 4, dueAt: new Date(2026, 10, 6).toISOString(), updatedAt: 'x' }],
    ['other', { step: 2, dueAt: new Date(2026, 9, 1).toISOString(), updatedAt: 'x' }],
  ]);
  const theirs = [...Array.from({ length: 10 }, (_, i) => `a${i}`), 'later', 'new'];
  const moved = spreadOnReturn(away, theirs, new Date(2026, 9, 20).toISOString(), now);
  const dueOn = (id) => (moved[id] ?? away[id]).dueAt;
  // A study day begins at 05:30, so returning cards fall due then.
  const startOf = (days) => new Date(2026, 10, 2 + days, 5, 30).toISOString();
  assert.equal(RETURN_DUE_PER_DAY, 3, 'a few a day: about one person’s share of a Standard day');
  assert.deepEqual(['a9', 'a8', 'a7'].map((id) => id in moved), [false, false, false], 'the longest overdue stay due today');
  assert.deepEqual(['a6', 'a5', 'a4'].map(dueOn), [startOf(1), startOf(1), startOf(1)], 'the next three tomorrow');
  assert.deepEqual(['a3', 'a2', 'a1'].map(dueOn), [startOf(2), startOf(2), startOf(2)], 'the next the day after');
  assert.equal(dueOn('a0'), startOf(3), 'and the last one after that');
  assert.ok(Object.entries(moved).every(([id, entry]) => entry.step === away[id].step && entry.updatedAt === 'x'), 'each keeps its step');
  assert.ok(!('later' in moved) && !('other' in moved) && !('new' in moved), 'cards not due yet, someone else’s and new ones stay as they are');
  assert.deepEqual(spreadOnReturn(away, theirs, new Date(2026, 10, 2, 8).toISOString(), now), {}, 'archived and restored the same day, as with Undo, nothing moves');
  assert.deepEqual(spreadOnReturn(away, ['a0', 'a1'], new Date(2026, 9, 20).toISOString(), now), {}, 'a few overdue are simply due');
  // US clocks change on 8 March 2026.
  const march = Object.fromEntries(Array.from({ length: 9 }, (_, i) => [`m${i}`, { step: 2, dueAt: new Date(2026, 1, 20 - i).toISOString() }]));
  const dst = spreadOnReturn(march, Object.keys(march), new Date(2026, 1, 1).toISOString(), new Date(2026, 2, 7, 9));
  assert.ok(Object.keys(dst).length === 6 && Object.values(dst).every((entry) => new Date(entry.dueAt).getHours() === 5 && new Date(entry.dueAt).getMinutes() === 30), 'spread days start at 05:30 local, the start of a study day, across a clock change too');
  // With the plan: the first day back asks only what's due today, and nobody else loses their share
  const family = deckFor([4, 4, 4, 4, 4]);
  const restoredSchedule = Object.fromEntries(family.filter((c) => c.personId === 'p0').map((c, i) => [c.id, { step: 2, dueAt: new Date(2026, 10, 2 - 8 - i).toISOString() }]));
  const spread = { ...restoredSchedule, ...spreadOnReturn(restoredSchedule, Object.keys(restoredSchedule), new Date(2026, 9, 1).toISOString(), now) };
  const dueNow = Object.values(spread).filter((entry) => new Date(entry.dueAt) <= now).length;
  assert.equal(dueNow, RETURN_DUE_PER_DAY, 'of their four overdue facts, three are due today');
  const firstDay = planToday({ deck: family, schedule: spread, now, goal: dailyTarget(family, 'standard'), completed: 0, asked: [], random: dayRandom });
  const theirFirstDay = firstDay.filter((c) => c.personId === 'p0').length;
  assert.ok(theirFirstDay <= Math.ceil(dailyTarget(family, 'standard') / 5) + 1, `their first day back is a fair share, not a flood (${theirFirstDay})`);
}

// Insights, phase 1: the record of each card, and active time counted honestly
{
  const attemptsLib = await import('@/lib/attempts');
  const insightsLib = await import('@/lib/insights');
  const { ACTIVE_TIME, ATTEMPTS_KEPT_DAYS } = await import('@/config/insights');
  const { activeBetween, attemptOf, resolvedOn, counted, cappedMs, keptAttempts, monthOf } = attemptsLib;

  // Active time: background spells never count, and no gap between taps counts beyond a minute
  assert.deepEqual([ACTIVE_TIME.idleGapMs, ACTIVE_TIME.cardCapMs], [60_000, 90_000], 'a minute between taps at most, and 90 seconds a card for averages');
  assert.equal(activeBetween([0, 2_000, 5_000], []), 5_000, 'in use the whole time: all of it counts');
  assert.equal(activeBetween([0, 5_000], [[1_000, 4_000]]), 2_000, 'three seconds in the background come off');
  assert.equal(activeBetween([0, 1_000], [[-1_000, 500]]), 500, 'only the part of a spell inside the card');
  assert.equal(activeBetween([0, 120_000], []), 60_000, 'a long gap between taps counts as a minute at most');
  assert.equal(activeBetween([0, 30_000, 200_000], [[100_000, 150_000]]), 90_000, 'background first, then the idle cap: 30 s, then 120 s capped to 60');
  assert.equal(activeBetween([0], []), 0, 'a card left at once');
  assert.deepEqual([cappedMs(45_000), cappedMs(300_000)], [45_000, 90_000], 'for averages a card counts for 90 seconds at most');

  // The record of a card, from what the card measured
  const asked = { id: 'june-0', personId: 'june', phrasing: { id: 'interest-who', kind: 'who' }, fact: { type: 'interest' }, choices: ['June', 'Leo', 'Mae'] };
  const t0 = new Date(2026, 10, 2, 10, 0).getTime();
  const timing = { shownAt: t0, selections: [{ at: t0 + 3_000, right: false }, { at: t0 + 7_000, right: true }], away: [[t0 + 4_000, t0 + 6_000]], leftAt: t0 + 12_000, hints: ['letter'] };
  const record = attemptOf(asked, timing, { id: 'a1', sessionId: 's1', goal: 36, source: 'template' });
  assert.deepEqual(
    { shape: record.shape, factType: record.factType, source: record.source, choices: record.choices, success: record.success, hints: record.hints, goal: record.goal },
    { shape: 'who', factType: 'interest', source: 'template', choices: 3, success: true, hints: ['letter'], goal: 36 },
    'the record says what was asked, how many answers were offered, the hints and the day’s target',
  );
  assert.deepEqual(record.selections, [{ at: new Date(t0 + 3_000).toISOString(), right: false }, { at: new Date(t0 + 7_000).toISOString(), right: true }], 'each choice in order, with its time');
  assert.equal(record.firstSelectionMs, 3_000, 'three seconds to the first choice');
  assert.equal(record.activeMs, 10_000, 'twelve seconds on the card, less two in the background');
  assert.ok(!('reveal' in record) && !('usedReveal' in record) && !('cardType' in record), 'whether the card started behind the "?", or the "?" was tapped, is never recorded');
  assert.ok(!/reveal/.test(inRepo('src/lib/attempts.ts').split('\n').filter((line) => line.startsWith('import')).join('\n')), 'and the record can’t read the reveal unlock');
  const left = attemptOf({ ...asked, fact: undefined, again: true }, { shownAt: t0, selections: [], away: [], leftAt: t0 + 4_000, hints: [] }, { id: 'a2', sessionId: 's1', goal: 36, source: 'ai' });
  assert.deepEqual([left.success, left.firstSelectionMs, left.factType, left.extra, left.source], [false, undefined, undefined, true, 'ai'], 'left before answering: no success and no first choice; a card from before facts has no kind; a re-ask is marked');
  assert.equal(attemptOf(asked, { ...timing, selections: timing.selections.slice(0, 1) }, { id: 'a3', sessionId: 's1', goal: 36, source: 'template' }).success, false, 'only a right answer ends a card');

  // On which choice a card was resolved, and what counts
  const pick = (...rights) => ({ success: rights.includes(true), selections: rights.map((right) => ({ at: '', right })) });
  assert.deepEqual([pick(true), pick(false, true), pick(false, false, true), pick(false, false, false, true), pick(false)].map(resolvedOn), [1, 2, 3, 3, undefined], 'first, second, third or later, and never');
  assert.deepEqual([counted(record), counted(left), counted({ ...record, extra: true })], [true, false, false], 'the day’s resolved cards count; a card left unanswered or one back after a hint doesn’t');

  // Kept on the phone by month, for 120 days
  assert.equal(ATTEMPTS_KEPT_DAYS, 120);
  const at = (y, m, d) => ({ shownAt: new Date(y, m, d, 9).toISOString() });
  assert.equal(monthOf(at(2026, 10, 30)), '2026-11', 'kept under its local month');
  const kept = keptAttempts([at(2026, 6, 4), at(2026, 6, 6), at(2026, 10, 1)], new Date(2026, 10, 2, 12));
  assert.equal(kept.length, 2, 'a record older than 120 days goes');

  // Which records a view counts
  const fixture = [
    { ...record, id: 'real' },
    { ...record, id: 'made', testData: true },
    { ...record, id: 'gone', personId: 'leo' },
  ];
  const people = [{ id: 'june' }, { id: 'leo', archivedAt: '2026-11-01T10:00:00.000Z' }];
  const ids = (options) => insightsLib.attemptsInView(fixture, people, options).map((one) => one.id);
  assert.deepEqual(ids({ includeArchived: false, demo: false }), ['real'], 'test data and archived people are left out of real insights');
  assert.deepEqual(ids({ includeArchived: false, demo: true }), ['real', 'made'], 'demo mode counts made-up records');
  assert.deepEqual(ids({ includeArchived: true, demo: false }), ['real', 'gone'], '"Include archived" brings their history back');

  // Grouped by local day, oldest first; and worked out once per change
  const days = insightsLib.byDay([{ ...record, shownAt: new Date(2026, 10, 3, 9).toISOString() }, { ...record, shownAt: new Date(2026, 10, 2, 23, 30).toISOString() }]);
  assert.deepEqual([...days.keys()], ['2026-11-02', '2026-11-03'], 'by local day, oldest first');
  let calls = 0;
  const slow = insightsLib.memoLast((list) => {
    calls++;
    return list.length;
  });
  const list = [1, 2];
  slow(list);
  slow(list);
  slow([1, 2]);
  assert.equal(calls, 2, 'the same inputs reuse the last result; new ones work it out again');
}

// Insights, phase 2: every figure against numbers worked out by hand
{
  const lib = await import('@/lib/insights');
  const config = await import('@/config/insights');
  const { SECONDS_PER_CARD: perCard } = await import('@/config/schedule');
  let made = 0;
  /** A card found on the `on`th choice (0 = left unanswered), on a day in November 2026. */
  const card = (day, on, more = {}) => {
    const shownAt = new Date(2026, 10, day, 10, 0, made++).toISOString();
    const selections = on === 0 ? [{ at: shownAt, right: false }] : [...Array(on - 1).fill({ at: shownAt, right: false }), { at: shownAt, right: true }];
    return { id: `x${made}`, sessionId: 's', personId: 'june', cardId: 'c', phrasingId: 'p', shape: 'blank', source: 'template', shownAt, selections, choices: 3, hints: [], success: on > 0, activeMs: 10_000, firstSelectionMs: 3_000, goal: 10, ...more };
  };
  const cards = (day, counts, more = {}) => counts.flatMap((count, index) => Array.from({ length: count }, () => card(day, index + 1, more)));

  // How cards were found: 6 first, 3 second, 1 third of 10 is 60%, 30%, 10%
  const ten = cards(2, [6, 3, 1]);
  const found = lib.resolutionsOf([...ten, card(2, 1, { extra: true }), card(2, 0)]);
  assert.deepEqual(found, { cards: 10, counts: { 1: 6, 2: 3, 3: 1 } }, 'a re-ask and a card left unanswered don’t count');
  assert.deepEqual(lib.sharesOf(found), { 1: 0.6, 2: 0.3, 3: 0.1 });
  assert.equal(lib.sharesOf(lib.resolutionsOf(cards(2, [3, 1]))), undefined, 'never a share from fewer than 5 cards');
  assert.equal(config.MIN_CARDS_SHOWN, 5);

  // Chance: 1 in the number offered; with three, a third
  assert.equal(lib.chanceOf(cards(2, [5])), 1 / 3, 'three answers offered: a third');
  assert.equal(lib.chanceOf(cards(2, [5], { choices: 2 })), 1 / 2, 'two answers offered: a half');
  assert.ok(Math.abs(lib.chanceOf([...cards(2, [3]), card(2, 1, { choices: 2 })]) - (3 / 3 + 1 / 2) / 4) < 1e-12, 'mixed: the average of each card’s chance, (1/3 + 1/3 + 1/3 + 1/2) / 4');
  assert.deepEqual([lib.chanceScore(3), lib.chanceScore(2), lib.chanceScore(4)], [63, 80, 55], 'choosing at random scores (1 + 0.6 + 0.3) / 3 = 63 with three, (1 + 0.6) / 2 = 80 with two');

  // The Memory score: (6 x 1 + 3 x 0.6 + 1 x 0.3) / 10 = 0.81, so 81
  assert.deepEqual(config.MEMORY_SCORE, { points: { 1: 1, 2: 0.6, 3: 0.3 }, minCards: 10 }, 'the weights and the minimum, in one place');
  assert.equal(lib.memoryScore(found), 81);
  assert.equal(lib.memoryScore(lib.resolutionsOf(cards(2, [12]))), 100, 'every card on the first choice: 100');
  assert.equal(lib.memoryScore(lib.resolutionsOf(cards(2, [0, 0, 10]))), 30, 'every card on the third: 30, never 0');
  assert.equal(lib.memoryScore(lib.resolutionsOf(cards(2, [5, 4]))), undefined, 'nine cards: not enough for a score');
  assert.equal(lib.memoryScore(lib.resolutionsOf([])), undefined, 'a day without practice has no score, not a zero');

  // "I'm not sure": the card counts as With help, with that group's points and nothing more, and is counted plainly
  const { resolvedOn } = await import('@/lib/attempts');
  const asked = (more = {}) => card(2, 1, { help: [{ at: new Date(2026, 10, 2, 10).toISOString(), step: 'fact' }], hints: ['fact'], ...more });
  assert.equal(resolvedOn(asked()), 3, 'help, then the right name first: With help');
  assert.ok(asked().selections.every((one) => one.right), 'with no wrong answer recorded');
  assert.equal(resolvedOn(card(2, 3)), 3, 'the same group as a third try');
  const helpDay = [...cards(2, [6, 3]), asked()];
  assert.deepEqual(lib.resolutionsOf(helpDay), found, 'six right away, three on a second try, one with help: the same figures as a third-try card');
  assert.equal(lib.memoryScore(lib.resolutionsOf(helpDay)), lib.memoryScore(found), 'so the same score: the existing hint scoring, no new penalty');
  assert.equal(lib.helpRequestsOf([...helpDay, asked({ extra: true }), asked({ success: false, selections: [] })]), 1, 'counted only on the day’s resolved cards');
  assert.equal(lib.dayInsight('2026-11-02', helpDay).askedForHelp, 1);
  assert.equal(lib.dayInsight('2026-11-02', ten).askedForHelp, 0, 'older records have none');
  assert.deepEqual([lib.helpCountText(1), lib.helpCountText(3)], ['Asked for help: 1 card', 'Asked for help: 3 cards']);
  assert.ok(!/\b(wrong|error|incorrect|fail\w*|mistake)\b/i.test(`${lib.helpCountText(2)} ${lib.ASKED_FOR_HELP_MEANING}`), 'never framed as a failure');

  // Bands, from each band's lower edge
  assert.deepEqual(config.SCORE_BANDS.map((band) => [band.name, band.from]), [['Getting started', 0], ['Building', 65], ['Steady', 80], ['Strong', 90]]);
  assert.deepEqual([0, 63, 64, 65, 79, 80, 89, 90, 100].map(lib.bandOf), ['Getting started', 'Getting started', 'Getting started', 'Building', 'Building', 'Steady', 'Steady', 'Strong', 'Strong'], 'chance with three answers (63) is Getting started');

  // Middle values: of 1, 1, 3, 4, 5 it is 3; of 1 to 6 it is 3.5
  assert.deepEqual([lib.median([3, 1, 4, 1, 5]), lib.median([6, 1, 5, 2, 4, 3]), lib.median([1, 2, 3, 4])], [3, 3.5, undefined], 'and none from fewer than 5');
  const timed = [1_000, 2_000, 3_000, 4_000, 300_000].map((ms) => card(3, 1, { firstSelectionMs: ms }));
  assert.equal(lib.medianFirstChoice(timed), 3_000, 'the middle time to the first choice, not the mean');
  assert.equal(lib.medianFirstChoice([...timed.slice(0, 4), card(3, 1, { firstSelectionMs: undefined })]), undefined, 'a record without the time is left out, never filled in');
  assert.equal(lib.medianFirstChoice([...timed, ...[400_000, 500_000].map((ms) => card(3, 1, { firstSelectionMs: ms }))]), 4_000, 'a long one counts as 90 seconds at most: 1, 2, 3, 4, 90, 90, 90 has 4 in the middle');

  // Practice time against the standard: 36 cards at 14 seconds is 504 seconds
  const expected = 36 * perCard * 1000;
  assert.equal(expected, 504_000);
  assert.deepEqual(['met', 'met', 'about', 'short'], [lib.againstStandard(504_000, 36, 36), lib.againstStandard(0.8 * expected, 36, 36), lib.againstStandard(0.7 * expected, 36, 36), lib.againstStandard(0.5 * expected, 36, 36)].map((one) => one.status), 'met from 80%, about from 60%, short of below that');
  assert.equal(lib.againstStandard(900_000, 36, 30).status, 'partial', 'a day not finished is partial, whatever its time');
  assert.equal(lib.againstStandard(10_000, 0, 5), undefined, 'no target recorded: no comparison');
  assert.deepEqual(lib.STANDARD_WORDS, { met: 'Met the standard', about: 'About the standard', short: 'Short of the standard', partial: 'Partial: some cards left for later' }, 'neutral words');

  // One day, all of it
  const day = lib.dayInsight('2026-11-02', [...ten, card(2, 1, { extra: true, activeMs: 300_000 }), card(2, 0, { personId: 'leo' })]);
  assert.deepEqual([day.cards, day.score, day.band, day.people], [10, 81, 'Steady', ['june']], 'ten cards, 81, Steady; Leo’s card was left unanswered, so only June practiced');
  assert.equal(day.activeMs, 10 * 10_000 + 90_000 + 10_000, 'every card’s time counts toward the day, each at most 90 seconds');
  assert.equal(day.standard.status, 'met', 'ten of ten cards in 200 seconds against 140');

  // How practice is going, against the person's own earlier practice
  const window = (start, values) => values.map((points, index) => card(start + (index % 7), points === 1 ? 1 : points === 0.6 ? 2 : 3));
  const today = '2026-11-28';
  // Days 1 to 14 are the earlier window and 15 to 28 the recent one, ending today.
  const improving = lib.trendOf([...window(1, Array(10).fill(0.6)), ...window(15, Array(10).fill(1))], today);
  assert.deepEqual([improving.label, improving.earlier, improving.recent, improving.early], ['improving', 60, 100, true], 'from 60 to 100 points a card: gently improving, an early read with ten cards each');
  assert.equal(lib.trendOf([...window(1, Array(10).fill(1)), ...window(15, Array(10).fill(0.6))], today).label, 'support', 'the other way: needed more support lately');
  assert.equal(lib.trendOf([...window(1, Array(10).fill(0.6)), ...window(15, [1, 1, 1, 1, 1, 0.3, 0.3, 0.3, 0.3, 0.3])], today).label, 'steady', '60 to 65: too small to call');
  const noisy = lib.trendOf([...window(1, [1, 1, 1, 1, 0.3, 0.3, 0.3, 0.3, 0.3, 0.3]), ...window(15, [1, 1, 1, 1, 1, 1, 0.3, 0.3, 0.3, 0.3])], today);
  assert.deepEqual([noisy.label, noisy.earlier, noisy.recent], ['steady', 58, 72], '58 to 72 is 14 points, but twice its standard error is about 32, so steady');
  assert.equal(lib.trendOf([...window(1, Array(9).fill(1)), ...window(15, Array(10).fill(1))], today), undefined, 'nine cards in a window: no trend');
  const fewDays = [...Array.from({ length: 10 }, () => card(2, 1)), ...Array.from({ length: 10 }, () => card(20, 1))];
  assert.equal(lib.trendOf(fewDays, today), undefined, 'two days of practice: no trend, whatever the cards');
  assert.equal(lib.trendOf([...window(1, Array(30).fill(0.6)), ...window(15, Array(30).fill(1))], today).early, false, 'thirty cards each is no longer an early read');
  assert.deepEqual(lib.TREND_WORDS, { improving: 'Gently improving', steady: 'Steady', support: 'Needed more support lately' });

  // What stands out, and next steps, each pointing where it should
  const family = { people: [{ id: 'june', name: 'June' }, { id: 'leo', name: 'Leo' }], cards: [...Array(4).fill({ personId: 'june', status: 'approved' }), { personId: 'leo', status: 'approved' }], revealCards: 'off', sessionLength: 'standard' };
  // Day 19: 10 first, so 100. Day 20: June 8 first and 2 second, Leo 2 first, 4 second and 4 third,
  // so (10 + 6 x 0.6 + 4 x 0.3) / 20 = 0.74, Building. Days 21 and 22: 100 each. Three Strong days.
  const fortnight = [
    ...cards(19, [10]),
    ...cards(20, [8, 2]),
    ...cards(20, [2, 4, 4], { personId: 'leo' }),
    ...cards(21, [10]),
    ...cards(22, [10]),
  ];
  const view = lib.insightsFor(fortnight, family, false, false, '2026-11-22');
  assert.equal(view.latest.key, '2026-11-22');
  assert.ok(view.observations.length <= 3 && view.observations.some((line) => /Leo’s cards needed the most support/.test(line)), view.observations.join(' | '));
  assert.deepEqual(view.steps.map((step) => [step.text, step.target]), [
    ['Look over Leo’s photo and hints', { person: 'leo' }],
    ['Add more stories about Leo', { person: 'leo' }],
    ['Reveal cards could add a gentle challenge', { setting: 'reveal-cards' }],
  ], 'Leo needs a look and has one story; three Strong days in a row with reveal cards off');
  assert.equal(lib.insightsFor(fortnight, family, false, false, '2026-11-22'), view, 'the same practice and filters reuse the result');
  assert.notEqual(lib.insightsFor(fortnight, family, true, false, '2026-11-22'), view, 'a filter works it out again');
  const partial = lib.nextStepsOf([1, 2, 3].map((n) => lib.dayInsight(`2026-11-0${n}`, cards(n, [5], { goal: 36 }))), [], family);
  assert.deepEqual(partial.map((step) => step.target), [{ setting: 'session-length' }], 'three partial days: a shorter session length might fit');
  assert.equal(lib.insightsFor([], family, false, false, '2026-11-22').latest, undefined, 'no records: an honest empty view');

  // Old rows and made-up or archived people's
  const old = { ...card(22, 1), firstSelectionMs: undefined, factType: undefined };
  assert.equal(lib.dayInsight('2026-11-22', [old]).medianFirstMs, undefined, 'missing times stay missing');
  const mixed = [...cards(22, [10]), ...cards(22, [10], { testData: true }), ...cards(22, [10], { personId: 'leo' })];
  const archivedFamily = { ...family, people: [family.people[0], { ...family.people[1], archivedAt: '2026-11-21T10:00:00.000Z' }] };
  assert.equal(lib.insightsFor(mixed, archivedFamily, false, false, '2026-11-22').latest.cards, 10, 'test data and archived people’s cards are left out');
  assert.equal(lib.insightsFor(mixed, archivedFamily, true, true, '2026-11-22').latest.cards, 30, 'demo mode and "Include archived" bring them in');
}

// Insights, phase 4: the score calendar and what it says
{
  const lib = await import('@/lib/insights');
  // November 2026 starts on a Sunday and has 30 days: six rows, Monday first.
  const november = lib.monthWeeks('2026-11');
  assert.equal(november.length, 6);
  assert.deepEqual(november[0], [null, null, null, null, null, null, '2026-11-01'], 'the 1st is a Sunday, the last column');
  assert.deepEqual(november[5], ['2026-11-30', null, null, null, null, null, null]);
  assert.equal(november.flat().filter(Boolean).length, 30);
  assert.equal(lib.monthWeeks('2026-02').flat().filter(Boolean).length, 28, 'February 2026 has 28 days');
  assert.equal(lib.monthWeeks('2028-02').flat().filter(Boolean).length, 29, 'and 2028 is a leap year');
  assert.deepEqual([lib.shiftMonth('2026-01', -1), lib.shiftMonth('2026-12', 1), lib.shiftMonth('2026-11', -3)], ['2025-12', '2027-01', '2026-08'], 'months step across years');
  assert.equal(lib.monthName('2026-11'), 'November 2026');
  assert.equal(lib.monthDay('2026-11-04'), 'November 4');

  // Each day's look: no practice, too few cards, or its band
  const day = (cards, score) => ({ cards, score, band: score === undefined ? undefined : lib.bandOf(score) });
  assert.deepEqual([undefined, day(0), day(6), day(10, 70), day(12, 95)].map(lib.cellKind), ['none', 'none', 'few', 'Building', 'Strong']);
  assert.equal(lib.cellLabel('2026-11-04', day(12, 95)), 'November 4: Memory score 95, Strong');
  assert.equal(lib.cellLabel('2026-11-04', day(6)), 'November 4: 6 cards, not enough for a score');
  assert.equal(lib.cellLabel('2026-11-04', undefined), 'November 4: no practice');
  assert.deepEqual([lib.countAndShare(6, 0.6), lib.countAndShare(3, undefined)], ['6, 60%', '3'], 'a share only from enough cards');

  // The calendar goes back as far as there are records
  const view = lib.insightsFor([{ id: 'a', sessionId: 's', personId: 'june', cardId: 'c', phrasingId: 'p', shape: 'blank', source: 'template', shownAt: new Date(2026, 8, 20, 10).toISOString(), selections: [{ at: '', right: true }], choices: 3, hints: [], success: true, activeMs: 1000, goal: 10 }], { people: [], cards: [], revealCards: 'sometimes', sessionLength: 'standard' }, false, false, '2026-11-09');
  assert.equal(lib.earliestMonth(view, '2026-11-09'), '2026-09');

  // "What is this score?" says what the constants say
  assert.equal(lib.bandsSentence(), 'Getting started below 65, Building from 65, Steady from 80 and Strong from 90');
  assert.ok(lib.scoreSentence().includes('1 right away, 0.6 on a second try, and 0.3 with help'));
  const help = inRepo('src/components/score-calendar.tsx');
  assert.ok(/The Memory score summarizes one day of practice/.test(help), 'the explanation says it summarizes one day of practice');
  assert.ok(/affected by sleep, mood and the time of day/.test(help), 'that sleep, mood and the time of day affect it');
  assert.ok(/It is not a medical measure/.test(help), 'that it is not a medical measure');
  assert.ok(/Compare it only with the same person’s own history/.test(help), 'and that it is compared only with the same person’s own history');
}

// The score range key: every cutoff from SCORE_BANDS, and in step when one changes
{
  const lib = await import('@/lib/insights');
  const { SCORE_BANDS, MEMORY_SCORE } = await import('@/config/insights');
  const key = lib.scoreKey(63);
  assert.equal(lib.scoreFloor(), 30, 'every card on the third choice: the lowest a day can score');
  assert.deepEqual(key.bands.map((band) => [band.name, band.range]), [['Getting started', 'below 65'], ['Building', '65 to 79'], ['Steady', '80 to 89'], ['Strong', '90 to 100']], 'names and ranges from the bands');
  assert.deepEqual(key.bands.map((band) => band.from), SCORE_BANDS.map((band) => band.from));
  assert.deepEqual(key.breaks.map((one) => one.value), SCORE_BANDS.slice(1).map((band) => band.from), 'a labelled break at each cutoff');
  assert.ok(Math.abs(key.bands.reduce((sum, band) => sum + band.width, 0) - 100) < 1e-9 && key.bands[0].start === 0, 'the segments fill the bar, from the floor');
  assert.ok(Math.abs(key.breaks[0].at - (100 * (65 - 30)) / 70) < 1e-9, 'on the score chart’s own scale, the floor to 100');
  assert.ok(key.chance.at > key.bands[0].start && key.chance.at < key.bands[1].start, 'chance with three answers (63) sits in Getting started');
  assert.ok(key.summary.includes('Getting started, below 65') && key.summary.includes('about 63'), 'the bar’s colors in words, for screen readers');
  assert.deepEqual(Object.keys(lib.BAND_MEANINGS), SCORE_BANDS.map((band) => band.name), 'a plain meaning for every band');
  assert.ok(Object.values(lib.BAND_MEANINGS).every((text) => !/\d/.test(text)) && !/\d/.test(lib.CHANCE_LINE), 'no number written into the words');
  assert.equal(lib.CHANCE_LINE, 'This is about what random guessing would score, so it is not a sign of recall.');
  // A changed cutoff moves everything with it
  const moved = lib.scoreKey(63, [{ name: 'Getting started', from: 0 }, { name: 'Building', from: 70 }, { name: 'Steady', from: 82 }, { name: 'Strong', from: 92 }]);
  assert.deepEqual(moved.bands.map((band) => band.range), ['below 70', '70 to 81', '82 to 91', '92 to 100']);
  assert.deepEqual(moved.breaks.map((one) => one.value), [70, 82, 92]);
  assert.ok(moved.breaks[0].at > key.breaks[0].at, 'the break moves along the bar');
  // The level random guessing would score, from the answers actually offered
  const rec = (choices) => ({ id: String(Math.random()), sessionId: 's', personId: 'p', cardId: 'c', phrasingId: 'x', shape: 'blank', source: 'template', shownAt: new Date(2026, 10, 2, 10).toISOString(), selections: [{ at: '', right: true }], choices, hints: [], success: true, activeMs: 1000, goal: 10 });
  assert.equal(lib.chanceScoreOf([]), lib.chanceScore(3), 'no records: three answers');
  assert.equal(lib.chanceScoreOf([rec(2), rec(2)]), 80, 'a two-person family: 80');
  assert.equal(lib.chanceScoreOf([rec(3), rec(2)]), Math.round((63 + 80) / 2));
  assert.equal(MEMORY_SCORE.minCards, 10);
  // The component writes no cutoff of its own, and the hero, the calendar and the explanation all show it
  const keyCode = inRepo('src/components/score-key.tsx').replace(/\/\/.*|\/\*[\s\S]*?\*\//g, '');
  for (const band of SCORE_BANDS.slice(1)) assert.ok(!new RegExp(`\\b${band.from}\\b`).test(keyCode), `score-key.tsx writes ${band.from} itself`);
  assert.ok(/scoreKey\(/.test(keyCode), 'it reads scoreKey');
  assert.ok(/<ScoreKey chance=\{view\.chanceScore\}/.test(inRepo('src/components/insights.tsx')), 'under the hero');
  assert.ok(/testID="calendar-key"/.test(inRepo('src/components/score-calendar.tsx')) && /testID="help-key"/.test(inRepo('src/components/score-calendar.tsx')), 'on the calendar, folded, and at the top of "What is this score?"');
}

// Stepping through days in the day sheet: one calendar day at a time, from the first records to today
{
  const lib = await import('@/lib/insights');
  const { toRow, fromRow } = await import('@/lib/attempt-records');
  const { demoAttempts } = await import('@/lib/demo-insights');
  const rec = (date, more = {}) => ({ id: `r${date.getTime()}`, sessionId: 's', personId: 'june', cardId: 'c', phrasingId: 'name', shape: 'blank', source: 'template', shownAt: date.toISOString(), selections: [{ at: date.toISOString(), right: true }], choices: 3, hints: [], success: true, activeMs: 1000, firstSelectionMs: 900, goal: 10, ...more });
  const family = { people: [{ id: 'june', name: 'June' }], cards: [], revealCards: 'sometimes', sessionLength: 'standard' };
  // Records on October 30 and November 2 only; today is November 3.
  const view = lib.insightsFor([rec(new Date(2026, 9, 30, 10)), rec(new Date(2026, 10, 2, 10))], family, false, false, '2026-11-03');
  const days = lib.pagerDays(view, '2026-11-03');
  assert.deepEqual(days, ['2026-10-30', '2026-10-31', '2026-11-01', '2026-11-02', '2026-11-03'], 'every day from the first records to today, empty days included');
  assert.equal(lib.stepDay(days, '2026-10-31', 1), '2026-11-01', 'next crosses the end of the month');
  assert.equal(lib.stepDay(days, '2026-11-01', -1), '2026-10-31', 'and previous crosses back');
  assert.equal(lib.stepDay(days, '2026-11-03', 1), undefined, 'it stops at today: no future days');
  assert.equal(lib.stepDay(days, '2026-10-30', -1), undefined, 'and at the earliest day with records');
  assert.equal(lib.stepDay(days, '2026-11-01', 1), '2026-11-02', 'one calendar day at a time, practiced or not');
  assert.equal(lib.stepDay(days, '2026-09-01', 1), undefined, 'a day outside the range goes nowhere');
  assert.equal(view.days.get('2026-10-31'), undefined, 'an empty day has nothing to show, and gets its calm empty page');
  assert.deepEqual(lib.pagerDays(lib.insightsFor([], family, false, false, '2026-11-03'), '2026-11-03'), ['2026-11-03'], 'no records: just today');
  assert.deepEqual(lib.pagerDays(lib.insightsFor([rec(new Date(2026, 10, 9, 10))], family, false, false, '2026-11-03'), '2026-11-03'), ['2026-11-03'], 'a record dated after today never adds a future day');
  // Across a year's end and a clock change: no day skipped or repeated
  const longView = lib.insightsFor([rec(new Date(2025, 11, 20, 10))], family, false, false, '2026-04-05');
  const long = lib.pagerDays(longView, '2026-04-05');
  assert.equal(long.length, new Set(long).size, 'no day twice');
  assert.equal(long.length, Math.round((new Date(2026, 3, 5) - new Date(2025, 11, 20)) / 86_400_000) + 1, 'and none missing, across the new year and March’s clock change');
  assert.ok(long.includes('2025-12-31') && long.includes('2026-01-01') && long.includes('2026-03-08') && long.includes('2026-03-09'));
  assert.deepEqual([lib.dayHint('2026-11-03', '2026-11-03'), lib.dayHint('2026-11-02', '2026-11-03'), lib.dayHint('2026-10-30', '2026-11-03')], ['Today', 'Yesterday', 'Oct 30'], 'the position hint between the arrows');
  // Archived people's days count only with "Include archived"
  const archivedFamily = { people: [{ id: 'june', name: 'June' }, { id: 'leo', name: 'Leo', archivedAt: '2026-11-01T00:00:00.000Z' }], cards: [], revealCards: 'sometimes', sessionLength: 'standard' };
  const leoFirst = [rec(new Date(2026, 9, 20, 10), { personId: 'leo' }), rec(new Date(2026, 10, 1, 10))];
  assert.equal(lib.pagerDays(lib.insightsFor(leoFirst, archivedFamily, false, false, '2026-11-03'), '2026-11-03')[0], '2026-11-01', 'the first day shown, without archived people');
  assert.equal(lib.pagerDays(lib.insightsFor(leoFirst, archivedFamily, true, false, '2026-11-03'), '2026-11-03')[0], '2026-10-20', 'and with them');
  // The same records kept on the phone or read back from the server page through the same days
  const today = new Date(2026, 10, 9, 12);
  const kept = demoAttempts(['june', 'leo', 'mae'], today).map(({ testData, demo, ...one }) => one);
  const fromServer = kept.map((one) => fromRow(JSON.parse(JSON.stringify(toRow(one, { caregiverId: 'cg', personUserId: 'pu' })))));
  const peopleOf = { people: ['june', 'leo', 'mae'].map((id) => ({ id, name: id })), cards: [], revealCards: 'sometimes', sessionLength: 'standard' };
  const localView = lib.insightsFor(kept, peopleOf, false, false, '2026-11-09');
  const serverView = lib.insightsFor(fromServer, peopleOf, false, false, '2026-11-09');
  const localDays = lib.pagerDays(localView, '2026-11-09');
  assert.deepEqual(lib.pagerDays(serverView, '2026-11-09'), localDays, 'the same days to step through, with sign-in off or on');
  const pageOf = (one, key) => { const day = one.days.get(key); return day && { cards: day.cards, score: day.score, band: day.band, counts: day.resolutions.counts, standard: day.standard?.status, people: day.people }; };
  for (const key of localDays) assert.deepEqual(pageOf(serverView, key), pageOf(localView, key), `${key}: the same page either way`);
  // The sheet keeps its arrows, VoiceOver's actions, the crossfade with Reduce Motion, and the calendar follows
  const sheet = inRepo('src/components/day-sheet.tsx');
  assert.ok(/label="Previous day"/.test(sheet) && /label="Next day"/.test(sheet) && /COMPACT_TAP/.test(sheet), 'previous and next buttons in the header, 44pt');
  assert.ok(/name: 'next', label: 'Next day'/.test(sheet) && /name: 'previous', label: 'Previous day'/.test(sheet) && /onAccessibilityAction/.test(sheet), 'and VoiceOver actions, so nothing depends on the swipe');
  assert.ok(/reduced \? <FadePager/.test(sheet) && /FadeIn\.duration\(250\)/.test(sheet) && /FadeOut\.duration\(250\)/.test(sheet), 'Reduce Motion crossfades instead of sliding');
  assert.ok(/horizontal\s+pagingEnabled/.test(sheet) && /windowSize=\{3\}/.test(sheet), 'the neighbors are drawn, so a swipe shows them at once');
  assert.ok(/<Note start \/>/.test(sheet), 'and the note sits by each day’s score');
  const calendar = inRepo('src/components/score-calendar.tsx');
  assert.ok(/if \(selected\) setMonth\(selected\.slice\(0, 7\)\)/.test(calendar) && /selected=\{key === selected\}/.test(calendar), 'the calendar behind turns to the day’s month and highlights it');
  assert.ok(/onSelect=\{setDayOpen\}/.test(inRepo('src/components/insights.tsx')), 'paging moves the day the panel has open');
}

// Insights, phase 5: the demo data
{
  const { demoAttempts, DEMO_DAYS } = await import('@/lib/demo-insights');
  const lib = await import('@/lib/insights');
  // A record's or a moment's study day (the days these checks count in).
  const dayKey = studyDays.studyDayKey;
  const sample = ['june', 'leo', 'ruth', 'omar', 'mae'];
  const today = new Date(2026, 10, 9, 12);
  const demo = demoAttempts([...sample, 'nora'], today);
  assert.equal(JSON.stringify(demoAttempts(sample, today)), JSON.stringify(demo), 'the same each time, and real people get nothing');
  assert.ok(demo.length > 600 && demo.every((one) => one.testData && one.demo), 'every record is test data and the demo’s');
  assert.ok(demo.every((one) => sample.includes(one.personId)), 'only the fictional sample people');
  const keys = new Set(demo.map((one) => dayKey(new Date(one.shownAt))));
  const window = new Set(lastDayKeysOf(today, DEMO_DAYS));
  function lastDayKeysOf(now, count) {
    return activity.lastDays(now, count).map((date) => dayKey(date));
  }
  assert.equal(DEMO_DAYS, 56, 'eight weeks');
  assert.ok([...keys].every((key) => window.has(key)) && keys.has(dayKey(today)), 'within the eight weeks, today included');
  assert.ok(keys.size < DEMO_DAYS, 'with some days of no practice');
  assert.deepEqual(demoAttempts(['june'], today).every((one) => one.personId === 'june'), true, 'someone deleted from the family gets nothing');
  assert.deepEqual(demoAttempts(['nora'], today), [], 'and with no sample people, there is no demo');

  // Every pattern the demo should show
  const family = { people: sample.map((id) => ({ id, name: id })), cards: [], revealCards: 'sometimes', sessionLength: 'standard' };
  const view = lib.insightsFor(demo, family, false, true, dayKey(today));
  const days = [...view.days.values()];
  assert.ok(view.latest?.key === dayKey(today) && view.latest.score !== undefined, 'today has a score');
  assert.ok(days.some((day) => day.cards > 0 && day.score === undefined), 'days under the minimum card count');
  assert.ok(days.some((day) => day.standard?.status === 'partial'), 'partial days');
  assert.ok(days.some((day) => day.standard?.status === 'short' || day.standard?.status === 'about'), 'days short of the standard');
  assert.ok(days.some((day) => day.standard?.status === 'met'), 'and days that met it');
  const speeds = days.flatMap((day) => (day.medianFirstMs === undefined ? [] : [day.medianFirstMs]));
  assert.ok(Math.max(...speeds) / Math.min(...speeds) > 1.6, 'faster and slower days');
  assert.ok(demo.some((one) => one.extra), 'cards back after a hint, which never count');
  const juneEarly = lib.resolutionsOf(demo.filter((one) => one.personId === 'june' && one.shownAt < new Date(2026, 9, 1).toISOString()));
  const juneLate = lib.resolutionsOf(demo.filter((one) => one.personId === 'june' && one.shownAt > new Date(2026, 9, 25).toISOString()));
  assert.ok(lib.sharesOf(juneLate)[1] - lib.sharesOf(juneEarly)[1] > 0.15, 'June improving');
  const people = lib.peopleInsights(demo.filter((one) => one.shownAt > new Date(2026, 9, 26).toISOString()));
  const lowest = people.reduce((low, person) => (person.shares[1] < low.shares[1] ? person : low));
  assert.equal(lowest.personId, 'mae', 'Mae’s cards need the most support');
  assert.equal(lib.insightsFor(demo, family, false, false, dayKey(today)).latest, undefined, 'demo mode off: none of it shows');
}

// The chart system every Insights chart shares: scales, ticks, which dates get a label, callouts and taps
{
  const scale = await import('@/lib/insight-scale');
  // Ticks start at zero (bars always do) and reach a round number at or above the largest value
  assert.deepEqual(scale.niceTicks(4.2, { least: 5 }), [0, 2, 4, 6], 'answer speed up to 4.2 s reads 0, 2, 4, 6 s');
  assert.deepEqual(scale.niceTicks(7.5, { least: 5 }), [0, 5, 10], 'practice time up to 7.5 min reads 0, 5, 10 min');
  assert.deepEqual(scale.niceTicks(12), [0, 5, 10, 15]);
  assert.deepEqual(scale.niceTicks(100), [0, 50, 100]);
  assert.deepEqual(scale.niceTicks(0.4, { least: 5 }), [0, 2, 4, 6], 'a near-empty chart keeps a readable range');
  assert.deepEqual(scale.niceTicks(0), [0, 0.5, 1], 'nothing at all still has a scale');
  for (const max of [0.3, 1, 3.3, 9.99, 10, 17, 61, 999]) {
    const ticks = scale.niceTicks(max);
    assert.ok(ticks[0] === 0 && ticks[ticks.length - 1] >= max && ticks.length >= 2 && ticks.length <= 6, `ticks for ${max}: ${ticks}`);
    const step = ticks[1] - ticks[0];
    assert.ok(ticks.every((tick, index) => Math.abs(tick - index * step) < 1e-9), `evenly spaced for ${max}`);
    assert.ok([1, 2, 5].includes(Math.round(step / 10 ** Math.floor(Math.log10(step)))), `a round step for ${max}: ${step}`);
  }
  assert.equal(scale.niceStep(1.4), 2);
  assert.equal(scale.niceStep(0.3), 0.5);
  assert.equal(scale.niceStep(7), 10);
  // Straight-line scales, and a flat domain that can't divide by zero
  assert.equal(scale.linear([0, 10], [100, 0])(5), 50);
  assert.equal(scale.linear([50, 100], [166, 26])(100), 26);
  assert.equal(scale.linear([3, 3], [10, 20])(3), 10);
  // Days sit in the middle of their slots, so the first and last never touch the edges
  assert.equal(scale.slotCenter(0, 14, 40, 280), 50);
  assert.equal(scale.slotCenter(13, 14, 40, 280), 310);
  assert.equal(scale.slotCenter(0, 1, 0, 100), 50, 'one day sits in the middle');
  // Date labels: the first and last always, evenly between, never more than fit
  assert.deepEqual(scale.labelIndexes(30, 4), [0, 10, 19, 29]);
  assert.deepEqual(scale.labelIndexes(14, 3.6), [0, 7, 13]);
  assert.deepEqual(scale.labelIndexes(14, 40), [...Array(14).keys()], 'all of them when they fit');
  assert.deepEqual([scale.labelIndexes(1, 5), scale.labelIndexes(0, 3), scale.labelIndexes(30, 1)], [[0], [], [29]], 'one day, none, and room for one: the latest');
  for (const [count, fit] of [[30, 5], [30, 7], [14, 5], [2, 9], [7, 3]]) {
    const shown = scale.labelIndexes(count, fit);
    assert.ok(shown.length <= Math.max(2, fit) && shown[0] === 0 && shown[shown.length - 1] === count - 1 && new Set(shown).size === shown.length, `${count} days, room for ${fit}: ${shown}`);
  }
  // Callouts stay inside the chart; taps find the nearest day
  assert.equal(scale.calloutLeft(5, 60, 0, 300), 0, 'near the left edge, it starts at the edge');
  assert.equal(scale.calloutLeft(298, 60, 0, 300), 240, 'near the right edge, it ends at the edge');
  assert.equal(scale.calloutLeft(150, 60, 0, 300), 120, 'otherwise centered over the day');
  assert.equal(scale.calloutLeft(150, 400, 0, 300), 0, 'wider than the chart: from the start');
  assert.deepEqual([scale.slotAt(41, 14, 40, 280), scale.slotAt(319, 14, 40, 280), scale.slotAt(-50, 14, 40, 280), scale.slotAt(999, 14, 40, 280), scale.slotAt(5, 0, 0, 10)], [0, 13, 0, 13, undefined]);
  // The score line's range: 50 to 100, lower only when a day scored lower, never under the floor
  assert.deepEqual(scale.scoreDomain([86, 78], 30), [50, 100]);
  assert.deepEqual(scale.scoreDomain([47, 90], 30), [40, 100], 'a day at 47 moves the bottom to 40');
  assert.deepEqual(scale.scoreDomain([30], 30), [30, 100], 'never below the floor');
  assert.deepEqual(scale.scoreDomain([], 30), [50, 100], 'no scores yet');
  // Every chart is drawn by the one frame: no chart draws its own SVG, axes or legend
  const charts = inRepo('src/components/insight-charts.tsx');
  assert.equal((charts.match(/<ChartFrame\b/g) ?? []).length, 4, 'four charts, one frame');
  assert.ok(!/<Svg\b|<SvgText\b|useState/.test(charts), 'no chart lays itself out');
  const kit = inRepo('src/components/insight-chart-kit.tsx');
  assert.ok(/labelIndexes\(/.test(kit) && /calloutLeft\(/.test(kit) && /slotAt\(/.test(kit) && /accessibilityLabel=\{summary\}/.test(kit) && /Show the numbers/.test(kit), 'the frame lays out dates, callouts and taps, and says what it shows');
}

// The score ring: the arc for every score, the band ticks, the chance mark and the empty ring
{
  const ring = await import('@/lib/insight-ring');
  const lib = await import('@/lib/insights');
  const { SCORE_BANDS, MEMORY_SCORE } = await import('@/config/insights');
  const cutoffs = SCORE_BANDS.map((band) => band.from);
  const size = 170;
  const stroke = 14;
  const at = (score, chance) => ring.ringGeometry(score, size, stroke, cutoffs, chance);
  const C = 2 * Math.PI * (size / 2 - stroke / 2);
  // 0 and no score draw no arc; 100 closes the circle; between, the arc as drawn (caps included) is the score's share
  assert.ok(at(0).empty && at(0).dash[0] === 0 && at(0).share === 0, '0: nothing over the track');
  assert.ok(at(undefined).empty && at(Number.NaN).empty, 'no score: the empty ring');
  assert.ok(at(100).full && Math.abs(at(100).dash[0] - C) < 1e-9 && at(100).rotation === -90 && at(100).share === 1, '100: a full circle from the top, no caps');
  assert.ok(Math.abs(at(50).share - 0.5) < 1e-9, '50: half the ring, caps included');
  assert.ok(Math.abs(at(50).dash[0] - (C / 2 - stroke)) < 1e-9, 'the caps are taken off the dash, so the arc ends where the score says');
  assert.ok(!at(99).full && at(99).share < 1 && (1 - at(99).share) * C > 4, '99: a visible gap before the top, never mistaken for 100');
  assert.ok(at(1).dash[0] > 0 && at(1).dash[0] < 1 && !at(1).empty, '1: a dot, not nothing');
  assert.ok(at(-5).empty && at(150).full, 'out-of-range values are held to 0 and 100');
  assert.ok(Math.abs(at(50).rotation - (-90 + (stroke / 2 / (size / 2 - stroke / 2)) * (180 / Math.PI))) < 1e-9, 'turned so the first cap starts exactly at the top');
  for (const score of [13, 50, 63, 87, 99]) assert.ok(Math.abs(at(score).share - score / 100) < 1e-9, `${score}: the arc covers ${score}% as drawn`);
  assert.ok(at(1).share * C <= stroke + 0.02, 'below one cap’s length, the arc is a single dot');
  // A tick at each band's lower edge, read from SCORE_BANDS, outside the ring
  const geo = at(87, 63);
  assert.deepEqual(geo.ticks.map((tick) => tick.value), SCORE_BANDS.slice(1).map((band) => band.from), 'a tick at every cutoff but the first band’s 0');
  const dist = (p) => Math.hypot(p.x - geo.cx, p.y - geo.cy);
  assert.ok(geo.ticks.every((tick) => dist(tick.inner) > size / 2 && dist(tick.outer) > dist(tick.inner)), 'just outside the ring, pointing out');
  const angleOf = (p) => (Math.atan2(p.y - geo.cy, p.x - geo.cx) + Math.PI / 2 + 2 * Math.PI) % (2 * Math.PI);
  for (const tick of geo.ticks) assert.ok(Math.abs(angleOf(tick.outer) / (2 * Math.PI) - tick.value / 100) < 1e-9, `the ${tick.value} tick sits ${tick.value}% round from the top`);
  assert.deepEqual(ring.ringGeometry(87, size, stroke, [0, 70, 82, 92]).ticks.map((tick) => tick.value), [70, 82, 92], 'moved cutoffs move the ticks');
  // The chance mark and its tiny label stay inside the ring's box, whatever the answers offered
  for (const chance of [lib.chanceScore(2), lib.chanceScore(3), lib.chanceScore(4)]) {
    const mark = at(87, chance).chance;
    assert.ok(mark && Math.abs(angleOf(mark.outer) / (2 * Math.PI) - chance / 100) < 1e-9, `chance at ${chance} is marked there`);
    const wide = 'chance'.length * 11 * 0.58;
    const left = mark.anchor === 'end' ? mark.label.x - wide : mark.anchor === 'middle' ? mark.label.x - wide / 2 : mark.label.x;
    assert.ok(left >= 0 && left + wide <= geo.width && mark.label.y >= 11 && mark.label.y <= geo.height, `the chance label at ${chance} fits the box`);
  }
  assert.equal(at(87).chance, undefined, 'no chance given, no mark');
  assert.ok(ring.ringGeometry(87, 84, 9, cutoffs, 63, false).width === 84 + 16, 'a small ring keeps only a slim margin');
  // Sizes: 150 to 180 across, smaller on the narrowest phones, and the hero card holds it with its label room
  assert.deepEqual([320, 375, 390, 430, 1024].map((width) => ring.heroRingSize(width)), [150, 164, 171, 180, 180]);
  assert.deepEqual([[375, 647], [390, 763], [430, 839]].map(([w, h]) => ring.heroRingSize(w, h)), [150, 171, 180], 'shorter phones get the smaller ring, so the hero fits above the tab bar');
  for (const width of [320, 375, 390, 430]) assert.ok(ring.heroRingSize(width) + 2 * ring.RING_PAD.x <= width - 2 * 24 - 2 * 16, `the ring and its labels fit a ${width}pt phone’s hero card`);
  // Its words: the score, the band and the day; or, from too few cards, never a score
  const day = (cards, score) => ({ key: '2026-11-10', cards, score, band: score === undefined ? undefined : lib.bandOf(score) });
  assert.equal(lib.ringSpoken(day(30, 87), '2026-11-10'), 'Memory score 87 out of 100, Steady, today');
  assert.equal(lib.ringSpoken(day(30, 92), '2026-11-11'), 'Memory score 92 out of 100, Strong, yesterday');
  assert.equal(lib.ringSpoken(day(30, 70), '2026-11-14'), 'Memory score 70 out of 100, Building, Tuesday, November 10');
  assert.equal(lib.ringSpoken(day(4), '2026-11-10'), `Memory score, today: Needs ${MEMORY_SCORE.minCards} cards, 6 to go`);
  assert.equal(lib.ringSpoken(undefined, '2026-11-10'), 'Memory score: no practice yet');
  assert.equal(lib.ringEmptyLine(day(4)), 'Needs 10 cards, 6 to go');
  assert.equal(lib.ringEmptyLine(day(9)), 'Needs 10 cards, 1 to go');
  assert.equal(lib.ringEmptyLine(undefined), 'No practice yet');
  // The component writes no cutoff of its own, fills once (at once with Reduce Motion), and is the one ring everywhere
  const ringCode = inRepo('src/components/insight-ring.tsx').replace(/\/\/.*|\/\*[\s\S]*?\*\//g, '');
  for (const band of SCORE_BANDS.slice(1)) assert.ok(!new RegExp(`\\b${band.from}\\b`).test(ringCode), `insight-ring.tsx writes ${band.from} itself`);
  assert.ok(/SCORE_BANDS\.map/.test(ringCode) && /useReducedMotion\(\)/.test(ringCode) && /useFill\(!reduced\)/.test(ringCode), 'cutoffs from SCORE_BANDS, and the fill skipped with Reduce Motion');
  assert.ok(/<ScoreRing\b/.test(inRepo('src/components/insights.tsx')) && /<ScoreRing\b/.test(inRepo('src/components/day-sheet.tsx')), 'the hero and each day’s sheet use the same ring');
  // A low day's arc is never deeper than a high day's
  const { ARC_ORDER } = { ARC_ORDER: ['pink3', 'pink4', 'pinkDeep', 'pinkInk'] };
  const { Colors } = await import('@/theme/colors');
  const lum = (hex) => { const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
  assert.ok(ARC_ORDER.map((name) => lum(Colors[name])).every((value, index, all) => index === 0 || value < all[index - 1]), 'the arc deepens band by band');
  assert.ok(ARC_ORDER.every((name, index) => new RegExp(`'?${SCORE_BANDS[index].name}'?: Colors\\.${name}`).test(ringCode)), 'each band’s arc pink, lightest for Getting started');
}

// "How answers were found": plain words, counts and percentages that add up, and chance said simply
{
  const lib = await import('@/lib/insights');
  const res = (a, b, c) => ({ cards: a + b + c, counts: { 1: a, 2: b, 3: c } });
  const groups = lib.foundGroups(res(31, 12, 7));
  assert.deepEqual(groups.map((group) => [group.label, group.count]), [['Right away', 31], ['On a second try', 12], ['With help', 7]], 'right away, on a second try, with help, each with its count');
  assert.deepEqual(groups.map((group) => group.share), [0.62, 0.24, 0.14], 'shares of the 50 cards');
  assert.ok(lib.foundGroups(res(2, 1, 1)).every((group) => group.share === undefined), 'no share from fewer than 5 cards, counts only');
  assert.deepEqual(lib.wholePercents([1 / 3, 1 / 3, 1 / 3]), [34, 33, 33], 'thirds read 34, 33, 33: never 99%');
  assert.deepEqual(lib.wholePercents([0.625, 0.25, 0.125]), [63, 25, 12]);
  assert.deepEqual(lib.wholePercents([1, 0, 0]), [100, 0, 0]);
  for (const counts of [[7, 2, 1], [2, 2, 2], [13, 5, 3], [29, 0, 1], [5, 5, 7], [2, 3, 6]]) {
    const parts = lib.foundGroups(res(...counts)).map((group) => group.share);
    const whole = lib.wholePercents(parts);
    assert.equal(whole.reduce((sum, value) => sum + value, 0), 100, `${counts}: the three labels add up to 100%`);
    assert.ok(whole.every((value, index) => Math.abs(value - parts[index] * 100) < 1), `${counts}: each within a point of its share`);
  }
  // Chance in words: 1 in 3 with three names, 1 in 2 with two, hidden when there is nothing to say
  assert.equal(lib.chanceText(1 / 3), 'Choosing at random would find about 1 in 3 answers right away.');
  assert.equal(lib.chanceText(1 / 2), 'Choosing at random would find about 1 in 2 answers right away.', 'a two-person family');
  assert.equal(lib.chanceText((3 / 3 + 1 / 2) / 4 + 0.0001), 'Choosing at random would find about 1 in 3 answers right away.', 'mostly three names: about 1 in 3');
  assert.deepEqual([lib.chanceText(undefined), lib.chanceText(1), lib.chanceText(0)], [undefined, undefined, undefined], 'no records, or only one name: no chance line');
  // One plain sentence above the bar
  assert.equal(lib.foundHeadline({ 1: 0.7, 2: 0.2, 3: 0.1 }), 'Most answers were found right away in the last two weeks.');
  assert.ok(/right away, and the rest/.test(lib.foundHeadline({ 1: 0.45, 2: 0.35, 3: 0.2 })));
  assert.ok(/Hints are there for exactly this/.test(lib.foundHeadline({ 1: 0.3, 2: 0.3, 3: 0.4 })));
  assert.ok(/once there are 5 cards/.test(lib.foundHeadline(undefined)));
  const recent = { resolutions: res(31, 12, 7), shares: { 1: 0.62, 2: 0.24, 3: 0.14 }, chance: 1 / 3, early: false };
  assert.equal(lib.foundSummary(recent), 'How answers were found, last 14 days: 62% right away (31), 24% on a second try (12), 14% with help (7). Choosing at random would find about 1 in 3 answers right away.', 'the screen reader hears the same words and numbers');
  assert.equal(lib.foundSummary({ ...recent, chance: 1 / 2 }).endsWith('1 in 2 answers right away.'), true);
  assert.equal(lib.scoreSentence().includes('right away') && !/first choice|third or later/.test(lib.scoreSentence()), true, 'the score is explained in the same words');
  // The technical labels are gone from every Insights view, the day sheet and the person's pages included
  for (const path of ['src/components/insights.tsx', 'src/components/insight-charts.tsx', 'src/components/insight-found.tsx', 'src/components/day-sheet.tsx', 'src/components/score-key.tsx', 'src/components/score-calendar.tsx']) {
    assert.ok(!/First choice|On the first choice|On the second|Third or later|third or later/.test(inRepo(path).replace(/\/\/.*|\/\*[\s\S]*?\*\//g, '')), `${path} still says first, second or third choice`);
  }
  assert.ok(Object.values(lib.BAND_MEANINGS).every((text) => !/first choice|second or later/.test(text)), 'the band meanings too');
  const found = inRepo('src/components/insight-found.tsx');
  assert.ok(/How to read this/.test(found) && /chanceText\(/.test(found) && /wholePercents\(/.test(found) && /FOUND_FILL\[group\.on\]/.test(found), 'direct labels with percentages and counts, the chance in words, and an explainer');
  const { Colors } = await import('@/theme/colors');
  const fills = inRepo('src/components/insight-charts.tsx').match(/FOUND_FILL[^=]*= \{ 1: Colors\.(\w+), 2: Colors\.(\w+), 3: Colors\.(\w+) \}/);
  const lum = (hex) => { const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
  const ratio = (a, b) => (Math.max(lum(a), lum(b)) + 0.05) / (Math.min(lum(a), lum(b)) + 0.05);
  const [right, second, help] = fills.slice(1).map((name) => Colors[name]);
  assert.ok(ratio(right, second) >= 3 && ratio(right, help) >= 2 && ratio(second, help) >= 1.5, 'three shades that stay apart in lightness, not only in hue');
}

// The caregiver's tab bar: five tabs, Insights its own, every label on one line at every iPhone width
{
  const { CAREGIVER_TABS, TAB_BAR, tabShrink } = await import('@/lib/caregiver-tabs');
  const { MIN_FONT_SCALE, COMPACT_MAX_SCALE } = await import('@/theme/type-scale');
  assert.deepEqual(CAREGIVER_TABS.map((tab) => tab.label), ['Today', 'Trends', 'Insights', 'People', 'Settings'], 'five tabs, Insights between Trends and People');
  for (const width of [375, 390, 393, 402, 414, 428, 430, 440]) assert.equal(tabShrink(width), 1, `every label fits as it is at ${width}pt`);
  for (const width of [320, 375, 390, 430]) assert.ok(tabShrink(width, COMPACT_MAX_SCALE) >= MIN_FONT_SCALE, `at the largest caregiver text scale on a ${width}pt phone, labels shrink no further than ${MIN_FONT_SCALE * 100}%, so nothing wraps or cuts off`);
  assert.ok(tabShrink(320) >= 0.9, 'even the 320pt phone barely shrinks a label');
  assert.ok(tabShrink(375, 1, [...CAREGIVER_TABS, { id: 'x', label: 'Notifications' }]) < 1, 'the check notices a label that wouldn’t fit');
  assert.equal(TAB_BAR.label, 12);
  const dashboard = inRepo('src/app/caregiver/index.tsx');
  assert.ok(/<BrainIcon\b/.test(dashboard) && /tab\.id === 'insights'/.test(dashboard) && /Colors\.pinkInk/.test(dashboard), 'Insights has the pink brain');
  assert.ok(!/logo-wordmark/.test(dashboard) && /logo-mark\.png/.test(dashboard), 'a compact header: the mark, not the large wordmark');
  assert.ok(!/Segmented[^]*trends-view|TRENDS_VIEWS/.test(dashboard) && /tab === 'trends' \? <TrendsTab/.test(dashboard) && /tab === 'insights' \? <InsightsPanel/.test(dashboard), 'Trends is Activity, as it was; Insights is its own tab');
  const tabs = inRepo('src/components/tabs.tsx');
  assert.ok(/minHeight: COMPACT_TAP/.test(tabs) && /numberOfLines=\{1\}/.test(tabs) && /adjustsFontSizeToFit/.test(tabs) && /aria-selected/.test(tabs), '44pt tabs, one-line labels, the chosen one announced');
  const brain = inRepo('src/components/insight-brain.tsx');
  assert.ok(/<Path\b/.test(brain) && !/require\(|Image/.test(brain), 'the brain is drawn, not the logo asset');
}

// Insights in sections: the calendar's scores and shades, each person's page, and the sticky control
{
  const lib = await import('@/lib/insights');
  const { Colors } = await import('@/theme/colors');
  const { SCORE_BANDS, MEMORY_SCORE } = await import('@/config/insights');
  // The calendar shows each scored day's score, on its band's pink, the pinks light to deep and apart
  const calendar = inRepo('src/components/score-calendar.tsx');
  assert.ok(/testID=\{`score-\$\{dayKey\}`\}/.test(calendar) && /day\?\.score/.test(calendar), 'a scored day shows its score in its cell');
  assert.ok(/mode === 'completion'/.test(calendar) && /LEVEL_FILL/.test(calendar), 'the Completion view is still there, in its blues');
  const key = inRepo('src/components/score-key.tsx');
  const bandPink = SCORE_BANDS.map((band) => key.match(new RegExp(`'?${band.name}'?: Colors\\.(\\w+)`))[1]);
  const lum = (hex) => { const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
  const ratio = (a, b) => (Math.max(lum(a), lum(b)) + 0.05) / (Math.min(lum(a), lum(b)) + 0.05);
  const fills = bandPink.map((name) => Colors[name]);
  assert.equal(new Set(fills).size, 4, 'four different shades, one per band');
  assert.ok(fills.every((fill, index) => index === 0 || lum(fill) < lum(fills[index - 1])), 'lighter for lower bands, deeper for higher');
  assert.ok(fills.every((fill, index) => index === 0 || ratio(fill, fills[index - 1]) >= 1.2), 'neighboring bands tell apart');
  assert.ok(fills.every((fill) => ratio(Colors.text, fill) >= 4.5), 'the date and score on every shade at 4.5:1');
  // A person's page: the same score, over their cards, never from too few
  const person = (a, b, c) => ({ resolutions: { cards: a + b + c, counts: { 1: a, 2: b, 3: c } } });
  assert.deepEqual(lib.personScore(person(6, 3, 1)), { score: 81, band: 'Steady' }, 'the same points as a day’s score');
  assert.equal(lib.personScore(person(5, 3, 1)), undefined, `never from fewer than ${MEMORY_SCORE.minCards} cards`);
  const page = inRepo('src/components/insight-person.tsx');
  assert.ok(/<ScoreRing\b/.test(page) && /<FoundRows\b/.test(page) && /Open \$\{name\}’s profile/.test(page), 'the same ring, the same plain rows, and a way to their profile');
  // Four sections behind a sticky control; each ends on the note, once
  const panel = inRepo('src/components/insights.tsx');
  const { INSIGHTS_SEGMENTS } = { INSIGHTS_SEGMENTS: [...panel.matchAll(/\{ value: '(\w+)', label: '([^']+)' \}/g)].map((match) => match[2]) };
  assert.deepEqual(INSIGHTS_SEGMENTS, ['Overview', 'Answers', 'People', 'Days']);
  assert.equal((panel.match(/<Note testID="footer" \/>/g) ?? []).length, 2, 'the page’s footer note (and one while loading)');
  assert.ok(/stickyHeaderIndices=\{tab === 'insights'/.test(inRepo('src/app/caregiver/index.tsx')), 'the sections’ control stays at the top');
  assert.ok(/testID="speed-people"/.test(panel) && /width: '45%'/.test(panel), 'each person’s middle time in two even columns');
}

// Card records with sign-in on: the server's table keeps in step with the app, so a record the
// phone makes is never refused for a word it was never told about
{
  const { FACT_TYPES, HINT_RUNGS, phrasingsFor } = await import('@/lib/stories');
  const { ATTEMPTS_KEPT_DAYS } = await import('@/config/insights');
  const { randomUUID } = await import('node:crypto');
  const schema = inRepo('supabase/schema.sql');
  const table = schema.slice(schema.indexOf('create table if not exists public.attempt_records'), schema.indexOf('create index if not exists attempt_records_family_shown'));
  const listIn = (pattern) => [...table.match(pattern)[1].matchAll(/'([a-z_-]+)'/g)].map((match) => match[1]);
  assert.deepEqual(listIn(/fact_type text check \(fact_type in \(([\s\S]*?)\)\)/), [...FACT_TYPES], 'a record takes every kind of fact a card can have, and no other');
  assert.deepEqual(listIn(/shape in \(([^)]*)\)/), ['blank', 'ask', 'who', 'photo', 'reverse'], 'every shape');
  assert.deepEqual(listIn(/hints <@ array\[([^\]]*)\]/), [...HINT_RUNGS], 'and every hint rung');
  // "I'm not sure" (2026-11-13): rerun-safe columns, empty on older rows, and exactly the app's steps
  const { HINT_STEPS } = await import('@/lib/stories');
  assert.deepEqual([...schema.match(/help_steps <@ array\[([^\]]*)\]/)[1].matchAll(/'([a-z]+)'/g)].map((match) => match[1]), [...HINT_STEPS], 'every hint step a help request can reach, and no other');
  assert.ok(/add column if not exists help_at timestamptz\[\] not null default '\{\}'/.test(schema) && /add column if not exists help_steps text\[\] not null default '\{\}'/.test(schema), 'added with defaults, so older rows and older apps keep working');
  assert.ok(/drop constraint if exists attempt_records_help_check;\s*alter table public\.attempt_records add constraint attempt_records_help_check/.test(schema), 'and its check can be rerun');
  assert.ok(/extra_practice, help_at, help_steps\) on public\.attempt_records to authenticated/.test(schema), 'the person’s login may write them');
  const fixedIds = new Set(FACT_TYPES.flatMap((type) => phrasingsFor({ relationship: 'friend', hasPhoto: true }, { type, text: 'x', timeSensitive: false }).map((way) => way.id)));
  const allowed = table.match(/phrasing_id ~ '\^\(([^)]*)\)\$'/)[1].split('|');
  assert.deepEqual([...fixedIds].sort(), allowed.filter((id) => !id.startsWith('ai-')).sort(), 'how a card was asked: exactly the fixed shapes, so no words fit');
  assert.ok(new RegExp(`^(${allowed.join('|')})$`).test(`ai-${randomUUID()}`), 'or an approved AI sentence’s id');
  assert.ok(schema.includes(`interval '${ATTEMPTS_KEPT_DAYS + 1} days'`), 'the server keeps records a day past what the phone shows');
}

// Card records with sign-in on: what is uploaded, what never is, a resend, and the waits between tries
{
  const { toRow, fromRow, uploadable, mergeRecords, refusalOf, retryDelay, backfillFrom, RECORD_BATCH, RECORD_COLUMNS } = await import('@/lib/attempt-records');
  const { attemptOf } = await import('@/lib/attempts');
  const { randomUUID } = await import('node:crypto');
  const login = { personUserId: randomUUID(), caregiverId: randomUUID() };
  const t0 = new Date(2026, 10, 9, 10).getTime();
  const asked = { id: randomUUID(), personId: randomUUID(), phrasing: { id: 'who', kind: 'who' }, fact: { type: 'interest' }, choices: ['June', 'Leo', 'Mae'] };
  const record = attemptOf(asked, { shownAt: t0, selections: [{ at: t0 + 3_030, right: false }, { at: t0 + 7_000, right: true }], away: [], leftAt: t0 + 12_000, hints: ['letter'] }, { id: randomUUID(), sessionId: randomUUID(), goal: 36, source: 'template' });
  const row = toRow(record, login);
  assert.deepEqual(Object.keys(row).sort(), RECORD_COLUMNS.split(', ').filter((column) => column !== 'uploaded_at').sort(), 'a row is exactly the columns the server takes');
  assert.ok(!/June|Leo|Mae/.test(JSON.stringify(row)), 'no name goes, not even the names offered');
  assert.deepEqual([row.caregiver_id, row.person_user_id], [login.caregiverId, login.personUserId], 'it says whose family and whose login');
  // The server writes times its own way ("+00:00", no trailing zeros); read back, the record is the same
  const asPostgres = (iso) => iso.replace(/\.?0*Z$/, '+00:00');
  assert.equal(asPostgres('2026-11-09T10:00:03.030Z'), '2026-11-09T10:00:03.03+00:00');
  assert.deepEqual(fromRow({ ...row, shown_at: asPostgres(row.shown_at), selected_at: row.selected_at.map(asPostgres) }), record, 'a record survives the round trip exactly');
  const left = attemptOf({ ...asked, fact: undefined, again: true }, { shownAt: t0, selections: [], away: [], leftAt: t0 + 4_000, hints: [] }, { id: randomUUID(), sessionId: randomUUID(), goal: 36, source: 'ai' });
  assert.deepEqual(fromRow(toRow(left, login)), left, 'so does a card left unanswered, from before facts, asked again');
  // Help requests travel as two arrays, and a row from before them (or from a schema not yet rerun) reads as before
  const helped = attemptOf(asked, { shownAt: t0, selections: [{ at: t0 + 9_000, right: true }], away: [], leftAt: t0 + 12_000, hints: ['fact', 'relationship'], help: [{ at: t0 + 2_000, step: 'fact' }, { at: t0 + 5_000, step: 'relationship' }] }, { id: randomUUID(), sessionId: randomUUID(), goal: 36, source: 'template' });
  assert.deepEqual(helped.help, [{ at: new Date(t0 + 2_000).toISOString(), step: 'fact' }, { at: new Date(t0 + 5_000).toISOString(), step: 'relationship' }], 'each tap and the step it reached');
  assert.deepEqual(helped.selections.map((one) => one.right), [true], 'and no wrong answer: only the right name was chosen');
  const helpedRow = toRow(helped, login);
  assert.deepEqual([helpedRow.help_steps, helpedRow.help_at.length], [['fact', 'relationship'], 2]);
  assert.deepEqual([row.help_at, row.help_steps], [[], []], 'a card without help sends empty lists');
  assert.deepEqual(fromRow({ ...helpedRow, help_at: helpedRow.help_at.map(asPostgres) }), helped, 'help survives the round trip');
  const { help_at: _a, help_steps: _s, ...olderRow } = row;
  assert.deepEqual(fromRow(olderRow), record, 'an older row without the columns reads exactly as before');
  assert.ok(uploadable(helped) && !uploadable({ ...helped, help: 'fact' }), 'help must be a list to go');
  // What never goes
  assert.ok(uploadable(record));
  assert.ok(
    [{ testData: true }, { demo: true, testData: true }, { cardId: 'test-june-0' }, { personId: 'nora', cardId: 'nora-0' }, { personId: 'june' }, { id: 'demo-2026-11-09-1' }, { selections: undefined }].every((change) => !uploadable({ ...record, ...change })),
    'test data, the demo, a test fact, the phone’s own family and anything unreadable never go',
  );
  // What a refused upload means
  assert.deepEqual(
    ['23505', '23503', '23514', '22P02', '', undefined, 'PGRST000', 'PGRST301', 'PGRST205', '42501'].map(refusalOf),
    ['stored', 'gone', 'held', 'held', 'retry', 'retry', 'retry', 'retry', 'retry', 'retry'],
    'a resend is stored; someone deleted takes it; a value refused waits; offline, signed out, busy or not set up yet tries again',
  );
  // The waits: 2 seconds, doubling, at most 5 minutes, give or take a fifth
  assert.deepEqual([1, 2, 3, 9, 30].map((failures) => retryDelay(failures, () => 0.5)), [2_000, 4_000, 8_000, 300_000, 300_000]);
  assert.deepEqual([retryDelay(1, () => 0), retryDelay(1, () => 1)], [1_600, 2_400]);
  assert.equal(RECORD_BATCH, 25, 'small batches');
  // Several lists as one: each record once, oldest first, a later copy winning
  const first = { ...record, id: 'a', shownAt: '2026-11-09T10:00:00.000Z' };
  const second = { ...record, id: 'b', shownAt: '2026-11-09T09:00:00.000Z' };
  assert.deepEqual(mergeRecords([first, second], [{ ...first, goal: 40 }]).map((one) => [one.id, one.goal]), [['b', 36], ['a', 40]]);
  // The one-time backfill takes kept records about the family, never test data, oldest first, after the last sent
  const family = new Set([record.personId]);
  const now = new Date(2026, 10, 10);
  const next = { ...record, id: randomUUID(), shownAt: new Date(t0 + 60_000).toISOString() };
  const candidates = [next, record, { ...record, id: randomUUID(), shownAt: new Date(2026, 5, 1).toISOString() }, { ...record, id: randomUUID(), personId: randomUUID() }, { ...record, id: randomUUID(), testData: true }];
  assert.deepEqual(backfillFrom(candidates, family, undefined, now).map((one) => one.id), [record.id, next.id]);
  assert.deepEqual(backfillFrom(candidates, family, { shownAt: record.shownAt, id: record.id }, now).map((one) => one.id), [next.id]);
}

// Insights with sign-in on: when they were last fetched, in plain words, and sign-in off unchanged
{
  const { updatedText } = await import('@/lib/insights');
  const { ATTEMPTS_KEY } = await import('@/lib/attempts');
  const at = (day, hours, minutes) => new Date(2026, 10, day, hours, minutes).toISOString();
  assert.equal(updatedText(at(10, 15, 42), new Date(2026, 10, 10, 18)), 'Last updated today at 3:42 PM');
  assert.equal(updatedText(at(9, 9, 5), new Date(2026, 10, 10, 8)), 'Last updated yesterday at 9:05 AM');
  assert.equal(updatedText(at(4, 0, 30), new Date(2026, 10, 10, 8)), 'Last updated on November 4 at 12:30 AM');
  assert.equal(updatedText(at(10, 12, 0), new Date(2026, 10, 10, 13)), 'Last updated today at 12:00 PM');
  const panel = inRepo('src/components/insights.tsx');
  assert.ok(!/work with sign-in off/.test(panel), 'Insights no longer say they need sign-in off');
  assert.ok(panel.includes('updatedText(sync.updatedAt') && panel.split('<Note testID="footer" />').length >= 2, 'with sign-in on they say when they were last updated, and every state keeps the note');
  // Sign-in off: the phone keeps its records where it always has, and nothing of the sync reaches it
  assert.equal(ATTEMPTS_KEY, 'evermore.attempts.v1', 'records stay under the same key on the phone');
  const appData = inRepo('src/data/app-data.ts');
  assert.ok(/export const recordAttempt\b.*= AUTH_ENABLED \? server\.recordAttempt : local\.recordLocalAttempt;/.test(appData), 'with sign-in off a card’s record is kept on the phone, as before');
  assert.ok(/export const useDashboard\b.*= AUTH_ENABLED \? useServerDashboard : local\.useLocalDashboard;/.test(appData), 'and Insights read the phone’s records');
  const localStore = inRepo('src/data/local-store.ts');
  assert.ok(!/attempt-sync|insights-store|@\/lib\/supabase|insightsSync/.test(localStore), 'the phone-only store never reaches the server or the sync, so its Insights have no "Last updated" and no pull to refresh');
  const dashboardScreen = inRepo('src/app/caregiver/index.tsx');
  assert.ok(/const canRefresh = Boolean\(insightsSync\) &&/.test(dashboardScreen), 'pull to refresh exists only with sign-in on');
  // The practice device writes, the caregiver's device reads: each in one file
  const syncCode = inRepo('src/data/attempt-sync.ts').replace(/\/\/.*|\/\*[\s\S]*?\*\//g, '');
  assert.ok(/from\('attempt_records'\)\.insert\(/.test(syncCode) && !/\.(select|upsert|update)\(|\.delete\(\)/.test(syncCode), 'the practice device only inserts records, and never reads them back');
  const storeCode = inRepo('src/data/insights-store.ts').replace(/\/\/.*|\/\*[\s\S]*?\*\//g, '');
  assert.ok(/from\('attempt_records'\)\.select\(/.test(storeCode) && !/\.(insert|upsert|update)\(|\.delete\(\)/.test(storeCode), 'the caregiver’s device only reads them');
  // Export my data (2026-11-13) reads them too, as the caregiver, and changes nothing anywhere.
  const exportCode = inRepo('src/data/export-store.ts').replace(/\/\/.*|\/\*[\s\S]*?\*\//g, '');
  assert.ok(/'attempt_records'/.test(exportCode) && !/\.(insert|upsert|update|remove|rpc)\(|\.delete\(\)/.test(exportCode), 'the export only reads');
  assert.ok(walkFiles('src').filter((path) => /'attempt_records'/.test(inRepo(path))).sort().join() === 'src/data/attempt-sync.ts,src/data/export-store.ts,src/data/insights-store.ts', 'and nothing else touches the table');
}

// Insights: every word they can show, checked. The banned words, and no comparison with anyone else.
{
  /** The strings a file can show: its quoted text and its JSX text, without imports or comments. */
  const shownText = (path) => {
    const source = inRepo(path)
      .split('\n')
      .filter((line) => !/^\s*(import|export \* from)\b/.test(line))
      .join('\n')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/(^|[^:'"`])\/\/.*$/gm, '$1');
    const quoted = [...source.matchAll(/(['"`])((?:\\.|(?!\1)[^\\])*)\1/g)].map((match) => match[2]);
    const jsx = [...source.matchAll(/>([^<>{}]*[A-Za-z][^<>{}]*)</g)].map((match) => match[1]);
    return [...quoted, ...jsx].map((text) => text.trim()).filter(Boolean);
  };
  // "Memory score" is the score's name since 2026-11-10, which supersedes the earlier rule that kept the phrase off every screen.
  const BANNED = /\b(wrong|failed|failure|fail|declin\w*|diagnos\w*|disease|progression|prognos\w*|severity|accuracy|missed)\b/i;
  const OTHERS = /\b(other (people|patients|families)|most people|average person|everyone else|typical for|normal for|population|percentile|peers?|than (most|average|others))\b/i;
  const CARD_SCORE = /\b(card|answer|question)(['’]s)? score\b|\bscore (for|of) (a|each|this) (card|answer|question)\b/i;
  const insightFiles = walkFiles('src').filter((path) => /insight|attempt|score-|day-sheet/.test(path));
  assert.ok(insightFiles.includes('src/lib/insights.ts') && insightFiles.includes('src/config/insights.ts'), insightFiles.join(', '));
  const read = shownText('src/lib/insights.ts');
  assert.ok(read.includes('Gently improving') && read.some((text) => text.startsWith('Practice time met the standard on ${met}')), 'the check reads the words, template strings included');
  // What the Memory score may never be said to do: diagnose, track or measure the progression of, or
  // predict any condition, or compare people. Any condition at all is left unnamed.
  const CLAIMS = [
    /\bdiagnos\w*|\bprognos\w*/i,
    /\bpredict\w*|\bforecast\w*/i,
    /\b(track|tracks|tracking|monitor\w*|measure|measures|measuring|detect\w*|screen(s|ing)? for)\b[^.]*\b(progress\w*|condition|illness|disease|dementia|alzheimer\w*|cognitive|cognition|impairment|symptoms?|decline|memory loss|brain)\b/i,
    /\b(dementia|alzheimer\w*|cognitive|cognition|impairment|symptoms?|illness|conditions?|clinical\w*)\b/i,
    /\b(compar\w*|rank\w*)\b[^.]*\b(other (people|person|patients|families)|others|everyone|anyone else|peers?|people (their|his|her) age|norms?|average)\b/i,
    /\branks?\b|\branking\b|\bleaderboard\b/i,
    /\bthan (the )?average\b|\b(people|someone|others) (of )?(their|his|her) age\b|\bfor (his|her|their) age\b/i,
  ];
  const claimIn = (text) => CLAIMS.find((pattern) => pattern.test(text));
  for (const path of insightFiles) {
    for (const text of shownText(path)) {
      assert.ok(!BANNED.test(text), `${path}: "${text}" uses a word insights never say`);
      assert.ok(!OTHERS.test(text), `${path}: "${text}" compares with other people`);
      assert.ok(!CARD_SCORE.test(text), `${path}: "${text}" gives a single card a score`);
      assert.ok(!claimIn(text), `${path}: "${text}" makes a claim the Memory score can’t (${claimIn(text)})`);
    }
  }
  // Wherever else the score is named, the same claims are refused.
  for (const path of walkFiles('src')) {
    for (const text of shownText(path).filter((one) => /score/i.test(one))) assert.ok(!claimIn(text), `${path}: "${text}" makes a claim the Memory score can’t`);
  }
  // The claim check passes what Insights say, and fails what they must never say.
  for (const fine of ['The Memory score summarizes one day of practice.', 'Compare it only with the same person’s own history.', 'Memory score, last 30 days', 'It is not a medical measure.', 'Practice has been gently improving over the last two weeks, compared with the two weeks before.', 'This is about what random guessing would score, so it is not a sign of recall']) {
    assert.ok(!claimIn(fine) && !BANNED.test(fine) && !OTHERS.test(fine), `"${fine}" is allowed`);
  }
  for (const claim of ['The Memory score diagnoses memory loss.', 'A low score can help diagnose a problem.', 'The Memory score tracks the progression of dementia.', 'It measures how a condition progresses.', 'This score predicts future memory.', 'Scores forecast what comes next.', 'It can detect cognitive changes.', 'Compared with other people his age, June is doing well.', 'Ranks each person by score.', 'Higher than the average for people their age.', 'Monitors symptoms over time.']) {
    assert.ok(claimIn(claim) || BANNED.test(claim) || OTHERS.test(claim), `the copy check refuses "${claim}"`);
  }
  // The rename is complete: no screen, view or sheet says "Practice score", whichever way its records came (the phone's, or the server's).
  for (const path of [...walkFiles('src'), ...walkFiles('supabase/functions')]) {
    for (const text of shownText(path)) assert.ok(!/practice score/i.test(text), `${path}: "${text}" still says Practice score`);
  }
  assert.ok(shownText('src/components/insights.tsx').some((text) => text.startsWith('Memory score, ')), 'the hero names the Memory score');
  assert.ok(['src/data/insights-store.ts', 'src/data/attempt-sync.ts', 'src/lib/attempt-records.ts'].every((path) => !/practice score/i.test(inRepo(path))), 'nor do the sync’s files, which feed the same views');
  // The checks catch what they should
  assert.ok(BANNED.test('A decline this week') && BANNED.test('Diagnosis') && BANNED.test('wrong answers') && OTHERS.test('better than most people') && OTHERS.test('the 80th percentile') && CARD_SCORE.test('this card’s score'));
  assert.ok(!OTHERS.test('compared with the two weeks before') && !BANNED.test('Needed more support lately'));
  // "Accuracy" stays out of every screen, insights or not
  for (const path of walkFiles('src').filter((one) => /^src\/(app|components)\//.test(one))) {
    for (const text of shownText(path)) assert.ok(!/\baccuracy\b/i.test(text), `${path}: "${text}" says accuracy`);
  }
  // Nothing from insights reaches the person: no person-facing file imports an insights view or figure.
  // (The practice card only measures, through the record's types; the route only hands the record on.)
  const personFacing = ['src/app/index.tsx', 'src/app/practice.tsx', 'src/app/sign-in.tsx', 'src/components/practice-screen.tsx', 'src/components/practice-more.tsx', 'src/components/reveal-photo.tsx', 'src/components/success-banner.tsx', 'src/components/progress-bar.tsx', 'src/components/caregiver-button.tsx', 'src/components/text-size.tsx', 'src/components/reminders.tsx'];
  for (const path of personFacing) {
    const imports = inRepo(path).split('\n').filter((line) => /^import\b/.test(line));
    assert.ok(!imports.some((line) => /insight|score-|day-sheet|approve-all|@\/config\/insights/.test(line)), `${path} imports something from insights or approvals`);
    assert.ok(imports.filter((line) => /@\/lib\/attempts/.test(line)).every((line) => /^import type\b/.test(line)), `${path} may only use the record's types`);
  }
}

// Question refinement (docs/QUESTION-AUDIT.md): every fixed shape is short, the names offered are
// distinct and don't sound alike, practice says only approved facts, never judges, and never shows the
// answer in the question. Cue fading, the answer at the end of the ladder, and "Today you saw".
{
  const { PLAIN_MOST_WORDS, templateFrames, wordCount, soundsAlike, chooseNames, cueLevel, saysName, HINT_LADDER, HINT_RUNGS, BLANK } = stories;
  const { nearestCue, todayYouSaw, practiceFrom, planToday, dailyTarget } = sessions5;
  const aiCheck = await import('@/lib/ai-check');
  const JUDGING = /\b(wrong|incorrect|fail|fails|failed|failing|failure)\b/i;
  /** The strings a file can show (quoted and JSX text, no imports or comments), as the insights check reads them. */
  const shownText = (path) => {
    const source = inRepo(path).split('\n').filter((line) => !/^\s*import\b/.test(line)).join('\n').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1');
    return [...[...source.matchAll(/(['"`])((?:\\.|(?!\1)[^\\])*)\1/g)].map((match) => match[2]), ...[...source.matchAll(/>([^<>{}]*[A-Za-z][^<>{}]*)</g)].map((match) => match[1])].map((text) => text.trim()).filter(Boolean);
  };

  // 1. No fixed shape runs past the word guide. The caregiver's words come on top, and story approval notes a long one.
  assert.equal(PLAIN_MOST_WORDS, 14, 'the guide is about 14 words');
  const frames = templateFrames();
  assert.equal(frames.length, stories.FACT_TYPES.reduce((sum, type) => sum + asked(type, 'x', withAll).length, 0), 'every shape of every kind of fact is listed');
  for (const { id, words } of frames) assert.ok(wordCount(words) <= PLAIN_MOST_WORDS, `${id}: ${wordCount(words)} fixed words in "${words.trim()}"`);
  const fixedLines = ['Take your time.', 'The name starts with S.', 'It starts with G.', 'This is your great-grandmother.', 'Let’s try with fewer names.', 'Think of their laugh.', 'It’s Sofia.', 'Choose a name', 'Choose one', 'Yes, that’s it.', 'Today you saw', 'Shorter sentences are easier to read.'];
  for (const line of fixedLines) assert.ok(wordCount(line) <= PLAIN_MOST_WORDS, `"${line}" is short`);
  assert.equal(wordCount('My aunt, {name}, enjoys gardening.'), 5, 'the blank counts as one word');
  // AI sentences: asked for 14 words, refused past 16.
  const words = (n) => Array.from({ length: n }, (_, i) => `w${String.fromCharCode(97 + (i % 26))}${String.fromCharCode(97 + Math.floor(i / 26))}`).join(' ');
  const aiOne = (n) => aiCheck.checkSentence({ sentence: `____ ${words(n)}.`, blank_answer_placeholder: '[NAME]', fact_ids_used: ['f1'], shape: 'one_fact' }, { facts: [{ id: 'f1', type: 'memory', text: words(n) }] });
  assert.equal(aiOne(16), null, 'an AI sentence of 16 words passes');
  assert.equal(aiOne(17), 'too-long', 'one of 17 is dropped');
  assert.ok(/at most 14 words/.test(inRepo('supabase/functions/generate-questions/index.ts')), 'the prompt asks for 14 words or fewer');
  assert.ok(/active voice/.test(inRepo('supabase/functions/generate-questions/index.ts')) && /never a double negative/.test(inRepo('supabase/functions/generate-questions/index.ts')), 'and active voice, no double negatives');

  // 2. Names that sound alike aren't offered together, and no name is offered twice.
  for (const [a, b, alike] of [['June', 'Jane', true], ['Kathy', 'Cathy', true], ['Philip', 'Filip', true], ['Mae', 'Milo', true], ['Sam Lee', 'Sam Park', true], ['Ann', 'Dan', true], ['Leo', 'Omar', false], ['Ruth', 'Bea', false], ['Omar', 'Ruth', false], ['June', 'Leo', false]]) {
    assert.equal(soundsAlike(a, b), alike, `${a} and ${b} ${alike ? 'sound' : 'don’t sound'} alike`);
  }
  const pool = ['June', 'Jane', 'Leo', 'Lee', 'Omar', 'Ruth', 'Bea', 'Kathy', 'Cathy', 'Dot'];
  let seen = [];
  for (let run = 0; run < 600; run++) {
    const answer = pool[Math.floor(dayRandom() * pool.length)];
    const choices = chooseNames(answer, pool, [seen], undefined, dayRandom);
    seen = choices;
    assert.equal(new Set(choices).size, choices.length, `no name twice: ${choices}`);
    assert.equal(choices.filter((name) => name === answer).length, 1, 'the answer once');
    assert.equal(choices.length, 3, 'three names');
    assert.ok(choices.every((name) => name === answer || !soundsAlike(name, answer)), `nothing that sounds like ${answer}: ${choices}`);
    const others = choices.filter((name) => name !== answer);
    assert.ok(!soundsAlike(others[0], others[1]), `the other two don't sound alike either: ${choices}`);
  }
  // Only a deck with nothing else falls back to an alike name, so a card still has a choice.
  assert.deepEqual([...chooseNames('Ann', ['Ann', 'Anne'], [], undefined, dayRandom)].sort(), ['Ann', 'Anne'], 'two people: both names, alike or not');

  // 3. Practice says only approved facts: a waiting or skipped fact never reaches a card, a hint or a choice.
  let family = families.EMPTY_FAMILY;
  for (const [i, name] of ['Ann', 'Bo', 'Cy', 'Di'].entries()) {
    family = families.addPerson(family, { id: `qa${i}`, name, relationship: 'friend', photoUri: `file:///${i}.jpg` }, [fact('interest', `hobby ${i}`), fact('shared', `went on trip ${i}`), fact('food', `dish ${i}`), fact('work', `job ${i}`), fact('team', `zebrawaiting ${i}`), fact('show', `quokkaskipped ${i}`)], nextId);
  }
  for (const c of family.cards) family = families.setStatus(family, c.id, c.text.startsWith('zebra') ? 'pending' : c.text.startsWith('quokka') ? 'skipped' : 'approved', now11);
  family = families.settleDeck(family, hasPicture);
  const built = practiceFrom(family.people, family.cards, hasPicture);
  const approvedDeck = cardsOf(built.people, built.cards);
  const approvedWords = new Set(family.cards.filter((c) => c.status === 'approved').flatMap((c) => c.text.toLowerCase().split(/\s+/)));
  const said = [];
  for (const steps of [{}, Object.fromEntries(approvedDeck.map((c) => [c.id, { step: 4, dueAt: at(-1) }]))]) {
    for (let run = 0; run < 20; run++) {
      const day = planToday({ deck: approvedDeck, schedule: steps, now, goal: dailyTarget(approvedDeck, 'long'), completed: 0, asked: [], random: dayRandom });
      for (const round of stories.makeRounds(day, approvedDeck, {}, dayRandom)) {
        const texts = [round.phrasing.ask, round.phrasing.reveal, round.clue ?? '', ...round.choices, ...[1, 2, 3, 4, 5, 6].map((misses) => `${stories.hintAt(round, misses).lead} ${stories.hintAt(round, misses).detail}`)];
        said.push(...texts);
        // 5. The answer never shows in the question.
        assert.ok(!saysName(round.phrasing.ask.replace(BLANK, ' '), round.answer), `"${round.phrasing.ask}" doesn't show ${round.answer}`);
        // Every word beyond the fixed shape is the card's own approved fact, its relationship or the name.
        const rest = (round.phrasing.ask + ' ' + round.phrasing.reveal).replace(/\{name\}|’s/g, ' ').split(round.fact.text).join(' ').replace(/\bfriend\b/g, ' ').toLowerCase().match(/[a-z0-9]+/g) ?? [];
        const extra = rest.filter((word) => !TEMPLATE_WORDS.has(word));
        assert.deepEqual(extra, [], `${round.phrasing.id}: nothing but the shape and the fact: ${extra}`);
        assert.ok(round.choices.every((name) => built.people.some((person) => person.name === name)), 'every name offered is a person in the deck');
      }
    }
  }
  const everything = said.join(' \n ');
  assert.ok(!/zebrawaiting|quokkaskipped/.test(everything), 'no waiting or skipped fact is ever said');
  assert.ok(said.some((text) => /hobby|trip|dish|job/.test(text)) && [...approvedWords].length > 0, 'while the approved ones are');
  // 4. No judging words, on any card, hint or screen of practice.
  assert.ok(!JUDGING.test(everything), 'no card or hint says wrong, incorrect or fail');
  for (const type of stories.FACT_TYPES) for (const p of asked(type, 'WORDS', withAll)) assert.ok(!JUDGING.test(p.ask + p.reveal), `${type}/${p.id} judges nothing`);
  for (const path of ['src/components/practice-screen.tsx', 'src/app/index.tsx', 'src/app/practice.tsx', 'src/components/practice-more.tsx', 'src/lib/stories.ts']) {
    for (const text of shownText(path)) assert.ok(!JUDGING.test(text), `${path}: "${text}" judges`);
  }
  assert.ok(JUDGING.test('That was wrong') && JUDGING.test('You failed') && !JUDGING.test('Take your time.'), 'the judging-word check itself works');

  // 5. A question that would say the name is left out; a card with nothing left to ask isn't practiced.
  assert.deepEqual(stories.phrasingsFor({ relationship: 'friend', hasPhoto: true, name: 'June' }, fact('nickname', 'June Bug')).map((p) => p.id), ['photo'], 'only the photo is left to ask "June Bug"');
  assert.deepEqual(stories.phrasingsFor({ relationship: 'friend', hasPhoto: true, name: 'Mary Ann' }, fact('memory', 'grows Mary’s roses')).map((p) => p.id), ['photo'], 'a first name counts too');
  assert.equal(stories.phrasingsFor({ relationship: 'friend', hasPhoto: true, name: 'Ann' }, fact('memory', 'loves the annual fair')).length, 5, 'a name inside another word doesn’t');
  assert.equal(cardsOf([{ id: 'p1', name: 'June', relationship: 'aunt' }], [{ id: 'c1', personId: 'p1', sentence: 'x', fact: fact('nickname', 'June Bug') }]).length, 0, 'no photo, nothing left: the card is not practiced');
  assert.ok(/name: person\.name/.test(inRepo('src/app/caregiver/review.tsx')), 'story approval lists the same ways, without the ones that show the name');
  // A reverse card names the person, and its fact never shows (checked in ai-check, on both sides).
  assert.equal(aiCheck.checkSentence({ sentence: '[NAME] enjoys gardening ____.', blank_answer_placeholder: '[FACT:f1]', fact_ids_used: ['f1'], shape: 'reverse' }, { facts: [{ id: 'f1', type: 'interest', text: 'gardening' }] }), 'answer-leak', 'a reverse card that shows its answer is dropped');
  assert.equal(aiCheck.checkSentence({ sentence: 'My aunt, ____, is [NAME].', blank_answer_placeholder: '[NAME]', fact_ids_used: ['f1'], shape: 'one_fact' }, { facts: [{ id: 'f1', type: 'interest', text: 'gardening' }], relationship: 'aunt' }), 'answer-leak', 'so is a name in any other card');

  // 6. Cue fading: the richest cue for a new card, leaner ones as it climbs. A preference, never a lock.
  const team = asked('team', 'the Riverton Otters');
  const levels = (list) => list.map((p) => `${p.id}:${cueLevel(p)}`);
  assert.deepEqual(levels(team), ['my-rel:0', 'name:1', 'favorite:1', 'ask:1', 'who:1', 'photo:2'], 'each way’s cue level');
  assert.deepEqual(nearestCue(team, 0).map((p) => p.id), ['my-rel'], 'step 0: the relationship and the fact');
  assert.deepEqual(nearestCue(team, 1).map((p) => p.id), ['my-rel', 'name', 'favorite', 'ask', 'who'], 'step 1: rich or one fact');
  assert.deepEqual(nearestCue(team, 2).map((p) => p.id), ['name', 'favorite', 'ask', 'who', 'photo'], 'step 2: no relationship, the face alone allowed');
  assert.deepEqual(nearestCue(team.filter((p) => p.id !== 'my-rel'), 0).map((p) => p.id), ['name', 'favorite', 'ask', 'who'], 'no richest left: the next richest, never nothing');
  assert.ok(nearestCue(team, 5).every((p) => cueLevel(p) >= 1), 'a high step never leads with the relationship');
  const asWays = (steps) => {
    const ways = [];
    for (let run = 0; run < 20; run++) ways.push(...planToday({ deck: approvedDeck, schedule: steps, now, goal: dailyTarget(approvedDeck, 'standard'), completed: 0, asked: [], random: dayRandom }).map((r) => r.phrasings[0]));
    return ways;
  };
  const fresh = asWays({});
  const climbed = asWays(Object.fromEntries(approvedDeck.map((c) => [c.id, { step: 4, dueAt: at(-1) }])));
  const share = (ways, test) => ways.filter(test).length / ways.length;
  // Measured on this deck: about a third of new cards, about 2% of cards on step 4 (only when a fact's other ways are used up today).
  assert.ok(share(fresh, (p) => p.id === 'my-rel') >= 0.25, `new cards often get the relationship cue (${share(fresh, (p) => p.id === 'my-rel').toFixed(2)})`);
  assert.ok(share(climbed, (p) => p.id === 'my-rel') <= 0.05, `cards on a high step rarely do (${share(climbed, (p) => p.id === 'my-rel').toFixed(2)})`);
  // The face alone is once a day per person either way, so fading shows in what comes first: at step 4 a person's first card may be photo-only, at step 0 never while a richer way is open.
  const firstOf = (steps) => {
    const firsts = [];
    for (let run = 0; run < 20; run++) {
      const day = planToday({ deck: approvedDeck, schedule: steps, now, goal: dailyTarget(approvedDeck, 'standard'), completed: 0, asked: [], random: dayRandom });
      firsts.push(...[...new Set(day.map((one) => one.personId))].map((id) => day.find((one) => one.personId === id).phrasings[0]));
    }
    return firsts;
  };
  assert.ok(firstOf({}).every((p) => p.id === 'my-rel'), 'a person\u2019s first new card today leads with the relationship');
  assert.ok(firstOf(Object.fromEntries(approvedDeck.map((c) => [c.id, { step: 4, dueAt: at(-1) }]))).some((p) => p.kind === 'photo'), 'and on a high step it may be the face alone');
  assert.ok(/CUE_FADING/.test(inRepo('src/config/schedule.ts')) && !/CUE_FADING = /.test(walkFiles('src').filter((path) => path !== 'src/config/schedule.ts').map(inRepo).join('\n')), 'the fading bands live only in src/config/schedule.ts');

  // The ladder: meaningful cues first, then the letter, then fewer names, then the answer. The stored set is unchanged.
  assert.deepEqual([...HINT_LADDER], ['fact', 'relationship', 'letter', 'fewer']);
  assert.deepEqual([...HINT_LADDER].sort(), [...HINT_RUNGS].sort(), 'the same rungs the caregiver turns on and off');
  assert.ok(/selected=\{hint\.show && name === target\}/.test(inRepo('src/components/practice-screen.tsx')), 'once said, the answer’s button shows which one it is');

  // 7. "Today you saw": everyone with a photo, in the order they first came up, at most six.
  const r = (personId, answer, again) => ({ personId, answer, again });
  const faces = { a: 1, b: 1, c: 1, d: 1, e: 1, f: 1, g: 1 };
  assert.deepEqual(todayYouSaw([r('b', 'Bo'), r('a', 'Ann'), r('b', 'Bo', 'reask'), r('x', 'Xi'), r('c', 'Cy')], faces).map((one) => one.name), ['Bo', 'Ann', 'Cy'], 'first-seen order, once each, nobody without a photo');
  assert.equal(todayYouSaw('abcdefg'.split('').map((id) => r(id, id.toUpperCase())), faces).length, 6, 'at most six');

  // 8. No one's household is offered as a choice on someone else's card.
  assert.ok(!aiCheck.canReverse({ id: 'f1', type: 'lives_with', text: 'two cats' }) && aiCheck.canReverse({ id: 'f1', type: 'pet', text: 'two cats' }));
}

// The landscape logo: one component, the file as it is, on every sign-in step and the person's home
{
  const logo = inRepo('src/components/logo.tsx');
  const png = readFileSync(new URL('../assets/images/logo-wordmark.png', import.meta.url));
  const [width, height] = [png.readUInt32BE(16), png.readUInt32BE(20)];
  const aspect = logo.match(/LOGO_ASPECT = (\d+) \/ (\d+);/);
  assert.ok(aspect && Number(aspect[1]) === width && Number(aspect[2]) === height, `LOGO_ASPECT matches the file's ${width} x ${height}`);
  assert.ok(/contentFit="contain"/.test(logo) && /accessibilityLabel="Evermore"/.test(logo), 'contained, never stretched or cropped, and read as "Evermore"');
  assert.ok(/height: shown \/ LOGO_ASPECT/.test(logo) && !/tintColor|blurRadius|contentFit="(cover|fill)"/.test(logo), 'its own shape, no recolor or effects');
  for (const path of walkFiles('src').filter((one) => one !== 'src/components/logo.tsx')) {
    assert.ok(!/require\([^)]*logo-wordmark\.png/.test(inRepo(path)), `${path} shows the logo through <Logo />, not its own markup`);
  }
  const placed = {
    'src/components/sign-in/welcome.tsx': ['logo-welcome'],
    'src/app/index.tsx': ['logo-home'],
    'src/components/sign-in/caregiver-sign-in.tsx': ['logo-sign-in'],
    'src/components/sign-in/caregiver-sign-up.tsx': ['logo-create-account'],
    'src/components/sign-in/person-sign-in.tsx': ['logo-person-sign-in'],
  };
  for (const [path, testIDs] of Object.entries(placed)) {
    for (const testID of testIDs) assert.ok(inRepo(path).includes(`"${testID}"`), `${path} shows the logo as ${testID}`);
  }
  // Steps with a field fold the logo while the keyboard is up, so it never takes their room.
  for (const testID of ['logo-person-sign-in']) {
    const path = Object.keys(placed).find((one) => placed[one].includes(testID));
    assert.ok(new RegExp(`testID="${testID}" foldWithKeyboard`).test(inRepo(path)), `${testID} folds with the keyboard`);
  }
  assert.ok(/logo \? <Logo size="form" testID=\{logo\} foldWithKeyboard \/>/.test(inRepo('src/components/caregiver-ui.tsx')), 'the caregiver forms’ logo folds with the keyboard');
  // On the person's home the logo is above Start, and the middle scrolls, so Start is never pushed off.
  const home = inRepo('src/app/index.tsx');
  assert.ok(home.indexOf('logo-home') < home.indexOf('testID="start"') && /<ScrollView style=\{styles\.middle\}/.test(home), 'home: the logo above Start, in a middle that can scroll');
}

// ---------------------------------------------------------------------------------------
// The study day (docs/STUDY-DAY-AUDIT.md): 05:30 to 05:29 the next morning, local time, named
// for the date it began on. studyDayKey is the only place the boundary is worked out.
// ---------------------------------------------------------------------------------------
{
  const { studyDayKey, studyDayStart, addStudyDays, laterDay, lastStudyDays, nextStudyDayStart, dayOf } = studyDays;
  const pacingConfig = await import('@/config/schedule');
  const sessionLib = await import('@/lib/session');
  const localLib = await import('@/lib/local-practice');
  const insightsLib = await import('@/lib/insights');
  const recordsLib = await import('@/lib/attempt-records');
  const attemptsLib = await import('@/lib/attempts');
  const zoneBefore = process.env.TZ;
  process.env.TZ = 'America/New_York';
  const local = (y, m, d, h = 0, min = 0, sec = 0) => new Date(y, m - 1, d, h, min, sec);

  // The constants, in one place
  assert.deepEqual([pacingConfig.DAY_START_HOUR, pacingConfig.DAY_START_MINUTE], [5, 30], 'the day begins at 05:30');
  const usesStart = walkFiles('src').filter((path) => /DAY_START_(HOUR|MINUTE)/.test(inRepo(path)));
  assert.deepEqual(usesStart.sort(), ['src/config/schedule.ts', 'src/lib/study-day.ts'], 'only studyDayKey (and its start) use the constants');

  // studyDayKey: the boundaries, on this device
  assert.equal(studyDayKey(local(2026, 11, 13, 5, 29, 59)), '2026-11-12', '05:29:59 is still the day before');
  assert.equal(studyDayKey(local(2026, 11, 13, 5, 30, 0)), '2026-11-13', '05:30:00 starts the new day');
  assert.equal(studyDayKey(local(2026, 11, 13, 0, 0, 0)), '2026-11-12', 'midnight belongs to the day before');
  assert.equal(studyDayKey(local(2026, 11, 13, 2, 0)), '2026-11-12', '02:00 on Nov 13 is study day Nov 12');
  assert.equal(studyDayKey(local(2026, 11, 12, 23, 59, 59)), '2026-11-12', 'the evening is the same day');
  assert.equal(studyDayKey(local(2027, 1, 1, 3)), '2026-12-31', 'across a new year');
  assert.equal(studyDayKey(local(2028, 3, 1, 4)), '2028-02-29', 'across a leap day');
  // In a named time zone
  assert.equal(studyDayKey(new Date('2026-11-13T10:29:59Z'), 'America/New_York'), '2026-11-12', 'New York, 05:29:59 EST');
  assert.equal(studyDayKey(new Date('2026-11-13T10:30:00Z'), 'America/New_York'), '2026-11-13', 'New York, 05:30:00 EST');
  // Daylight saving in a US time zone: spring forward on Mar 8 2026, fall back on Nov 1 2026
  assert.equal(studyDayKey(new Date('2026-03-08T09:29:59Z'), 'America/New_York'), '2026-03-07', 'spring forward: 05:29:59 EDT is still Mar 7');
  assert.equal(studyDayKey(new Date('2026-03-08T09:30:00Z'), 'America/New_York'), '2026-03-08', 'and 05:30 EDT starts Mar 8');
  assert.equal(studyDayStart('2026-03-09').getTime() - studyDayStart('2026-03-08').getTime(), 24 * 3_600_000, 'Mar 8 to Mar 9 is a whole day');
  assert.equal(studyDayStart('2026-03-08').getTime() - studyDayStart('2026-03-07').getTime(), 23 * 3_600_000, 'the study day across spring forward is 23 hours');
  assert.equal(studyDayStart('2026-03-08').toISOString(), '2026-03-08T09:30:00.000Z', 'and still begins at 05:30 local');
  assert.equal(studyDayKey(new Date('2026-11-01T10:29:59Z'), 'America/New_York'), '2026-10-31', 'fall back: 05:29:59 EST is still Oct 31');
  assert.equal(studyDayKey(new Date('2026-11-01T10:30:00Z'), 'America/New_York'), '2026-11-01', 'and 05:30 EST starts Nov 1');
  assert.equal(studyDayStart('2026-11-01').getTime() - studyDayStart('2026-10-31').getTime(), 25 * 3_600_000, 'the study day across fall back is 25 hours');
  assert.deepEqual(['2026-11-01T05:30:00Z', '2026-11-01T06:30:00Z'].map((at) => studyDayKey(new Date(at), 'America/New_York')), ['2026-10-31', '2026-10-31'], 'the hour that happens twice (01:30) is the day before, both times');
  assert.equal(studyDayKey(new Date('2026-03-08T09:29:59Z')), studyDayKey(new Date('2026-03-08T09:29:59Z'), 'America/New_York'), 'the device’s own zone and the named zone agree');
  // A time zone change: the same instant, a different local day
  const instant = new Date('2026-11-13T09:00:00Z');
  assert.deepEqual(['America/Los_Angeles', 'America/New_York', 'Europe/London', 'Asia/Tokyo'].map((zone) => studyDayKey(instant, zone)), ['2026-11-12', '2026-11-12', '2026-11-13', '2026-11-13'], '01:00, 04:00, 09:00 and 18:00 local');
  assert.equal(nextStudyDayStart(local(2026, 11, 13, 2)).getTime(), local(2026, 11, 13, 5, 30).getTime(), 'at 02:00 the next day begins at 05:30 that morning');
  assert.equal(nextStudyDayStart(local(2026, 11, 13, 6)).getTime(), local(2026, 11, 14, 5, 30).getTime(), 'at 06:00, the next morning');
  assert.deepEqual(lastStudyDays('2026-03-02', 3), ['2026-02-28', '2026-03-01', '2026-03-02'], 'days counted back by the calendar');
  assert.equal(addStudyDays('2026-11-07', 1), '2026-11-08');

  // The device's clock: it only moves forward, so a day's session is never handed out twice
  const run = (zoneAndTimes) => zoneAndTimes.reduce((days, [at, zone]) => [...days, laterDay(days.at(-1), studyDayKey(new Date(at), zone))], []);
  const fresh = (days) => days.filter((day, index) => day !== days[index - 1]);
  const back = run([['2026-11-13T13:00:00Z'], ['2026-11-12T13:00:00Z'], ['2026-11-13T14:00:00Z']]);
  assert.deepEqual(back, ['2026-11-13', '2026-11-13', '2026-11-13'], 'clock set back a day: the day stays, no extra session');
  const jumpy = run([['2026-11-13T13:00:00Z'], ['2026-11-15T13:00:00Z'], ['2026-11-13T15:00:00Z'], ['2026-11-14T13:00:00Z'], ['2026-11-16T11:00:00Z']]);
  assert.deepEqual(jumpy, ['2026-11-13', '2026-11-15', '2026-11-15', '2026-11-15', '2026-11-16'], 'forward then back: each day begins at most once');
  assert.equal(new Set(fresh(jumpy)).size, fresh(jumpy).length, 'no study day is ever available twice');
  const west = run([['2026-11-13T12:00:00Z', 'America/New_York'], ['2026-11-13T12:30:00Z', 'America/Los_Angeles']]);
  assert.deepEqual(west, ['2026-11-13', '2026-11-13'], 'travel west at 07:00 (04:30 there): the same day, not yesterday again');
  const east = run([['2026-11-13T12:00:00Z', 'America/Los_Angeles'], ['2026-11-13T13:00:00Z', 'Europe/London']]);
  assert.deepEqual(east, ['2026-11-12', '2026-11-13'], 'travel east: the new local day begins by the new local time, one day on, none skipped');
  const steady = run(Array.from({ length: 6 }, (_, i) => [new Date(Date.UTC(2026, 10, 10 + i, 15)).toISOString(), 'America/New_York']));
  assert.deepEqual(steady, lastStudyDays('2026-11-15', 6), 'day after day, each day once and none skipped');

  // Daily completion, a fresh session at 05:30, and the unfinished-yesterday rule
  const deck = deckFor([4, 4, 4]);
  const goal = sessionLib.dailyTarget(deck, 'short');
  let practice = localLib.emptyPractice(local(2026, 11, 1, 9));
  const day = (at, sessionId, cards, extraPractice = false) => {
    practice = localLib.startSession(practice, sessionId, at, goal, { studyDay: studyDayKey(at), extraPractice });
    for (let i = 0; i < cards; i++) practice = localLib.finishCard(practice, sessionId, deck[i % deck.length].id, clean, at).state;
  };
  day(local(2026, 11, 12, 23, 0), 'late', goal);
  assert.equal(activity.cardsOn(practice.sessions, '2026-11-12'), goal, 'a round finished at 11 PM completes Nov 12');
  day(local(2026, 11, 13, 3, 0), 'night', 4, true);
  assert.equal(activity.cardsOn(practice.sessions, '2026-11-13'), 0, 'practice at 3 AM never makes the next day’s session count early');
  assert.equal(activity.cardsOn(practice.sessions, '2026-11-12'), goal + 4, 'it counts toward the day it belongs to, already complete');
  assert.ok(practice.sessions.find((one) => one.id === 'night').extraPractice, 'and is extra practice');
  const morning = local(2026, 11, 13, 5, 30);
  const todayLog = sessionLib.goalToday(deck, 'short', { day: '2026-11-12', asked: [{ personId: 'p0', cardId: 'p0-0', key: 'x', kind: 'blank' }] }, studyDayKey(morning));
  assert.deepEqual([todayLog.log.day, todayLog.log.asked.length, todayLog.goal], ['2026-11-13', 0, goal], 'at 05:30 the day’s log and target start fresh');
  const freshPlan = sessionLib.planToday({ deck, schedule: practice.schedule, now: morning, goal, completed: activity.cardsOn(practice.sessions, studyDayKey(morning)), asked: [], random: dayRandom });
  assert.equal(freshPlan.length, goal, 'and the whole day’s session is ready');
  day(local(2026, 11, 13, 9, 0), 'part', 2);
  const nextMorning = local(2026, 11, 14, 6, 0);
  assert.equal(activity.cardsOn(practice.sessions, studyDayKey(nextMorning)), 0, 'an unfinished day doesn’t carry over: the next starts fresh');
  const completion = activity.dailyCompletion(practice.sessions, goal, nextMorning, 3);
  assert.deepEqual(completion.map((one) => [one.key, one.percent]), [['2026-11-12', 100], ['2026-11-13', Math.round((100 * 2) / goal)], ['2026-11-14', 0]], 'and the day before stays recorded as not completed');
  assert.deepEqual(completion.map(activity.levelFor), ['met', 'partial', 'none']);

  // A round in progress at 05:30 finishes on its own day, and leaves the new day alone
  practice = localLib.startSession(practice, 'dawn', local(2026, 11, 15, 5, 20), goal, { studyDay: studyDayKey(local(2026, 11, 15, 5, 20)), extraPractice: false });
  practice = localLib.finishCard(practice, 'dawn', deck[0].id, clean, local(2026, 11, 15, 5, 40)).state;
  assert.equal(activity.cardsOn(practice.sessions, '2026-11-14'), 1, 'a card finished at 05:40 in a round begun at 05:20 counts toward the day before');
  assert.equal(activity.cardsOn(practice.sessions, '2026-11-15'), 0, 'not the new day');
  const newDayLog = { day: '2026-11-15', asked: [{ personId: 'p1', cardId: 'p1-0', key: 'y', kind: 'blank' }] };
  assert.equal(sessionLib.logAsked(newDayLog, '2026-11-14', { personId: 'p0', cardId: 'p0-0', key: 'z', kind: 'blank' }), newDayLog, 'its questions never wipe the new day’s log');
  assert.equal(sessionLib.logAsked({ day: '2026-11-14', asked: [] }, '2026-11-14', { personId: 'p0', cardId: 'p0-0', key: 'z', kind: 'blank' }).asked.length, 1, 'and still log on their own day');

  // Practice is never blocked: after the day's session, more is always offered, at any hour
  for (const at of [local(2026, 11, 13, 2, 0), local(2026, 11, 13, 5, 31), local(2026, 11, 13, 23, 59)]) {
    const plan = { deck, schedule: practice.schedule, now: at, asked: [], random: dayRandom };
    assert.ok(sessionLib.planMore(plan).length > 0, `${at.toTimeString().slice(0, 5)}: a mix is ready after the day is done`);
    assert.ok(sessionLib.planPerson('p1', plan).length > 0, `${at.toTimeString().slice(0, 5)}: and one person’s cards`);
  }
  const homeCode = inRepo('src/app/index.tsx');
  assert.ok(/met \? \(\s*<PracticeMore/.test(homeCode), 'the home always shows Keep practicing once the day is done');
  assert.ok(/label="Keep practicing" primary large/.test(inRepo('src/components/practice-more.tsx')), 'as its one main button');
  assert.equal(sessionLib.AFTER_THE_DAY.line, 'You can keep practicing, or come back in the morning.');
  const calm = `${sessionLib.AFTER_THE_DAY.title} ${sessionLib.AFTER_THE_DAY.line}`;
  assert.ok(!/can.?t|cannot|not allowed|closed|locked|wait|until|\d|tomorrow|limit|score|streak|wrong/i.test(calm), 'calm, optional words: never a refusal, a countdown or a score');
  const personFacing = ['src/app/index.tsx', 'src/app/practice.tsx', 'src/components/practice-screen.tsx', 'src/components/practice-more.tsx', 'src/components/reminders.tsx', 'src/lib/reminders.ts'].map(inRepo).join('\n');
  assert.ok(!/All done today|come back (at|later)|no more practice|until 5|5:30|05:30/i.test(personFacing.replace(/\/\/.*|\/\*[\s\S]*?\*\//g, '')), 'no person-facing words say practice is over or when it opens');
  assert.ok(!/studyDay\s*[<>]=?|blocked|refuse/.test(inRepo('src/app/practice.tsx').replace(/\/\/.*/g, '')), 'the practice route never compares days to refuse a round');

  // Gaps count in study days, not hours
  const after = (at, step) => nextSchedule({ step, dueAt: at.toISOString() }, clean, at).dueAt;
  assert.equal(after(local(2026, 11, 12, 23, 0), 1), local(2026, 11, 13, 5, 30).toISOString(), '1 day from 11 PM: due at 05:30');
  assert.equal(after(local(2026, 11, 13, 2, 0), 1), local(2026, 11, 13, 5, 30).toISOString(), '1 day from 02:00 (study day Nov 12): due at 05:30 that morning');
  assert.equal(after(local(2026, 11, 13, 6, 0), 1), local(2026, 11, 14, 5, 30).toISOString(), '1 day from 06:00: the next morning');
  assert.equal(after(local(2026, 11, 13, 2, 0), 2), local(2026, 11, 15, 5, 30).toISOString(), '3 days from 02:00 Nov 13: study day Nov 15');
  assert.equal(after(local(2026, 11, 13, 20, 0), 3), local(2026, 11, 20, 5, 30).toISOString(), '7 days');
  assert.equal(after(local(2026, 11, 13, 20, 0), 4), local(2026, 11, 27, 5, 30).toISOString(), '14 days');
  assert.equal(after(local(2026, 3, 7, 12, 0), 1), '2026-03-08T09:30:00.000Z', 'across spring forward: 05:30 EDT');
  assert.equal(after(local(2026, 10, 31, 12, 0), 1), '2026-11-01T10:30:00.000Z', 'across fall back: 05:30 EST');

  // Insights group by study day; the score keeps its calculation; extra practice is labelled and leaves the standard alone
  const card = (i) => ({ id: `c${i}`, personId: `p${i % 3}`, phrasing: { id: 'who', kind: 'who' }, choices: ['a', 'b', 'c'] });
  const record = (i, at, { firstTry = true, day, extraPractice = false } = {}) => {
    const shown = at.getTime();
    const picks = firstTry ? [{ at: shown + 3000, right: true }] : [{ at: shown + 2000, right: false }, { at: shown + 4000, right: true }];
    return attemptsLib.attemptOf(card(i), { shownAt: shown, selections: picks, away: [], leftAt: shown + 6000, hints: firstTry ? [] : ['letter'] }, { id: `r${i}-${shown}`, sessionId: 's', goal: 12, source: 'template', studyDay: day, extraPractice });
  };
  const evening = Array.from({ length: 8 }, (_, i) => record(i, local(2026, 11, 12, 22, i)));
  const lateNight = Array.from({ length: 4 }, (_, i) => record(8 + i, local(2026, 11, 13, 2, i)));
  const oldStyle = lateNight.map(({ studyDay: _day, ...rest }) => rest);
  assert.ok(evening.every((one) => one.studyDay === undefined), 'records made with no day given have none (older records)');
  assert.deepEqual([...insightsLib.byDay([...evening, ...oldStyle]).keys()], ['2026-11-12'], 'older records before 05:30 fall back to the day before');
  const extra = Array.from({ length: 3 }, (_, i) => record(20 + i, local(2026, 11, 13, 3, i), { firstTry: false, day: '2026-11-12', extraPractice: true }));
  const crossing = record(30, local(2026, 11, 13, 5, 40), { day: '2026-11-12' });
  const grouped = insightsLib.byDay([...evening, ...oldStyle, ...extra, crossing]);
  assert.deepEqual([...grouped.keys()], ['2026-11-12'], 'a record made at 05:40 in a round begun before 05:30 stays on that day');
  const nov12 = insightsLib.dayInsight('2026-11-12', grouped.get('2026-11-12'));
  const allOf = [...evening, ...oldStyle, ...extra, crossing];
  assert.equal(nov12.score, insightsLib.memoryScore(insightsLib.resolutionsOf(allOf)), 'the score: the same calculation, over all of the day’s records');
  assert.equal(nov12.cards, 16, 'extra practice counts in the day’s cards');
  assert.deepEqual(nov12.extraPractice, { cards: 3, activeMs: 3 * 6000 }, 'and is shown as extra practice');
  assert.equal(nov12.standard.activeMs, 13 * 6000, 'the standard reads the day’s own session only');
  assert.equal(nov12.standard.status, insightsLib.againstStandard(13 * 6000, 12, 13).status, 'so extra practice can’t change whether the day was finished');
  assert.equal(insightsLib.extraPracticeText(nov12.extraPractice), '3 cards · 1 min');
  assert.ok(/label="Extra practice"/.test(inRepo('src/components/day-sheet.tsx')), 'a day’s sheet labels it');
  const view = insightsLib.insightsFor(allOf, { people: [] }, false, false, '2026-11-13');
  assert.ok(view.days.has('2026-11-12') && !view.days.has('2026-11-13') && view.fortnight.at(-1).key === '2026-11-13', 'the calendar and charts: by study day, today included');

  // Records keep their day through upload and back; older rows fall back to their time
  const login = { personUserId: '00000000-0000-4000-8000-000000000001', caregiverId: '00000000-0000-4000-8000-000000000002' };
  const row = recordsLib.toRow(crossing, login);
  assert.deepEqual([row.study_day, row.extra_practice], ['2026-11-12', false]);
  assert.deepEqual([recordsLib.toRow(extra[0], login).study_day, recordsLib.toRow(extra[0], login).extra_practice], ['2026-11-12', true]);
  assert.deepEqual(recordsLib.fromRow({ ...row, uploaded_at: 'x' }), crossing, 'read back exactly as made');
  const olderRow = recordsLib.fromRow({ ...recordsLib.toRow(oldStyle[0], login), study_day: null, extra_practice: false });
  assert.equal(insightsLib.recordDay(olderRow), '2026-11-12', 'a row from before study days were kept: its day from its time');
  // Offline for several days, then online: nothing duplicated, no day lost
  const offline = [0, 1, 2].flatMap((d) => Array.from({ length: 3 }, (_, i) => record(40 + d * 3 + i, local(2026, 11, 16 + d, 20, i), { day: `2026-11-${16 + d}` })));
  const sent = offline.map((one) => recordsLib.fromRow({ ...recordsLib.toRow(one, login), uploaded_at: 'x' }));
  const twice = recordsLib.mergeRecords(sent, sent.slice(0, 4));
  assert.equal(twice.length, offline.length, 'a resend after a lost reply is one record');
  assert.deepEqual([...insightsLib.byDay(twice).keys()], ['2026-11-16', '2026-11-17', '2026-11-18'], 'each day once, as it was practiced');

  // Two paired phones: completion follows study_day, never a 24-hour window
  const phoneA = { id: 'a', startedAt: '2026-11-14T01:00:00Z', completedAt: null, cardsCompleted: goal, dailyGoal: goal, studyDay: '2026-11-13' };
  const phoneATokyo = { id: 't', startedAt: '2026-11-13T22:00:00Z', completedAt: null, cardsCompleted: 5, dailyGoal: goal, studyDay: '2026-11-14' };
  assert.equal(activity.cardsOn([phoneA, phoneATokyo], '2026-11-13'), goal, 'phone B sees phone A’s day as finished by its key');
  assert.equal(activity.cardsOn([phoneA, phoneATokyo], '2026-11-14'), 5, 'and a phone in another time zone counts toward its own local day');
  assert.equal(dayOf({ studyDay: null }, '2026-11-13T07:00:00Z'), '2026-11-12', 'an older session (02:00 EST) falls back to the day before');
  const sync = inRepo('src/data/practice-store.ts');
  assert.ok(/from\('sessions'\)\.select\('\*'\)/.test(sync) && !/\.eq\('person_user_id', id\)/.test(sync.slice(sync.indexOf("from('sessions')"), sync.indexOf("from('sessions')") + 200)), 'the person’s phone reads the family’s sessions');
  assert.ok(/noSuchColumn\(error\.code\)/.test(sync), 'and a session isn’t lost before the schema is rerun');
  const schemaSql = inRepo('supabase/schema.sql');
  assert.ok(/alter table public\.sessions add column if not exists study_day date;/.test(schemaSql) && /alter table public\.attempt_records add column if not exists study_day date;/.test(schemaSql) && /extra_practice boolean not null default false/.test(schemaSql), 'the schema keeps each day, and can be rerun');
  assert.ok(/"sessions: person reads family" on public\.sessions for select/.test(schemaSql), 'and lets a person’s login read, never write, the family’s sessions');

  // Nothing else works out "today": every day decision goes through studyDayKey
  const dayCode = walkFiles('src').filter((path) => /\.(ts|tsx)$/.test(path) && path !== 'src/lib/study-day.ts');
  for (const path of dayCode) {
    const code = inRepo(path);
    assert.ok(!/setHours\(0, 0, 0, 0\)|toDateString\(\)/.test(code), `${path}: no midnight of its own`);
    assert.ok(!/\bdayKey\(/.test(code.replace(/studyDayKey\(|calendarKey\(/g, '')), `${path}: no old dayKey`);
  }
  const calendarToday = dayCode.filter((path) => /calendarKey\((new Date\(\)|now)\)/.test(inRepo(path)));
  assert.deepEqual(calendarToday, ['src/lib/insights.ts'], 'calendar dates for "now" only in "Last updated today at …", a clock-time label');
  assert.ok(/studyDay !== undefined/.test(inRepo('src/app/_layout.tsx')), 'the app waits for this device’s study day before deciding anything');
  const clock = inRepo('src/data/study-clock.ts');
  assert.ok(/AppState\.addEventListener\('change'/.test(clock) && /nextStudyDayStart\(now\)/.test(clock) && /laterDay\(seen/.test(clock), 'the clock looks again on returning to the front and at the next 05:30, and only moves forward');
  assert.ok(/onNewStudyDay\(\(\) => \{[\s\S]{0,80}update\(withGoal\(practice\)\)/.test(sync) && /onNewStudyDay\(\(\) => refreshLocal\(\)\)/.test(inRepo('src/data/local-store.ts')), 'and both practice stores move into the new day without a reload');

  if (zoneBefore === undefined) delete process.env.TZ;
  else process.env.TZ = zoneBefore;
}

// ---------------------------------------------------------------------------------------
// No developer tools in the app (docs/SETTINGS-AUDIT.md): no in-app control may load sample data,
// reset, clear or wipe data, or expose a debug switch. Anything that deletes for good needs "delete" typed.
// ---------------------------------------------------------------------------------------
{
  const screens = walkFiles('src/app').concat(walkFiles('src/components')).filter((path) => /\.tsx?$/.test(path));
  for (const path of screens) {
    const code = inRepo(path);
    assert.ok(!/sample-activity|loadSample|clearSample|SampleActivity|setDemoInsights|DemoInsights|clearTestData|clearLocalTestData|ClearTestData/.test(code), `${path}: no sample-data loader or clearing action`);
    assert.ok(!/__DEV__|EXPO_PUBLIC_|Development only|debug/i.test(code.replace(/\/\/.*|\/\*[\s\S]*?\*\//g, '')), `${path}: no development-only or debug section`);
    for (const [, words] of code.matchAll(/\b(?:label|title|accessibilityLabel)=["{`']([^"}`']+)/g)) {
      assert.ok(!/\bwipe\b|\breset (all|everything|data|the app)|\bclear (test|sample|all|every|data)|load (sample|demo)|\bseed\b|developer|sample activity|demo data|test data/i.test(words), `${path}: "${words}" is not a developer control`);
    }
  }
  assert.ok(!existsSync(new URL('../src/data/sample-activity.ts', import.meta.url)), 'the server sample-data loader is gone');
  const appData = inRepo('src/data/app-data.ts');
  assert.ok(!/setDemoInsights|clearTestData|sampleActivity/.test(appData), 'and nothing a screen could reach loads or clears made-up data');
  assert.ok(/__DEV__ && process\.env\.EXPO_PUBLIC_CLEAR_TEST_DATA === '1'/.test(inRepo('src/data/local-store.ts')), 'clearing test data is a development launch flag only, off unless set');
  // Destructive actions: named, deliberate, last
  const ui = inRepo('src/components/caregiver-ui.tsx');
  assert.ok(/export const CONFIRM_WORD = 'delete'/.test(ui) && /disabled=\{!ready \|\| busy\}/.test(ui), 'the typed confirmation: the button works only once "delete" is typed');
  const settings = inRepo('src/components/settings-page.tsx');
  assert.ok(/<TypeToConfirm testID="delete-confirm"/.test(settings) && /from the server and from every phone/.test(settings), 'Delete account names what goes and where, and needs "delete" typed');
  const order = ['title="Account"', 'title="The person’s phone"', 'title="Practice"', 'title="Privacy and data"', 'title="About"', '<DeleteAccountSetting'].map((mark) => settings.indexOf(mark));
  assert.ok(order.every((at, i) => at > 0 && (i === 0 || at > order[i - 1])), 'Settings in order: Account, The person’s phone (Their login), Practice, Privacy and data, About, then Delete account apart');
  assert.ok(/Your people, stories and practice stay saved in your account/.test(settings), 'Sign out says the family stays saved');
  const archived = inRepo('src/components/archived-people.tsx');
  assert.ok(/<TypeToConfirm/.test(archived) && !/await confirm\(/.test(archived), 'Delete permanently needs "delete" typed, not just OK');
  const forget = inRepo('src/data/forget.ts');
  assert.ok(!/from\('|\.delete\(|deleteFamily/.test(forget), 'signing out deletes nothing on the server');

  // Export my data (2026-11-13): a data file of everything, a report, and photos only when asked for.
  // What the files hold, paging, offline, the person's login and the report's figures: scripts/check-export.mjs.
  const exporter = inRepo('src/components/export-data.tsx');
  assert.ok(/import \{ ExportPanel, ExportSetting \} from '@\/components\/export-data'/.test(settings) && /title="Privacy and data">[\s\S]*<ExportSetting \/>[\s\S]*title="About"/.test(settings), 'Export my data sits under Privacy and data');
  assert.ok(/label="Export my data"/.test(exporter) && /label="Data file \(everything\)"/.test(exporter) && /label="Report \(PDF\)"/.test(exporter), 'with its two clear choices');
  assert.ok(/const \[photos, setPhotos\] = useState\(false\)/.test(exporter) && /\{photos \? \([\s\S]*label="Photos \(zip\)"/.test(exporter), 'photos only once "Include photos" is ticked, off by default');
  assert.ok(/testID="export-cancel"/.test(exporter) && /testID="export-retry"/.test(exporter) && /label="Use this phone’s copy"/.test(exporter) && /phase\.problem === 'offline'/.test(exporter), 'progress with Cancel, Try again, and this phone’s copy only when offline');
  assert.ok(/label="Export my data first" onPress=\{\(\) => setExporting\(true\)\}/.test(settings) && /exporting \? \([\s\S]*<ExportPanel \/>/.test(settings), 'Delete account runs the same export in its own sheet, without opening a sheet on a sheet');
  const exportFiles = ['src/components/export-data.tsx', 'src/lib/export.ts', 'src/lib/insight-report.ts', 'src/data/export-store.ts', 'src/data/export-data.ts'];
  for (const path of exportFiles) {
    const words = inRepo(path).replace(/\/\/.*|\/\*[\s\S]*?\*\//g, '');
    assert.ok(!/\b(wrong|failed|failure|declin\w*|diagnos\w*|disease|progression|severity|accuracy|missed)\b/i.test(words.replace(/warnKind\('[^']*'/g, '')), `${path}: none of the banned words`);
    assert.ok(!/console\./.test(words), `${path}: logs only through warnKind`);
  }
  assert.ok(walkFiles('src').filter((path) => /from '@\/data\/export-data'/.test(inRepo(path))).join() === 'src/components/export-data.tsx', 'only the caregiver’s export panel reaches the export’s choices');
  assert.ok(walkFiles('src').filter((path) => /from '@\/components\/export-data'/.test(inRepo(path))).join() === 'src/components/settings-page.tsx', 'and only Settings shows it');
  const reader = inRepo('src/data/export-store.ts');
  assert.ok((reader.match(/const family = caregiverId\(\);\n  if \(!family\) return/g) ?? []).length === 3 && /profile\.role === 'caregiver' \? profile\.id : undefined/.test(reader), 'every server read checks it is the caregiver’s login first');
  assert.ok(/clearExports/.test(forget) && /finally \{\n    if \(file\.exists\) file\.delete\(\);/.test(inRepo('src/lib/save-file.ts')), 'files go from the temporary folder once shared, and at sign-out');
  const { familyExport, exportText, exportFileName, EXPORT_FORMAT } = await import('@/lib/export');
  const tiny = familyExport({ origin: { from: 'server' }, people: [{ id: 'a', name: 'June', hints: {}, notApplicable: [], includeInPractice: true, revealOk: true }], cards: [], sessionLength: 'standard', revealCards: 'sometimes', sessions: [], records: [], schedule: [], phones: [] }, new Date('2026-11-12T20:00:00Z'), '1.0.0');
  assert.equal(tiny.about.format, EXPORT_FORMAT);
  assert.deepEqual(JSON.parse(exportText(tiny)), JSON.parse(JSON.stringify(tiny)), 'the file is valid JSON');
  assert.equal(exportFileName('data', new Date('2026-11-12T20:00:00Z')), 'evermore-data-2026-11-12.json');
}

// Why something couldn't load, told apart (not "check the internet" for everything)
{
  const { problemOf, INSIGHTS_PROBLEM, DASHBOARD_PROBLEM } = await import('@/lib/load-problem');
  assert.equal(problemOf({ message: 'TypeError: Network request failed', code: '' }), 'offline', 'no connection');
  assert.equal(problemOf(new TypeError('Failed to fetch')), 'offline', 'the web’s way of saying it');
  assert.equal(problemOf({}), 'offline', 'no answer at all');
  assert.equal(problemOf({ code: 'PGRST301', message: 'JWT expired' }), 'signed-out', 'the sign-in ended');
  assert.equal(problemOf({ message: 'Invalid Refresh Token: Refresh Token Not Found' }), 'signed-out');
  assert.equal(problemOf({ code: '42703', message: 'column attempt_records.study_day does not exist' }), 'server-update', 'a server whose schema is behind the app');
  assert.equal(problemOf({ code: 'PGRST205', message: "Could not find the table 'public.attempt_records' in the schema cache" }), 'server-update');
  assert.equal(problemOf({ code: '57014', message: 'canceling statement due to statement timeout' }), 'offline', 'a timeout reads as the connection');
  assert.equal(problemOf({ code: 'XX000', message: 'internal error' }), 'server', 'anything else: the server, not the internet');
  for (const words of [...Object.values(INSIGHTS_PROBLEM), ...Object.values(DASHBOARD_PROBLEM)]) {
    assert.ok(!/error|fail|wrong|PGRST|\d{3}|schema|column|table|JWT|token/i.test(words), `"${words}": calm, with nothing about the server's insides`);
  }
  assert.ok(/INSIGHTS_PROBLEM\[sync\.problem \?\? 'offline'\]/.test(inRepo('src/components/insights.tsx')) && /testID="insights-retry"/.test(inRepo('src/components/insights.tsx')), 'Insights say the right one, with Try again');
  assert.ok(/DASHBOARD_PROBLEM\[problem \?\? 'offline'\]/.test(inRepo('src/app/caregiver/index.tsx')), 'and so does the dashboard');
  assert.ok(/select\('\*'\)/.test(inRepo('src/data/insights-store.ts')), 'Insights read every column, so a server not yet updated still answers');
}

// Logs never carry personal data: every failure goes through warnKind, which prints only its kind
{
  for (const path of walkFiles('src').filter((one) => /\.(ts|tsx)$/.test(one) && one !== 'src/lib/log.ts')) {
    for (const [line] of inRepo(path).matchAll(/console\.(?:log|warn|error|info|debug)\([^\n]*/g)) {
      assert.ok(/^console\.warn\((['`])[^'`$]*\1\)\);?\s*$|^console\.warn\('[^']*'\)\);?/.test(line), `${path}: "${line.slice(0, 80)}" logs only fixed words`);
    }
  }
  const { warnKind } = await import('@/lib/log');
  const said = [];
  const original = console.warn;
  console.warn = (...args) => said.push(args.join(' '));
  warnKind('Could not save the step', { code: '23514', message: 'new row violates check', details: 'Failing row contains (June, loves golf)' });
  warnKind('Could not save the draft', new TypeError('Network request failed: June'));
  warnKind('Could not save on this phone');
  console.warn = original;
  assert.deepEqual(said, ['Could not save the step (23514)', 'Could not save the draft (TypeError)', 'Could not save on this phone'], 'only what failed, and its kind: never the row, a name or a message');
}

// Photos are kept no bigger than they need to be
{
  const { shrinkTo, PHOTO_LONG_EDGE } = await import('@/lib/photo-size');
  assert.equal(PHOTO_LONG_EDGE, 1280);
  assert.deepEqual(shrinkTo(4032, 3024), { width: 1280 }, 'a landscape camera photo: its width');
  assert.deepEqual(shrinkTo(3024, 4032), { height: 1280 }, 'a portrait one: its height');
  assert.equal(shrinkTo(1200, 900), undefined, 'a small photo stays as it is');
  assert.equal(shrinkTo(0, 0), undefined, 'and one with no size is left alone');
  const form = inRepo('src/components/questionnaire.tsx');
  assert.equal(form.match(/await shrinkPhoto\(result\.assets\[0\]\)/g)?.length, 2, 'both photo pickers shrink what they pick');
}

// Never a blank dashboard tab: while its data is on the way, one calm line
{
  const dashboard = inRepo('src/app/caregiver/index.tsx');
  assert.ok(/testID="dashboard-loading"/.test(dashboard) && /Getting your family’s practice…/.test(dashboard), 'a calm line while a tab’s data is on the way');
  assert.ok(/testID="dashboard-retry"/.test(dashboard), 'and Try again when it couldn’t load');
}

console.log('All logic checks passed');
