import { describe, it, expect } from "vitest";
import { planDeployMigration } from "./migrate-on-deploy";

const UNPOOLED = "postgres://direct.example/db";

describe("planDeployMigration", () => {
  it("migrates production builds over the unpooled connection", () => {
    expect(planDeployMigration({ VERCEL_ENV: "production", DATABASE_URL_UNPOOLED: UNPOOLED })).toEqual({
      run: true,
      url: UNPOOLED,
    });
  });

  it("skips preview builds, which share the production database", () => {
    expect(planDeployMigration({ VERCEL_ENV: "preview", DATABASE_URL_UNPOOLED: UNPOOLED })).toEqual({
      run: false,
      reason: 'VERCEL_ENV is "preview", not "production"',
    });
  });

  it("skips local builds with no VERCEL_ENV", () => {
    expect(planDeployMigration({ DATABASE_URL_UNPOOLED: UNPOOLED })).toMatchObject({ run: false });
  });

  it("fails a production build rather than migrating over the pooled connection", () => {
    expect(() => planDeployMigration({ VERCEL_ENV: "production", DATABASE_URL: "postgres://pooled" })).toThrow(
      "DATABASE_URL_UNPOOLED is not set",
    );
  });
});
