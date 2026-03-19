const { v2: cloudinary } = require('cloudinary');

const cloudinaryUrl = process.env.CLOUDINARY_URL;
const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
const apiKey = process.env.CLOUDINARY_API_KEY;
const apiSecret = process.env.CLOUDINARY_API_SECRET;

if (cloudinaryUrl) {
  try {
    const parsed = new URL(cloudinaryUrl);
    const urlCloudName = parsed.hostname;
    const urlApiKey = decodeURIComponent(parsed.username);
    const urlApiSecret = decodeURIComponent(parsed.password);

    if (!urlCloudName || !urlApiKey || !urlApiSecret) {
      throw new Error('Missing values in CLOUDINARY_URL');
    }

    cloudinary.config({
      cloud_name: urlCloudName,
      api_key: urlApiKey,
      api_secret: urlApiSecret,
    });
  } catch (err) {
    throw new Error('Invalid CLOUDINARY_URL');
  }
} else {
  if (!cloudName || !apiKey || !apiSecret) {
    throw new Error('Cloudinary environment variables are not set');
  }

  cloudinary.config({
    cloud_name: cloudName,
    api_key: apiKey,
    api_secret: apiSecret,
  });
}

module.exports = cloudinary;
