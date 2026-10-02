import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const verifyLicense = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ licenseKey: z.string().max(200) }).parse(input))
  .handler(async ({ data }): Promise<{ valid: boolean; reason?: string }> => {
    const { verifyLicenseKey } = await import("./license.server");
    return verifyLicenseKey(data.licenseKey);
  });
