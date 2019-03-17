import { DataStream } from "./DataStream"

import * as Viewer from '../viewer';

import ArrayBufferSlice from "../ArrayBufferSlice";
import { TextureHolder, LoadedTexture } from "../TextureHolder";
import { GfxDevice, GfxTextureDimension, GfxFormat, GfxTexture, GfxTextureDescriptor } from "../gfx/platform/GfxPlatform";
import { DecodedSurfaceSW, decompressBC, surfaceToCanvas } from "../fres/bc_texture";
import { TextureBase } from '../TextureHolder';
import { nArray, assert } from "../util";


enum TEXTGATypes {
    NO_IMG_DATA,
    COLOR_MAPPED,
    RGB,
    BLK_WHT,
    RLE_COLOR_MAPPED = 9,
    RLE_RGB,
    RLE_BLK_WHT,
    COMPRESSED_COLOR_MAPPED_DATA_USING_HUFFMAN_DELTA_AND_RLE = 32,
    COMPRESSED_COLOR_MAPPED_DATA_USING_HUFFMAN_DELTA_AND_RLE_4_PASS_QUADTREE_TYPE_PROCESS,
}

enum TEXVBMColors {
    ARGB1555,
    ARGB4444,
    RGB565,
}

enum TEXTGACMapTypes {
    NONE,
    INCLUDED,
}

enum TEXRLETypes {
    RLE_RAW,
    RLE_RLE,
}

export const enum TEXTextureFormat {
    PALETTE,
    DXT1,
    DXT2,
    DXT3,
    DXT4,
    DXT5,
}

interface TEXTextureLevel {
    width: number;
    height: number;
    data: ArrayBufferSlice;
}

export interface TEXTextureBitmap {
    width: number;
    height: number;
    data: ArrayBufferSlice;
    actuallyUsesAlpha: boolean;
    depth: number;
    animFps: number;
}

export interface TEXTexture extends TextureBase {
    name: string;
    width: number;
    height: number;
    //format: TEXTextureFormat; //todo: remove
    animated: boolean;
    alpha: boolean;
    levels: TEXTextureBitmap[];
    depth: number;
}

export interface TEX {
    textures: TEXTexture[];
}

interface TEXcolorMapSpec {
    firstIndex: number
    length: number
    entrySize: number
}

interface TEXimgSpec {
    xOrigin: number
    yOrigin: number
    width: number
    height: number
    depth: number
    descriptor: number
    alpha: boolean
    flipX: boolean
    flipY: boolean
}

function expand4to8(n: number): number {
    return (n << (8 - 4)) | (n >>> (8 - 8));
}

function expand5to8(n: number): number {
    return (n << (8 - 5)) | (n >>> (10 - 8));
}

function expand6to8(n: number): number {
    return (n << (8 - 6)) | (n >>> (12 - 8));
}

