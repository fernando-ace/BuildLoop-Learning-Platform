# Netlify Free staging assessment

**Assessment date:** 2026-11-16

**Repository baseline:** `afe56fcd1dbe19a1952402f6f5c374c3b146b7fe` on `goal-14-production-readiness`

**Result:** compatible enough for an isolated draft-only staging trial, but deployment is blocked until a Netlify Free Team Owner account is available and authenticated.

## Compatibility

BuildLoop uses Next.js 16.4.5, the App Router, server-rendered routes, API route handlers, `pg`, Drizzle, Better Auth, and Sentry. Netlify's maintained OpenNext adapter supports stable Next.js releases from 13.5 onward and documents full support for App Router, SSR, ISR, Server Components, Server Actions, streaming, middleware, route handlers, image optimization, and cache revalidation. The adapter packages server-side work as Netlify Functions. Netlify documents that each stable Next.js release is covered by its compatibility testing.

The app's account and learner persistence uses the PostgreSQL platform repository. SQLite appears in the legacy import path and tests; the live app routes do not use a local SQLite file for account or learner state. No platform-specific application code or `netlify.toml` is currently required for the adapter's automatic Next.js setup. The local Next.js production build passed in this assessment; an actual Netlify adapter build remains unverified until an authenticated draft build can run.

BuildLoop declares Node.js `>=22 <23`. Netlify lets projects select Node 22 for builds, and the Functions runtime normally follows the build's Node version. Set `NODE_VERSION=22` in the Netlify project before deploying and verify the Functions runtime is Node 22. This avoids relying on Netlify's default Node version. The Netlify Server product's Node 24 minimum does not apply to this Next.js adapter path.

