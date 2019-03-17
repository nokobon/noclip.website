import ArrayBufferSlice from '../ArrayBufferSlice';

import { assert, readString } from '../util';

import { DataStream } from "../redfaction/DataStream";
import { AABB } from "../Geometry";
import { vec3, vec4, vec2 } from "gl-matrix";
import { GfxTopology } from "../gfx/helpers/TopologyHelpers";

export enum RF3DSections {
    END = 0x00000000,
    SUBMESH = 0x5355424D,   //SUBM
    COLSPHERE = 0x43535048, //CSPH
    BONE = 0x424F4E45,      //BONE
    DUMB = 0x44554D42,      //DUMB
}

export interface RF3DBaseInterface { type: RF3DSections }
interface RF3DBytes extends RF3DBaseInterface { data: ArrayBufferSlice }

interface RF3DBatchInfo {
    verticesCount: number
    trianglesCount: number
    positionsSize: number
    indicesSize: number
    unknownSize: number
    boneLinksSize: number
    texCoordsSize: number
    unknown3: number 
}

interface RF3DMaterial {
    diffuseMapName: string
    unknownCoefficient: number
    unknown: number[]
    reflectionCoefficient: number //"0.0-1.0 - reflection coefficient?"
    refMapName: string
    flags: RF3DMaterialFlags
}

enum RF3DMaterialFlags {
    UNK1 = 1,
    UNK2 = 8,
    TWO_SIDED = 0x10,
}

interface RF3DBatchHeader {
    unknown1: ArrayBufferSlice
    texIdx: number
    unknown2: ArrayBufferSlice
}

interface RF3DTriangle {
    indices: number[]
    unknown: number
}

interface RF3DVertexBones {
    weights: number[]
    bones: number[]
}

interface RF3DBatchData {
    positions: vec3[]
    normals: vec3[]
    texCoords: vec2[]
    triangles: RF3DTriangle[]
    unknownPlanes?: number[]
    unknown: ArrayBufferSlice
    boneLinks: RF3DVertexBones[]
    unknownOther: ArrayBufferSlice
}

interface RF3DLodProp {
    name: string
    unknown: number[]
    unknown2: number
}

export interface RF3DLodMeshData {
    batchHeaders: RF3DBatchHeader[]
    batchData: RF3DBatchData[]
    unkProps: RF3DLodProp[]
}

interface RF3DTexture {
    index: number
    filename: string
}

interface RF3DSubmeshLod {
    flags: number
    unknown0: number
    batchesCount: number
    dataSize: number
    modelData: RF3DLodMeshData
    unknown1: number
    batchInfo: RF3DBatchInfo[]
    unkPropCount: number
    texturesCount: number
    textures: RF3DTexture[]
}

interface RF3DBoundingSphere {
    center: vec3
    radius: number
}

interface RF3DSubmeshUnknown4 {
    unknown: string
    unknown2: number
}

export interface RF3DSubmesh extends RF3DBaseInterface {
    name: string
    unknown: string
    version: number
    lodModelsCount: number
    lodDistances: number[]
    boundingSphere: RF3DBoundingSphere
    aabb: AABB //verify that this is the same
    lodModels: RF3DSubmeshLod[]
    materialsCount: number
    materials: RF3DMaterial[]
    unknown3: number
    unknown4: RF3DSubmeshUnknown4[]
}

interface RF3DColSphere extends RF3DBaseInterface {
    name: string
    bone: number
    position: vec3
    radius: number
}

interface RF3DBone {
    name: string
    rotation: vec4
    position: vec3
    parent: number
}

interface RF3DBones extends RF3DBaseInterface {
    //bonesCount: number
    bones: RF3DBone[]
}

interface RF3DDumbSection extends RF3DBaseInterface {
    groupName: string
    unknown: number[]
}

