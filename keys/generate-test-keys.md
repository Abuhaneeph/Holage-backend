# Generate Test RSA Keys (for development only)

## Using Git Bash or WSL:

```bash
# Navigate to keys folder
cd holage-backend/keys

# Generate merchant private key
openssl genrsa -out merchant_private_key.pem 1024

# Generate merchant public key (send this to OPay)
openssl rsa -in merchant_private_key.pem -pubout -out merchant_public_key.pem

# For testing, use merchant_public_key.pem as opay_public_key.pem
# In production, replace this with the actual key from OPay
cp merchant_public_key.pem opay_public_key.pem
```

## Using online tool (if no OpenSSL):

Visit: https://travistidwell.com/jsencrypt/demo/
- Click "Generate New Keys"
- Copy "Private Key" → save as `merchant_private_key.pem`
- Copy "Public Key" → save as `merchant_public_key.pem`
- For testing: copy public key again → save as `opay_public_key.pem`

## Files needed:
- `merchant_private_key.pem` - Your private key (keep secret)
- `merchant_public_key.pem` - Your public key (send to OPay)
- `opay_public_key.pem` - OPay's public key (get from OPay)

**For testing only**, you can use the same public key for both. In production, use the real OPay public key.

