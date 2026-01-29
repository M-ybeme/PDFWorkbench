const PNG_SIGNATURE = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
const matchesSignature = (bytes) => {
    if (bytes.length < PNG_SIGNATURE.length) {
        return false;
    }
    for (let index = 0; index < PNG_SIGNATURE.length; index += 1) {
        if (bytes[index] !== PNG_SIGNATURE[index]) {
            return false;
        }
    }
    return true;
};
export const hasPngSignature = (bytes) => matchesSignature(bytes);
/**
 * Checks whether the provided PNG bytes contain a complete IEND chunk.
 * This catches truncated uploads that can cause pdf-lib's PNG parser to hang.
 */
export const isPngBytesComplete = (bytes) => {
    if (!matchesSignature(bytes)) {
        return false;
    }
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const totalLength = bytes.length;
    let offset = PNG_SIGNATURE.length;
    while (offset + 8 <= totalLength) {
        const chunkLength = view.getUint32(offset, false);
        const typeCode = view.getUint32(offset + 4, false);
        const dataEnd = offset + 8 + chunkLength;
        const crcEnd = dataEnd + 4;
        if (crcEnd > totalLength) {
            return false;
        }
        if (typeCode === 0x49454e44) {
            return true;
        }
        offset = crcEnd;
    }
    return false;
};
