// Konfigurace pro PM2 - správce procesů pro produkční běh na Raspberry Pi.
//
// Základní použití:
//   npm run pm2:start          spustí aplikaci pod PM2
//   npm run pm2:logs           živý log
//   npm run pm2:restart        ruční restart
//   pm2 save                   uloží aktuální seznam procesů
//   pm2 startup                vypíše příkaz pro trvalý start po rebootu Raspberry Pi (spustit 1x)
//
// Auto-restart při pádu:
//   PM2 restartuje proces automaticky při pádu (autorestart: true). Níže uvedené
//   parametry navíc chrání před "crash-loopem" (opakovaný pád hned po startu) -
//   po 10 rychlých pádech za sebou PM2 přestane restartovat a čeká na zásah.
module.exports = {
    apps: [
        {
            name: 'el3d-sfs',
            script: './server/index.js',
            cwd: __dirname,
            instances: 1,
            exec_mode: 'fork',

            // Restart chování
            autorestart: true,
            watch: false,
            min_uptime: '15s',          // proces musí běžet aspoň 15s, jinak se pád počítá do max_restarts
            max_restarts: 10,           // po 10 pádech za sebou v rychlém sledu PM2 přestane zkoušet
            restart_delay: 2000,        // 2s prodleva mezi restarty
            exp_backoff_restart_delay: 100, // exponenciální navyšování prodlevy při opakovaných pádech
            max_memory_restart: '300M', // restart, pokud by proces (nečekaně) nafoukl paměť

            // Ukončování procesu
            kill_timeout: 5000,
            listen_timeout: 8000,

            env: {
                NODE_ENV: 'production'
            },

            out_file: './logs/out.log',
            error_file: './logs/error.log',
            merge_logs: true,
            time: true
        }
    ]
};
