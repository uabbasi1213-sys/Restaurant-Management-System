// Simple ICO creator using pure Node.js (no dependencies)
// Creates a basic colored icon without external libraries
const fs = require('fs');
const path = require('path');

// Create a simple BMP-based ICO file with a restaurant theme
// ICO format: contains 16x16, 32x32, 48x48, 256x256 sizes

function createColorBitmap(size, bgColor, fgColor) {
  const pixelData = [];
  const cx = size / 2;
  const cy = size / 2;
  const r = size * 0.35;

  for (let y = size - 1; y >= 0; y--) {
    for (let x = 0; x < size; x++) {
      const dx = x - cx;
      const dy = y - cy;

      // Draw circle (plate)
      const dist = Math.sqrt(dx * dx + dy * dy);
      
      // Fork left side (thin rectangle)
      const inForkLeft = Math.abs(dx + size * 0.1) < size * 0.025 && Math.abs(dy) < size * 0.3;
      // Spoon right side (oval)
      const inSpoon = Math.abs(dx - size * 0.1) < size * 0.025 && Math.abs(dy) < size * 0.3;
      // Chef hat top
      const inHat = Math.abs(dx) < size * 0.15 && dy > size * 0.05 && dy < size * 0.25;

      if (inForkLeft || inSpoon || inHat) {
        pixelData.push(fgColor[2], fgColor[1], fgColor[0]); // BGR
      } else if (dist < r) {
        // Inner plate - slightly lighter
        pixelData.push(bgColor[2] + 20, bgColor[1] + 20, bgColor[0] + 20);
      } else {
        pixelData.push(bgColor[2], bgColor[1], bgColor[0]); // BGR
      }
    }
    // Row padding to align to 4 bytes
    const rowSize = size * 3;
    const padding = (4 - (rowSize % 4)) % 4;
    for (let p = 0; p < padding; p++) pixelData.push(0);
  }
  return Buffer.from(pixelData);
}

function createICO() {
  const sizes = [16, 32, 48, 256];
  const bgColor = [26, 26, 46];   // Dark navy: RGB(26, 26, 46)
  const fgColor = [255, 255, 255]; // White

  const images = sizes.map(size => {
    const pixelData = createColorBitmap(size, bgColor, fgColor);
    const rowSize = size * 3;
    const paddedRowSize = rowSize + ((4 - (rowSize % 4)) % 4);
    const bitmapDataSize = paddedRowSize * size;
    const bmpHeaderSize = 40;

    // BMP Info Header (40 bytes)
    const bmpHeader = Buffer.alloc(bmpHeaderSize);
    bmpHeader.writeUInt32LE(40, 0);           // Header size
    bmpHeader.writeInt32LE(size, 4);          // Width
    bmpHeader.writeInt32LE(size * 2, 8);      // Height (doubled for ICO)
    bmpHeader.writeUInt16LE(1, 12);           // Color planes
    bmpHeader.writeUInt16LE(24, 14);          // Bits per pixel
    bmpHeader.writeUInt32LE(0, 16);           // Compression (none)
    bmpHeader.writeUInt32LE(bitmapDataSize, 20); // Image size
    bmpHeader.writeInt32LE(0, 24);            // X pixels per meter
    bmpHeader.writeInt32LE(0, 28);            // Y pixels per meter
    bmpHeader.writeUInt32LE(0, 32);           // Colors in table
    bmpHeader.writeUInt32LE(0, 36);           // Important colors

    // AND mask (all zeros = fully opaque)
    const andMaskRowSize = Math.ceil(size / 8);
    const andMaskPaddedRow = Math.ceil(andMaskRowSize / 4) * 4;
    const andMask = Buffer.alloc(andMaskPaddedRow * size, 0);

    const imageData = Buffer.concat([bmpHeader, pixelData, andMask]);
    return { size, data: imageData };
  });

  // ICO Header
  const icoHeader = Buffer.alloc(6);
  icoHeader.writeUInt16LE(0, 0);              // Reserved
  icoHeader.writeUInt16LE(1, 2);              // Type: 1 = ICO
  icoHeader.writeUInt16LE(images.length, 4);  // Number of images

  // ICO Directory entries (16 bytes each)
  const dirEntries = [];
  let offset = 6 + images.length * 16;

  images.forEach(({ size, data }) => {
    const entry = Buffer.alloc(16);
    entry.writeUInt8(size === 256 ? 0 : size, 0);  // Width (0 = 256)
    entry.writeUInt8(size === 256 ? 0 : size, 1);  // Height (0 = 256)
    entry.writeUInt8(0, 2);                         // Color count
    entry.writeUInt8(0, 3);                         // Reserved
    entry.writeUInt16LE(1, 4);                      // Color planes
    entry.writeUInt16LE(24, 6);                     // Bits per pixel
    entry.writeUInt32LE(data.length, 8);            // Size of image data
    entry.writeUInt32LE(offset, 12);                // Offset to image data
    offset += data.length;
    dirEntries.push(entry);
  });

  const allBuffers = [icoHeader, ...dirEntries, ...images.map(i => i.data)];
  const icoData = Buffer.concat(allBuffers);

  const outputPath = path.join(__dirname, 'electron', 'icon.ico');
  fs.writeFileSync(outputPath, icoData);
  console.log(`✅ Icon created: ${outputPath} (${icoData.length} bytes)`);
}

createICO();
