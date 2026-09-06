import { IsIn } from 'class-validator';

export const COMPANION_ACTIONS = ['opened', 'accepted', 'dismissed', 'not_useful', 'do_not_remind'] as const;
export type CompanionActionValue = (typeof COMPANION_ACTIONS)[number];

export class CompanionActionDto {
  @IsIn(COMPANION_ACTIONS)
  action!: CompanionActionValue;
}
