import multer from 'multer';
import { UPLOADS_DIR } from './database.js';
import { validateAndSanitizeFilename, ensureDirectoryExists } from '../utils/helpers.js';

// Ensure uploads directory exists
ensureDirectoryExists(UPLOADS_DIR);

// Default storage engine for multer (file uploads)
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, UPLOADS_DIR);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1E9)}`;
    const sanitized = validateAndSanitizeFilename(file.originalname);
    cb(null, `${uniqueSuffix}-${sanitized}`);
  }
});

// Initialize multer with limits and file type validation
// SECURITY FIX: Added file type validation to only allow PDF files for insurance documents
export const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB
  fileFilter: function (req, file, cb) {
    const lowerName = String(file.originalname || '').toLowerCase();

    // Allow signature images (png/jpg) by filename hint
    const isSignature = lowerName.startsWith('signature-') || lowerName.includes('signature');
    const imageMimeTypes = ['image/png', 'image/jpeg', 'image/jpg'];
    const imageExts = ['.png', '.jpg', '.jpeg'];
    const isImage = imageMimeTypes.includes(file.mimetype) && imageExts.some(ext => lowerName.endsWith(ext));
    if (isSignature && isImage) {
      return cb(null, true);
    }

    // Only allow PDF files for insurance/policy documents
    const allowedMimeTypes = ['application/pdf'];
    const allowedExtensions = ['.pdf'];

    const mimeTypeValid = allowedMimeTypes.includes(file.mimetype);
    const extValid = allowedExtensions.some(ext => lowerName.endsWith(ext));

    if (mimeTypeValid && extValid) {
      return cb(null, true);
    }

    return cb(new Error('Only PDF files are allowed for insurance documents'));
  }
});
