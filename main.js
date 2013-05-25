/* jshint node:false, browser:true */
/* global $, io */

(function() {
  'use strict';

  var $console = $('.rcon-console');
  var $output = $console.find('.output');
  var $outputPad = $output.find('.pad');
  var $outputPre = $output.find('pre');
  var $prompt = $console.find('.prompt');
  var socket = io.connect(location.protocol + '//' + location.hostname);
  var host = null;
  var pass = null;

  function updateOutput(appendText) {
    if (appendText) {
      $outputPre.append($('<span/>').text('\n' + appendText));
    }

    var scrollHeight = $output[0].scrollHeight;

    $outputPad.css('margin-top', Math.max(
      -$outputPad.height(),
      -$outputPre.height()
    ));

    $output.scrollTop(
      scrollHeight
    );
  }

  updateOutput();

  $prompt.on('keyup', function(e) {
    if (e.which === 13) {
      var val = $.trim($(this).val());

      if (val) {
        if (!host) {
          host = val;

          $outputPre.append($('<span/>').text(host));
          updateOutput('Password:');
        } else if (!pass) {
          pass = val;
          updateOutput('Connecting..');
          $prompt.attr('disabled', true);
          socket.emit('rcon-connect', {
            host: host,
            pass: pass
          });
        } else {
          updateOutput('> ' + val);
          socket.emit('rcon-send', val);
        }

        $prompt.val('');
      }
    }
  });

  socket.on('connect', function () {
    $prompt.removeAttr('disabled');
  });

  socket.on('rcon-connect', function () {
    $prompt.removeAttr('disabled');
    updateOutput('Connected!');
  });

  socket.on('disconnect', function () {
    $prompt.attr('disabled', true);
  });

  socket.on('rcon-output', function (output) {
    updateOutput('< ' + output.replace('\n', '\n< '));
  });

  socket.on('rcon-error', function (err) {
    var message;

    if (typeof err === 'object') {
      if (err.code === 'ENOTFOUND') {
        message = 'Invalid host';
      } else {
        message = err.message;
      }
    } else {
      message = err;
    }

    updateOutput('Error: ' + message.replace('\n', '\nError: '));
  });
}());