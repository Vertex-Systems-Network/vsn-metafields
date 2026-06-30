import db from "../db.server";

export const loader = async ({ request }) => {
  const url = new URL(request.url);
  const secret = url.searchParams.get("secret");

  if (secret !== "vsn-clear-2026") {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    const deleted = await db.session.deleteMany({});
    console.log("SESSIONS CLEARED:", deleted.count);

    return new Response(
      `All sessions cleared successfully. Total deleted: ${deleted.count}`,
      { status: 200 }
    );
  } catch (error) {
    console.error("SESSION CLEAR ERROR:", error);
    return new Response(`Failed to clear sessions: ${error.message}`, {
      status: 500,
    });
  }
};