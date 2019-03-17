
import { TextureHolder, LoadedTexture, TextureMapping } from "../TextureHolder";
import { GfxDevice, GfxFormat, GfxBufferUsage, GfxBuffer, GfxVertexAttributeDescriptor, GfxVertexAttributeFrequency, GfxInputLayout, GfxInputState, GfxVertexBufferDescriptor, GfxBufferFrequencyHint, GfxBindingLayoutDescriptor, GfxProgram, GfxHostAccessPass, GfxSampler, GfxTexFilterMode, GfxMipFilterMode, GfxWrapMode, GfxTextureDimension, GfxCullMode, GfxBlendMode, GfxBlendFactor,
    GfxFrontFaceMode, GfxCompareMode, GfxRenderPass
 } from "../gfx/platform/GfxPlatform";
import * as Viewer from "../viewer";
import { decompressBC, DecodedSurfaceSW, surfaceToCanvas } from "../fres/bc_texture";
import { TEXTextureHolder } from './tex';
import { makeStaticDataBuffer } from "../gfx/helpers/BufferHelpers";
import { DeviceProgram, DeviceProgramReflection } from "../Program";
import { convertToTriangleIndexBuffer, filterDegenerateTriangleIndexBuffer, makeTriangleIndexBuffer, GfxTopology, getTriangleCountForTopologyIndexCount, getTriangleIndexCountForTopologyIndexCount } from "../gfx/helpers/TopologyHelpers";
import { GfxRenderInstBuilder, GfxRenderInst, GfxRenderInstViewRenderer, GfxRendererLayer, makeSortKey } from "../gfx/render/GfxRenderer";
import { GfxRenderBuffer } from "../gfx/render/GfxRenderBuffer";
import { fillMatrix4x3, fillMatrix4x4, fillVec4 } from "../gfx/helpers/UniformBufferHelpers";
import { mat4, vec3, mat3, quat, glMatrix } from "gl-matrix";
import { computeViewMatrix, Camera, computeViewMatrixSkybox } from "../Camera";
import { BasicRendererHelper } from "../oot3d/render";
import ArrayBufferSlice from "../ArrayBufferSlice";
import { transparentBlackFullClearRenderPassDescriptor, depthClearRenderPassDescriptor } from '../gfx/helpers/RenderTargetHelpers';

import * as RFL from "./rfl"
import * as RF3D from './rf3d';
import { OrbitCameraController, FPSCameraController } from '../Camera';
//import * as RF3D from "../rf3d/rf3d"
//import { ModelRenderer } from "../rf3d/render"
import { nArray, assert } from "../util";

// @ts-ignore
import { readFileSync } from 'fs';
//import { UI } from "../ui";
import * as UI from '../ui';
import { BlendMode } from "../gx/gx_enum";
import { AABB } from "../Geometry";

export const RENDER_HACKS_ICON = `<svg viewBox="0 0 110 105" height="20" fill="white"><path d="M95,5v60H65c0-16.6-13.4-30-30-30V5H95z"/><path d="M65,65c0,16.6-13.4,30-30,30C18.4,95,5,81.6,5,65c0-16.6,13.4-30,30-30v30H65z"/></svg>`;
const GLOBAL_SCALE = 50.0;
const scratchMat3 = mat3.create();
const scratchMat4 = mat4.create();
const scratchMat4a = mat4.create();
const scratchVec3 = vec3.create();
const scratchQuat = quat.create();
const bboxScratch = new AABB();

export const enum RFPass {
    MAIN = 0x01,
    SKYBOX = 0x02,
}

class RedFactionProgram extends DeviceProgram {
    public static a_Position = 0;
    public static a_Normal = 1;
    public static a_TexCoord = 2;
    public static a_LightmapTexCoord = 3;
    public static a_LightmapTex = 4;

    public static ub_SceneParams = 0;
    public static ub_MeshFragParams = 1;

    private static program = readFileSync('src/redfaction/program.glsl', { encoding: 'utf8' });
    public static programReflection: DeviceProgramReflection = DeviceProgram.parseReflectionDefinitions(RedFactionProgram.program);
    public both = RedFactionProgram.program;
}

class RedFactionRF3DProgram extends DeviceProgram {
    public static a_Position = 0;
    public static a_Normal = 1;
    public static a_TexCoord = 2;

    public static ub_SceneParams = 0;
    public static ub_MeshFragParams = 1;

    private static program = readFileSync('src/redfaction/rf3d_program.glsl', { encoding: 'utf8' });
    public static programReflection: DeviceProgramReflection = DeviceProgram.parseReflectionDefinitions(RedFactionRF3DProgram.program);
    public both = RedFactionRF3DProgram.program;
}

class RedFactionMapData {
    private indexBuffer: GfxBuffer;
    private vertexBuffer: GfxBuffer;
    private inputLayout: GfxInputLayout;
    public inputState: GfxInputState;
    public renderInst: GfxRenderInst;
    public indexBufferCount : number;

