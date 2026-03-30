import time
from machine import Pin, I2C, ADC, UART

# -------------------------------------------------
# UART SETUP
# -------------------------------------------------
# UART1 on GP4/GP5
uart = UART(1, baudrate=115200, tx=Pin(4), rx=Pin(5))

# -------------------------------------------------
# FIELD FORMAT
# [field_id][3 encoded digits][end digit]
# Example: 16420
# -------------------------------------------------
FIELD_TAGS = {
    "bme_temp":   ("1", "5"),
    "bme_hum":    ("2", "0"),
    "bme_press":  ("3", "0"),
    "bme_gas":    ("4", "0"),
    "am_temp":    ("5", "0"),
    "am_hum":     ("4", "1"),
    "encoder":    ("1", "1"),
    "anemometer": ("2", "1"),
    "soil":       ("3", "1"),
}
# -------------------------------------------------
# BME680 DRIVER
# -------------------------------------------------
try:
    import bme680
except ImportError:
    bme680 = None
    print("BME680 driver not found: copy bme680.py to the Pico first")

# =========================
# I2C SETUP
# =========================
i2c_am = I2C(0, sda=Pin(0), scl=Pin(1), freq=100000)
i2c_bme = I2C(1, sda=Pin(2), scl=Pin(3), freq=100000)

AM2320_ADDR = 0x5C

print("AM2320 I2C scan:", [hex(x) for x in i2c_am.scan()])
print("BME680 I2C scan:", [hex(x) for x in i2c_bme.scan()])

# =========================
# BME680 INIT
# =========================
bme680_sensor = None
if bme680 is not None:
    try:
        bme680_sensor = bme680.Adafruit_BME680_I2C(i2c_bme, address=0x76)
        bme680_sensor.sea_level_pressure = 1013.25
        print("BME680 ready")
    except Exception as e:
        print("BME680 error:", e)
        bme680_sensor = None

# =========================
# ENCODER
# =========================
class IncrementalEncoder:
    _TRANSITIONS = {
        0b0001:  1,
        0b0010: -1,
        0b0100: -1,
        0b0111:  1,
        0b1000:  1,
        0b1011: -1,
        0b1101: -1,
        0b1110:  1,
    }

    def __init__(self, pin_a_num, pin_b_num):
        self.pin_a = Pin(pin_a_num, Pin.IN, Pin.PULL_UP)
        self.pin_b = Pin(pin_b_num, Pin.IN, Pin.PULL_UP)
        self.position = 0
        self._state = (self.pin_a.value() << 1) | self.pin_b.value()

        self.pin_a.irq(trigger=Pin.IRQ_RISING | Pin.IRQ_FALLING, handler=self._update)
        self.pin_b.irq(trigger=Pin.IRQ_RISING | Pin.IRQ_FALLING, handler=self._update)

    def _update(self, pin):
        new_state = (self.pin_a.value() << 1) | self.pin_b.value()
        transition = (self._state << 2) | new_state
        self.position += self._TRANSITIONS.get(transition, 0)
        self._state = new_state

encoder = IncrementalEncoder(14, 15)
ENCODER_COUNTS_PER_REV = 80
ENCODER_INVERT_DIRECTION = False
ENCODER_OFFSET_COUNTS = 0

# =========================
# ANALOG INPUTS
# =========================
anemometer = ADC(Pin(26))
soil = ADC(Pin(27))

def read_voltage(adc):
    return (adc.read_u16() * 3.3) / 65535.0

# =========================
# AM2320 LOW-LEVEL READ
# =========================
def read_am2320_safe():
    try:
        try:
            i2c_am.writeto(AM2320_ADDR, b"")
        except OSError:
            pass

        time.sleep_ms(2)
        i2c_am.writeto(AM2320_ADDR, bytes([0x03, 0x00, 0x04]))
        time.sleep_ms(2)

        result = bytearray(8)
        i2c_am.readfrom_into(AM2320_ADDR, result)

        if result[0] != 0x03:
            return None, None

        humidity = ((result[2] << 8) | result[3]) / 10.0

        temp_raw = ((result[4] & 0x7F) << 8) | result[5]
        temperature = temp_raw / 10.0
        if result[4] & 0x80:
            temperature = -temperature

        return temperature, humidity

    except Exception as e:
        print("AM2320 Error:", e)
        return None, None

# =========================
# ENCODING
# =========================
def clamp_3digit(val):
    val = int(round(val))
    if val < 0:
        return 0
    if val > 999:
        return 999
    return val

def encode_temp(temp_c):
    return clamp_3digit((temp_c + 40.0) * 10)

