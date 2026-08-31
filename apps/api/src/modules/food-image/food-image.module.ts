import { Module } from '@nestjs/common';
import { FoodImageService } from './food-image.service';
import { PexelsImageProvider } from './providers/pexels.provider';
import { UnsplashImageProvider } from './providers/unsplash.provider';

/**
 * Representative food photos for recommendation cards — the visual layer of
 * the "what should I eat" decision experience. Consumed by DecideModule and
 * EatNowModule to attach an `image` to each option/idea they return; keys
 * for the underlying providers (Pexels, Unsplash) live only here on the API.
 */
@Module({
  providers: [FoodImageService, PexelsImageProvider, UnsplashImageProvider],
  exports: [FoodImageService],
})
export class FoodImageModule {}
