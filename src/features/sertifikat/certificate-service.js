import { supabase } from '../../lib/supabase'

export async function certificateRPC(name, args = {}) {
  const { data, error } = await supabase.rpc(name, args)
  if (error?.code === '23505') throw new Error('Peserta sudah memiliki reservasi atau sertifikat pada kelas dan tanggal yang sama. Gunakan batch asli untuk mencoba ulang; hubungi admin untuk koreksi data.')
  if (error) throw new Error(error.message || 'Layanan sertifikat tidak tersedia.')
  return data
}

export function createGenerator(frame) {
  const pending = new Map()
  const receive = event => {
    if (event.origin !== window.location.origin || event.source !== frame.contentWindow || event.data?.type !== 'WORKER_PDF_DONE') return
    const task = pending.get(event.data.requestId)
    if (!task) return
    clearTimeout(task.timer)
    pending.delete(event.data.requestId)
    if (event.data.success) task.resolve(event.data)
    else task.reject(new Error(event.data.error || 'Pembuatan PDF gagal.'))
  }
  window.addEventListener('message', receive)
  return {
    generate(payload, photoDataUrl) {
      return new Promise((resolve, reject) => {
        const requestId = crypto.randomUUID()
        const timer = setTimeout(() => { pending.delete(requestId); reject(new Error('Generator melewati batas waktu. Coba lagi dengan batch yang sama.')) }, 90000)
        pending.set(requestId, { resolve, reject, timer })
        frame.contentWindow.postMessage({ type: 'WORKER_GENERATE_PDF', requestId, payload, photoDataUrl }, window.location.origin)
      })
    },
    destroy() {
      window.removeEventListener('message', receive)
      for (const task of pending.values()) { clearTimeout(task.timer); task.reject(new Error('Generator ditutup.')) }
      pending.clear()
    },
  }
}

export function saveBlob(blob, filename) {
  const url = URL.createObjectURL(blob), anchor = document.createElement('a')
  anchor.href = url; anchor.download = filename
  document.body.appendChild(anchor); anchor.click(); anchor.remove()
  setTimeout(() => URL.revokeObjectURL(url), 60000)
}
