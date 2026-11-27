export async function optimizeUploadImage(file: File): Promise<File> {
  if (file.type !== 'image/png' || typeof document === 'undefined') return file
  try {
    const bitmap = await createImageBitmap(file)
    const canvas = document.createElement('canvas')
    canvas.width = bitmap.width
    canvas.height = bitmap.height
    canvas.getContext('2d')?.drawImage(bitmap, 0, 0)
    bitmap.close()
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/webp', 0.84),
    )
    if (!blob || blob.type !== 'image/webp' || blob.size >= file.size) return file
    return new File([blob], file.name.replace(/\.png$/i, '.webp'), { type: 'image/webp' })
  } catch {
    return file
  }
}
