var logger = require('./logger.js');

module.exports = function() {

  var TAG = 'smartaplink_lib.commons.ap-httper';
  var encryptor = null;
  var stop = false;
  
  this.name = "ap-httper";

  this.init = function(obj) {
    encryptor = obj.encryptor;
    stop = false;
  };

  this.post = function(body) {

    var tag = TAG + '.post:';
    var bodyText = JSON.stringify(body);
    logger.info(tag, 'plain body -', bodyText);

    var encryptedBody = encryptor.encrypt(bodyText);
    logger.info(tag, 'encrypted body -', encryptedBody);

    return new Promise(function(resolve, reject) {

      var times = 0;

      var postAction = function(_body) {

        if(stop) {
          return;
        }

        if (times++ >= 5) {
          reject();
          return;
        }

        logger.log(tag, 'postAction: No.' + times, 'times');

        wx.request({
          url: 'http://10.10.100.254?linkType=wechatMiniApLink',
          data: _body,
          header: {
            "Content-Type": "text/plain; charset=UTF-8"
          },
          method: 'POST',
          dataType: 'text',
          responseType: 'text',
          timeout: 8000 + times * 1000,
          success: function(res) {

            logger.log('ApHttper.post success:', JSON.stringify(res));

            if (res['statusCode'] == 200) {

              try {

                var response = JSON.parse(encryptor.decrypt(res['data']));
                if (response['RC'] == 0) {
                  resolve(response);
                  return;
                }
              } catch (e) {
                logger.error(JSON.stringify(e));
              }
            }

            postAction(_body);
          },
          fail: function(res) {
            logger.log('ApHttper.post fail:', JSON.stringify(res));
            postAction(_body);
          }
        });
      };

      postAction(encryptedBody);
    });
  };

  this.destroy = function() {
    stop = true;
    logger.info(TAG, 'destroy');
  };
};