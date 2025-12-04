import type {
  Collection,
  Document,
  Filter,
  ObjectId,
  OptionalUnlessRequiredId,
  WithId,
} from "mongodb";
import type { BaseModel } from "../../models/base/base-model";
export interface LookupConfig {
  from: string; // Target collection name
  localField: string; // Field in the current collection
  foreignField: string; // Field in the target collection
  as: string; // Output field name
  unwind?: boolean; // Optional: Unwind joined array
  select?: string[];
}

export class BaseService<T extends BaseModel> {
  protected collection: Collection<T>;

  constructor(collection: Collection<T>) {
    this.collection = collection;
  }

  async getAll(
    skip?: number,
    limit?: number,
    lookups?: LookupConfig[],
    filter: Filter<T> = {},
  ): Promise<WithId<T>[]> {
    const pipeline: Document[] = [
      { $match: filter }, // Ajoutez le filtre au début du pipeline
    ];

    if (lookups) {
      for (const lookup of lookups) {
        pipeline.push({
          $lookup: {
            from: lookup.from,
            localField: lookup.localField,
            foreignField: lookup.foreignField,
            as: lookup.as,
          },
        });

        if (lookup.unwind) {
          pipeline.push({
            $unwind: {
              path: `$${lookup.as}`,
              preserveNullAndEmptyArrays: true,
            },
          });
        }

        if (lookup.select) {
          pipeline.push({
            $addFields: {
              [lookup.as]: {
                $map: {
                  input: `$${lookup.as}`,
                  as: "item",
                  in: lookup.select.reduce(
                    (acc, field) => {
                      acc[field] = `$$item.${field}`;
                      return acc;
                    },
                    {} as Record<string, unknown>,
                  ),
                },
              },
            },
          });
        }
      }
    }

    if (typeof skip === "number") pipeline.push({ $skip: skip });
    if (typeof limit === "number") pipeline.push({ $limit: limit });

    return this.collection.aggregate(pipeline).toArray() as Promise<
      WithId<T>[]
    >;
  }

  async countAll(filter: Filter<T> = {}): Promise<number> {
    return this.collection.countDocuments(filter);
  }

  async create(
    data: OptionalUnlessRequiredId<T>,
  ): Promise<{ insertedId: ObjectId; data: OptionalUnlessRequiredId<T> }> {
    const result = await this.collection.insertOne(data);
    if (!result.insertedId) {
      throw new Error("Failed to insert document: insertedId is undefined");
    }
    return { insertedId: result.insertedId, data };
  }

  async getById(_id: ObjectId): Promise<WithId<T> | null> {
    const filter: Filter<T> = { _id } as Filter<T>;
    return this.collection.findOne(filter);
  }

  async deleteAll(): Promise<void> {
    await this.collection.deleteMany();
  }

  async deleteById(_id: ObjectId): Promise<void> {
    const filter: Filter<T> = { _id } as Filter<T>;
    await this.collection.deleteOne(filter);
  }
}
