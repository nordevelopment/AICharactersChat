/**
 * Image processor for resizing and optimizing images
 * @author Norayr Petrosyan
 * @version 1.0.0
 */

import sharp from 'sharp';

export class ImageProcessor {
  /**
   * Process and resize incoming images
   */
  async processImage(base64: string, logger?: any): Promise<string> {
    try {
      const matches = base64.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,(.+)$/);
      const data = matches ? matches[2] : base64;
      const imgBuffer = Buffer.from(data, 'base64');

      const resized = await sharp(imgBuffer)
        .resize({ width: 1024, height: 1024, fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 80 })
        .toBuffer();

      return `data:image/jpeg;base64,${resized.toString('base64')}`;
    } catch (err: any) {
      logger?.error({ error: err.message }, '[IMAGE PROCESSOR] Image processing error');
      throw new Error('Image processing failed');
    }
  }
}
