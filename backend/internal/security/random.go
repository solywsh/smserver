package security

import (
	"crypto/rand"
	"encoding/hex"
)

// RandomKey returns n random bytes hex encoded.
func RandomKey(n int) (string, error) {
	b := make([]byte, n)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return hex.EncodeToString(b), nil
}
