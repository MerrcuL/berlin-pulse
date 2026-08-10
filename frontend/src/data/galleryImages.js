// Azure Blob Storage base URL (set via VITE_BLOB_URL env var)
// When set:  https://<account>.blob.core.windows.net/images → images load from Azure
// When empty: falls back to local /images/ paths for development
const BLOB_URL = import.meta.env.VITE_BLOB_URL || '/images'

export const GALLERY_FILES = [
  "PXL_20240904_141655064.jpg",
  "PXL_20240914_172226954.jpg",
  "PXL_20241126_111150531.jpg",
  "PXL_20241222_070123755.jpg",
  "PXL_20241231_153421658.jpg",
  "PXL_20250222_211849721.MP.jpg",
  "PXL_20250222_211851254.jpg",
  "PXL_20250224_191912599.MP.jpg",
  "PXL_20250318_165442445~3.jpg",
  "PXL_20250412_180727645.jpg",
  "PXL_20250414_074918205.jpg",
  "PXL_20250414_081554864.jpg",
  "PXL_20250414_082611145.MP.jpg",
  "PXL_20250417_083906361.jpg",
  "PXL_20250706_115626901.jpg",
  "PXL_20250809_033438052.jpg",
  "PXL_20250809_033513553.jpg",
  "PXL_20250908_120807148.jpg",
  "PXL_20250909_151340179.jpg",
  "PXL_20251004_162431691.jpg",
  "PXL_20251004_162432988.jpg",
  "PXL_20251014_085524546.jpg",
  "PXL_20251121_065611738.jpg",
  "PXL_20251122_234956992.MP.jpg",
  "PXL_20251128_175643240.jpg",
  "PXL_20251129_144417319.MP.jpg",
  "PXL_20251207_174742756.MP.jpg",
  "PXL_20251211_091621402.jpg",
  "PXL_20251223_082204380.jpg",
  "PXL_20251223_082207289.jpg",
  "PXL_20260109_070252652.LONG_EXPOSURE.jpg",
  "PXL_20260112_070108342.jpg",
  "PXL_20260112_070502473.jpg",
  "PXL_20260112_070547207.jpg",
  "PXL_20260320_174615851.jpg",
  "PXL_20260327_084613335.jpg",
  "PXL_20260411_170025464.jpg",
  "PXL_20260426_163429887.jpg",
  "PXL_20260426_182055103.jpg",
  "PXL_20260426_182109436~2.jpg",
  "PXL_20260426_182416578.jpg",
  "PXL_20260426_182635330.jpg",
  "PXL_20260426_183401555.MP.jpg",
  "PXL_20260508_064217083.jpg",
  "PXL_20260516_164445541.jpg",
  "PXL_20260516_164447348.jpg",
  "PXL_20260529_202746345.MP.jpg",
  "PXL_20260627_191524217.jpg",
  "image.jpg",
  "image (1).jpg",
  "image (2).jpg",
  "image (3).jpg"
]

export function parsePhotoMetadata(filename) {
  const match = filename.match(/PXL_(\d{4})(\d{2})(\d{2})_/)
  if (match) {
    const year = match[1]
    const month = match[2]
    const day = match[3]
    try {
      const d = new Date(`${year}-${month}-${day}T12:00:00`)
      return {
        dateStr: d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }),
        iso: `${year}-${month}-${day}`
      }
    } catch {
      return { dateStr: 'Berlin Snapshot', iso: '' }
    }
  }
  return { dateStr: 'Berlin Snapshot', iso: '' }
}

function getThumbFilename(file) {
  const baseName = file.replace(/\.[^/.]+$/, '')
  return `${BLOB_URL}/gallery/thumbs/${baseName}.webp`
}

export const GALLERY_ITEMS = GALLERY_FILES.map(file => ({
  id: file,
  url: `${BLOB_URL}/gallery/${file}`,
  thumbUrl: getThumbFilename(file),
  filename: file,
  ...parsePhotoMetadata(file)
}))
