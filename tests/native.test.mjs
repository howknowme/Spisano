import test from 'node:test';
import assert from 'node:assert/strict';

// Fake Capacitor bridge: records what the app asks the notifications plugin to do.
const calls = [];
let pending = [];
globalThis.window = {
  Capacitor: {
    isNativePlatform: () => true,
    Plugins: {
      LocalNotifications: {
        checkPermissions: async () => ({ display: 'granted' }),
        createChannel: async () => {},
        getPending: async () => ({ notifications: pending }),
        cancel: async (o) => { calls.push(['cancel', o.notifications.length]); pending = []; },
        schedule: async (o) => { calls.push(['schedule', o.notifications]); pending = o.notifications.map((n) => ({ id: n.id })); },
      },
    },
  },
};

const N = await import('../js/native.js');
const inAnHour = () => new Date(Date.now() + 3600_000);

test('reminders never ask for exact alarms (that opened the Alarms & reminders screen in a loop)', async () => {
  await N.syncReminders([{ key: 'a', title: 'T', body: 'B', at: inAnHour() }], 'ch');
  const sched = calls.find((c) => c[0] === 'schedule');
  assert.ok(sched, 'scheduled');
  assert.equal(sched[1].length, 1);
  assert.equal(sched[1][0].isExactNotification, false);
});

test('an unchanged reminder list is not rescheduled on resume', async () => {
  const at = new Date(Date.now() + 7200_000);
  await N.syncReminders([{ key: 'b', title: 'T', body: 'B', at }], 'ch');
  calls.length = 0;
  await N.syncReminders([{ key: 'b', title: 'T', body: 'B', at }], 'ch');
  assert.deepEqual(calls, []);
  assert.equal(pending.length, 1, 'existing reminder is kept');
});

test('a changed list replaces the old reminders', async () => {
  calls.length = 0;
  await N.syncReminders([{ key: 'c', title: 'T2', body: 'B2', at: inAnHour() }], 'ch');
  assert.deepEqual(calls.map((c) => c[0]), ['cancel', 'schedule']);
});
