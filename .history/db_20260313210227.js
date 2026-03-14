const path = require('path');
const knex = require('knex');

const dbPath = path.join(__dirname, 'data', 'app.db');

const db = knex({
  client: 'sqlite3',
  connection: {
    filename: dbPath,
  },
  useNullAsDefault: true,
});

module.exports = db;
