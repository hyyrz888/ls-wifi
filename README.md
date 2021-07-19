#### SDK引入
  ```shell scrpit
npm install @ls-wifi
  ```

#### 初始化
```javascript
import WifiManager from '@ls/wifi'

WifiManager.init()
```


#### 获取当前Wifi
```javascript

{
  code:200, // 200获取成功，-1 获取失败
  content:wifiName,
  msg:'' // message
}

WifiManager.getConnectedWifi(function(res){
     if (res.code == 200){
       let wifiName = res.content;
     }
})

```



#### 开始配网

```javascript
 /**
   * 
   * options {
   * type: 1
   * deviceIdOrSN: "deviceIdorSN",
   * wifiName:"wifiName",
   * wifiPwd:"wifiPwd" , 
   * success(res){}, 
   * fail(res){}, 
   * progress(res){}, 
   * susbends(res){}
   * }
   */
WifiManager.startWifi({
  type: 1,
  deviceIdOrSN: this.deviceId, 
  wifiName: this.wifiName, 
  wifiPwd: this.wifiPwd, 
  success: function(res){
    console.log('--配网成功--', res)
  },
  fail: function(res){
    console.log('--配网失败--', res)
  },
  progress:function(res){
    switch (res.code){
      case 10002:
        //正在连接AP
        break;
      case 10004:
        //正在回连手机Wi-Fi
        break;
      case 10005:
        //正在配置设备
        break;
      default:
        break;
    }
    console.log('--配网进度--', res)
  },
  suspend: function(res){
    console.log('--配网中断--', res)
  }
}) 
```

#### 销毁

```javascript
///再一次配网需要先调用destory
WifiManager.destroy()
```

