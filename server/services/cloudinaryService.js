const cloudinary = require('cloudinary').v2;
const { logger } = require('../utils/logger');

// Configure Cloudinary from env
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure:     true,
});

/**
 * Upload an audio buffer to Cloudinary.
 * Cloudinary treats audio as resource_type='video'.
 *
 * @param {Buffer} buffer     - Raw audio buffer
 * @param {string} publicId   - Desired public_id (without extension)
 * @returns {{ url, publicId, duration, bytes }}
 */
async function uploadAudio(buffer, publicId) {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        resource_type: 'video',       // Cloudinary handles audio as video type
        folder: 'interview_audio',
        public_id: publicId,
        overwrite: true,
        format: 'webm',
        tags: ['interview', 'audio'],
      },
      (error, result) => {
        if (error) {
          logger.error('Cloudinary upload error:', error);
          return reject(new Error(`Cloudinary upload failed: ${error.message}`));
        }
        logger.info(`Audio uploaded to Cloudinary: ${result.secure_url}`);
        resolve({
          url:      result.secure_url,
          publicId: result.public_id,
          duration: result.duration || 0,
          bytes:    result.bytes || 0,
        });
      }
    );

    uploadStream.end(buffer);
  });
}

/**
 * Delete an audio asset from Cloudinary.
 * @param {string} publicId
 */
async function deleteAudio(publicId) {
  try {
    const result = await cloudinary.uploader.destroy(publicId, {
      resource_type: 'video',
    });
    logger.info(`Cloudinary asset deleted: ${publicId}`, result);
    return result;
  } catch (error) {
    logger.error('Cloudinary delete error:', error);
    throw error;
  }
}

/**
 * Generate a short expiring signed URL for secure streaming.
 * @param {string} publicId
 * @param {number} expiresInSeconds - default 3600 (1 hour)
 */
function getSignedUrl(publicId, expiresInSeconds = 3600) {
  const expiresAt = Math.floor(Date.now() / 1000) + expiresInSeconds;
  return cloudinary.url(publicId, {
    resource_type: 'video',
    sign_url:      true,
    expires_at:    expiresAt,
    secure:        true,
  });
}

module.exports = { uploadAudio, deleteAudio, getSignedUrl };
