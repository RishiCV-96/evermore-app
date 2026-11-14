// The person's daily reminder (src/lib/reminders.ts), in plain Node with a fake clock and a fake
// device standing in for the phone's notifications:
//   node scripts/check-reminders.mjs
// At most one a study day; none today once the session is complete; rebuilt at 05:30; time zones,
// the clock moving and daylight saving; never two in a study day; cancelled when turned off or on
// sign-out; a refused permission or a failing system call handled silently; the one calm message.
// The clock is New York's unless a check moves it. The data store and sign-out are also checked in
// scripts/check-auth.mjs, against the real sign-out.
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

process.env.TZ = 'America/New_York';

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
const inRepo = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

const R = await import('@/lib/reminders');
const schedule = await import('@/config/schedule');
const { studyDayKey, laterDay } = await import('@/lib/study-day');

let checks = 0;
async function check(name, run) {
  await run();
  checks += 1;
  console.log(`ok ${checks} ${name}`);
}

/**
 * A phone's notifications, faked: what is waiting, what was shown (and is in the list), and every
 * delivery. `fire(until)` delivers everything due by then, as the system would while the app sleeps.
 */
function device({ permission = 'granted', failing = [] } = {}) {
  const scheduled = new Map();
  const presented = new Set();
  const delivered = [];
  const calls = [];
  const fail = (what) => {
    if (failing.includes(what)) throw Object.assign(new Error(`${what} failed for June`), { code: 'E_NOTIFICATIONS' });
  };
  const notifier = {
    async permission() {
      fail('permission');
      return phone.permission;
    },
    async request() {
      if (phone.permission === 'undetermined') phone.permission = phone.answer ?? 'granted';
      return phone.permission;
    },
    async scheduledIds() {
      fail('list');
      return [...scheduled.keys()];
    },
    async schedule(id, at, body) {
      fail('schedule');
      calls.push({ id, at, body });
      scheduled.set(id, { at, body });
    },
    async cancel(id) {
      scheduled.delete(id);
    },
    async presentedIds() {
      return [...presented];
    },
    async dismiss(id) {
      presented.delete(id);
    },
  };
  const phone = {
    permission,
    answer: undefined,
    step: 0,
    notifier,
    scheduled,
    presented,
    delivered,
    calls,
    fire(until) {
      for (const [id, one] of [...scheduled]) {
        if (one.at.getTime() > until.getTime()) continue;
        scheduled.delete(id);
        // A notification the system isn't allowed to show is never shown.
        if (phone.permission !== 'granted') continue;
        presented.add(id);
        // The study day it lands on, on the phone's clock and in its time zone as it fires.
        delivered.push({ id, at: one.at, body: one.body, day: studyDayKey(one.at), step: phone.step });
      }
    },
    days: () => [...scheduled.keys()].map((id) => id.slice(R.REMINDER_ID.length)).sort(),
  };
  return phone;
}

/** The app, rebuilding on a phone: its saved settings carried from one rebuild to the next, and the forward-only day. */
function app(phone, settings = { ...R.DEFAULT_REMINDERS, on: true, asked: true }) {
  const it = {
    settings,
    seen: undefined,
    async rebuild(now, { done = false, ready = true } = {}) {
      it.seen = laterDay(it.seen, studyDayKey(now));
      const result = await R.rebuildReminders(phone.notifier, it.settings, { now, today: it.seen, sessionDone: done, practiceReady: ready });
      it.settings = result.settings;
      return result;
    },
  };
  return it;
}

const local = (y, m, d, h, min = 0) => new Date(y, m - 1, d, h, min);
const perDay = (delivered) => {
  const counts = {};
  for (const one of delivered) {
    const day = one.day;
    counts[day] = (counts[day] ?? 0) + 1;
  }
  return counts;
};

// ---------------------------------------------------------------------------------------------

