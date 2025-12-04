import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const svgBuffer = fs.readFileSync(path.join(process.cwd(), 'public', 'icon.svg'));

sharp(svgBuffer)
  .resize(512, 512)
  .png()
  .toFile(path.join(process.cwd(), 'public', 'icon.png'))
  .then(() => {
    console.log('Successfully converted icon.svg to icon.png');
  })
  .catch(err => {
    console.error('Error converting icon:', err);
    process.exit(1);
  });
