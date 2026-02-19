import { ObjectId } from "mongodb";

export type RepoWithFindByIds<T> = {
  findByIds(ids: ObjectId[]): Promise<T[]>;
};

/**
 * Generic reference population utility.
 * - items: array of docs that contain an id field
 * - repo: repository with findByIds(ObjectId[])
 * - idField: the field on each item that contains the id to populate (default: 'userId')
 * - replaceField: where to store the populated object (defaults to idField)
 * - fields: list of fields to keep from the populated object (defaults to common public fields)
 * - idToDbId: optional mapper to convert raw id to an ObjectId for querying
 */
export async function populateReferences<
  //eslint-disable-next-line @typescript-eslint/no-explicit-any
  Doc extends Record<string, any>,
  //eslint-disable-next-line @typescript-eslint/no-explicit-any
  Ref extends Record<string, any>,
>(
  items: Doc[],
  repo: RepoWithFindByIds<Ref>,
  idField = "userId",
  replaceField?: string,
  fields: string[] = ["_id", "firstName", "lastName", "image"],
  //eslint-disable-next-line @typescript-eslint/no-explicit-any
  idToDbId?: (raw: any) => ObjectId | undefined,
): Promise<Doc[]> {
  if (!items || items.length === 0) return items;
  const fieldToReplace = replaceField || idField;

  const idMap: Record<string, ObjectId> = {};

  items.forEach((it) => {
    //eslint-disable-next-line @typescript-eslint/no-explicit-any
    const raw = (it as any)[idField];
    if (!raw) return;
    try {
      let dbId: ObjectId | undefined;
      if (idToDbId) {
        dbId = idToDbId(raw);
      } else if (typeof raw === "object" && raw && raw.toString) {
        dbId = raw as ObjectId;
      } else if (typeof raw === "string") {
        try {
          dbId = new ObjectId(raw);
        } catch (e) {
          console.log(e);
          dbId = undefined;
        }
      }

      if (dbId) idMap[dbId.toString()] = dbId;
    } catch (e) {
      console.log(e);
      // ignore
    }
  });

  const uniqueIds = Object.values(idMap);
  if (uniqueIds.length === 0) return items;

  const refs = await repo.findByIds(uniqueIds);
  //eslint-disable-next-line @typescript-eslint/no-explicit-any
  const refMap: Record<string, any> = {};
  //eslint-disable-next-line @typescript-eslint/no-explicit-any
  refs.forEach((r: any) => {
    if (r && r._id) {
      const key = r._id.toString();
      //eslint-disable-next-line @typescript-eslint/no-explicit-any
      const reduced: Record<string, any> = {};
      reduced._id = r._id;
      fields.forEach((f) => {
        if (f === "_id") return;
        if (r[f] !== undefined) reduced[f] = r[f];
      });
      refMap[key] = reduced;
    }
  });

  items.forEach((it) => {
    //eslint-disable-next-line @typescript-eslint/no-explicit-any
    const raw = (it as any)[idField];
    if (!raw) return;
    const key = raw && raw.toString ? raw.toString() : String(raw);
    if (refMap[key]) {
      //eslint-disable-next-line @typescript-eslint/no-explicit-any
      (it as any)[fieldToReplace] = refMap[key];
    }
  });

  return items;
}

export default populateReferences;
