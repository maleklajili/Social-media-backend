// src/interfaces/user/i-user-profile.ts
export interface IUserProfileResponse {
  name: string;
  title: string;
  bio: string;
  email: string;
  phone: string;
  location: string;
  website: string;
  skills: string[];
  languages: Array<{
    name: string;
    level: string;
  }>;
  experiences: Array<{
    id: number;
    title: string;
    company: string;
    location: string;
    startDate: string;
    endDate: string | null;
    description: string;
    skills: string[];
    current: boolean;
  }>;
  education: Array<{
    id: number;
    degree: string;
    school: string;
    location: string;
    startDate: string;
    endDate: string;
    description: string;
    current: boolean;
  }>;
  projects: Array<{
    id: number;
    title: string;
    description: string;
    startDate: string;
    endDate: string | null;
    technologies: string[];
    image: string;
    liveUrl: string;
    githubUrl: string;
    current: boolean;
  }>;
}
