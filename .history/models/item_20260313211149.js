const { db } = require('../db');

function getNextId(list) {
  if (!list.length) return 1;
  return Math.max(...list.map((row) => row.id || 0)) + 1;
}

async function createItem(item) {
  await db.read();
  db.data = db.data || { users: [], items: [] };

  const id = getNextId(db.data.items);
  const record = {
    id,
    ...item,
    createdAt: new Date().toISOString(),
  };

  db.data.items.push(record);
  await db.write();
  return id;
}

async function findRecentItems(limit = 20) {
  await db.read();
  const items = db.data?.items || [];
  return items
    .slice()
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, limit);
}

async function findById(id) {
  await db.read();
  return (db.data?.items || []).find((item) => item.id === Number(id));
}

async function searchItems({ query, category, location, type }) {
  await db.read();
  let items = (db.data?.items || []).slice();

  if (query) {
    const lower = query.toLowerCase();
    items = items.filter((item) => {
      const name = (item.name || '').toLowerCase();
      const description = (item.description || '').toLowerCase();
      return name.includes(lower) || description.includes(lower);
    });
  }

  if (category) {
    items = items.filter((item) => item.category === category);
  }

  if (location) {
    const lower = location.toLowerCase();
    items = items.filter((item) => (item.location || '').toLowerCase().includes(lower));
  }

  if (type) {
    items = items.filter((item) => item.type === type);
  }

  return items
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 100);
}

module.exports = {
  createItem,
  findRecentItems,
  findById,
  searchItems,
};
