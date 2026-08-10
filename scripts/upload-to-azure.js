/**
 * Upload Berlin Pulse images to Azure Blob Storage
 *
 * Usage:
 *   1. Set AZURE_STORAGE_CONNECTION_STRING env var (or create a .env file in project root)
 *   2. cd scripts && npm install
 *   3. npm run upload
 *
 * This uploads all images from frontend/public/images/ to the "images" container
 * in Azure Blob Storage, preserving the folder structure:
 *   - hero/tower.webp         → images/hero/tower.webp
 *   - gallery/PXL_xxx.jpg     → images/gallery/PXL_xxx.jpg
 *   - gallery/thumbs/PXL.webp → images/gallery/thumbs/PXL.webp
 */

const { BlobServiceClient } = require('@azure/storage-blob');
const path = require('path');
const fs = require('fs');

// ── Configuration ──────────────────────────────────────────────────────
const CONTAINER_NAME = 'images';
const IMAGES_DIR = path.resolve(__dirname, '..', 'frontend', 'public', 'images');

// MIME type lookup
const MIME_TYPES = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml'
};

// ── Helpers ────────────────────────────────────────────────────────────

/** Recursively collect all files under a directory */
function walkDir(dir, baseDir = dir) {
  let results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results = results.concat(walkDir(fullPath, baseDir));
    } else {
      // Blob name preserves relative path with forward slashes
      const blobName = path.relative(baseDir, fullPath).replace(/\\/g, '/');
      results.push({ fullPath, blobName });
    }
  }
  return results;
}

// ── Main ───────────────────────────────────────────────────────────────

async function main() {
  // Read connection string from env or .env file in project root
  let connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;

  if (!connectionString) {
    const envPath = path.resolve(__dirname, '..', '.env');
    if (fs.existsSync(envPath)) {
      const envContent = fs.readFileSync(envPath, 'utf-8');
      const match = envContent.match(/AZURE_STORAGE_CONNECTION_STRING=(.+)/);
      if (match) connectionString = match[1].trim();
    }
  }

  if (!connectionString) {
    console.error('ERROR: AZURE_STORAGE_CONNECTION_STRING is not set.');
    console.error('Set it as an environment variable or in a .env file at the project root.');
    process.exit(1);
  }

  // Connect to Azure Blob Storage
  const blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);

  // Create container if it doesn't exist (with public blob access)
  const containerClient = blobServiceClient.getContainerClient(CONTAINER_NAME);
  const createResponse = await containerClient.createIfNotExists({
    access: 'blob' // Anonymous read access for blobs only
  });

  if (createResponse.succeeded) {
    console.log(`✓ Created container "${CONTAINER_NAME}" with public blob access`);
  } else {
    console.log(`✓ Container "${CONTAINER_NAME}" already exists`);
  }

  // Collect all image files
  if (!fs.existsSync(IMAGES_DIR)) {
    console.error(`ERROR: Images directory not found: ${IMAGES_DIR}`);
    process.exit(1);
  }

  const files = walkDir(IMAGES_DIR);
  console.log(`\nFound ${files.length} files to upload\n`);

  // Upload each file
  let uploaded = 0;
  let skipped = 0;
  let errors = 0;

  for (const { fullPath, blobName } of files) {
    const ext = path.extname(fullPath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    const blockBlobClient = containerClient.getBlockBlobClient(blobName);

    try {
      // Check if blob already exists with same size (skip if unchanged)
      const fileSize = fs.statSync(fullPath).size;
      const exists = await blockBlobClient.exists();

      if (exists) {
        const props = await blockBlobClient.getProperties();
        if (props.contentLength === fileSize) {
          console.log(`  SKIP  ${blobName} (unchanged)`);
          skipped++;
          continue;
        }
      }

      // Upload the file
      await blockBlobClient.uploadFile(fullPath, {
        blobHTTPHeaders: {
          blobContentType: contentType,
          blobCacheControl: 'public, max-age=31536000, immutable'
        }
      });

      const sizeMB = (fileSize / (1024 * 1024)).toFixed(2);
      console.log(`  ✓     ${blobName} (${sizeMB} MB)`);
      uploaded++;
    } catch (err) {
      console.error(`  ✗     ${blobName} — ${err.message}`);
      errors++;
    }
  }

  // Summary
  const accountName = connectionString.match(/AccountName=([^;]+)/)?.[1] || '<account>';
  const blobUrl = `https://${accountName}.blob.core.windows.net/${CONTAINER_NAME}`;

  console.log('\n' + '─'.repeat(60));
  console.log(`Upload complete: ${uploaded} uploaded, ${skipped} skipped, ${errors} errors`);
  console.log(`\nBlob Storage URL: ${blobUrl}`);
  console.log(`\nSet this in your .env file:`);
  console.log(`  VITE_BLOB_URL=${blobUrl}`);
  console.log('─'.repeat(60));
}

main().catch(err => {
  console.error('Fatal error:', err.message);
  process.exit(1);
});
