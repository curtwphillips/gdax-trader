var errors = (function () {
  // shown message ids, stored for clearing
  var visibleMessageIds = [];
  function handleError(err, id) {
    clear();
    var error = '';
    if (_.isString(err)) {
      error = err;
    } else if (!err || err._body && err._body.isTrusted) {
      error = 'An unknown error occurred. ';
      error += 'Please contact the development team with information about the problem. ';
      error += 'It is possible an external api service for the requested data is not responding to requests.';
    } else if (err._body) {
      error = JSON.stringify(err._body);
    } else if (err.responseJSON) {
      if (err.responseJSON.error) {
        error = err.responseJSON.error;
      } else {
        error = JSON.stringify(err.responseJSON);
      }
    } else if (err.statusText && err.statusText === 'error' && err.readyState === 0) {
      console.log('err: ' + JSON.stringify(err));
      error = 'The server was stopped or restarted';
    } else if (err.error) {
      error = err.error;
    } else if (err.code === 'ETIMEDOUT') {
      //{"code":"ETIMEDOUT","connect":true}
      error = 'The connection timed out.';
    } else if (err.statusText && err.statusText === 'error' && err.readyState === 0) {
      error = 'Communication with the server was disconnected';
    } else {
      error = 'An unknown error occurred: ' + JSON.stringify(err);
    }
    var msgElement;
    if (id) {
      msgElement = $('#'+id);
    }
    if (!msgElement || !msgElement.length) {
      console.log('failed to show err: ' + JSON.stringify(err) + ', at id: ' + id);
    } else {
      msgElement.text(error);
      msgElement.show();
      visibleMessageIds.push(id);
    }
    if (!msgElement) {
      throw new Error('no element for id: ' + id + ' to show error: ' + JSON.stringify(err));
    }
  }
  function handleSuccess (msg, id) {
    clear();
    var message = '';
    if (msg && _.isString(msg)) {
      message = msg;
    } else {
      message = 'Success';
    }
    var msgElement;
    if (id) {
      msgElement = $('#'+id);
    }
    if (!msgElement || !msgElement.length) {
      console.log('failed to show message: ' + JSON.stringify(message) + ', at id: ' + id);
    } else {
      msgElement.text(message);
      msgElement.show();
      visibleMessageIds.push(id);
    }
  }
  function clear() { // remove all stored visible messages
    for (var i = 0; i < visibleMessageIds.length; i++) {
      $('#'+visibleMessageIds[i]).text('');
      $('#'+visibleMessageIds[i]).hide();
    }
    visibleMessageIds = [];
  }
  return {
    handleError: handleError,
    handleSuccess: handleSuccess,
    clear: clear,
  };
}());
