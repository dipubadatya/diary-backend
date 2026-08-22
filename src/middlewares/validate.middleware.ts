import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';

/**
 * Express middleware that validates incoming request data against a Zod schema.
 * 
 * On failure, returns a 400 Bad Request with:
 * {
 *   "success": false,
 *   "message": "Validation failed",
 *   "errors": { "fieldName": "Human-readable message" }
 * }
 * 
 * On success, overwrites req.body, req.params, and req.query with the sanitized/parsed values.
 */
export const validate = (schema: z.ZodObject<any>) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const dataToValidate: Record<string, any> = {};

      if (schema.shape.body) {
        dataToValidate.body = req.body;
      }
      if (schema.shape.params) {
        dataToValidate.params = req.params;
      }
      if (schema.shape.query) {
        dataToValidate.query = req.query;
      }

      const result = await schema.safeParseAsync(dataToValidate);

      if (!result.success) {
        const errors: Record<string, string> = {};

        for (const issue of result.error.issues) {
          const path = issue.path;
          if (path.length > 1) {
            // strip the top-level 'body'/'params'/'query' key
            const fieldName = path.slice(1).join('.');
            errors[fieldName] = issue.message;
          } else {
            const fieldName = path[0]?.toString() || 'general';
            errors[fieldName] = issue.message;
          }
        }

        const firstErrorKey = Object.keys(errors)[0];
        const firstErrorMessage = firstErrorKey ? errors[firstErrorKey] : 'Validation failed';

        res.status(400).json({
          success: false,
          message: 'Validation failed',
          error: firstErrorMessage,
          errors
        });
        return;
      }

      // Overwrite request objects with validated and parsed data
      if (schema.shape.body) {
        req.body = result.data.body;
      }
      if (schema.shape.params) {
        req.params = result.data.params as any;
      }
      if (schema.shape.query) {
        req.query = result.data.query as any;
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};
