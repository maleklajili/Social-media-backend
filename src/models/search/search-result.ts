import { ObjectId } from "mongodb";

export interface SearchResult {
  _id: ObjectId;
  type: "community" | "user" | "post";
  title: string;
  description?: string;
  thumbnail?: string | null;
  url: string;
  createdAt: Date;
  relevanceScore?: number;
}

export interface SearchResponse {
  results: SearchResult[];
  total: number;
  query: string;
}
