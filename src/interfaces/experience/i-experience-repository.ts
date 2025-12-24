import type { ObjectId } from "mongodb";
import type { Experience } from "../../models/experience";

export interface IExerienceRepository {
  addExperience(experience: Experience): Promise<void>;
  updatedExperience(experience: Experience): Promise<void>;
  getExperiencesByUserId(userId: ObjectId): Promise<Experience[]>;
}
