import { router } from './trpc.js';
import { authRouter } from './routers/auth.router.js';
import { pdnsRouter } from './routers/pdns.router.js';
import { recursorRouter } from './routers/recursor.router.js';
import { auditRouter } from './routers/audit.router.js';
import { usersRouter } from './routers/users.router.js';

export const appRouter = router({
  auth: authRouter,
  pdns: pdnsRouter,
  recursor: recursorRouter,
  audit: auditRouter,
  users: usersRouter,
});

export type AppRouter = typeof appRouter;
