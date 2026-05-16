import Tesseract from 'tesseract.js'

let worker: Tesseract.Worker | null = null

async function getWorker(): Promise<Tesseract.Worker> {
  if (!worker) {
    worker = await Tesseract.createWorker('spa')
  }
  return worker
}

export async function runOcr(imageBuffer: Buffer): Promise<string> {
  const w = await getWorker()
  const { data } = await w.recognize(imageBuffer)
  return data.text
}
