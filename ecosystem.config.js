module.exports = {
  apps: [{
    name: 'fairdrive-server',
    script: 'dist/src/main.js',
    instances: 1,
    exec_mode: 'cluster',
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
    },
    env_production: {
      NODE_ENV: 'production',
    },
    exp_backoff_restart_delay: 100,
    max_restarts: 10,
    kill_timeout: 3000,
    wait_ready: true,
    listen_timeout: 10000,
  }]
}; 