const Unibabel = require('browserify-unibabel');
const logger = require('./logger.js');

module.exports = function() {

  var TAG = 'smartaplink_lib.commons.ap-udper';

  var encryptor = null;
  var socket = wx.createUDPSocket();
  var onResponsedSucceed = null;
  var intervalId = -1;
  var onMessageCallback = function(res) {

    var uint8Array = new Uint8Array(res['message']);
    var message = Unibabel.utf8ArrToStr(uint8Array).trim();

    res['message'] = message;
    logger.log(TAG, 'socket.onMessage:', JSON.stringify(res));

    try {

      var response = JSON.parse(encryptor.decrypt(res['message']));
      if (response['RC'] == 0) {

        if (onResponsedSucceed) {
          onResponsedSucceed.call(this, response);
        }
      }
    } catch (e) {
      logger.error(JSON.stringify(e));
    }
  };

  this.name = "ap-udper";

  this.init = function(obj) {
    clearInterval(intervalId);
    encryptor = obj.encryptor;
    socket.onMessage(onMessageCallback);
    socket.bind();
  };

  this.post = function (body) {

    clearInterval(intervalId);

    var tag = TAG + '.post:';
    var bodyText = JSON.stringify(body);
    logger.info(tag, 'plain body -', bodyText);

    var encryptedBody = encryptor.encrypt(bodyText);
    logger.info(tag, 'encrypted body -', encryptedBody);

    return new Promise(function(resolve, reject) {

      var times = 0;

      var postAction = function(_body) {

        times++;
        logger.log(TAG, 'postAction: No.' + times, 'times');

        socket.send({
          address: '10.10.100.254',
          port: 48887,
          message: _body
        });
      };

      intervalId = setInterval(() => {

        if (times >= 10) {
          reject();
          return;
        }

        postAction(encryptedBody);
      }, 2000);

      onResponsedSucceed = function(response) {
        resolve(response);
      };

      postAction(encryptedBody);
    }).finally(() => {
      clearInterval(intervalId);
    })
  };

  this.destroy = function() {
    clearInterval(intervalId);
    socket.offMessage(onMessageCallback);
    logger.info(TAG, 'destroy');
  };
};