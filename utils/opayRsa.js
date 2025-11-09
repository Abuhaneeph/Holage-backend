import NodeRSA from "node-rsa"
import { KEYUTIL, KJUR, hextob64, b64tohex } from "jsrsasign"

/**
 * OPay RSA encryption/decryption and signing helper
 */
export class OpayRSA {
  constructor({ opayPublicKey, merchantPrivateKey }) {
    this.opayPublicKey = opayPublicKey || ""
    this.merchantPrivateKey = merchantPrivateKey || ""
    
    // Debug: Check what was passed to constructor
    console.log("OpayRSA constructor called:")
    console.log("  - opayPublicKey length:", this.opayPublicKey.length)
    console.log("  - merchantPrivateKey length:", this.merchantPrivateKey.length)
  }

  /**
   * Encrypt data with OPay public key and sign with merchant private key
   */
  encrypt(data, timestamp) {
    if (!data || !timestamp) return null

    try {
      // Handle both literal \n and actual newlines
      let formattedKey = this.opayPublicKey.trim()
      
      // If key has literal \n strings, replace them
      if (formattedKey.includes("\\n")) {
        formattedKey = formattedKey.replace(/\\n/g, "\n")
      }
      
      console.log("Key length:", formattedKey.length)
      console.log("Key has newlines:", formattedKey.includes("\n"))
      console.log("First 50 chars:", formattedKey.substring(0, 50))
      console.log("Last 50 chars:", formattedKey.substring(formattedKey.length - 50))
      
      const rsa = new NodeRSA()
      rsa.importKey(formattedKey, "pkcs8-public-pem")
      rsa.setOptions({ encryptionScheme: "pkcs1" })
      
      const jsonString = JSON.stringify(this._traverseData(data))
      const encrypted = rsa.encrypt(jsonString, "base64")
      
      console.log("About to sign. Merchant key length:", this.merchantPrivateKey.length)
      const signInput = encrypted + timestamp
      console.log("Sign input length:", signInput.length)
      
      return {
        paramContent: encrypted,
        sign: this._setSign(signInput)
      }
    } catch (error) {
      console.error("Encryption error:", error.message)
      console.error("Error type:", error.constructor.name)
      throw new Error(`RSA encryption failed: ${error.message}`)
    }
  }

  /**
   * Decrypt response data with merchant private key
   */
  decrypt(responseData) {
    try {
      // Handle newlines properly
      let formattedKey = this.merchantPrivateKey
      if (formattedKey.includes("\\n")) {
        formattedKey = formattedKey.replace(/\\n/g, "\n")
      }
      
      const rsa = new NodeRSA(formattedKey)
      rsa.setOptions({ encryptionScheme: "pkcs1" })
      
      const decrypted = rsa.decrypt(responseData.data, "utf8")
      const parsedData = JSON.parse(decrypted)
      
      const { sign } = responseData
      const dataCopy = { ...responseData }
      delete dataCopy.sign
      
      return {
        verify: this._verifySign(sign, this._traverseData(dataCopy)),
        data: parsedData
      }
    } catch (error) {
      console.error("Decryption error:", error.message)
      throw new Error(`RSA decryption failed: ${error.message}`)
    }
  }

  /**
   * Sign a string with merchant private key
   */
  _setSign(inputString = "{}") {
    if (!this.merchantPrivateKey || this.merchantPrivateKey.trim().length === 0) {
      throw new Error("Merchant secret key does not exist.")
    }

    try {
      // Handle literal \n in key
      let formattedKey = this.merchantPrivateKey.trim()
      if (formattedKey.includes("\\n")) {
        formattedKey = formattedKey.replace(/\\n/g, "\n")
      }

      // Try to parse the key
      let rsa
      try {
        rsa = KEYUTIL.getKey(formattedKey)
      } catch (keyError) {
        console.error("KEYUTIL.getKey failed:", keyError.message)
        console.error("Key starts with:", formattedKey.substring(0, 50))
        throw new Error("Merchant secret key does not exist.")
      }

      if (!rsa) {
        throw new Error("Merchant secret key does not exist.")
      }

      const sig = new KJUR.crypto.Signature({ alg: "SHA256withRSA" })
      sig.init(rsa)
      sig.updateString(inputString)
      return hextob64(sig.sign())
    } catch (error) {
      if (error.message && error.message.includes("does not exist")) {
        throw error
      }
      console.error("Sign error:", error)
      throw new Error(`Failed to sign data: ${error.message}`)
    }
  }

  /**
   * Verify signature with OPay public key
   */
  _verifySign(sign, data) {
    const signatureVf = new KJUR.crypto.Signature({
      alg: "SHA256withRSA",
      prvkeypem: this.opayPublicKey
    })
    
    let mapSplicing = ""
    for (let k in data) {
      if (mapSplicing) mapSplicing += "&"
      mapSplicing += `${k}=${data[k]}`
    }
    
    signatureVf.updateString(mapSplicing)
    return signatureVf.verify(b64tohex(sign))
  }

  /**
   * Get data type
   */
  _getDataType(data) {
    return Object.prototype.toString.call(data)
  }

  /**
   * Traverse and sort data for consistent signing
   */
  _traverseData(data) {
    let r = null
    switch (this._getDataType(data)) {
      case "[object Object]":
        r = {}
        const keyArr = Object.keys(data).sort()
        keyArr.forEach(key => {
          const val = data[key]
          r[key] = this._traverseData(val)
        })
        break
      case "[object Array]":
        r = []
        data.sort().forEach(item => {
          r.push(this._traverseData(item))
        })
        break
      default:
        r = data
    }
    return r
  }
}

