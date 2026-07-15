import { describe, expect, it, vi } from "vitest";

vi.mock("../../shared/errors/reporter", () => ({
  reporter: { captureMessage: vi.fn() }
}));

import { downloadSessionSnapshot, uploadSessionSnapshot } from "./supabaseSessionSnapshotSession";
import { reporter } from "../../shared/errors/reporter";

const envelope = {
  schemaVersion: 8,
  state: { some: "state" }
} as never;

describe("uploadSessionSnapshot", () => {
  it("uploads the whole envelope and resolves the saved outcome", async () => {
    const rpc = vi.fn(async () => ({ data: { outcome: "saved" }, error: null }));
    const client = { rpc } as never;

    const result = await uploadSessionSnapshot(client, { envelope, clientUpdatedAt: "2026-07-15T00:00:00.000Z" });

    expect(result).toEqual({ ok: true, outcome: "saved" });
    expect(rpc).toHaveBeenCalledWith("upsert_session_snapshot", {
      p_schema_version: 8,
      p_payload: envelope,
      p_client_updated_at: "2026-07-15T00:00:00.000Z"
    });
  });

  it("resolves the stale outcome without treating it as a hard failure", async () => {
    const rpc = vi.fn(async () => ({ data: { outcome: "stale" }, error: null }));
    const client = { rpc } as never;

    const result = await uploadSessionSnapshot(client, { envelope, clientUpdatedAt: "2026-07-15T00:00:00.000Z" });

    expect(result).toEqual({ ok: true, outcome: "stale" });
  });

  it("resolves the too_large outcome without treating it as a hard failure", async () => {
    const rpc = vi.fn(async () => ({ data: { outcome: "too_large" }, error: null }));
    const client = { rpc } as never;

    const result = await uploadSessionSnapshot(client, { envelope, clientUpdatedAt: "2026-07-15T00:00:00.000Z" });

    expect(result).toEqual({ ok: true, outcome: "too_large" });
  });

  it("maps an RPC error to a retryable request_failed outcome", async () => {
    const rpc = vi.fn(async () => ({ data: null, error: { message: "connection reset" } }));
    const client = { rpc } as never;

    const result = await uploadSessionSnapshot(client, { envelope, clientUpdatedAt: "2026-07-15T00:00:00.000Z" });

    expect(result).toEqual({ ok: false, reason: "request_failed" });
  });

  it("rejects malformed RPC data as request_failed", async () => {
    const rpc = vi.fn(async () => ({ data: { outcome: "unexpected" }, error: null }));
    const client = { rpc } as never;

    const result = await uploadSessionSnapshot(client, { envelope, clientUpdatedAt: "2026-07-15T00:00:00.000Z" });

    expect(result).toEqual({ ok: false, reason: "request_failed" });
  });

  it("never throws when the client itself throws, and reports the failure", async () => {
    const rpc = vi.fn(async () => {
      throw new Error("offline");
    });
    const client = { rpc } as never;

    const result = await uploadSessionSnapshot(client, { envelope, clientUpdatedAt: "2026-07-15T00:00:00.000Z" });

    expect(result).toEqual({ ok: false, reason: "request_failed" });
    expect(reporter.captureMessage).toHaveBeenCalled();
  });
});

describe("downloadSessionSnapshot", () => {
  it("returns the snapshot when a row exists", async () => {
    const maybeSingle = vi.fn(async () => ({
      data: { schema_version: 8, payload: { some: "state" }, client_updated_at: "2026-07-15T00:00:00.000Z" },
      error: null
    }));
    const select = vi.fn(() => ({ maybeSingle }));
    const from = vi.fn(() => ({ select }));
    const client = { from } as never;

    const result = await downloadSessionSnapshot(client);

    expect(result).toEqual({
      ok: true,
      snapshot: {
        schemaVersion: 8,
        payload: { some: "state" },
        clientUpdatedAt: "2026-07-15T00:00:00.000Z"
      }
    });
    expect(from).toHaveBeenCalledWith("session_snapshots");
    expect(select).toHaveBeenCalledWith("schema_version, payload, client_updated_at");
  });

  it("returns snapshot: null when no row exists", async () => {
    const maybeSingle = vi.fn(async () => ({ data: null, error: null }));
    const select = vi.fn(() => ({ maybeSingle }));
    const client = { from: vi.fn(() => ({ select })) } as never;

    const result = await downloadSessionSnapshot(client);

    expect(result).toEqual({ ok: true, snapshot: null });
  });

  it("maps a query error to request_failed", async () => {
    const maybeSingle = vi.fn(async () => ({ data: null, error: { message: "connection reset" } }));
    const select = vi.fn(() => ({ maybeSingle }));
    const client = { from: vi.fn(() => ({ select })) } as never;

    const result = await downloadSessionSnapshot(client);

    expect(result).toEqual({ ok: false, reason: "request_failed" });
  });

  it("never throws when the client itself throws, and reports the failure", async () => {
    const client = {
      from: vi.fn(() => {
        throw new Error("offline");
      })
    } as never;

    const result = await downloadSessionSnapshot(client);

    expect(result).toEqual({ ok: false, reason: "request_failed" });
    expect(reporter.captureMessage).toHaveBeenCalled();
  });
});
