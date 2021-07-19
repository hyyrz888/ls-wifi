
var Logger = require('./smartaplink_lib/logger');

const base_url = 'https://sports.lifesense.com';

/**
 *
 * @param params
 *   url:例如/rbac-web/auth/app
 *   data:{};
 *   method: POST / GET
 *   header:{}
 * @returns {Promise<>}
 */
function request(params) {
  
  let url = base_url + params.url;
  let header = params.header || {};
  return new Promise((resolve, reject) => {
    wx.request({
      url: url,
      data: params.data || null,
      method: params.method || 'GET',
      header: header,
      success: res => {
        Logger.log('url', url);
        Logger.log('post', params.data);
        Logger.log('response:', res.data);
        if (res.statusCode === 200) {
          return resolve(res.data);
        } else {
          return reject(res.errMsg);
        }
      },
      fail: err => {
        return reject(err);
      },
    });
  });
}

export {
  request,
};