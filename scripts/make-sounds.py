#!/usr/bin/env python3
"""Generate the small UI sounds bundled with the extension.

They are deliberately quiet and short: a tick for buttons, a rising bloop for
water, a two-note glide for toggles, a soft thup for menus and a three-note
chime for a finished block. Run this only when changing the sound design:

    python3 scripts/make-sounds.py
"""
import math
import os
import random
import struct
import wave

SR = 44100
OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'sounds')


def envelope(t, attack, decay):
    return (1.0 - math.exp(-t * attack)) * math.exp(-t * decay)


def normalize(samples, peak):
    current = max(abs(sample) for sample in samples) or 1.0
    scale = peak / current
    return [sample * scale for sample in samples]


def fade(samples, seconds=0.002):
    count = min(len(samples) // 2, int(SR * seconds))
    for index in range(count):
        gain = index / count
        samples[index] *= gain
        samples[-1 - index] *= gain
    return samples


def write(name, samples):
    path = os.path.join(OUT, name)
    with wave.open(path, 'wb') as handle:
        handle.setnchannels(1)
        handle.setsampwidth(2)
        handle.setframerate(SR)
        handle.writeframes(b''.join(
            struct.pack('<h', int(max(-1.0, min(1.0, sample)) * 32767))
            for sample in samples))
    print(f'{name}: {len(samples) / SR * 1000:.0f} ms, {os.path.getsize(path)} bytes')


def click():
    random.seed(11)
    duration = 0.032
    samples = []
    for index in range(int(SR * duration)):
        t = index / SR
        tone = (0.55 * math.sin(2 * math.pi * 2100 * t)
                + 0.25 * math.sin(2 * math.pi * 3300 * t))
        noise = random.uniform(-1, 1) * math.exp(-t * 180) * 0.45
        samples.append((tone * math.exp(-t * 110) + noise) * 0.55)
    return fade(normalize(samples, 0.22))


def water():
    random.seed(23)
    duration = 0.22
    samples = []
    phase = 0.0
    for index in range(int(SR * duration)):
        t = index / SR
        progress = t / duration
        frequency = 280 + 720 * progress ** 0.8
        phase += 2 * math.pi * frequency / SR
        tone = math.sin(phase) * envelope(t, 500, 14)
        body = math.sin(2 * math.pi * 175 * t) * math.exp(-t * 30) * 0.22
        splash = random.uniform(-1, 1) * math.exp(-t * 230) * 0.3
        samples.append((tone * 0.8 + body + splash) * 0.65)
    return fade(normalize(samples, 0.30))


def glide(start, end, duration=0.16):
    samples = []
    phase = 0.0
    for index in range(int(SR * duration)):
        t = index / SR
        frequency = start + (end - start) * min(1.0, t / 0.07)
        phase += 2 * math.pi * frequency / SR
        tone = (math.sin(phase) + 0.2 * math.sin(2 * phase)) * envelope(t, 300, 18)
        samples.append(tone)
    return fade(normalize(samples, 0.20))


def complete():
    duration = 0.9
    notes = [(523.25, 0.0), (659.25, 0.10), (783.99, 0.20), (1046.50, 0.30)]
    samples = []
    for index in range(int(SR * duration)):
        t = index / SR
        total = 0.0
        for frequency, offset in notes:
            local = t - offset
            if local < 0:
                continue
            gain = envelope(local, 120, 5.0)
            total += (math.sin(2 * math.pi * frequency * local)
                      + 0.25 * math.sin(4 * math.pi * frequency * local)
                      + 0.08 * math.sin(6 * math.pi * frequency * local)) * gain
        pad = math.sin(2 * math.pi * 261.63 * t) * envelope(t, 80, 3.2) * 0.18
        samples.append(total * 0.22 + pad)
    return fade(normalize(samples, 0.28), 0.01)


def popup():
    duration = 0.09
    samples = []
    phase = 0.0
    for index in range(int(SR * duration)):
        t = index / SR
        frequency = 480 - 240 * min(1.0, t / 0.06)
        phase += 2 * math.pi * frequency / SR
        samples.append(math.sin(phase) * envelope(t, 500, 35))
    return fade(normalize(samples, 0.18))


if __name__ == '__main__':
    os.makedirs(OUT, exist_ok=True)
    write('click.wav', click())
    write('water.wav', water())
    write('toggle-on.wav', glide(620, 930))
    write('toggle-off.wav', glide(930, 620))
    write('complete.wav', complete())
    write('popup.wav', popup())
