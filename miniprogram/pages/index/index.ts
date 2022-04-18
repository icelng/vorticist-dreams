const app = getApp<IAppOption>()
import { getCharateristic } from "../../utils/util"
import { Buffer } from 'buffer';

const SERVICE_UUID_MAGIC = "0000000A-0000-1000-8000-00805F9B34FB"
const CHAR_UUID_MAGIC = "00000A01-0000-1000-8000-00805F9B34FB"

Page({
  data: {
    slideButtons:[{type: "", text: "", src: ""}],
    devices: [] as Array<BLEDevice>,
    historyDevices: [] as Array<BLEDevice>,
    hasHistoryDevice: false,
    showScanContainer: false,
    isScanning: false,
    isConnectDisabled: false,
  },
  isBLEAvalabled: false,
  devicesFound: [] as Array<BLEDevice>,
  timeoutNoForReinitBLE: undefined as number | undefined,

  btnShowScanContainer() {
    this.setData({showScanContainer: true})
  },

  onScanContainerEnter() {
    this.btnStartScanning()
  },

  btnStartScanning() {
    this.checkBLEEnable((isEnabled) => {
      if (isEnabled) {
        this.setData({isScanning: true})
        wx.startBluetoothDevicesDiscovery({
          allowDuplicatesKey: false,
        })

      }
    })
  },

  stopScanning() {
    wx.stopBluetoothDevicesDiscovery()
    this.setData({isScanning: false})
  },

  onScanContainerLeave() {
    this.stopScanning()
  },

  btnRemoveHistoryDevice(event : WechatMiniprogram.BaseEvent) {
    var devices = this.data.historyDevices
    var index = event.currentTarget.dataset.itemIndex
    var device = devices[index]
    this.removeHistoryDevice(device.deviceId)
    devices.splice(index, 1)
    this.setData({historyDevices: devices})
  },

  btnConnectDevice(event : WechatMiniprogram.BaseEvent) {
    var device = this.devicesFound[event.currentTarget.dataset.itemIndex]
    this.stopScanning()
    this.checkBLEEnable((isEnabled) => {
      if (isEnabled) this.connectDeivce(device)
    })
  },

  btnConnectHistoryDevice(event : WechatMiniprogram.BaseEvent) {
    var device = this.data['historyDevices'][event.currentTarget.dataset.itemIndex]
    this.checkBLEEnable((isEnabled) => {
      if (isEnabled) this.connectDeivce(device)
    })
  },
  
  async connectDeivce(device: BLEDevice) {
    if (!this.isBLEAvalabled) {
      return
    }

    wx.showToast({
        title: "正在连接设备",
        icon: 'loading',
        mask: true,
        duration: 10000
    })

    this.setData({isConnectDisabled: true})

    try {
      await wx.createBLEConnection({deviceId: device.deviceId, timeout: 10000})
      wx.hideToast()
    } catch(e) {
      wx.showToast({
          title: "连接失败！",
          icon: 'error',
          mask: false,
          duration: 1000
      })
      console.log("Failed to connect device, ", e)
      throw e
    }

    try {
      var password = await this.loginBLE(device.deviceId)
      console.log("Loging: ", password)
    } catch(e) {
      await wx.showModal({confirmText: "芝麻开门",
                          title: '(￣ー￣)口令好像错了，喊一下"芝麻开门"试试？',
                          showCancel: false})
      await wx.closeBLEConnection({deviceId: device.deviceId})
      app.globalData.connectedDevice = undefined
      throw e
    }

    var connectedDevice:BLEDevice = {name: device.name, deviceId: device.deviceId}
    app.globalData.connectedDevice = connectedDevice
    this.saveHistoryDevice(connectedDevice)
    wx.switchTab({url: "../timer-mgt/timer-mgt"})

    this.setData({isConnectDisabled: false})
  },

  saveHistoryDevice(device: BLEDevice) {
    wx.setStorageSync("hd-" + device.deviceId, device)
  },

  getHistoryDevice(deviceId: string) {
    try {
      return wx.getStorageSync("hd-" + deviceId)
    } catch (e) {
      console.log(e)
    }
  },

  listHistoryDevices() {
    wx.getStorageInfo({
      success: (res) => {
        let devices = []
        for (let i = 0; i < res.keys.length; i++) {
          let key = res.keys[i]
          if (key.substring(0, 3) === "hd-") {
            let device = this.getHistoryDevice(key.substring(3, key.length));
            devices.push(device)
          }
        }
        if (devices.length > 0) {
          this.setData({hasHistoryDevice: true})
        } else {
          this.setData({hasHistoryDevice: false})
        }
        this.setData({historyDevices: devices})
      }
    })
  },

  removeHistoryDevice(deviceId: string) {
    wx.removeStorageSync("hd-" + deviceId)
  },

  onShow() {
    if (app.globalData.connectedDevice !== undefined) {
      wx.closeBLEConnection({deviceId: app.globalData.connectedDevice.deviceId})
      app.globalData.connectedDevice = undefined
    }
    this.listHistoryDevices()
  },

  onLoad() {

    // wx.switchTab({
    //   url: '../timer-mgt/timer-mgt',
    //   success: () => {

    //   }
    // })

    // wx.switchTab({
    //   url: '../humidity/humidity',
    //   success: () => {

    //   }
    // })

    // 监听扫描到新设备事件
    wx.onBluetoothDeviceFound((res) => {
      res.devices.forEach((device) => {
        if (device.name.length === 0) return
        this.devicesFound.push({name: device.name, deviceId: device.deviceId})
        this.setData({devices: this.devicesFound})
        console.log('Device Found', device)
      })
    })

    this.setData({
      slideButtons: [{
        type: 'warn',
        text: '删除',
        src: '/images/icon_del.svg', // icon的路径
      }],
    })
  },

  onUnload() {
    if (this.timeoutNoForReinitBLE !== undefined) {
      clearTimeout(this.timeoutNoForReinitBLE)
    }
  },

  checkBLEEnable(cb: (isEnable: boolean) => void) {
    if (this.isBLEAvalabled) {
      cb(true)
      return
    }

    wx.openBluetoothAdapter({
      mode: 'central',
      success: () => {
        console.log("init BLE successfully!")
        this.isBLEAvalabled = true
        cb(true)
      },
      fail: (e) => {
        this.isBLEAvalabled = false
        console.log("Init BLE failed!", e)
        wx.showModal({
          confirmText: "嗯嗯",
          title: "(≖ᴗ≖)✧蓝牙没有被打开哟!请打开蓝牙后再尝试一下吧！",
          showCancel: false
        })
        cb(false)
      }
    })
  },

  async loginBLE(deviceId: string): Promise<string> {
    var magicChar: WechatMiniprogram.BLECharacteristic
    try {
      magicChar = await getCharateristic(deviceId, SERVICE_UUID_MAGIC, CHAR_UUID_MAGIC)
    } catch(e) {
      throw e
    }

    try {
      await wx.notifyBLECharacteristicValueChange({deviceId: deviceId, serviceId: SERVICE_UUID_MAGIC, characteristicId: CHAR_UUID_MAGIC, state: true})
    } catch(e) {
      throw e
    }


    var password = (await wx.showModal({
      confirmText: "冲冲冲",
      title: '口令？',
      editable: true,
      showCancel: false
    })).content

    var promise = new Promise<string>((resolve, reject) => {
      app.listenCharValueChangeOnce(magicChar.uuid).then((result) => {
        var buffer = Buffer.from(result.value)
        var success = buffer.readUInt8(0)
        if (success === 1) {
          resolve(password)
        } else {
          reject("Failed to login ble")
        }
      }).catch((e) => {
        reject(e)
      })
    })

    try {
      var buffer = Buffer.from(password, "utf-8")
      await wx.writeBLECharacteristicValue({deviceId: deviceId,
                                            serviceId: SERVICE_UUID_MAGIC,
                                            characteristicId: CHAR_UUID_MAGIC,
                                            value: buffer.buffer})
    } catch {
      throw "Failed to write magic char!"
    }

    return promise
  },
})
