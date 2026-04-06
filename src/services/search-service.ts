import { SearchRepository } from "../repositories/search-repository";
import { ResponseHelper } from "../utils/response-helper";
import type { SearchResult } from "../models/search/search-result";
import type { ISearchService } from "../interfaces/search/i-search-service";
import type { User } from "../models/user";
import { spellCheckService } from "./spell-check.service";

export class SearchService implements ISearchService {
  constructor(private searchRepository: SearchRepository) {}

  async unifiedSearch(
    query: string,
    options?: {
      limit?: number;
      type?: "community" | "user" | "post";
    },
  ): Promise<Response> {
    try {
      if (!query || query.trim().length < 2) {
        return ResponseHelper.error(
          "Search query must be at least 2 characters",
        );
      }
      const spellCheckResult = await spellCheckService.correctQuery(query);
      const searchQuery = query;
      if (spellCheckResult.hasErrors) {
        console.log(`🔍 Original query: "${query}"`);
        console.log(`✅ Corrected query: "${spellCheckResult.corrected}"`);
      }

      const limit = options?.limit || 20;
      const type = options?.type;
      const results: SearchResult[] = [];

      // Search Communities (if no type filter or type is community)
      if (!type || type === "community") {
        const communities = await this.searchRepository.searchCommunities(
          query,
          limit,
        );
        for (const community of communities) {
          if (community._id) {
            results.push({
              _id: community._id,
              type: "community",
              title: community.title,
              description: community.description,
              thumbnail: community.banner
                ? `/uploads/communities/${community.name}/${community.banner}`
                : null,
              url: `/community/${community._id}`,
              createdAt: community.createdAt || new Date(),
              relevanceScore: this.calculateRelevance(
                searchQuery,
                community.name,
                community.title,
                community.description,
              ),
            });
          }
        }
      }

      // Search Users (if no type filter or type is user)
      if (!type || type === "user") {
        const users = await this.searchRepository.searchUsers(
          searchQuery,
          limit,
        );
        for (const user of users) {
          if (user._id) {
            const fullName =
              `${user.firstName || ""} ${user.lastName || ""}`.trim();

            // Try different possible property names for user avatar
            const userImage = (user as User).cover || (user as User).image;

            results.push({
              _id: user._id,
              type: "user",
              title: user.userName || fullName || user.email,
              description: fullName || user.email || "Utilisateur",
              thumbnail: userImage
                ? `/uploads/images-${user._id}/${userImage}`
                : null,
              url: `/profile/${user._id}`,
              createdAt: user.createdAt || new Date(),
              relevanceScore: this.calculateRelevance(
                searchQuery,
                user.userName,
                user.firstName,
                user.lastName,
                user.email,
              ),
            });
          }
        }
      }

      // Search Posts (if no type filter or type is post)
      if (!type || type === "post") {
        const posts = await this.searchRepository.searchPosts(
          searchQuery,
          limit,
        );
        for (const post of posts) {
          if (post._id) {
            // Try different possible property names for post image
            const postImage =
              //eslint-disable-next-line @typescript-eslint/no-explicit-any
              (post as any).image ||
              //eslint-disable-next-line @typescript-eslint/no-explicit-any
              (post as any).media ||
              //eslint-disable-next-line @typescript-eslint/no-explicit-any
              (post as any).photo ||
              //eslint-disable-next-line @typescript-eslint/no-explicit-any
              (post as any).thumbnail;

            results.push({
              _id: post._id,
              type: "post",
              title: post.title || "Post",
              description: post.content ? post.content.substring(0, 150) : "",
              thumbnail: postImage || null,
              url: `/post/${post._id}`,
              createdAt: post.createdAt || new Date(),
              relevanceScore: this.calculateRelevance(
                searchQuery,
                post.title,
                post.content,
              ),
            });
          }
        }
      }

      // Sort by relevance score (higher score first)
      results.sort((a, b) => (b.relevanceScore || 0) - (a.relevanceScore || 0));

      const limitedResults = results.slice(0, limit);

      return ResponseHelper.success({
        results: limitedResults,
        total: limitedResults.length,
        query: searchQuery,
        originalQuery: query,
        didYouMean: spellCheckResult.hasErrors
          ? spellCheckResult.corrected
          : undefined,
        corrections: spellCheckResult.corrections,
      });
    } catch (err) {
      console.error("❌ Error in unified search:", err);
      return ResponseHelper.serverError(String(err));
    }
  }

  private calculateRelevance(
    query: string,
    ...fields: (string | undefined)[]
  ): number {
    const searchTerms = query.toLowerCase().split(" ");
    let score = 0;

    for (const field of fields) {
      if (!field) continue;
      const lowerField = field.toLowerCase();

      for (const term of searchTerms) {
        if (lowerField === term) {
          score += 10;
        } else if (lowerField.startsWith(term)) {
          score += 5;
        } else if (lowerField.includes(term)) {
          score += 2;
        }
      }
    }

    return score;
  }
}
