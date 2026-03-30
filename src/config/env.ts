import type { StringValue } from "ms";
export class EnvLoader {
  //DATABASE
  static readonly uri: string = String(Bun.env.DATABASE_URL);
  static readonly databaseName: string = String(Bun.env.DATABASE_NAME);
  static readonly port: number = Number(Bun.env.PORT) || 6000;

  //EMAIL
  static readonly sendGridKey: string = String(Bun.env.SENDGRID_API_KEY);
  static readonly emailSender: string = String(Bun.env.EMAIL_ADRESS);

  //OTP
  static readonly verficationUrl: string = `${String(Bun.env.FRONT_URL)}/verify`;
  static readonly frontUrl: string = String(Bun.env.FRONT_URL);

  //TOKEN
  static readonly jwtSecret: string = String(Bun.env.JWT_SECRET);
  static readonly ExpAccssToken: StringValue | number =
    (Bun.env.EXP_ACCESS_TOKEN as StringValue) || "15m";
  static readonly ExpRefreshToken: StringValue | number =
    (Bun.env.EXP_REFRESH_TOKEN as StringValue) || "7d";

  static readonly resetTokenExpiry: number = parseInt(
    Bun.env.RESET_TOKEN_EXPIRY_MS || "3600000",
    10,
  );

  //OLLAMA AI (free, local)
  static readonly ollamaModel: string = String(
    Bun.env.OLLAMA_MODEL || "llama3.2",
  );
}
