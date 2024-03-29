/*
 * client.js: Client base for the Nodejitsu API clients.
 *
 * (C) 2010, Nodejitsu Inc.
 *
 */

var fs = require('fs'),
    request = require('request');

//
// ### function Client (options)
// #### @options {Object} Options for this instance
// Constructor function for the Client base responsible
// for communicating with Nodejitsu's API
//
var Client = exports.Client = function (options) {
  this.options = options;
  this._request = request;

  if('function' !== typeof this.options.get)
    this.options.get = function (key) {
      return this[key]
    }
};

// Failure HTTP Response codes based
// off of `/lib/broodmother/slave/service.js`
var failCodes = {
  400: 'Bad Request',
  403: 'Not Authorized',
  404: 'Item not found',
  409: 'Conflict',
  500: 'Internal Server Error'
};

// Success HTTP Response codes based
// off of `/lib/broodmother/slave/service.js`
var successCodes = {
  200: 'OK',
  201: 'Created'
};

//
// ### function encode (unencoded)
// #### @unencoded {string} The string to base64 encode
// Encodes the specified string to base64 using node.js Buffers.
//
var encode = function (unencoded) {
  return new Buffer(unencoded || '').toString('base64');
};

//
// ### @private function request (method, uri, [body], success, callback)
// #### @method {string} HTTP method to use
// #### @uri {Array} Locator for the Remote Resource
// #### @body {Object} **optional** JSON Request Body
// #### @callback {function} Continuation to call if errors occur.
// #### @success {function} Continuation to call upon successful transactions
// Makes a request to `this.remoteUri + uri` using `method` and any 
// `body` (JSON-only) if supplied. Short circuits to `callback` if the response
// code from Nodejitsu matches `jitsu.failCodes`. 
//
Client.prototype.request = function (method, uri /* variable arguments */) {
  var options, args = Array.prototype.slice.call(arguments),
      success = args.pop(),
      callback = args.pop(),
      body = typeof args[args.length - 1] === 'object' && !Array.isArray(args[args.length - 1]) && args.pop(),
      //XXX: remove global
      encoded = encode(this.options.get('username') + ':' + this.options.get('password'));
      
  options = {
    method: method || 'GET',
    uri: this.options.get('remoteUri') + '/' + uri.join('/'),
    headers: {
      'Authorization': 'Basic ' + encoded,
      'Content-Type': 'application/json'
    }
  };
  
  if (body) {
    options.body = JSON.stringify(body);
  }

  this._request(options, function (err, response, body) {
    if (err) {
      return callback(err);
    }
    
    var statusCode, result, error;
    
    try {
      statusCode = response.statusCode.toString();
      result = JSON.parse(body);
    }
    catch (ex) {
      // Ignore Errors
    }

    var poweredBy = response.headers['x-powered-by'];
    if (!poweredBy || poweredBy.indexOf('Nodejitsu') === -1) {
      error = new Error('Jitsu requires you to connect to Nodejitsu\'s stack (api.nodejitsu.com)');
      error.statusCode = "403";
      error.result = "";
      return callback(error);
    }

    if (Object.keys(failCodes).indexOf(statusCode) !== -1) {
      error = new Error('Nodejitsu Error (' + statusCode + '): ' + failCodes[statusCode]);
      error.statusCode = statusCode;
      error.result = result;
      return callback(error);
    }

    success(response, result);
  });
};

//
// ### function upload (uri, contentType, file, callback, success) 
// #### @uri {Array} Locator for the Remote Resource
// #### @contentType {string} Content-Type header to use for the upload.
// #### @file {string} Path of the local file to upload. 
// #### @success {function} Continuation to call upon successful transactions
// #### @callback {function} Continuation to call if errors occur.
// Makes a `POST` request to `this.remoteUri + uri` with the data in `file` 
// as the request body. Short circuits to `callback` if the response
// code from Nodejitsu matches `jitsu.failCodes`.
//
Client.prototype.upload = function (uri, contentType, file, callback, success) {
  var self = this,
      options, 
      out, 
      encoded;

  encoded = encode(this.options.get('username') + ':' + this.options.get('password'));
  
  fs.readFile(file, function (err, data) {
    options = {
      method: 'POST',
      uri: self.options.get('remoteUri') + '/' + uri.join('/'),
      headers: {
        'Authorization': 'Basic ' + encoded,
        'Content-Type': contentType,
        'Content-Length': data.length
      }
    };
    
    out = self._request(options, function (err, response, body) {
      if (err) {
        return callback(err);
      }

      var statusCode, result, error;

      try {
        statusCode = response.statusCode.toString();
        result = JSON.parse(body);
      }
      catch (ex) {
        // Ignore Errors
      }
      if (Object.keys(failCodes).indexOf(statusCode) !== -1) {
        error = new Error('Nodejitsu Error (' + statusCode + '): ' + failCodes[statusCode]);
        error.result = result;
        return callback(error);
      }

      success(response, result);
    });

    fs.createReadStream(file).pipe(out);
  });
};
