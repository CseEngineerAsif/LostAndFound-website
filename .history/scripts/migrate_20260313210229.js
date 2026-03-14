const fs = require('fs');
const path = require('path');
const db = require('../db');

const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

async function migrate() {
  console.log('Running migrations...');

  const hasUsers = await db.schema.hasTable('users');
  if (!hasUsers) {
    await db.schema.createTable('users', (table) => {
      table.increments('id').primary();
      table.string('email').unique().notNullable();
      table.string('studentId').unique();
      table.string('name').notNullable();
      table.string('passwordHash').notNullable();
      table.timestamp('createdAt').defaultTo(db.fn.now());
    });
    console.log('Created table: users');
  }

  const hasItems = await db.schema.hasTable('items');
  if (!hasItems) {
    await db.schema.createTable('items', (table) => {
      table.increments('id').primary();
      table.integer('userId').unsigned().references('id').inTable('users').onDelete('CASCADE');
      table.string('type').notNullable();
      table.string('name').notNullable();
      table.text('description');
      table.string('location');
      table.date('dateLost');
      table.string('status').notNullable().defaultTo('reported');
      table.string('category');
      table.string('photoPath');
      table.timestamp('createdAt').defaultTo(db.fn.now());
    });
    console.log('Created table: items');
  }

  console.log('Migrations complete.');
  process.exit(0);
}

migrate().catch((err) => {
  console.error(err);
  process.exit(1);
});
