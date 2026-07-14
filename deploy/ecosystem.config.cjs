/**
 * Configuration PM2 du backend.
 *
 *   cd /opt/wenoble-chatbot
 *   pm2 start deploy/ecosystem.config.cjs
 *   pm2 save          # persiste la liste des process
 *   pm2 startup       # génère le service de démarrage automatique (à exécuter une fois)
 *
 * Logs :    pm2 logs wenoble-chatbot
 * Redémarrer : pm2 restart wenoble-chatbot
 */
module.exports = {
  apps: [
    {
      name: 'wenoble-chatbot',
      cwd: './backend',
      script: 'dist/server.js',

      /**
       * `fork` et UNE SEULE instance, volontairement.
       *
       * En mode `cluster`, chaque worker aurait sa propre mémoire, donc :
       *   - son propre compteur de rate limit (@fastify/rate-limit stocke en
       *     mémoire) : la limite réelle serait multipliée par le nombre de
       *     workers, et un abuseur pourrait envoyer N × 20 requêtes ;
       *   - son propre cache de sitemap, reconstruit N fois au démarrage.
       *
       * Le backend est I/O-bound (il attend Claude, Voyage et Supabase) : un
       * seul process tient une charge très supérieure au trafic d'un site
       * vitrine. Passer en cluster imposerait de déporter le rate limit dans
       * Redis d'abord.
       */
      exec_mode: 'fork',
      instances: 1,

      // Les variables viennent de backend/.env, chargé par dotenv dans le code.
      // Rien de sensible ici : ce fichier est versionné.
      env: {
        NODE_ENV: 'production',
      },

      autorestart: true,
      max_restarts: 10,
      // Redémarre si le process dépasse 500 Mo : garde-fou contre une fuite.
      max_memory_restart: '500M',

      // SIGTERM : Fastify ferme proprement ses connexions (voir server.ts).
      kill_timeout: 20000,

      merge_logs: true,
      time: true, // horodate les logs
    },
  ],
};
