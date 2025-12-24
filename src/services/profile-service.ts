// src/services/profile-service.ts
import { ObjectId } from "mongodb";
import { ResponseHelper } from "../utils/response-helper";
import type { IUserRepository } from "../interfaces/user/i-user-repository";
import type { ILanguageRepository } from "../interfaces/skills/i-language-repository";
import type { IEducationRepository } from "../interfaces/education/i-education-repository";
import type { IProjectRepository } from "../interfaces/project/i-project-repository";
import type { ITechnicalSkillRepository } from "../interfaces/skills/i-technical-skill-repository";
import type { IPersonalSkillRepository } from "../interfaces/skills/i-personal-skill-repository";
import type { IUserProfileResponse } from "../interfaces/user/i-user-profile";
import type { IExerienceRepository } from "../interfaces/experience/i-experience-repository";
import type { TechnicalSkill } from "../models/skills/technical-skill";
import type { PersonalSkill } from "../models/skills/personal-skill";
import type { Language } from "../models/skills/language";
import type { Skill } from "../models/skill";
import type { Education } from "../models/education";
import type { Project } from "../models/project";

export class ProfileService {
  constructor(
    private userRepository: IUserRepository,
    private languageRepository: ILanguageRepository,
    private experienceRepository: IExerienceRepository,
    private educationRepository: IEducationRepository,
    private projectRepository: IProjectRepository,
    private technicalSkillRepository: ITechnicalSkillRepository,
    private personalSkillRepository: IPersonalSkillRepository,
  ) {}

  async getUserProfile(userId: ObjectId): Promise<Response> {
    try {
      // Fetch user basic info
      const user = await this.userRepository.findById(userId, 0);
      if (!user) {
        return ResponseHelper.error("User not found");
      }

      // Fetch all related data concurrently
      const [
        languages,
        experiences,
        education,
        projects,
        technicalSkills,
        personalSkills,
      ] = await Promise.all([
        this.languageRepository.getLanguagesByUserId(userId),
        this.experienceRepository.getExperiencesByUserId(userId),
        this.educationRepository.getEducationsByUserId(userId),
        this.projectRepository.getProjectsByUserId(userId),
        this.technicalSkillRepository.getTechnicalSkillsByUserId(userId),
        this.personalSkillRepository.getPersonalSkillsByUserId(userId),
      ]);

      // Format the response according to your requirements
      const profile: IUserProfileResponse = {
        name: user.fullName || user.userName || "Unknown",
        title: user.professionalTitle || "Developer",
        bio: user.bio || "",
        email: user.email || "",
        phone: user.phone || "",
        location: user.location || "",
        website: user.website || "",

        // Combine all skills from different sources
        skills: this.combineSkills(technicalSkills, personalSkills),

        // Format languages
        languages: this.formatLanguages(languages),

        // Format experiences
        experiences: this.formatExperiences(experiences),

        // Format education
        education: this.formatEducation(education),

        // Format projects
        projects: this.formatProjects(projects),
      };

      return ResponseHelper.success(profile);
    } catch (error) {
      console.error("Error fetching user profile:", error);
      return ResponseHelper.serverError(String(error));
    }
  }

  private combineSkills(
    technicalSkills: TechnicalSkill[],
    personalSkills: PersonalSkill[],
  ): string[] {
    const skillsSet = new Set<string>();

    // Add technical skills
    technicalSkills.forEach((skill) => {
      if (skill.name) skillsSet.add(skill.name);
    });

    // Add personal skills
    personalSkills.forEach((skill) => {
      if (skill.name) skillsSet.add(skill.name);
    });

    return Array.from(skillsSet);
  }

  private formatLanguages(
    languages: Language[],
  ): Array<{ name: string; level: string }> {
    return languages.map((lang) => ({
      name: lang.name || lang.nativeName || "",
      level: lang.level || lang.fluency || "Intermediate",
    }));
  }

  private formatExperiences(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    experiences: any[],
  ): IUserProfileResponse["experiences"] {
    return experiences.map((exp, index) => ({
      id: index + 1,
      title: exp.post || "",
      company: exp.entreprise || "",
      location: exp.place || "",
      startDate: this.formatDate(exp.startDate),
      endDate: exp.currentPost ? null : this.formatDate(exp.endDate),
      description: exp.description || exp.KeyAchievements || "",
      skills: exp.skills.map((skill: Skill) => skill.name) || [],
      current: exp.currentPost || exp.currentPost || false,
    }));
  }

  private formatEducation(
    education: Education[],
  ): IUserProfileResponse["education"] {
    return education.map((edu, index) => ({
      id: index + 1,
      degree: edu.degree || "",
      school: edu.school || "",
      location: edu.location || "",
      startDate: this.formatDate(edu.startDate),
      endDate: edu.current ? "Present" : this.formatDate(edu.endDate!),
      description: edu.description || "",
      current: edu.current || false,
    }));
  }

  private formatProjects(
    projects: Project[],
  ): IUserProfileResponse["projects"] {
    return projects.map((project, index) => ({
      id: index + 1,
      title: project.title || "",
      description: project.description || "",
      startDate: this.formatDate(project.startDate),
      endDate: project.current ? null : this.formatDate(project.endDate!),
      technologies: project.technologies || [],
      image: project.image || "",
      liveUrl: project.liveUrl || "",
      githubUrl: project.githubUrl || "",
      current: project.current || false,
    }));
  }

  private formatDate(date: Date): string {
    if (!date) return "";

    const d = new Date(date);
    if (isNaN(d.getTime())) return "";

    const month = d.toLocaleString("fr-FR", { month: "long" });
    const year = d.getFullYear();
    return `${this.capitalizeFirstLetter(month)} ${year}`;
  }

  private capitalizeFirstLetter(string: string): string {
    return string.charAt(0).toUpperCase() + string.slice(1);
  }
}
