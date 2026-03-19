const fs = require('fs');
const path = require('path');

require('dotenv').config();

const { init, mongoose } = require('../db');
const { Item } = require('../models/item');
const cloudinary = require('../services/cloudinary');

const seedPath = path.join(__dirname, '..', 'data', 'db.json');
const photosDir = path.join(__dirname, '..', 'item photo');
const uploadFolder = process.env.CLOUDINARY_FOLDER || 'lost2found';

function resolveLocalPhoto(photoPath) {
  if (!photoPath) return null;
  const fileWithTs = path.basename(photoPath);
  const dashIndex = fileWithTs.indexOf('-');
  const fileName = dashIndex >= 0 ? fileWithTs.slice(dashIndex + 1) : fileWithTs;
  const localPath = path.join(photosDir, fileName);
  if (fs.existsSync(localPath)) return { localPath, fileName };
  return null;
}

async function uploadPhoto(localPath, fileName) {
  const rawBase = path.parse(fileName).name.replace(/\s+/g, '-');
  const safeBase = rawBase.replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
  const publicId = `${Date.now()}-${safeBase || 'item-photo'}`;
  const result = await cloudinary.uploader.upload(localPath, {
    folder: uploadFolder,
    resource_type: 'image',
    public_id: publicId,
  });
  return result.secure_url || result.url || null;
}

async function importItems() {
  const raw = fs.readFileSync(seedPath, 'utf8');
  const parsed = JSON.parse(raw);
  const items = Array.isArray(parsed.items) ? parsed.items : [];

  console.log(`Seed items found: ${items.length}`);
  if (!items.length) return { inserted: 0, uploaded: 0, missingPhotos: 0 };

  await init();

  const existing = await Item.countDocuments();
  if (existing > 0) {
    console.log(`Warning: database already has ${existing} items. Proceeding to insert anyway.`);
  }

  let uploaded = 0;
  let missingPhotos = 0;
  let inserted = 0;

  for (const item of items) {
    const { id, ...rest } = item;
    let photoPath = rest.photoPath || null;

    const resolved = resolveLocalPhoto(rest.photoPath);
    if (resolved) {
      try {
        const cloudUrl = await uploadPhoto(resolved.localPath, resolved.fileName);
        if (cloudUrl) {
          photoPath = cloudUrl;
          uploaded += 1;
        }
      } catch (err) {
        console.error(`Cloudinary upload failed for ${resolved.fileName}: ${err.message}`);
      }
    } else if (rest.photoPath) {
      missingPhotos += 1;
      photoPath = null;
    }

    const newItem = {
      ...rest,
      userId: String(rest.userId),
      photoPath,
    };

    await Item.create(newItem);
    inserted += 1;
  }

  return { inserted, uploaded, missingPhotos };
}

importItems()
  .then(async (stats) => {
    console.log(`Inserted: ${stats.inserted}`);
    console.log(`Uploaded photos: ${stats.uploaded}`);
    console.log(`Missing photos: ${stats.missingPhotos}`);
    await mongoose.disconnect();
    process.exit(0);
  })
  .catch(async (err) => {
    console.error(err);
    await mongoose.disconnect();
    process.exit(1);
  });
