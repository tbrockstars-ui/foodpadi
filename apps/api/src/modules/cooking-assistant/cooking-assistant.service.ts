import { Injectable } from '@nestjs/common';
import { ClaudeService } from '../ai/claude.service';
import { AiAccessService } from '../ai/ai-access.service';
import { AnalyticsService } from '../analytics/analytics.service';
import { AskCookingQuestionDto } from './dto/ask-cooking-question.dto';
import { CheckCookingStepDto } from './dto/check-cooking-step.dto';
import { CookingStepCheckView, sanitizeCookingStepCheck } from './cooking-assistant-validation';

/**
 * Guided-cooking assistant: the "is this ready?" vision check and the
 * recipe Q&A used by voice/typed questions during a cooking session
 * (apps/mobile CookingSessionScreen / apps/web CookingSession). Member-only
 * — @UseGuards(JwtAuthGuard) on the controller, same posture as ScanController,
 * since both are paid AI calls a guest must never trigger.
 */
@Injectable()
export class CookingAssistantService {
  constructor(
    private readonly claude: ClaudeService,
    private readonly analytics: AnalyticsService,
    private readonly aiAccess: AiAccessService,
  ) {}

  async checkStep(dto: CheckCookingStepDto, userId: string): Promise<CookingStepCheckView> {
    await this.aiAccess.assertCanUseAi(userId, 'cooking_assistant_step_check');
    const raw = await this.claude.checkCookingStep({
      imageBase64: dto.imageBase64,
      mediaType: dto.mediaType,
      recipeTitle: dto.recipeTitle,
      stepText: dto.stepText,
    });
    const view = sanitizeCookingStepCheck(raw);

    await this.analytics.track('cooking_step_check_completed', { userId }, {
      recipeTitle: dto.recipeTitle,
    });

    return view;
  }

  async ask(dto: AskCookingQuestionDto, userId: string): Promise<{ answer: string }> {
    await this.aiAccess.assertCanUseAi(userId, 'cooking_assistant_question');
    const answer = await this.claude.answerCookingQuestion({
      recipeTitle: dto.recipeTitle,
      ingredients: dto.ingredients,
      steps: dto.steps,
      currentStepIndex: dto.currentStepIndex,
      question: dto.question,
    });

    await this.analytics.track('cooking_question_asked', { userId }, {
      recipeTitle: dto.recipeTitle,
      stepIndex: dto.currentStepIndex,
    });

    return { answer };
  }
}
