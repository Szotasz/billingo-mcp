export default function startCommand(config) {
  return {
    command: "node",
    args: ["dist/index.js"],
    env: {
      BILLINGO_API_KEY: config.BILLINGO_API_KEY,
    },
  };
}
