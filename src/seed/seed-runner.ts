import { Logger } from "../config/logger";
import { seedSkills } from "./skills-seed";

export async function runSeeds() {
  try {
    await seedSkills();
    Logger.success("All seeders finished.", false);
  } catch (err) {
    Logger.error(`Faild Seed : ${err}`);
  }
}
