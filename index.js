const CONNECTION_IDLE_TIMEOUT = 60 * 1000 // ms
const TCP_KEEPALIVE_TIMEOUT = 2 * 60 * 1000 // ms
const TCP_IDLE_TIMEOUT = 2 * 60 * 1000 + 1 * 10 * 1000 // ms
const DEFAULT_QUEUE_LIMIT = 300
const DEFAULT_CONNECTION_LIMIT = 45
const DEFAULT_CONNECT_TIMEOUT = 2 * 1000 // ms
const DEFAULT_CACHE_TTL = 5 * 60 // s
const DEFAULT_CACHE_CHECKPERIOD = 1 * 60 // s
const DEFAULT_INSECURE_AUTH = true

const debug = require('debug')('mysql2-cache')
const mysql = require('mysql2')
const crypto = require('node:crypto')
const NodeCache = require('node-cache')
const queryCache = new NodeCache({ stdTTL: DEFAULT_CACHE_TTL, checkperiod: DEFAULT_CACHE_CHECKPERIOD })

const { Console } = require('console')
const { Transform } = require('stream')
const ts = new Transform({ transform (chunk, enc, cb) { cb(null, chunk) } })
const logger = new Console({ stdout: ts, stderr: ts, colorMode: true, inspectOptions: { depth: Infinity, breakLength: Infinity, compact: true } })
function getTable (data) {
  logger.table(data)
  return (ts.read() || '').toString()
}

debug('init')
debug.inspectOpts = { depth: Infinity, breakLength: Infinity, compact: true }

module.exports = mysql

