#!/usr/bin/env python3
"""Loopback-only WebSocket bridge for this MacBook's real internal sensors.

Run with the project's virtual environment and sudo. It publishes only live
sensor values to 127.0.0.1; it writes no recordings and sends no data off-device.
"""

from __future__ import annotations

import asyncio
import json
import math
import os
import signal
import statistics
from contextlib import suppress

from macimu import IMU
from websockets.asyncio.server import serve

CLIENTS: set = set()


def finite(value):
    """Return a JSON-safe finite float, or None for unavailable data."""
    if value is None:
        return None
    number = float(value)
    return number if math.isfinite(number) else None


def level_from_gravity(samples):
    """Calculate MacBook chassis pitch/roll relative to gravity.

    The SPU IMU's X/Y axes are rotated relative to the semantic controls:
    acceleration on Y represents front/back chassis pitch, while acceleration
    on X represents left/right chassis roll.
    """
    window = samples[-48:]
    ax = statistics.fmean(sample.x for sample in window)
    ay = statistics.fmean(sample.y for sample in window)
    az = statistics.fmean(sample.z for sample in window)
    pitch = math.degrees(math.atan2(ay, -az))
    roll = math.degrees(math.atan2(ax, math.sqrt(ay * ay + az * az)))
    return pitch, roll, (ax, ay, az)


async def client_handler(websocket):
    CLIENTS.add(websocket)
    try:
        await websocket.wait_closed()
    finally:
        CLIENTS.discard(websocket)


async def broadcast(payload):
    if not CLIENTS:
        return
    encoded = json.dumps(payload, separators=(",", ":"), allow_nan=False)
    clients = tuple(CLIENTS)
    results = await asyncio.gather(*(client.send(encoded) for client in clients), return_exceptions=True)
    for client, result in zip(clients, results):
        if isinstance(result, Exception):
            CLIENTS.discard(client)


async def run():
    if os.geteuid() != 0:
        raise PermissionError("Run this bridge with sudo: the Apple SPU HID interface requires root.")
    if not IMU.available():
        raise RuntimeError("The Apple Silicon SPU IMU is not available on this Mac.")

    latest_lid = None
    latest_yaw = 0.0
    async with serve(client_handler, "127.0.0.1", 8765):
        with IMU(accel=True, gyro=True, lid=True, orientation=True, sample_rate=100) as imu:
            print("Real sensor bridge listening at ws://127.0.0.1:8765")
            while True:
                samples = imu.read_accel()
                if samples:
                    pitch, roll, gravity = level_from_gravity(samples)
                    orientation = imu.orientation()
                    if orientation is not None:
                        latest_yaw = orientation.yaw
                    lid = imu.read_lid()
                    if lid is not None and 0 <= lid <= 360:
                        latest_lid = lid
                    await broadcast({
                        "bridgeVersion": 3,
                        "axisConvention": "macbook-chassis-v2",
                        "lidAngle": finite(latest_lid),
                        "pitch": finite(pitch),
                        "roll": finite(roll),
                        "yaw": finite(latest_yaw),
                        "sampleRate": finite(imu.effective_sample_rate) or 0,
                        "gravity": {
                            "x": finite(gravity[0]),
                            "y": finite(gravity[1]),
                            "z": finite(gravity[2]),
                        },
                    })
                await asyncio.sleep(0.04)


if __name__ == "__main__":
    with suppress(KeyboardInterrupt):
        asyncio.run(run())
