pragma solidity ^0.8.0;

import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/interfaces/IERC1271.sol";

contract SignerManager is IERC1271 {
    bytes4 constant EIP1271_SUCCESS_RETURN_VALUE = 0x1626ba7e;

    address[] public signers;

    uint256 ECDSA_LENGTH = 65;
    uint256 threshold;

    function setup(address[] memory _signers, uint256 _threshold) internal {
        // only once
        threshold = _threshold;

        for (uint256 i = 0; i < _signers.length; i++) {
            signers[i] = _signers[i];
        }
    }

    // function addSigners()
    // function removeSigners()
    // function changeThreshold()

    function isValidSignature(bytes32 _hash, bytes calldata _signature)
        public
        view
        override
        returns (bytes4)
    {
        if (threshold == 1 && _signature.length == 65) {
            require(
                ECDSA.recover(_hash, _signature) == signers[0],
                "wrong address for signer"
            );
        } else if (threshold > 1 && threshold == signers.length) {
            require(
                isValidNoNSignature(_hash, _signature),
                "Signature Verification Failed"
            );
        } else if (threshold > 1 && threshold != signers.length) {
            require(
                isValidNoMSignatures(_hash, _signature),
                "Signature Verification Failed"
            );
        }

        return EIP1271_SUCCESS_RETURN_VALUE;
    }

    function isValidNoNSignature(bytes32 _hash, bytes calldata _signature)
        internal
        view
        returns (bool)
    {
        uint256 length = threshold * ECDSA_LENGTH;
        require(_signature.length == length, "Signature length is incorrect");

        for (uint256 i = 0; i < threshold; i++) {
            uint256 start = i * ECDSA_LENGTH;
            uint256 end = start + ECDSA_LENGTH;
            require(
                ECDSA.recover(_hash, _signature[start:end]) == signers[i],
                "wrong address for signer"
            );
            // this is inperfect cuz it doesnt consider differece in the order of the arrays btw signers and signatures.
        }

        return true;
    }

    // apx 100k gas... for 3 of 5 verification.
    function isValidNoMSignatures(bytes32 _hash, bytes calldata _signature)
        internal
        view
        returns (bool)
    {
        uint256 length = threshold * ECDSA_LENGTH;
        require(_signature.length == length, "Signature length is incorrect");

        address[] memory verifiedSigners = new address[](threshold);

        for (uint256 i = 0; i < threshold; i++) {
            uint256 endNum = i * ECDSA_LENGTH;
            address resultAddr = ECDSA.recover(_hash, _signature[0:endNum]);

            uint256 j = 0;
            while (j < signers.length) {
                if (
                    resultAddr == signers[j] && verifiedSigners[0] == address(0)
                ) {
                    verifiedSigners[i] = resultAddr;
                    break;
                } else if (resultAddr == signers[j]) {
                    bool isValid = true;
                    for (uint256 k = 0; k < threshold; k++) {
                        isValid = resultAddr == verifiedSigners[k]
                            ? false
                            : true;
                    }

                    if (isValid) {
                        verifiedSigners[i] = resultAddr;
                        break;
                    }
                }

                if (verifiedSigners[threshold - 1] != address(0)) {
                    break;
                }
                j++;
            }
        }

        return true;
    }
}

// https://github.com/safe-global/safe-contracts/blob/main/contracts/GnosisSafe.sol