    //todo: remove hack passing lightmap data?
    constructor(device: GfxDevice, mapData: RFL.RF1Rooms | RFL.RF1Brush, desiredTexture: number, unknownLightmapData: RFL.RF1RoomsUnknownLightmap[], desiredRoom: number) {
        this.indexBufferCount = 0;
        let dstOffs = 0;
        //let dstOffs2 = 0;
        for (let i = 0; i < mapData.faceCount; i++) {
            const face = mapData.faces[i];
            if (face.texture !== desiredTexture)
                continue;
            
            if (face.roomIndex !== desiredRoom && desiredRoom != -4.20)
                continue;

            if (face.unknownPortal !== 0) //skip portal faces
                continue; //TODO: configure visible portals

            if ((face.flags & RFL.RF1FaceFlags.SHOW_SKY) === 1) //skip sky faces
                continue; //TODO: configure visible sky faces
            
            //if (face.vertexCount === 4)
            //    this.indexBufferCount += getTriangleIndexCountForTopologyIndexCount(GfxTopology.QUADS, face.vertexCount)
            //else
                this.indexBufferCount += getTriangleIndexCountForTopologyIndexCount(GfxTopology.TRIFAN, face.vertexCount)
        }

        const indexData = new Uint16Array(this.indexBufferCount)
        dstOffs = 0;
        //const vertexData = new Float32Array(10 * this.indexBufferCount);
        const vertexData = new Float32Array(11 * this.indexBufferCount);
        //const vertLightmapData = new Int16Array(this.indexBufferCount);
        for (let i = 0; i < mapData.faceCount; i++) {
            const face = mapData.faces[i];
            if (face.texture !== desiredTexture)
                continue;

            if (face.roomIndex !== desiredRoom && desiredRoom != -4.20)
                continue;

            if (face.unknownPortal !== 0) //skip portal faces
                continue; //TODO: configure visible portals

            if ((face.flags & RFL.RF1FaceFlags.SHOW_SKY) === 1) //skip sky faces
                continue; //TODO: configure visible sky faces

            //if (desiredLmap === -1 && face.unknownLightmap !== -1)
            //    continue

            const faceTempBuffer = new Uint16Array(face.vertexCount);
            for (let j = 0; j < face.vertexCount; j++)
                faceTempBuffer[j] = face.vertices[j].index;
            //console.log(faceTempBuffer)
            let faceTempBuffer2 : Uint16Array
            //if (face.vertexCount === 3)
            //    faceTempBuffer2 = convertToTriangleIndexBuffer(GfxTopology.TRIANGLES, faceTempBuffer);
            //if (face.vertexCount === 4)
            //    faceTempBuffer2 = convertToTriangleIndexBuffer(GfxTopology.QUADS, faceTempBuffer);
            //else
                //faceTempBuffer2 = convertToTriangleIndexBuffer(GfxTopology.TRIFAN, faceTempBuffer);
                faceTempBuffer2 = convertToTriangleIndexBuffer(GfxTopology.TRIFAN, faceTempBuffer);
            for (let j = 0; j < faceTempBuffer2.byteLength / faceTempBuffer2.BYTES_PER_ELEMENT; j++) {
                //de-triangulate to pull out uv
                let srcVertex: RFL.RF1Vertex;
                let lightmapNumber = -1;
                //if (face.vertexCount === 4) {
                //    //0 1 2 2 3 0
                //    srcVertex = face.vertices[j]
                //    if (j == 3)
                //        srcVertex = face.vertices[2]
                //    else if (j == 4)
                //        srcVertex = face.vertices[3]
                //    else if (j == 5)
                //        srcVertex = face.vertices[0]

                //} else {
                    //0, 1, 2 -> 0, 1, 2
                    //3, 4, 5 -> 0, 2, 3
                    //6, 7, 8 -> 0, 3, 4
                    //9,10,11 -> 0, 4, 5
                    srcVertex = (j%3 === 0) ? face.vertices[0] : face.vertices[Math.floor(j/3) + (j%3)]
                //}

                if (face.unknownLightmap !== -1)
                    lightmapNumber = unknownLightmapData[face.unknownLightmap].lightmap

                vertexData[dstOffs++] = mapData.vertices[faceTempBuffer2[j]][0];
                vertexData[dstOffs++] = mapData.vertices[faceTempBuffer2[j]][1];
                vertexData[dstOffs++] = mapData.vertices[faceTempBuffer2[j]][2];
                vertexData[dstOffs++] = face.normalVector[0];
                vertexData[dstOffs++] = face.normalVector[1];
                vertexData[dstOffs++] = face.normalVector[2];
                vertexData[dstOffs++] = srcVertex.textureUV[0];
                vertexData[dstOffs++] = srcVertex.textureUV[1];
                if (srcVertex.lightUV) {
                    vertexData[dstOffs++] = srcVertex.lightUV[0];
                    vertexData[dstOffs++] = srcVertex.lightUV[1];
                } else {
                    vertexData[dstOffs++] = 0;
                    vertexData[dstOffs++] = 0;
                }
                vertexData[dstOffs++] = lightmapNumber;
            }
            //if (i === 24)
            //    break
        }


        for (let j = 0; j < indexData.byteLength / indexData.BYTES_PER_ELEMENT; j++) {
            indexData[j] = j;
        }

        const vertexAttributeDescriptors: GfxVertexAttributeDescriptor[] = [
            { location: RedFactionProgram.a_Position, bufferIndex: 0, bufferByteOffset: 0, format: GfxFormat.F32_RGB, frequency: GfxVertexAttributeFrequency.PER_VERTEX },
            { location: RedFactionProgram.a_Normal, bufferIndex: 0, bufferByteOffset: 3*4, format: GfxFormat.F32_RGB, frequency: GfxVertexAttributeFrequency.PER_VERTEX },
            { location: RedFactionProgram.a_TexCoord, bufferIndex: 0, bufferByteOffset: 6*4, format: GfxFormat.F32_RG, frequency: GfxVertexAttributeFrequency.PER_VERTEX },
            { location: RedFactionProgram.a_LightmapTexCoord, bufferIndex: 0, bufferByteOffset: 8*4, format: GfxFormat.F32_RGB, frequency: GfxVertexAttributeFrequency.PER_VERTEX },
        ];
        this.indexBuffer = makeStaticDataBuffer(device, GfxBufferUsage.INDEX, indexData.buffer);
        this.vertexBuffer = makeStaticDataBuffer(device, GfxBufferUsage.VERTEX, vertexData.buffer);
        const buffers: GfxVertexBufferDescriptor[] = [
            { buffer: this.vertexBuffer, byteStride: 11*4, byteOffset: 0 }, //10*4 without lmap-idx
        ];
        
        //this.inputLayout = device.createInputLayout({ vertexAttributeDescriptors, indexBufferFormat: null });
        //this.inputState = device.createInputState(this.inputLayout, buffers, null);
        this.inputLayout = device.createInputLayout({ vertexAttributeDescriptors, indexBufferFormat: GfxFormat.U16_R });
        this.inputState = device.createInputState(this.inputLayout, buffers, { buffer: this.indexBuffer, byteStride: 2, byteOffset: 0});
    }

    public destroy(device: GfxDevice): void {
        device.destroyBuffer(this.vertexBuffer);
        device.destroyBuffer(this.indexBuffer);
        device.destroyInputLayout(this.inputLayout);
        device.destroyInputState(this.inputState);
    }
}

