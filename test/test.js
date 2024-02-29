const mysql = require('../index.js')
// https://github.com/sidorares/node-mysql2/blob/master/examples/server.js
const server = mysql.createServer()
server.listen(3306)
server.on('connection', conn => {
  const id = Math.floor(Math.random() * 100)
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
  conn.on('query', query => {
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
    conn.close()
  })
})

const db = mysql.connect()
db.q('SELECT * FROM test_table').then(res => console.dir)
db.q('SELECT * FROM test_table', {}, true).then((res) => {
  db.q('SELECT * FROM test_table', {}, true).then((res) => {
    process.exit(0)
  })
  console.dir(res)
})
