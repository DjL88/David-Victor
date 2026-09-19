import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';
import { BFFError } from '../errors';

export function validateBody<T>(schema: ZodSchema<T>) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        const fieldErrors: Record<string, string[]> = {};
        for (const issue of err.issues) {
          const path = issue.path.join('.') || 'body';
          if (!fieldErrors[path]) fieldErrors[path] = [];
          fieldErrors[path].push(issue.message);
        }

        const bffErr = new BFFError(
          'VALIDATION_ERROR',
          `Validation failed: ${err.issues.map((i) => `${i.path.join('.') || 'body'}: ${i.message}`).join(', ')}`,
          400,
          false,
          { fieldErrors }
        );

        const requestId = (req.headers['x-request-id'] as string) || (req as any).requestId;
        return res.status(400).json(bffErr.toPayload(requestId));
      }
      next(err);
    }
  };
}