class RedFactionModelData {
    private indexBuffer: GfxBuffer;
    private posBuffer: GfxBuffer;
    private normBuffer: GfxBuffer;
    private texcBuffer: GfxBuffer;
    private inputLayout: GfxInputLayout;
    public inputState: GfxInputState;
    public renderInst: GfxRenderInst;
    public indexBufferCount : number;
    constructor(device: GfxDevice, public submesh: RF3D.RF3DSubmesh, public lodNumber: number, public batchDataIndex: number) {
        let modelDataBatch = submesh.lodModels[lodNumber].modelData
        let batchInfo = submesh.lodModels[lodNumber].batchInfo[batchDataIndex]
        let batchData = modelDataBatch.batchData[batchDataIndex]
        this.indexBufferCount = batchInfo.trianglesCount

        let dstOffs = 0
        const posData = new Float32Array(3 * batchInfo.verticesCount)
        for (let coord of batchData.positions) {
            posData[dstOffs++] = coord[0] + submesh.boundingSphere.center[0]
            posData[dstOffs++] = coord[1] + submesh.boundingSphere.center[1]
            posData[dstOffs++] = coord[2] + submesh.boundingSphere.center[2]
        }
        
        dstOffs = 0
        const normData = new Float32Array(3 * batchInfo.verticesCount)
        for (let norml of batchData.normals)
            for (let norm of norml)
                normData[dstOffs++] = norm

        dstOffs = 0
        const texcData = new Float32Array(2 * batchInfo.verticesCount)
        for (let texCoord of batchData.texCoords)
            for (let uv of texCoord)
                texcData[dstOffs++] = uv

        dstOffs = 0
        const indexData = new Uint16Array(batchInfo.trianglesCount * 3)
        for (let i = 0; i < batchInfo.trianglesCount; i++) {
            indexData[dstOffs++] = batchData.triangles[i].indices[0]
            indexData[dstOffs++] = batchData.triangles[i].indices[1]
            indexData[dstOffs++] = batchData.triangles[i].indices[2]
        }
        
        //const vertexData = new Float32Array(10 * this.indexBufferCount);
        //const vertLightmapData = new Int16Array(this.indexBufferCount);

        const vertexAttributeDescriptors: GfxVertexAttributeDescriptor[] = [
            { location: RedFactionRF3DProgram.a_Position, bufferIndex: 0, bufferByteOffset: 0, format: GfxFormat.F32_RGB, frequency: GfxVertexAttributeFrequency.PER_VERTEX },
            { location: RedFactionRF3DProgram.a_Normal, bufferIndex: 1, bufferByteOffset: 0, format: GfxFormat.F32_RGB, frequency: GfxVertexAttributeFrequency.PER_VERTEX },
            { location: RedFactionRF3DProgram.a_TexCoord, bufferIndex: 2, bufferByteOffset: 0, format: GfxFormat.F32_RG, frequency: GfxVertexAttributeFrequency.PER_VERTEX },
            //{ location: RedFactionRF3DProgram.a_LightmapTexCoord, bufferIndex: 0, bufferByteOffset: 8*4, format: GfxFormat.F32_RGB, frequency: GfxVertexAttributeFrequency.PER_VERTEX },
        ];
        this.indexBuffer = makeStaticDataBuffer(device, GfxBufferUsage.INDEX, indexData.buffer);
        this.posBuffer = makeStaticDataBuffer(device, GfxBufferUsage.VERTEX, posData.buffer);
        this.normBuffer = makeStaticDataBuffer(device, GfxBufferUsage.VERTEX, normData.buffer);
        this.texcBuffer = makeStaticDataBuffer(device, GfxBufferUsage.VERTEX, texcData.buffer);
        const buffers: GfxVertexBufferDescriptor[] = [
            { buffer: this.posBuffer, byteStride: 3*4, byteOffset: 0 },
            { buffer: this.normBuffer, byteStride: 3*4, byteOffset: 0 },
            { buffer: this.texcBuffer, byteStride: 2*4, byteOffset: 0 },
        ];
        
        //this.inputLayout = device.createInputLayout({ vertexAttributeDescriptors, indexBufferFormat: null });
        //this.inputState = device.createInputState(this.inputLayout, buffers, null);
        this.inputLayout = device.createInputLayout({ vertexAttributeDescriptors, indexBufferFormat: GfxFormat.U16_R });
        this.inputState = device.createInputState(this.inputLayout, buffers, { buffer: this.indexBuffer, byteStride: 2, byteOffset: 0});
    }

    public destroy(device: GfxDevice): void {
        device.destroyBuffer(this.posBuffer);
        device.destroyBuffer(this.normBuffer);
        device.destroyBuffer(this.texcBuffer);
        device.destroyBuffer(this.indexBuffer);
        device.destroyInputLayout(this.inputLayout);
        device.destroyInputState(this.inputState);
    }
}

class RedFactionMapDataInstance {
    public renderInst: GfxRenderInst;
    private gfxSamplers: GfxSampler[] = [];
    public modelMatrix = mat4.create();

    public texturesEnabled = true;
    public lightmapsEnabled = true;
    private animTex = false;
    private animFps = 0;
    private animFct = 0;
    public hideInvisible = true;
    private isSkybox = false;

