export interface ISearchService {
  unifiedSearch(
    query: string,
    options?: {
      limit?: number;
    },
  ): Promise<Response>;
}
