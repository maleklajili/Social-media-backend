// services/job-application-services.ts
import { ObjectId } from "mongodb";
import { BaseService } from "./base/base-service";
import type { JobApplication } from "../models/job-application";
import type { IJobApplicationRepository } from "../interfaces/job/i-job-application-repository";
import type { IJobApplicationService } from "../interfaces/job/i-job-application-service";
import type { IJobRepository } from "../interfaces/job/i-job-repository";
import type { IUserRepository } from "../interfaces/user/i-user-repository";
import type { ICompanyRepository } from "../interfaces/company/i-company-repository";
import { CollectionsManager } from "../models/base/collection-manager";
import { ResponseHelper } from "../utils/response-helper";
import type { TransactionService } from "./transaction-services";
import { COINS_CONFIG } from "../utils/coins-config";
import { ExperienceRepository } from "../repositories/experience-repository";
import { EducationRepository } from "../repositories/education-repository";
import { skillRepository } from "../repositories/skill-repository";
import { TechnicalSkillRepository } from "../repositories/skills/technical-skill-repository";
import { ManualCvRepository } from "../repositories/manual-cv-repository";
import { JobMatcherClient } from "../utils/job-matcher-client";
import type { Job } from "../models/job";

export class JobApplicationService
  extends BaseService<JobApplication>
  implements IJobApplicationService
{
  private readonly experienceRepo = new ExperienceRepository();
  private readonly educationRepo = new EducationRepository();
  private readonly skillRepo = new skillRepository();
  private readonly technicalSkillRepo = new TechnicalSkillRepository();
  private readonly manualCvRepo = new ManualCvRepository();

  constructor(
    public applicationRepository: IJobApplicationRepository,
    public jobRepository: IJobRepository,
    private userRepository: IUserRepository,
    private companyRepository: ICompanyRepository,
    private transactionService: TransactionService,
  ) {
    super(CollectionsManager.jobApplicationCollection);
  }

  async applyForJob(
    userId: ObjectId,
    jobId: ObjectId,
    application: Partial<JobApplication>,
  ): Promise<Response> {
    try {
      const user = await this.userRepository.findById(userId, 0);
      if (!user) {
        return ResponseHelper.error("User not found");
      }

      const job = await this.jobRepository.getJobById(jobId);
      if (!job) {
        return ResponseHelper.error("Job not found", 404);
      }

      if (job.status !== "active") {
        return ResponseHelper.error("Job is no longer active", 422);
      }

      const hasApplied = await this.applicationRepository.hasAlreadyApplied(
        jobId,
        userId,
      );
      if (hasApplied) {
        return ResponseHelper.error(
          "Vous avez déjà postulé à cette offre",
          409,
        );
      }

      if (!application.coverLetter || application.coverLetter.trim() === "") {
        return ResponseHelper.error("Cover letter is required");
      }

      const newApplication: JobApplication = {
        _id: new ObjectId(),
        jobId,
        userId,
        companyId: job.companyId,
        applicantName: user.firstName + " " + user.lastName,
        applicantEmail: user.email,
        applicantPhone: application.applicantPhone || user.phone,
        cvFileName: application.cvFileName,
        coverLetter: application.coverLetter,
        status: "pending",
        appliedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await this.applicationRepository.addApplication(newApplication);

      // Fire-and-forget: compute TF-IDF match score in background
      this._computeAndSaveScore(newApplication._id!, userId, job).catch((err) =>
        console.error("[JobMatch] Score computation failed:", err),
      );

      const updatedJob = { ...job, applications: (job.applications || 0) + 1 };
      await this.jobRepository.updateJob(updatedJob);

      try {
        await this.userRepository.addCoins(userId, COINS_CONFIG.APPLY_JOB);
        await this.transactionService.addStandardEarning(
          userId,
          COINS_CONFIG.APPLY_JOB,
          "job-application",
          newApplication._id!,
          `Candidature à l'offre d'emploi: ${job.title}`,
          {
            jobTitle: job.title,
            company: job.companyId,
            contractType: job.contractType,
          },
        );
      } catch (err) {
        console.error(" Error adding coins:", err);
      }

      return ResponseHelper.success(newApplication, 201);
    } catch (err) {
      console.error(" Error applying for job:", err);
      return ResponseHelper.serverError(String(err));
    }
  }

  async getJobById(jobId: ObjectId): Promise<Response> {
    try {
      const job = await this.jobRepository.getJobById(jobId);
      if (!job) {
        return ResponseHelper.error("Job not found", 404);
      }
      return ResponseHelper.success(job);
    } catch (err) {
      console.error(" Error getting job:", err);
      return ResponseHelper.serverError(String(err));
    }
  }

  async updateApplicationStatus(
    applicationId: ObjectId,
    status: string,
    userId: ObjectId,
    companyId: ObjectId,
    feedback?: string,
  ): Promise<Response> {
    try {
      const application =
        await this.applicationRepository.getApplicationById(applicationId);

      if (!application) {
        return ResponseHelper.error("Application not found");
      }

      const job = await this.jobRepository.getJobById(application.jobId);
      if (!job) {
        return ResponseHelper.error("Job not found");
      }

      if (!job.userId.equals(userId)) {
        return ResponseHelper.error(
          "You don't have permission to update this application",
        );
      }

      const validStatuses = [
        "pending",
        "viewed",
        "shortlisted",
        "accepted",
        "rejected",
        "withdrawn",
      ];
      if (!validStatuses.includes(status)) {
        return ResponseHelper.error(`Invalid status: ${status}`);
      }

      const updatedApplication: JobApplication = {
        ...application,
        status: status as JobApplication["status"],
        respondedAt: new Date(),
        updatedAt: new Date(),
        response: feedback || application.response,
      };

      await this.applicationRepository.updateApplication(updatedApplication);

      return ResponseHelper.success(updatedApplication, 200);
    } catch (err) {
      console.error(" Error updating application status:", err);
      return ResponseHelper.serverError(String(err));
    }
  }

  async getApplicationById(applicationId: ObjectId): Promise<Response> {
    try {
      const application =
        await this.applicationRepository.getApplicationById(applicationId);

      if (!application) {
        return ResponseHelper.error("Application not found");
      }

      const applicationWithUrl = {
        ...application,
        cvUrl: application.cvFileName
          ? `/api/job-applications/${applicationId}/cv`
          : null,
      };

      return ResponseHelper.success(applicationWithUrl, 200);
    } catch (err) {
      console.error(" Error getting application:", err);
      return ResponseHelper.serverError(String(err));
    }
  }

  async getApplicationsForJob(jobId: ObjectId): Promise<Response> {
    try {
      const job = await this.jobRepository.getJobById(jobId);
      if (!job) {
        return ResponseHelper.error("Job not found");
      }

      const applications =
        await this.applicationRepository.getApplicationsByJobId(jobId);
      return ResponseHelper.success(applications, 200);
    } catch (err) {
      console.error(" Error getting job applications:", err);
      return ResponseHelper.serverError(String(err));
    }
  }

  async getApplicationsForUser(
    userId: ObjectId,
    pagination: { skip: number; limit: number },
  ): Promise<{ data: JobApplication[]; total: number }> {
    try {
      return await this.applicationRepository.getApplicationsByUserId(
        userId,
        pagination,
      );
    } catch (err) {
      console.error(" Error getting applications for user:", err);
      throw err;
    }
  }

  async getApplicationsForCompany(companyId: ObjectId): Promise<Response> {
    try {
      const applications =
        await this.applicationRepository.getApplicationsByCompanyId(companyId);
      return ResponseHelper.success(applications);
    } catch (err) {
      console.error(" Error getting company applications:", err);
      return ResponseHelper.serverError(String(err));
    }
  }

  async withdrawApplication(
    applicationId: ObjectId,
    userId: ObjectId,
  ): Promise<Response> {
    try {
      const application =
        await this.applicationRepository.getApplicationById(applicationId);

      if (!application) {
        return ResponseHelper.error("Application not found");
      }

      if (!application.userId.equals(userId)) {
        return ResponseHelper.error(
          "You don't have permission to withdraw this application",
        );
      }

      if (["accepted", "rejected"].includes(application.status)) {
        return ResponseHelper.error(
          "Cannot withdraw an application that has been reviewed",
        );
      }

      const updatedApplication: JobApplication = {
        ...application,
        status: "withdrawn",
        updatedAt: new Date(),
      };

      await this.applicationRepository.updateApplication(updatedApplication);

      const job = await this.jobRepository.getJobById(application.jobId);
      if (job) {
        const updatedJob = {
          ...job,
          applications: Math.max(0, (job.applications || 0) - 1),
        };
        await this.jobRepository.updateJob(updatedJob);
      }

      return ResponseHelper.success(updatedApplication);
    } catch (err) {
      console.error(" Error withdrawing application:", err);
      return ResponseHelper.serverError(String(err));
    }
  }

  async respondToApplication(
    applicationId: ObjectId,
    response: string,
    companyId: ObjectId,
  ): Promise<Response> {
    try {
      if (!response || response.trim() === "") {
        return ResponseHelper.error("Response message is required");
      }

      const application =
        await this.applicationRepository.getApplicationById(applicationId);

      if (!application) {
        return ResponseHelper.error("Application not found");
      }

      if (!application.companyId.equals(companyId)) {
        return ResponseHelper.error(
          "You don't have permission to respond to this application",
        );
      }

      const updatedApplication: JobApplication = {
        ...application,
        response,
        respondedAt: new Date(),
        updatedAt: new Date(),
      };

      await this.applicationRepository.updateApplication(updatedApplication);

      return ResponseHelper.success(updatedApplication, 200);
    } catch (err) {
      console.error(" Error responding to application:", err);
      return ResponseHelper.serverError(String(err));
    }
  }

  // ───────────────────────────────────────────────────
  // NLP Matching: TF-IDF + Cosine Similarity
  // ───────────────────────────────────────────────────

  /** Returns applications for a job sorted by matchScore descending. */
  async getRankedCandidates(jobId: ObjectId): Promise<Response> {
    try {
      const job = await this.jobRepository.getJobById(jobId);
      if (!job) return ResponseHelper.error("Job not found", 404);

      // First get all applications (ranked version uses score sort)
      const applications =
        await this.applicationRepository.getApplicationsByJobIdRanked(jobId);

      // Compute missing scores (applications that arrived before scoring was enabled)
      const unscored = applications.filter(
        (a) => a.score == null || a.score === undefined,
      );

      if (unscored.length > 0) {
        await Promise.all(
          unscored.map((a) =>
            this._computeAndSaveScore(a._id!, a.userId, job).catch(() => {}),
          ),
        );
        // Re-fetch after scoring
        const rescored =
          await this.applicationRepository.getApplicationsByJobIdRanked(jobId);
        return ResponseHelper.success(rescored, 200);
      }

      return ResponseHelper.success(applications, 200);
    } catch (err) {
      return ResponseHelper.serverError(String(err));
    }
  }

  /** Compute TF-IDF + Cosine Similarity score for one candidate vs a job. */
  private async _computeAndSaveScore(
    applicationId: ObjectId,
    userId: ObjectId,
    job: Job,
  ): Promise<void> {
    const [user, skills, technicalSkills, experiences, education, manualCvs] =
      await Promise.all([
        this.userRepository.findById(userId, 0),
        this.skillRepo.findByUserId(userId),
        this.technicalSkillRepo.getTechnicalSkillsByUserId(userId),
        this.experienceRepo.getExperiencesByUserId(userId),
        this.educationRepo.getEducationsByUserId(userId),
        this.manualCvRepo.getByUserId(userId),
      ]);

    if (!user) return;

    // Build base profile from separate profile collections
    const profileSkills = skills.map((s) => ({
      name: s.categorie ?? s.name ?? "",
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
      description:
        (edu as unknown as { description?: string }).description ?? "",
    }));

    // Merge ManualCV data (use the most recent CV)
    const cv = manualCvs.length > 0 ? manualCvs[0] : null;
    if (cv) {
      // Add CV skills not already present
      for (const s of cv.skills ?? []) {
        if (
          s.name &&
          !profileSkills.some(
            (ps) => ps.name.toLowerCase() === s.name.toLowerCase(),
          )
        ) {
          profileSkills.push({ name: s.name });
        }
      }
      // Add CV experiences
      for (const exp of cv.experiences ?? []) {
        profileExperiences.push({
          post: exp.jobTitle ?? "",
          entreprise: exp.company ?? "",
          description: exp.description ?? "",
          skills: [],
        });
      }
      // Add CV educations
      for (const edu of cv.educations ?? []) {
        profileEducation.push({
          degree: edu.degree ?? "",
          school: edu.school ?? "",
          description: edu.description ?? "",
        });
      }
    }

    const profile = {
      professionalTitle:
        cv?.personalInfo?.professionalTitle ?? user.professionalTitle ?? "",
      bio: (user as unknown as { bio?: string }).bio ?? "",
      summary: cv?.personalInfo?.summary ?? "",
      skills: profileSkills,
      technicalSkills: profileTechSkills,
      experiences: profileExperiences,
      education: profileEducation,
      // Extra CV fields for richer text matching
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

    const serialisedJob = {
      ...job,
      _id: job._id?.toString() ?? "",
      userId: job.userId?.toString() ?? "",
      companyId: job.companyId?.toString() ?? "",
    };

    const matched = await JobMatcherClient.matchJobs(
      profile as Record<string, unknown>,
      [serialisedJob],
    );

    if (matched.length > 0 && matched[0]) {
      await this.applicationRepository.updateApplicationScore(
        applicationId,
        matched[0].matchScore,
      );
    }
  }
}