function decompressRLE(inStream: DataStream, outStream: DataStream, size: number, depth: number, alpha: boolean, mapped: boolean, cMap?: Uint8Array[]): boolean {
    let pix_written = 0
    let actuallyUsesAlpha = false
    while (pix_written < size) { //todo: is there a better way of handling this???
        let rleHeader = inStream.readUint8()
        let rleType : TEXRLETypes = (rleHeader & 0b10000000) >> 7
        let rleCount = (rleHeader & 0b01111111) + 1
        if (rleType === TEXRLETypes.RLE_RAW) {
            for (let i = 0; i < rleCount; i++) {
                let pR, pG, pB, pA
                pA = 255
                if (mapped) {
                    //TODO: figure out how to determine data size when there are more than 256 colors
                    let cIdx = inStream.readUint8()
                    pR = cMap[cIdx][0]
                    pG = cMap[cIdx][1]
                    pB = cMap[cIdx][2]
                    pA = cMap[cIdx][3]
                } else {
                    if (depth === 8) {
                        pR = inStream.readUint8()
                        pG = pR
                        pB = pR
                    } else if (depth === 16) {
                        let colorData = inStream.readUint16()
                        pA = ((colorData & 0b10000000_00000000) >> 15) * 255
                        pR = ((colorData & 0b01111100_00000000) >> 10)
                        pG = ((colorData & 0b00000011_11100000) >>  5)
                        pB = ((colorData & 0b00000000_00011111)      )
                        pR = expand5to8(pR)
                        pG = expand5to8(pG)
                        pB = expand5to8(pB)
                        if (!alpha)
                            pA = 255
                    } else {
                        pB = inStream.readUint8()
                        pG = inStream.readUint8()
                        pR = inStream.readUint8()
                        if (depth === 32)
                            pA = inStream.readUint8()
                        if (!alpha)
                            pA = 255 //TODO: really discard alpha if !alpha?
                    }
                }
                outStream.writeUint8(pR)
                outStream.writeUint8(pG)
                outStream.writeUint8(pB)
                outStream.writeUint8(pA)
                if (pA < 255)
                    actuallyUsesAlpha = true
                pix_written++
            }
        } else if (rleType === TEXRLETypes.RLE_RLE) {
            let pR, pG, pB, pA
            pA = 255
            if (mapped) {
                //TODO: figure out how to determine data size when there are more than 256 colors
                let cIdx = inStream.readUint8()
                pR = cMap[cIdx][0]
                pG = cMap[cIdx][1]
                pB = cMap[cIdx][2]
                pA = cMap[cIdx][3]
            } else {
                if (depth === 8) {
                    pR = inStream.readUint8()
                    pG = pR
                    pB = pR
                } else if (depth === 16) {
                    let colorData = inStream.readUint16()
                    pA = ((colorData & 0b10000000_00000000) >> 15) * 255
                    pR = ((colorData & 0b01111100_00000000) >> 10)
                    pG = ((colorData & 0b00000011_11100000) >>  5)
                    pB = ((colorData & 0b00000000_00011111)      )
                    pR = expand5to8(pR)
                    pG = expand5to8(pG)
                    pB = expand5to8(pB)
                    if (!alpha)
                        pA = 255
                } else {
                    pB = inStream.readUint8()
                    pG = inStream.readUint8()
                    pR = inStream.readUint8()
                    if (depth === 32)
                        pA = inStream.readUint8()
                    if (!alpha)
                        pA = 255 //TODO: really discard alpha if !alpha?
                }
            }
            for (let i = 0; i < rleCount; i++) {
                outStream.writeUint8(pR)
                outStream.writeUint8(pG)
                outStream.writeUint8(pB)
                outStream.writeUint8(pA)
                if (pA < 255)
                    actuallyUsesAlpha = true
                pix_written++
            }
        }
    }
    return actuallyUsesAlpha
}