await check('the default time is 9:00, after the 05:30 start, and every choosable time is in its own study day', async () => {
  assert.equal(schedule.REMINDER_HOUR, 9);
  assert.equal(schedule.REMINDER_MINUTE, 0);
  const start = schedule.DAY_START_HOUR * 60 + schedule.DAY_START_MINUTE;
  assert.equal(R.DEFAULT_REMINDER_TIME, 9 * 60);
  assert.ok(schedule.REMINDER_EARLIEST > start, 'the earliest choice is after the study day starts');
  assert.ok(schedule.REMINDER_LATEST < 24 * 60, 'and the latest before midnight');
  assert.ok(R.DEFAULT_REMINDER_TIME >= schedule.REMINDER_EARLIEST && R.DEFAULT_REMINDER_TIME <= schedule.REMINDER_LATEST);
  for (let time = schedule.REMINDER_EARLIEST; time <= schedule.REMINDER_LATEST; time += schedule.REMINDER_STEP_MINUTES) {
    assert.equal(studyDayKey(R.reminderAt('2026-11-13', time)), '2026-11-13', `${R.timeLabel(time)} belongs to its own date's study day`);
  }
  assert.ok(inRepo('src/config/schedule.ts').includes('a clinician should confirm the default'), 'the constant says a clinician should confirm it');
  assert.equal((inRepo('src/config/schedule.ts').match(/REMINDER_HOUR = /g) ?? []).length, 1, 'defined once');
  assert.ok(!/REMINDER_HOUR|REMINDER_MINUTE/.test(inRepo('src/components/reminders.tsx') + inRepo('src/data/reminders.ts')), 'and read from one place');
});

