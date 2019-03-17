import ArrayBufferSlice from "../ArrayBufferSlice"
import { assert, readString, align } from "../util"
import { DataStream } from "./DataStream"

export interface VPPFile {
    name: string
    nameBase: string
    nameRaw: string
    type: string
    size: number
    data: ArrayBufferSlice
}

export interface VPP {
    files: VPPFile[]
}

export function parse(buffer: ArrayBufferSlice): VPP {
    const stream = new DataStream(buffer)

    assert(stream.readUint32() === 0x51890ACE)
    let version = stream.readUint32()
    let fileCount = stream.readUint32()
    let vppSize = stream.readUint32()
    stream.align()

    const files: VPPFile[] = []
    for (let i = 0; i < fileCount; i++) {
        const nameRaw = stream.readString(60)
        const name = nameRaw.toLowerCase()
        const nameBase = name.replace(/\.(tga|vbm|v3d|v3m|v3c|vfx|tbl|rfl)$/i, '')
        const size = stream.readUint32()
        let type = 'file'
        if (name.endsWith('.tga') || name.endsWith('.vbm'))
            type = 'texture'
        if (name.endsWith('.v3d') || name.endsWith('.v3m') || name.endsWith('.v3c') || name.endsWith('.vfx'))
            type = 'mesh'
        if (name.endsWith('.tbl'))
            type = 'table'
        if (name.endsWith('.rfl'))
            type = 'level'
        
        files.push({ name, nameBase, nameRaw, type, size, data: null})
    }

    stream.align()

    for (let file in files) {
        files[file].data = stream.readSlice(files[file].size)
        stream.align()
    }

    return { files }
}