export function parseTGA(buffer: ArrayBufferSlice): TEXTextureBitmap {
    //15bpp should be treated the same as 16bpp according to http://tfc.duke.free.fr/coding/tga_specs.pdf
    //todo: error handling?
    //todo: figure out if rf uses tga's x-origin and y-origin
    // #all default rf tgas have xOrg and yOrg == 0
    // #all default rf tgas have bpp == 32 || bpp == 24
    // #all default rf tgas have desc = 0, 8, 32
    // #print(f'{imgSpec.desc:08b} -> {imgSpec.desc}')
    const stream = new DataStream(buffer)

    const tgaIdLength = stream.readUint8()
    const tgaColorMapType: TEXTGACMapTypes = stream.readUint8()
    const tgaImageType: TEXTGATypes = stream.readUint8()

    const cmapSpec = <TEXcolorMapSpec>{}
    cmapSpec.firstIndex = stream.readUint16() //TODO: figure out how to handle if firstIndex != 0
    cmapSpec.length = stream.readUint16()
    cmapSpec.entrySize = stream.readUint8()
    if (cmapSpec.entrySize === 15)
        cmapSpec.entrySize = 16

    const imgSpec = <TEXimgSpec>{}
    imgSpec.xOrigin = stream.readUint16()
    imgSpec.yOrigin = stream.readUint16()
    imgSpec.width = stream.readUint16()
    imgSpec.height = stream.readUint16()
    imgSpec.depth = stream.readUint8()
    imgSpec.descriptor = stream.readUint8()
    if (imgSpec.depth === 15)
        imgSpec.depth = 16
    imgSpec.alpha = (((imgSpec.descriptor & 0b00001111) != 0)||imgSpec.depth===32) //todo: figure out if red faction obeys this
    imgSpec.flipX = ((imgSpec.descriptor & 0b00010000) != 0) //todo: figure out if red faction obeys this
    imgSpec.flipY = ((imgSpec.descriptor & 0b00100000) == 0) //todo: figure out if red faction obeys this
    //imgSpec.alpha = false //debug
    //imgSpec.flipX = !imgSpec.flipX //debug
    //imgSpec.flipY = !imgSpec.flipY //debug

    let actuallyUsesAlpha = false

    stream.offs += tgaIdLength //skip id section if present

    const colorMap: Uint8Array[] = []
    switch (tgaColorMapType) {
        case TEXTGACMapTypes.INCLUDED:
            for (let i = 0; i < cmapSpec.length; i++) {
                if (cmapSpec.entrySize === 16) {
                    let colorData = stream.readUint16()
                    let r, g, b, a
                    a = ((colorData & 0b10000000_00000000) >> 15) * 255
                    r = ((colorData & 0b01111100_00000000) >> 10)
                    g = ((colorData & 0b00000011_11100000) >>  5)
                    b = ((colorData & 0b00000000_00011111)      )
                    r = expand5to8(r)
                    g = expand5to8(g)
                    b = expand5to8(b)
                    if (!imgSpec.alpha)
                        a = 255
                    colorMap.push(new Uint8Array([r, g, b, a]))
                } else if (cmapSpec.entrySize === 24 || cmapSpec.entrySize === 32) {
                    let pB = stream.readUint8()
                    let pG = stream.readUint8()
                    let pR = stream.readUint8()
                    let pA = 255
                    if (imgSpec.depth === 32)
                        pA = stream.readUint8()
                    if (!imgSpec.alpha)
                        pA = 255
                    colorMap.push(new Uint8Array([pR, pG, pB, pA]))
                } else throw "unimplemented color map size"
            }
            break
        case TEXTGACMapTypes.NONE:
            break
        default:
            throw "unimplemented color map type"
            break
    }

    
    //const bitmap: TexTextureBitmap = {0, 0, imgSpecStream.readUint8()};
    let tex_decomp_buff = new ArrayBuffer(imgSpec.width * imgSpec.height * 4); //todo: does this have to be rgba?
    let tex_decomp = new ArrayBufferSlice(tex_decomp_buff)
    let tex_stream = new DataStream(tex_decomp)
    switch (tgaImageType) {
        //COMPRESSED_COLOR_MAPPED_DATA_USING_HUFFMAN_DELTA_AND_RLE = 32,
        //COMPRESSED_COLOR_MAPPED_DATA_USING_HUFFMAN_DELTA_AND_RLE_4_PASS_QUADTREE_TYPE_PROCESS,
        case TEXTGATypes.COLOR_MAPPED:
            //TODO: figure out how to determine data size when there are more than 256 colors
            for (let i = 0; i < imgSpec.width * imgSpec.height; i++) {
                let cIdx = stream.readUint8()
                tex_stream.writeUint8(colorMap[cIdx][0])
                tex_stream.writeUint8(colorMap[cIdx][1])
                tex_stream.writeUint8(colorMap[cIdx][2])
                tex_stream.writeUint8(colorMap[cIdx][3])
                if (colorMap[cIdx][3] < 255)
                    actuallyUsesAlpha = true
            }
            break
        case TEXTGATypes.RGB:
            if (imgSpec.depth === 16) {
                for (let i = 0; i < imgSpec.width * imgSpec.height; i++) {
                    let colorData = stream.readUint16()
                    let r, g, b, a

                    a = ((colorData & 0b10000000_00000000) >> 15) * 255
                    r = ((colorData & 0b01111100_00000000) >> 10)
                    g = ((colorData & 0b00000011_11100000) >>  5)
                    b = ((colorData & 0b00000000_00011111)      )
                    r = expand5to8(r)
                    g = expand5to8(g)
                    b = expand5to8(b)
                    if (!imgSpec.alpha)
                        a = 255
                    tex_stream.writeUint8(r)
                    tex_stream.writeUint8(g)
                    tex_stream.writeUint8(b)
                    tex_stream.writeUint8(a)
                    if (a < 255)
                        actuallyUsesAlpha = true
                }
            } else if (imgSpec.depth === 24 || imgSpec.depth === 32) {
                for (let i = 0; i < imgSpec.width * imgSpec.height; i++) {
                    let pB = stream.readUint8()
                    let pG = stream.readUint8()
                    let pR = stream.readUint8()
                    let pA = 255
                    if (imgSpec.depth === 32)
                        pA = stream.readUint8()
                    if (!imgSpec.alpha)
                        pA = 255
                    tex_stream.writeUint8(pR)
                    tex_stream.writeUint8(pG)
                    tex_stream.writeUint8(pB)
                    tex_stream.writeUint8(pA)
                    if (pA < 255)
                        actuallyUsesAlpha = true
                }
            }
            else console.warn(`unhandled depth: ${imgSpec.depth}`)
            break
        case TEXTGATypes.BLK_WHT:
            for (let i = 0; i < imgSpec.width * imgSpec.height; i++) {
                let shade = stream.readUint8()
                tex_stream.writeUint8(shade)
                tex_stream.writeUint8(shade)
                tex_stream.writeUint8(shade)
                tex_stream.writeUint8(255)
            }
            break
        case TEXTGATypes.RLE_COLOR_MAPPED:
        case TEXTGATypes.RLE_RGB:
        case TEXTGATypes.RLE_BLK_WHT:
            let rleAlpha = decompressRLE(stream, tex_stream, imgSpec.width * imgSpec.height, imgSpec.depth, imgSpec.alpha, tgaColorMapType === TEXTGACMapTypes.INCLUDED, colorMap)
            if (rleAlpha)
                actuallyUsesAlpha = true
            break
        default:
            console.warn(`~~~unhandled tga type: ${TEXTGATypes[tgaImageType]}~~~`)
            break
        }

    if (imgSpec.flipX || imgSpec.flipY) {
        let flip_decomp_buff = new ArrayBuffer(imgSpec.width * imgSpec.height * 4); //todo: does this have to be rgba?
        let flip_decomp = new ArrayBufferSlice(flip_decomp_buff)
        let flip_stream = new DataStream(flip_decomp)
        //let flip_stream = new DataStream(flip_decomp)

        if (imgSpec.flipX) {
            tex_stream.offs = 0
            for (let i = 0; i < imgSpec.height; i++) {
                let texOffs = (imgSpec.width - 1) * 4 + (i * imgSpec.width * 4)
                tex_stream.offs = texOffs
                for (let x = 0; x < imgSpec.width; x++) {
                    flip_stream.writeUint8(tex_stream.readUint8())
                    flip_stream.writeUint8(tex_stream.readUint8())
                    flip_stream.writeUint8(tex_stream.readUint8())
                    flip_stream.writeUint8(tex_stream.readUint8())
                    tex_stream.offs -= 8
                }
            }
            tex_decomp = flip_decomp.copyToSlice()
            tex_stream = new DataStream(tex_decomp) //reset datastream
        }
        
        if (imgSpec.flipY) {
            tex_stream.offs = 0
            let flipOffs = imgSpec.height * imgSpec.width * 4 - (imgSpec.width * 4) //🖕🏿🖕🏿🖕🏿🖕🏿🖕🏿
            for (let i = 0; i < imgSpec.height; i++) {
                flip_stream.offs = flipOffs
                for (let x = 0; x < imgSpec.width; x++) {
                    flip_stream.writeUint8(tex_stream.readUint8())
                    flip_stream.writeUint8(tex_stream.readUint8())
                    flip_stream.writeUint8(tex_stream.readUint8())
                    flip_stream.writeUint8(tex_stream.readUint8())
                }
                flipOffs -= imgSpec.width * 4
            }
            tex_decomp = flip_decomp.copyToSlice()
        }
    }
    
    return { width: imgSpec.width, height: imgSpec.height, data: tex_decomp, actuallyUsesAlpha, depth: 1, animFps: 0 }
}

