const debug = require('debug')('mysql2-cache')
const mysql = require('mysql2')
const crypto = require('crypto')
const NodeCache = require('node-cache')
const queryCache = new NodeCache({ stdTTL: 5 * 60, checkperiod: 1 * 60 })

const { Console } = require('console')
const { Transform } = require('stream')
const ts = new Transform({ transform (chunk, enc, cb) { cb(null, chunk) } })
const logger = new Console({ stdout: ts, stderr: ts, colorMode: true })
function getTable (data) {
  logger.table(data)
  return (ts.read() || '').toString()
}

debug('init')

module.exports = mysql

module.exports.connect = (config = {}) => {
  config.connectionLimit = config.connectionLimit || 15
  config.queueLimit = config.queueLimit || 100

  const pool = mysql.createPool(config).promise()
  let qid = 0

  pool.q = async (sql, params, cache = false, ttl = undefined) => {
    qid++
    const id = qid
    const hash = crypto.createHash('sha1').update(sql + JSON.stringify(params)).digest('base64')
    const log = debug.extend(id)
    log('%s %j', sql, params)

    if (cache && queryCache.has(hash)) {
      log('cache hit %s %j %j', hash, queryCache.getStats(), queryCache.keys())
      return queryCache.get(hash)
    } else if (cache) {
      log('cache missed %j %j', queryCache.getStats(), queryCache.keys())
    }
    const [rows, fields] = await pool.query(sql, params).catch(error => {
      console.error('[MYSQL] query_error %s %j', sql, params, error)
      if (error.message === 'Queue limit reached.') {
        // @todo Graceful server and mysql connections exit
        console.error('[MYSQL] POOL_ENQUEUELIMIT EXIT')
        process.exit(42)
      }
      throw error
    })
    const result = Array.isArray(rows) && rows.length ? rows : false
    if (debug.enabled) {
      log(getTable(rows))
    }
    if (cache) {
      queryCache.set(hash, result, ttl)
    }
    return result
  }

  return pool
}
