import type { BaseUser } from "./base-user";

export interface ProfessionalUser extends BaseUser {
  website: string;
  ProfessionalStatus: string; // enum
  categorie: string; // enum
  availability: string; //enum
  cv: string;
}
