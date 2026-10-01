import { readFileSync } from "node:fs";

const model = (path) => {
  const source = readFileSync(path, "utf8");
  const match = source.match(/model Session \{([\s\S]*?)\n\}/);
  if (!match) throw new Error(`Session model missing in ${path}`);
  return match[1].trim().replace(/\s+/g, " ");
};
if (model("prisma/schema.prisma") !== model("prisma/local/schema.prisma")) {
  throw new Error("Local SQLite and Neon PostgreSQL Session models have diverged.");
}
console.log("Local SQLite and Neon Session models match.");
