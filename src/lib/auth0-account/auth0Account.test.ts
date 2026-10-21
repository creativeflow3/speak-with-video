import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { hasDatabasePassword, loginMethodFor, requestPasswordChange, PasswordResetError } from "./auth0Account";

const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  vi.stubEnv("AUTH0_DOMAIN", "example.us.auth0.com");
  vi.stubEnv("AUTH0_CLIENT_ID", "client-123");
  vi.stubEnv("AUTH0_DB_CONNECTION", "");
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  fetchMock.mockReset();
});

describe("hasDatabasePassword", () => {
  it.each([
    ["auth0|abc", true],
    ["google-oauth2|123", false],
    ["github|9", false],
  ])("%s → %s", (sub, expected) => {
    expect(hasDatabasePassword(sub)).toBe(expected);
  });
});

describe("loginMethodFor", () => {
  it.each([
    ["auth0|abc", "Email and password"],
    ["google-oauth2|123", "Google"],
    ["some-enterprise|x", "some-enterprise"],
  ])("%s → %s", (sub, expected) => {
    expect(loginMethodFor(sub)).toBe(expected);
  });
});

describe("requestPasswordChange", () => {
  it("posts the email, client id, and default connection to Auth0", async () => {
    fetchMock.mockResolvedValue(new Response("We've just sent you an email", { status: 200 }));

    await requestPasswordChange("a@b.com");

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://example.us.auth0.com/dbconnections/change_password");
    expect(JSON.parse(init.body)).toEqual({
      client_id: "client-123",
      email: "a@b.com",
      connection: "Username-Password-Authentication",
    });
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it("uses AUTH0_DB_CONNECTION and tolerates a domain with a scheme", async () => {
    vi.stubEnv("AUTH0_DOMAIN", "https://example.us.auth0.com/");
    vi.stubEnv("AUTH0_DB_CONNECTION", "My-DB");
    fetchMock.mockResolvedValue(new Response("ok", { status: 200 }));

    await requestPasswordChange("a@b.com");

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://example.us.auth0.com/dbconnections/change_password");
    expect(JSON.parse(init.body).connection).toBe("My-DB");
  });

  it("throws PasswordResetError on a non-2xx response", async () => {
    fetchMock.mockResolvedValue(new Response("bad connection", { status: 400 }));

    await expect(requestPasswordChange("a@b.com")).rejects.toThrow(
      new PasswordResetError("Auth0 returned 400: bad connection"),
    );
  });

  it("throws PasswordResetError when the request fails or times out", async () => {
    fetchMock.mockRejectedValue(new DOMException("The operation timed out.", "TimeoutError"));

    await expect(requestPasswordChange("a@b.com")).rejects.toBeInstanceOf(PasswordResetError);
  });

  it("throws before calling Auth0 when the domain isn't configured", async () => {
    vi.stubEnv("AUTH0_DOMAIN", "");

    await expect(requestPasswordChange("a@b.com")).rejects.toThrow("AUTH0_DOMAIN is not set");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
