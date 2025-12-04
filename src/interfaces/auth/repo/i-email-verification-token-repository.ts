import type { ObjectId } from "mongodb";
import type { EmailVerificationToken } from "../../../models/email-verification-token";

export interface IEmailVerificationRepository {
  deleteAll(userId: ObjectId | undefined): Promise<void>;
  create(data: EmailVerificationToken): Promise<void>;
  findByTokenHash(hashedToken: string): Promise<EmailVerificationToken | null>;
}
