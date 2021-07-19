const ApLinker = require('./smartaplink_lib/ap-linker');
import { request } from './request';
var Logger = require('./smartaplink_lib/logger');
var utils = require('./smartaplink_lib/utils.js');

var TAG = 'WifiManager.{0}:';

class WifiManager {
	apLinker = new ApLinker();
	checkWifiInterval = -1;
	checkTimes = 0;

	succeedCallback = null;
	failCallback = null;
	progressCallback = null;
	suspendCallback = null;

	constructor() {}

	async init() {
		// var self = this;
		return await this.apLinker.init();
	}

	/**
	 *
	 * @param {1为deviceId, 2为SN} type
	 * @param {设备SN或deviceiId} deviceIdOrSN
	 * @param {需配网的Wifi名称} wifiName
	 * @param {需配网Wifi密码} wifiPwd
	 */
	startWifi(options) {
		this.succeedCallback = options.success;
		this.failCallback = options.fail;
		this.progressCallback = options.progress;
		this.suspendCallback = options.suspend;
		let type = options.type;
		let snOrDeviceId = options.deviceIdOrSN;
		let ssid = options.wifiName;
		let password = options.wifiPwd;
		let params;
		if (utils.isBlank(snOrDeviceId) || utils.isBlank(ssid)) {
			Logger.error(TAG.format('startWifi'), " snOrDeviceId can't be nil and ssid can't be nil");
			return;
		}

		if (type == 1) {
			params = {
				ssid: ssid,
				deviceId: snOrDeviceId,
				wifiStatus: 0
			};
		} else if (type == 2) {
			params = {
				ssid: ssid,
				sn: snOrDeviceId,
				wifiStatus: 0
			};
		} else {
			Logger.error(TAG.format('startWifi'), 'type is error');
			return;
		}
		Logger.info(params);
		request({
			url: '/devicegateway_service/wifi/matchingWifi',
			method: 'POST',
			data: params
		}).then((res) => {
			if (res.code == 200 && res.data) {
				const { deviceSSID, wifiConfigType } = res.data;
				this.start(ssid, password, deviceSSID, null);
			} else {
				Logger.error(TAG.format('startWifi'), ' fetchMatchWifiType err', JSON.stringify(res));
				return;
			}
		});
		this.startCheckResult(snOrDeviceId, type);
	}

	destroy() {
		this.apLinker.destroy();
		this.stopCheckResult();
		this.succeedCallback = null;
		this.failCallback = null;
		this.progressCallback = null;
		this.suspendCallback = null;
	}

	startCheckResult(snOrDeviceId, type) {
		if (this.checkWifiInterval != -1) {
			clearInterval(this.checkWifiInterval);
			this.checkWifiInterval = -1;
		}
		this.checkTimes = 0;
		var self = this;
		var doAction = function () {
			self.checkConfigResult(snOrDeviceId, type);
		};
		this.checkWifiInterval = setInterval(doAction, 5000);
	}

	stopCheckResult() {
		if (this.checkConfigResult != -1) {
			clearInterval(this.checkWifiInterval);
			this.checkWifiInterval = -1;
		}
	}

	checkConfigResult(snOrDeviceId, type) {
		this.checkTimes++;
		let params;
		if (type == 1) {
			params = {
				deviceId: snOrDeviceId
			};
		} else if (type == 2) {
			params = {
				sn: snOrDeviceId
			};
		} else {
			Logger.error(TAG.format('startWifi'), 'type is error');
			return;
		}
		var self = this;
		request({
			url: '/devicegateway_service/wifi/getMatchingWifiInfo',
			method: 'POST',
			data: params
		}).then((res) => {
			Logger.info(TAG.format('checkConfigResult'), JSON.stringify(res));
			if (res.code == 200 && res.data) {
				if (res.data.wifiStatus == 2) {
					//TODO: Wi-Fi配置完成
					Logger.info('configure succeed!');

					self.handleSuccessCallback();
				}
			}
			if (self.checkTimes >= 10) {
				Logger.warn(TAG.format('checkConfigResult'), 'time out!');
				self.handleFailCallback({ code: 400, msg: 'time out', data: '' });
			}
		});
	}

