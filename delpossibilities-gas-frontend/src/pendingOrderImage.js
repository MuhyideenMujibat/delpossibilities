// Holds the cylinder photo a guest picked in the order wizard across the
// hop out to /login and back. A File can't be serialized into
// sessionStorage (that's why the rest of the draft goes there instead), but
// this module-level reference survives client-side navigation just fine —
// only a hard page reload before logging in would drop it, in which case
// the wizard's existing "add a photo now" recovery UI covers the gap.
let pendingFile = null

export function setPendingOrderImage(file) {
  pendingFile = file || null
}

// Read-and-clear: the photo belongs to exactly one restored draft.
export function takePendingOrderImage() {
  const file = pendingFile
  pendingFile = null
  return file
}
