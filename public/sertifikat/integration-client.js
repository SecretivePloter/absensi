(function (global) {
  'use strict'

  class IchikaraCertificateGenerator {
    constructor(options) {
      if (!options?.container) throw new Error('container wajib diisi.')
      this.baseUrl = new URL(options.baseUrl || './', global.location.href)
      this.targetOrigin = options.targetOrigin || this.baseUrl.origin
      this.timeout = options.timeout || 30000
      this.pending = new Map()
      this.iframe = document.createElement('iframe')
      this.iframe.src = new URL('index.html', this.baseUrl).href
      this.iframe.title = options.title || 'Generator Sertifikat Ichikara'
      this.iframe.style.cssText = options.style || 'width:100%;min-height:900px;border:0;border-radius:12px'
      this.iframe.setAttribute('loading', 'lazy')
      this.onMessage = this.onMessage.bind(this)
      global.addEventListener('message', this.onMessage)
      this.ready = new Promise((resolve, reject) => {
        this.iframe.addEventListener('load', resolve, { once: true })
        this.iframe.addEventListener('error', () => reject(new Error('Iframe generator gagal dimuat.')), { once: true })
      })
      options.container.replaceChildren(this.iframe)
    }

    onMessage(event) {
      if (event.origin !== this.targetOrigin || event.source !== this.iframe.contentWindow) return
      if (event.data?.type !== 'WORKER_PDF_DONE') return
      const task = this.pending.get(event.data.requestId)
      if (!task) return
      this.pending.delete(event.data.requestId)
      clearTimeout(task.timer)
      if (event.data.success) task.resolve(event.data)
      else task.reject(new Error(event.data.error || 'Generator gagal membuat PDF.'))
    }

    async generate(payload, photoDataUrl) {
      await this.ready
      const requestId = global.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          this.pending.delete(requestId)
          reject(new Error('Generator tidak merespons sebelum batas waktu.'))
        }, this.timeout)
        this.pending.set(requestId, { resolve, reject, timer })
        this.iframe.contentWindow.postMessage({
          type: 'WORKER_GENERATE_PDF', requestId, payload, photoDataUrl: photoDataUrl || null,
        }, this.targetOrigin)
      })
    }

    destroy() {
      global.removeEventListener('message', this.onMessage)
      for (const task of this.pending.values()) {
        clearTimeout(task.timer)
        task.reject(new Error('Generator dihentikan.'))
      }
      this.pending.clear()
      this.iframe.remove()
    }
  }

  global.IchikaraCertificateGenerator = IchikaraCertificateGenerator
})(window)
