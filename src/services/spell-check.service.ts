import nspell from "nspell";
import enDictionary from "dictionary-en";
import frDictionary from "dictionary-fr";

export interface SpellCheckResult {
  original: string;
  corrected: string;
  hasErrors: boolean;
  detectedLanguage: "en" | "fr" | "unknown";
  corrections: Array<{
    original: string;
    corrected: string;
    position: number;
    suggestions: string[];
  }>;
}

class SpellCheckService {
  //eslint-disable-next-line @typescript-eslint/no-explicit-any
  private englishSpell: any = null;
  //eslint-disable-next-line @typescript-eslint/no-explicit-any
  private frenchSpell: any = null;
  private initialized = false;

  constructor() {
    this.init();
  }

  async init() {
    try {
      // Load dictionaries using the package directly (not promisify)
      const enData = await this.loadDictionary(enDictionary);
      this.englishSpell = nspell(enData);

      const frData = await this.loadDictionary(frDictionary);
      this.frenchSpell = nspell(frData);

      this.initialized = true;
      console.log("✅ Spell check service initialized (EN/FR)");
    } catch (error) {
      console.error("Failed to initialize spell check:", error);
    }
  }
  //eslint-disable-next-line @typescript-eslint/no-explicit-any
  private async loadDictionary(dictModule: any): Promise<any> {
    // Handle both ESM and CommonJS imports
    if (typeof dictModule === "function") {
      return new Promise((resolve, reject) => {
        //eslint-disable-next-line @typescript-eslint/no-explicit-any
        dictModule((err: any, data: any) => {
          if (err) reject(err);
          else resolve(data);
        });
      });
    }

    // If it's already a buffer or object
    if (dictModule && typeof dictModule === "object") {
      return dictModule;
    }

    throw new Error("Unable to load dictionary");
  }

  detectLanguage(text: string): "en" | "fr" | "unknown" {
    const words = text.toLowerCase().split(/\s+/);
    let frenchScore = 0;
    let englishScore = 0;

    const frenchWords = new Set([
      "le",
      "la",
      "les",
      "un",
      "une",
      "des",
      "du",
      "de",
      "et",
      "ou",
      "est",
      "sont",
      "était",
      "étaient",
      "pour",
      "dans",
      "avec",
      "sans",
      "je",
      "tu",
      "il",
      "elle",
      "nous",
      "vous",
      "ils",
      "elles",
      "ce",
      "cette",
      "ces",
      "cet",
      "au",
      "aux",
      "en",
      "y",
      "on",
    ]);

    const englishWords = new Set([
      "the",
      "a",
      "an",
      "and",
      "or",
      "but",
      "so",
      "for",
      "nor",
      "yet",
      "is",
      "are",
      "was",
      "were",
      "be",
      "been",
      "being",
      "to",
      "of",
      "in",
      "for",
      "on",
      "with",
      "without",
      "by",
      "at",
      "from",
      "up",
    ]);

    for (const word of words) {
      if (frenchWords.has(word)) frenchScore += 2;
      if (englishWords.has(word)) englishScore += 2;
      if (/[éèêëàâôûïîç]/i.test(word)) frenchScore += 3;
    }

    if (frenchScore > englishScore && frenchScore > 0) return "fr";
    if (englishScore > frenchScore && englishScore > 0) return "en";
    return "unknown";
  }

  private correctWord(
    word: string,
    language: "en" | "fr",
  ): {
    corrected: string;
    suggestions: string[];
    hasError: boolean;
  } {
    const spell = language === "en" ? this.englishSpell : this.frenchSpell;

    if (!spell || !word || word.length < 3) {
      return { corrected: word || "", suggestions: [], hasError: false };
    }

    try {
      if (spell.correct(word)) {
        return { corrected: word, suggestions: [], hasError: false };
      }

      const suggestions = spell.suggest(word);
      const corrected =
        suggestions && suggestions.length > 0 ? suggestions[0] : word;

      return {
        corrected,
        suggestions: suggestions ? suggestions.slice(0, 5) : [],
        hasError: true,
      };
    } catch {
      return { corrected: word, suggestions: [], hasError: false };
    }
  }

  async correctQuery(query: string): Promise<SpellCheckResult> {
    if (!this.initialized) {
      await this.init();
    }

    if (!query || typeof query !== "string" || query.trim().length < 3) {
      return {
        original: query || "",
        corrected: query || "",
        hasErrors: false,
        detectedLanguage: "unknown",
        corrections: [],
      };
    }

    const detectedLanguage = this.detectLanguage(query);
    const language = detectedLanguage !== "unknown" ? detectedLanguage : "en";

    const words = query.split(/\s+/).filter((w) => w && w.length > 0);
    const corrections: SpellCheckResult["corrections"] = [];
    const correctedWords: string[] = [];
    let hasErrors = false;
    let currentPosition = 0;

    for (let i = 0; i < words.length; i++) {
      const word = words[i];
      if (!word) continue;

      const { corrected, suggestions, hasError } = this.correctWord(
        word,
        language,
      );

      if (hasError && corrected !== word) {
        hasErrors = true;
        corrections.push({
          original: word,
          corrected: corrected,
          position: currentPosition,
          suggestions: suggestions,
        });
        correctedWords.push(corrected);
      } else {
        correctedWords.push(word);
      }

      currentPosition += word.length + 1;
    }

    const corrected = correctedWords.join(" ");

    return {
      original: query,
      corrected: corrected,
      hasErrors,
      detectedLanguage,
      corrections,
    };
  }

  async getDidYouMean(query: string): Promise<string | null> {
    if (!query || typeof query !== "string") return null;
    const result = await this.correctQuery(query);
    return result.hasErrors && result.corrected !== result.original
      ? result.corrected
      : null;
  }
}

export const spellCheckService = new SpellCheckService();
