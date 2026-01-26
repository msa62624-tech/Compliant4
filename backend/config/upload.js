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
    // Only allow PDF files for insurance/policy documents
    const allowedMimeTypes = ['application/pdf'];
    const allowedExtensions = ['.pdf'];
    
    const mimeTypeValid = allowedMimeTypes.includes(file.mimetype);
    const extValid = allowedExtensions.some(ext => 
      file.originalname.toLowerCase().endsWith(ext)
    );
    
    if (mimeTypeValid && extValid) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed for insurance documents'));
    }
  }
});