def encode_humidity(h):
    return clamp_3digit(h * 10)

def encode_pressure(p):
    return clamp_3digit(p - 900)

def encode_encoder(pos):
    """
    Encode encoder position as a wrapped single-turn count.
    This keeps output in 0..(COUNTS_PER_REV-1) so bridge calibration is stable
    even if the incremental counter drifts over time.
    """
    if ENCODER_COUNTS_PER_REV <= 0:
        return 0

    normalized = pos % ENCODER_COUNTS_PER_REV
    if ENCODER_INVERT_DIRECTION:
        normalized = (-normalized) % ENCODER_COUNTS_PER_REV
    normalized = (normalized + ENCODER_OFFSET_COUNTS) % ENCODER_COUNTS_PER_REV
    return clamp_3digit(normalized)

def encode_voltage(v):
    return clamp_3digit(v * 1000)

def encode_soil_voltage(v):
    """
    Soil-specific encoding using most of the 0-999 transport range.
    0.0V..3.3V maps to 0..990 with ~3.3 mV resolution:
      encoded = voltage * 300
    This avoids early saturation and preserves better detail.
    """
    return clamp_3digit(v * 300)

def encode_gas(g):
    return clamp_3digit(g / 1000.0)

def safe_encode(value, fn):
    if value is None:
        return 999
    return fn(value)

# =========================
# FIELD BUILDING
# =========================
def format_field(name, encoded_value):
    start_digit, end_digit = FIELD_TAGS[name]
    return start_digit + "{:03d}".format(encoded_value) + end_digit

def build_fields():
    # ---- BME680 ----
    if bme680_sensor is not None:
        try:
            bme_temp = bme680_sensor.temperature
            bme_hum = bme680_sensor.relative_humidity
            bme_press = bme680_sensor.pressure
            bme_gas = bme680_sensor.gas
        except Exception as e:
            print("BME680 read error:", e)
            bme_temp = None
            bme_hum = None
            bme_press = None
            bme_gas = None
    else:
        bme_temp = None
        bme_hum = None
        bme_press = None
        bme_gas = None

    # ---- AM2320 ----
    am_temp, am_hum = read_am2320_safe()

    # ---- Other sensors ----
    anemo_v = read_voltage(anemometer)
    soil_v = read_voltage(soil)
    enc_pos = encoder.position

    # ---- Encode ----
    enc_bme_temp  = safe_encode(bme_temp, encode_temp)
    enc_bme_hum   = safe_encode(bme_hum, encode_humidity)
    enc_bme_press = safe_encode(bme_press, encode_pressure)
    enc_bme_gas   = safe_encode(bme_gas, encode_gas)
    enc_am_temp   = safe_encode(am_temp, encode_temp)
    enc_am_hum    = safe_encode(am_hum, encode_humidity)
    enc_encoder   = encode_encoder(enc_pos)
    enc_anemo     = encode_voltage(anemo_v)
    enc_soil      = encode_soil_voltage(soil_v)

    fields = [
        format_field("bme_temp",   enc_bme_temp),
        format_field("bme_hum",    enc_bme_hum),
        format_field("bme_press",  enc_bme_press),
        format_field("bme_gas",    enc_bme_gas),
        format_field("am_temp",    enc_am_temp),
        format_field("am_hum",     enc_am_hum),
        format_field("encoder",    enc_encoder),
        format_field("anemometer", enc_anemo),
        format_field("soil",       enc_soil),
    ]

    raw = {
        "bme_temp": bme_temp,
        "bme_hum": bme_hum,
        "bme_press": bme_press,
        "bme_gas": bme_gas,
        "am_temp": am_temp,
        "am_hum": am_hum,
        "encoder": enc_pos,
        "anemo_v": anemo_v,
        "soil_v": soil_v,
    }

    encoded = {
        "bme_temp": enc_bme_temp,
        "bme_hum": enc_bme_hum,
        "bme_press": enc_bme_press,
        "bme_gas": enc_bme_gas,
        "am_temp": enc_am_temp,
        "am_hum": enc_am_hum,
        "encoder": enc_encoder,
        "anemometer": enc_anemo,
        "soil": enc_soil,
    }

    return fields, raw, encoded

# =========================
# MAIN LOOP
# =========================
while True:
    fields, raw, encoded = build_fields()

    print("\n===== SENT ROUND =====")
    print("Raw values:")
    print(raw)
    print("Encoded values:")
    print(encoded)
    print("5-digit fields:")

    for field in fields:
        uart.write(field)          # send EXACTLY one 5-digit code
        print(field)
        time.sleep_ms(20)          # small gap for debugging/readability

    time.sleep(2)
