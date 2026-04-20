import { authMiddleware } from "../middleware/aut-middleware";
import { CollectionsManager } from "../models/base/collection-manager";
import { Get } from "../routes/router-manager";
import type { ServerRequest } from "../config/interfaces/i-request";
import type { User } from "../models/user";
import { BaseController } from "./base/base-controller";
import { BaseService } from "../services/base/base-service";
import { ResponseHelper } from "../utils/response-helper";

interface DashboardStats {
  users: {
    totalUsers: number;
    activeUsers: number;
    newUsersThisMonth: number;
  };
  posts: {
    totalPosts: number;
    publishedPosts: number;
    flaggedPosts: number;
  };
  communities: {
    totalCommunities: number;
    activeCommunities: number;
  };
  jobs: {
    totalJobs: number;
    openJobs: number;
  };
  companies: {
    totalCompanies: number;
    verifiedCompanies: number;
  };
  transactions: {
    totalTransactions: number;
  };
}

class AdminController extends BaseController<User, BaseService<User>> {
  protected createService(): BaseService<User> {
    return new BaseService(CollectionsManager.userCollection);
  }

  constructor() {
    super("/admin");
    this.initializeService(this.createService());
  }

  protected initializeCollection() {
    return CollectionsManager.userCollection;
  }
  /**
   * GET /admin/stats
   * Get comprehensive dashboard statistics
   */
  @Get("/stats", [authMiddleware])
  async getDashboardStats(req: ServerRequest): Promise<Response> {
    try {
      const userId = req.user?._id;

      // Check if user is admin
      const user = await this.collection.findOne({ _id: userId });
      if (!(user as User)?.isAdmin) {
        return ResponseHelper.error(
          "Access denied. Admin privileges required.",
          403,
        );
      }

      // Get counts for each collection
      const userCollection = CollectionsManager.userCollection;
      const postCollection = CollectionsManager.postCollection;
      const communityCollection = CollectionsManager.communityCollection;
      const jobCollection = CollectionsManager.jobCollection;
      const companyCollection = CollectionsManager.companyCollection;
      const transactionCollection = CollectionsManager.transactionCollection;

      const [
        totalUsers,
        activeUsers,
        totalPosts,
        publishedPosts,
        flaggedPosts,
        totalCommunities,
        activeCommunities,
        totalJobs,
        openJobs,
        totalCompanies,
        verifiedCompanies,
        totalTransactions,
      ] = await Promise.all([
        userCollection.countDocuments({}),
        // NOTE: Users don't have isActive field, so count by followers/following activity
        // For now, count users with at least 1 follower as "active"
        userCollection.countDocuments({ followerCount: { $gt: 0 } }),
        postCollection.countDocuments({}),
        // Posts don't have status field, count posts with votes/engagement as "published"
        postCollection.countDocuments({ votes: { $gt: 0 } }),
        // No flagged posts tracking yet
        /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
        postCollection.countDocuments({ flagged: true } as any),
        communityCollection.countDocuments({}),
        // Communities don't have isActive, count with members as active

        communityCollection.countDocuments({
          memberIds: { $exists: true, $not: { $size: 0 } },
          /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
        } as any),
        jobCollection.countDocuments({}),
        // Count jobs with status "active" or "open"

        jobCollection.countDocuments({
          status: { $in: ["active", "open"] },
          /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
        } as any),
        companyCollection.countDocuments({}),
        // Count verified companies
        companyCollection.countDocuments({ verificationStatus: "verified" }),
        transactionCollection.countDocuments({}),
      ]);

      // Calculate new users this month
      const currentMonth = new Date();
      currentMonth.setDate(1);
      currentMonth.setHours(0, 0, 0, 0);

      const newUsersThisMonth = await userCollection.countDocuments({
        createdAt: { $gte: currentMonth },
      });

      const stats: DashboardStats = {
        users: {
          totalUsers,
          activeUsers,
          newUsersThisMonth,
        },
        posts: {
          totalPosts,
          publishedPosts,
          flaggedPosts,
        },
        communities: {
          totalCommunities,
          activeCommunities,
        },
        jobs: {
          totalJobs,
          openJobs,
        },
        companies: {
          totalCompanies,
          verifiedCompanies,
        },
        transactions: {
          totalTransactions,
        },
      };

      return ResponseHelper.success(stats);
    } catch (err) {
      return ResponseHelper.serverError(String(err));
    }
  }

  /**
   * GET /admin/activity
   * Get activity data for charts (users, posts, companies)
   */
  @Get("/activity", [authMiddleware])
  async getActivityData(req: ServerRequest): Promise<Response> {
    try {
      const userId = req.user?._id;

      // Check if user is admin
      const user = await this.collection.findOne({ _id: userId });
      if (!(user as User)?.isAdmin) {
        return ResponseHelper.error(
          "Access denied. Admin privileges required.",
          403,
        );
      }

      const userCollection = CollectionsManager.userCollection;
      const postCollection = CollectionsManager.postCollection;
      const companyCollection = CollectionsManager.companyCollection;
      const transactionCollection = CollectionsManager.transactionCollection;

      // Get activity for last 7 days
      const days = 7;
      const activityData = [];

      for (let i = days - 1; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        date.setHours(0, 0, 0, 0);

        const nextDate = new Date(date);
        nextDate.setDate(nextDate.getDate() + 1);

        // Correct destructuring: users, posts, companies, revenueData
        const [users, posts, companies, revenueData] = await Promise.all([
          userCollection.countDocuments({
            createdAt: { $gte: date, $lt: nextDate },
          }),
          postCollection.countDocuments({
            createdAt: { $gte: date, $lt: nextDate },
          }),
          companyCollection.countDocuments({
            createdAt: { $gte: date, $lt: nextDate },
          }),
          transactionCollection
            .aggregate([
              {
                $match: {
                  createdAt: { $gte: date, $lt: nextDate },
                  type: "earned",
                },
              },
              {
                $group: {
                  _id: null,
                  total: { $sum: "$amount" },
                },
              },
            ])
            .toArray(),
        ]);

        const dayName = date.toLocaleDateString("fr-FR", { weekday: "short" });

        activityData.push({
          date: dayName,
          users,
          posts,
          companies,
          revenue: revenueData?.length > 0 ? (revenueData[0]?.total ?? 0) : 0,
        });
      }

      return ResponseHelper.success(activityData);
    } catch (err) {
      return ResponseHelper.serverError(String(err));
    }
  }