References: [Next.js on Netlify](https://docs.netlify.com/build/frameworks/framework-setup-guides/nextjs/overview/), [Netlify build dependency versions](https://docs.netlify.com/build/configure-builds/manage-dependencies/), [Functions Node.js runtime](https://docs.netlify.com/build/functions/configuration/).

## Draft-only and private access gates

Netlify's CLI reference says `netlify deploy` creates a draft by default; `--prod` deploys to the live site. The CLI supports a draft alias and a `deploy-preview` build context. The deploy command's `--remote` option builds on Netlify and still creates a draft. A new project can be created empty, without connecting Git or starting a deploy, using `netlify sites:create`.

On the credit-based Free plan, a project can be private and its previews remain private unless visibility is changed. A private Free project is accessible only to its Team Owner; inviting team members requires a paid plan. Password protection is not available on Free. Free currently includes 300 credits per month with a hard limit and no auto-recharge, and Netlify says the Free plan itself is never charged.

To preserve the privacy and $0 constraints, the site must be created without Git continuous deployment, set to private at the project level before the first draft, and left private for both production and previews. Do not rely on a team-wide default without checking it: defaults differ by team age and changing a default can affect future projects. A single owner can access the private site and run separate BuildLoop test accounts/browser contexts; additional human Netlify viewers are not available on Free. The anonymous CLI flow is not suitable because it creates an unclaimed live URL and applies the team's visibility only after claiming.

References: [Netlify CLI deploy](https://cli.netlify.com/commands/deploy/), [Netlify project visibility](https://docs.netlify.com/manage/security/secure-access-to-sites/project-visibility/), [Netlify Free plan](https://docs.netlify.com/manage/accounts-and-billing/billing/billing-for-credit-based-plans/credit-based-pricing-plans/), [Netlify anonymous deploys](https://docs.netlify.com/api-and-cli-guides/cli-guides/get-started-with-cli/).

## Reproducible, guarded procedure

Run these steps only after an existing or newly created Netlify **credit-based Free** account is signed in as Team Owner. Do not accept a paid plan or trial. Do not connect Git or configure build hooks. No command below is a production deploy.

1. Confirm the account is on Free, auto-recharge is unavailable/off, and the team has no billing setup that could authorize an upgrade. Create an empty site without deploying:

   ```powershell
   npx --yes netlify-cli@27.20.0 sites:create --name buildloop-goal14-staging
   ```

   If that name is already taken, choose another dedicated staging name. Do not run `netlify init` or connect a Git repository.

2. In that site's Netlify settings, set **Project visibility: Private** for production and previews. Verify the Free-plan owner-only access note. If the project cannot be made private on the selected Free account, stop without deploying.

3. The alias `goal14-staging` produces a URL in the form `https://goal14-staging--<actual-site-name>.netlify.app`. Add runtime/build environment variables in the Netlify UI, scoped only to the `deploy-preview` context where Netlify allows context scoping:
   - `NODE_VERSION=22`
   - `BUILDLOOP_ENVIRONMENT=preview`
   - `DATABASE_URL`: the existing Neon Free pooled TLS connection string
   - `BETTER_AUTH_SECRET`: a unique random value of at least 32 characters
   - `PUBLIC_APP_URL` and `BETTER_AUTH_URL`: the exact HTTPS origin for the chosen Netlify draft alias
   - `BUILDLOOP_RELEASE`: the reviewed commit SHA
   - Set `BUILDLOOP_PREVIEW_ALLOW_UNVERIFIED_SIGNUPS=1` only while Netlify private access is verified; this supports staging sign-up without pretending email delivery is configured.

   Store secret values only in Netlify's protected environment-variable UI. Do not put them in `netlify.toml`, source, shell arguments, logs, or chat. Keep `RESEND_API_KEY`, `OPENAI_API_KEY`, and Sentry DSNs unset unless separately available and authorized. Do not configure Neon migration credentials in the hosted runtime.

4. Confirm the exact branch and HEAD are still `goal-14-production-readiness` and `afe56fcd...` (or a later reviewed commit), then run a draft deploy with an explicit preview context and alias:

   ```powershell
   npx --yes netlify-cli@27.20.0 deploy --remote --context deploy-preview --alias goal14-staging --json
   ```

   `deploy` defaults to draft. Do not add `--prod`, `-p`, or `--prod-if-unlocked`. Record the returned deploy ID, URL, commit, draft type, and readiness. Confirm the returned URL matches the configured auth origins. If an explicit `draft` classification or private access cannot be confirmed, stop and do not continue.

5. Using the Team Owner's authenticated browser, verify the private URL loads, and verify an unauthenticated request is denied before running any app tests. Then test health, auth/session behavior, cross-session Mission and Studio persistence, tenant isolation, role/invitation permissions, application publishing and rollback, and test-data cleanup against Neon. Use only uniquely named synthetic accounts and verify their deletion. Do not promote or change visibility to public. Netlify host rollback is out of scope; a new CLI deploy remains a separate draft. In-product BuildLoop publish/rollback is testable with synthetic app data.

6. Check the Netlify credit dashboard before and after testing. Stop if the free hard limit is exhausted; do not upgrade or enable paid features. Review function/build logs for errors and confirm the project still has zero Production deploys.

Netlify CLI 27.20.0 is pinned in these instructions for reproducibility. The documented CLI semantics are described at [Netlify CLI deploy reference](https://cli.netlify.com/commands/deploy/); Netlify's framework adapter and deploy context behavior are documented in the [Next.js guide](https://docs.netlify.com/build/frameworks/framework-setup-guides/nextjs/overview/) and [CLI guide](https://docs.netlify.com/api-and-cli-guides/cli-guides/get-started-with-cli/).

## Evidence from this assessment

- Netlify Next.js support and CLI draft semantics verified against official Netlify documentation on 2026-11-16.
- Netlify Free plan and private project limits verified against official documentation on 2026-11-16.
- Existing Chrome session showed Netlify's **Log in** screen. No Netlify CLI installation or Netlify authentication environment variables were available. No account, project, deploy, or setting was created or changed.
- `npm run typecheck`: passed.
- `npm run lint`: passed.
- `npm test -- --reporter=dot`: 239 passed, 9 skipped (248 total; 39 files passed, 2 skipped). Database-dependent tests were skipped because `DATABASE_URL` was not in the process environment.
- `npm run build`: passed on Next.js 16.4.5.
- `npm run test:e2e`: 20 passed, 14 failed. The failures were at authenticated test setup because this Playwright invocation passed an empty `DATABASE_URL`; the suite did not complete the PostgreSQL-backed workflows. This is not hosted evidence.
- No Netlify draft build, hosted browser test, account-isolation test, Neon mutation, or synthetic-data cleanup was performed in this assessment.
- No Production deployment occurred on any platform. The existing Vercel project was not changed.

## Human action required

`HUMAN_ACTION_REQUIRED`: sign in to a Netlify credit-based Free Team Owner account (or create one and complete Netlify's account/terms flow), confirm the account is Free with no paid plan, and make an empty dedicated site available for project-level private configuration. The current browser is at the Netlify login screen, and no CLI credentials exist here. After that access is available, re-check the account/plan and project visibility before running the draft-only procedure above. Goal 14 remains incomplete until the private hosted workflow and cleanup are verified.
