import type { EIP1193Provider } from "eip1193-provider";
import type { AccessControlCondition, EncryptionRules } from "../src/types";

import LitJsSdk from "lit-js-sdk";
import { toUtf8Bytes } from "@ethersproject/strings";
import { hexlify } from "@ethersproject/bytes";
import {
  blobToBase64,
  decodeb64,
  buf2hex,
  getAddressFromDid,
  sleep,
} from "./index.js";
import { Buffer } from "buffer";

/** Initialize lit */
let lit: {
  connect: () => any;
  getEncryptionKey: (arg0: {
    accessControlConditions: any;
    toDecrypt: string;
    chain: string;
    authSig: string | LitAuthSig;
  }) => any;
  saveEncryptionKey: (arg0: {
    accessControlConditions: AccessControlCondition[];
    symmetricKey: any;
    authSig: string | LitAuthSig;
    chain: string;
  }) => Buffer | PromiseLike<Buffer>;
};
let litReady = false;
export async function connectLit() {
  lit = new LitJsSdk.LitNodeClient({ alertWhenUnauthorized: false });
  await lit.connect();
  console.log("Lit is ready now!");
  litReady = true;
}

/** temporary function to wait for Lit to be ready before decrypting conten */
async function litIsReady() {
  console.log("Checking if Lit is ready...: " + litReady);

  if (litReady == false) {
    await sleep(1500);
  } else {
  }
  console.log("Lit is ready!: " + litReady);

  return;
}

type SignedMessage = {
  result: string;
};
/** Requires user to sign a message which will generate the lit-signature */
export async function generateLitSignature(
  provider: EIP1193Provider,
  account: string
) {
  let signedMessage: SignedMessage;

  /** Initiate the signature data */
  const now = new Date().toISOString();
  const AUTH_SIGNATURE_BODY =
    "I am creating an account to use the private features of Orbis at {{timestamp}}";
  const body = AUTH_SIGNATURE_BODY.replace("{{timestamp}}", now);
  const bodyBytes = toUtf8Bytes(body);

  /** Proceed to signing the message */
  try {
    signedMessage = (await provider.request({
      method: "personal_sign",
      params: [hexlify(bodyBytes), account],
    })) as SignedMessage;

    /** Save signature for authentication */
    let sig = JSON.stringify({
      sig: signedMessage.result,
      derivedVia: "web3.eth.personal.sign",
      signedMessage: body,
      address: account,
    });
    localStorage.setItem("lit-auth-signature-" + account, sig);
    localStorage.setItem("lit-auth-signature", sig);

    return {
      status: 200,
      result: "Created lit signature with success.",
    };
  } catch (e) {
    console.log("Error generating signature for Lit: ", e);
    return {
      status: 300,
      result: "Error generating signature for Lit.",
      error: e,
    };
  }
}

type LitAuthSig = {
  address: string;
  derivedVia: string;
  sig: string;
  signedMessage: string;
};
/** Retrieve user's authsig from localStorage */
function getAuthSig() {
  const sig = localStorage.getItem("lit-auth-signature");
  const authSig: LitAuthSig | string = sig ? JSON.parse(sig) : "";

  if (authSig && authSig != "") {
    return authSig;
  } else {
    console.log("User not authenticated to Lit Protocol for messages");
    throw new Error("User not authenticated to Lit Protocol for messages");
  }
}

type EncryptedContent = {
  encryptedString: string;
  accessControlConditions: string;
  encryptedSymmetricKey: string;
};
/** Decrypt a string using Lit based on a set of inputs. */
export async function decryptString(encryptedContent: EncryptedContent) {
  /** Make sure Lit is ready before trying to decrypt the string */
  await litIsReady();

  /** Retrieve AuthSig */
  let authSig = getAuthSig();

  /** Decode string encoded as b64 to be supported by Ceramic */
  let decodedString: BlobPart;
  try {
    decodedString = decodeb64(encryptedContent.encryptedString);
  } catch (e) {
    console.log("Error decoding b64 string: ", e);
    throw e;
  }

  let _access: any;
  try {
    _access = JSON.parse(encryptedContent.accessControlConditions);
  } catch (e) {
    console.log("Couldn't parse accessControlConditions: ", e);
    throw e;
  }

  /** Get encryption key from Lit */
  let decryptedSymmKey: any;
  try {
    decryptedSymmKey = await lit.getEncryptionKey({
      accessControlConditions: _access,
      toDecrypt: encryptedContent.encryptedSymmetricKey,
      chain: "ethereum",
      authSig,
    });
  } catch (e) {
    console.log("Error getting encryptionKey: ", e);
    throw e;
  }

  /** Decrypt the string using the encryption key */
  try {
    const decryptedString = await LitJsSdk.decryptString(
      new Blob([decodedString]),
      decryptedSymmKey
    );
    return {
      status: 200,
      result: decryptedString,
    };
  } catch (e) {
    console.log("Error decrypting string: ", e);
    throw e;
  }
}

