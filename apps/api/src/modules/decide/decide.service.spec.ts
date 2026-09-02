import { DecideService } from './decide.service';
import { CookTodayService } from '../cook-today/cook-today.service';
import { EatNowService } from '../eat-now/eat-now.service';
import { AnalyticsService } from '../analytics/analytics.service';
import { FoodImageService } from '../food-image/food-image.service';
import type { AuthenticatedActor, GuestActor } from '../auth/guest-or-auth.guard';

const GUEST: GuestActor = { type: 'guest', sessionId: 'guest-9', disclaimerAcknowledged: true };
const USER: AuthenticatedActor = { type: 'user', userId: 'u9', email: 'u9@example.com' };

describe('DecideService.decide — guest path stays AI-free', () => {
  let cookToday: { generate: jest.Mock };
  let eatNow: { search: jest.Mock };
  let analytics: { track: jest.Mock };
  let foodImage: { resolveMany: jest.Mock };
  let service: DecideService;

  beforeEach(() => {
    cookToday = { generate: jest.fn().mockResolvedValue([]) };
    eatNow = { search: jest.fn().mockResolvedValue([]) };
    analytics = { track: jest.fn() };
    foodImage = { resolveMany: jest.fn().mockResolvedValue(new Map()) };
    service = new DecideService(
      cookToday as unknown as CookTodayService,
      eatNow as unknown as EatNowService,
      analytics as unknown as AnalyticsService,
      foodImage as unknown as FoodImageService,
    );
  });

  it('delegates the "cook it" lane to CookTodayService with the guest actor (which self-serves curated)', async () => {
    await service.decide({ description: 'something quick' }, GUEST);
    expect(cookToday.generate).toHaveBeenCalledWith(
      expect.objectContaining({ ingredients: ['something quick'] }),
      GUEST,
    );
  });

  it('tags the analytics event as a guest decision', async () => {
    await service.decide({ description: 'pasta' }, GUEST);
    expect(analytics.track).toHaveBeenCalledWith(
      'decide_options_generated',
      { guestSessionId: 'guest-9' },
      expect.objectContaining({ guest: true }),
    );
  });

  it('tags a signed-in decision as non-guest', async () => {
    await service.decide({ description: 'pasta' }, USER);
    expect(analytics.track).toHaveBeenCalledWith(
      'decide_options_generated',
      { userId: 'u9' },
      expect.objectContaining({ guest: false }),
    );
  });
});
