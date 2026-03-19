const { mongoose } = require('../db');

const verificationQuestionSchema = new mongoose.Schema(
  {
    question: { type: String, trim: true },
    answer: { type: String, trim: true },
  },
  { _id: false }
);

const scoreSchema = new mongoose.Schema(
  {
    total: Number,
    proofPoints: Number,
    answerPoints: Number,
    timelinePoints: Number,
    correctAnswers: Number,
    totalQuestions: Number,
    answerMatches: [Boolean],
    timelineMatch: Boolean,
  },
  { _id: false }
);

const claimSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    claimantId: { type: String, required: true },
    claimantName: { type: String, required: true },
    description: String,
    claimedDate: String,
    proofPath: String,
    status: { type: String, default: 'pending' },
    answers: [String],
    score: scoreSchema,
    createdAt: { type: Date, default: Date.now },
    updatedAt: Date,
    acceptedAt: Date,
    returnWindowEndsAt: Date,
    returnDueAt: Date,
    returnStatus: { type: String, default: 'none' },
    returnRequestedAt: Date,
    returnCompletedAt: Date,
    returnReminderSentAt: Date,
    seenByClaimant: { type: Boolean, default: false },
  },
  { _id: false }
);

const itemSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true },
    type: { type: String, required: true },
    name: { type: String, required: true },
    description: String,
    location: String,
    dateLost: String,
    category: String,
    contactMethod: String,
    anonymous: { type: Boolean, default: false },
    reportedByName: String,
    photoPath: String,
    returnInfo: String,
    returnBy: String,
    verificationQuestions: [verificationQuestionSchema],
    status: { type: String, default: 'reported' },
    claims: [claimSchema],
  },
  { timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' } }
);

const Item = mongoose.models.Item || mongoose.model('Item', itemSchema);

function isValidObjectId(value) {
  return mongoose.Types.ObjectId.isValid(String(value));
}

async function createItem(item) {
  const record = await Item.create(item);
  return record.id;
}

async function findRecentItems(limit = 20) {
  return Item.find().sort({ createdAt: -1 }).limit(limit);
}

async function findById(id) {
  if (!id || !isValidObjectId(id)) return null;
  return Item.findById(id);
}

async function searchItems({ query, category, location, type, status, sort, date }) {
  const filters = {};

  if (query) {
    const regex = new RegExp(query, 'i');
    filters.$or = [{ name: regex }, { description: regex }];
  }

  if (category) filters.category = category;
  if (location) filters.location = new RegExp(location, 'i');
  if (type) filters.type = type;
  if (status) filters.status = status;

  if (date) {
    const start = new Date(date);
    if (!Number.isNaN(start.getTime())) {
      start.setHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setDate(end.getDate() + 1);
      filters.createdAt = { $gte: start, $lt: end };
    }
  }

  const sortOrder = sort === 'oldest' ? 1 : -1;
  return Item.find(filters).sort({ createdAt: sortOrder }).limit(100);
}

async function findByUserId(userId, options = {}) {
  const { limit = 6, status } = options;
  const filters = { userId: String(userId) };
  if (status) filters.status = status;
  return Item.find(filters).sort({ createdAt: -1 }).limit(limit);
}

async function updateStatus(id, status) {
  if (!id || !isValidObjectId(id)) return null;
  return Item.findByIdAndUpdate(
    id,
    { status, updatedAt: new Date() },
    { new: true }
  );
}

async function addClaim(itemId, claim) {
  if (!itemId || !isValidObjectId(itemId)) return null;
  const item = await Item.findById(itemId);
  if (!item) return null;
  item.claims = item.claims || [];
  item.claims.push(claim);
  item.status = 'pending_claim';
  item.updatedAt = new Date();
  await item.save();
  return claim;
}

async function updateClaimStatus(itemId, claimId, status) {
  if (!itemId || !isValidObjectId(itemId)) return null;
  const item = await Item.findById(itemId);
  if (!item || !item.claims) return null;

  const claim = item.claims.find((c) => String(c.id) === String(claimId));
  if (!claim) return null;

  claim.status = status;
  claim.updatedAt = new Date();
  if (status === 'accepted' || status === 'denied') {
    claim.seenByClaimant = false;
  }
  if (status === 'accepted') {
    const acceptedAt = new Date();
    const returnWindowEndsAt = new Date(acceptedAt.getTime() + 72 * 60 * 60 * 1000);
    const returnDueAt = new Date(acceptedAt.getTime() + 5 * 24 * 60 * 60 * 1000);
    claim.acceptedAt = acceptedAt;
    claim.returnWindowEndsAt = returnWindowEndsAt;
    claim.returnDueAt = returnDueAt;
    if (!claim.returnStatus) claim.returnStatus = 'none';
  }

  if (status === 'accepted') {
    item.status = 'resolved';
    item.updatedAt = new Date();
  } else if (status === 'denied') {
    const hasPending = item.claims.some((c) => c.status === 'pending');
    if (!hasPending) {
      item.status = 'reported';
      item.updatedAt = new Date();
    }
  }

  await item.save();
  return claim;
}

