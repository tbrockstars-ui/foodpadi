import { IsArray, IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export const FEEDBACK_ENTITY_TYPES = ['RECIPE', 'MEAL', 'PLAN'] as const;
export type FeedbackEntityType = (typeof FEEDBACK_ENTITY_TYPES)[number];

export const FEEDBACK_CONTEXTS = ['EAT_NOW', 'COOK', 'PLAN', 'DECIDE', 'ORDER', 'OTHER'] as const;
export type FeedbackContext = (typeof FEEDBACK_CONTEXTS)[number];

export class CreateFeedbackDto {
  @IsIn(FEEDBACK_ENTITY_TYPES)
  entityType!: FeedbackEntityType;

  @IsString()
  entityId!: string;

  @IsIn(FEEDBACK_CONTEXTS)
  context!: FeedbackContext;

  @IsInt()
  @Min(1)
  @Max(5)
  rating!: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(500)
  comment?: string;
}
