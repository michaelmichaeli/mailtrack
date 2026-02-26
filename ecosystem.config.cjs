module.exports = {
  apps: [
    {
      name: "mailtrack-api",
      cwd: "./apps/api",
      script: "npx",
      args: "tsx src/server.ts",
      autorestart: true,
      max_restarts: 20,
      min_uptime: "5s",
      restart_delay: 3000,
      kill_timeout: 5000,
      env: {
        NODE_ENV: "development",
        PORT: "3002",
      },
    },
    {
      name: "mailtrack-web",
      cwd: "./apps/web",
      script: "bash",
      args: "-c 'rm -rf .next && npx next dev -p 3003'",
      autorestart: true,
      max_restarts: 20,
      min_uptime: "5s",
      restart_delay: 3000,
      kill_timeout: 5000,
      env: {
        NODE_ENV: "development",
        PORT: "3003",
      },
    },
  ],
};
