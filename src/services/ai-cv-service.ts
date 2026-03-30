import type { ObjectId } from "mongodb";
import type { IAiCvService } from "../interfaces/ai-cv/i-ai-cv-service";
import type { IAiCvRepository } from "../interfaces/ai-cv/i-ai-cv-repository";
import type { IUserRepository } from "../interfaces/user/i-user-repository";
import type { AiCv, AiCvSection, AiCvFormat } from "../models/ai-cv";
import { BaseService } from "./base/base-service";
import { CollectionsManager } from "../models/base/collection-manager";
import { ResponseHelper } from "../utils/response-helper";
import { HuggingFaceClient } from "../utils/huggingface-client";
import { CvPdfRenderer } from "../utils/cv-pdf-renderer";
import type { Education } from "../models/education";
import type { Experience } from "../models/experience";
import type { Skill } from "../models/skill";
import type { Project } from "../models/project";

export class AiCvService extends BaseService<AiCv> implements IAiCvService {
  constructor(
    private aiCvRepository: IAiCvRepository,
    private userRepository: IUserRepository,
  ) {
    super(CollectionsManager.aiCvCollection);
  }

  async generateCv(
    userId: ObjectId,
    language: string = "fr",
    section: AiCvSection = "full",
    format: AiCvFormat = "standard",
    customPrompt?: string,
  ): Promise<Response> {
    try {
      const user = await this.userRepository.findById(userId, 0);
      if (!user) {
        return ResponseHelper.notFound("Utilisateur non trouvé");
      }

      const profileData = await this.gatherUserProfile(userId);
      const prompt = this.buildGenerationPrompt(
        profileData,
        language,
        section,
        format,
        customPrompt,
      );

      const generatedContent = await HuggingFaceClient.generateText(
        prompt,
        this.mapFormatToPromptKey(format),
      );

      const aiCv: AiCv = {
        userId,
        title: this.generateTitle(section, language),
        content: generatedContent,
        section,
        format,
        status: "generated",
        language,
        promptUsed: customPrompt,
        version: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await this.aiCvRepository.create(aiCv);

      return ResponseHelper.success(aiCv);
    } catch (err) {
      console.error("AI CV generation error:", err);
      return ResponseHelper.serverError(
        `Erreur lors de la génération du CV: ${String(err)}`,
      );
    }
  }

  async reformulateCv(
    userId: ObjectId,
    aiCvId: ObjectId,
    instructions?: string,
  ): Promise<Response> {
    try {
      const existingCv = await this.aiCvRepository.getById(aiCvId, userId);
      if (!existingCv) {
        return ResponseHelper.notFound("CV non trouvé");
      }

      const prompt = this.buildReformulationPrompt(
        existingCv.content,
        existingCv.language,
        instructions,
      );

      const reformulatedContent = await HuggingFaceClient.generateText(prompt);

      const newCv: AiCv = {
        userId,
        title: `${existingCv.title} (v${existingCv.version + 1})`,
        content: reformulatedContent,
        section: existingCv.section,
        format: existingCv.format,
        status: "reformulated",
        language: existingCv.language,
        promptUsed: instructions,
        version: existingCv.version + 1,
        parentId: existingCv._id,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await this.aiCvRepository.create(newCv);

      return ResponseHelper.success(newCv);
    } catch (err) {
      console.error("AI CV reformulation error:", err);
      return ResponseHelper.serverError(
        `Erreur lors de la reformulation: ${String(err)}`,
      );
    }
  }

  async getUserCvs(userId: ObjectId): Promise<Response> {
    try {
      const cvs = await this.aiCvRepository.getByUserId(userId);
      return ResponseHelper.success(cvs);
    } catch (err) {
      return ResponseHelper.serverError(String(err));
    }
  }

  async deleteCv(userId: ObjectId, cvId: ObjectId): Promise<Response> {
    try {
      const deleted = await this.aiCvRepository.deleteById(cvId, userId);
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
      const cv = await this.aiCvRepository.getById(cvId, userId);
      if (!cv) {
        return ResponseHelper.notFound("CV non trouvé");
      }

      // Get user's photo URL if available
      let photoUrl = "";
      try {
        const user = await this.userRepository.findById(userId, 0);
        if (user?.image) {
          photoUrl = user.image;
        }
      } catch {
        // Photo not critical, continue without it
      }

      const pdfBuffer = await CvPdfRenderer.renderPdf(
        cv.content,
        cv.format,
        photoUrl,
      );

      // DEBUG: Log the AI CV content
      console.log("=== AI CV DEBUG ===");
      console.log("Format:", cv.format);
      console.log("Content length:", cv.content?.length);
      console.log("Content:\n", cv.content?.substring(0, 500));
      console.log("=== END DEBUG ===");

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
      console.error("PDF download error:", err);
      return ResponseHelper.serverError(
        `Erreur lors de la génération du PDF: ${String(err)}`,
      );
    }
  }

  // ---- Private helpers ----

  private async gatherUserProfile(userId: ObjectId): Promise<{
    user: Record<string, unknown>;
    educations: Education[];
    experiences: Experience[];
    skills: Skill[];
    projects: Project[];
  }> {
    const [user, educations, experiences, skills, projects] = await Promise.all(
      [
        CollectionsManager.userCollection.findOne(
          { _id: userId },
          { projection: { password: 0 } },
        ),
        CollectionsManager.educationCollection.find({ userId }).toArray(),
        CollectionsManager.experienceCollection.find({ userId }).toArray(),
        CollectionsManager.skillCollection.find({ userId }).toArray(),
        CollectionsManager.projectCollection.find({ userId }).toArray(),
      ],
    );

    return {
      user: (user as Record<string, unknown>) || {},
      educations,
      experiences,
      skills,
      projects,
    };
  }

  private buildGenerationPrompt(
    profile: {
      user: Record<string, unknown>;
      educations: Education[];
      experiences: Experience[];
      skills: Skill[];
      projects: Project[];
    },
    language: string,
    section: AiCvSection,
    format: AiCvFormat = "standard",
    customPrompt?: string,
  ): string {
    const lang = language === "fr" ? "français" : "English";
    const user = profile.user;

    let profileSummary = `
Informations personnelles:
- Nom: ${user.firstName || ""} ${user.lastName || ""}
- Titre professionnel: ${user.professionalTitle || "Non spécifié"}
- Bio: ${user.bio || ""}
- Ville: ${user.city || ""}
- Email: ${user.email || ""}
- Téléphone: ${user.phone || ""}
- Site web: ${user.website || ""}
`;

    if (profile.educations.length > 0) {
      profileSummary += "\nFormation:\n";
      for (const edu of profile.educations) {
        profileSummary += `- ${edu.degree} à ${edu.school} (${edu.startDate ? new Date(edu.startDate).getFullYear() : "?"} - ${edu.endDate ? new Date(edu.endDate).getFullYear() : "En cours"})${edu.description ? ": " + edu.description : ""}\n`;
      }
    }

    if (profile.experiences.length > 0) {
      profileSummary += "\nExpérience professionnelle:\n";
      for (const exp of profile.experiences) {
        profileSummary += `- ${exp.post} chez ${exp.entreprise}, ${exp.place} (${exp.startDate ? new Date(exp.startDate).getFullYear() : "?"} - ${exp.currentPost ? "Présent" : exp.endDate ? new Date(exp.endDate).getFullYear() : "?"})`;
        if (exp.description)
          profileSummary += `\n  Description: ${exp.description}`;
        if (exp.KeyAchievements) {
          const achievements = Array.isArray(exp.KeyAchievements)
            ? exp.KeyAchievements
            : [String(exp.KeyAchievements)];
          if (achievements.length > 0)
            profileSummary += `\n  Réalisations: ${achievements.join(", ")}`;
        }
        profileSummary += "\n";
      }
    }

    if (profile.skills.length > 0) {
      profileSummary += "\nCompétences:\n";
      const grouped = new Map<string, string[]>();
      for (const skill of profile.skills) {
        const cat = skill.categorie || "Autre";
        if (!grouped.has(cat)) grouped.set(cat, []);
        grouped
          .get(cat)!
          .push(`${skill.name}${skill.level ? ` (${skill.level})` : ""}`);
      }
      for (const [cat, names] of grouped) {
        profileSummary += `- ${cat}: ${names.join(", ")}\n`;
      }
    }

    if (profile.projects.length > 0) {
      profileSummary += "\nProjets:\n";
      for (const proj of profile.projects) {
        profileSummary += `- ${proj.title} (${proj.category || ""}): ${proj.description || ""}`;
        if (proj.technologies?.length > 0)
          profileSummary += ` | Technologies: ${proj.technologies.join(", ")}`;
        profileSummary += "\n";
      }
    }

    let sectionInstruction = "";
    switch (section) {
      case "summary":
        sectionInstruction =
          "Génère uniquement un résumé professionnel / profil personnel percutant.";
        break;
      case "experience":
        sectionInstruction =
          "Génère uniquement la section Expérience Professionnelle, bien formatée avec des bullet points.";
        break;
      case "education":
        sectionInstruction =
          "Génère uniquement la section Formation / Éducation.";
        break;
      case "skills":
        sectionInstruction =
          "Génère uniquement la section Compétences, organisée par catégorie.";
        break;
      case "projects":
        sectionInstruction =
          "Génère uniquement la section Projets avec descriptions impactantes.";
        break;
      default:
        sectionInstruction =
          "Génère un CV complet et professionnel avec toutes les sections: Résumé, Expérience, Formation, Compétences, Projets.";
    }

    let formatInstruction = "";
    switch (format) {
      case "canadian":
        formatInstruction = `\nFormat: Style CV Canadien
- Ne PAS inclure de photo, âge, statut marital ou nationalité
- Commencer par un résumé professionnel ciblé (Professional Summary)
- Mettre les compétences clés en puces avant l'expérience
- Format chronologique inversé
- Inclure des réalisations quantifiées avec chiffres
- Style sobre et factuel, pas de design graphique`;
        break;
      case "latex":
        formatInstruction = `\nFormat: Style LaTeX académique
- Utiliser une mise en page structurée façon LaTeX (titres en gras, séparateurs)
- Sections clairement délimitées avec lignes horizontales
- Police à chasse fixe pour les titres de section
- Format compact et dense, maximiser l'information par page
- Utiliser des puces alignées et des dates à droite`;
        break;
      case "modern":
        formatInstruction = `\nFormat: Style Moderne
- Design épuré avec sections bien espacées
- Résumé professionnel percutant en introduction
- Barres de compétences ou niveaux (ex: Avancé, Intermédiaire, Expert)
- Sections bien structurées avec titres en gras
- Mots-clés en gras pour l'optimisation ATS`;
        break;
      case "european":
        formatInstruction = `\nFormat: CV Européen avec photo (style Tunisie/Maghreb)
- Mise en page deux colonnes: sidebar à gauche avec photo, contact, compétences
- Corps principal à droite avec expérience, formation, projets
- Barres de progression pour les compétences et langues
- Section centres d'intérêt en sidebar
- Design moderne et coloré avec sidebar foncée`;
        break;
      default:
        formatInstruction = "";
    }

    return `Tu es un expert en rédaction de CV professionnels. ${sectionInstruction}
${formatInstruction}

Langue de rédaction: ${lang}

Voici le profil de la personne:
${profileSummary}

${customPrompt ? `Instructions supplémentaires: ${customPrompt}` : ""}

Règles:
- Utilise un ton professionnel et impactant
- Mets en avant les compétences clés et réalisations
- Utilise des verbes d'action
- Sois concis mais complet
- Formate le résultat en Markdown propre
- Ne mentionne pas que c'est généré par IA`;
  }

  private buildReformulationPrompt(
    existingContent: string,
    language: string,
    instructions?: string,
  ): string {
    const lang = language === "fr" ? "français" : "English";

    return `Tu es un expert en rédaction de CV professionnels. Reformule et améliore le CV suivant en ${lang}.

CV actuel:
${existingContent}

${instructions ? `Instructions de reformulation: ${instructions}` : "Améliore le style, rends le plus professionnel et impactant."}

Règles:
- Garde toutes les informations factuelles
- Améliore le style et la formulation
- Utilise des verbes d'action plus percutants
- Optimise pour les systèmes ATS (Applicant Tracking Systems)
- Formate en Markdown propre
- Ne mentionne pas que c'est généré par IA`;
  }

  private generateTitle(section: AiCvSection, language: string): string {
    const titles: Record<AiCvSection, Record<string, string>> = {
      full: { fr: "CV Complet", en: "Full Resume" },
      summary: { fr: "Résumé Professionnel", en: "Professional Summary" },
      experience: {
        fr: "Expérience Professionnelle",
        en: "Work Experience",
      },
      education: { fr: "Formation", en: "Education" },
      skills: { fr: "Compétences", en: "Skills" },
      projects: { fr: "Projets", en: "Projects" },
    };
    const lang = language === "fr" ? "fr" : "en";
    return titles[section]?.[lang] || "CV Généré par IA";
  }

  private mapFormatToPromptKey(format: AiCvFormat): string {
    switch (format) {
      case "canadian":
        return "canadian";
      case "latex":
        return "latex";
      case "modern":
        return "modern";
      case "european":
        return "european";
      case "standard":
      default:
        return "standard";
    }
  }
}
