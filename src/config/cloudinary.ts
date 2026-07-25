import { v2 as cloudinary } from 'cloudinary';
import { CloudinaryStorage } from 'multer-storage-cloudinary';

cloudinary.config({
  cloud_name: process.env.CLOUD_NAME,
  api_key: process.env.CLOUD_API_KEY,
  api_secret: process.env.CLOUD_SECRET,
  secure: true,
});

const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'diary_web',
    allowed_formats: ['png', 'jpg', 'jpeg'], // Note: allowed_formats is the correct parameter name in newer versions of multer-storage-cloudinary
  } as any,
});

export { cloudinary, storage };