await check('the one message is generic and calm', async () => {
  assert.equal(R.REMINDER_TEXT, 'Your practice is ready whenever you are.');
  assert.ok(!/\d/.test(R.REMINDER_TEXT), 'no counts or times');
  assert.ok(!/!|missed|streak|score|hurry|now|today|don’t|don't|forget|late|again|\{|\[/i.test(R.REMINDER_TEXT), 'no urgency, streaks, scores or blanks to fill');
  assert.ok(!/\p{Extended_Pictographic}/u.test(R.REMINDER_TEXT), 'no emoji');
  // The content sent to the system is that message and nothing else: no title, no data, no name.
  const notifier = inRepo('src/lib/notifier.ts');
  assert.ok(/content: \{ body, sound: true \}/.test(notifier), 'only the body (and the system sound)');
  assert.ok(!/title:|data:|subtitle:|attachments/.test(notifier.replace(/\/\/.*$/gm, '')), 'no title, data or picture');
  const phone = device();
  await app(phone).rebuild(local(2026, 11, 13, 8));
  assert.ok(phone.calls.length > 0 && phone.calls.every((call) => call.body === R.REMINDER_TEXT), 'every reminder scheduled says exactly that');
  // What reminders read: settings and the clock, never the family, a fact, a photo or an insight.
  for (const path of ['src/lib/reminders.ts', 'src/lib/notifier.ts', 'src/lib/notifier.web.ts', 'src/data/reminders.ts']) {
    assert.ok(!/family|facts|photo|insight|supabase|fetch\(/i.test(inRepo(path).replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '')), `${path} reads nothing personal and sends nothing`);
  }
});

await check('three days ahead, one a day, at 9:00 local', async () => {
  const plan = R.planReminders({ now: local(2026, 11, 13, 8), today: '2026-11-13', settings: { ...R.DEFAULT_REMINDERS, on: true }, sessionDone: false, practiceReady: true });
  assert.deepEqual(plan.map((one) => one.day), ['2026-11-13', '2026-11-14', '2026-11-15']);
  assert.equal(plan.length, schedule.REMINDER_DAYS_AHEAD);
  for (const one of plan) {
    assert.equal(one.at.getHours(), 9);
    assert.equal(one.at.getMinutes(), 0);
    assert.equal(studyDayKey(one.at), one.day);
  }
});

await check('skips today once the session is complete, and schedules tomorrow', async () => {
  const phone = device();
  const it = app(phone);
  await it.rebuild(local(2026, 11, 13, 7));
  assert.deepEqual(phone.days(), ['2026-11-13', '2026-11-14', '2026-11-15']);
  // The session is completed at 07:40: today's reminder goes before it can fire.
  await it.rebuild(local(2026, 11, 13, 7, 40), { done: true });
  assert.deepEqual(phone.days(), ['2026-11-14', '2026-11-15', '2026-11-16'], 'today cancelled, tomorrow on');
  phone.fire(local(2026, 11, 13, 23, 59));
  assert.equal(phone.delivered.length, 0, 'nothing fires after practice is done');
  // Done before the app ever scheduled anything: today is never planned.
  const fresh = device();
  await app(fresh).rebuild(local(2026, 11, 13, 6), { done: true });
  assert.deepEqual(fresh.days(), ['2026-11-14', '2026-11-15', '2026-11-16']);
});

await check('a time already passed today is skipped, not sent late', async () => {
  const phone = device();
  await app(phone).rebuild(local(2026, 11, 13, 10));
  assert.deepEqual(phone.days(), ['2026-11-14', '2026-11-15', '2026-11-16']);
});

await check('reschedules at the 05:30 rollover', async () => {
  const phone = device();
  const it = app(phone);
  await it.rebuild(local(2026, 11, 13, 23), { done: true });
  assert.deepEqual(phone.days(), ['2026-11-14', '2026-11-15', '2026-11-16']);
  await it.rebuild(local(2026, 11, 14, 2), { done: true });
  assert.equal(it.seen, '2026-11-13', 'at 02:00 it is still study day Nov 13, and done');
  assert.deepEqual(phone.days(), ['2026-11-14', '2026-11-15', '2026-11-16'], 'the next morning’s reminder stays');
  // 05:30: a new study day, not yet practiced.
  await it.rebuild(local(2026, 11, 14, 5, 30), { done: false });
  assert.equal(it.seen, '2026-11-14');
  assert.deepEqual(phone.days(), ['2026-11-14', '2026-11-15', '2026-11-16']);
  phone.fire(local(2026, 11, 14, 9));
  assert.deepEqual(phone.delivered.map((one) => one.id), ['evermore.reminder.2026-11-14']);
  // Practiced at 10:00; the rebuild after it keeps the set full, starting tomorrow.
  await it.rebuild(local(2026, 11, 14, 10), { done: true });
  assert.deepEqual(phone.days(), ['2026-11-15', '2026-11-16', '2026-11-17']);
});

await check('never two in one study day: changing the time after it fired, or rebuilding again and again', async () => {
  const phone = device();
  const it = app(phone);
  await it.rebuild(local(2026, 11, 13, 8));
  phone.fire(local(2026, 11, 13, 9, 30));
  assert.equal(phone.delivered.length, 1);
  it.settings = { ...it.settings, time: R.stepTime(it.settings.time, 2) }; // 10:00
  await it.rebuild(local(2026, 11, 13, 9, 31));
  assert.ok(!phone.days().includes('2026-11-13'), 'today has had its reminder');
  assert.equal(it.settings.remindedThrough, '2026-11-13');
  for (let minute = 0; minute < 60; minute += 5) await it.rebuild(local(2026, 11, 13, 11, minute));
  phone.fire(local(2026, 11, 13, 23, 59));
  assert.deepEqual(perDay(phone.delivered), { '2026-11-13': 1 });
  // Moved earlier before it fired, past now: today is simply skipped.
  const other = device();
  const two = app(other);
  await two.rebuild(local(2026, 11, 13, 8));
  two.settings = { ...two.settings, time: R.stepTime(two.settings.time, -3) }; // 7:30
  await two.rebuild(local(2026, 11, 13, 8, 30));
  other.fire(local(2026, 11, 13, 23, 59));
  assert.equal(other.delivered.length, 0, 'not sent late, and the 9:00 one was cancelled');
  // Off and on again the same day, after it fired: still one.
  it.settings = { ...it.settings, on: false };
  await it.rebuild(local(2026, 11, 13, 12));
  it.settings = { ...it.settings, on: true, time: R.stepTime(R.DEFAULT_REMINDER_TIME, 12) }; // 15:00
  await it.rebuild(local(2026, 11, 13, 12, 5));
  assert.ok(!phone.days().includes('2026-11-13'));
});

await check('a time zone change: travel west after it fired, and east before it fired', async () => {
  try {
    const phone = device();
    const it = app(phone);
    await it.rebuild(new Date('2026-11-13T13:00:00Z')); // 08:00 in New York
    phone.fire(new Date('2026-11-13T14:30:00Z')); // fired at 09:00 New York
    process.env.TZ = 'America/Los_Angeles';
    await it.rebuild(new Date('2026-11-13T15:00:00Z')); // 07:00 in Los Angeles, the same study day
    assert.ok(!phone.days().includes('2026-11-13'), 'no second reminder at 09:00 Los Angeles time');
    assert.equal(phone.scheduled.get('evermore.reminder.2026-11-14').at.toISOString(), '2026-11-14T17:00:00.000Z', 'tomorrow at 09:00 in the new zone');
    phone.fire(new Date('2026-11-16T00:00:00Z'));
    assert.deepEqual(perDay(phone.delivered), { '2026-11-13': 1, '2026-11-14': 1, '2026-11-15': 1 });

    process.env.TZ = 'America/New_York';
    const east = device();
    const trip = app(east);
    await trip.rebuild(new Date('2026-11-13T12:00:00Z')); // 07:00 in New York: 09:00 is 14:00Z
    process.env.TZ = 'Europe/London';
    await trip.rebuild(new Date('2026-11-13T13:00:00Z')); // 13:00 in London: 09:00 there has passed
    assert.ok(!east.days().includes('2026-11-13'), 'the old 09:00 is cancelled and today is not sent late');
    assert.equal(east.scheduled.get('evermore.reminder.2026-11-14').at.toISOString(), '2026-11-14T09:00:00.000Z');
    east.fire(new Date('2026-11-14T23:00:00Z'));
    assert.deepEqual(perDay(east.delivered), { '2026-11-14': 1 });
  } finally {
    process.env.TZ = 'America/New_York';
  }
});

await check('the clock set back, or forward then back, never hands out a study day twice', async () => {
  const phone = device();
  const it = app(phone);
  await it.rebuild(local(2026, 11, 13, 8));
  phone.fire(local(2026, 11, 13, 9, 30));
  // The clock set back a day: the forward-only day stays Nov 13, which has had its reminder.
  await it.rebuild(local(2026, 11, 12, 8));
  assert.equal(it.seen, '2026-11-13');
  assert.ok(!phone.days().includes('2026-11-12') && !phone.days().includes('2026-11-13'));
  // Forward to Nov 20, then back to Nov 14.
  await it.rebuild(local(2026, 11, 20, 8));
  await it.rebuild(local(2026, 11, 14, 8));
  assert.equal(it.seen, '2026-11-20');
  assert.ok(phone.days().every((day) => day >= '2026-11-20'), 'only days from the day reached');
});

await check('daylight saving: still 09:00 on the wall, one a study day, both ways', async () => {
  const spring = device();
  await app(spring).rebuild(local(2026, 3, 7, 6));
  const days = ['2026-03-07', '2026-03-08', '2026-03-09'];
  assert.deepEqual(spring.days(), days);
  const at = days.map((day) => spring.scheduled.get(`${R.REMINDER_ID}${day}`).at);
  assert.ok(at.every((one) => one.getHours() === 9 && one.getMinutes() === 0), '09:00 EST and EDT');
  assert.equal(at[1] - at[0], 23 * 3600_000, 'a 23-hour gap into summer time');
  const fall = device();
  await app(fall).rebuild(local(2026, 10, 31, 6));
  const back = ['2026-10-31', '2026-11-01', '2026-11-02'].map((day) => fall.scheduled.get(`${R.REMINDER_ID}${day}`).at);
  assert.ok(back.every((one) => one.getHours() === 9));
  assert.equal(back[1] - back[0], 25 * 3600_000, 'a 25-hour gap back to standard time');
  fall.fire(local(2026, 11, 3, 0));
  assert.deepEqual(perDay(fall.delivered), { '2026-10-31': 1, '2026-11-01': 1, '2026-11-02': 1 });
});

await check('turned off: everything cancelled, and anything still in the list cleared', async () => {
  const phone = device();
  const it = app(phone);
  await it.rebuild(local(2026, 11, 13, 8));
  phone.scheduled.set('someone-elses', { at: local(2026, 11, 20, 9), body: 'not ours' });
  it.settings = { ...it.settings, on: false };
  await it.rebuild(local(2026, 11, 13, 8, 5));
  assert.ok(phone.scheduled.has('someone-elses'), 'and nothing that isn’t ours is touched');
  assert.equal([...phone.scheduled.keys()].filter((id) => id.startsWith(R.REMINDER_ID)).length, 0);
  phone.fire(local(2026, 11, 30, 0));
  assert.equal(phone.delivered.filter((one) => one.id.startsWith(R.REMINDER_ID)).length, 0);
});

await check('cancel on sign-out (or a removed phone): nothing of ours waits or stays in the list', async () => {
  const phone = device();
  const it = app(phone);
  await it.rebuild(local(2026, 11, 13, 8));
  phone.fire(local(2026, 11, 13, 9, 5));
  assert.equal(phone.presented.size, 1);
  await R.cancelReminders(phone.notifier);
  assert.equal(phone.scheduled.size, 0);
  assert.equal(phone.presented.size, 0);
  phone.fire(local(2026, 12, 31, 0));
  assert.equal(phone.delivered.length, 1, 'nothing more ever fires');
  // Every way a phone signs out cancels them (src/data/forget.ts), and a launch signed out or as the caregiver does too.
  assert.ok(/forgetReminders\(\)/.test(inRepo('src/data/forget.ts')), 'sign-out cancels');
  assert.ok(/who\.role !== 'person'\) void forgetReminders\(\)/.test(inRepo('src/app/_layout.tsx')), 'opened signed out or as the caregiver, it keeps none');
});

