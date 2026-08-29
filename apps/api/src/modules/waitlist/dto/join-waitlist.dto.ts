import { IsEmail } from 'class-validator';

export class JoinWaitlistDto {
  @IsEmail()
  email!: string;
}
