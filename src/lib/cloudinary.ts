export interface CloudinaryUploadResult {
  url: string;
  publicId?: string;
}

export async function uploadToCloudinary(
  base64DataUrl: string,
  eventId: string,
  sessionId: string
): Promise<string | null> {
  try {
    // 1. First attempt upload via Next.js backend API route
    const res = await fetch('/api/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        image: base64DataUrl,
        folder: `quickpic/${eventId}`,
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
      console.warn('Server Cloudinary upload skipped/failed:', err);
    }
  } catch (err) {
    console.warn('Cloudinary upload network error:', err);
  }

  return null;
}