    constructor(device: GfxDevice, renderInstBuilder: GfxRenderInstBuilder, private rooms: RFL.RF1Rooms | RFL.RF1Brush, textureHolder: TEXTextureHolder, public mapData: RedFactionMapData, private desiredTexture: number, private lightmaps: boolean, lmapIdx: number, private isMover: boolean, private desiredRoom: number) {
        this.renderInst = renderInstBuilder.pushRenderInst();
        this.renderInst.inputState = this.mapData.inputState;
        const cullMode = GfxCullMode.FRONT //todo: figure out what front/back vert order is ??? probably doesnt really matter
        this.renderInst.setMegaStateFlags({
            cullMode: GfxCullMode.FRONT, //todo: figure out proper front/back vert order??? probably doesnt matter
            frontFace: GfxFrontFaceMode.CCW, //ccw if front cullmode; cw if back cullmode
            blendMode: GfxBlendMode.ADD,
            blendDstFactor: GfxBlendFactor.ONE_MINUS_SRC_ALPHA,
            blendSrcFactor: GfxBlendFactor.SRC_ALPHA,
            //depthCompare: GfxCompareMode.,
            //stencilCompare: GfxCompareMode.,
        });

        if (desiredRoom >= 0 && !this.isMover && (this.rooms as RFL.RF1Rooms).rooms[this.desiredRoom].skyRoom !== 0)
            this.isSkybox = true
        
        // TODO(jstpierre): Which render flags to use?
        renderInstBuilder.newUniformBufferInstance(this.renderInst, RedFactionProgram.ub_MeshFragParams);
        //this.renderInst.drawTriangles(mapData.indexBufferCount)
        this.renderInst.drawIndexes(mapData.indexBufferCount)

        //const textureMapping = new TextureMapping();
        const textureMapping = nArray(3, () => new TextureMapping());

        //console.log(rooms.textures)

        let sortAsTransparent = false

        if (desiredTexture >= 0) {
            const texName = this.rooms.textures[desiredTexture].toLowerCase().replace(/\.(tga|vbm)/i,'')
            const ppakTexture = textureHolder.findTexture(texName)

            if (ppakTexture.depth > 1) {
                this.animTex = true
                this.animFps = ppakTexture.levels[0].animFps
                this.animFct = ppakTexture.levels[0].depth
                textureHolder.fillTextureMapping(textureMapping[2], texName);
            } else {
                textureHolder.fillTextureMapping(textureMapping[0], texName);
            }

            //console.log(ppakTexture.levels.length)
            const gfxSampler = device.createSampler({
                magFilter: GfxTexFilterMode.BILINEAR,
                minFilter: GfxTexFilterMode.BILINEAR,
                mipFilter: GfxMipFilterMode.LINEAR,
                minLOD: 0,
                maxLOD: ppakTexture.levels.length,
                wrapS: GfxWrapMode.REPEAT,
                wrapT: GfxWrapMode.REPEAT,
            });
            this.gfxSamplers.push(gfxSampler);

            if (ppakTexture.depth > 1)
                textureMapping[2].gfxSampler = gfxSampler;
            else
                textureMapping[0].gfxSampler = gfxSampler;

            sortAsTransparent = ppakTexture.levels[0].actuallyUsesAlpha
        }//*/

        const layer = sortAsTransparent ? GfxRendererLayer.TRANSLUCENT : GfxRendererLayer.OPAQUE
        this.renderInst.sortKey = makeSortKey(layer, 0) //todo: fix transparent through transparent rendering
        if (sortAsTransparent)
            this.renderInst.setMegaStateFlags({
                depthWrite: false,
                //depthCompare: GfxCompareMode.ALWAYS
            });

        if (lightmaps) {
            const lightmapSampler = device.createSampler({
                magFilter: GfxTexFilterMode.BILINEAR,
                minFilter: GfxTexFilterMode.BILINEAR,
                mipFilter: GfxMipFilterMode.LINEAR,
                minLOD: 0,
                maxLOD: 1,
                wrapS: GfxWrapMode.REPEAT,
                wrapT: GfxWrapMode.REPEAT,
            });
            this.gfxSamplers.push(lightmapSampler);
                textureHolder.fillTextureMapping(textureMapping[1], `redfaction-lightmap-array-${lmapIdx}`);
                textureMapping[1].gfxSampler = lightmapSampler
        }

        /*if (this.meshFragData.meshFrag.streamColor !== null) {
            program.defines.set('USE_VERTEX_COLOR', '1');
        }*/

        this.createProgram();

        //this.renderInst.setSamplerBindingsFromTextureMappings([textureMapping]);
        this.renderInst.setSamplerBindingsFromTextureMappings(textureMapping);
    }

    public createProgram(): void {
        const program = new RedFactionProgram();

        if (this.texturesEnabled && this.desiredTexture >= 0)
            program.defines.set('USE_TEXTURE', '1');
        
        if (this.animTex)
            program.defines.set('TEX_ANIM', '1');
        else
            program.defines.set('TEX_STAT', '1');
        
        if (this.lightmapsEnabled && this.lightmaps && !this.isSkybox) //force no lightmap for skybox
            program.defines.set('USE_LIGHTMAP', '1');
        
        this.renderInst.setDeviceProgram(program);
    }

    private computeModelMatrix(camera: Camera, modelMatrix: mat4, skybox: boolean = false): mat4 {
        if (skybox)
            computeViewMatrixSkybox(scratchMat4, camera);
        else
            computeViewMatrix(scratchMat4, camera);
        mat4.mul(scratchMat4, scratchMat4, modelMatrix);

        if (this.isMover) {
            vec3.mul(scratchVec3, (this.rooms as RFL.RF1Brush).xyz, vec3.fromValues(-GLOBAL_SCALE, GLOBAL_SCALE, GLOBAL_SCALE))
            mat4.translate(scratchMat4, scratchMat4, scratchVec3); //move mover to appropriate location

            mat3.transpose(scratchMat3, (this.rooms as RFL.RF1Brush).rotMatrix)
            quat.fromMat3(scratchQuat, scratchMat3)
            scratchQuat[0] *= -1
            quat.normalize(scratchQuat, scratchQuat)
            mat4.fromQuat(scratchMat4a, scratchQuat)
            
            mat4.mul(scratchMat4, scratchMat4, scratchMat4a) //apply rot mat
        }

        if (skybox) {
            (this.rooms as RFL.RF1Rooms).rooms[this.desiredRoom].aabb.centerPoint(scratchVec3)
            vec3.mul(scratchVec3, scratchVec3, vec3.fromValues(GLOBAL_SCALE, -GLOBAL_SCALE, -GLOBAL_SCALE))
            mat4.translate(scratchMat4, scratchMat4, scratchVec3); //move skybox to origin
        }

        mat4.scale(scratchMat4, scratchMat4, vec3.fromValues(-GLOBAL_SCALE, GLOBAL_SCALE, GLOBAL_SCALE)) //x needs to be mirrored
        if (this.animTex) {
            mat4.translate(scratchMat4, scratchMat4, vec3.fromValues(0.0, 0.0, 0.0))
        }
        return scratchMat4;
    }

    public prepareToRender(meshFragParamsBuffer: GfxRenderBuffer, visible: boolean, viewRenderer: Viewer.ViewerRenderInput) {
        this.renderInst.visible = visible;

        if (this.desiredTexture >= 0 && this.hideInvisible) {
            this.renderInst.visible = this.rooms.textures[this.desiredTexture].toLowerCase().includes('invisible') ? false : visible
        }

        //if (!this.isMover)
        //    this.renderInst.visible = false;

        if (this.renderInst.visible) {
            this.renderInst.passMask = this.isSkybox ? RFPass.SKYBOX : RFPass.MAIN
            let offs = this.renderInst.getUniformBufferOffset(RedFactionProgram.ub_MeshFragParams);
            const mapped = meshFragParamsBuffer.mapBufferF32(offs, 13);
            offs += fillMatrix4x3(mapped, offs, this.computeModelMatrix(viewRenderer.camera, this.modelMatrix, this.isSkybox));
            mapped[offs++] = Math.floor(((viewRenderer.time / 1000) * this.animFps) % this.animFct) //u_AnimFrame
        }
    }