export function parseVBM(buffer: ArrayBufferSlice): TEXTextureBitmap[] {
    const stream = new DataStream(buffer)

    assert(stream.readUint32() === 0x6D62762E)
    stream.readUint32()
    const width = stream.readUint32() //todo: figure out if treated as signed or unsigned
    const height = stream.readUint32() //todo: figure out if treated as signed or unsigned
    const format = stream.readUint32() as TEXVBMColors //todo: figure out if treated as signed or unsigned
    const framerate = stream.readUint32() //todo: figure out if treated as signed or unsigned
    const numFrames = stream.readUint32() //todo: figure out if treated as signed or unsigned
    const numMips = stream.readUint32() + 1 //todo: figure out if treated as signed or unsigned
    //stream.readString(4, 4, false)

    let actuallyUsesAlpha = false

    let mipWidth = width, mipHeight = height
    const returnBitmaps: TEXTextureBitmap[] = []


    const texDecompBuffs: ArrayBuffer[] = []
    const texDecomps: ArrayBufferSlice[] = []
    const texStreams: DataStream[] = []

    for (let mipLevel = 0; mipLevel < numMips; mipLevel++) {
        texDecompBuffs.push(new ArrayBuffer(mipWidth * mipHeight * 4 * numFrames))
        texDecomps.push(new ArrayBufferSlice(texDecompBuffs[mipLevel]))
        texStreams.push(new DataStream(texDecomps[mipLevel]))
        mipWidth >>>= 1
        mipHeight >>>= 1
    }

    //vbm stored as frame1, [frame1-mipA, B, ...], frame2, [frame2-mipA, B, ...], ...
    for (let frame = 0; frame < numFrames; frame++) {
        mipWidth = width
        mipHeight = height
        for (let mipLevel = 0; mipLevel < numMips; mipLevel++) {
            if (format === TEXVBMColors.RGB565) {
                for (let i = 0; i < mipWidth * mipHeight; i++) {
                    let colorData = stream.readUint16()
                    let r, g, b, a
                    r = ((colorData & 0b11111000_00000000) >> 11)
                    g = ((colorData & 0b00000111_11100000) >>  5)
                    b = ((colorData & 0b00000000_00011111)      )
                    r = expand5to8(r)
                    g = expand6to8(g)
                    b = expand5to8(b)
                    texStreams[mipLevel].writeUint8(r)
                    texStreams[mipLevel].writeUint8(g)
                    texStreams[mipLevel].writeUint8(b)
                    texStreams[mipLevel].writeUint8(255)
                }
            } else if (format === TEXVBMColors.ARGB4444) {
                for (let i = 0; i < mipWidth * mipHeight; i++) {
                    let colorData = stream.readUint16()
                    let r, g, b, a
                    a = ((colorData & 0b11110000_00000000) >> 12)
                    r = ((colorData & 0b00001111_00000000) >>  8)
                    g = ((colorData & 0b00000000_11110000) >>  4)
                    b = ((colorData & 0b00000000_00001111)      )
                    a = expand4to8(a)
                    r = expand4to8(r)
                    g = expand4to8(g)
                    b = expand4to8(b)
                    texStreams[mipLevel].writeUint8(r)
                    texStreams[mipLevel].writeUint8(g)
                    texStreams[mipLevel].writeUint8(b)
                    texStreams[mipLevel].writeUint8(a)
                    if (a < 255)
                        actuallyUsesAlpha = true
                }
            } else if (format === TEXVBMColors.ARGB1555) {
                for (let i = 0; i < mipWidth * mipHeight; i++) {
                    let colorData = stream.readUint16()
                    let r, g, b, a
        
                    a = ((colorData & 0b10000000_00000000) >> 15) * 255
                    r = ((colorData & 0b01111100_00000000) >> 10)
                    g = ((colorData & 0b00000011_11100000) >>  5)
                    b = ((colorData & 0b00000000_00011111)      )
                    r = expand5to8(r)
                    g = expand5to8(g)
                    b = expand5to8(b)
                    texStreams[mipLevel].writeUint8(r)
                    texStreams[mipLevel].writeUint8(g)
                    texStreams[mipLevel].writeUint8(b)
                    texStreams[mipLevel].writeUint8(a)
                    if (a < 255)
                        actuallyUsesAlpha = true
                }
            } else console.warn(`~~~unhandled vbm color: ${format}~~~`)
            mipWidth >>>= 1
            mipHeight >>>= 1
        }
    }

    mipWidth = width
    mipHeight = height
    for (let mipLevel = 0; mipLevel < numMips; mipLevel++) {
        returnBitmaps.push({ width: mipWidth, height: mipHeight, data: texDecomps[mipLevel], actuallyUsesAlpha, depth: numFrames, animFps: framerate })
        mipWidth >>>= 1
        mipHeight >>>= 1
    }

    /*for (let mipLevel = 0; mipLevel < numMips; mipLevel++) {
        let tex_decomp_buff = new ArrayBuffer(mipWidth * mipHeight * 4 * numFrames); //todo: does this have to be rgba?
        let tex_decomp = new ArrayBufferSlice(tex_decomp_buff)
        let tex_stream = new DataStream(tex_decomp)
        for (let frame = 0; frame < numFrames; frame++) {
            if (format === TEXVBMColors.RGB565) {
                for (let i = 0; i < mipWidth * mipHeight; i++) {
                    let colorData = stream.readUint16()
                    let r, g, b, a
                    r = ((colorData & 0b11111000_00000000) >> 11)
                    g = ((colorData & 0b00000111_11100000) >>  5)
                    b = ((colorData & 0b00000000_00011111)      )
                    r = expand5to8(r)
                    g = expand6to8(g)
                    b = expand5to8(b)
                    tex_stream.writeUint8(r)
                    tex_stream.writeUint8(g)
                    tex_stream.writeUint8(b)
                    tex_stream.writeUint8(255)
                }
            } else if (format === TEXVBMColors.ARGB4444) {
                for (let i = 0; i < mipWidth * mipHeight; i++) {
                    let colorData = stream.readUint16()
                    let r, g, b, a
                    a = ((colorData & 0b11110000_00000000) >> 12)
                    r = ((colorData & 0b00001111_00000000) >>  8)
                    g = ((colorData & 0b00000000_11110000) >>  4)
                    b = ((colorData & 0b00000000_00001111)      )
                    a = expand4to8(a)
                    r = expand4to8(r)
                    g = expand4to8(g)
                    b = expand4to8(b)
                    tex_stream.writeUint8(r)
                    tex_stream.writeUint8(g)
                    tex_stream.writeUint8(b)
                    tex_stream.writeUint8(a)
                    if (a < 255)
                        actuallyUsesAlpha = true
                }
            } else if (format === TEXVBMColors.ARGB1555) {
                for (let i = 0; i < mipWidth * mipHeight; i++) {
                    let colorData = stream.readUint16()
                    let r, g, b, a
        
                    a = ((colorData & 0b10000000_00000000) >> 15) * 255
                    r = ((colorData & 0b01111100_00000000) >> 10)
                    g = ((colorData & 0b00000011_11100000) >>  5)
                    b = ((colorData & 0b00000000_00011111)      )
                    r = expand5to8(r)
                    g = expand5to8(g)
                    b = expand5to8(b)
                    tex_stream.writeUint8(r)
                    tex_stream.writeUint8(g)
                    tex_stream.writeUint8(b)
                    tex_stream.writeUint8(a)
                    if (a < 255)
                        actuallyUsesAlpha = true
                }
            } else console.log(`~~~unhandled vbm color: ${format}~~~`)
        }
        returnBitmaps.push({ width: mipWidth, height: mipHeight, data: tex_decomp, actuallyUsesAlpha, depth: numFrames })
        mipWidth >>>= 1
        mipHeight >>>= 1
    }//*/

    return returnBitmaps
}//*/

