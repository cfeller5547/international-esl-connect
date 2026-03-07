import { ok } from "@/server/http";

export async function GET() {
  return ok({
    quickActions: [
      {
        key: "homework_help",
        title: "Homework Help",
        targetUrl: "/app/tools/homework",
        persistent: true,
      },
      {
        key: "test_prep_sprint",
        title: "Test Prep Sprint",
        targetUrl: "/app/tools/test-prep",
        persistent: false,
      },
    ],
  });
}
