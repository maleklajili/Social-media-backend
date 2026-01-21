// Configuration centralisée pour les récompenses en coins
export const COINS_CONFIG = {
  // Récompenses d'ajout
  ADD_EXPERIENCE: 10,
  ADD_EDUCATION: 10,
  ADD_LANGUAGE: 10,
  ADD_SKILL: 10,
  ADD_PROJECT: 10,
  ADD_COMPANY: 50,
  ADD_JOB: 1,
  CREATE_POST: 1,
  ADD_COMMENT: 1,

  // Pénalités de suppression (peuvent être différentes)
  REMOVE_EXPERIENCE: 10,
  REMOVE_EDUCATION: 10,
  REMOVE_LANGUAGE: 10,
  REMOVE_SKILL: 10,
  REMOVE_PROJECT: 10,
  REMOVE_COMPANY: 50,
  REMOVE_JOB: 1,
  DELETE_POST: 1,
  DELETE_COMMENT: 1,
} as const;

export type CoinAction = keyof typeof COINS_CONFIG;
