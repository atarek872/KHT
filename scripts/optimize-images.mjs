import sharp from 'sharp'
import { mkdir } from 'node:fs/promises'

await mkdir('public/images/optimized', { recursive: true })
for (const name of ['campaign', 'tee', 'tracksuit', 'pants']) {
  const source = sharp(`public/images/${name}.png`)
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
