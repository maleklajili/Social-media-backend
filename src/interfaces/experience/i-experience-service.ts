import type { ObjectId } from "mongodb";
import type { Experience } from "../../models/experience";

export interface IExperienceService {
  addExperience(
    userId: ObjectId,
    experience: Experience,
    formData: FormData,
  ): Promise<Response>;

  updateExperience(
    userId: ObjectId,
    experienceId: ObjectId,
    experience: Experience,
    formData: FormData,
  ): Promise<Response>;
  deleteExperienceWithFiles(
    userId: ObjectId,
    experienceId: ObjectId,
  ): Promise<Response>;
  getExperiencesByUserId(userId: ObjectId): Promise<Experience[]>;
}
