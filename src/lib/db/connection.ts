export type D1 = D1Database | undefined;

export function getDb(locals: App.Locals): D1 {
  return locals.runtime?.env.DB;
}
