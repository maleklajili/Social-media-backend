import type { ObjectId } from "mongodb";
import type { IManualCvService } from "../interfaces/manual-cv/i-manual-cv-service";
import type { IManualCvRepository } from "../interfaces/manual-cv/i-manual-cv-repository";
import type { IUserRepository } from "../interfaces/user/i-user-repository";
import type {
  ManualCv,
  ManualCvFormat,
  ManualCvPersonalInfo,
  ManualCvExperience,
  ManualCvEducation,
  ManualCvSkill,
  ManualCvLanguage,
} from "../models/manual-cv";
import { BaseService } from "./base/base-service";
import { CollectionsManager } from "../models/base/collection-manager";
import { ResponseHelper } from "../utils/response-helper";
import { CvPdfRenderer } from "../utils/cv-pdf-renderer";
import type { Education } from "../models/education";
import type { Experience } from "../models/experience";
import type { Skill } from "../models/skill";

export class ManualCvService
  extends BaseService<ManualCv>
  implements IManualCvService
{
  constructor(
    private manualCvRepository: IManualCvRepository,
    private userRepository: IUserRepository,
  ) {
    super(CollectionsManager.manualCvCollection);
  }

  async createCv(
    userId: ObjectId,
    data: Record<string, unknown>,
  ): Promise<Response> {
    try {
      const cv: ManualCv = {
        userId,
        title: (data.title as string) || "Mon CV",
        format: ((data.format as string) || "standard") as ManualCvFormat,
        language: (data.language as string) || "fr",
        personalInfo: (data.personalInfo as ManualCvPersonalInfo) || {
          fullName: "",
        },
        experiences: (data.experiences as ManualCvExperience[]) || [],
        educations: (data.educations as ManualCvEducation[]) || [],
        skills: (data.skills as ManualCvSkill[]) || [],
        languages: (data.languages as ManualCvLanguage[]) || [],
        projects: (data.projects as string[]) || [],
        certifications: (data.certifications as string[]) || [],
        interests: (data.interests as string[]) || [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await this.manualCvRepository.create(cv);
      return ResponseHelper.success(cv);
    } catch (err) {
      console.error("Manual CV create error:", err);
      return ResponseHelper.serverError(
        `Erreur lors de la création du CV: ${String(err)}`,
      );
    }
  }

  async getUserCvs(userId: ObjectId): Promise<Response> {
    try {
      const cvs = await this.manualCvRepository.getByUserId(userId);
      return ResponseHelper.success(cvs);
    } catch (err) {
      return ResponseHelper.serverError(String(err));
    }
  }

  async getCvById(userId: ObjectId, cvId: ObjectId): Promise<Response> {
    try {
      const cv = await this.manualCvRepository.getById(cvId, userId);
      if (!cv) {
        return ResponseHelper.notFound("CV non trouvé");
      }
      return ResponseHelper.success(cv);
    } catch (err) {
      return ResponseHelper.serverError(String(err));
    }
  }

  async updateCv(
    userId: ObjectId,
    cvId: ObjectId,
    data: Record<string, unknown>,
  ): Promise<Response> {
    try {
      const existing = await this.manualCvRepository.getById(cvId, userId);
      if (!existing) {
        return ResponseHelper.notFound("CV non trouvé");
      }

      const updateData: Partial<ManualCv> = {};
      if (data.title !== undefined) updateData.title = data.title as string;
      if (data.format !== undefined)
        updateData.format = data.format as ManualCvFormat;
      if (data.language !== undefined)
        updateData.language = data.language as string;
      if (data.personalInfo !== undefined)
        updateData.personalInfo = data.personalInfo as ManualCvPersonalInfo;
      if (data.experiences !== undefined)
        updateData.experiences = data.experiences as ManualCvExperience[];
      if (data.educations !== undefined)
        updateData.educations = data.educations as ManualCvEducation[];
      if (data.skills !== undefined)
        updateData.skills = data.skills as ManualCvSkill[];
      if (data.languages !== undefined)
        updateData.languages = data.languages as ManualCvLanguage[];
      if (data.projects !== undefined)
        updateData.projects = data.projects as string[];
      if (data.certifications !== undefined)
        updateData.certifications = data.certifications as string[];
      if (data.interests !== undefined)
        updateData.interests = data.interests as string[];

      const updated = await this.manualCvRepository.update(
        cvId,
        userId,
        updateData,
      );
      if (!updated) {
        return ResponseHelper.serverError("Erreur lors de la mise à jour");
      }

      const updatedCv = await this.manualCvRepository.getById(cvId, userId);
      return ResponseHelper.success(updatedCv);
    } catch (err) {
      console.error("Manual CV update error:", err);
      return ResponseHelper.serverError(
        `Erreur lors de la mise à jour du CV: ${String(err)}`,
      );
    }
  }

  async deleteCv(userId: ObjectId, cvId: ObjectId): Promise<Response> {
    try {
      const deleted = await this.manualCvRepository.deleteById(cvId, userId);
      if (!deleted) {
        return ResponseHelper.notFound("CV non trouvé");
      }
      return ResponseHelper.success("CV supprimé avec succès");
    } catch (err) {
      return ResponseHelper.serverError(String(err));
    }
  }

  async downloadPdf(userId: ObjectId, cvId: ObjectId): Promise<Response> {
    try {
      const cv = await this.manualCvRepository.getById(cvId, userId);
      if (!cv) {
        return ResponseHelper.notFound("CV non trouvé");
      }

      const markdownContent = this.convertToMarkdown(cv);

      // DEBUG: Log the generated markdown
      console.log("=== MANUAL CV DEBUG ===");
      console.log("CV Data:", JSON.stringify(cv.personalInfo, null, 2));
      console.log("Markdown:\n", markdownContent);
      console.log("=== END DEBUG ===");

      let photoUrl = "";
      try {
        const user = await this.userRepository.findById(userId, 0);
        if (user?.image) {
          photoUrl = user.image;
        }
      } catch {
        // Photo not critical
      }

      const pdfBuffer = await CvPdfRenderer.renderPdf(
        markdownContent,
        cv.format,
        photoUrl,
      );

      const filename = `${cv.title.replace(/[^a-zA-Z0-9\u00C0-\u024F\s-]/g, "").trim()}.pdf`;

      return new Response(pdfBuffer, {
        status: 200,
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${encodeURIComponent(filename)}"`,
          "Content-Length": String(pdfBuffer.length),
        },
      });
    } catch (err) {
      console.error("Manual CV PDF error:", err);
      return ResponseHelper.serverError(
        `Erreur lors de la génération du PDF: ${String(err)}`,
      );
    }
  }

  async importFromProfile(
    userId: ObjectId,
    format: ManualCvFormat = "standard",
    language: string = "fr",
  ): Promise<Response> {
    try {
      const [user, educations, experiences, skills] = await Promise.all([
        CollectionsManager.userCollection.findOne(
          { _id: userId },
          { projection: { password: 0 } },
        ),
        CollectionsManager.educationCollection.find({ userId }).toArray(),
        CollectionsManager.experienceCollection.find({ userId }).toArray(),
        CollectionsManager.skillCollection.find({ userId }).toArray(),
      ]);

      if (!user) {
        return ResponseHelper.notFound("Utilisateur non trouvé");
      }

      const personalInfo: ManualCvPersonalInfo = {
        fullName: `${user.firstName || ""} ${user.lastName || ""}`.trim(),
        professionalTitle: (user as Record<string, unknown>)
          .professionalTitle as string | undefined,
        email: user.email,
        phone: (user as Record<string, unknown>).phone as string | undefined,
        city: (user as Record<string, unknown>).city as string | undefined,
        website: (user as Record<string, unknown>).website as
          | string
          | undefined,
        summary: (user as Record<string, unknown>).bio as string | undefined,
      };

      const cvExperiences: ManualCvExperience[] = experiences.map(
        (exp: Experience) => ({
          jobTitle: exp.title || "",
          company: exp.company || "",
          startDate: exp.startDate
            ? new Date(exp.startDate).toISOString().split("T")[0]
            : "",
          endDate: exp.endDate
            ? new Date(exp.endDate).toISOString().split("T")[0]
            : undefined,
          current: !exp.endDate,
          description: exp.description || "",
        }),
      );

      const cvEducations: ManualCvEducation[] = educations.map(
        (edu: Education) => ({
          degree: edu.degree || "",
          school: edu.school || "",
          startDate: edu.startDate
            ? new Date(edu.startDate).toISOString().split("T")[0]
            : "",
          endDate: edu.endDate
            ? new Date(edu.endDate).toISOString().split("T")[0]
            : undefined,
          current: !edu.endDate,
          description: edu.description || "",
        }),
      );

      const cvSkills: ManualCvSkill[] = skills.map((skill: Skill) => ({
        name: skill.name || "",
        level: skill.level || undefined,
      }));

      const cv: ManualCv = {
        userId,
        title: `CV de ${personalInfo.fullName}`,
        format,
        language,
        personalInfo,
        experiences: cvExperiences,
        educations: cvEducations,
        skills: cvSkills,
        languages: [],
        projects: [],
        certifications: [],
        interests: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await this.manualCvRepository.create(cv);
      return ResponseHelper.success(cv);
    } catch (err) {
      console.error("Import from profile error:", err);
      return ResponseHelper.serverError(
        `Erreur lors de l'import du profil: ${String(err)}`,
      );
    }
  }

  private convertToMarkdown(cv: ManualCv): string {
    const lines: string[] = [];
    const info = cv.personalInfo;

    lines.push(`# ${info.fullName}`);
    if (info.professionalTitle) lines.push(`**${info.professionalTitle}**`);

    const contactParts: string[] = [];
    if (info.email) contactParts.push(info.email);
    if (info.phone) contactParts.push(info.phone);
    if (info.city) contactParts.push(info.city);
    if (info.website) contactParts.push(info.website);
    if (contactParts.length > 0) lines.push(contactParts.join(" | "));

    if (info.summary) {
      lines.push("", "## Profil", info.summary);
    }

    if (cv.experiences.length > 0) {
      lines.push("", "## Expérience professionnelle");
      for (const exp of cv.experiences) {
        const period = exp.current
          ? `${exp.startDate} - Présent`
          : `${exp.startDate} - ${exp.endDate || ""}`;
        lines.push(`### ${exp.jobTitle}`);
        lines.push(`**${exp.company}** | ${period}`);
        if (exp.description) lines.push("", exp.description);
        lines.push("");
      }
    }

    if (cv.educations.length > 0) {
      lines.push("", "## Formation");
      for (const edu of cv.educations) {
        const period = edu.current
          ? `${edu.startDate} - Présent`
          : `${edu.startDate} - ${edu.endDate || ""}`;
        lines.push(`### ${edu.degree}`);
        lines.push(`**${edu.school}** | ${period}`);
        if (edu.description) lines.push("", edu.description);
        lines.push("");
      }
    }

    if (cv.skills.length > 0) {
      lines.push("", "## Compétences");
      for (const skill of cv.skills) {
        lines.push(`- ${skill.name}${skill.level ? ` (${skill.level})` : ""}`);
      }
    }

    if (cv.languages.length > 0) {
      lines.push("", "## Langues");
      for (const lang of cv.languages) {
        lines.push(`- ${lang.name}${lang.level ? ` (${lang.level})` : ""}`);
      }
    }

    if (cv.projects.length > 0) {
      lines.push("", "## Projets");
      for (const project of cv.projects) {
        lines.push(`- ${project}`);
      }
    }

    if (cv.certifications.length > 0) {
      lines.push("", "## Certifications");
      for (const cert of cv.certifications) {
        lines.push(`- ${cert}`);
      }
    }

    if (cv.interests.length > 0) {
      lines.push("", "## Centres d'intérêt");
      for (const interest of cv.interests) {
        lines.push(`- ${interest}`);
      }
    }

    return lines.join("\n");
  }
}