function decompressLevel(tex: TEXTexture, level: TEXTextureBitmap): DecodedSurfaceSW {
    //switch (tex.format) {
    //case TEXTextureFormat.DXT1:
    //    return decompressBC({ type: 'BC1', width: level.width, height: level.height, depth: 1, flag: 'SRGB', pixels: level.data.createTypedArray(Uint8Array) });
    //case TEXTextureFormat.DXT5:
    //    return decompressBC({ type: 'BC3', width: level.width, height: level.height, depth: 1, flag: 'SRGB', pixels: level.data.createTypedArray(Uint8Array) });
    //default:
        // Unknown format type...
    //if (tex.alpha)
        return { type: 'RGBA', width: level.width, height: level.height, depth: 1, flag: 'SRGB', pixels: level.data.createTypedArray(Uint8Array) };
    //else
    //    return { type: 'RGB', width: level.width, height: level.height, depth: 1, flag: 'SRGB', pixels: level.data.createTypedArray(Uint8Array) };
    //}
}

export class TEXTextureHolder extends TextureHolder<TEXTexture> {
    public static translateTextureDescriptor(surface: TEXTexture): GfxTextureDescriptor {
        let dimension = (surface.depth == 1) ? GfxTextureDimension.n2D : GfxTextureDimension.n2D_ARRAY
        if (surface.name.startsWith('redfaction-lightmap-array') && surface.depth === 1 && surface.levels.length === 1)
            dimension = GfxTextureDimension.n2D_ARRAY //hack to fix levels with only 1 lightmap bitmap
        return {
            dimension,
            pixelFormat: GfxFormat.U8_RGBA,
            width: surface.width,
            height: surface.height,
            depth: surface.depth,
            numLevels: surface.levels.length,
        };
    }
    public loadTexture(device: GfxDevice, textureEntry: TEXTexture): LoadedTexture {
        const surface = textureEntry

        const gfxTexture = device.createTexture(TEXTextureHolder.translateTextureDescriptor(surface))
        device.setResourceName(gfxTexture, textureEntry.name)
        if (textureEntry.name === "redfaction-lightmap-array-0") {
            console.log(textureEntry.name)
            console.log(`numLevels: ${surface.levels.length}`)
            console.log(`depth: ${surface.depth}`)
            console.log(gfxTexture)
        }
        const canvases: HTMLCanvasElement[] = []

        //for (let i = 0; i < surface.)

        //const surfaces: HTMLCanvasElement[] = [];

        for (let i = 0; i < surface.levels.length; i++) {
            const mipLevel = i;
            const firstCanvas = canvases.length

            for (let j = 0; j < surface.depth; j++) {
                const canvas = document.createElement('canvas')
                canvas.width = 1
                canvas.height = 1
                canvases.push(canvas)
            }

            const levelFrames: Uint8Array[] = [];

            for (let j = 0; j < surface.depth; j++) {
                const decodedSurface = decompressLevel(textureEntry, surface.levels[mipLevel])
                levelFrames.push(decodedSurface.pixels as Uint8Array)
                const canvas = canvases[firstCanvas+j]
                surfaceToCanvas(canvas, decodedSurface, j)
            }
            //const canvas = canvases[firstCanvas]

            const hostAccessPass = device.createHostAccessPass()
            hostAccessPass.uploadTextureData(gfxTexture, mipLevel, levelFrames);
            device.submitPass(hostAccessPass)
        }

        const viewerTexture: Viewer.Texture = { name: textureEntry.name, surfaces: canvases };
        return { viewerTexture, gfxTexture: gfxTexture };
        
        
        /*let gfxTextureee: GfxTexture;
        if (textureEntry.depth === 1)
        gfxTextureee = device.createTexture({
            dimension: GfxTextureDimension.n2D, pixelFormat: GfxFormat.U8_RGBA,
            //width: textureEntry.width, height: textureEntry.height, depth: 1, numLevels: textureEntry.levels.length,
            width: textureEntry.width, height: textureEntry.height, depth: 1, numLevels: 1,
        });
        else
        gfxTextureee = device.createTexture({
            dimension: GfxTextureDimension.n2D_ARRAY, pixelFormat: GfxFormat.U8_RGBA,
            //width: textureEntry.width, height: textureEntry.height, depth: 1, numLevels: textureEntry.levels.length,
            width: textureEntry.width, height: textureEntry.height, depth: textureEntry.depth, numLevels: 1,
        });
        device.setResourceName(gfxTextureee, textureEntry.name);
        const canvasesss: HTMLCanvasElement[] = [];

        const firstCanvas = canvasesss.length;

        const levelDatas: Uint8Array[] = [];
        //for (let i = 0; i < textureEntry.levels.length; i++) {

        for (let i = 0; i < textureEntry.depth; i++) {
            const canvas = document.createElement('canvas');
            canvas.width = 1;
            canvas.height = 1;
            canvasesss.push(canvas);
        }

        const level = textureEntry.levels[0];
        const decodedSurface = decompressLevel(textureEntry, level);
        levelDatas.push(decodedSurface.pixels as Uint8Array);
        for (let i = 0; i < textureEntry.depth; i++) {
            const canvas = canvasesss[firstCanvas + i];
            //const canvas = document.createElement('canvas');
            surfaceToCanvas(canvas, decodedSurface, i);
            //canvases.push(canvas);
        }

        const hostAccessPass = device.createHostAccessPass();
        hostAccessPass.uploadTextureData(gfxTextureee, 0, levelDatas);
        device.submitPass(hostAccessPass);

        const viewerTextureee: Viewer.Texture = { name: textureEntry.name, surfaces: canvasesss };
        return { viewerTexture, gfxTexture: gfxTextureee };//*/
    }

    public addTEX(device: GfxDevice, tex: TEX): void {
        this.addTextures(device, tex.textures);
    }
}