    public destroy(device: GfxDevice): void {
        device.destroyProgram(this.renderInst.gfxProgram);
        for (let i = 0; i < this.gfxSamplers.length; i++)
            device.destroySampler(this.gfxSamplers[i]);
    }
}

class RedFactionModelDataInstance {
    public renderInst: GfxRenderInst;
    private gfxSamplers: GfxSampler[] = [];
    public modelMatrix = mat4.create();

    public texturesEnabled = true;
    public lightmapsEnabled = true;
    private texIdx: number = -1;
    private animTex = false;
    private animFps = 0;
    private animFct = 0;
    public hideInvisible = true;

    constructor(device: GfxDevice, renderInstBuilder: GfxRenderInstBuilder, textureHolder: TEXTextureHolder, public modelData: RedFactionModelData, public clutterInfo: RFL.RF1Clutter | RFL.RF1Item | RFL.RF1Entity, private materialOverrides: string[]) {
        let submesh = modelData.submesh
        let lodNumber = modelData.lodNumber
        let batchDataIndex = modelData.batchDataIndex

        this.renderInst = renderInstBuilder.pushRenderInst();
        this.renderInst.inputState = this.modelData.inputState;
        //TODO: CHANGE CULLING IF DOUBLE-SIDED MAT?
        this.renderInst.setMegaStateFlags({
            //cullMode: GfxCullMode.BACK, //todo: figure out proper front/back vert order??? probably doesnt matter
            //frontFace: GfxFrontFaceMode.CCW, //ccw if back cullmode
            blendMode: GfxBlendMode.ADD,
            blendDstFactor: GfxBlendFactor.ONE_MINUS_SRC_ALPHA,
            blendSrcFactor: GfxBlendFactor.SRC_ALPHA,
            //depthCompare: GfxCompareMode.,
            //stencilCompare: GfxCompareMode.,
        });
        
        // TODO(jstpierre): Which render flags to use?
        renderInstBuilder.newUniformBufferInstance(this.renderInst, RedFactionRF3DProgram.ub_MeshFragParams);
        //this.renderInst.drawTriangles(mapData.indexBufferCount)
        this.renderInst.drawIndexes(modelData.indexBufferCount * 3)

        //const textureMapping = new TextureMapping();
        const textureMapping = nArray(2, () => new TextureMapping());

        let sortAsTransparent = false

        this.texIdx = submesh.lodModels[lodNumber].modelData.batchHeaders[batchDataIndex].texIdx
        if (this.texIdx >= 0) {
            let texName = submesh.materials[this.texIdx].diffuseMapName.toLowerCase().replace(/\.(tga|vbm)/i,'')
            if (materialOverrides !== undefined)
                texName = materialOverrides[this.texIdx].toLowerCase().replace(/\.(tga|vbm)/i,'')
            const ppakTexture = textureHolder.findTexture(texName)

            if (ppakTexture.depth > 1) {
                this.animTex = true
                this.animFps = ppakTexture.levels[0].animFps
                this.animFct = ppakTexture.levels[0].depth
                textureHolder.fillTextureMapping(textureMapping[1], texName);
            } else {
                textureHolder.fillTextureMapping(textureMapping[0], texName);
            }

            //console.log(ppakTexture.levels.length)
            const gfxSampler = device.createSampler({
                magFilter: GfxTexFilterMode.BILINEAR,
                minFilter: GfxTexFilterMode.BILINEAR,
                mipFilter: GfxMipFilterMode.LINEAR,
                minLOD: 0,
                maxLOD: ppakTexture.levels.length,
                wrapS: GfxWrapMode.REPEAT,
                wrapT: GfxWrapMode.REPEAT,
            });
            this.gfxSamplers.push(gfxSampler);

            if (ppakTexture.depth > 1)
                textureMapping[1].gfxSampler = gfxSampler;
            else
                textureMapping[0].gfxSampler = gfxSampler;

            sortAsTransparent = ppakTexture.levels[0].actuallyUsesAlpha
        }//*/

        const layer = sortAsTransparent ? GfxRendererLayer.TRANSLUCENT : GfxRendererLayer.OPAQUE
        if (sortAsTransparent)
            this.renderInst.setMegaStateFlags({
                depthWrite: false,
            });
        this.renderInst.sortKey = makeSortKey(layer, 0) //todo: fix transparent through transparent rendering

        this.createProgram();

        this.renderInst.setSamplerBindingsFromTextureMappings(textureMapping);
        //this.renderInst.setMegaStateFlags({ cullMode: GfxCullMode.FRONT})
        //this.renderInst.setMegaStateFlags({ cullMode: GfxCullMode.FRONT_AND_BACK})
    }

    public createProgram(): void {
        const program = new RedFactionRF3DProgram();

        if (this.texturesEnabled && this.texIdx >= 0)
            program.defines.set('USE_TEXTURE', '1');
        
        if (this.animTex)
            program.defines.set('TEX_ANIM', '1');
        else
            program.defines.set('TEX_STAT', '1');
        
        this.renderInst.setDeviceProgram(program);
    }

    private computeModelMatrix(camera: Camera, modelMatrix: mat4): mat4 {
        computeViewMatrix(scratchMat4, camera);
    
        mat4.mul(scratchMat4, scratchMat4, modelMatrix);
        vec3.mul(scratchVec3, this.clutterInfo.xyz, vec3.fromValues(-GLOBAL_SCALE, GLOBAL_SCALE, GLOBAL_SCALE))
        mat4.translate(scratchMat4, scratchMat4, scratchVec3); //move clutter to appropriate location
    
        mat3.transpose(scratchMat3, this.clutterInfo.rotMatrix)
        quat.fromMat3(scratchQuat, scratchMat3)
        scratchQuat[0] *= -1
        quat.normalize(scratchQuat, scratchQuat)
        mat4.fromQuat(scratchMat4a, scratchQuat)
        
        mat4.mul(scratchMat4, scratchMat4, scratchMat4a) //apply rot mat
        
        mat4.scale(scratchMat4, scratchMat4, vec3.fromValues(-GLOBAL_SCALE, GLOBAL_SCALE, GLOBAL_SCALE))
        return scratchMat4;
    }

