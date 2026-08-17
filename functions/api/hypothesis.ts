import type { Env } from '../_lib/env';
import { handleHypothesis } from '../_lib/hypothesis';
import { preflight } from '../_lib/cors';

export const onRequestPost: PagesFunction<Env> = async (context) => {
  return handleHypothesis(context.request, context.env);
};

export const onRequestOptions: PagesFunction<Env> = async () => preflight();
