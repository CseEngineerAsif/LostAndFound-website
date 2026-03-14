const db = require('../db');

async function createItem(item) {
  const [id] = await db('items').insert(item);
  return id;
}

async function findRecentItems(limit = 20) {
  return db('items').orderBy('createdAt', 'desc').limit(limit);
}

async function findById(id) {
  return db('items').where({ id }).first();
}

async function searchItems({ query, category, location, type }) {
  const qb = db('items');

  if (query) {
    qb.where(function () {
      this.where('name', 'like', `%${query}%`).orWhere('description', 'like', `%${query}%`);
    });
  }

  if (category) qb.andWhere('category', category);
  if (location) qb.andWhere('location', 'like', `%${location}%`);
  if (type) qb.andWhere('type', type);

  return qb.orderBy('createdAt', 'desc').limit(100);
}

module.exports = {
  createItem,
  findRecentItems,
  findById,
  searchItems,
};