    public prepareToRender(meshFragParamsBuffer: GfxRenderBuffer, visible: boolean, viewRenderer: Viewer.ViewerRenderInput) {
        this.renderInst.visible = visible;

        if (this.texIdx >= 0 && this.hideInvisible) {
            let texName = this.modelData.submesh.materials[this.texIdx].diffuseMapName
            if (this.materialOverrides !== undefined)
                texName = this.materialOverrides[this.texIdx]
            this.renderInst.visible = texName.toLowerCase().includes('invisible') ? false : visible
        }

        if (this.renderInst.visible) {
            this.renderInst.passMask = RFPass.MAIN
            let offs = this.renderInst.getUniformBufferOffset(RedFactionRF3DProgram.ub_MeshFragParams);
            const mapped = meshFragParamsBuffer.mapBufferF32(offs, 13);
            offs += fillMatrix4x3(mapped, offs, this.computeModelMatrix(viewRenderer.camera, this.modelMatrix));
            mapped[offs++] = Math.floor(((viewRenderer.time / 1000) * this.animFps) % this.animFct) //u_AnimFrame
        }
    }

    public destroy(device: GfxDevice): void {
        device.destroyProgram(this.renderInst.gfxProgram);
        for (let i = 0; i < this.gfxSamplers.length; i++)
            device.destroySampler(this.gfxSamplers[i]);
    }
}


function fillSceneParamsData(d: Float32Array, camera: Camera, viewRenderer: Viewer.ViewerRenderInput, offs: number = 0): void {
    offs += fillMatrix4x4(d, offs, camera.projectionMatrix);
}

export class SceneRenderer {
    private sceneParamsBuffer: GfxRenderBuffer;
    private meshFragParamsBuffer: GfxRenderBuffer;
    private renderInstBuilder: GfxRenderInstBuilder;
    private templateRenderInst: GfxRenderInst;
    private mapDatas: RedFactionMapData[] = [];
    private mapDataInstances: RedFactionMapDataInstance[] = [];

    constructor(device: GfxDevice, textureHolder: TEXTextureHolder, public rflData: RFL.RF1BaseInterface[]) {
        this.sceneParamsBuffer = new GfxRenderBuffer(GfxBufferUsage.UNIFORM, GfxBufferFrequencyHint.DYNAMIC, `ub_SceneParams`);
        this.meshFragParamsBuffer = new GfxRenderBuffer(GfxBufferUsage.UNIFORM, GfxBufferFrequencyHint.DYNAMIC, `ub_MeshFragParams`);

        const bindingLayouts: GfxBindingLayoutDescriptor[] = [
            { numUniformBuffers: 1, numSamplers: 0 }, // Scene
            { numUniformBuffers: 1, numSamplers: 3 }, // Shape
        ];
        const uniformBuffers = [ this.sceneParamsBuffer, this.meshFragParamsBuffer ];

        this.renderInstBuilder = new GfxRenderInstBuilder(device, RedFactionProgram.programReflection, bindingLayouts, uniformBuffers);

        this.templateRenderInst = this.renderInstBuilder.pushTemplateRenderInst();
        this.renderInstBuilder.newUniformBufferInstance(this.templateRenderInst, RedFactionProgram.ub_SceneParams);

        const lightmapSects: RFL.RF1Lightmaps[] = rflData.filter((sect) => sect.type === RFL.RFLSections.LIGHTMAPS) as RFL.RF1Lightmaps[]
        const staticGeoSects: RFL.RF1Rooms[] = rflData.filter((sect) => sect.type === RFL.RFLSections.STATIC_GEOMETRY) as RFL.RF1Rooms[]
        const moverSects: RFL.RF1Movers[] = rflData.filter((sect) => sect.type === RFL.RFLSections.MOVERS) as RFL.RF1Movers[]

        let mapDataOffs = 0;
        
        for (let sgOff = 0; sgOff < staticGeoSects.length; sgOff++) {
            const rooms = staticGeoSects[sgOff]
            const lightmaps = sgOff < lightmapSects.length
            for (let room = 0; room < rooms.roomCount; room++) {
                for (let i = 0; i < rooms.textureCount; i++) {
                    this.mapDatas.push(new RedFactionMapData(device, rooms, i, rooms.unknownLightmaps, room));
                    if (this.mapDatas[mapDataOffs].indexBufferCount > 0)
                        this.mapDataInstances.push(new RedFactionMapDataInstance(device, this.renderInstBuilder, rooms, textureHolder, this.mapDatas[mapDataOffs], i, lightmaps, sgOff, false, room));
                    mapDataOffs++
                }
            }
        }

        for (let r = 0; r < moverSects.length; r++) {
            const movers = moverSects[r].movers
            const lightmaps = r < lightmapSects.length
            for (let mover of movers) {
                if ((mover.flags & RFL.RF1BrushFlags.AIR) === 1)
                    continue
                for (let i = 0; i < mover.textureCount; i++) {
                    this.mapDatas.push(new RedFactionMapData(device, mover, i, staticGeoSects[0].unknownLightmaps, -4.20))
                    if (this.mapDatas[mapDataOffs].indexBufferCount > 0)
                        this.mapDataInstances.push(new RedFactionMapDataInstance(device, this.renderInstBuilder, mover, textureHolder, this.mapDatas[mapDataOffs], i, lightmaps, r, true, -4.20))
                    mapDataOffs++
                }
            }
        }//*/

    }

    public addToViewRenderer(device: GfxDevice, viewRenderer: GfxRenderInstViewRenderer): void {
        this.renderInstBuilder.popTemplateRenderInst();
        this.renderInstBuilder.finish(device, viewRenderer);
    }

    public prepareToRender(hostAccessPass: GfxHostAccessPass, viewerInput: Viewer.ViewerRenderInput): void {
        let offs = this.templateRenderInst.getUniformBufferOffset(RedFactionProgram.ub_SceneParams);
        const sceneParamsMapped = this.sceneParamsBuffer.mapBufferF32(offs, 16);
        fillSceneParamsData(sceneParamsMapped, viewerInput.camera, viewerInput, offs);

        for (let i = 0; i < this.mapDataInstances.length; i++)
            this.mapDataInstances[i].prepareToRender(this.meshFragParamsBuffer, true, viewerInput);

        this.sceneParamsBuffer.prepareToRender(hostAccessPass);
        this.meshFragParamsBuffer.prepareToRender(hostAccessPass);
    }

    public destroy(device: GfxDevice): void {
        this.sceneParamsBuffer.destroy(device);
        this.meshFragParamsBuffer.destroy(device);
        for (let i = 0; i < this.mapDataInstances.length; i++)
            this.mapDataInstances[i].destroy(device);
        for (let i = 0; i < this.mapDatas.length; i++)
            this.mapDatas[i].destroy(device);
    }

