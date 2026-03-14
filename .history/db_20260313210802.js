const path = require('path');
const { Low } = require('lowdb');
const { JSONFile } = require('lowdb/node');

const dataDir = path.join(__dirname, 'data');
const dbFile = path.join(dataDir, 'db.json');

const adapter = new JSONFile(dbFile);
const db = new Low(adapter, { users: [], items: [] });

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
