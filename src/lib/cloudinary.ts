export interface CloudinaryUploadResult {
  url: string;
  publicId?: string;
  format?: string;
  width?: number;
  height?: number;
}

export async function uploadToCloudinary(
  base64DataUrl: string,
  eventId: string,
  sessionId: string
): Promise<string | null> {
  if (!base64DataUrl) return null;

  // If already a remote CDN URL, return directly
  if (base64DataUrl.startsWith('http://') || base64DataUrl.startsWith('https://')) {
    return base64DataUrl;
  }

  // Node.js server context direct upload optimization (if credentials present)
  if (
    typeof window === 'undefined' &&
    process.env.CLOUDINARY_API_KEY &&
    process.env.CLOUDINARY_API_SECRET
  ) {
    try {
      const { v2: cloudinary } = await import('cloudinary');
      cloudinary.config({
        cloud_name:
          process.env.CLOUDINARY_CLOUD_NAME ||
          process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
        api_key: process.env.CLOUDINARY_API_KEY,
        api_secret: process.env.CLOUDINARY_API_SECRET,
        secure: true,
      });

      const result = await cloudinary.uploader.upload(base64DataUrl, {
        folder: `quickpic/${eventId || 'default'}`,
        public_id: sessionId,
        overwrite: true,
        resource_type: 'image',
        transformation: [
          { quality: 'auto:good' },
          { fetch_format: 'auto' },
        ],
      });

      if (result?.secure_url) {
        return result.secure_url;
      }
    } catch (serverErr) {
      console.warn('[Cloudinary] Direct server upload failed, falling back to HTTP route:', serverErr);
    }
  }

  // Client-side / HTTP route upload
  try {
    const apiHost =
      typeof window !== 'undefined'
        ? window.location.origin
        : (process.env.NEXT_PUBLIC_APP_URL ||
           process.env.NEXT_PUBLIC_PUBLIC_GALLERY_URL ||
           (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000'));

    const uploadEndpoint = `${apiHost.replace(/\/+$/, '')}/api/upload`;

    const res = await fetch(uploadEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        image: base64DataUrl,
        folder: `quickpic/${eventId || 'default'}`,
        publicId: sessionId,
      }),
    });

    if (res.ok) {
      const data = await res.json();
      if (data.url) {
        return data.url;
      }
    } else {
      const err = await res.json().catch(() => ({}));
      console.warn('[Cloudinary] Server upload skipped/failed:', err);
    }
  } catch (err) {
    console.warn('[Cloudinary] Upload network error (offline fallback active):', err);
  }

  return null;
}