module.exports.connect = (config = {}) => {
  // queueLimit shouldn't be 0 as it leads to long pool of lost queries
  // in case of zombie sockets instead of throwing error
  // https://github.com/sidorares/node-mysql2/blob/master/lib/pool_config.js
  config.queueLimit = config.queueLimit || DEFAULT_QUEUE_LIMIT
  // default mysql max_connections=151
  config.connectionLimit = config.connectionLimit || DEFAULT_CONNECTION_LIMIT
  // should be less then TCP_KEEPALIVE_TIMEOUT
  config.idleTimeout = config.idleTimeout || CONNECTION_IDLE_TIMEOUT
  config.connectTimeout = config.connectTimeout || DEFAULT_CONNECT_TIMEOUT
  config.insecureAuth = config.insecureAuth || DEFAULT_INSECURE_AUTH

  const pool = mysql.createPool(config).promise()
  let qid = 0

  pool.q = async (sql, params = [], cache = false, ttl = undefined) => {
    qid++
    const log = debug.extend(qid)
    log(sql, params)
    // https://medium.com/@chris_72272/what-is-the-fastest-node-js-hashing-algorithm-c15c1a0e164e
    const hash = crypto.createHash('sha1').update(sql + JSON.stringify(params)).digest('base64')
    if (cache && queryCache.has(hash)) {
      log('Cache hit', hash, queryCache.getStats() /*, queryCache.keys() */)
      return queryCache.get(hash)
    } else if (cache) {
      log('Cache missed', queryCache.getStats() /*, queryCache.keys() */)
    }
    const [rows, fields] = await pool.query(sql, params).catch(error => {
      console.error('[MYSQL] query', sql, params, error)
      if (error.message === 'Queue limit reached.') {
        // @todo Graceful server and mysql connections exit
        console.error('[MYSQL] POOL_ENQUEUELIMIT EXIT')
        process.exit(42)
      }
      throw error
    })
    const result = Array.isArray(rows) && rows.length ? rows : false
    log(getTable(rows))
    if (cache) {
      queryCache.set(hash, result, ttl)
    }
    return result
  }

  pool.qRow = pool.selectRow = async (sql, params = [], cache = false, ttl = undefined) => {
    const rows = await pool.q(sql, params, cache, ttl)
    return Array.isArray(rows) && rows.length ? rows[0] : false
  }

  pool.stat = () => {
    return {
      ALL: pool.pool._allConnections.toArray().length,
      // USE: pool.pool._allConnections.toArray().length - pool.pool._freeConnections.toArray().length,
      FRE: pool.pool._freeConnections.toArray().length,
      QUE: pool.pool._connectionQueue.toArray().length
    }
  }

  pool.insert = pool.i = async (table, row) => {
    qid++
    const log = debug.extend(qid)
    log('INSERT INTO', table)
    log(row)
    const [rows, fields] = await pool.query('INSERT INTO ?? SET ?', [table, row])
      .catch(error => {
        console.error('[MYSQL] insert', table, row, error)
        throw error
      })
    log(rows)
    return rows || false
  }

  pool.update = async (table, row, where = false) => {
    qid++
    const log = debug.extend(qid)
    log('UPDATE', table, row, where)
    const _where = where ? 'WHERE ' + Object.keys(where).map(key => key + '=' + pool.escape(where[key])).join(' AND ') : ''
    const [rows, fields] = await pool.query(`UPDATE ?? SET ? ${_where}`, [table, row])
      .catch(error => {
        console.error('[MYSQL] update', table, [row, where], error)
        throw error
      })
    log(rows)
    return rows || false
  }

  pool.delete = pool.del = async (table, where = false) => {
    qid++
    const log = debug.extend(qid)
    log('DELETE FROM', table, where)
    const _where = where ? 'WHERE ' + Object.keys(where).map(key => key + '=' + pool.escape(where[key])).join(' AND ') : ''
    const [rows, fields] = await pool.query(`DELETE FROM ?? ${_where}`, [table])
      .catch(error => {
        console.error('[MYSQL] delete', table, where, error)
        throw error
      })
    log(rows)
    return rows || false
  }

  pool.on('acquire', (connection) => {
    debug('Connection #%s acquired', connection.threadId, pool.stat())
  })
  pool.on('connection', (connection) => {
    debug('Connected #%s to %s:%s', connection.threadId, connection.config.host, connection.config.port, pool.stat())
    /**
     * tcp_keepalive and ESTABLISHED zombie sockets bug
     * https://blog.cloudflare.com/when-tcp-sockets-refuse-to-die/
     * https://github.com/mysqljs/mysql/issues/835
     *
     * tcp_keepalive is off in Node by default
     * https://nodejs.org/dist/latest-v20.x/docs/api/net.html#net_socket_setkeepalive_enable_initialdelay
     *
     * _socket.setKeepAlive(true, 1000 * 60 * 2); // ms
     * https://github.com/mysqljs/mysql/issues/1939#issuecomment-365715668
     *
     * TCP_TIMEOUT = TCP_KEEPIDLE + TCP_KEEPINTVL * TCP_KEEPCNT
     * 130 = 120 + 1 * 10
     */
    connection.stream.setKeepAlive(true, TCP_KEEPALIVE_TIMEOUT)

    /**
     * _socket.setTimeout is an alternative:
     * https://github.com/nodejs/node/issues/4560#issuecomment-302008479
     *
     * Set socket idle timeout in milliseconds
     * https://nodejs.org/api/net.html#socketsettimeouttimeout-callback
     * _socket.setTimeout(1000 * 60 * 15); // ms
     *
     * Wait for timeout event (node will emit it when idle timeout elapses)
     * socket.on('timeout', function () {
     *     socket.destroy();
     * });
     *
     * Recently added param idleTimeout is also used in mysql.createPool()
     * but they both used as there is no guarantee one will help with the bug
     */
    connection.stream.setTimeout(TCP_IDLE_TIMEOUT)
    connection.stream.on('timeout', () => {
      connection.stream.destroy()
      connection.destroy()
      debug('Connection #%s socket timeout', connection.threadId, pool.stat())
    })

    /**
     * No events emitted on connection close => listen on sockets
     * https://github.com/sidorares/node-mysql2/blob/68cc3358121a88f955c0adab95a2d5f3d2b4ecb4/lib/connection.js#L770
     */
    connection.stream.on('error', (error) => {
      debug('Connection #%s socket error', connection.threadId, pool.stat(), error)
    })
    connection.stream.on('close', (hadError) => {
      debug('Connection #%s socket closed%s', connection.threadId, hadError ? ' on error' : '', pool.stat())
    })
    connection.on('error', (error) => {
      console.error('[MYSQL] Connection error', error) // 'ER_BAD_DB_ERROR'
    })
  })

  pool.on('enqueue', (connection) => {
    debug('Connection queued', pool.stat())
  })
  pool.on('release', (connection) => {
    debug('Connection #%d released', connection.threadId, pool.stat())
  })
  pool.on('error', (...args) => {
    console.error('[MYSQL]', ...args)
  })

  return pool
}

/*
process.on('unhandledRejection', (reason) => { // , promise
  console.error('Unhandled rejection:', reason)
})
process.on('uncaughtException', (error) => {
  console.error('Uncaught exception:', error)
})
*/
