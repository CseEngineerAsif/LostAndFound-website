const { mongoose } = require('../db');

const messageSchema = new mongoose.Schema(
  {
    senderId: { type: String, required: true },
    senderName: { type: String, required: true },
    recipientId: { type: String, required: true },
    recipientName: { type: String, required: true },
    content: { type: String, required: true },
    readByRecipient: { type: Boolean, default: false },
  },
  { timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' } }
);

const Message = mongoose.models.Message || mongoose.model('Message', messageSchema);

exports.createMessage = async (msg) => {
  const newMessage = await Message.create({
    ...msg,
    readByRecipient: false,
  });
  return newMessage;
};

exports.getConversations = async (userId) => {
  const uId = String(userId);
  const messages = await Message.find({
    $or: [{ senderId: uId }, { recipientId: uId }],
  }).sort({ createdAt: -1 });

  const conversationMap = new Map();

  messages.forEach((m) => {
    const sId = String(m.senderId);
    const rId = String(m.recipientId);

    const otherId = sId === uId ? rId : sId;
    const otherName = sId === uId ? m.recipientName : m.senderName;
    const isUnreadForUser = rId === uId && sId === otherId && m.readByRecipient !== true;

    if (!conversationMap.has(otherId)) {
      conversationMap.set(otherId, {
        userId: otherId,
        name: otherName || 'User',
        lastMessage: { content: m.content, createdAt: m.createdAt },
        timestamp: m.createdAt,
        unreadCount: isUnreadForUser ? 1 : 0,
      });
    } else {
      const conv = conversationMap.get(otherId);
      if (new Date(m.createdAt) > new Date(conv.timestamp)) {
        conv.lastMessage = { content: m.content, createdAt: m.createdAt };
        conv.timestamp = m.createdAt;
        conv.name = otherName || conv.name;
      }
      if (isUnreadForUser) {
        conv.unreadCount += 1;
      }
    }
  });

  return Array.from(conversationMap.values()).sort(
    (a, b) => new Date(b.timestamp) - new Date(a.timestamp)
  );
};

exports.getMessages = async (userId, otherId) => {
  const uId = String(userId);
  const oId = String(otherId);

  return Message.find({
    $or: [
      { senderId: uId, recipientId: oId },
      { senderId: oId, recipientId: uId },
    ],
  }).sort({ createdAt: 1 });
};

exports.markConversationRead = async (userId, otherId) => {
  const uId = String(userId);
  const oId = String(otherId);

  await Message.updateMany(
    { senderId: oId, recipientId: uId, readByRecipient: { $ne: true } },
    { $set: { readByRecipient: true } }
  );
};

exports.getUnreadCount = async (userId) => {
  const uId = String(userId);
  return Message.countDocuments({
    recipientId: uId,
    readByRecipient: { $ne: true },
  });
};

exports.Message = Message;
