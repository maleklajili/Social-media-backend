import type { ObjectId } from "mongodb";
import type { Education } from "../../models/education";

export interface IEducationService {
  addEducation(
    userId: ObjectId,
    education: Education,
    formData: FormData,
  ): Promise<Response>;
  updateEducation(
    userId: ObjectId,
    education: Education,
    formData: FormData,
  ): Promise<Response>;
}
