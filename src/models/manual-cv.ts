import type { ObjectId } from "mongodb";
import { BaseModel } from "./base/base-model";

export type ManualCvFormat = "standard" | "canadian" | "modern" | "european";

export interface ManualCvPersonalInfo {
  fullName: string;
  professionalTitle?: string;
  email?: string;
  phone?: string;
  city?: string;
  website?: string;
  summary?: string;
}

export interface ManualCvExperience {
  jobTitle: string;
  company: string;
  startDate: string;
  endDate?: string;
  current: boolean;
  description?: string;
}

export interface ManualCvEducation {
  degree: string;
  school: string;
  startDate: string;
  endDate?: string;
  current: boolean;
  description?: string;
}

export interface ManualCvSkill {
  name: string;
  level?: string; // "Débutant" | "Intermédiaire" | "Avancé" | "Expert"
}

export interface ManualCvLanguage {
  name: string;
  level?: string; // "A1" | "A2" | "B1" | "B2" | "C1" | "C2" | "Natif"
}

export interface ManualCv extends BaseModel {
  userId: ObjectId;
  title: string;
  format: ManualCvFormat;
  language: string;
  personalInfo: ManualCvPersonalInfo;
  experiences: ManualCvExperience[];
  educations: ManualCvEducation[];
  skills: ManualCvSkill[];
  languages: ManualCvLanguage[];
  projects: string[];
  certifications: string[];
  interests: string[];
}