function parseRF3DSection(stream: DataStream, sectionType: RF3DSections): RF3DBaseInterface {
    switch(sectionType) {
        case RF3DSections.END:
            return <RF3DBaseInterface>{type: sectionType, data: stream.readSlice(0)}
        case RF3DSections.SUBMESH:
            let submesh: RF3DSubmesh = <RF3DSubmesh>{}
            submesh.type = sectionType
            submesh.name = stream.readString(24)
            submesh.unknown = stream.readString(24)
            submesh.version = stream.readUint32() //7 (submesh ver?) values < 7 don't work
            submesh.lodModelsCount = stream.readUint32() // 1-3
            submesh.lodDistances = []
            for (let i = 0; i < submesh.lodModelsCount; i++)
                submesh.lodDistances.push(stream.readFloat32())

            let boundingSphere: RF3DBoundingSphere = <RF3DBoundingSphere>{}
            boundingSphere.center = stream.readEVec3Float()
            boundingSphere.radius = stream.readFloat32()
            submesh.boundingSphere = boundingSphere
            submesh.aabb = stream.readAABB()

            let subStream: DataStream;
            
            submesh.lodModels = []
            for (let i = 0; i < submesh.lodModelsCount; i++) {
                let submeshLod: RF3DSubmeshLod = <RF3DSubmeshLod>{}
                submeshLod.flags = stream.readUint32() //0x1|0x2 - characters, 0x20 - static meshes, 0x10 only driller01.v3m
                submeshLod.unknown0 = stream.readUint32()
                submeshLod.batchesCount = stream.readUint16()
                submeshLod.dataSize = stream.readUint32()

                //let slModelDataOffs = stream.offs //need information out of order to parse model data
                subStream = new DataStream(stream.readSlice(submeshLod.dataSize));
                //stream.offs += submeshLod.dataSize

                submeshLod.unknown1 = stream.readInt32() //-1, sometimes 0
                submeshLod.batchInfo = []
                for (let ii = 0; ii < submeshLod.batchesCount; ii++) {
                    let batchInfo = <RF3DBatchInfo>{}
                    batchInfo.verticesCount = stream.readUint16()
                    batchInfo.trianglesCount = stream.readUint16()
                    batchInfo.positionsSize = stream.readUint16()
                    batchInfo.indicesSize = stream.readUint16()
                    batchInfo.unknownSize = stream.readUint16()
                    batchInfo.boneLinksSize = stream.readUint16()
                    batchInfo.texCoordsSize = stream.readUint16()
                    batchInfo.unknown3 = stream.readUint32() //0x518C41 or 0x110C21
                    submeshLod.batchInfo.push(batchInfo)
                }

                submeshLod.unkPropCount = stream.readUint32()
                submeshLod.texturesCount = stream.readUint32()
                submeshLod.textures = []
                for (let ii = 0; ii < submeshLod.texturesCount; ii++) {
                    let texture = <RF3DTexture>{}
                    texture.index = stream.readUint8() //index in v3d_submesh::materials
                    texture.filename = stream.readStrz()
                    submeshLod.textures.push(texture)
                }

                //go back and parse model data now
                let slModelData = <RF3DLodMeshData>{}
                slModelData.batchHeaders = []
                for (let ii = 0; ii < submeshLod.batchesCount; ii++) {
                    let batchHeader = <RF3DBatchHeader>{}
                    batchHeader.unknown1 = subStream.readSlice(32)
                    batchHeader.texIdx = subStream.readUint8() //texture index within v3d_submesh_lod
                    batchHeader.unknown2 = subStream.readSlice(23)
                    //#doc: openfaction has some known but it's commented out
                    //#doc: "this is not used by RF - only read and then over-written by values from v3d_batch_info"
                    slModelData.batchHeaders.push(batchHeader)
                }

                subStream.align16()

                slModelData.batchData = []
                for (let ii = 0; ii < submeshLod.batchesCount; ii++) {
                    let batchData = <RF3DBatchData>{}
                    batchData.positions = []
                    for (let iii = 0; iii < submeshLod.batchInfo[ii].verticesCount; iii++)
                        batchData.positions.push(subStream.readEVec3Float())
                        subStream.align16()

                    batchData.normals = []
                    for (let iii = 0; iii < submeshLod.batchInfo[ii].verticesCount; iii++)
                        batchData.normals.push(subStream.readEVec3Float())
                        subStream.align16()

                    batchData.texCoords = []
                    for (let iii = 0; iii < submeshLod.batchInfo[ii].verticesCount; iii++)
                        batchData.texCoords.push(subStream.readEVec2Float())
                        subStream.align16()

                    batchData.triangles = []
                    for (let iii = 0; iii < submeshLod.batchInfo[ii].trianglesCount; iii++) {
                        let triangle = <RF3DTriangle>{}
                        triangle.indices = []
                        triangle.indices.push(subStream.readUint16())
                        triangle.indices.push(subStream.readUint16())
                        triangle.indices.push(subStream.readUint16())
                        triangle.unknown = subStream.readUint16() //0x0 or 0x20 (flags or padding?)
                        batchData.triangles.push(triangle)
                    }
                    subStream.align16()

                    if ((submeshLod.flags & 0x20) === 0x20) {
                        batchData.unknownPlanes = []
                        for (let iii = 0; iii < submeshLod.batchInfo[ii].trianglesCount * 4; iii++)
                            batchData.unknownPlanes.push(subStream.readFloat32())
                            subStream.align16()
                    }

                    batchData.unknown = subStream.readSlice(submeshLod.batchInfo[ii].unknownSize)
                    subStream.align16()

                    if (submeshLod.batchInfo[ii].boneLinksSize > 0) {
                        batchData.boneLinks = []
                        for (let iii = 0; iii < submeshLod.batchInfo[ii].verticesCount; iii++) { //todo: is this supposed to be boneLinksSize instead? ksy uses verticesCount
                            let vertexBones = <RF3DVertexBones>{}
                            vertexBones.weights = []
                            vertexBones.bones = []
                            vertexBones.weights.push(subStream.readUint8()) //in range 0-255, 0 if slot is unused
                            vertexBones.weights.push(subStream.readUint8())
                            vertexBones.weights.push(subStream.readUint8())
                            vertexBones.weights.push(subStream.readUint8())
                            vertexBones.bones.push(subStream.readUint8()) //bone indices, 0xFF if slot is unused
                            vertexBones.bones.push(subStream.readUint8())
                            vertexBones.bones.push(subStream.readUint8())
                            vertexBones.bones.push(subStream.readUint8())
                            batchData.boneLinks.push(vertexBones)
                        }
                        subStream.align16()
                    }

                    if ((submeshLod.flags & 0x1) === 0x1) {
                        batchData.unknownOther = subStream.readSlice(submeshLod.unknown0 * 2)
                        subStream.align16()
                    }

                    slModelData.batchData.push(batchData)
                }

                subStream.align16()

                if (submeshLod.unkPropCount > 0) {
                    slModelData.unkProps = []
                    for (let ii = 0; ii < submeshLod.unkPropCount; ii++) {
                        let lodProp = <RF3DLodProp>{}
                        lodProp.name = subStream.readString(0x44)
                        lodProp.unknown = []
                        for (let iii = 0; iii < 7; iii++)
                            lodProp.unknown.push(subStream.readFloat32()) //pos + rot?
                        lodProp.unknown2 = subStream.readInt32() //-1
                        slModelData.unkProps.push(lodProp)
                    }
                }

                submeshLod.modelData = slModelData

                if (submeshLod.dataSize !== subStream.offs)
                    console.warn(`expected offs ${submeshLod.dataSize}, got ${subStream.offs}`)
                assert(subStream.offs === submeshLod.dataSize, `expected offs ${submeshLod.dataSize}, got ${subStream.offs}`)

                submesh.lodModels.push(submeshLod)
            }

            submesh.materialsCount = stream.readUint32()
            submesh.materials = []
            for (let i = 0; i < submesh.materialsCount; i++) {
                let material = <RF3DMaterial>{}
                material.diffuseMapName = stream.readString(32)
                material.unknownCoefficient = stream.readFloat32() //0.0-1.0 - used mostly with lights
                material.unknown = []
                material.unknown.push(stream.readFloat32()) //both always 0.0 in game
                material.unknown.push(stream.readFloat32())
                material.reflectionCoefficient = stream.readFloat32() //0.0-1.0 - reflection coefficient?
                material.refMapName = stream.readString(32) //not empty if ref_cof > 0.0
                material.flags = stream.readUint32()
                submesh.materials.push(material)
            }

            submesh.unknown3 = stream.readUint32() //always 1 in game files?
            submesh.unknown4 = []
            for (let i = 0; i < submesh.unknown3; i++) {
                let unk4 = <RF3DSubmeshUnknown4>{}
                unk4.unknown = stream.readString(24) //same as submesh name
                unk4.unknown2 = stream.readFloat32() //always 0?
                submesh.unknown4.push(unk4)
            }

            return submesh
        case RF3DSections.COLSPHERE:
            let colSphere = <RF3DColSphere>{}
            colSphere.type = sectionType
            colSphere.name = stream.readString(24)
            colSphere.bone = stream.readInt32() //bone index or -1
            colSphere.position = stream.readEVec3Float() //position relative to bone
            colSphere.radius = stream.readFloat32()
            return colSphere
        case RF3DSections.BONE:
            const bonesCount = stream.readUint32()
            let bones: RF3DBone[] = []
            for (let i = 0; i < bonesCount; i++) {
                let bone = <RF3DBone>{}
                bone.name = stream.readString(24)
                bone.rotation = stream.readEVec4Float() //quaternion
                bone.position = stream.readEVec3Float() //bone to model translation
                bone.parent = stream.readInt32() //bone index (root has -1)
                bones.push(bone)
            }
            return <RF3DBones>{ type: sectionType, bones: bones }
        case RF3DSections.DUMB:
            //dumb section is removed by ccrunch - available only in v3d generated by 3ds max exporter
            let dumb = <RF3DDumbSection>{}
            dumb.type = sectionType
            dumb.groupName = stream.readString(24)
            dumb.unknown = [] //FF FF FF FF 00 00 00 00 00 00 00 80 00 00 00 00 00 00 80 3F A9 13 D0 B2 00 00 00 00 00 00 00 80
            for (let i = 0; i < 8; i++)
                dumb.unknown.push(stream.readInt32())
        default:
            console.log("parseRF3DSection default case")
            return <RF3DBytes>{type: sectionType, data: stream.readSlice(0)}
            
    }
}

