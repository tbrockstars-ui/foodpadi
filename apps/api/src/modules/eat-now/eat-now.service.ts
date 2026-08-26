import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { SearchEatNowDto } from './dto/search-eat-now.dto';

/**
 * Layer 4 ranking (docs/IMPLEMENTATION_PLAN.md Phase 4) needs a real UK
 * product/restaurant/menu-item data source — none has been chosen or
 * connected yet, so every search is an honest 503, not fabricated results.
 */
@Injectable()
export class EatNowService {
  async search(_dto: SearchEatNowDto): Promise<never> {
    throw new ServiceUnavailableException(
      'Eat Now is not available yet — no product or restaurant data source is connected.',
    );
  }
}
