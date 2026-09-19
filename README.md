# Mac Spatial Twin

本地 Three.js 原型：可视化这台 MacBook 的真实铰链角度、整机 pitch / roll / yaw 与状态。

## 获取项目

```bash
git clone --recurse-submodules https://github.com/CyberFork/digitalMBP.git
cd digitalMBP
```

如果普通克隆时没有加入 `--recurse-submodules`，一键启动脚本也会自动初始化传感器子模块。

## 一键启动（推荐）

在 Finder 中双击：

```text
启动真实数字孪生.command
```

首次运行会请求一次 macOS 管理员密码，用于读取 Apple SPU 的真实 IMU 与铰链角传感器。页面、传感器桥均只绑定 `127.0.0.1`。

## 手动启动

```bash
npm install
npm run dev
```

访问终端输出的本地地址。

## 真实传感器桥

安装传感器依赖后，另开一个终端运行：

```bash
python3 -m venv .venv
.venv/bin/pip install -e vendor/apple-silicon-accelerometer websockets
sudo .venv/bin/python sensor-bridge.py
```

桥接器只绑定到 `127.0.0.1:8765`，不保存传感器记录、不会向网络发送数据。其读取 Apple Silicon 的未公开 SPU HID 设备，因此需要管理员权限。

传感器读取基于 [`olvvier/apple-silicon-accelerometer`](https://github.com/olvvier/apple-silicon-accelerometer)，以 Git 子模块固定版本并保留其 MIT 许可证。

每条消息使用 JSON：

```json
{
  "lidAngle": 112.4,
  "pitch": 1.3,
  "roll": -0.8,
  "yaw": 12.0
}
```

后续可将 `pybooklid` 的铰链读数与 Apple Silicon IMU 的姿态融合数据写入该 WebSocket。

姿态采用机身语义坐标：`pitch` 表示键盘前后倾斜，`roll` 表示机身左右倾斜；铰链角为 `0°` 合盖、`90°` 垂直、继续增大时屏幕向后打开。

## 键盘数字孪生

页面包含 MacBook ANSI 实体键位布局。页面处于前台时，浏览器通过标准 `KeyboardEvent.code` 捕获本机键盘事件并点亮对应 3D 键帽；不会记录键入的字符内容，也不会上传按键事件。Touch ID 及部分由 macOS 独占的 Fn 组合可能不会产生浏览器事件。

## 说明

页面不包含模拟数据。传感器桥未运行时会显示“等待本机传感器”。Apple Silicon 内置传感器所用的 IOKit/HID 接口未公开，macOS 更新后可能需要适配。
