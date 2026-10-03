import { PRO_PLAN } from "../billing-config";
import { APP_VERSION } from "../product-config";
import { requestAppName } from "../product-identity.server";

export const loader = async ({ context }) => {
  const commitSha = context?.cloudflare?.env?.APP_COMMIT_SHA ?? null;

  return Response.json(
    {
      ok: true,
      service: "vsn-metafields",
      displayName: requestAppName(context),
      appVersion: APP_VERSION,
      commitSha,
      plan: {
        id: PRO_PLAN.id,
        amount: PRO_PLAN.amount,
        currencyCode: PRO_PLAN.currencyCode,
        interval: PRO_PLAN.interval,
        trialDays: PRO_PLAN.trialDays,
      },
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
};
