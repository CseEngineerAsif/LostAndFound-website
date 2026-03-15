const path = require('path');
const fs = require('fs');

const dbPath = path.join(__dirname, '..', 'data', 'db.json');

function getDb() {
  if (!fs.existsSync(dbPath)) return { messages: [] };
  const data = fs.readFileSync(dbPath, 'utf-8');
  return data ? JSON.parse(data) : { messages: [] };
}

function saveDb(data) {
  fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));
}

exports.createMessage = async (msg) => {
  const db = getDb();
  const newMessage = {
    id: Date.now().toString(),
    createdAt: new Date().toISOString(),
    ...msg
  };
  db.messages = db.messages || [];
  db.messages.push(newMessage);
  saveDb(db);
  return newMessage;
};

exports.getConversations = async (userId) => {
  const db = getDb();
  const messages = db.messages || [];
  const conversationMap = new Map();

  messages.forEach(m => {
    const sId = String(m.senderId);
    const rId = String(m.recipientId);
    const uId = String(userId);

    if (sId === uId || rId === uId) {
      const otherId = sId === uId ? rId : sId;
      const otherName = sId === uId ? m.recipientName : m.senderName;
      
      if (!conversationMap.has(otherId)) {
        conversationMap.set(otherId, {
          userId: otherId,
          name: otherName || 'User',
          lastMessage: m.content,
          timestamp: m.createdAt
        });
      } else {
        const conv = conversationMap.get(otherId);
        if (new Date(m.createdAt) > new Date(conv.timestamp)) {
          conv.lastMessage = m.content;
          conv.timestamp = m.createdAt;
          conv.name = otherName || conv.name;
        }
      }
    }
  });

  return Array.from(conversationMap.values()).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
};

exports.getMessages = async (userId, otherId) => {
  const db = getDb();
  const uId = String(userId);
  const oId = String(otherId);
  
  return (db.messages || [])
    .filter(m => 
      (String(m.senderId) === uId && String(m.recipientId) === oId) ||
      (String(m.senderId) === oId && String(m.recipientId) === uId)
    )
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
};
