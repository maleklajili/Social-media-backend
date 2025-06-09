import type { Collection, ObjectId, OptionalUnlessRequiredId } from "mongodb";
import type { RequestWithPagination } from "../../config/interfaces/i-pagination";
import type { ServerRequest } from "../../config/interfaces/i-request";
import type {
  ICRUDController,
  IRequestBodyParser,
} from "../../interfaces/base/i-crud-controller";
import { autoPaginateResponse } from "../../middleware/pagination-middleware";
import type { BaseModel } from "../../models/base/base-model";
import { Get, Post } from "../../routes/router-manager";
import type {
  BaseService,
  LookupConfig,
} from "../../services/base/base-service";
import { ResponseHelper } from "../../utils/response-helper";

export abstract class BaseController<
    T extends BaseModel,
    S extends BaseService<T> = BaseService<T>,
  >
  implements ICRUDController, IRequestBodyParser
{
  protected collection: Collection<T>;
  protected service!: S;
  public basePath: string;

  constructor(basePath: string) {
    this.basePath = basePath;
    this.collection = this.initializeCollection();
  }

  protected abstract initializeCollection(): Collection<T>;
  protected abstract createService(): S;

  protected initializeService(service: S) {
    this.service = service;
  }

  @Get("/")
  async getAll(
    req: RequestWithPagination,
    lookups?: LookupConfig[],
  ): Promise<Response> {
    try {
      const pagination = req.pagination;
      const dataPromise = this.service.getAll(
        pagination?.skip,
        pagination?.take,
        lookups,
      );
      const totalCount = this.service.countAll();
      return autoPaginateResponse(req, dataPromise, totalCount);
    } catch (error) {
      return ResponseHelper.serverError(String(error));
    }
  }

  @Post("/")
  async create(req: ServerRequest): Promise<Response> {
    try {
      const body =
        await this.parseRequestBody<OptionalUnlessRequiredId<T>>(req);
      const { insertedId, data } = await this.service.create(body);
      return ResponseHelper.success({ id: insertedId, ...data });
    } catch (error) {
      return ResponseHelper.serverError(String(error));
    }
  }

  async getById(_id: ObjectId): Promise<Response> {
    try {
      const data = await this.service.getById(_id);
      if (!data) {
        return ResponseHelper.notFound("Data not found");
      }
      return ResponseHelper.success(data);
    } catch (error) {
      return ResponseHelper.serverError(String(error));
    }
  }

  async deleteAll(req: ServerRequest): Promise<Response> {
    try {
      await this.service.deleteAll();
      return ResponseHelper.success(
        "Successfully deleted all data from: " + req.url,
      );
    } catch (error) {
      return ResponseHelper.serverError(String(error));
    }
  }

  async parseRequestBody<U>(req: ServerRequest): Promise<U> {
    try {
      const json = await req.json();
      return json as U;
    } catch (error) {
      console.error("Error parsing request body:", error);
      throw new Error("Invalid request body format");
    }
  }

  async parseFormData<U>(formData: FormData): Promise<U> {
    try {
      const result: Record<string, unknown> = {};

      for (const [key, value] of formData.entries()) {
        const path = key
          .replace(/\]/g, "") // remove closing brackets
          .split(/\[|\./); // split by [ or .

        let current: unknown = result;

        for (let i = 0; i < path.length; i++) {
          const part = path[i];
          const isLast = i === path.length - 1;
          const nextIsIndex = /^\d+$/.test(path[i + 1] || "");
          const isArrayIndex = /^\d+$/.test(String(part));

          if (isLast && part) {
            if (Array.isArray(current)) {
              (current as unknown[])[parseInt(part)] = value;
            } else if (isArrayIndex) {
              const index = parseInt(part);
              if (!Array.isArray(current)) current = [];
              (current as unknown[])[index] = value;
            } else {
              const obj = current as Record<string, unknown>;
              if (obj[part] !== undefined) {
                if (!Array.isArray(obj[part])) {
                  obj[part] = [obj[part]];
                }
                (obj[part] as unknown[]).push(value);
              } else {
                obj[part] = value;
              }
            }
          } else {
            if (isArrayIndex) {
              const index = parseInt(String(part));
              if (!Array.isArray(current)) current = [];
              const arr = current as unknown[];
              if (!arr[index]) {
                arr[index] = nextIsIndex ? [] : {};
              }
              current = arr[index];
            } else {
              const obj = current as Record<string, unknown>;
              if (!obj[String(part)]) {
                obj[String(part)] = nextIsIndex ? [] : {};
              }
              current = obj[String(part)];
            }
          }
        }
      }

      return result as U;
    } catch (err) {
      console.error("Error parsing form data:", err);
      throw new Error("Invalid form data format");
    }
  }
}
