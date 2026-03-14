const path = require('path');
const { Low, JSONFile } = require('lowdb');

const dataDir = path.join(__dirname, 'data');
const dbFile = path.join(dataDir, 'db.json');

const adapter = new JSONFile(dbFile);
const db = new Low(adapter);

async function init() {
  if (!db.data) {
    db.data = { users: [], items: [] };
    await db.write();
  }
}

module.exports = {
  db,
  init,
};
