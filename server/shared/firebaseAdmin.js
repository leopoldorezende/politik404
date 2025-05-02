const admin = require('firebase-admin')
const path = require('path')

const isProd = process.env.NODE_ENV === 'production'

const serviceAccount = isProd
  ? require('/root/keys/politik404-41c47-firebase-adminsdk-fbsvc-2c5ed453f9.json')
  : require(path.join(__dirname, '../keys/firebase-admin.json'))

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
})

module.exports = admin