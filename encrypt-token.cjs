const crypto = require('crypto')
const KEY = process.env.ENCRYPTION_KEY
const iv = crypto.randomBytes(16)
const cipher = crypto.createCipheriv('aes-256-gcm', KEY, iv)
let enc = cipher.update(process.argv[2], 'utf8', 'hex')
enc += cipher.final('hex')
const tag = cipher.getAuthTag()
console.log(iv.toString('hex') + ':' + tag.toString('hex') + ':' + enc)
