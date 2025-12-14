package security

import (
	"bytes"
	"crypto/cipher"
	"encoding/hex"
	"errors"

	"github.com/tjfoc/gmsm/sm4"
)

// Fixed IV for SmsForwarder compatibility
// Reference: https://gist.github.com/li-xunhuan/4ddded3eb8051d8bdf762c882dbe0ad3
var sm4IV = []byte{3, 5, 6, 9, 6, 9, 5, 9, 3, 5, 6, 9, 6, 9, 5, 9}

// SM4EncryptHex encrypts data with the provided hex key using CBC mode and returns hex ciphertext.
// Compatible with SmsForwarder SM4 encryption.
func SM4EncryptHex(keyHex string, plain []byte) (string, error) {
	key, err := hex.DecodeString(keyHex)
	if err != nil {
		return "", err
	}
	if len(key) != 16 {
		return "", errors.New("sm4 key must be 16 bytes")
	}
	block, err := sm4.NewCipher(key)
	if err != nil {
		return "", err
	}

	// PKCS7 padding
	src := pkcs7Pad(plain, block.BlockSize())
	dst := make([]byte, len(src))

	// CBC mode encryption
	mode := cipher.NewCBCEncrypter(block, sm4IV)
	mode.CryptBlocks(dst, src)

	return hex.EncodeToString(dst), nil
}

// SM4DecryptHex decrypts hex ciphertext using hex key with CBC mode.
// Compatible with SmsForwarder SM4 decryption.
func SM4DecryptHex(keyHex, cipherHex string) ([]byte, error) {
	key, err := hex.DecodeString(keyHex)
	if err != nil {
		return nil, err
	}
	cipherBytes, err := hex.DecodeString(cipherHex)
	if err != nil {
		return nil, err
	}
	if len(cipherBytes)%16 != 0 {
		return nil, errors.New("ciphertext is not a multiple of block size")
	}

	block, err := sm4.NewCipher(key)
	if err != nil {
		return nil, err
	}

	dst := make([]byte, len(cipherBytes))

	// CBC mode decryption
	mode := cipher.NewCBCDecrypter(block, sm4IV)
	mode.CryptBlocks(dst, cipherBytes)

	// Remove PKCS7 padding
	plain, err := pkcs7Unpad(dst, block.BlockSize())
	if err != nil {
		return nil, err
	}
	return plain, nil
}

func pkcs7Pad(b []byte, size int) []byte {
	pad := size - len(b)%size
	return append(b, bytes.Repeat([]byte{byte(pad)}, pad)...)
}

func pkcs7Unpad(b []byte, size int) ([]byte, error) {
	if len(b) == 0 || len(b)%size != 0 {
		return nil, errors.New("invalid padding size")
	}
	pad := int(b[len(b)-1])
	if pad == 0 || pad > size || pad > len(b) {
		return nil, errors.New("invalid padding")
	}
	return b[:len(b)-pad], nil
}
