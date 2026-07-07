module.exports = {
  apps: [
    {
      name: "dj-vault",
      cwd: __dirname,
      script: "node_modules/next/dist/bin/next",
      args: "start -H 127.0.0.1 -p 3000",
      env: {
        NODE_ENV: "production",
      },
      autorestart: true,
      watch: false,
      max_memory_restart: "300M",
      restart_delay: 3000,
      exp_backoff_restart_delay: 100,
      time: true,
    },
  ],
};
