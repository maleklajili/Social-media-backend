import type { ObjectId } from "mongodb";
import { CollectionsManager } from "../models/base/collection-manager";
import type { EmailVerificationToken } from "../models/email-verification-token";
import type { IEmailVerificationRepository } from "../interfaces/auth/repo/i-email-verification-token-repository";

export class EmailVerificationTokenRespository
  implements IEmailVerificationRepository
{
  async deleteAll(userId: ObjectId | undefined): Promise<void> {
    await CollectionsManager.emailVerfificationTokenCollection.deleteMany({
      userId: userId,
    });
  }

  async create(data: EmailVerificationToken): Promise<void> {
    await CollectionsManager.emailVerfificationTokenCollection.insertOne(data);
  }

  async findByTokenHash(
    hashedToken: string,
  ): Promise<EmailVerificationToken | null> {
    const emailVerification =
      await CollectionsManager.emailVerfificationTokenCollection.findOne({
        tokenHash: hashedToken,
      });
    return emailVerification;
  }
}
