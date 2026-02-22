import { z } from 'zod';
import { CONTACT_CATEGORY_VALUES } from '@/lib/contactCategories';

/** Shared contact form schema. */
export const ContactSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  message: z.string().min(1).max(1000),
  category: z.enum(CONTACT_CATEGORY_VALUES).default('General'),
  consent: z.boolean(),
  honeypot: z.string().length(0).optional().default(''),
  token: z.string().optional(),
});

export type ContactForm = z.infer<typeof ContactSchema>;
export type ContactFormInput = z.input<typeof ContactSchema>;
