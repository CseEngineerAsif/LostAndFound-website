const fs = require('fs');
const path = require('path');
const { init } = require('../db');

const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

async function migrate() {
  console.log('Initializing database...');
  await init();
  console.log('Database initialized at', path.join(dataDir, 'db.json'));
  process.exit(0);
}

migrate().catch((err) => {
  console.error(err);
  process.exit(1);
});
