import * as crypto from "crypto";
import { ObjectId, type OptionalUnlessRequiredId } from "mongodb";
import { EnvLoader } from "../config/env";
import { Logger } from "../config/logger";
import type { IAuthService } from "../interfaces/auth/i-auth-service";
import type { IEmailVerificationRepository } from "../interfaces/auth/repo/i-email-verification-token-repository";
import type { IOtpVerificationRepository } from "../interfaces/auth/repo/i-otp--verification-repository";
import type { IRefreshTokenRepository } from "../interfaces/auth/repo/i-refresh-token-repository";
import type { IUserRepository } from "../interfaces/user/i-user-repository";
import { CollectionsManager } from "../models/base/collection-manager";
import type { EmailVerificationToken } from "../models/email-verification-token";
import type { OtpVerification } from "../models/otp-verification";
import type { RefreshToken } from "../models/refresh-token";
import type { User } from "../models/user";
import { getForgotPasswordEmailContent } from "../templates/forget-password-email";
import { createUser } from "../utils/auth";
import { sendEmail } from "../utils/email-service";
import { ResponseHelper } from "../utils/response-helper";
import { BaseService } from "./base/base-service";
import { tokenService } from "./token-service";
export class AuthService
  extends BaseService<RefreshToken>
  implements IAuthService
{
  constructor(
    private userRepository: IUserRepository,
    private refreshTokenRepository: IRefreshTokenRepository,
    private otpVerificationRepository: IOtpVerificationRepository,
    private emailVerificationRepository: IEmailVerificationRepository,
  ) {
    super(CollectionsManager.refreshCollection);
  }

  async login(
    identifier: string | undefined,
    password: string,
  ): Promise<Response> {
    if (!identifier) {
      return ResponseHelper.error("Email or username is required", 400);
    }

    const user = await this.userRepository.findByIdentifier(identifier);
    if (!user) {
      return ResponseHelper.error("User not found", 404);
    }

    const isMatch = await Bun.password.verify(password, user.password);
    if (!isMatch) {
      return ResponseHelper.error("Invalid password", 401);
    }

    const userId = new ObjectId(user._id);

    const existingSession =
      await this.refreshTokenRepository.findByUserId(userId);

    const accessToken = tokenService.generateAccessToken(user._id);
    const refreshToken = tokenService.generateRefreshToken(user._id);

    if (existingSession) {
      existingSession.token = refreshToken;
      existingSession.updatedAt = new Date();

      await this.refreshTokenRepository.update(existingSession);
    } else {
      const refreshTokenData: RefreshToken = {
        userId: userId,
        token: refreshToken,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await this.refreshTokenRepository.create(refreshTokenData);
    }

    return ResponseHelper.success({
      accessToken,
      refreshToken,
      userId: user._id,
    });
  }

  async logout(token: string | null): Promise<Response> {
    if (!token) {
      return ResponseHelper.error("could not get token", 400);
    }

    const payload = await tokenService.verifyToken(token);
    await this.refreshTokenRepository.deleteByUserId(
      new ObjectId(String(payload._id)),
    );

    return ResponseHelper.success({ message: "Logged out successfully" });
  }

  async refreshToken(refreshToken: string): Promise<Response> {
    if (!refreshToken) {
      return ResponseHelper.error("Refresh token is required", 400);
    }

    const payload = await tokenService.verifyToken(refreshToken);
    const tokenDoc =
      await this.refreshTokenRepository.findByToken(refreshToken);

    if (!tokenDoc) {
      return ResponseHelper.error("Refresh token not found", 403);
    }

    const userId = new ObjectId(String(payload._id));
    const user = await this.userRepository.findById(userId, 0);

    if (!user) {
      return ResponseHelper.error("User no longer exists", 404);
    }

    await this.refreshTokenRepository.deleteByToken(refreshToken);

    const newAccessToken = tokenService.generateAccessToken(user._id);
    const newRefreshToken = tokenService.generateRefreshToken(user._id);

    await this.refreshTokenRepository.create({
      userId: userId,
      token: newRefreshToken,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    return ResponseHelper.success({
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    });
  }

  async sendOtp(email: string): Promise<Response> {
    const otp = crypto.randomInt(100000, 999999).toString();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
    const user = await this.userRepository.findByEmail(email);
    if (user) {
      return ResponseHelper.error("User already exists with this email", 400);
    }
    const otpData: OtpVerification = {
      email: email,
      otp,
      expiresAt,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    try {
      await sendEmail({
        to: email,
        otp,
      });

      await this.otpVerificationRepository.create(otpData);
      return ResponseHelper.success({ otp, expiresAt });
    } catch (error) {
      Logger.error(`Failed to send OTP email to ${email}: ${error}`);
      return ResponseHelper.error("Failed to send verification email", 500);
    }
  }

  async verifyOtp(
    otp: string,
    userData: OptionalUnlessRequiredId<User>,
  ): Promise<Response> {
    const otpRecord = await this.otpVerificationRepository.findbyOtpCode(otp);

    if (!otpRecord) {
      return ResponseHelper.error("Invalid OTP");
    }

    const currentTime = new Date();
    if (currentTime > otpRecord.expiresAt) {
      return ResponseHelper.error("OTP expired");
    }

    await this.otpVerificationRepository.deleteById(otpRecord._id);

    return createUser(userData);
  }

  async forgetPassword(email: string): Promise<Response> {
    const user = await this.userRepository.findByEmail(email);
    if (!user) {
      return ResponseHelper.error("User not found", 404);
    }

    const rawToken = crypto.randomBytes(32).toString("hex");
    const hashedToken = crypto
      .createHash("sha256")
      .update(rawToken)
      .digest("hex");
    const expiresAt = new Date(Date.now() + EnvLoader.resetTokenExpiry); // From .env

    await this.emailVerificationRepository.deleteAll(user._id); // Delete old tokens

    const tokenDoc: EmailVerificationToken = {
      userId: user._id,
      tokenHash: hashedToken,
      expiresAt,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    await this.emailVerificationRepository.create(tokenDoc);

    const resetLink = `${EnvLoader.frontUrl}/reset-password/${rawToken}`;
    const { subject, text, html } = getForgotPasswordEmailContent(resetLink);
    await sendEmail({ to: email, subject, text, html });

    return ResponseHelper.success("Password reset link sent to your email.");
  }

  async createNewPassword(
    token: string,
    newPassword: string,
  ): Promise<Response> {
    const hashedToken = crypto.createHash("sha256").update(token).digest("hex");
    const tokenToVerfi =
      await this.emailVerificationRepository.findByTokenHash(hashedToken);
    if (!tokenToVerfi) {
      return ResponseHelper.error("Invalid or expired reset token", 400);
    }
    if (tokenToVerfi.expiresAt < new Date()) {
      return ResponseHelper.error("Reset token has expired", 410);
    }
    const hashPassword = await Bun.password.hash(newPassword);
    await this.userRepository.changePassword(tokenToVerfi.userId, hashPassword);
    await this.emailVerificationRepository.deleteAll(tokenToVerfi.userId);

    return ResponseHelper.success("Password Change Successfuly");
  }

  async validateResetToken(token: string): Promise<Response> {
    const hashedToken = crypto.createHash("sha256").update(token).digest("hex");
    const tokenToVerfi =
      await this.emailVerificationRepository.findByTokenHash(hashedToken);
    if (!tokenToVerfi) {
      return ResponseHelper.error("Invalid or expired reset token", 400);
    }
    if (tokenToVerfi.expiresAt < new Date()) {
      return ResponseHelper.error("Reset token has expired", 410);
    }
    return ResponseHelper.success("Valid reset token");
  }
}
