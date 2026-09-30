export async function hasActivePlan(admin) {
  const response = await admin.graphql(`#graphql
    query MetafieldAccessSubscription {
      currentAppInstallation {
        activeSubscriptions { status }
      }
    }
  `);
  const result = await response.json();
  if (result?.errors?.length || !result?.data?.currentAppInstallation ||
      !Array.isArray(result.data.currentAppInstallation.activeSubscriptions)) {
    throw new Error("Could not verify the active subscription.");
  }
  return result.data.currentAppInstallation.activeSubscriptions.some(
    (subscription) => subscription.status === "ACTIVE"
  );
}
