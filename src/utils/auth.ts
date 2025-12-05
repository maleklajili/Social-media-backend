import type { OptionalUnlessRequiredId } from "mongodb";
import validator from "validator";
import { CollectionsManager } from "../models/base/collection-manager";
import type { User } from "../models/user";
import { tokenService } from "../services/token-service";
import { ResponseHelper } from "./response-helper";
import { UtilsFunc } from "./utils-func";

export function getTokenFromHeaders(headers: {
  get(name: string): string | null;
}): string | null {
  const authHeader =
    headers.get("authorization") || headers.get("Authorization");

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null;
  }

  return authHeader.split(" ")[1]!;
}

export async function createUser(
  userData: OptionalUnlessRequiredId<User>,
): Promise<Response> {
  if (
    !userData.email ||
    !userData.password ||
    !userData.firstName ||
    !userData.lastName
  ) {
    return ResponseHelper.error(
      "Cannot create user: Missing required fields",
      400,
    );
  }

  if (!validator.isEmail(userData.email)) {
    return ResponseHelper.error("Invalid email format", 400);
  }

  const emailExists = await CollectionsManager.userCollection.findOne({
    email: userData.email,
  });
  if (emailExists) {
    return ResponseHelper.error("Email already in use", 409);
  }

  const baseUsername = `${userData.firstName.toLowerCase()}${userData.lastName.toLowerCase()}`;
  const userExists = await CollectionsManager.userCollection.findOne({
    userName: baseUsername,
  });
  const isSafe = !userExists;

  const userName = await UtilsFunc.createUsernameGenerator(
    isSafe,
  ).generateUserName(userData.firstName, userData.lastName);

  const hashPassword = await Bun.password.hash(userData.password);

  const newUser: OptionalUnlessRequiredId<User> = {
    ...userData,
    password: hashPassword,
    userName,
    coins: 300,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const result = await CollectionsManager.userCollection.insertOne(newUser);
  const userId = result.insertedId;
  const accessToken = tokenService.generateAccessToken(userId);
  const refreshToken = tokenService.generateRefreshToken(userId);

  return ResponseHelper.success({
    accessToken,
    refreshToken,
    userId: newUser._id,
  });
}
