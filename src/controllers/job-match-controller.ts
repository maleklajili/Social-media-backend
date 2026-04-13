import type { Collection, ObjectId } from "mongodb";
import { authMiddleware } from "../middleware/aut-middleware";
import { CollectionsManager } from "../models/base/collection-manager";
import type { Job } from "../models/job";
import { Get } from "../routes/router-manager";
import { ResponseHelper } from "../utils/response-helper";
import { BaseController } from "./base/base-controller";
import { JobRepository } from "../repositories/job-repository";
import { ExperienceRepository } from "../repositories/experience-repository";
import { EducationRepository } from "../repositories/education-repository";
import { skillRepository } from "../repositories/skill-repository";
import { TechnicalSkillRepository } from "../repositories/skills/technical-skill-repository";
import { ManualCvRepository } from "../repositories/manual-cv-repository";
import { userRepository } from "../repositories/user-repository";
import { JobMatcherClient } from "../utils/job-matcher-client";
import type { ServerRequest } from "../config/interfaces/i-request";
import type { BaseService } from "../services/base/base-service";

export class JobMatchController extends BaseController<Job, BaseService<Job>> {
  private jobRepo = new JobRepository();
  private experienceRepo = new ExperienceRepository();
  private educationRepo = new EducationRepository();
  private skillRepo = new skillRepository();
  private technicalSkillRepo = new TechnicalSkillRepository();
  private manualCvRepo = new ManualCvRepository();
  private userRepo = new userRepository();

  constructor() {
    super("/jobs");
    // service is not used in this controller — suppress abstract requirement
    this.initializeService(null as unknown as BaseService<Job>);
  }

  protected initializeCollection(): Collection<Job> {
    return CollectionsManager.jobCollection;
  }

  protected createService(): BaseService<Job> {
    return null as unknown as BaseService<Job>;
  }

  @Get("/matches", [authMiddleware])
  async getMatchedJobs(req: ServerRequest): Promise<Response> {
    try {
      if (!req.user?._id) {
        return ResponseHelper.error("Utilisateur non authentifié");
      }

      const userId = req.user._id as ObjectId;

      // Fetch all profile data in parallel
      const [
        user,
        experiences,
        education,
        skills,
        technicalSkills,
        manualCvs,
        activeJobs,
      ] = await Promise.all([
        this.userRepo.findById(userId, 0),
        this.experienceRepo.getExperiencesByUserId(userId),
        this.educationRepo.getEducationsByUserId(userId),
        this.skillRepo.findByUserId(userId),
        this.technicalSkillRepo.getTechnicalSkillsByUserId(userId),
        this.manualCvRepo.getByUserId(userId),
        this.jobRepo.getActiveJobs(),
      ]);

      if (!user) {
        return ResponseHelper.error("Utilisateur introuvable");
      }

      if (activeJobs.length === 0) {
        return ResponseHelper.success({ data: [], total: 0 });
      }

      // Build base profile from separate collections
      const profileSkills = skills.map((s) => ({
        name: s.categorie ?? s.name ?? "",
        level: s.level ?? "",
      }));
      const profileTechSkills = technicalSkills.map((ts) => ({
        name: ts.name ?? ts.category ?? "",
      }));
      const profileExperiences = experiences.map((e) => ({
        post: e.post ?? "",
        entreprise: e.entreprise ?? "",
        description: e.description ?? "",
        skills: Array.isArray(e.skills) ? e.skills : [],
      }));
      const profileEducation = education.map((edu) => ({
        degree: edu.degree ?? "",
        school: edu.school ?? "",
        description: edu.description ?? "",
      }));

      // Merge ManualCV data (most recent CV)
      const cv = manualCvs.length > 0 ? manualCvs[0] : null;
      if (cv) {
        for (const s of cv.skills ?? []) {
          if (
            s.name &&
            !profileSkills.some(
              (ps) => ps.name.toLowerCase() === s.name.toLowerCase(),
            )
          ) {
            profileSkills.push({ name: s.name, level: s.level ?? "" });
          }
        }
        for (const exp of cv.experiences ?? []) {
          profileExperiences.push({
            post: exp.jobTitle ?? "",
            entreprise: exp.company ?? "",
            description: exp.description ?? "",
            skills: [],
          });
        }
        for (const edu of cv.educations ?? []) {
          profileEducation.push({
            degree: edu.degree ?? "",
            school: edu.school ?? "",
            description: edu.description ?? "",
          });
        }
      }

      // Build profile object for AI matcher
      const profile = {
        professionalTitle:
          cv?.personalInfo?.professionalTitle ?? user.professionalTitle ?? "",
        bio: user.bio ?? "",
        summary: cv?.personalInfo?.summary ?? "",
        professionalCategory:
          (user as unknown as { categorie?: string }).categorie ?? "",
        skills: profileSkills,
        technicalSkills: profileTechSkills,
        experiences: profileExperiences,
        education: profileEducation,
        projects: (cv?.projects ?? []).map((p) => ({
          name: p.name ?? "",
          description: p.description ?? "",
        })),
        certifications: (cv?.certifications ?? []).map((c) => ({
          name: c.name ?? "",
          organization: c.organization ?? "",
          description: c.description ?? "",
        })),
        interests: cv?.interests ?? [],
      };

      // Serialise jobs for Python (convert ObjectId → string)
      const serialisedJobs = activeJobs.map((job) => ({
        ...job,
        _id: job._id?.toString() ?? "",
        userId: job.userId?.toString() ?? "",
        companyId: job.companyId?.toString() ?? "",
      }));

      // Run Python AI matching
      const matched = await JobMatcherClient.matchJobs(
        profile as Record<string, unknown>,
        serialisedJobs,
      );

      return ResponseHelper.success({
        data: matched,
        total: matched.length,
      });
    } catch (err) {
      return ResponseHelper.serverError(String(err));
    }
  }
}
