import { defineConfig, devices } from "@playwright/test";

const allProjects = [
  {
    name: "chromium",
    use: { ...devices["Desktop Chrome"] },
  },
  {
    name: "firefox",
    use: { ...devices["Desktop Firefox"] },
  },
  {
    name: "webkit",
    use: { ...devices["Desktop Safari"] },
  },
];

const browserFilter = process.env["PW_BROWSERS"];
const projects = browserFilter
  ? allProjects.filter((p) => browserFilter.split(",").includes(p.name))
  : allProjects;

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env["CI"],
  retries: process.env["CI"] ? 2 : 0,
  workers: process.env["CI"] ? 1 : undefined,
  reporter: [["html", { open: "never" }], ["line"]],
  use: {
    baseURL: "http://localhost:4173",
    trace: "on-first-retry",
  },
  projects,
  webServer: {
    command: "npm run preview",
    port: 4173,
    reuseExistingServer: !process.env["CI"],
  },
});
