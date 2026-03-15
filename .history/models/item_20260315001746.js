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

async function searchItems({ query, category, location, type, status, sort, date }) {
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

  if (status) {
    items = items.filter((item) => item.status === status);
  }

  if (date) {
    const target = new Date(date).toDateString();
    items = items.filter((item) => {
      const created = new Date(item.createdAt).toDateString();
      return created === target;
    });
  }

  const sorted = items.sort((a, b) => {
    const diff = new Date(b.createdAt) - new Date(a.createdAt);
    return sort === 'oldest' ? -diff : diff;
  });

  return sorted.slice(0, 100);
}

async function findByUserId(userId, options = {}) {
  const { limit = 6, status } = options;
  await db.read();
let items = (db.data?.items || []).filter((item) => item.userId == userId);
  if (status) {
    items = items.filter((item) => item.status === status);
  }
  return items
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, limit);
}

async function updateStatus(id, status) {
  await db.read();
  const item = (db.data?.items || []).find((row) => row.id === Number(id));
  if (!item) return null;
  item.status = status;
  item.updatedAt = new Date().toISOString();
  await db.write();
  return item;
}

async function getStats() {
  await db.read();
  const items = db.data?.items || [];
  const total = items.length;
  const lost = items.filter((item) => item.type === 'lost').length;
  const found = items.filter((item) => item.type === 'found').length;
  const resolved = items.filter((item) => item.status === 'resolved').length;
  const active = total - resolved;
  return { total, lost, found, resolved, active };
}

async function getUserStats(userId) {
  await db.read();
const items = (db.data?.items || []).filter((item) => item.userId == userId);
  const total = items.length;
  const resolved = items.filter((item) => item.status === 'resolved').length;
  const active = total - resolved;
  return { total, resolved, active };
}

async function findSimilarItems(sourceItem, limit = 3) {
  if (!sourceItem) return [];
  await db.read();
  return (db.data?.items || [])
    .filter((item) => item.id !== sourceItem.id && item.category === sourceItem.category)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, limit);
}

async function deleteItem(id) {
  await db.read();
  const items = db.data?.items || [];
  const index = items.findIndex((item) => item.id === Number(id));
  if (index === -1) return false;
  items.splice(index, 1);
  await db.write();
  return true;
}

async function updateItem(id, updates) {
  await db.read();
  const item = (db.data?.items || []).find((row) => row.id === Number(id));
  if (!item) return null;
  Object.assign(item, updates);
  item.updatedAt = new Date().toISOString();
  await db.write();
  return item;
}

module.exports = {
  createItem,
  findRecentItems,
  findById,
  searchItems,
  findByUserId,
  updateStatus,
  deleteItem,
  updateItem,
  getStats,
  getUserStats,
  findSimilarItems,
};