	handleSuccessCallback() {
		if (this.succeedCallback != null) {
			try {
				this.succeedCallback({
					code: 200,
					msg: 'succeed!',
					data: ''
				});
				this.destroy();
			} catch (e) {}
		}
	}

	handleFailCallback(res) {
		if (this.failCallback != null) {
			try {
				this.failCallback({
					code: res.code,
					msg: res.message,
					data: res.data
				});
				console.log('test-> handleFailCallback', res);
				this.destroy();
			} catch (e) {}
		}
	}

	handleProgressCallback(res) {
		if (this.progressCallback != null) {
			try {
				var response = {};
				res.error = {};
				if (res.name === 'CONFIG_AP') {
					response.code = 10005;
					response.msg = '正在配置设备';
					response.data = res;
				} else if (res.name === 'CONNECT_ORIGINAL_WIFI') {
					response.code = 10004;
					response.msg = '正在回连手机Wi-Fi';
					response.data = res;
				} else if (res.name === 'CONNECT_AP') {
					response.code = 10002;
					response.msg = '正在连接设备';
					response.data = res;
				} else {
					return;
				}
				console.log(response);
				this.progressCallback(response);
			} catch (e) {}
		}
	}

	handleSuspendCallback() {
		if (this.suspendCallback != null) {
			try {
				this.suspendCallback(res);
			} catch (e) {}
		}
	}

	getConnectedWifi(callback) {
		this.apLinker.getConnectedWifi(function (result) {
			Logger.log(TAG.format('getConnectedWifi'), JSON.stringify(result));
			if (result['success']) {
				if (result['res']['wifi']['SSID'].length) {
					var ssid = result['res']['wifi']['SSID'];
					Logger.info('currentWifi:' + ssid);
					callback({ code: 200, content: ssid, msg: 'succeed' });
				} else {
					Logger.warn('获取Wi-Fi连接信息失败');
					callback({ code: -1, content: null, msg: '获取Wi-Fi连接信息失败' });
				}
			} else {
				var errorCode = result['res']['errCode'];
				let msg;
				if (errorCode == 12005) {
					Logger.warn('Wi-Fi已关闭');
					msg = 'Wi-Fi已关闭';
				} else if (errorCode == 12006) {
					Logger.warn('获取Wi-Fi连接信息失败,请打开手机GPS位置服务后重试');
					msg = '请打开手机GPS位置服务后重试';
				} else {
					Logger.warn('获取Wi-Fi连接信息失败,请关闭并再次打开Wi-Fi后重试');
					msg = '获取Wi-Fi连接信息失败,请关闭并再次打开Wi-Fi后重试';
				}
				callback({ code: errorCode || -1, content: null, msg: msg });
			}
		});
	}

	start(wifiSsid, wifiPwd, apSsid, apPwd) {
		var self = this;
		this.apLinker.start({
			wifiSsid: wifiSsid,
			wifiPassword: wifiPwd,
			apSsid: apSsid,
			apPassword: apPwd,
			matching: true,
			userData: '',
			success: (res) => {
				Logger.info(TAG.format('startApLink'), 'success', JSON.stringify(res));
				self.handleSuccessCallback();
			},
			fail: (res) => {
				Logger.warn(TAG.format('startApLink'), 'fail', JSON.stringify(res));
				self.handleFailCallback(res);
			},
			progress: (res) => {
				Logger.log(TAG.format('startApLink'), 'progress', JSON.stringify(res));
				self.handleProgressCallback(res);
			},
			suspend: function (res) {
				self.handleSuspendCallback(res);
			}
		});
	}
}

export default new WifiManager();