await check('a reminder in the list is cleared once the day is done, or the day is past', async () => {
  const phone = device();
  const it = app(phone);
  await it.rebuild(local(2026, 11, 13, 8));
  phone.fire(local(2026, 11, 13, 9, 1));
  assert.deepEqual([...phone.presented], ['evermore.reminder.2026-11-13']);
  await it.rebuild(local(2026, 11, 13, 9, 30));
  assert.equal(phone.presented.size, 1, 'still there while today is not done');
  await it.rebuild(local(2026, 11, 13, 9, 45), { done: true });
  assert.equal(phone.presented.size, 0, 'gone once it is');
});

await check('permission denied, or revoked later in Settings: handled silently, and nothing waits', async () => {
  const said = [];
  const warn = console.warn;
  console.warn = (...args) => said.push(args.join(' '));
  try {
    const denied = device({ permission: 'denied' });
    const result = await app(denied).rebuild(local(2026, 11, 13, 8));
    assert.equal(result.permission, 'denied');
    assert.equal(denied.scheduled.size, 0);
    // Granted, then turned off in the phone's Settings: the next rebuild cancels what waits.
    const phone = device();
    const it = app(phone);
    await it.rebuild(local(2026, 11, 13, 8));
    assert.equal(phone.scheduled.size, 3);
    phone.permission = 'denied';
    assert.equal((await it.rebuild(local(2026, 11, 13, 8, 30))).permission, 'denied');
    assert.equal(phone.scheduled.size, 0);
    assert.equal(it.settings.on, true, 'the person’s choice is kept, for when it is allowed again');
    // Allowed again: the next return to the front schedules again.
    phone.permission = 'granted';
    await it.rebuild(local(2026, 11, 13, 8, 45));
    assert.deepEqual(phone.days(), ['2026-11-13', '2026-11-14', '2026-11-15']);
    // A system call that fails: no throw, and the log says only what failed and its kind.
    for (const failing of [['permission'], ['list'], ['schedule']]) {
      const broken = device({ failing });
      await app(broken).rebuild(local(2026, 11, 13, 8));
    }
    await R.cancelReminders(device({ failing: ['list'] }).notifier);
    assert.ok(said.length >= 4, 'each failure is noted');
    for (const line of said) {
      assert.ok(!line.includes('June') && !line.includes(R.REMINDER_TEXT) && !line.includes('failed for'), `only the kind of failure: ${line}`);
      assert.ok(/\(E_NOTIFICATIONS\)$/.test(line), line);
    }
  } finally {
    console.warn = warn;
  }
});

