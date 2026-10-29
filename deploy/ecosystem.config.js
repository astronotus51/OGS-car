// Configuration pm2 : `pm2 start deploy/ecosystem.config.js`
module.exports = {
  apps: [{
    name: 'ogs',
    script: 'server/index.js',
    cwd: '/var/www/ogs',
    instances: 1, // une seule instance : le matchmaking et les parties sont en mémoire
    autorestart: true,
    max_memory_restart: '400M',
    env: { NODE_ENV: 'production', PORT: 3000 },
  }],
};
