import { useState, useEffect } from 'react'
import { apiFetch, resolveImageUrl } from './api'

function CylinderImageUpload({ token, initialImageUrl = null, description, onUploaded }) {
  const [selectedFile, setSelectedFile] = useState(null)
  const [message, setMessage] = useState('')
  const [isError, setIsError] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [imageUrl, setImageUrl] = useState(initialImageUrl)

  useEffect(() => {
    setImageUrl(initialImageUrl)
  }, [initialImageUrl])

  const handleFileChange = (e) => {
    setSelectedFile(e.target.files[0])
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
        {imageUrl ? (
          <img src={resolveImageUrl(imageUrl)} alt="Cylinder" className="h-40 w-full rounded-xl object-cover" />
        ) : (
          <div className="flex h-40 w-full items-center justify-center rounded-xl bg-slate-100 text-sm text-slate-400">
            No image
          </div>
        )}
      </div>

      <input type="file" accept="image/*" onChange={handleFileChange} className="file-input" />

      <button onClick={handleUpload} disabled={uploading} className="btn-primary mt-4">
        {uploading ? 'Uploading…' : 'Upload'}
      </button>

      {message && (
        <p className={`mt-4 ${isError ? 'alert-error' : 'alert-success'}`}>{message}</p>
      )}
    </div>
  )
}

export default CylinderImageUpload
