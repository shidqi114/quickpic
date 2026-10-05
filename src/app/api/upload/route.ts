import { NextRequest, NextResponse } from 'next/server';
import { v2 as cloudinary } from 'cloudinary';

// Configure Cloudinary from environment variables
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

export async function POST(req: NextRequest) {
  try {
    const { image, folder = 'quickpic_photobooth', publicId } = await req.json();

    if (!image) {
      return NextResponse.json({ error: 'No image data provided', url: null }, { status: 400 });
    }

    const cloudName = process.env.CLOUDINARY_CLOUD_NAME || process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
    if (!cloudName) {
      return NextResponse.json(
        { error: 'Cloudinary credentials not configured on server', url: null },
        { status: 200 }
      );
    }

    // Allow up to 30 seconds for image upload to Cloudinary
    const uploadPromise = cloudinary.uploader.upload(image, {
      folder,
      public_id: publicId,
      overwrite: true,
      resource_type: 'image',
    });

    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Cloudinary upload timed out after 30 seconds')), 30000)
    );

    const result = (await Promise.race([uploadPromise, timeoutPromise])) as any;

    return NextResponse.json({
      url: result.secure_url || result.url,
      publicId: result.public_id,
      format: result.format,
      width: result.width,
      height: result.height,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Upload failed';
    console.warn('[Cloudinary API Route] Upload error:', message);
    return NextResponse.json({ error: message, url: null }, { status: 200 });
  }
}
