var logger = require('./logger.js');
const Encryptor = require('./encryptor.js');
const ApHttper = require('./ap-httper.js');
const ApUdper = require('./ap-udper.js');

module.exports = function() {

  var TAG = 'smartaplink_lib.commons.ap-configer';
  var encryptor = null;
  var apHttper = new ApHttper();
  var apUdper = new ApUdper();

  var setAp = function(apNetter, wifiSsid, wifiPasssword, userData) {

    logger.info(TAG, 'configAp->setAp');

    var setConfigRequest = {
      CID: 30005,
      PL: {
        SSID: wifiSsid,
        Password: wifiPasssword,
        Userdata: userData
      }
    };

    return apNetter.post(setConfigRequest);
  };

  var restartAp = function(apNetter) {

    logger.info(TAG, 'configAp->restartAp');

    var restartRequest = {
      CID: 30007,
      PL: null
    }

    return apNetter.post(restartRequest);
  }

  var configTask = function(apNetter, wifiSsid, wifiPasssword, userData) {

    return setAp(apNetter, wifiSsid, wifiPasssword, userData)
      .then(res => {
        return restartAp(apNetter);
      })
      .then(res => {
        return Promise.reject(true);
      })
      .catch(res => {
        if (res) {

          logger.info(TAG, 'configTask', apNetter.name, 'succeed');
          return Promise.reject(true);
        } else {
          logger.warn(TAG, 'configTask', apNetter.name, 'failed');
          return Promise.resolve(false);
        }
      });
  }

  this.configAp = function(apSsid, wifiSsid, wifiPasssword, userData) {

    encryptor = new Encryptor(apSsid);
    var apNetters = [apHttper, apUdper];    
    var configTasks = [];

    for (var i = 0; i < apNetters.length; i++) {

      apNetters[i].init({
        encryptor: encryptor
      });
      configTasks.push(configTask(apNetters[i], wifiSsid, wifiPasssword, userData));
    }

    return Promise.all(configTasks).then(res => {

      return Promise.reject(false);
    }).catch(res => {

      if (res) {
        return Promise.resolve();
      } else {
        return Promise.reject();
      }
    }).finally(() => {

      for (var i = 0; i < apNetters.length; i++) {
        apNetters[i].destroy();
      }
    });
  };
};