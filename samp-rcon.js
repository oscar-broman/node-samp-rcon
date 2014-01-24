'use strict';

var events = require('events');
var dgram = require('dgram');
var dns = require('dns');

module.exports = RconConnection;

var reValidIp = /^\d+\.\d+\.\d+\.\d+$/;
var reGetPort = /.*:/;
var reGetHost = /\s*:.*/;

function RconConnection(host, port, password, addressOverride) {
  host = host && host.trim();
  port = port || 7777;

  if (!host) {
    throw new Error('Invalid host given');
  }

  // Check for host:port notation. Overrides the "port" argument.
  if (host.indexOf(':') !== -1) {
    port = +host.replace(reGetPort, '');
    host = host.replace(reGetHost, '');
  } else {
    port = +port;
  }

  if (!isFinite(port) || port < 1 || port > 65535) {
    throw new Error('Invalid port given: "' + port + '"');
  }

  this.ready = false;
  this.port = port;
  this.password = password;
  this.socket = dgram.createSocket('udp4', this.onMessage.bind(this));
  this.retryTimeout = null;

  if (host.toLowerCase() === 'localhost') {
    host = '127.0.0.1';
  }

  if (addressOverride && !reValidIp.test(addressOverride)) {
    throw new Error('addressOverride must be a valid IPv4 address');
  }

  this.addressOverride = addressOverride;

  // Do we need to resolve the host?
  if (reValidIp.test(host)) {
    this.address = host;
    this.makePrefix();

    // Wait until nextTick to allow changing connectMessage
    process.nextTick(this.sendConnectMessage.bind(this));
  } else {
    dns.resolve4(host, this.hostResolve.bind(this));
  }
}

RconConnection.prototype = Object.create(events.EventEmitter.prototype);

// Used to check for a response
RconConnection.prototype.connectMessage = 'samp-rcon connecting';

RconConnection.prototype.sendConnectMessage = function() {
  this.retryTimeout = null;

  if (this.ready) {
    return;
  }

  this.send('echo ' + this.connectMessage);

  // Keep sending the message until it has been sent back
  this.retryTimeout = setTimeout(this.sendConnectMessage.bind(this), 250);
};

RconConnection.prototype.hostResolve = function(err, address) {
  if (err) {
    this.emit('error', err);

    return;
  }

  this.address = address[0];
  this.makePrefix();
  this.sendConnectMessage();
};

RconConnection.prototype.makePrefix = function() {
  var octets = this.address.split('.');
  var address = String.fromCharCode.apply(null, octets);
  var port = String.fromCharCode(this.port & 0xFF, this.port >>> 8);
  var pwlen = this.password.length;

  pwlen = String.fromCharCode(pwlen & 0xFF, pwlen >>> 8);

  this.prefix = 'SAMP' + address + port + 'x' + pwlen + this.password;
  this.responsePrefix = 'SAMP' + address + port + 'x';
};

RconConnection.prototype.send = function(command) {
  var cmdlen = command.length;

  cmdlen = String.fromCharCode(cmdlen & 0xFF, cmdlen >>> 8);

  var message = new Buffer(this.prefix + cmdlen + command, 'binary');

  this.socket.send(
    message,
    0,
    message.length,
    this.port,
    this.addressOverride || this.address
  );
};

RconConnection.prototype.close = function() {
  this.socket.close();

  if (this.retryTimeout !== null) {
    clearTimeout(this.retryTimeout);

    this.retryTimeout = null;
  }
};

RconConnection.prototype.onMessage = function(msg) {
  if (msg.toString('binary', 0, 11) === this.responsePrefix) {
    var len = msg.readUInt16LE(11);

    msg = msg.toString('binary', 13);

    if (msg.length !== len) {
      console.warn(
          '(samp-rcon) Length mismatch ' +
          '(expected ' + len + ', got ' + msg.length + '): ' +
          JSON.stringify(msg)
      );
    } else if (!this.ready) {
      if (msg === 'Invalid RCON password.') {
        this.emit('error', new Error('Invalid RCON password'));
        this.close();
      } else if (msg === this.connectMessage) {
        this.ready = true;
        this.emit('ready');
      }
    } else {
      if (msg !== this.connectMessage) {
        this.emit('message', msg);
      }
    }
  }
};
