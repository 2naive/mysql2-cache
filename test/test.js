// @todo Node default test runner or Jest
const mysql = require('../index.js')
const debug = require('debug')
debug.enable('mysql2-cache*')
// https://github.com/sidorares/node-mysql2/blob/master/examples/server.js
const server = mysql.createServer()
server.listen(3306)
server.on('connection', conn => {
  const id = Math.floor(Math.random() * 100)
  try {
    conn.serverHandshake({
      protocolVersion: 10,
      serverVersion: '5.6.10',
      connectionId: id,
      statusFlags: 2,
      characterSet: 8,
      authCallback: (params) => {
        conn.writeOk()
        conn.sequenceId = 0
      },
      capabilityFlags: 2181036031
    })
  } catch (error) {
    console.error(error)
  }
  conn.on('query', query => {
    try {
      // https://github.com/sidorares/node-mysql2/issues/528#issuecomment-944949065
      // https://github.com/sidorares/node-mysql2/blob/master/lib/constants/types.js
      conn.sequenceId = 1
      conn.writeColumns([
        {
          catalog: 'def',
          schema: 'test',
          table: 'test_table',
          orgTable: 'test_table',
          name: 'name',
          orgName: 'name',
          characterSet: 33,
          columnLength: 384,
          columnType: 253,
          flags: 0,
          decimals: 0
        },
        {
          catalog: 'def',
          schema: 'test',
          table: 'test_table',
          orgTable: 'test_table',
          name: 'age',
          orgName: 'age',
          characterSet: 33,
          columnLength: 384,
          columnType: 2,
          flags: 0,
          decimals: 0
        }
      ])
      conn.writeTextRow(['Alice', id])
      conn.writeTextRow(['Bob', 42])
      conn.writeEof()
      conn.sequenceId = 0
      // conn.close()
    } catch (error) {
      console.log('MySQL server on.query error', error)
    }
  })
})

const db = mysql.connect({
  connectionLimit: 2,
  maxIdle: 1,
  idleTimeout: 2000
});

(async () => {
  await db.q('DROP TABLE IF EXISTS test')
  await db.q('CREATE TABLE test (`name` VARCHAR(50) NULL DEFAULT NULL, `age` INT(10) NULL DEFAULT NULL)')
  db.insert('test', { name: 'Alice', age: 92 })
  db.insert('test', { name: 'Bob', age: 42 })
  // no cache
  db.q('SELECT * FROM test LIMIT 1').then(res => console.dir)
  // cache
  db.q('SELECT * FROM test LIMIT 1', [], true).then((res) => {
    db.q('SELECT * FROM test LIMIT 1', [], true)
  })
  // cache, flush, flush all
  db.q('SELECT * FROM test WHERE 1=0', [], true).then((res) => {
    db.cacheFlush('SELECT * FROM test LIMIT 1', [])
    db.cacheFlushAll()
  })
  db.del('test', { age: 92 })
  await db.i('test', { name: 'Mark', age: 36 })
  await db.update('test', { age: 13 }, { age: 36 })
  await db.delete('test', { age: 13 })
  await db.insert('test', { name: 'Mark', age: 11 })
  await db.q('SELECT * FROM test')
  process.exit(0)
})()

// db.q('Unhandled rejection')
// throw(new Error('Unhandled error'))
