import ArrayBufferSlice from "../ArrayBufferSlice";
import { readString } from "../util";
import { vec2, vec3, vec4, mat3 } from "gl-matrix";
import { AABB } from "../Geometry";

export class DataStream {
    constructor(
        public buffer: ArrayBufferSlice,
        public view: DataView = buffer.createDataView(),
        public offs: number = 0,
    ) {
    }
    
    public align() { if (this.offs % 2048 > 0) this.offs += 2048 - (this.offs % 2048) }
    public align16() { if (this.offs % 16 > 0) this.offs += (16 - (this.offs % 16)) }


    public readUint8(): number { return this.view.getUint8(this.offs++); }
    public readUint16(): number { const v = this.view.getUint16(this.offs, true); this.offs += 0x02; return v; }
    public readUint32(): number { const v = this.view.getUint32(this.offs, true); this.offs += 0x04; return v; }
    public readFloat32(): number { const v = this.view.getFloat32(this.offs, true); this.offs += 0x04; return v; }

    public readInt8(): number { return this.view.getInt8(this.offs++); }
    public readInt16(): number { const v = this.view.getInt16(this.offs, true); this.offs += 0x02; return v; }
    public readInt32(): number { const v = this.view.getInt32(this.offs, true); this.offs += 0x04; return v; }

    public readEVec2Int32(): vec2 {
        const a = this.readInt32()
        const b = this.readInt32()
        return vec2.fromValues(a,b)
    }

    public readEVec2Float(): vec2 {
        const a = this.readFloat32()
        const b = this.readFloat32()
        return vec2.fromValues(a,b)
    }

    public readEVec3UInt(): vec3 {
        const a = this.readUint8()
        const b = this.readUint8()
        const c = this.readUint8()
        return vec3.fromValues(a,b,c)
    }
    
    public readEVec3Float(): vec3 {
        const a = this.readFloat32()
        const b = this.readFloat32()
        const c = this.readFloat32()
        return vec3.fromValues(a, b, c)
    }
    
    public readEVec4Uint8(): vec4 {
        const a = this.readUint8()
        const b = this.readUint8()
        const c = this.readUint8()
        const d = this.readUint8()
        return vec4.fromValues(a, b, c, d);
    }

    public readEVec4Float(): vec4 {
        const a = this.readFloat32()
        const b = this.readFloat32()
        const c = this.readFloat32()
        const d = this.readFloat32()
        return vec4.fromValues(a, b, c, d);
    }

    public readRotMat(): mat3 {
        const m20 = this.readFloat32()
        const m21 = this.readFloat32()
        const m22 = this.readFloat32()
        const m00 = this.readFloat32()
        const m01 = this.readFloat32()
        const m02 = this.readFloat32()
        const m10 = this.readFloat32()
        const m11 = this.readFloat32()
        const m12 = this.readFloat32()
        return mat3.fromValues(m00, m01, m02, m10, m11, m12, m20, m21, m22)
    }

    public readAABB(): AABB {
        const a = this.readFloat32()
        const b = this.readFloat32()
        const c = this.readFloat32()
        const d = this.readFloat32()
        const e = this.readFloat32()
        const f = this.readFloat32()
        return new AABB(a, b, c, d, e, f)
    }
    
    //public readEBox3(stream: DataStream): AABB {
    //    return new AABB(stream.readFloat32(), stream.readFloat32(), stream.readFloat32(), stream.readFloat32(), stream.readFloat32(), stream.readFloat32());
    //}

    public writeUint8(n: number) { this.view.setUint8(this.offs++, n) }
    public writeUint16(n: number) { this.view.setUint16(this.offs, n); this.offs += 2 }
    public writeUint32(n: number) { this.view.setUint32(this.offs, n); this.offs += 4 }

    public readStrz() {
        const v = readString(this.buffer, this.offs, -1, true)
        this.offs += v.length + 1
        return v
    }

    public readString(n: number, n2: number = n, nulterm: boolean = true): string {
        const v = readString(this.buffer, this.offs, n, nulterm);
        this.offs += n2;
        return v;
    }

    public readRF1String(): string {
        const n = this.readInt16() //TODO: is this really signed or is my ksy wrong?
        return this.readString(Math.max(n, 0), n);
    }

    public readSlice(size: number): ArrayBufferSlice {
        const v = this.buffer.subarray(this.offs, size);
        this.offs += size;
        return v;
    }

}
