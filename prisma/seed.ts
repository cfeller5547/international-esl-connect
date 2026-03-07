import { bootstrapDatabase } from "../src/server/bootstrap-data";

async function main() {
  await bootstrapDatabase();
}

main()
  .then(() => {
    console.log("Database seeded.");
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

