import sharp from 'sharp'
import { mkdir } from 'node:fs/promises'

await mkdir('public/images/optimized', { recursive: true })
const images = [
  { name: 'campaign', extension: 'png' },
  { name: 'tee', extension: 'png' },
  { name: 'tracksuit', extension: 'png' },
  { name: 'pants', extension: 'png' },
  { name: 'drop-001-banner', extension: 'jpg' },
  { name: 'our-story-cover', extension: 'png' },
]

for (const { name, extension } of images) {
  const source = sharp(`public/images/${name}.${extension}`)
  const { width } = await source.metadata()
  for (const size of [...new Set([240, 480, 800, width])]) {
    await source
      .clone()
      .resize({ width: size, withoutEnlargement: true })
      .webp({ quality: 84 })
      .toFile(`public/images/optimized/${name}-${size}.webp`)
  }
  await source.clone().webp({ quality: 88 }).toFile(`public/images/${name}.webp`)
}
