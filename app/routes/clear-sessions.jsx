import { redirect } from "react-router";
import db from "../db.server";

export const loader = async ({ request }) => {
  const url = new URL(request.url);
  const secret = url.searchParams.get("secret");

  // Simple protection so random people can't call it
  if (secret !== "vsn-clear-2026") {
    return new Response("Unauthorized", { status: 401 });
  }

  await db.session.deleteMany({});

  return new Response("All sessions cleared successfully", { status: 200 });
};