#!/usr/bin/env node

'use strict';

var app = require('http').createServer(handler);
var fs = require('fs');
var RconConnection = require('./samp-rcon');

try {
	var io = require('socket.io').listen(app);
} catch (e) {
	console.error('Error: socket.io is required. ' +
                'Install it using the following command:');
	console.error('  npm install socket.io');

	process.exit(1);
}

var port = +process.argv[2] || 3000;

app.listen(port);

function handler(req, res) {
  var file, type;

  if (req.url === '/') {
    file = 'index.html';
    type = 'text/html';
  } else if (req.url === '/style.css') {
    file = 'style.css';
    type = 'text/css';
  } else if (req.url === '/main.js') {
    file = 'main.js';
    type = 'application/javascript';
  }

  if (file) {
    fs.readFile(
      __dirname + '/' + file,
      function (err, data) {
        if (err) {
          res.writeHead(500);
          return res.end('Error loading ' + file);
        }

        res.writeHead(200, {'Content-Type': type});
        res.end(data);
      }
    );
  } else {
    res.writeHead(404);
    res.end('File not found');
  }
}

io.set('log level', 2);

io.sockets.on('connection', function (socket) {
  var rcon;

  socket
    .on('disconnect', function() {
      if (rcon) {
        rcon.close();
      }

      rcon = null;
    })
    .on('rcon-connect', function (data) {
      try {
        rcon = new RconConnection(data.host, null, data.pass);
      } catch (e) {
        socket.emit('rcon-error', {
          message: e.message
        });

        return;
      }

      rcon
        .on('ready', function() {
          socket.emit('rcon-connect');
        })
        .on('message', function(msg) {
          socket.emit('rcon-output', msg);
        })
        .on('error', function(err) {
          socket.emit('rcon-error', err);
        });
    })
    .on('rcon-send', function(str) {
      if (!rcon) {
        socket.emit('rcon-error', {
          message: 'Not connected',
          code: 'NOCONN'
        });
      } else {
        rcon.send(str);
      }
    });
});