await check('nothing to practice: no reminders at all', async () => {
  const phone = device();
  const it = app(phone);
  await it.rebuild(local(2026, 11, 13, 8));
  await it.rebuild(local(2026, 11, 13, 8, 5), { ready: false });
  assert.equal(phone.scheduled.size, 0);
});

await check('saved settings are read defensively; the time steps stay in range; labels', async () => {
  assert.deepEqual(R.readSettings(null), R.DEFAULT_REMINDERS);
  assert.deepEqual(R.readSettings('garbage'), R.DEFAULT_REMINDERS);
  assert.deepEqual(R.readSettings({ on: 'yes', time: 99999, asked: 1, remindedThrough: 'soon', planned: [{ day: 'x', at: 'y' }] }), {
    on: false,
    time: schedule.REMINDER_LATEST,
    asked: false,
  });
  assert.equal(R.readSettings({ on: true, time: 60 }).time, schedule.REMINDER_EARLIEST, 'a time before the earliest comes up to it');
  assert.equal(R.stepTime(schedule.REMINDER_EARLIEST, -1), schedule.REMINDER_EARLIEST);
  assert.equal(R.stepTime(schedule.REMINDER_LATEST, 1), schedule.REMINDER_LATEST);
  assert.equal(R.canStep(schedule.REMINDER_EARLIEST, -1), false);
  assert.equal(R.canStep(R.DEFAULT_REMINDER_TIME, 1), true);
  assert.deepEqual([540, 1260, 720, 390, 360].map(R.timeLabel), ['9:00 AM', '9:00 PM', '12:00 PM', '6:30 AM', '6:00 AM']);
});

