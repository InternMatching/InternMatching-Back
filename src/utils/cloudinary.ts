import { v2 as cloudinary } from "cloudinary";

/**
 * Upload a base64 image to Cloudinary and return the secure URL.
 * cloudinary.config() is called lazily inside the function so that
 * dotenv has already populated process.env before we read the values.
 *
 * @param base64DataUrl  - full data-url string, e.g. "data:image/png;base64,..."
 * @param folder         - Cloudinary folder to put it in
 * @param publicId       - optional stable public_id (enables overwrite / replace)
 */
export async function uploadToCloudinary(
  base64DataUrl: string,
  folder = "internmatch/logos",
  publicId?: string,
): Promise<string> {
  // Configure here so env vars are read after dotenv.config() has run
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });

  const options: Record<string, unknown> = {
    folder,
    resource_type: "image",
    transformation: [{ width: 400, height: 400, crop: "limit", quality: "auto" }],
  };

  if (publicId) {
    options.public_id = publicId;
    options.overwrite = true;
  }

  const result = await cloudinary.uploader.upload(base64DataUrl, options);
  return result.secure_url;
}

