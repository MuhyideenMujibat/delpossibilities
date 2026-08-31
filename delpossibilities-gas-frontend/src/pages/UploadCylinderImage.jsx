import { useState, useEffect } from 'react'
import { ImagePlus } from 'lucide-react'
import { apiFetch } from '../api'
import CylinderImageUpload from '../CylinderImageUpload'
import PageHeader from '../components/PageHeader'

function UploadCylinderImage({ token }) {
  const [cylinderImageUrl, setCylinderImageUrl] = useState(null)

  useEffect(() => {
    apiFetch('/user', { token })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.cylinder_image_url) setCylinderImageUrl(data.cylinder_image_url)
      })
      .catch(() => {})
  }, [token])

  return (
    <div className="mx-auto max-w-xl">
      <PageHeader title="Cylinder Image" subtitle="Keep a current photo on file for pickup." icon={ImagePlus} />

      <div className="card">
        <CylinderImageUpload
          token={token}
          initialImageUrl={cylinderImageUrl}
          description="This photo is used as your default cylinder image on future orders."
          onUploaded={setCylinderImageUrl}
        />
      </div>
    </div>
  )
}

export default UploadCylinderImage
