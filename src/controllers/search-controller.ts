import { Get } from "../routes/router-manager";
import { authMiddleware } from "../middleware/aut-middleware";
import { ResponseHelper } from "../utils/response-helper";
import { SearchService } from "../services/search-service";
import { SearchRepository } from "../repositories/search-repository";
import type { ServerRequest } from "../config/interfaces/i-request";

export class SearchController {
  private searchService: SearchService;

  constructor() {
    this.searchService = new SearchService(new SearchRepository());
    console.log(
      "✅ SearchController initialized - GET /search (requires auth)",
    );
  }

  @Get("/search", [authMiddleware])
  async unifiedSearch(req: ServerRequest): Promise<Response> {
    try {
      const query = req.query?.q as string;

      if (!query) {
        return ResponseHelper.error("Search query is required");
      }

      if (query.trim().length < 2) {
        return ResponseHelper.error(
          "Search query must be at least 2 characters",
        );
      }

      const limit = req.query?.limit ? parseInt(req.query.limit as string) : 20;

      const type = req.query?.type as "community" | "user" | "post" | undefined;

      if (limit < 1 || limit > 100) {
        return ResponseHelper.error("Limit must be between 1 and 100");
      }

      const result = await this.searchService.unifiedSearch(query, {
        limit,
        type,
      });
      return result;
    } catch (err) {
      console.error("❌ Error in search controller:", err);
      return ResponseHelper.serverError(String(err));
    }
  }

  @Get("/search/communities", [authMiddleware])
  async searchCommunities(req: ServerRequest): Promise<Response> {
    try {
      const query = req.query?.q as string;

      if (!query) {
        return ResponseHelper.error("Search query is required");
      }

      if (query.trim().length < 2) {
        return ResponseHelper.error(
          "Search query must be at least 2 characters",
        );
      }

      const limit = req.query?.limit ? parseInt(req.query.limit as string) : 20;

      const result = await this.searchService.unifiedSearch(query, {
        limit,
        type: "community",
      });
      return result;
    } catch (err) {
      console.error("❌ Error in search communities:", err);
      return ResponseHelper.serverError(String(err));
    }
  }

  @Get("/search/users", [authMiddleware])
  async searchUsers(req: ServerRequest): Promise<Response> {
    try {
      const query = req.query?.q as string;

      if (!query) {
        return ResponseHelper.error("Search query is required");
      }

      if (query.trim().length < 2) {
        return ResponseHelper.error(
          "Search query must be at least 2 characters",
        );
      }

      const limit = req.query?.limit ? parseInt(req.query.limit as string) : 20;

      const result = await this.searchService.unifiedSearch(query, {
        limit,
        type: "user",
      });
      return result;
    } catch (err) {
      console.error("❌ Error in search users:", err);
      return ResponseHelper.serverError(String(err));
    }
  }

  @Get("/search/posts", [authMiddleware])
  async searchPosts(req: ServerRequest): Promise<Response> {
    try {
      const query = req.query?.q as string;

      if (!query) {
        return ResponseHelper.error("Search query is required");
      }

      if (query.trim().length < 2) {
        return ResponseHelper.error(
          "Search query must be at least 2 characters",
        );
      }

      const limit = req.query?.limit ? parseInt(req.query.limit as string) : 20;

      const result = await this.searchService.unifiedSearch(query, {
        limit,
        type: "post",
      });
      return result;
    } catch (err) {
      console.error("❌ Error in search posts:", err);
      return ResponseHelper.serverError(String(err));
    }
  }
}
