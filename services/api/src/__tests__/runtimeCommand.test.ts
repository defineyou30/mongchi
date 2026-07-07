import { describe, expect, it } from "vitest";

import type { StartedPostgresApiNodeServer } from "../apiServerProcess";
import {
  createOperationalAlertSinkFromRuntimeEnv,
  formatApiRuntimeCommandUsage,
  parseApiRuntimeCommand,
  runApiRuntimeCommand,
  runApiRuntimeCommandCli,
  runApiRuntimeCommandFromArgv
} from "../runtimeCommand";

describe("API runtime command", () => {
  it("parses supported command aliases and rejects unknown commands", () => {
    expect(parseApiRuntimeCommand("api")).toBe("api-server");
    expect(parseApiRuntimeCommand("generation-worker")).toBe("generation-worker");
    expect(parseApiRuntimeCommand("privacy-worker")).toBe("privacy-deletion-worker");
    expect(parseApiRuntimeCommand("outbox")).toBe("outbox-worker");
    expect(parseApiRuntimeCommand("chat-retention")).toBe("chat-retention-worker");
    expect(parseApiRuntimeCommand("migrate")).toBe("migrate");
    expect(parseApiRuntimeCommand("unknown")).toBeNull();
    expect(formatApiRuntimeCommandUsage()).toContain("start:generation-worker");
    expect(formatApiRuntimeCommandUsage()).toContain("start:migrate");
  });

  it("starts the API server command with runtime env, signal, and operational logger", async () => {
    const env = {
      TINY_PET_RELEASE_PROFILE: "development",
      TINY_PET_API_SERVICE_NAME: "tiny-pet-api-test"
    };
    const abortController = new AbortController();
    const logEvents: Array<{ event: string; metadata: Record<string, unknown> }> = [];
    const server = {
      listenResult: {
        host: "127.0.0.1",
        port: 8787,
        baseUrl: "http://127.0.0.1:8787"
      },
      close: async () => undefined
    } as StartedPostgresApiNodeServer;

    const result = await runApiRuntimeCommand("api-server", {
      env,
      signal: abortController.signal,
      operationalLogger: {
        info: (event, metadata) => {
          logEvents.push({ event, metadata });
        }
      },
      dependencies: {
        startApiServer: async (options) => {
          expect(options?.env).toBe(env);
          expect(options?.signal).toBe(abortController.signal);
          expect(options?.operationalLogger?.info).toBeDefined();

          return server;
        }
      }
    });

    expect(result).toEqual({
      command: "api-server",
      status: "started",
      server
    });
    expect(logEvents).toEqual([]);
  });

  it("runs a worker command and records a safe process summary", async () => {
    const env = {
      TINY_PET_RELEASE_PROFILE: "development"
    };
    const abortController = new AbortController();
    const logEvents: Array<{ event: string; metadata: Record<string, unknown> }> = [];
    const workerResult = {
      status: "completed" as const,
      runs: 2,
      completedJobs: 1,
      failedJobs: 0,
      idleRuns: 1
    };

    const result = await runApiRuntimeCommand("generation-worker", {
      env,
      signal: abortController.signal,
      operationalLogger: {
        info: (event, metadata) => {
          logEvents.push({ event, metadata });
        }
      },
      dependencies: {
        runGenerationWorker: async (options) => {
          expect(options?.env).toBe(env);
          expect(options?.processOptions?.signal).toBe(abortController.signal);
          expect(options?.operationalLogger?.info).toBeDefined();

          return workerResult;
        }
      }
    });

    expect(result).toEqual({
      command: "generation-worker",
      status: "completed",
      result: workerResult
    });
    expect(logEvents).toEqual([
      {
        event: "api_runtime_command_finished",
        metadata: {
          command: "generation-worker",
          status: "completed",
          runs: 2,
          completedJobs: 1,
          failedJobs: 0,
          idleRuns: 1
        }
      }
    ]);
  });

  it("marks failed worker commands as command failures", async () => {
    const errorEvents: Array<{ event: string; metadata: Record<string, unknown> }> = [];
    const workerResult = {
      status: "failed" as const,
      runs: 0,
      deliveredEvents: 0,
      failedEvents: 0,
      idleRuns: 0,
      failureCode: "api_outbox_worker_process_failed" as const,
      failureMessageSafe: "API outbox worker process could not run. Check worker deployment logs."
    };

    const result = await runApiRuntimeCommand("outbox-worker", {
      operationalLogger: {
        error: (event, metadata) => {
          errorEvents.push({ event, metadata });
        }
      },
      dependencies: {
        runOutboxWorker: async () => workerResult
      }
    });

    expect(result).toEqual({
      command: "outbox-worker",
      status: "failed",
      result: workerResult
    });
    expect(errorEvents).toEqual([
      {
        event: "api_runtime_command_failed",
        metadata: {
          command: "outbox-worker",
          status: "failed",
          runs: 0,
          deliveredEvents: 0,
          failedEvents: 0,
          idleRuns: 0,
          failureCode: "api_outbox_worker_process_failed",
          failureMessageSafe: "API outbox worker process could not run. Check worker deployment logs."
        }
      }
    ]);
  });

  it("uses command-specific default service names for worker logs", async () => {
    const serviceNames: Array<string | undefined> = [];

    await runApiRuntimeCommand("chat-retention-worker", {
      env: {
        TINY_PET_RELEASE_PROFILE: "development",
        TINY_PET_API_SERVICE_NAME: "tiny-pet-api-only"
      },
      dependencies: {
        createOperationalLogger: (options) => {
          serviceNames.push(options?.serviceName);

          return {};
        },
        runChatRetentionWorker: async () => ({
          status: "completed",
          runs: 1,
          purgedRuns: 0,
          deletedMessages: 0,
          idleRuns: 1
        })
      }
    });

    expect(serviceNames).toEqual(["mongchi-chat-retention-worker"]);
  });

  it("fans runtime alert events out to the configured operational alert sink", async () => {
    const events: Array<{ event: string; metadata: Record<string, unknown> }> = [];
    const sentAlerts: unknown[] = [];

    await runApiRuntimeCommand("outbox-worker", {
      env: {
        TINY_PET_RELEASE_PROFILE: "development",
        TINY_PET_OPERATIONAL_ALERT_ROUTING: "webhook"
      },
      dependencies: {
        createOperationalLogger: () => ({
          info: (event, metadata) => events.push({ event, metadata }),
          error: (event, metadata) => events.push({ event, metadata })
        }),
        createOperationalAlertSink: () => ({
          sendAlert: (alert) => {
            sentAlerts.push(alert);
          }
        }),
        runOutboxWorker: async () => ({
          status: "failed",
          runs: 0,
          deliveredEvents: 0,
          failedEvents: 0,
          idleRuns: 0,
          failureCode: "api_outbox_worker_process_failed",
          failureMessageSafe: "API outbox worker process could not run. Check worker deployment logs."
        })
      }
    });

    expect(events.map((event) => event.event)).toEqual(["api_runtime_command_failed", "operational_alert_triggered"]);
    expect(sentAlerts).toHaveLength(1);
    expect(sentAlerts[0]).toMatchObject({
      category: "runtime_failure",
      event: "api_runtime_command_failed"
    });
  });

  it("builds operational alert sinks from runtime env only when alert routing is webhook", () => {
    expect(createOperationalAlertSinkFromRuntimeEnv({ TINY_PET_OPERATIONAL_ALERT_ROUTING: "json_logs" })).toBeUndefined();
    expect(() =>
      createOperationalAlertSinkFromRuntimeEnv({ TINY_PET_OPERATIONAL_ALERT_ROUTING: "webhook" })
    ).toThrow("TINY_PET_OPERATIONAL_ALERT_WEBHOOK_URL must be set when alert routing is webhook.");
    expect(() =>
      createOperationalAlertSinkFromRuntimeEnv({ TINY_PET_OPERATIONAL_ALERT_ROUTING: "other" })
    ).toThrow("TINY_PET_OPERATIONAL_ALERT_ROUTING must be json_logs or webhook.");
    expect(
      createOperationalAlertSinkFromRuntimeEnv({
        TINY_PET_OPERATIONAL_ALERT_ROUTING: "webhook",
        TINY_PET_OPERATIONAL_ALERT_WEBHOOK_URL: "https://alerts.mongchi.app/hooks",
        TINY_PET_OPERATIONAL_ALERT_WEBHOOK_BEARER_TOKEN: "alert-secret"
      })
    ).toMatchObject({
      sendAlert: expect.any(Function)
    });
  });

  it("fails fast for an unknown argv command", async () => {
    await expect(runApiRuntimeCommandFromArgv({ argv: ["missing"] })).rejects.toThrow(
      "Usage: npm --workspace @mongchi/api run start:<command>"
    );
  });

  it("runs the migrate command via the injected dependency and logs applied/skipped migrations", async () => {
    const logEvents: Array<{ event: string; metadata: Record<string, unknown> }> = [];
    const migrateResult = {
      applied: ["0001_initial_api_state", "0002_generation_issue_reports"],
      skipped: ["0003_conversation_message_retention_index"]
    };

    const result = await runApiRuntimeCommand("migrate", {
      env: { TINY_PET_RELEASE_PROFILE: "development" },
      operationalLogger: {
        info: (event, metadata) => {
          logEvents.push({ event, metadata });
        }
      },
      dependencies: {
        runMigrate: async () => migrateResult
      }
    });

    expect(result).toEqual({
      command: "migrate",
      status: "applied",
      result: migrateResult
    });
    expect(logEvents).toEqual([
      {
        event: "api_runtime_command_finished",
        metadata: {
          command: "migrate",
          applied: migrateResult.applied,
          skipped: migrateResult.skipped
        }
      }
    ]);
  });

  it("marks the migrate command as failed when the injected dependency throws", async () => {
    const errorEvents: Array<{ event: string; metadata: Record<string, unknown> }> = [];

    const result = await runApiRuntimeCommand("migrate", {
      operationalLogger: {
        error: (event, metadata) => {
          errorEvents.push({ event, metadata });
        }
      },
      dependencies: {
        runMigrate: async () => {
          throw new Error("API database runtime config is missing TINY_PET_DATABASE_URL.");
        }
      }
    });

    expect(result).toEqual({
      command: "migrate",
      status: "failed",
      result: {
        applied: [],
        skipped: []
      }
    });
    expect(errorEvents).toEqual([
      {
        event: "api_runtime_command_failed",
        metadata: {
          command: "migrate",
          failureCode: "api_migrate_command_failed",
          failureMessageSafe: "API database runtime config is missing TINY_PET_DATABASE_URL."
        }
      }
    ]);
  });

  it("maps a failed migrate command to a non-zero exit code via the CLI", async () => {
    let exitCode: number | undefined;

    const result = await runApiRuntimeCommandCli({
      argv: ["migrate"],
      env: {},
      writeError: () => undefined,
      setExitCode: (code) => {
        exitCode = code;
      },
      processSignals: {
        once: () => undefined,
        off: () => undefined
      },
      dependencies: {
        runMigrate: async () => {
          throw new Error("API database runtime config is missing TINY_PET_DATABASE_URL.");
        }
      }
    });

    expect(result).toEqual({
      command: "migrate",
      status: "failed",
      result: {
        applied: [],
        skipped: []
      }
    });
    expect(exitCode).toBe(1);
  });

  it("maps a successful migrate command to a zero exit code via the CLI", async () => {
    let exitCode: number | undefined;
    const migrateResult = { applied: [], skipped: ["0001_initial_api_state"] };

    const result = await runApiRuntimeCommandCli({
      argv: ["migrate"],
      env: {},
      writeError: () => undefined,
      setExitCode: (code) => {
        exitCode = code;
      },
      processSignals: {
        once: () => undefined,
        off: () => undefined
      },
      dependencies: {
        runMigrate: async () => migrateResult
      }
    });

    expect(result).toEqual({
      command: "migrate",
      status: "applied",
      result: migrateResult
    });
    expect(exitCode).toBe(0);
  });
});
