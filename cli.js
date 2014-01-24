#!/usr/bin/env node

'use strict';

var RconConnection = require('./samp-rcon');

var host = process.argv[2];
var password = process.argv[3];
var command = process.argv[4];

if (!host || !password) {
  console.error('Usage: samp-rcon <host> <password> [command]');

  process.exit();
}

var rcon = new RconConnection(host, null, password);
var closeTimeout = null;

if (!command) {
  console.log('Connecting..');
}

rcon
  .on('ready', function() {
    if (command) {
      rcon.send(command);
      
      return;
    }
    
    console.log('Connected!');

    process.stdin.resume();
    process.stdin.setEncoding('binary');

    process.stdin.on('data', function(chunk) {
      var messages = chunk.trim().split(/[\r\n]+/);

      messages.forEach(function(msg) {
        rcon.send(msg);

        if (msg === 'quit') {
          process.exit();
        }
      });
    });
  })
  .on('message', function(msg) {
    console.log(msg.trimRight());
    
    if (command) {
      if (closeTimeout !== null) {
        clearTimeout(closeTimeout);
      }
      
      closeTimeout = setTimeout(rcon.close.bind(rcon), 250);
    }
  })
  .on('error', function(err) {
    var message;

    if (err.code === 'ENOTFOUND') {
      message = 'Invalid host (' + host + ')';
    } else {
      message = err.message;
    }

    if (!rcon.ready) {
      console.log('Failed to connect: ' + message);

      process.exit();
    } else {
      console.log('An error occurred: ' + message);
    }
  });
