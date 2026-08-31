import { useEffect, useMemo, useState } from 'react'
import { Upload } from 'lucide-react'
import { apiFetch, resolveImageUrl } from './api'

function CylinderImageUpload({ token, initialImageUrl = null, description, onUploaded }) {
  const [selectedFile, setSelectedFile] = useState(null)
  const [message, setMessage] = useState('')
  const [isError, setIsError] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [imageUrl, setImageUrl] = useState(initialImageUrl)
  const [trackedInitialUrl, setTrackedInitialUrl] = useState(initialImageUrl)

  // Adjust state during render (React's recommended escape hatch) instead of
  // an effect, so the preview stays in sync when the parent's profile fetch
  // resolves after this component has already mounted.
  if (initialImageUrl !== trackedInitialUrl) {
    setTrackedInitialUrl(initialImageUrl)
    setImageUrl(initialImageUrl)
  }

  const selectedPreviewUrl = useMemo(() => (selectedFile ? URL.createObjectURL(selectedFile) : null), [selectedFile])
  const previewUrl = selectedPreviewUrl || resolveImageUrl(imageUrl)

  useEffect(() => {
    return () => {
      if (selectedPreviewUrl) URL.revokeObjectURL(selectedPreviewUrl)
    }
  }, [selectedPreviewUrl])

  const handleFileChange = (e) => {
    const file = e.target.files[0] || null
    setSelectedFile(file)
    if (file) {
      setIsError(false)
      setMessage('')
    }
  }

  const handleUpload = async () => {
    if (!selectedFile) {
      setIsError(true)
      setMessage('Please choose an image first.')
      return
    }

    setUploading(true)

    const formData = new FormData()
    formData.append('cylinder_image', selectedFile)

    try {
      const response = await apiFetch('/profile/cylinder-image', {
        method: 'POST',
        token,
        body: formData,
      })

      if (response.ok) {
        const data = await response.json().catch(() => null)
        const newUrl = data?.cylinder_image_url || data?.user?.cylinder_image_url || data?.data?.cylinder_image_url || null
        setImageUrl(newUrl)
        setIsError(false)
        setMessage('Image uploaded successfully!')
        setSelectedFile(null)
        onUploaded?.(newUrl)
      } else {
        setIsError(true)
        setMessage('Upload failed.')
      }
    } catch {
      setIsError(true)
      setMessage('Could not reach the server.')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div>
      {description && <p className="mb-4 text-sm text-slate-500">{description}</p>}

      <div className="mb-4">
        {previewUrl ? (
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
            <img src={previewUrl} alt="Cylinder preview" className="h-48 w-full object-cover" />
            {selectedFile && (
              <div className="flex items-center justify-between px-3 py-2 text-xs text-slate-500">
                <span className="truncate">Previewing: {selectedFile.name}</span>
                <button type="button" onClick={() => setSelectedFile(null)} className="font-medium text-brand-teal hover:underline">
                  Remove
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="flex h-48 w-full items-center justify-center rounded-xl bg-slate-100 text-sm text-slate-400">
            No image
          </div>
        )}
      </div>

      <input type="file" accept="image/*" onChange={handleFileChange} className="file-input" />

      <button onClick={handleUpload} disabled={uploading} className="btn-primary mt-4">
        <Upload className="h-4 w-4" strokeWidth={2} />
        {uploading ? 'Uploading…' : 'Upload'}
      </button>

      {message && (
        <p className={`mt-4 ${isError ? 'alert-error' : 'alert-success'}`}>{message}</p>
      )}
    </div>
  )
}

export default CylinderImageUpload