/** Encryp a DM */
export async function encryptDM(recipients: string[], body: string) {
  /** Step 1: Retrieve access control conditions from recipients */
  let accessControlConditions =
    generateAccessControlConditionsForDMs(recipients);

  /** Step 2: Encrypt string and return result */
  try {
    let result = await encryptString(accessControlConditions, body);
    return result;
  } catch (e) {
    console.log("Error encrypting DM: ", e);
    throw e;
  }
}

/** Encrypt post based on the encryptionRules added by the user */
export async function encryptPost(
  encryptionRules: EncryptionRules,
  body: string
) {
  /** Step 1: Retrieve access control conditions from recipients */
  let accessControlConditions =
    generateAccessControlConditionsForPosts(encryptionRules);

  /** Step 2: Encrypt string and return result */
  try {
    let result = await encryptString(accessControlConditions, body);
    return result;
  } catch (e) {
    console.log("Error encrypting post: ", e);
    throw e;
  }
}

/** Encrypt string based on some access control conditions */
export async function encryptString(
  accessControlConditions: AccessControlCondition[],
  body: string
) {
  /** Step 1: Retrieve AuthSig */
  let authSig = getAuthSig();

  /** Step 2: Encrypt message */
  const { encryptedString, symmetricKey } = await LitJsSdk.encryptString(body);

  /** We convert the encrypted string to base64 to make it work with Ceramic */
  let base64EncryptedString = await blobToBase64(encryptedString);

  /** Step 4: Save encrypted content to lit nodes */
  let encryptedSymmetricKey: Buffer;
  try {
    encryptedSymmetricKey = await lit.saveEncryptionKey({
      accessControlConditions: accessControlConditions,
      symmetricKey: symmetricKey,
      authSig: authSig,
      chain: "ethereum",
    });
  } catch (e) {
    console.log("Error encrypting string with Lit: ", e);
    throw new Error("Error encrypting string with Lit: " + e);
  }

  /** Step 5: Return encrypted content which will be stored on Ceramic (and needed to decrypt the content) */
  return {
    accessControlConditions: JSON.stringify(accessControlConditions),
    encryptedSymmetricKey: buf2hex(encryptedSymmetricKey),
    encryptedString: base64EncryptedString,
  };
}

/** This function will take an array of recipients and turn it into a clean access control conditions array */
export function generateAccessControlConditionsForDMs(recipients: string[]) {
  let _accessControlConditions: AccessControlCondition[] = [];

  /** Loop through each recipient */
  recipients.forEach((recipient: string, i: number) => {
    /** Get ETH address from DiD */
    let { address, network } = getAddressFromDid(recipient);

    if (address && network == "eip155") {
      /** Push access control condition to array */
      _accessControlConditions.push({
        contractAddress: "",
        standardContractType: "",
        chain: "ethereum",
        method: "",
        parameters: [":userAddress"],
        returnValueTest: {
          comparator: "=",
          value: address,
        },
      });

      /** Push `or` operator if recipient isn't the last one of the list */
      if (i < recipients.length - 1) {
        _accessControlConditions.push({ operator: "or" });
      }
    } else {
      /** For now ignore non-ethereum chains as they are not supported on Orbis */
    }
  });

  /** Return clean access control conditions */
  return _accessControlConditions;
}

/** This function will take the encryptionRules object and turn it into a clean access control conditions array */
export function generateAccessControlConditionsForPosts(
  encryptionRules: EncryptionRules
) {
  let _accessControlConditions: AccessControlCondition[] = [];

  switch (encryptionRules.type) {
    case "token-gated":
      let { chain, contractType, contractAddress, minTokenBalance } =
        encryptionRules;

      if (contractType == "ERC20" || contractType == "ERC721") {
        /** Adds an access control condition based on token gated content */
        _accessControlConditions.push({
          contractAddress,
          standardContractType: contractType,
          chain,
          method: "balanceOf",
          parameters: [":userAddress"],
          returnValueTest: {
            comparator: ">=",
            value: minTokenBalance,
          },
        });
      } else if (encryptionRules.contractType == "ERC1155") {
        _accessControlConditions.push({
          contractAddress,
          standardContractType: contractType,
          chain,
          method: "balanceOf",
          parameters: [":userAddress", encryptionRules.tokenId],
          returnValueTest: {
            comparator: ">=",
            value: minTokenBalance,
          },
        });
      }

      break;
  }

  /** Return clean access control conditions */
  return _accessControlConditions;
}