  /**
   * GET /admin/coins-stats
   * Get aggregated coin transaction statistics
   * Optimized: Uses aggregation pipeline instead of fetching all records
   */
  @Get("/coins-stats", [authMiddleware])
  async getCoinStats(req: ServerRequest): Promise<Response> {
    try {
      const userId = req.user?._id;

      // Check if user is admin
      const user = await this.collection.findOne({ _id: userId });
      if (!(user as User)?.isAdmin) {
        return ResponseHelper.error(
          "Access denied. Admin privileges required.",
          403,
        );
      }

      const transactionCollection = CollectionsManager.transactionCollection;

      // Use aggregation to get stats in single query
      const stats = await transactionCollection
        .aggregate([
          {
            $facet: {
              summary: [
                {
                  $group: {
                    _id: null,
                    totalTransactions: { $sum: 1 },
                    totalCoinsEarned: {
                      $sum: {
                        $cond: [{ $eq: ["$type", "earned"] }, "$amount", 0],
                      },
                    },
                    totalCoinsSpent: {
                      $sum: {
                        $cond: [{ $eq: ["$type", "spent"] }, "$amount", 0],
                      },
                    },
                    totalPenalties: {
                      $sum: {
                        $cond: [
                          {
                            $or: [
                              { $eq: ["$type", "penalty"] },
                              { $in: ["$metadata.type", ["penalty"]] },
                            ],
                          },
                          "$amount",
                          0,
                        ],
                      },
                    },
                  },
                },
              ],
            },
          },
        ])
        .toArray();

      const result = stats[0]?.summary?.[0] ?? {
        totalTransactions: 0,
        totalCoinsEarned: 0,
        totalCoinsSpent: 0,
        totalPenalties: 0,
      };

      return ResponseHelper.success(result);
    } catch (err) {
      return ResponseHelper.serverError(String(err));
    }
  }

  /**
   * GET /admin/coins-transactions
   * Get coin transactions with user details joined
   * Optimized: Uses aggregation to join with users collection
   */
  @Get("/coins-transactions", [authMiddleware])
  async getCoinTransactions(req: ServerRequest): Promise<Response> {
    try {
      const userId = req.user?._id;

      // Check if user is admin
      const user = await this.collection.findOne({ _id: userId });
      if (!(user as User)?.isAdmin) {
        return ResponseHelper.error(
          "Access denied. Admin privileges required.",
          403,
        );
      }

      const page = parseInt(req.query?.page as string) || 1;
      const limit = parseInt(req.query?.limit as string) || 20;
      const search = req.query?.search as string;
      const type = req.query?.type as string;

      const transactionCollection = CollectionsManager.transactionCollection;

      // Build match pipeline
      /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
      const matchStage: Record<string, any> = {};
      if (type && type !== "all") {
        matchStage.type =
          type === "earned" || type === "bonus" ? "earned" : "spent";
      }
      if (search?.trim()) {
        matchStage.$text = { $search: search.trim() };
      }

      const skip = (page - 1) * limit;

      const result = await transactionCollection
        .aggregate([
          { $match: Object.keys(matchStage).length > 0 ? matchStage : {} },
          {
            $lookup: {
              from: "users",
              localField: "userId",
              foreignField: "_id",
              as: "user",
            },
          },
          {
            $addFields: {
              userName: {
                $concat: [
                  { $arrayElemAt: ["$user.firstName", 0] },
                  " ",
                  { $arrayElemAt: ["$user.lastName", 0] },
                ],
              },
            },
          },
          {
            $facet: {
              metadata: [
                { $count: "total" },
                {
                  $addFields: {
                    page,
                    limit,
                  },
                },
              ],
              data: [
                { $skip: skip },
                { $limit: limit },
                {
                  $project: {
                    _id: 1,
                    userId: 1,
                    userName: 1,
                    amount: 1,
                    type: 1,
                    description: 1,
                    createdAt: 1,
                    metadata: 1,
                  },
                },
              ],
            },
          },
        ])
        .toArray();

      const metadata = result[0]?.metadata?.[0] ?? { total: 0, page, limit };
      const data = result[0]?.data ?? [];

      return ResponseHelper.success({
        transactions: data,
        total: metadata.total,
        page,
        limit,
        totalPages: Math.ceil(metadata.total / limit),
      });
    } catch (err) {
      return ResponseHelper.serverError(String(err));
    }
  }
}

export default AdminController;
