const path = require('path');
const fs = require('fs');

require('dotenv').config();

const { init, mongoose } = require('../db');
const { Item } = require('../models/item');
const cloudinary = require('../services/cloudinary');

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

async function fixPhotos() {
  await init();

  const items = await Item.find({ photoPath: { $regex: '^/uploads/' } });
  console.log(`Items with local photoPath: ${items.length}`);

  let uploaded = 0;
  let missing = 0;
  let updated = 0;

  for (const item of items) {
    const resolved = resolveLocalPhoto(item.photoPath);
    if (resolved) {
      try {
        const cloudUrl = await uploadPhoto(resolved.localPath, resolved.fileName);
        if (cloudUrl) {
          item.photoPath = cloudUrl;
          await item.save();
          uploaded += 1;
          updated += 1;
        }
      } catch (err) {
        console.error(`Cloudinary upload failed for ${resolved.fileName}: ${err.message}`);
      }
    } else {
      item.photoPath = null;
      await item.save();
      missing += 1;
      updated += 1;
    }
  }

  return { updated, uploaded, missing };
}

fixPhotos()
  .then(async (stats) => {
    console.log(`Updated: ${stats.updated}`);
    console.log(`Uploaded photos: ${stats.uploaded}`);
    console.log(`Missing photos set to null: ${stats.missing}`);
    await mongoose.disconnect();
    process.exit(0);
  })
  .catch(async (err) => {
    console.error(err);
    await mongoose.disconnect();
    process.exit(1);
  });
