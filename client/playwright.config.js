import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "test/browser",
  workers: 1,
  reporter: "list",
  outputDir: "node_modules/.cache/campus-browser-tests",
  use: { baseURL: "http://127.0.0.1:4261", reducedMotion: "reduce" },
  projects: [...["chromium", "firefox"].flatMap((browserName) =>
    [
      { name: "desktop", width: 1280, colorScheme: "light" },
      { name: "mobile", width: 360, colorScheme: "dark" },
    ].map(({ name, width, colorScheme }) => ({
      name: browserName + "-" + name,
      use: {
        ...(name === "mobile" && browserName === "chromium" ? devices["Pixel 7"] : {}),
        hasTouch: name === "mobile",
        browserName,
        // The headless shell does not expose the granted OS notification permission.
        channel: browserName === "chromium" && !process.env.CAMPUS_TEST_CHROME ? "chromium" : undefined,
        launchOptions: browserName === "chromium" && process.env.CAMPUS_TEST_CHROME
          ? { executablePath: process.env.CAMPUS_TEST_CHROME }
          : undefined,
        viewport: { width, height: 840 },
        colorScheme,
      },
    })),
  ), ...(process.env.CAMPUS_TEST_IPHONE === "1" ? [{
    name: "webkit-mobile",
    use: { ...devices["iPhone 13"], browserName: "webkit", colorScheme: "light" },
  }] : [])],
  webServer: [
    {
      cwd: "..",
      command: `server/.venv/bin/python -c "import tempfile, os, uvicorn; from pathlib import Path; db = tempfile.TemporaryDirectory(); os.environ['CAMPUS_DEMO_DB'] = str(Path(db.name) / 'test.sqlite'); from datetime import datetime; from zoneinfo import ZoneInfo; import server.core.clock; server.core.clock.now = lambda: datetime(2026, 11, 20, 9, 50, tzinfo=ZoneInfo('Europe/Moscow')); uvicorn.run('server.main:app', port=8261, access_log=False)"`,
      env: { CAMPUS_MODE: "demo", CAMPUS_JURY_PREVIEW: "1" },
      url: "http://127.0.0.1:8261/health",
    },
    {
      command: "npm run dev:client -- --port 4261",
      env: { CAMPUS_API_ORIGIN: "http://127.0.0.1:8261", VITE_CAMPUS_AUTH: "demo", VITE_API_ORIGIN: "" },
      url: "http://127.0.0.1:4261",
    },
  ],
});
