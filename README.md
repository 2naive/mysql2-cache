# mysql2-cache

[![NPM](https://nodei.co/npm/mysql2-cache.png?downloads=true&stars=true)](https://nodei.co/npm/mysql2-cache/)

![GitHub release (latest by date)](https://img.shields.io/github/v/release/2naive/mysql2-cache)
![node-current](https://img.shields.io/node/v/mysql2-cache)
![GitHub Workflow Status](https://img.shields.io/github/actions/workflow/status/2naive/mysql2-cache/npm-publish.yml?branch=main)
![Coveralls github](https://img.shields.io/coveralls/github/2naive/mysql2-cache)
![Standard - JavaScript Style Guide](https://img.shields.io/badge/code_style-standard-brightgreen.svg)

> ✔ MySQL2 upgrade: cache queries, easy shortcuts, logging and debugging.

## Installation

```bash
npm install mysql2-cache --save
```

## Sample Usage

```javascript
const mysql = require('mysql2-cache')
const db = mysql.connect({
  host: 'localhost',
  user: 'root',
  database: 'test',
  password: 'root'
})
db.q('SELECT * FROM test_table').then(res => console.dir)
```

## Cache queries

```javascript
const mysql = require('mysql2-cache')
const db = mysql.connect({
  host: 'localhost',
  user: 'root',
  database: 'test',
  password: 'root'
})
db.q('SELECT * FROM test_table WHERE id=?', 1, true) // use cache with default ttl=300s
db.q('SELECT * FROM test_table WHERE id=?', 1, true, 300) // ttl in seconds
```

## Debugging easy

Pass `DEBUG=mysql2-cache*` environment variable to pretty debug.

```bash
  mysql2-cache:1 SELECT * FROM test_table WHERE age > ? [1] +0ms
  mysql2-cache:1 ┌─────────┬─────────┬─────┐
  mysql2-cache:1 │ (index) │  name   │ age │
  mysql2-cache:1 ├─────────┼─────────┼─────┤
  mysql2-cache:1 │    0    │ 'Alice' │ 90  │
  mysql2-cache:1 │    1    │  'Bob'  │ 42  │
  mysql2-cache:1 └─────────┴─────────┴─────┘
  mysql2-cache:1  +32ms
```

## API

You may use all [MySQL2](https://github.com/sidorares/node-mysql2) methods plus:

### async q(sql, params = [], cache = false, ttl = undefined)

### async insert(table, row)

### async update(table, row, where = false)

### async delete(table, row, where = false)

### stat()

### cacheFlush(sql, params)

### cacheFlushAll()

### cacheStat()

## Getting help

If you've found a bug in the library or would like new features added, go ahead and open issues or pull requests against this repo!

## Contributing

Bug fixes, docs, and library improvements are always welcome. Please refer to our [Contributing Guide](CONTRIBUTING.md) for detailed information on how you can contribute.
If you're not familiar with the GitHub pull request/contribution process, [this is a nice tutorial](https://gun.io/blog/how-to-github-fork-branch-and-pull-request/).

### Getting Started

If you want to familiarize yourself with the project, you can start by [forking the repository](https://help.github.com/articles/fork-a-repo/) and [cloning it in your local development environment](https://help.github.com/articles/cloning-a-repository/). The project requires [Node.js](https://nodejs.org) to be installed on your machine.

After cloning the repository, install the dependencies by running the following command in the directory of your cloned repository:

```bash
npm install
```

You can run the existing tests to see if everything is okay by executing:

```bash
npm test
```
