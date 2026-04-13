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
import type { Language } from "../models/skills/language";
import type { Certification } from "../models/certifications";
import type { ManualCv } from "../models/manual-cv";
import type { TechnicalSkill } from "../models/skills/technical-skill";
import type { PersonalSkill } from "../models/skills/personal-skill";

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

  async downloadPdf(
    userId: ObjectId,
    cvId: ObjectId,
    primaryColor?: string,
    accentColor?: string,
    fontFamily?: string,
    formatOverride?: string,
    lang?: string,
  ): Promise<Response> {
    try {
      const cv = await this.aiCvRepository.getById(cvId, userId);
      if (!cv) {
        return ResponseHelper.notFound("CV non trouvé");
      }

      // Get user's photo URL and name if available
      let photoUrl = "";
      let userName = "";
      let userTitle = "";
      let userEmail = "";
      let userPhone = "";
      let userAddress = "";
      let userWebsite = "";
      try {
        const user = await this.userRepository.findById(userId, 0);
        if (user?.image) {
          photoUrl = user.image;
        }
        const u = user as unknown as Record<string, unknown>;
        const first = (u?.firstName as string) || "";
        const last = (u?.lastName as string) || "";
        userName = `${first} ${last}`.trim();
        userTitle = (u?.professionalTitle as string) || "";
        userEmail = (u?.email as string) || "";
        userPhone = (u?.phone as string) || "";
        const city = (u?.city as string) || "";
        const country = (u?.location as string) || "";
        userAddress = [city, country].filter(Boolean).join(", ");
        userWebsite = (u?.website as string) || "";
      } catch {
        // User info not critical, continue without it
      }

      const pdfBuffer = await CvPdfRenderer.renderPdf(
        cv.content,
        formatOverride || cv.format,
        photoUrl,
        userName,
        userTitle,
        userId.toString(),
        primaryColor,
        accentColor,
        userEmail,
        userPhone,
        userAddress,
        userWebsite,
        fontFamily,
        lang,
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
    languages: Language[];
    certifications: Certification[];
    technicalSkills: TechnicalSkill[];
    personalSkills: PersonalSkill[];
    manualCv?: ManualCv;
  }> {
    const [
      user,
      educations,
      experiences,
      skills,
      projects,
      languages,
      certifications,
      technicalSkills,
      personalSkills,
      manualCv,
    ] = await Promise.all([
      CollectionsManager.userCollection.findOne(
        { _id: userId },
        { projection: { password: 0 } },
      ),
      CollectionsManager.educationCollection.find({ userId }).toArray(),
      CollectionsManager.experienceCollection.find({ userId }).toArray(),
      CollectionsManager.skillCollection.find({ userId }).toArray(),
      CollectionsManager.projectCollection.find({ userId }).toArray(),
      CollectionsManager.languageCollection.find({ userId }).toArray(),
      CollectionsManager.certificationCollection.find({ userId }).toArray(),
      CollectionsManager.technicalSkillCollection.find({ userId }).toArray(),
      CollectionsManager.personalSkillCollection.find({ userId }).toArray(),
      CollectionsManager.manualCvCollection
        .find({ userId })
        .sort({ updatedAt: -1 })
        .limit(1)
        .toArray()
        .then((docs) => docs[0] || null),
    ]);

    return {
      user: (user as Record<string, unknown>) || {},
      educations,
      experiences,
      skills,
      projects,
      languages,
      certifications,
      technicalSkills,
      personalSkills,
      manualCv: manualCv || undefined,
    };
  }

  private buildGenerationPrompt(
    profile: {
      user: Record<string, unknown>;
      educations: Education[];
      experiences: Experience[];
      skills: Skill[];
      projects: Project[];
      languages: Language[];
      certifications: Certification[];
      technicalSkills: TechnicalSkill[];
      personalSkills: PersonalSkill[];
      manualCv?: ManualCv;
    },
    language: string,
    section: AiCvSection,
    format: AiCvFormat = "standard",
    customPrompt?: string,
  ): string {
    const lang = language === "fr" ? "français" : "English";
    const user = profile.user;
    const mcv = profile.manualCv;

    // Use manual CV personal info when available, fallback to profile
    const fullName =
      mcv?.personalInfo?.fullName ||
      `${user.firstName || ""} ${user.lastName || ""}`.trim();
    const proTitle =
      mcv?.personalInfo?.professionalTitle ||
      (user.professionalTitle as string) ||
      "Non spécifié";
    const bio = mcv?.personalInfo?.summary || (user.bio as string) || "";
    const address = mcv?.personalInfo?.address || (user.adress as string) || "";
    const city = mcv?.personalInfo?.city || (user.city as string) || "";
    const country =
      mcv?.personalInfo?.country || (user.location as string) || "";
    const email = mcv?.personalInfo?.email || (user.email as string) || "";
    const phone = mcv?.personalInfo?.phone || (user.phone as string) || "";
    const website =
      mcv?.personalInfo?.website || (user.website as string) || "";

    let profileSummary = `
Informations personnelles:
- Nom: ${fullName}
- Titre professionnel: ${proTitle}
- Bio: ${bio}
- Adresse: ${address}
- Ville: ${city}
- Pays: ${country}
- Email: ${email}
- Téléphone: ${phone}
- Site web: ${website}
${(user.professionalStatus as string) ? `- Statut professionnel: ${user.professionalStatus}` : ""}
${(user.currentDomain as string) ? `- Domaine actuel: ${user.currentDomain}` : ""}
${(user.previousDomain as string) ? `- Domaine précédent: ${user.previousDomain}` : ""}
${(user.professionalCategory as string) ? `- Catégorie professionnelle: ${user.professionalCategory}` : ""}
${(user.keywords as string) ? `- Mots-clés profil: ${user.keywords}` : ""}
`;

    // Merge educations: manual CV + profile (deduplicated)
    const manualEducations = mcv?.educations || [];
    const profileEducations = profile.educations;
    if (manualEducations.length > 0 || profileEducations.length > 0) {
      profileSummary += "\nFormation:\n";
      const seenEdu = new Set<string>();
      for (const edu of manualEducations) {
        const key = `${edu.school}:${edu.degree}`.toLowerCase();
        seenEdu.add(key);
        profileSummary += `- ${edu.degree} à ${edu.school} (${edu.startDate || "?"} - ${edu.current ? "En cours" : edu.endDate || "?"})`;
        if (edu.description)
          profileSummary += `\n  Description: ${edu.description}`;
        profileSummary += "\n";
      }
      for (const edu of profileEducations) {
        const key = `${edu.school}:${edu.degree}`.toLowerCase();
        if (seenEdu.has(key)) continue;
        profileSummary += `- ${edu.degree} à ${edu.school}`;
        if (edu.location) profileSummary += `, ${edu.location}`;
        profileSummary += ` (${edu.startDate ? new Date(edu.startDate).getFullYear() : "?"} - ${edu.endDate ? new Date(edu.endDate).getFullYear() : "En cours"})`;
        if (edu.type) profileSummary += `\n  Type: ${edu.type}`;
        if (edu.grade) profileSummary += `\n  Mention/Note: ${edu.grade}`;
        if (edu.level) profileSummary += `\n  Niveau: ${edu.level}`;
        if (edu.description)
          profileSummary += `\n  Description: ${edu.description}`;
        if (edu.tags && edu.tags.length > 0)
          profileSummary += `\n  Tags: ${edu.tags.join(", ")}`;
        profileSummary += "\n";
      }
    }

    // Merge experiences: manual CV + profile (deduplicated)
    const manualExperiences = mcv?.experiences || [];
    const profileExperiences = profile.experiences;
    if (manualExperiences.length > 0 || profileExperiences.length > 0) {
      profileSummary += "\nExpérience professionnelle:\n";
      const seenExp = new Set<string>();
      for (const exp of manualExperiences) {
        const key = `${exp.company}:${exp.jobTitle}`.toLowerCase();
        seenExp.add(key);
        profileSummary += `- ${exp.jobTitle} chez ${exp.company} (${exp.startDate || "?"} - ${exp.current ? "Présent" : exp.endDate || "?"})`;
        if (exp.description)
          profileSummary += `\n  Description: ${exp.description}`;
        profileSummary += "\n";
      }
      for (const exp of profileExperiences) {
        const key = `${exp.entreprise}:${exp.post}`.toLowerCase();
        if (seenExp.has(key)) continue;
        profileSummary += `- ${exp.post} chez ${exp.entreprise}`;
        if (exp.place) profileSummary += `, ${exp.place}`;
        profileSummary += ` (${exp.startDate ? new Date(exp.startDate).getFullYear() : "?"} - ${exp.currentPost ? "Présent" : exp.endDate ? new Date(exp.endDate).getFullYear() : "?"})`;
        if (exp.description)
          profileSummary += `\n  Description: ${exp.description}`;
        if (exp.KeyAchievements) {
          const achievements = Array.isArray(exp.KeyAchievements)
            ? exp.KeyAchievements
            : [String(exp.KeyAchievements)];
          if (achievements.length > 0)
            profileSummary += `\n  Réalisations clés: ${achievements.join(" | ")}`;
        }
        if (exp.skills) {
          const skillsStr = Array.isArray(exp.skills)
            ? (exp.skills as string[]).join(", ")
            : String(exp.skills);
          if (skillsStr.trim())
            profileSummary += `\n  Compétences mobilisées: ${skillsStr}`;
        }
        profileSummary += "\n";
      }
    }

    // Merge skills: manual CV + profile (deduplicated)
    const manualSkills = mcv?.skills || [];
    if (manualSkills.length > 0 || profile.skills.length > 0) {
      profileSummary += "\nCompétences:\n";
      const seenSkills = new Set<string>();
      for (const skill of manualSkills) {
        seenSkills.add(skill.name.toLowerCase());
        profileSummary += `- ${skill.name}${skill.level ? ` (${skill.level})` : ""}\n`;
      }
      // Add profile skills not in manual CV
      const grouped = new Map<string, string[]>();
      for (const skill of profile.skills) {
        if (seenSkills.has(skill.name.toLowerCase())) continue;
        const cat = skill.categorie || "Autre";
        let entry = skill.name;
        if (skill.level) entry += ` (${skill.level})`;
        if (skill.description) entry += ` — ${skill.description}`;
        if (skill.sousCategorie) entry += ` [${skill.sousCategorie}]`;
        if (!grouped.has(cat)) grouped.set(cat, []);
        grouped.get(cat)!.push(entry);
      }
      for (const [cat, names] of grouped) {
        profileSummary += `- ${cat}: ${names.join(", ")}\n`;
      }
    }

    // Merge projects: manual CV + profile (deduplicated)
    const manualProjects = mcv?.projects || [];
    if (manualProjects.length > 0 || profile.projects.length > 0) {
      profileSummary += "\nProjets:\n";
      const seenProj = new Set<string>();
      for (const proj of manualProjects) {
        seenProj.add(proj.name.toLowerCase());
        profileSummary += `- ${proj.name}: ${proj.description || ""}`;
        if (proj.link) profileSummary += ` | Lien: ${proj.link}`;
        profileSummary += "\n";
      }
      for (const proj of profile.projects) {
        if (seenProj.has((proj.title || "").toLowerCase())) continue;
        profileSummary += `- ${proj.title}`;
        if (proj.category) profileSummary += ` (${proj.category})`;
        if (proj.projectType) profileSummary += ` [${proj.projectType}]`;
        if (proj.startDate || proj.endDate) {
          const start = proj.startDate
            ? new Date(proj.startDate).getFullYear()
            : "?";
          const end = proj.current
            ? "En cours"
            : proj.endDate
              ? new Date(proj.endDate).getFullYear()
              : "?";
          profileSummary += ` — ${start} à ${end}`;
        }
        if (proj.description)
          profileSummary += `\n  Description: ${proj.description}`;
        if (proj.technologies?.length > 0)
          profileSummary += `\n  Technologies: ${proj.technologies.join(", ")}`;
        if (proj.liveUrl) profileSummary += `\n  URL: ${proj.liveUrl}`;
        if (proj.githubUrl) profileSummary += `\n  GitHub: ${proj.githubUrl}`;
        profileSummary += "\n";
      }
    }

    // Merge languages: manual CV + profile (deduplicated)
    const manualLanguages = mcv?.languages || [];
    if (manualLanguages.length > 0 || profile.languages.length > 0) {
      profileSummary += "\nLangues:\n";
      const seenLangs = new Set<string>();
      for (const l of manualLanguages) {
        seenLangs.add(l.name.toLowerCase());
        profileSummary += `- ${l.name}\n`;
      }
      for (const l of profile.languages) {
        if (seenLangs.has(l.name.toLowerCase())) continue;
        profileSummary += `- ${l.name}`;
        if (l.level) profileSummary += ` — Niveau: ${l.level}`;
        if (l.fluency) profileSummary += `, Aisance: ${l.fluency}`;
        if (l.proficiency) profileSummary += ` (${l.proficiency}%)`;
        const details: string[] = [];
        if (l.reading) details.push(`Lecture: ${l.reading}%`);
        if (l.writing) details.push(`Écriture: ${l.writing}%`);
        if (l.speaking) details.push(`Oral: ${l.speaking}%`);
        if (l.listening) details.push(`Écoute: ${l.listening}%`);
        if (details.length > 0) profileSummary += `\n  ${details.join(", ")}`;
        profileSummary += "\n";
      }
    }

    // Merge certifications: manual CV + profile (deduplicated)
    const manualCerts = mcv?.certifications || [];
    if (manualCerts.length > 0 || profile.certifications.length > 0) {
      profileSummary += "\nCertifications:\n";
      const seenCerts = new Set<string>();
      for (const cert of manualCerts) {
        seenCerts.add(cert.name.toLowerCase());
        profileSummary += `- ${cert.name}`;
        if (cert.organization) profileSummary += ` — ${cert.organization}`;
        if (cert.date) profileSummary += ` (${cert.date})`;
        profileSummary += "\n";
      }
      for (const cert of profile.certifications) {
        if (seenCerts.has(cert.name.toLowerCase())) continue;
        profileSummary += `- ${cert.name}`;
        if (cert.type) profileSummary += ` (${cert.type})`;
        if (cert.file) profileSummary += ` — Fichier: ${cert.file}`;
        profileSummary += "\n";
      }
    }

    // Add technical skills from profile
    if (profile.technicalSkills.length > 0) {
      profileSummary += "\nCompétences techniques:\n";
      const groupedTech = new Map<string, string[]>();
      for (const ts of profile.technicalSkills) {
        const cat = ts.category || "Autre";
        let entry = ts.name;
        if (ts.level) entry += ` (${ts.level}%)`;
        if (ts.description) entry += ` — ${ts.description}`;
        if (ts.subcategory) entry += ` [${ts.subcategory}]`;
        if (ts.yearsOfExperience)
          entry += `, ${ts.yearsOfExperience} ans d'exp.`;
        if (ts.certified) entry += " ✓ Certifié";
        if (ts.tags && ts.tags.length > 0)
          entry += ` | Tags: ${ts.tags.join(", ")}`;
        if (!groupedTech.has(cat)) groupedTech.set(cat, []);
        groupedTech.get(cat)!.push(entry);
      }
      for (const [cat, entries] of groupedTech) {
        profileSummary += `- ${cat}: ${entries.join("; ")}\n`;
      }
    }

    // Add personal/soft skills from profile
    if (profile.personalSkills.length > 0) {
      profileSummary += "\nCompétences personnelles (Soft Skills):\n";
      for (const ps of profile.personalSkills) {
        profileSummary += `- ${ps.name}`;
        if (ps.category) profileSummary += ` (${ps.category})`;
        if (ps.description) profileSummary += ` — ${ps.description}`;
        if (ps.examples && ps.examples.length > 0)
          profileSummary += `. Exemples: ${ps.examples.join(", ")}`;
        if (ps.strength) profileSummary += " ★ Point fort";
        profileSummary += "\n";
      }
    }

    // Add interests from manual CV
    const manualInterests = mcv?.interests || [];
    if (manualInterests.length > 0) {
      profileSummary += "\nCentres d'intérêt:\n";
      for (const interest of manualInterests) {
        profileSummary += `- ${interest}\n`;
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

IMPORTANT - Structure Markdown obligatoire:
- La PREMIÈRE ligne DOIT être: # ${fullName}
- La deuxième ligne: **${proTitle}**
- La troisième ligne: ${email}${phone ? ` | ${phone}` : ""}${city ? ` | ${city}` : ""}${country ? `, ${country}` : ""}${website ? ` | ${website}` : ""}
- La PREMIÈRE section DOIT être ## Profil contenant un paragraphe de 2-4 phrases décrivant la personne: qui elle est, son domaine d'expertise, ses points forts et son objectif professionnel. Utilise la bio et le titre professionnel pour rédiger ce paragraphe.
- Ensuite les sections avec ## (Expérience, Formation, Compétences, etc.)

Voici le profil de la personne:
${profileSummary}

${customPrompt ? `Instructions supplémentaires: ${customPrompt}` : ""}

Règles STRICTES:
- La PREMIÈRE ligne doit être # ${fullName} (NE PAS mettre # Résumé ou # CV)
- Utilise UNIQUEMENT les informations fournies dans le profil ci-dessus
- N'invente AUCUNE donnée, expérience, compétence ou formation qui n'est pas dans le profil
- NE JAMAIS ajouter de compétences, technologies, langages ou outils non mentionnés dans le profil
- NE JAMAIS inventer de descriptions, réalisations ou détails qui ne sont pas fournis
- Si une section est vide dans le profil, ne la génère pas du tout
- Les bullet points sous chaque expérience doivent reprendre UNIQUEMENT la description et les réalisations fournies
- Les compétences doivent rester sous forme de liste simple: - NomCompétence (Niveau). Ne PAS écrire de phrases ou paragraphes pour les compétences.
- Les langues doivent être listées avec leur niveau de maîtrise: - NomLangue — Niveau (ex: - Français — Natif, - Anglais — Courant B2, - Arabe — Langue maternelle). Inclure le niveau si disponible dans le profil.
- Reformule les descriptions existantes de manière professionnelle, sans ajouter d'informations
- Utilise un ton professionnel et impactant
- Utilise des verbes d'action
- Sois concis mais complet
- Formate le résultat en Markdown propre: # pour le nom (PREMIÈRE LIGNE), ## pour les sections
- Ne mentionne pas que c'est généré par IA
- Ne génère pas de liens fictifs ou d'URLs inventées`;
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
