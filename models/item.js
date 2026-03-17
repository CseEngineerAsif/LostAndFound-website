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
  let items = (db.data?.items || []).filter((item) => item.userId === userId);
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

async function addClaim(itemId, claim) {
  await db.read();
  const item = (db.data?.items || []).find((row) => row.id === Number(itemId));
  if (!item) return null;
  item.claims = item.claims || [];
  item.claims.push(claim);
  item.status = 'pending_claim';
  item.updatedAt = new Date().toISOString();
  await db.write();
  return claim;
}

async function updateClaimStatus(itemId, claimId, status) {
  await db.read();
  const item = (db.data?.items || []).find((row) => row.id === Number(itemId));
  if (!item || !item.claims) return null;

  const claim = item.claims.find((c) => String(c.id) === String(claimId));
  if (!claim) return null;

  claim.status = status;
  claim.updatedAt = new Date().toISOString();
  if (status === 'accepted' || status === 'denied') {
    claim.seenByClaimant = false;
  }
  if (status === 'accepted') {
    const acceptedAt = new Date();
    const returnWindowEndsAt = new Date(acceptedAt.getTime() + 72 * 60 * 60 * 1000);
    const returnDueAt = new Date(acceptedAt.getTime() + 5 * 24 * 60 * 60 * 1000);
    claim.acceptedAt = acceptedAt.toISOString();
    claim.returnWindowEndsAt = returnWindowEndsAt.toISOString();
    claim.returnDueAt = returnDueAt.toISOString();
    if (!claim.returnStatus) claim.returnStatus = 'none';
  }

  if (status === 'accepted') {
    item.status = 'resolved';
    item.updatedAt = new Date().toISOString();
  } else if (status === 'denied') {
    const hasPending = item.claims.some((c) => c.status === 'pending');
    if (!hasPending) {
      item.status = 'reported';
      item.updatedAt = new Date().toISOString();
    }
  }

  await db.write();
  return claim;
}

async function getClaimDecisionCountForClaimant(userId) {
  await db.read();
  const items = db.data?.items || [];
  let count = 0;
  items.forEach((item) => {
    (item.claims || []).forEach((claim) => {
      if (
        String(claim.claimantId) === String(userId) &&
        (claim.status === 'accepted' || claim.status === 'denied') &&
        claim.seenByClaimant !== true
      ) {
        count += 1;
      }
    });
  });
  return count;
}

async function markClaimDecisionsSeenForClaimant(userId) {
  await db.read();
  const items = db.data?.items || [];
  let changed = false;
  items.forEach((item) => {
    (item.claims || []).forEach((claim) => {
      if (
        String(claim.claimantId) === String(userId) &&
        (claim.status === 'accepted' || claim.status === 'denied') &&
        claim.seenByClaimant !== true
      ) {
        claim.seenByClaimant = true;
        changed = true;
      }
    });
  });
  if (changed) {
    await db.write();
  }
  return changed;
}

async function requestClaimReturn(itemId, claimId, userId) {
  await db.read();
  const item = (db.data?.items || []).find((row) => row.id === Number(itemId));
  if (!item || !item.claims) return { ok: false, reason: 'not_found' };
  const claim = item.claims.find((c) => String(c.id) === String(claimId));
  if (!claim) return { ok: false, reason: 'not_found' };
  if (String(claim.claimantId) !== String(userId)) return { ok: false, reason: 'forbidden' };
  if (claim.status !== 'accepted') return { ok: false, reason: 'not_accepted' };

  const windowEnds = claim.returnWindowEndsAt ? new Date(claim.returnWindowEndsAt) : null;
  if (windowEnds && new Date() > windowEnds) return { ok: false, reason: 'window_closed' };

  claim.returnStatus = 'requested';
  claim.returnRequestedAt = new Date().toISOString();
  item.status = 'return_pending';
  item.updatedAt = new Date().toISOString();
  await db.write();
  return { ok: true, claim, item };
}

async function confirmClaimReturn(itemId, claimId, actorUserId) {
  await db.read();
  const item = (db.data?.items || []).find((row) => row.id === Number(itemId));
  if (!item || !item.claims) return { ok: false, reason: 'not_found' };
  const claim = item.claims.find((c) => String(c.id) === String(claimId));
  if (!claim) return { ok: false, reason: 'not_found' };

  claim.returnStatus = 'completed';
  claim.returnCompletedAt = new Date().toISOString();
  claim.status = 'returned';
  claim.updatedAt = new Date().toISOString();
  item.status = 'reported';
  item.updatedAt = new Date().toISOString();
  await db.write();
  return { ok: true, claim, item };
}

async function markReturnReminderSent(itemId, claimId) {
  await db.read();
  const item = (db.data?.items || []).find((row) => row.id === Number(itemId));
  if (!item || !item.claims) return false;
  const claim = item.claims.find((c) => String(c.id) === String(claimId));
  if (!claim) return false;
  claim.returnReminderSentAt = new Date().toISOString();
  await db.write();
  return true;
}

async function getClaimRequestsForOwner(userId) {
  await db.read();
  const items = (db.data?.items || []).filter((item) => item.userId === userId);
  const requests = [];
  items.forEach((item) => {
    (item.claims || [])
      .filter((claim) => claim.status === 'pending')
      .forEach((claim) => {
        requests.push({
          itemId: item.id,
          itemName: item.name,
          itemType: item.type,
          verificationQuestions: item.verificationQuestions || [],
          claim,
        });
      });
  });
  return requests.sort((a, b) => new Date(b.claim.createdAt) - new Date(a.claim.createdAt));
}

async function getClaimHistoryForOwner(userId) {
  await db.read();
  const items = (db.data?.items || []).filter((item) => item.userId === userId);
  const history = [];
  items.forEach((item) => {
    (item.claims || []).forEach((claim) => {
      history.push({
        itemId: item.id,
        itemName: item.name,
        itemType: item.type,
        itemStatus: item.status,
        verificationQuestions: item.verificationQuestions || [],
        claim,
      });
    });
  });
  return history.sort((a, b) => new Date(b.claim.createdAt) - new Date(a.claim.createdAt));
}

async function getClaimsByClaimant(userId) {
  await db.read();
  const items = db.data?.items || [];
  const claims = [];

  items.forEach((item) => {
    (item.claims || [])
      .filter((claim) => String(claim.claimantId) === String(userId))
      .forEach((claim) => {
        claims.push({
          itemId: item.id,
          itemName: item.name,
          itemType: item.type,
          itemStatus: item.status,
          ownerName: item.reportedByName,
          claim,
        });
      });
  });

  return claims.sort((a, b) => new Date(b.claim.createdAt) - new Date(a.claim.createdAt));
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
  const items = (db.data?.items || []).filter((item) => item.userId === userId);
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

async function getItemsByUser(userId) {
  await db.read();
  return (db.data?.items || [])
    .filter((item) => item.userId === userId)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

module.exports = {
  createItem,
  findRecentItems,
  findById,
  searchItems,
  findByUserId,
  updateStatus,
  addClaim,
  updateClaimStatus,
  deleteItem,
  updateItem,
  getStats,
  getUserStats,
  findSimilarItems,
  getItemsByUser,
  getClaimRequestsForOwner,
  getClaimsByClaimant,
  getClaimHistoryForOwner,
  getClaimDecisionCountForClaimant,
  markClaimDecisionsSeenForClaimant,
  requestClaimReturn,
  confirmClaimReturn,
  markReturnReminderSent,
};