    public setBackfaceCullingEnabled(v: boolean): void {
        const cullMode = v ? GfxCullMode.FRONT : GfxCullMode.NONE;
        for (let mapDataInstance of this.mapDataInstances) {
            mapDataInstance.renderInst.setMegaStateFlags({ cullMode });
        }
    }

    public setBlendMode(v: GfxBlendMode): void {
        for (let mapDataInstance of this.mapDataInstances) mapDataInstance.renderInst.setMegaStateFlags({ blendMode: v });
    }

    public setDst(v: GfxBlendFactor): void {
        for (let mapDataInstance of this.mapDataInstances) mapDataInstance.renderInst.setMegaStateFlags({ blendDstFactor: v });
    }
    
    public setSrc(v: GfxBlendFactor): void {
        for (let mapDataInstance of this.mapDataInstances) mapDataInstance.renderInst.setMegaStateFlags({ blendSrcFactor: v });
    }

    public setTextEnabled(v: boolean): void {
        for (let mapDataInstance of this.mapDataInstances) {
            mapDataInstance.texturesEnabled = v;
            mapDataInstance.createProgram();
        }
    }

    public setLightEnabled(v: boolean): void {
        for (let mapDataInstance of this.mapDataInstances) {
            mapDataInstance.lightmapsEnabled = v;
            mapDataInstance.createProgram();
        }
    }

    public setHideInvisible(v: boolean): void {
        for (let mapDataInstance of this.mapDataInstances)
            mapDataInstance.hideInvisible = v
    }
}

export class ClutterRenderer {
    private sceneParamsBuffer: GfxRenderBuffer;
    private meshFragParamsBuffer: GfxRenderBuffer;
    private renderInstBuilder: GfxRenderInstBuilder;
    private templateRenderInst: GfxRenderInst;
    private clutterDatas: RedFactionModelData[] = [];
    private clutterDataInstances: RedFactionModelDataInstance[] = [];

    constructor(device: GfxDevice, textureHolder: TEXTextureHolder, public rf3dData: RF3D.RF3DBaseInterface[], public clutterInfo: RFL.RF1Clutter | RFL.RF1Item | RFL.RF1Entity, materialOverrides: string[]) {
        this.sceneParamsBuffer = new GfxRenderBuffer(GfxBufferUsage.UNIFORM, GfxBufferFrequencyHint.DYNAMIC, `ub_SceneParams`);
        this.meshFragParamsBuffer = new GfxRenderBuffer(GfxBufferUsage.UNIFORM, GfxBufferFrequencyHint.DYNAMIC, `ub_MeshFragParams`);

        const bindingLayouts: GfxBindingLayoutDescriptor[] = [
            { numUniformBuffers: 1, numSamplers: 0 }, // Scene
            { numUniformBuffers: 1, numSamplers: 2 }, // Shape
        ];
        
        const uniformBuffers = [ this.sceneParamsBuffer, this.meshFragParamsBuffer ];

        this.renderInstBuilder = new GfxRenderInstBuilder(device, RedFactionRF3DProgram.programReflection, bindingLayouts, uniformBuffers);

        this.templateRenderInst = this.renderInstBuilder.pushTemplateRenderInst();
        this.renderInstBuilder.newUniformBufferInstance(this.templateRenderInst, RedFactionRF3DProgram.ub_SceneParams);

        //todo: filter for selected mesh (some files have multiple meshes)
        const submeshSects: RF3D.RF3DSubmesh[] = rf3dData.filter((sect) => sect.type === RF3D.RF3DSections.SUBMESH) as RF3D.RF3DSubmesh[]

        assert(submeshSects.length > 0) //all files should have at least 1 submesh sect

        for (let r = 0; r < submeshSects.length; r++) {
            const submesh = submeshSects[r]
            for (let lod = 0; lod < submesh.lodModelsCount; lod++) {
                for (let bdi = 0; bdi < submesh.lodModels[lod].batchesCount; bdi++) {
                    this.clutterDatas.push(new RedFactionModelData(device, submesh, lod, bdi))
                }
                break //only do highest lod
            }
        }

        for (let i = 0; i < this.clutterDatas.length; i++)
            this.clutterDataInstances.push(new RedFactionModelDataInstance(device, this.renderInstBuilder, textureHolder, this.clutterDatas[i], this.clutterInfo, materialOverrides));
    }

    public addToViewRenderer(device: GfxDevice, viewRenderer: GfxRenderInstViewRenderer): void {
        this.renderInstBuilder.popTemplateRenderInst();
        this.renderInstBuilder.finish(device, viewRenderer);
    }

    public prepareToRender(hostAccessPass: GfxHostAccessPass, viewerInput: Viewer.ViewerRenderInput): void {
        let offs = this.templateRenderInst.getUniformBufferOffset(RedFactionRF3DProgram.ub_SceneParams);
        const sceneParamsMapped = this.sceneParamsBuffer.mapBufferF32(offs, 16);
        fillSceneParamsData(sceneParamsMapped, viewerInput.camera, viewerInput, offs);

        for (let i = 0; i < this.clutterDataInstances.length; i++)
            this.clutterDataInstances[i].prepareToRender(this.meshFragParamsBuffer, true, viewerInput);

        this.sceneParamsBuffer.prepareToRender(hostAccessPass);
        this.meshFragParamsBuffer.prepareToRender(hostAccessPass);
    }

    public destroy(device: GfxDevice): void {
        this.sceneParamsBuffer.destroy(device);
        this.meshFragParamsBuffer.destroy(device);
        for (let i = 0; i < this.clutterDataInstances.length; i++)
            this.clutterDataInstances[i].destroy(device);
        for (let i = 0; i < this.clutterDatas.length; i++)
            this.clutterDatas[i].destroy(device);
    }

    public setBlendMode(v: GfxBlendMode): void {
        for (let clutterDataInstance of this.clutterDataInstances) clutterDataInstance.renderInst.setMegaStateFlags({ blendMode: v });
    }

    public setDst(v: GfxBlendFactor): void {
        for (let clutterDataInstance of this.clutterDataInstances) clutterDataInstance.renderInst.setMegaStateFlags({ blendDstFactor: v });
    }
    
    public setSrc(v: GfxBlendFactor): void {
        for (let clutterDataInstance of this.clutterDataInstances) clutterDataInstance.renderInst.setMegaStateFlags({ blendSrcFactor: v });
    }

    public setTextEnabled(v: boolean): void {
        for (let clutterDataInstance of this.clutterDataInstances) {
            clutterDataInstance.texturesEnabled = v;
            clutterDataInstance.createProgram();
        }
    }

