var md5 = require('js-md5');
var aesjs = require('aes-js');
var base64js = require('base64-js');
var logger = require('./logger');

function Encryptor(key) {

  var aesKey = md5(key).substr(0, 32);
  var aesKeyBytes = aesjs.utils.hex.toBytes(aesKey);

  this.encrypt = function (plainText) {

    var tag = 'commons.Encryptor.encrypt:';
    logger.log(tag, 'plainText -', plainText);
    var plainTextBytes = aesjs.utils.utf8.toBytes(plainText);
    logger.log(tag, 'plainTextBytes -', aesjs.utils.hex.fromBytes(plainTextBytes));
    plainTextBytes = addPaddingBytes(plainTextBytes);

    logger.log(tag, 'aesKeyBytes -', aesjs.utils.hex.fromBytes(aesKeyBytes));

    var aesCbc = new aesjs.ModeOfOperation.cbc(aesKeyBytes, aesKeyBytes);
    var encryptedBytes = aesCbc.encrypt(plainTextBytes);
    logger.log(tag, 'encryptedBytes -', aesjs.utils.hex.fromBytes(encryptedBytes));

    var base64Text = base64js.fromByteArray(encryptedBytes);
    logger.log(tag, 'base64Text -', base64Text);

    return base64Text;
  };

  this.decrypt = function (encryptedText) {

    var tag = 'commons.Encryptor.decrypt:';
    logger.log(tag, 'encryptedText -', encryptedText);

    var encryptedBytes = base64js.toByteArray(encryptedText);
    logger.log(tag, 'encryptedBytes -', aesjs.utils.hex.fromBytes(encryptedBytes));

    logger.log(tag, 'aesKeyBytes -', aesjs.utils.hex.fromBytes(aesKeyBytes));

    var aesCbc = new aesjs.ModeOfOperation.cbc(aesKeyBytes, aesKeyBytes);
    var decryptedBytes = aesCbc.decrypt(encryptedBytes);
    logger.log(tag, 'decryptedBytes -', aesjs.utils.hex.fromBytes(decryptedBytes));

    decryptedBytes = removePaddingBytes(decryptedBytes);
    var plainText = aesjs.utils.utf8.fromBytes(decryptedBytes);
    logger.log(tag, 'plainText -"', plainText, '"');

    return plainText;
  };
  

  var addPaddingBytes = function(plain) {

    var size = plain.length;
    var remainder = size % 16;
    if (remainder == 0) {
      return plain;
    }

    var _plain = new Uint8Array(size + 16 - remainder);
    _plain.set(plain);

    return _plain;
  }

  var removePaddingBytes = function(padding) {

    var index = -1;
    for(var i = padding.length - 1; i > -1; i--) {

      if(padding[i] == 0) {
        index = i;
      }else {
        break;
      }
    }

    if (index == -1) {
      return padding;
    } else {
      var plain = new Uint8Array(index);
      aesjs._arrayTest.copyArray(padding, plain, 0, 0, index);
      return plain;
    }
  }
}

module.exports = Encryptor;