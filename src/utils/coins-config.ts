// Configuration centralisée pour les récompenses en coins
export const COINS_CONFIG = {
  // Récompenses d'ajout
  ADD_EXPERIENCE: 10,
  ADD_EDUCATION: 10,
  ADD_LANGUAGE: 10,
  ADD_SKILL: 10,
  ADD_PROJECT: 10,

  // Pénalités de suppression (peuvent être différentes)
  REMOVE_EXPERIENCE: 10,
  REMOVE_EDUCATION: 10,
  REMOVE_LANGUAGE: 10,
  REMOVE_SKILL: 10,
  REMOVE_PROJECT: 10,
} as const;

export type CoinAction = keyof typeof COINS_CONFIG;
