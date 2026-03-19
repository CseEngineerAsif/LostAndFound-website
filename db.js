const mongoose = require('mongoose');

let isConnected = false;

async function init() {
  if (isConnected) return;

  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('MONGODB_URI is not set');
  }

  mongoose.set('strictQuery', true);
  await mongoose.connect(uri);
  isConnected = true;
}

module.exports = {
  mongoose,
  init,
};
