import filesize from 'filesize'
/**
 * @typedef {import('ipfs').IPFSService} IPFSService
 * @typedef {import('../bundles/files/actions').FileStat} FileStat
 * @typedef {import('cids')} CID
 */

/**
 * @typedef {Object} FileExt
 * @property {string} [filepath]
 * @property {string} [webkitRelativePath]
 *
 * @typedef {FileExt &  File} ExtendedFile
 *
 * @typedef {Object} FileStream
 * @property {string} path
 * @property {Blob} content
 * @property {number} size
 *
 * @param {ExtendedFile[]} files
 * @returns {FileStream[]}
 */
export function normalizeFiles (files) {
  const streams = []

  for (const file of files) {
    streams.push({
      path: file.filepath || file.webkitRelativePath || file.name,
      content: file,
      size: file.size
    })
  }

  return streams
}

/**
 * @typedef {Object} FileDownload
 * @property {string} url
 * @property {string} filename
 *
 * @param {FileStat} file
 * @param {string} gatewayUrl
 * @returns {Promise<FileDownload>}
 */
async function downloadSingle (file, gatewayUrl) {
  let url, filename

  if (file.type === 'directory') {
    filename = `${file.name || `download_${file.cid}`}.tar.gz`
    url = `${gatewayUrl}/api/v0/get?arg=${file.cid}&archive=true&compress=true`
  } else {
    filename = file.name
    url = `${gatewayUrl}/ipfs/${file.cid}?download=true&filename=${file.name}`
  }

  return { url, filename }
}

/**
 * @param {FileStat[]} files
 * @param {IPFSService} ipfs
 * @returns {Promise<CID>}
 */
export async function makeCIDFromFiles (files, ipfs) {
  let cid = await ipfs.object.new({ template: 'unixfs-dir' })

  for (const file of files) {
    cid = await ipfs.object.patch.addLink(cid, {
      name: file.name,
      // @ts-ignore - can this be `null` ?
      size: file.size,
      cid: file.cid
    })
  }

  return cid
}

/**
 *
 * @param {FileStat[]} files
 * @param {string} gatewayUrl
 * @param {IPFSService} ipfs
 * @returns {Promise<FileDownload>}
 */
async function downloadMultiple (files, gatewayUrl, ipfs) {
  const cid = await makeCIDFromFiles(files, ipfs)
  return {
    url: `${gatewayUrl}/api/v0/get?arg=${cid}&archive=true&compress=true`,
    filename: `download_${cid}.tar.gz`
  }
}

/**
 *
 * @param {FileStat[]} files
 * @param {string} gatewayUrl
 * @param {IPFSService} ipfs
 * @returns {Promise<FileDownload>}
 */
export async function getDownloadLink (files, gatewayUrl, ipfs) {
  if (files.length === 1) {
    return downloadSingle(files[0], gatewayUrl)
  }

  return downloadMultiple(files, gatewayUrl, ipfs)
}

/**
 * @param {FileStat[]} files
 * @param {string} gatewayUrl
 * @param {IPFSService} ipfs
 * @returns {Promise<string>}
 */
export async function getShareableLink (files, gatewayUrl, ipfs) {
  let cid
  let filename

  if (files.length === 1) {
    cid = files[0].cid
    if (files[0].type === 'file') {
      filename = `?filename=${encodeURIComponent(files[0].name)}`
    }
  } else {
    cid = await makeCIDFromFiles(files, ipfs)
  }

  return `${gatewayUrl}/ipfs/${cid}${filename || ''}`
}

/**
 * @param {number} size in bytes
 * @param {object} opts format customization
 * @returns {string} human-readable size
 */
export function humanSize (size, opts) {
  if (typeof size === 'undefined') return 'N/A'
  return filesize(size || 0, {
    // base-2 byte units (GiB, MiB, KiB) to remove any ambiguity
    spacer: String.fromCharCode(160), // non-breakable space (&nbsp)
    round: size >= 1073741824 ? 1 : 0, // show decimal > 1GiB
    standard: 'iec',
    base: 2,
    bits: false,
    ...opts
  })
}
