import { SkillLevel } from "../models/skill";

export function isValidSkillLevel(level: unknown): level is SkillLevel {
  return (
    typeof level === "string" &&
    Object.values(SkillLevel).includes(level as SkillLevel)
  );
}
