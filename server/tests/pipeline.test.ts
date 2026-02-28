import { describe, it, expect, vi, beforeEach } from "vitest";
import { getJobStatus } from "../jobQueue";
import * as pipelineModule from "../pipeline";
import * as dbModule from "../_core/db";

describe("Core Pipeline Flow", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("runs pipeline and returns structured output", async () => {
    const mockOutput = {
      forensicDossier: "forensic",
      rebuiltCode: "rebuilt",
      qualityReport: "quality",
      tokensUsed: 123,
    };

    vi.spyOn(pipelineModule, "runPipeline").mockResolvedValue(mockOutput as any);

    vi.spyOn(dbModule, "getDb").mockResolvedValue({
      insert: () => ({
        values: () => Promise.resolve(),
      }),
      select: () => ({
        from: () => ({
          where: () => ({
            limit: () => Promise.resolve([mockOutput]),
          }),
        }),
      }),
    } as any);

    const jobId = "sub-1-123";

    const status = await getJobStatus(jobId);

    expect(status.status).toBe("completed");
    expect(status.result?.forensicDossier).toBe("forensic");
    expect(status.result?.rebuiltCode).toBe("rebuilt");
    expect(status.result?.qualityReport).toBe("quality");
  });

  it("returns waiting if no results found", async () => {
    vi.spyOn(dbModule, "getDb").mockResolvedValue({
      select: () => ({
        from: () => ({
          where: () => ({
            limit: () => Promise.resolve([]),
          }),
        }),
      }),
    } as any);

    const status = await getJobStatus("sub-99-123");

    expect(status.status).toBe("waiting");
  });
});
