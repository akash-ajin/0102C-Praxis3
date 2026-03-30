from machine import Pin
import time

rx = Pin(14, Pin.IN)

START_MIN_US = 3500
START_MAX_US = 7000
BIT_THRESHOLD_US = 1400
BIT_TIMEOUT_US = 5000

def wait_for_level(pin, level, timeout_us):
    start = time.ticks_us()
    while pin.value() != level:
        if time.ticks_diff(time.ticks_us(), start) > timeout_us:
            return False
    return True

def measure_high_pulse(pin, timeout_us=10000):
    if not wait_for_level(pin, 1, timeout_us):
        return None

    start = time.ticks_us()

    if not wait_for_level(pin, 0, timeout_us):
        return None

    end = time.ticks_us()
    return time.ticks_diff(end, start)

def wait_for_start():
    while True:
        pulse = measure_high_pulse(rx, 20000)
        if pulse is None:
            continue

        if START_MIN_US <= pulse <= START_MAX_US:
            return True

def read_bit():
    pulse = measure_high_pulse(rx, BIT_TIMEOUT_US)
    if pulse is None:
        return None

    if pulse > BIT_THRESHOLD_US:
        return 1
    else:
        return 0

def read_16bit_number():
    value = 0

    for _ in range(16):
        bit = read_bit()
        if bit is None:
            return None
        value = (value << 1) | bit

    return value

print("RF receiver ready...")

while True:
    wait_for_start()
    number = read_16bit_number()

    if number is not None:
        text = "{:05d}".format(number)

        if text[0] in "12345" and text[-1] in "01":
            print("Received code:", text)
        else:
            print("Received 16-bit number but failed format check:", text)

    time.sleep_ms(50)