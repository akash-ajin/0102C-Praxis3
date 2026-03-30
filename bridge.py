from machine import Pin, UART
import time

uart = UART(1, baudrate=115200, tx=Pin(4), rx=Pin(5))
tx = Pin(17, Pin.OUT)

BIT_HIGH_LONG = 2000
BIT_HIGH_SHORT = 800
GAP = 800

FIELD_LEN = 5
buffer = ""

def send_bit(bit):
    if bit == 1:
        tx.on()
        time.sleep_us(BIT_HIGH_LONG)
        tx.off()
        time.sleep_us(GAP)
    else:
        tx.on()
        time.sleep_us(BIT_HIGH_SHORT)
        tx.off()
        time.sleep_us(GAP)

def send_16bit_number(num):
    num = num & 0xFFFF

    # start signal
    tx.on()
    time.sleep_ms(5)
    tx.off()
    time.sleep_ms(2)

    # send 16 bits, MSB first
    for i in range(15, -1, -1):
        bit = (num >> i) & 1
        send_bit(bit)

    # slower gap after full transmission
    time.sleep_ms(50)

print("UART -> RF bridge ready")

while True:
    if uart.any():
        raw = uart.read()
        if raw:
            try:
                incoming = raw.decode().replace("\n", "").replace("\r", "")
                buffer += incoming

                while len(buffer) >= FIELD_LEN:
                    code = buffer[:FIELD_LEN]
                    buffer = buffer[FIELD_LEN:]

                    if code.isdigit():
                        number = int(code)

                        # first field of a round: bme_temp -> starts with 1 and ends with 0
                        if code[0] == "1" and code[4] == "5":
                            print("Warm-up RF before temp")
                            send_16bit_number(33333)   # dummy number
                            time.sleep_ms(50)

                        print("UART received:", code)
                        print("RF sending   :", number)
                        send_16bit_number(number)

                    else:
                        print("Dropped invalid block:", code)

            except Exception as e:
                print("UART error:", e)
                buffer = ""

    time.sleep_ms(2)