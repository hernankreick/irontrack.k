import React from 'react'
import { Camera, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function ProgressPhotosPanel({ sharedParam, sb, es, esEntrenador }) {
  const [fotos, setFotos] = React.useState([])
  const [loading, setLoading] = React.useState(true)
  const [uploading, setUploading] = React.useState(false)
  const fileRef = React.useRef(null)

  const alumnoId = React.useMemo(() => {
    try {
      return JSON.parse(atob(sharedParam)).alumnoId
    } catch {
      return null
    }
  }, [sharedParam])

  React.useEffect(() => {
    if (!alumnoId) {
      setLoading(false)
      return
    }
    sb.getFotos(alumnoId).then((f) => {
      setFotos(f || [])
      setLoading(false)
    })
  }, [alumnoId, sb])

  const subirFoto = async (e) => {
    const file = e.target.files?.[0]
    if (!file || !alumnoId) return
    setUploading(true)
    const reader = new FileReader()
    reader.onload = async (ev) => {
      const base64 = ev.target.result
      const fecha = new Date().toLocaleDateString('es-AR')
      const res = await sb.addFoto({ alumno_id: alumnoId, imagen: base64, fecha, nota: '' })
      if (res && res[0]) setFotos((prev) => [res[0], ...prev])
      setUploading(false)
    }
    reader.readAsDataURL(file)
  }

  if (loading) {
    return (
      <div className="grid grid-cols-2 gap-6 sm:grid-cols-3">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={`sk-ph-${i}`} className="sk aspect-square rounded-xl" />
        ))}
      </div>
    )
  }

  return (
    <div>
      {!esEntrenador && (
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={subirFoto}
          capture="environment"
        />
      )}

      {fotos.length === 0 && (
        <div className="flex flex-col items-center px-4 py-12 text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[#1a2540]">
            <Camera className="h-8 w-8 text-[#7c8db0]" />
          </div>
          <div className="mb-2 text-lg font-bold text-[#f0f6ff]">{es ? 'Sin fotos aún' : 'No photos yet'}</div>
          <p className="mb-6 max-w-sm text-sm leading-relaxed text-[#7c8db0]">
            {es
              ? 'Subí tu primera foto para empezar a trackear tu cambio físico.'
              : 'Upload your first photo to start tracking your physical progress.'}
          </p>
          {!esEntrenador && (
            <Button
              variant="outline"
              className="min-h-[44px] border-[#1e3050]"
              disabled={uploading}
              onClick={() => fileRef.current?.click()}
            >
              {uploading ? '...' : es ? 'Subir primera foto' : 'Upload first photo'}
            </Button>
          )}
        </div>
      )}

      {fotos.length > 0 && (
        <div className="grid grid-cols-2 gap-6 sm:grid-cols-3">
          {fotos.map((f, i) => (
            <div
              key={f.id != null ? String(f.id) : `foto-${i}`}
              className="group relative aspect-square overflow-hidden rounded-xl"
            >
              <img
                src={f.imagen}
                alt=""
                className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
              />
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 p-2 text-xs font-bold text-white">{f.fecha}</div>
            </div>
          ))}
          {!esEntrenador && (
            <button
              type="button"
              className="flex aspect-square min-h-[44px] flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-[#1e3050] bg-[#131b2e] text-[#7c8db0] transition-colors hover:border-[#2563eb]/50 hover:bg-[#162038]"
              onClick={() => fileRef.current?.click()}
            >
              <Plus className="h-8 w-8" />
              <span className="text-[11px] font-semibold">{es ? 'Agregar' : 'Add'}</span>
            </button>
          )}
        </div>
      )}
    </div>
  )
}
