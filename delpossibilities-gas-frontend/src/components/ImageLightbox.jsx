import { useState } from 'react'
import { createPortal } from 'react-dom'
import { X, Download } from 'lucide-react'

// Full-size view of an image with a download button — opened from a
// thumbnail elsewhere (see AdminOrderDrawer.jsx). The image is served from
// a different origin than the frontend (SERVER_BASE in api.js), so a plain
// <a download> would just navigate to it instead of saving it — browsers
// only honor `download` for same-origin links. Fetching it as a blob first
// and downloading THAT local blob URL works regardless of origin, as long
// as the image response doesn't block cross-origin reads; if it does,
// falling back to opening it in a new tab still lets the admin save it
// manually (right-click → save image).
function ImageLightbox({ src, alt = 'Image', open, onClose }) {
  const [downloading, setDownloading] = useState(false)

  if (!open || !src) return null

  const handleDownload = async () => {
    setDownloading(true)

    try {
      const response = await fetch(src)
      const blob = await response.blob()
      const blobUrl = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = blobUrl
      link.download = `${alt.replace(/\s+/g, '-').toLowerCase()}.jpg`
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(blobUrl)
    } catch {
      window.open(src, '_blank')
    } finally {
      setDownloading(false)
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/80" onClick={onClose} aria-hidden="true" />

      <div className="relative max-h-[90vh] max-w-3xl">
        <img src={src} alt={alt} className="max-h-[90vh] w-auto rounded-lg object-contain" />

        <div className="absolute right-2 top-2 flex gap-2">
          <button
            type="button"
            onClick={handleDownload}
            disabled={downloading}
            aria-label="Download image"
            className="rounded-full bg-black/60 p-2 text-white hover:bg-black/80"
          >
            <Download className="h-5 w-5" strokeWidth={2} />
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-full bg-black/60 p-2 text-white hover:bg-black/80"
          >
            <X className="h-5 w-5" strokeWidth={2} />
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}

export default ImageLightbox