await check('a month of ordinary use, with the clock jumping about: never two in a study day, never after practice', async () => {
  let seed = 7;
  const random = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
  const phone = device();
  const it = app(phone);
  const doneDays = new Map();
  let now = local(2026, 11, 1, 7);
  for (let step = 0; step < 600; step++) {
    phone.step = step;
    const next = new Date(now.getTime() + Math.floor(random() * 5 * 3600_000));
    phone.fire(next);
    now = next;
    const roll = random();
    if (roll < 0.05) now = new Date(now.getTime() - Math.floor(random() * 36 * 3600_000)); // the clock set back
    if (roll > 0.97) process.env.TZ = ['America/New_York', 'America/Los_Angeles', 'Europe/London'][Math.floor(random() * 3)];
    const today = laterDay(it.seen, studyDayKey(now));
    if (random() < 0.15 && !doneDays.has(today)) doneDays.set(today, step);
    if (random() < 0.1) it.settings = { ...it.settings, time: R.stepTime(it.settings.time, Math.round(random() * 6 - 3)) };
    await it.rebuild(now, { done: doneDays.has(today) });
  }
  process.env.TZ = 'America/New_York';
  const counts = perDay(phone.delivered);
  assert.ok(Object.keys(counts).length > 10, `reminders were delivered (${Object.keys(counts).length} days)`);
  for (const one of phone.delivered) assert.ok(new Set(phone.delivered.filter((other) => other.id === one.id)).size === 1, `${one.id} delivered once`);
  for (const [day, count] of Object.entries(counts)) assert.equal(count, 1, `${day} had ${count}`);
  assert.ok(doneDays.size > 5, 'and some days were practiced');
  for (const one of phone.delivered) {
    const done = doneDays.get(one.id.slice(R.REMINDER_ID.length));
    assert.ok(done === undefined || one.step <= done, `${one.id} fired after that day's session was complete`);
  }
});

await check('the person’s screens: asked once, large type, no red, and nothing in the caregiver’s views', async () => {
  const view = inRepo('src/components/reminders.tsx');
  assert.ok(view.includes('label="Yes, remind me"') && view.includes('label="Not now"'), 'two big buttons');
  assert.ok(/Would you like a gentle reminder on this phone each day to practice\?/.test(view), 'one short sentence');
  assert.ok(!/#[0-9a-f]{3,6}\b|red|wrong|streak|score|missed/i.test(view.replace(/\/\/.*$/gm, '')), 'no red, no pressure');
  assert.ok(/!reminders\.settings\.asked && reminders\.permission !== 'denied'/.test(inRepo('src/data/reminders.ts')), 'never asked again, and not after the system refused');
  assert.ok(/inFront && hasStories && met && mayAsk\(reminders\)/.test(inRepo('src/app/index.tsx')), 'asked on the home, after the day’s session, never over another screen');
  const caregiverViews = ['src/components/settings-page.tsx', 'src/components/caregiver-settings.tsx', 'src/app/caregiver/index.tsx', 'src/components/person-sheet.tsx'];
  for (const path of caregiverViews) assert.ok(!/reminders|Reminder/.test(inRepo(path)), `${path} has no reminder control`);
  assert.ok(/<TextSizeSheet visible=\{open\} onClose=\{\(\) => setOpen\(false\)\} \/>/.test(inRepo('src/components/text-size.tsx')), 'the caregiver’s Text size sheet has no Reminders row');
  assert.ok(!/reminder/i.test(inRepo('src/lib/export.ts')), 'not in Export my data');
});

console.log(`All ${checks} reminder checks passed`);
