#!/usr/bin/env python3
"""Utilidades de claves Nostr para el relay Buzz de Cratias Asesores.

Sin dependencias externas: implementa secp256k1 y bech32 en Python puro para
poder ejecutarse en cualquier servidor recién instalado.

Uso:
    nostrkey.py gen            Genera un par de claves nuevo -> "<priv_hex> <pub_hex>"
    nostrkey.py priv           Genera solo una clave privada de 32 bytes -> "<priv_hex>"
    nostrkey.py topub <hex>    Deriva la pubkey x-only de una clave privada
    nostrkey.py tohex <npub>   Convierte un npub1... (o hex) a hex de 64 caracteres
"""

import os
import sys

# --- secp256k1 -------------------------------------------------------------
P = 2**256 - 2**32 - 977
N = 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141
G = (
    0x79BE667EF9DCBBAC55A06295CE870B07029BFCDB2DCE28D959F2815B16F81798,
    0x483ADA7726A3C4655DA4FBFC0E1108A8FD17B448A68554199C47D08FFB10D4B8,
)


def _add(p, q):
    if p is None:
        return q
    if q is None:
        return p
    if p[0] == q[0] and (p[1] + q[1]) % P == 0:
        return None
    if p == q:
        lam = (3 * p[0] * p[0]) * pow(2 * p[1], P - 2, P) % P
    else:
        lam = (q[1] - p[1]) * pow(q[0] - p[0], P - 2, P) % P
    x = (lam * lam - p[0] - q[0]) % P
    return (x, (lam * (p[0] - x) - p[1]) % P)


def _mul(k, p):
    r = None
    while k:
        if k & 1:
            r = _add(r, p)
        p = _add(p, p)
        k >>= 1
    return r


def gen_priv():
    """Escalar aleatorio válido (1 <= k < N)."""
    while True:
        k = int.from_bytes(os.urandom(32), "big")
        if 1 <= k < N:
            return k


def to_pub(priv_hex):
    """Pubkey x-only (BIP340), que es el formato de pubkey de Nostr."""
    priv_hex = priv_hex.strip().lower()
    # Exigir los 64 caracteres exactos: un hex truncado al copiar y pegar sigue
    # siendo un escalar válido y devolvería una pubkey distinta sin avisar.
    if len(priv_hex) != 64 or not all(c in "0123456789abcdef" for c in priv_hex):
        raise ValueError("se esperaba una clave privada en hex de 64 caracteres")
    k = int(priv_hex, 16)
    if not 1 <= k < N:
        raise ValueError("clave privada fuera del rango de la curva")
    return f"{_mul(k, G)[0]:064x}"


# --- bech32 (BIP173), para descodificar npub1... ---------------------------
CHARSET = "qpzry9x8gf2tvdw0s3jn54khce6mua7l"


def _polymod(values):
    gen = [0x3B6A57B2, 0x26508E6D, 0x1EA119FA, 0x3D4233DD, 0x2A1462B3]
    chk = 1
    for v in values:
        top = chk >> 25
        chk = (chk & 0x1FFFFFF) << 5 ^ v
        for i in range(5):
            chk ^= gen[i] if ((top >> i) & 1) else 0
    return chk


def _hrp_expand(hrp):
    return [ord(c) >> 5 for c in hrp] + [0] + [ord(c) & 31 for c in hrp]


def _convertbits(data, frombits, tobits, pad=True):
    acc = bits = 0
    ret = []
    maxv = (1 << tobits) - 1
    for value in data:
        if value < 0 or (value >> frombits):
            return None
        acc = (acc << frombits) | value
        bits += frombits
        while bits >= tobits:
            bits -= tobits
            ret.append((acc >> bits) & maxv)
    if pad:
        if bits:
            ret.append((acc << (tobits - bits)) & maxv)
    elif bits >= frombits or ((acc << (tobits - bits)) & maxv):
        return None
    return ret


def npub_to_hex(value):
    """Acepta un npub1... o un hex de 64 caracteres y devuelve siempre hex."""
    value = value.strip()
    low = value.lower()
    if len(low) == 64 and all(c in "0123456789abcdef" for c in low):
        return low
    if not low.startswith("npub1"):
        raise ValueError("se esperaba un npub1... o un hex de 64 caracteres")
    hrp, _, data_part = low.rpartition("1")
    try:
        data = [CHARSET.index(c) for c in data_part]
    except ValueError:
        raise ValueError("el npub contiene caracteres no válidos")
    if _polymod(_hrp_expand(hrp) + data) != 1:
        raise ValueError("checksum del npub incorrecto: revisa que esté completo")
    decoded = _convertbits(data[:-6], 5, 8, False)
    if decoded is None or len(decoded) != 32:
        raise ValueError("el npub no contiene una clave de 32 bytes")
    return bytes(decoded).hex()


def main():
    cmd = sys.argv[1] if len(sys.argv) > 1 else "gen"
    try:
        if cmd == "gen":
            priv = f"{gen_priv():064x}"
            print(priv, to_pub(priv))
        elif cmd == "priv":
            print(f"{gen_priv():064x}")
        elif cmd == "topub":
            print(to_pub(sys.argv[2]))
        elif cmd == "tohex":
            print(npub_to_hex(sys.argv[2]))
        else:
            print(__doc__, file=sys.stderr)
            return 2
    except IndexError:
        print(f"ERROR: a «{cmd}» le falta el argumento", file=sys.stderr)
        return 2
    except ValueError as exc:
        # Mensaje legible en lugar de un traceback: esto lo lee quien despliega.
        print(f"ERROR: {exc}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
