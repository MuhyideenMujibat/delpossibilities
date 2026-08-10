import CylinderImageUpload from '../CylinderImageUpload'

function UploadCylinderImage({ token }) {
  return (
    <div className="mx-auto max-w-md">
      <h2 className="mb-6 text-2xl font-semibold text-brand-navy">Upload Cylinder Image</h2>

      <div className="card">
        <CylinderImageUpload
          token={token}
          description="This photo is used as your default cylinder image on future orders."
        />
      </div>
    </div>
  )
}

export default UploadCylinderImage
