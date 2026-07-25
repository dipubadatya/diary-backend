import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';

const storyValidationSchema = Joi.object({
  title: Joi.string().required().messages({
    'string.empty': 'Title is required',
    'any.required': 'Title is required',
  }),
  story: Joi.string().required().messages({
    'string.empty': 'Story content is required',
    'any.required': 'Story content is required',
  }),
  category: Joi.string()
    .valid(
      'fantasy',
      'random-thoughts',
      'poetry',
      'letter',
      'mystery',
      'adventure',
      'historical',
      'fiction',
      'other'
    )
    .required()
    .messages({
      'any.only': 'Invalid category selected',
      'any.required': 'Category is required',
    }),
});

export const validateStory = (req: Request, res: Response, next: NextFunction): void => {
  const { error } = storyValidationSchema.validate(req.body, { abortEarly: false, allowUnknown: true });
  if (error) {
    const errorMessages = error.details.map((detail) => detail.message);
    res.status(400).json({ error: errorMessages.join(', ') });
    return;
  }
  next();
};

export const validateStoryUpdate = (req: Request, res: Response, next: NextFunction): void => {
  const { error } = storyValidationSchema.validate(req.body, { abortEarly: false, allowUnknown: true });
  if (error) {
    const errorMessages = error.details.map((detail) => detail.message);
    res.status(400).json({ error: errorMessages.join(', ') });
    return;
  }
  next();
};