export function parse(buffer: ArrayBufferSlice): RF3DBaseInterface[] {
    const stream = new DataStream(buffer)

    //parse rf3d header {
        let magic = stream.readUint32()
        //acceptable values: 0x52463344 (RF3D), 0x5246434D (RFCM)
        if (magic !== 0x52463344 && magic !== 0x5246434D) throw '💩'
        let version = stream.readUint32()
        let submeshesCount = stream.readUint32() //number of submesh sections
        let totalVerticesCount = stream.readUint32() //ccrunch resets to 0
        let totalTrianglesCount = stream.readUint32() //ccrunch resets to 0
        let unknown0 = stream.readUint32() //ccrunch resets to 0
        let totalMaterialsCount = stream.readUint32() //total materials count in all submeshes
        let unknown2 = stream.readUint32() //always 0 in game
        let unknown3 = stream.readUint32() //always 0 in game
        let colspheresCount = stream.readUint32() //number of colsphere sections
    //}

    console.log("enter")
    let parsedSections : RF3DBaseInterface[] = []
    while (stream.offs < stream.buffer.byteLength) {
        let sectionType: RF3DSections = stream.readUint32()
        let sectionSize = stream.readUint32() //0 after ccrunch (entire section has to be processed to find the end)

        let parsedSection = parseRF3DSection(stream, sectionType)
        parsedSections.push(parsedSection)
        console.log(RF3DSections[sectionType])
    }
    console.log("exit")
    stream.offs-- //debug
    console.log(`last byte: ${stream.readUint8()} (offs: ${stream.offs}/${stream.buffer.byteLength})`) //debug

    return parsedSections
}
