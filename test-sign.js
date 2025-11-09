import fs from "fs"
import { KEYUTIL, KJUR, hextob64 } from "jsrsasign"

console.log("=== Testing PKCS#8 Key Signing ===\n")

const pkcs8Key = fs.readFileSync("./keys/merchant_private_key_pkcs8.pem", "utf8")

console.log("1. PKCS#8 Key loaded:")
console.log("   Length:", pkcs8Key.length)
console.log("   First line:", pkcs8Key.split("\n")[0])
console.log()

console.log("2. Testing KEYUTIL.getKey():")
try {
  const rsa = KEYUTIL.getKey(pkcs8Key)
  console.log("   ✓ Success!")
  console.log("   Key type:", rsa.type)
  console.log("   Is private:", rsa.isPrivate)
  console.log()
  
  console.log("3. Testing signature:")
  const sig = new KJUR.crypto.Signature({ alg: "SHA256withRSA" })
  sig.init(rsa)
  sig.updateString("test string 12345")
  const signature = hextob64(sig.sign())
  console.log("   ✓ Signature created!")
  console.log("   Signature length:", signature.length)
  console.log("   Signature:", signature)
} catch (error) {
  console.error("   ✗ FAILED:", error.message)
  console.error("   Stack:", error.stack)
}

