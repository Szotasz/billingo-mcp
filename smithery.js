export default function startCommand(config) {
  return {
    command: "node",
    // The stdio entry (package.json bin). dist/index.js only exports createServer and starts nothing.
    args: ["dist/cli.js"],
    env: {
      BILLINGO_API_KEY: config.BILLINGO_API_KEY,
    },
  };
}
