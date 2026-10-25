import { describe, expect, test } from 'bun:test';
import { toDraft, toTaskPayload } from './ScheduledTaskEditorDialog';
import type { ScheduledTask } from '@/lib/scheduledTasksApi';

const defaults = { providerID: 'openai', modelID: 'gpt-5', variant: '', agent: 'build' };

const baseTask = (overrides: Partial<ScheduledTask> = {}): ScheduledTask => ({
  id: 'task-1',
  name: 'Nightly',
  enabled: true,
  schedule: { kind: 'daily', times: ['09:00'], timezone: 'UTC' },
  execution: { prompt: 'Run', providerID: 'openai', modelID: 'gpt-5' },
  state: { createdAt: 1, updatedAt: 1 },
  ...overrides,
});

describe('ScheduledTaskEditorDialog draft and payload', () => {
  test('a new draft starts with isolation off and no base branch', () => {
    const draft = toDraft(null, defaults);
    expect(draft.isolateRuns).toBe(false);
    expect(draft.baseBranch).toBe('');
  });

  test('reads isolation fields from a task and defaults them when absent', () => {
    expect(toDraft(baseTask({ isolateRuns: true, baseBranch: 'develop' }), defaults))
      .toMatchObject({ isolateRuns: true, baseBranch: 'develop' });
    expect(toDraft(baseTask(), defaults)).toMatchObject({ isolateRuns: false, baseBranch: '' });
  });

  test('carries isolateRuns and baseBranch for a new-session task', () => {
    const draft = toDraft(baseTask({ isolateRuns: true, baseBranch: 'develop' }), defaults);
    expect(toTaskPayload(draft)).toMatchObject({ isolateRuns: true, baseBranch: 'develop' });
  });

  test('omits baseBranch when isolation is off, even if a branch was picked', () => {
    const draft = { ...toDraft(baseTask(), defaults), isolateRuns: false, baseBranch: 'develop' };
    const payload = toTaskPayload(draft);
    expect(payload.isolateRuns).toBeUndefined();
    expect(payload.baseBranch).toBeUndefined();
  });

  test('lets isolation run with the default HEAD branch when none is picked', () => {
    const draft = { ...toDraft(baseTask(), defaults), isolateRuns: true, baseBranch: '' };
    const payload = toTaskPayload(draft);
    expect(payload.isolateRuns).toBe(true);
    expect(payload.baseBranch).toBeUndefined();
  });

  test('never sends isolation for an existing-session task', () => {
    const draft = { ...toDraft(baseTask({ targetSessionId: 'ses_1' }), defaults), isolateRuns: true, baseBranch: 'develop' };
    const payload = toTaskPayload(draft);
    expect(payload.targetSessionId).toBe('ses_1');
    expect(payload.isolateRuns).toBeUndefined();
    expect(payload.baseBranch).toBeUndefined();
  });

  test('trims surrounding whitespace from the base branch', () => {
    const draft = { ...toDraft(baseTask(), defaults), isolateRuns: true, baseBranch: '  develop  ' };
    expect(toTaskPayload(draft).baseBranch).toBe('develop');
  });
});
