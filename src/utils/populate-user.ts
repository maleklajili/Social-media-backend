import type { ObjectId } from "mongodb";
import type { IUserRepository } from "../interfaces/user/i-user-repository";

/**
 * Populate user objects into an array of documents by replacing an id field (default: `userId`).
 *
 * - items: array of objects that contain a user id field (ObjectId) or string representation
 * - repo: an instance implementing IUserRepository with findByIds
 * - idField: field on each item that stores the user's id (default: 'userId')
 * - replaceField: field to replace with the user object (default: same as idField)
 *
 * The function mutates the provided items array and also returns it for convenience.
 */
//eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function populateUsers<T extends Record<string, any>>(
  items: T[],
  repo: IUserRepository,
  idField = "userId",
  replaceField?: string,
  // fields to include from the user object when populating (defaults to public profile)
  fields: string[] = ["_id", "firstName", "lastName", "image"],
): Promise<T[]> {
  if (!items || items.length === 0) return items;
  const fieldToReplace = replaceField || idField;

  // Collect ids and keep original ObjectId references when possible
  const idMap: Record<string, ObjectId> = {};
  items.forEach((it) => {
    //eslint-disable-next-line @typescript-eslint/no-explicit-any
    const raw = (it as any)[idField];
    if (!raw) return;
    try {
      const key = raw && raw.toString ? raw.toString() : String(raw);
      // prefer storing the original raw object (likely ObjectId)
      if (!idMap[key] && typeof raw === "object") {
        idMap[key] = raw as ObjectId;
      } else if (!idMap[key]) {
        // raw may be string form of ObjectId; leave mapping to string for now
        // We won't create new ObjectId instances here to avoid coupling.
        // findByIds implementation accepts ObjectId[]; we'll try to reuse ObjectId raw when present.
      }
    } catch (e) {
      console.log(e);
      // ignore malformed id
    }
  });

  const uniqueIds = Object.values(idMap);

  if (uniqueIds.length === 0) return items;

  const users = await repo.findByIds(uniqueIds);
  //eslint-disable-next-line @typescript-eslint/no-explicit-any
  const userMap: Record<string, any> = {};
  // Build a map of userId to reduced user object based on requested fields
  //eslint-disable-next-line @typescript-eslint/no-explicit-any
  users.forEach((u: any) => {
    if (u && u._id) {
      const key = u._id.toString();
      //eslint-disable-next-line @typescript-eslint/no-explicit-any
      const reduced: Record<string, any> = {};
      // always include _id
      reduced._id = u._id;
      fields.forEach((f) => {
        if (f === "_id") return; // already added
        if (u[f] !== undefined) reduced[f] = u[f];
      });
      userMap[key] = reduced;
    }
  });

  items.forEach((it) => {
    //eslint-disable-next-line @typescript-eslint/no-explicit-any
    const raw = (it as any)[idField];
    if (!raw) return;
    const key = raw && raw.toString ? raw.toString() : String(raw);
    if (userMap[key]) {
      //eslint-disable-next-line @typescript-eslint/no-explicit-any
      (it as any)[fieldToReplace] = userMap[key];
    }
  });

  return items;
}

export default populateUsers;
