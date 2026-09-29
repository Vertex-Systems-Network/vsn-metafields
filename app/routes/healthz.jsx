import { PRO_PLAN } from "../billing-config";

export const loader = async ({ context }) => {
  const commitSha = context?.cloudflare?.env?.APP_COMMIT_SHA ?? null;

  return Response.json(
    {
      ok: true,
      service: "vsn-metafields",
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
    }
  );
};