    public setHideInvisible(v: boolean): void {
        for (let clutterDataInstance of this.clutterDataInstances)
        clutterDataInstance.hideInvisible = v
    }
}

export class RedfactionRenderer extends BasicRendererHelper implements Viewer.SceneGfx {
    public defaultCameraController = FPSCameraController;

    public textureHolder = new TEXTextureHolder();
    private sceneRenderers: SceneRenderer[] = [];
    private clutterRenderers: ClutterRenderer[] = [];

    public addSceneRenderer(device: GfxDevice, sceneRenderer: SceneRenderer): void {
        this.sceneRenderers.push(sceneRenderer);
        sceneRenderer.addToViewRenderer(device, this.viewRenderer);
    }

    public addClutterRenderer(device: GfxDevice, clutterRenderer: ClutterRenderer): void {
        this.clutterRenderers.push(clutterRenderer);
        clutterRenderer.addToViewRenderer(device, this.viewRenderer);
    }

    public prepareToRender(hostAccessPass: GfxHostAccessPass, viewerInput: Viewer.ViewerRenderInput): void {
        for (let i = 0; i < this.sceneRenderers.length; i++)
            this.sceneRenderers[i].prepareToRender(hostAccessPass, viewerInput);
        for (let i = 0; i < this.clutterRenderers.length; i++)
            this.clutterRenderers[i].prepareToRender(hostAccessPass, viewerInput);
    }

    public render(device: GfxDevice, viewerInput: Viewer.ViewerRenderInput): GfxRenderPass {
        const hostAccessPass = device.createHostAccessPass();
        this.prepareToRender(hostAccessPass, viewerInput);
        device.submitPass(hostAccessPass);
        this.renderTarget.setParameters(device, viewerInput.viewportWidth, viewerInput.viewportHeight);
        this.viewRenderer.setViewport(viewerInput.viewportWidth, viewerInput.viewportHeight);

        this.viewRenderer.prepareToRender(device);

        // First, render the skybox.
        const skyboxPassRenderer = this.renderTarget.createRenderPass(device, transparentBlackFullClearRenderPassDescriptor);
        this.viewRenderer.executeOnPass(device, skyboxPassRenderer, RFPass.SKYBOX);
        skyboxPassRenderer.endPass(null);
        device.submitPass(skyboxPassRenderer);
        // Now do main pass.
        const mainPassRenderer = this.renderTarget.createRenderPass(device, depthClearRenderPassDescriptor);
        this.viewRenderer.executeOnPass(device, mainPassRenderer, RFPass.MAIN);
        return mainPassRenderer;
    }

    public destroy(device: GfxDevice): void {
        super.destroy(device);
        this.textureHolder.destroy(device);
        for (let i = 0; i < this.sceneRenderers.length; i++)
            this.sceneRenderers[i].destroy(device);
        for (let i = 0; i < this.clutterRenderers.length; i++)
            this.clutterRenderers[i].destroy(device);
    }

    public createPanels(): UI.Panel[] {
        const renderHacksPanel = new UI.Panel();

        renderHacksPanel.customHeaderBackgroundColor = UI.COOL_BLUE_COLOR;
        renderHacksPanel.setTitle(RENDER_HACKS_ICON, 'Render Hacks');
        const enableCullingCheckbox = new UI.Checkbox('Enable Culling', true);
        enableCullingCheckbox.onchanged = () => {
            for (let i = 0; i < this.sceneRenderers.length; i++)
                this.sceneRenderers[i].setBackfaceCullingEnabled(enableCullingCheckbox.checked);
        };
        renderHacksPanel.contents.appendChild(enableCullingCheckbox.elem);

        const blank1 = new UI.Checkbox('--------', false);
        renderHacksPanel.contents.appendChild(blank1.elem);

        const blending = new UI.Checkbox('alpha blending', true)

        blending.onchanged = () => {
            if (blending.checked) {
                for (let i = 0; i < this.sceneRenderers.length; i++) {
                    this.sceneRenderers[i].setBlendMode(GfxBlendMode.ADD)
                    this.sceneRenderers[i].setDst(GfxBlendFactor.ONE_MINUS_SRC_ALPHA)
                    this.sceneRenderers[i].setSrc(GfxBlendFactor.SRC_ALPHA)
                }
                for (let i = 0; i < this.clutterRenderers.length; i++) {
                    this.clutterRenderers[i].setBlendMode(GfxBlendMode.ADD)
                    this.clutterRenderers[i].setDst(GfxBlendFactor.ONE_MINUS_SRC_ALPHA)
                    this.clutterRenderers[i].setSrc(GfxBlendFactor.SRC_ALPHA)
                }
            } else {
                for (let i = 0; i < this.sceneRenderers.length; i++) {
                    this.sceneRenderers[i].setBlendMode(GfxBlendMode.NONE)
                }
                for (let i = 0; i < this.clutterRenderers.length; i++) {
                    this.clutterRenderers[i].setBlendMode(GfxBlendMode.NONE)
                }
            }
        }
        renderHacksPanel.contents.appendChild(blending.elem);

        const textEnabled = new UI.Checkbox('textures', true)
        textEnabled.onchanged = () => {
            for (let i = 0; i < this.sceneRenderers.length; i++)
                this.sceneRenderers[i].setTextEnabled(textEnabled.checked)
            for (let i = 0; i < this.clutterRenderers.length; i++)
                this.clutterRenderers[i].setTextEnabled(textEnabled.checked)
        }
        const lmapEnabled = new UI.Checkbox('lightmaps', true)
        lmapEnabled.onchanged = () => {
            for (let i = 0; i < this.sceneRenderers.length; i++)
                this.sceneRenderers[i].setLightEnabled(lmapEnabled.checked)
        }

        renderHacksPanel.contents.appendChild(textEnabled.elem);
        renderHacksPanel.contents.appendChild(lmapEnabled.elem);

        const showInvisTex = new UI.Checkbox('show invisible textures', false)
        showInvisTex.onchanged = () => {
            for (let i = 0; i < this.sceneRenderers.length; i++)
                this.sceneRenderers[i].setHideInvisible(!showInvisTex.checked)
            for (let i = 0; i < this.clutterRenderers.length; i++)
                this.clutterRenderers[i].setHideInvisible(!showInvisTex.checked)
        }

        renderHacksPanel.contents.appendChild(showInvisTex.elem)

        return [renderHacksPanel]
    }
}
