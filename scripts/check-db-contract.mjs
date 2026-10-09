import { readFileSync } from "node:fs";

const model = (path, name) => {
  const source = readFileSync(path, "utf8");
  const match = source.match(new RegExp(`model ${name} \\{([\\s\\S]*?)\\n\\}`));
  if (!match) throw new Error(`${name} model missing in ${path}`);
  return match[1].trim().replace(/\s+/g, " ");
};
for (const name of ["Session", "MetafieldJob", "PrivacyRequest"]) {
  if (
    model("prisma/schema.prisma", name) !==
    model("prisma/local/schema.prisma", name)
  ) {
    throw new Error(
      `Local SQLite and Neon PostgreSQL ${name} models have diverged.`,
    );
  }
}
console.log("Local SQLite and Neon Session, MetafieldJob and PrivacyRequest models match.");
