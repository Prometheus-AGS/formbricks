import { beforeEach, describe, expect, test, vi } from "vitest";
import { UNKNOWN_DATA } from "../types/audit-log";
import { logAuditEvent } from "./service";

// Mocks
globalThis.console = { ...globalThis.console, error: vi.fn() };

vi.mock("../../../ee/license-check/lib/utils", () => ({
  getIsAuditLogsEnabled: vi.fn(),
}));
vi.mock("@formbricks/logger", () => ({
  logger: { error: vi.fn() },
}));
vi.mock("./logger", () => ({
  auditLogger: { info: vi.fn() },
}));

const validEvent = {
  actor: { id: "user-1", type: "user" as const },
  action: "user.created" as const,
  target: { id: "target-1", type: "user" as const },
  status: "success" as const,
  timestamp: new Date().toISOString(),
  organizationId: "org-1",
  integrityHash: "hash",
  previousHash: null,
  chainStart: true,
};

describe("logAuditEvent", () => {
  let getIsAuditLogsEnabled: any;
  let auditLogger: any;
  let logger: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    getIsAuditLogsEnabled = (await import("@/modules/ee/license-check/lib/utils")).getIsAuditLogsEnabled;
    auditLogger = (await import("./logger")).auditLogger;
    logger = (await import("@formbricks/logger")).logger;
  });

  test("logs event if access is granted and event is valid", async () => {
    getIsAuditLogsEnabled.mockResolvedValue(true);
    await logAuditEvent(validEvent);
    expect(auditLogger.info).toHaveBeenCalledWith(validEvent);
    expect(logger.error).not.toHaveBeenCalled();
  });

  test("does not log event if access is denied", async () => {
    getIsAuditLogsEnabled.mockResolvedValue(false);
    await logAuditEvent(validEvent);
    expect(auditLogger.info).not.toHaveBeenCalled();
    expect(logger.error).not.toHaveBeenCalled();
  });

  test("throws and logs error for invalid event", async () => {
    getIsAuditLogsEnabled.mockResolvedValue(true);
    const invalidEvent = { ...validEvent, action: "invalid.action" };
    await logAuditEvent(invalidEvent as any);
    expect(auditLogger.info).not.toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalled();
  });

  test("handles UNKNOWN_DATA organizationId", async () => {
    getIsAuditLogsEnabled.mockResolvedValue(true);
    const event = { ...validEvent, organizationId: UNKNOWN_DATA };
    await logAuditEvent(event);
    expect(auditLogger.info).toHaveBeenCalledWith(event);
  });

  test("does not throw if auditLogger.info throws", async () => {
    getIsAuditLogsEnabled.mockResolvedValue(true);
    auditLogger.info.mockImplementation(() => {
      throw new Error("fail");
    });
    await logAuditEvent(validEvent);
    expect(logger.error).toHaveBeenCalled();
  });
});

describe("logAuditEvent export", () => {
  test("is a function and works as expected", async () => {
    expect(typeof logAuditEvent).toBe("function");
    // Just check it calls the underlying logic and does not throw
    await expect(logAuditEvent(validEvent)).resolves.not.toThrow();
  });
});
