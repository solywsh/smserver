package security

import (
	"encoding/json"
	"testing"
)

func TestSM4EncryptDecrypt(t *testing.T) {
	// Test key (32 hex chars = 16 bytes)
	keyHex := "0123456789abcdef0123456789abcdef"

	// Test data - JSON structure similar to SmsForwarder
	testData := map[string]interface{}{
		"data":      map[string]interface{}{},
		"timestamp": 1652590258638,
		"sign":      "",
	}

	plaintext, err := json.Marshal(testData)
	if err != nil {
		t.Fatalf("Failed to marshal test data: %v", err)
	}

	// Test encryption
	cipherHex, err := SM4EncryptHex(keyHex, plaintext)
	if err != nil {
		t.Fatalf("SM4EncryptHex failed: %v", err)
	}

	if len(cipherHex) == 0 {
		t.Fatal("Encrypted result is empty")
	}

	t.Logf("Plaintext length: %d", len(plaintext))
	t.Logf("Ciphertext (hex): %s", cipherHex)

	// Test decryption
	decrypted, err := SM4DecryptHex(keyHex, cipherHex)
	if err != nil {
		t.Fatalf("SM4DecryptHex failed: %v", err)
	}

	// Verify decrypted data matches original
	if string(decrypted) != string(plaintext) {
		t.Fatalf("Decrypted data mismatch.\nExpected: %s\nGot: %s", plaintext, decrypted)
	}

	// Verify it's valid JSON
	var result map[string]interface{}
	if err := json.Unmarshal(decrypted, &result); err != nil {
		t.Fatalf("Decrypted data is not valid JSON: %v", err)
	}

	t.Log("SM4 CBC mode encryption/decryption test passed!")
}

func TestSM4InvalidKey(t *testing.T) {
	// Test with invalid key length
	invalidKey := "0123456789abcdef" // Only 8 bytes
	plaintext := []byte("test data")

	_, err := SM4EncryptHex(invalidKey, plaintext)
	if err == nil {
		t.Fatal("Expected error for invalid key length, got nil")
	}

	if err.Error() != "sm4 key must be 16 bytes" {
		t.Fatalf("Unexpected error message: %v", err)
	}

	t.Log("Invalid key test passed!")
}

func TestSM4InvalidCiphertext(t *testing.T) {
	keyHex := "0123456789abcdef0123456789abcdef"

	// Test with invalid hex string
	_, err := SM4DecryptHex(keyHex, "invalid_hex")
	if err == nil {
		t.Fatal("Expected error for invalid hex string, got nil")
	}

	// Test with ciphertext not multiple of block size (16 bytes)
	_, err = SM4DecryptHex(keyHex, "0123456789abcdef012345") // 11 bytes
	if err == nil {
		t.Fatal("Expected error for invalid ciphertext length, got nil")
	}

	t.Log("Invalid ciphertext test passed!")
}
