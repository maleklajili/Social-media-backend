export interface ISearchService {
  unifiedSearch(
    query: string,
    options?: {
      limit?: number;
      type?: "community" | "user" | "post";
    },
  ): Promise<Response>;
}
