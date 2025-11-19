# iOS (Physical iPhone) Testing Guide

## 0) Prereqs
- Xcode installed; add your Apple ID in **Xcode → Settings → Accounts**.
- iPhone and Mac on the **same Wi-Fi**.
- Flutter + CocoaPods installed (`pod --version` should work).
- USB cable (or wireless debugging configured).

## 1) Run backend on your Mac’s LAN IP
```bash
# Find LAN IP (Wi-Fi usually en0)
ipconfig getifaddr en0    # sample: 192.168.1.23

cd /Users/nishant/services/attendance_backend
source .venv/bin/activate
flask --app attendance_backend.app run --host=0.0.0.0 --port=8000
```
