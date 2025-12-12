import type { ObjectId } from "mongodb";
import type { BaseModel } from "./base/base-model";
export interface Project extends BaseModel {
  userId: ObjectId;
  title: string;
  description: string;
  startDate: Date;
  endDate?: Date;
  technologies: string[];
  category: string; // Web App, Mobile App, E-commerce, etc.
  projectType: string; // Personnal, Professionnel, Formation, etc.
  image?: string; // URL of project image
  liveUrl?: string;
  githubUrl?: string;
  current: boolean;
  featured?: boolean;
  color?: string;
}
