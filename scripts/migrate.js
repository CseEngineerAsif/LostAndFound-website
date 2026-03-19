const { init } = require('../db');

async function migrate() {
  console.log('Connecting to MongoDB...');
  await init();
  console.log('MongoDB connection OK');
  process.exit(0);
}

migrate().catch((err) => {
  console.error(err);
  process.exit(1);
});
