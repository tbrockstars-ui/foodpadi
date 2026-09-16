import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';
import type { AuthenticatedActor, GuestActor } from '../auth/guest-or-auth.guard';

// Same lightweight constructor-mock pattern as
// plan-ahead/create-standalone-shopping-list.spec.ts.
describe('AnalyticsController.track', () => {
  let analytics: { track: jest.Mock };
  let controller: AnalyticsController;

  beforeEach(() => {
    analytics = { track: jest.fn() };
    controller = new AnalyticsController(analytics as unknown as AnalyticsService);
  });

  it('forwards a signed-in user event with userId, no guestSessionId', async () => {
    const actor: AuthenticatedActor = { type: 'user', userId: 'u-1', email: 'a@b.com' };

    await controller.track({ eventType: 'cook_today_start_cooking' }, actor);

    expect(analytics.track).toHaveBeenCalledWith('cook_today_start_cooking', { userId: 'u-1' }, undefined);
  });

  it('forwards a guest event with guestSessionId, no userId', async () => {
    const actor: GuestActor = { type: 'guest', sessionId: 'g-1', disclaimerAcknowledged: true };

    await controller.track({ eventType: 'cook_today_start_cooking' }, actor);

    expect(analytics.track).toHaveBeenCalledWith('cook_today_start_cooking', { guestSessionId: 'g-1' }, undefined);
  });

  it('forwards metadata as a plain object', async () => {
    const actor: AuthenticatedActor = { type: 'user', userId: 'u-1', email: 'a@b.com' };

    await controller.track(
      { eventType: 'cook_today_step_completed', metadata: { stepIndex: 2, totalSteps: 6 } },
      actor,
    );

    expect(analytics.track).toHaveBeenCalledWith(
      'cook_today_step_completed',
      { userId: 'u-1' },
      { stepIndex: 2, totalSteps: 6 },
    );
  });
});
