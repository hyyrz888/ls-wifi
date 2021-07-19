const logger = require('./logger.js');
const utils = require('./utils.js');
const ApConfiger = require('./ap-configer.js');

module.exports = function () {
	var TAG = 'smartaplink_lib.commons.ap-linker.{0}:';

	var apSsid;
	var apPassword;
	var wifiSsid;
	var wifiPasssword;
	var matching;
	var userData = '';
	var successCallback;
	var failCallback;
	var progressCallback;
	var suspendCallback;
	var maxRetryTimes = 10;
	var MAX_TIMES_SCAN_AP = 10;
	var MAX_TIMES_CONNECT_AP = 2;
	var discoveryDeviceStarted = false;
	var onLocalServiceFoundCallback = null;
	var onLocalServiceDiscoveryStopCallback = null;
	var getConnectedWifiInterval = -1;
	var checkApConnectedInterval = -1;
	var self = this;
	var started = false;
	var apConfiger = new ApConfiger();

	var startWifi = function () {
		return new Promise(function (resolve, reject) {
			wx.startWifi({
				success: function (res) {
					logger.log(TAG.format('startWifi'), 'start wifi success -', JSON.stringify(res));
					resolve(true);
				},
				fail: function (res) {
					logger.warn(TAG.format('startWifi'), 'start wifi fail -', JSON.stringify(res));
					resolve(false);
				}
			});
		});
	};

	var stopWifi = function () {
		return new Promise(function (resolve, reject) {
			wx.stopWifi({
				success: function (res) {
					logger.log(TAG.format('stopWifi'), 'stop wifi success -', JSON.stringify(res));
					resolve(true);
				},
				fail: function (res) {
					logger.warn(TAG.format('stopWifi'), 'stop wifi fail -', JSON.stringify(res));
					resolve(false);
				}
			});
		});
	};

	var scanAp = function (apSsid, matching, state) {
		return new Promise(function (resolve, reject) {
			var wifiInfo = null;
			var times = 0;
			var retryInMills = 1000;

			wx.onGetWifiList(function (res) {
				logger.log(TAG.format('scanAp'), 'onGetWifiList:', JSON.stringify(res));

				if (!res || !res['wifiList'] || !res['wifiList'].length) {
					logger.warn(TAG.format('scanAp'), 'onGetWifiList: empty wifi list');
					return;
				}

				var wifiList = res['wifiList'];
				var index = -1;
				for (var i = 0; i < wifiList.length; i++) {
					if (utils.isMatched(wifiList[i]['SSID'], apSsid, matching)) {
						index = i;
						break;
					}
				}

				if (index != -1) {
					wifiInfo = wifiList[index];
				}
			});

			var retryOrTerminateGetWifiList = function () {
				logger.log(TAG.format('scanAp'), 'wx.getWifiList (NO.{0} times): not find ap "{1}"'.format(times, apSsid));

				if (times >= MAX_TIMES_SCAN_AP) {
					logger.warn(TAG.format('scanAp'), 'scanAp failed: not find ap "{0}" in {1} times'.format(apSsid, times));
					reject(state);
				} else {
					logger.log(TAG.format('scanAp'), 'it will retry to wx.getWifiList in {0}ms'.format(retryInMills));
					setTimeout(getWifiList, retryInMills);
				}
			};

			var findAp = function () {
				var count = 0;
				var checkWifiInfoInterval = setInterval(function () {
					if (!started || wifiInfo != null || ++count >= 60) {
						clearInterval(checkWifiInfoInterval);

						if (!started) {
							logger.info(TAG.format('scanAp'), 'ap link task is stoped');
							reject(self.state.TASK_CANCEL);
						} else if (wifiInfo != null) {
							logger.info(TAG.format('scanAp'), 'find ap "{0}" at NO.{1} times'.format(apSsid, times));
							resolve(wifiInfo);
						} else {
							retryOrTerminateGetWifiList();
						}
					}
				}, 50);
			};

			var getWifiList = function () {
				times++;
				logger.log(TAG.format('scanAp'), 'wx.getWifiList (NO.{0} times).'.format(times));

				wx.getWifiList({
					success: function (res) {
						logger.log(
							TAG.format('scanAp'),
							'wx.getWifiList (NO.{0} times) success:'.format(times),
							JSON.stringify(res)
						);
						findAp();
					},
					fail: function (res) {
						logger.warn(
							TAG.format('scanAp'),
							'wx.getWifiList (NO.{0} times) failed:'.format(times),
							JSON.stringify(res)
						);

						if (started) {
							retryOrTerminateGetWifiList();
						} else {
							logger.info(TAG.format('scanAp'), 'ap link task is stoped');
							reject(self.state.TASK_CANCEL);
						}
					}
				});
			};

			progress(state);

			getWifiList();
		});
	};

	var connectAp = function (wifiInfo, state) {
		return new Promise(function (resolve, reject) {
			logger.log(TAG.format('connectAp'), 'start to connect ap', JSON.stringify(wifiInfo));

			var times = 0;
			var retryInMills = 2000;
			var connected = false;

			var onwifiConnectedHandle = function (res) {
				logger.log(TAG.format('connectAp'), 'onWifiConnected:', JSON.stringify(res));

				// if (!connected && res && res['wifi'] &&
				//   res['wifi']['SSID'] == wifiInfo['SSID']) {

				if (!connected) {
					logger.log(TAG.format('connectAp'), 'onWifiConnected: the ap "{0}" is connected'.format(wifiInfo['SSID']));
					connected = true;
				}
			};

			var offWifiConnected = function () {
				logger.log(TAG.format('connectAp'), 'offWifiConnected:');
				wx.offWifiConnected(onwifiConnectedHandle);
			};

			wx.onWifiConnected(onwifiConnectedHandle);

			var retryOrTerminateConnect = function () {
				logger.log(
					TAG.format('connectAp'),
					'wx.connectWifi (NO.{0} times): it can not connect ap "{1}"'.format(times, wifiInfo['SSID'])
				);

				if (times >= MAX_TIMES_CONNECT_AP) {
					logger.warn(
						TAG.format('connectAp'),
						'connectAp failed: connect ap "{0}" failed in {1} times'.format(wifiInfo['SSID'], times)
					);
					offWifiConnected();

					var action = {
						next: function () {
							resolve(wifiInfo);
						},
						stop: function () {
							reject(state);
						}
					};

					suspend(
						state,
						{
							ssid: wifiInfo['SSID'],
							password: wifiInfo['password']
						},
						action
					);
					// reject(state);
				} else {
					logger.log(TAG.format('connectAp'), 'it will retry to wx.connectWifi in {0}ms'.format(retryInMills));
					setTimeout(connectWifi, retryInMills);
				}
			};

			var checkApConnection = function () {
				var count = 0;
				checkApConnectedInterval = setInterval(function () {
					if (!started || connected || ++count >= 160) {
						clearInterval(checkApConnectedInterval);

						if (!started) {
							logger.info(TAG.format('connectAp'), 'ap link task is stoped');
							offWifiConnected();
							reject(self.state.TASK_CANCEL);
						} else if (connected) {
							logger.info(
								TAG.format('connectAp'),
								'connectAp succeed: ap "{0}" is connected at NO.{1} times'.format(wifiInfo['SSID'], times)
							);
							offWifiConnected();
							resolve(wifiInfo);
						} else {
							retryOrTerminateConnect();
						}
					}
				}, 50);
			};

			var connectWifi = function () {
				if (!started) {
					logger.info(TAG.format('connectAp'), 'ap link task is stoped');
					offWifiConnected();
					reject(self.state.TASK_CANCEL);
				}

				times++;
				logger.log(TAG.format('connectAp'), 'wx.connectWifi (NO.{0} times).'.format(times));

				wx.connectWifi({
					SSID: wifiInfo['SSID'],
					// BSSID: wifiInfo['BSSID'],
					password: wifiInfo['secure'] ? wifiInfo['password'] : '',
					success: function (res) {
						logger.log(
							TAG.format('connectAp'),
							'wx.connectWifi (NO.{0} times) success:'.format(times),
							JSON.stringify(res)
						);
						// checkApConnection();
						offWifiConnected();
						resolve(wifiInfo);
					},
					fail: function (res) {
						logger.warn(
							TAG.format('connectAp'),
							'wx.connectWifi (NO.{0} times) failed:'.format(times),
							JSON.stringify(res)
						);

						if (res.errCode == 12007) {
							console.log('test=============> 用户拒绝加入wifi', res);
							fail(res.errCode, res.errMsg);
							return;
						}

						if (started) {
							retryOrTerminateConnect();
						} else {
							logger.info(TAG.format('connectAp'), 'ap link task is stoped');
							offWifiConnected();
							reject(self.state.TASK_CANCEL);
						}
					}
				});
			};
			state.data = wifiInfo;
			progress(state);

			connectWifi();
		});
	};

	var configAp = function () {
		logger.info(TAG.format('configAp'));

		return new Promise((resolve, reject) => {
			progress(self.state.CONFIG_AP);

			apConfiger
				.configAp(apSsid, wifiSsid, wifiPasssword, userData)
				.then((res) => {
					resolve();
				})
				.catch((e) => {
					reject(self.state.CONFIG_AP);
				});
		});
	};

	var success = function () {
		if (typeof successCallback === 'function') {
			try {
				successCallback();
			} catch (e) {}
		}
	};

	var fail = function (code, message, data) {
		if (typeof failCallback === 'function') {
			try {
				failCallback({
					code: code,
					msg: message,
					data: data
				});
			} catch (e) {}
		}
	};

	var progress = function (state) {
		if (typeof progressCallback === 'function') {
			try {
				progressCallback(state);
			} catch (e) {}
		}
	};

	var suspend = function (state, data, action) {
		if (typeof suspendCallback === 'function') {
			try {
				suspendCallback(state);
			} catch (e) {}
		}
	};

	this.state = {
		VALIDATE_PARAMS: {
			name: 'VALIDATE_PARAMS',
			description: '正在检查参数',
			error: {
				code: -10000,
				msg: '参数错误'
			}
		},
		SCAN_AP: {
			name: 'SCAN_AP',
			description: '正在搜索设备AP',
			error: {
				code: -10001,
				msg: '未搜索到设备AP'
			}
		},
		CONNECT_AP: {
			name: 'CONNECT_AP',
			description: '正在连接设备',
			error: {
				code: -10002,
				msg: '连接设备AP失败'
			}
		},
		SCAN_ORIGINAL_WIFI: {
			name: 'SCAN_ORIGINAL_WIFI',
			description: '正在回连手机Wi-Fi',
			error: {
				code: -10003,
				msg: '回连手机Wi-Fi失败'
			}
		},
		CONNECT_ORIGINAL_WIFI: {
			name: 'CONNECT_ORIGINAL_WIFI',
			description: '正在回连手机Wi-Fi',
			error: {
				code: -10004,
				msg: '回连手机Wi-Fi失败'
			}
		},
		CONFIG_AP: {
			name: 'CONFIG_AP',
			description: '正在配置设备',
			error: {
				code: -10005,
				msg: '配置设备信息失败'
			}
		},
		TASK_ALREADY_EXIST: {
			name: 'TASK_ALREADY_EXIST',
			description: '已有一个设备配置任务正在进行中',
			error: {
				code: -10006,
				msg: '已有一个设备配置任务正在进行中'
			}
		},
		TASK_CANCEL: {
			name: 'TASK_CANCEL',
			description: '已取消配置设备',
			error: {
				code: -10007,
				msg: '已取消配置设备'
			}
		}
	};

	/**
	 * 停止发现设备
	 */
	this.stopScanDeviceDiscovery = function () {
		discoveryDeviceStarted = false;

		wx.stopLocalServiceDiscovery({
			serviceType: '_hf._tcp.',
			complete: function (res) {
				logger.log(TAG.format('stopScanDeviceDiscovery'), 'stopLocalServiceDiscovery complete', JSON.stringify(res));

				if (onLocalServiceFoundCallback != null) {
					wx.offLocalServiceFound(onLocalServiceFoundCallback);
					onLocalServiceFoundCallback = null;
				}
			}
		});
	};

	/**
	 * 启动发现设备
	 * object: {apSsid: string[option], onDeviceFound: function}
	 */
	this.startDeviceDiscovery = function (object) {
		discoveryDeviceStarted = true;
		var devices = [];

		if (onLocalServiceFoundCallback != null) {
			wx.offLocalServiceFound(onLocalServiceFoundCallback);
		}
		onLocalServiceFoundCallback = function (res) {
			logger.info(TAG.format('onLocalServiceFound'), JSON.stringify(res));

			if (object && typeof object['onDeviceFound'] === 'function') {
				var deviceInfos = res['serviceName'].split('`');
				if (deviceInfos.length < 3) {
					return;
				}

				var mac = deviceInfos[0];
				var mid = deviceInfos[1];
				var apSsid = deviceInfos[2];
				var ip = res['ip'];

				if (devices.indexOf(mac) == -1 && utils.isMatched(apSsid, object['apSsid'], object['matching'])) {
					devices.push(mac);
					object['onDeviceFound']({
						mid: mid,
						mac: mac,
						apSsid: apSsid,
						ip: ip
					});
				}
			}
		};
		wx.onLocalServiceFound(onLocalServiceFoundCallback);

		if (onLocalServiceDiscoveryStopCallback != null) {
			wx.offLocalServiceDiscoveryStop(onLocalServiceDiscoveryStopCallback);
		}
		onLocalServiceDiscoveryStopCallback = function (res) {
			logger.info(TAG.format('onLocalServiceDiscoveryStop'), JSON.stringify(res));
			if (discoveryDeviceStarted) {
				localServiceDiscovery();
			} else {
				wx.offLocalServiceDiscoveryStop(onLocalServiceDiscoveryStopCallback);
				onLocalServiceDiscoveryStopCallback = null;
			}
		};
		wx.onLocalServiceDiscoveryStop(onLocalServiceDiscoveryStopCallback);

		var localServiceDiscovery = function () {
			if (!discoveryDeviceStarted) {
				return;
			}

			wx.startLocalServiceDiscovery({
				serviceType: '_hf._tcp.',
				success: function (res) {
					logger.log(TAG.format('findDevice'), 'startLocalServiceDiscovery success', JSON.stringify(res));
				},
				fail: function (res) {
					logger.warn(TAG.format('findDevice'), 'startLocalServiceDiscovery fail', JSON.stringify(res));

					if (res['errMsg'].indexOf('scan task already exist') == -1) {
						setTimeout(localServiceDiscovery, 3000);
					}
				}
			});
		};

		localServiceDiscovery();
	};

	/**
	 * options: {
	 *  wifiSsid: string, the ssid of conected wifi
	 *  wifiPassword: string, the password of connected wifi
	 *  apSsid: string, the ssid of ap
	 *  apPassword: string, the password of ap
	 *  matching: left|right|center|full,
	 *  userData: [option]
	 * }
	 */
	this.start = function (options) {
		if (started) {
			fail(self.state.TASK_ALREADY_EXIST.error.code, self.state.TASK_ALREADY_EXIST.error.msg);
			return;
		}

		if (typeof options !== 'object') {
			return;
		}

		wifiSsid = options.wifiSsid;
		wifiPasssword = utils.isEmpty(options.wifiPassword) ? '' : options.wifiPassword;
		apSsid = options.apSsid;
		apPassword = utils.isEmpty(options.apPassword) ? '' : options.apPassword;
		matching = options.matching;
		userData = utils.isEmpty(options.userData) ? '' : options.userData;
		successCallback = options.success;
		progressCallback = options.progress;
		failCallback = options.fail;
		suspendCallback = options.suspend;

		var paramsError = {};
		if (utils.isEmpty(wifiSsid)) {
			paramsError['wifiSsid'] = 'wifiSsid is empty';
		}

		if (utils.isEmpty(apSsid)) {
			paramsError['apSsid'] = 'apSsid is empty';
		}

		if (Object.keys(paramsError).length) {
			logger.info('abort to start AP link, invalid parameters: ', JSON.stringify(paramsError));
			fail(self.state.VALIDATE_PARAMS.error.code, self.state.VALIDATE_PARAMS.error.msg, paramsError);
			return;
		}

		started = true;

		//as ios doesn't support wx.getWifiList, it removes scan ap and connects directly
		// scanAp(apSsid, matching, self.state.SCAN_AP)
		//   .then(wifiInfo => {
		//     return connectAp(wifiInfo, apPassword, self.state.CONNECT_AP);
		//   })

		var wifiInfo = {
			SSID: apSsid,
			password: apPassword ? apPassword : '',
			secure: !utils.isEmpty(apPassword) && apPassword.length
		};
		connectAp(wifiInfo, self.state.CONNECT_AP)
			.then(() => {
				return configAp();
			})
			// .then(res => {
			//   return scanAp(wifiSsid, null, self.state.SCAN_ORIGINAL_WIFI);
			// })
			.then((res) => {
				wifiInfo = {
					SSID: wifiSsid,
					password: wifiPasssword,
					secure: !utils.isEmpty(wifiPasssword) && wifiPasssword.length
				};

				return connectAp(wifiInfo, self.state.CONNECT_ORIGINAL_WIFI);
			})
			.then(() => {
				logger.info(TAG.format('start'), 'the whole ap link task is succeed!');

				success();
				self.stop();
			})
			.catch((e) => {
				logger.warn(TAG.format('start'), 'catch exception', JSON.stringify(e));
				self.stop();
				if (e && e.error && e.error.code != self.state.TASK_CANCEL.error.code) {
					fail(e.error.code, e.error.msg);
				}
			});
	};

	this.stop = function () {
		started = false;
	};

	this.init = async function () {
		return await startWifi();
	};

	this.destroy = async function () {
		this.stop();
		if (getConnectedWifiInterval != -1) {
			clearInterval(getConnectedWifiInterval);
			getConnectedWifiInterval = -1;
		}
		return await stopWifi();
	};

	this.getConnectedWifi = function (callback) {
		wx.getConnectedWifi({
			success: function (res) {
				callback({
					success: true,
					res: res
				});
			},
			fail: function (res) {
				callback({
					success: false,
					res: res
				});
			}
		});
	};

	this.listenWifiStateChange = function (callback) {
		this.unlistenWifiStateChange();
		var previousWifi = null;
		var wifiNotStarted = 0;

		var wifiInfoCallback = function (result) {
			var wifi = false;

			// logger.log(TAG.format('getConnectedWifiInterval'), JSON.stringify(result));

			if (
				!result['success'] &&
				(result['res']['errCode'] == 12000 || result['res']['errMsg'].indexOf('开发者工具暂时不支持') != -1)
			) {
				wifiNotStarted++;

				if (wifiNotStarted >= 10) {
					clearInterval(getConnectedWifiInterval);
					getConnectedWifiInterval = -1;
				}

				return;
			}

			if (started) {
				previousWifi = null;
				return;
			}

			wifiNotStarted = 0;

			if (result['success']) {
				wifi = result['res']['wifi']['SSID'];
			}
			if (wifi != previousWifi) {
				if (typeof callback === 'function') {
					try {
						callback(result['success'], result['res']);
					} catch (e) {}
				}

				previousWifi = wifi;
			}
		};

		var action = function () {
			self.getConnectedWifi(wifiInfoCallback);
		};

		getConnectedWifiInterval = setInterval(action, 1500);

		action();
	};

	this.unlistenWifiStateChange = function () {
		if (getConnectedWifiInterval != -1) {
			clearInterval(getConnectedWifiInterval);
			getConnectedWifiInterval = -1;
		}
	};
};
