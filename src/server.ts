import app from './app';
import { config } from './config';
import { connectDatabase } from './config/database';
import { syncDatabase } from './models';
import { redis } from './config/redis';

const start = async (): Promise<void> => {
  try {
    // 1. Connexion PostgreSQL
    await connectDatabase();

    // 2. Synchronisation des tables
    await syncDatabase();

    // 3. Vérification Redis
    await redis.ping();
    console.log('✅ Redis ping OK');

    // 4. Démarrage du serveur
    app.listen(config.port, () => {
      console.log(`✅ Auth service démarré sur le port ${config.port}`);
      console.log(`   → Health : http://localhost:${config.port}/health`);
      console.log(`   → API    : http://localhost:${config.port}/api/auth`);
    });

  } catch (error) {
    console.error('❌ Erreur démarrage serveur :', error);
    process.exit(1);
  }
};

// Gestion propre de l'arrêt
process.on('SIGTERM', async () => {
  console.log('🛑 Arrêt du service...');
  await redis.quit();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('🛑 Arrêt du service...');
  await redis.quit();
  process.exit(0);
});

start();