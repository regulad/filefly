"""Utility module for encrypting/decrypting database secrets"""

import base64
import os
from typing import Dict

from cryptography.hazmat.backends import default_backend
from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes

ALGORITHM = "aes-256-cbc"


def get_key() -> bytes:
    base64_key = os.environ.get("SECRET_ENCRYPTION_KEY")
    if not base64_key:
        raise ValueError("SECRET_ENCRYPTION_KEY environment variable is not set")
    key = base64.b64decode(base64_key)
    if len(key) != 32:
        raise ValueError("Invalid key length. Expected 32 bytes.")
    return key


def encrypt(text: str) -> Dict[str, str]:
    key = get_key()
    iv: bytes = os.urandom(16)
    cipher = Cipher(algorithms.AES(key), modes.CBC(iv), backend=default_backend())
    encryptor = cipher.encryptor()
    padded_text = _pad(text.encode())
    encrypted_data: bytes = encryptor.update(padded_text) + encryptor.finalize()
    return {
        "iv": base64.b64encode(iv).decode("utf-8"),
        "encryptedData": base64.b64encode(encrypted_data).decode("utf-8"),
    }


def decrypt(iv: str, encrypted_data: str) -> str:
    key = get_key()
    iv_bytes: bytes = base64.b64decode(iv)
    encrypted_data_bytes: bytes = base64.b64decode(encrypted_data)
    cipher = Cipher(algorithms.AES(key), modes.CBC(iv_bytes), backend=default_backend())
    decryptor = cipher.decryptor()
    decrypted_padded: bytes = decryptor.update(encrypted_data_bytes) + decryptor.finalize()
    return _unpad(decrypted_padded).decode("utf-8")


def _pad(data: bytes) -> bytes:
    padding_length = 16 - (len(data) % 16)
    return data + bytes([padding_length] * padding_length)


def _unpad(padded_data: bytes) -> bytes:
    padding_length = padded_data[-1]
    return padded_data[:-padding_length]


__all__ = ["encrypt", "decrypt"]
