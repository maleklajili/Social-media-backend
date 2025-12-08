import type { ObjectId } from "mongodb";
import type { Education } from "../../models/education";

export interface IEducationRepository {
  addEducation(education: Education): Promise<void>;
  updateEducation(education: Education): Promise<void>;
  deleteEducation(id: ObjectId, userId: ObjectId): Promise<boolean>;
  getEducationsByUserId(userId: ObjectId): Promise<Education[]>;
}