async function getClaimDecisionCountForClaimant(userId) {
  const uId = String(userId);
  const items = await Item.find({ 'claims.claimantId': uId });
  let count = 0;
  items.forEach((item) => {
    (item.claims || []).forEach((claim) => {
      if (
        String(claim.claimantId) === uId &&
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
  const uId = String(userId);
  const items = await Item.find({ 'claims.claimantId': uId });
  let changed = false;
  items.forEach((item) => {
    (item.claims || []).forEach((claim) => {
      if (
        String(claim.claimantId) === uId &&
        (claim.status === 'accepted' || claim.status === 'denied') &&
        claim.seenByClaimant !== true
      ) {
        claim.seenByClaimant = true;
        changed = true;
      }
    });
    if (changed) item.markModified('claims');
  });
  if (changed) {
    await Promise.all(items.map((item) => item.save()));
  }
  return changed;
}

async function requestClaimReturn(itemId, claimId, userId) {
  if (!itemId || !isValidObjectId(itemId)) return { ok: false, reason: 'not_found' };
  const item = await Item.findById(itemId);
  if (!item || !item.claims) return { ok: false, reason: 'not_found' };
  const claim = item.claims.find((c) => String(c.id) === String(claimId));
  if (!claim) return { ok: false, reason: 'not_found' };
  if (String(claim.claimantId) !== String(userId)) return { ok: false, reason: 'forbidden' };
  if (claim.status !== 'accepted') return { ok: false, reason: 'not_accepted' };

  const windowEnds = claim.returnWindowEndsAt ? new Date(claim.returnWindowEndsAt) : null;
  if (windowEnds && new Date() > windowEnds) return { ok: false, reason: 'window_closed' };

  claim.returnStatus = 'requested';
  claim.returnRequestedAt = new Date();
  item.status = 'return_pending';
  item.updatedAt = new Date();
  await item.save();
  return { ok: true, claim, item };
}

async function confirmClaimReturn(itemId, claimId) {
  if (!itemId || !isValidObjectId(itemId)) return { ok: false, reason: 'not_found' };
  const item = await Item.findById(itemId);
  if (!item || !item.claims) return { ok: false, reason: 'not_found' };
  const claim = item.claims.find((c) => String(c.id) === String(claimId));
  if (!claim) return { ok: false, reason: 'not_found' };

  claim.returnStatus = 'completed';
  claim.returnCompletedAt = new Date();
  claim.status = 'returned';
  claim.updatedAt = new Date();
  item.status = 'reported';
  item.updatedAt = new Date();
  await item.save();
  return { ok: true, claim, item };
}

async function markReturnReminderSent(itemId, claimId) {
  if (!itemId || !isValidObjectId(itemId)) return false;
  const item = await Item.findById(itemId);
  if (!item || !item.claims) return false;
  const claim = item.claims.find((c) => String(c.id) === String(claimId));
  if (!claim) return false;
  claim.returnReminderSentAt = new Date();
  await item.save();
  return true;
}

async function getClaimRequestsForOwner(userId) {
  const items = await Item.find({ userId: String(userId) });
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
  const items = await Item.find({ userId: String(userId) });
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
  const uId = String(userId);
  const items = await Item.find({ 'claims.claimantId': uId });
  const claims = [];

  items.forEach((item) => {
    (item.claims || [])
      .filter((claim) => String(claim.claimantId) === uId)
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
  const total = await Item.countDocuments();
  const lost = await Item.countDocuments({ type: 'lost' });
  const found = await Item.countDocuments({ type: 'found' });
  const resolved = await Item.countDocuments({ status: 'resolved' });
  const active = total - resolved;
  return { total, lost, found, resolved, active };
}

async function getUserStats(userId) {
  const total = await Item.countDocuments({ userId: String(userId) });
  const resolved = await Item.countDocuments({ userId: String(userId), status: 'resolved' });
  const active = total - resolved;
  return { total, resolved, active };
}

async function findSimilarItems(sourceItem, limit = 3) {
  if (!sourceItem) return [];
  return Item.find({
    _id: { $ne: sourceItem._id },
    category: sourceItem.category,
  })
    .sort({ createdAt: -1 })
    .limit(limit);
}

async function deleteItem(id) {
  if (!id || !isValidObjectId(id)) return false;
  const result = await Item.findByIdAndDelete(id);
  return Boolean(result);
}

async function updateItem(id, updates) {
  if (!id || !isValidObjectId(id)) return null;
  return Item.findByIdAndUpdate(
    id,
    { ...updates, updatedAt: new Date() },
    { new: true }
  );
}

async function getItemsByUser(userId) {
  return Item.find({ userId: String(userId) }).sort({ createdAt: -1 });
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
  Item,
};
